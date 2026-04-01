#!/usr/bin/env python3
"""
Broaching Machine Sensor Bridge v4.0
Reads Arduino via single COM port, streams to browser via WebSocket.
INSTALL: pip install pyserial websockets requests
RUN:     python sensor_bridge.py
"""

import asyncio, json, re, logging, sys
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

HOST         = '0.0.0.0'
WS_PORT      = 8765
BAUD         = 9600
ARDUINO_PORT = 'COM7'

THRESHOLDS = {
    'temperature_c':       {'warn': 82, 'error': 88},
    'vibration_rms_mm_s2': {'warn': 28, 'error': 33},
    'spindle_current_a':   {'warn': 41, 'error': 44},
}

try:
    import serial
except ImportError:
    log.error('pyserial not installed. Run: pip install pyserial'); sys.exit(1)

try:
    import websockets
    from websockets.asyncio.server import serve as ws_serve
except ImportError:
    log.error('websockets not installed. Run: pip install websockets'); sys.exit(1)


def parse_line(line):
    line = line.strip()
    if not line: return None
    try:
        t = re.search(r'TEMP[:\s]+([-\d.]+)', line, re.IGNORECASE)
        v = re.search(r'VIB[:\s]+([-\d.]+)',  line, re.IGNORECASE)
        c = re.search(r'CURR[:\s]+([-\d.]+)', line, re.IGNORECASE)
        if t and v and c:
            return float(t.group(1)), float(v.group(1)), float(c.group(1))
        parts = [p.strip() for p in line.split(',')]
        if len(parts) >= 3:
            return float(parts[0]), float(parts[1]), float(parts[2])
    except Exception as e:
        log.debug(f'Parse error: {e}')
    return None


def derive(temp, vib, curr):
    force = max(2500, min(11500, curr*240 + vib*15 + (temp-77)*50))
    ae    = max(300,  min(650,   curr*12  + vib*2.5 + 200))
    wear  = min(1.5,  max(0,     (vib-6) / 31 * 1.5))
    if   vib > 33 or temp > 88 or curr > 44: status = 'failed'
    elif vib > 28 or temp > 82 or curr > 41: status = 'worn'
    else:                                     status = 'new'
    sf = 0.5 if status=='new' else (0.8 if status=='worn' else 1.2)
    return {
        'cutting_force_n':      round(force, 1),
        'acoustic_emission_db': round(ae, 1),
        'surface_finish_ra_um': sf,
        'wear_progression':     round(wear, 3),
        'tool_status':          status,
        'spindle_speed_mmin':   round(15 + (curr-38)*0.5, 1),
        'feed_rate_mmtooth':    round(0.065 + (temp-77)*0.001, 3),
        'coolant_flow_lmin':    round(18 + (temp-77)*0.2, 1),
    }


connected = set()
latest_reading = None


async def ws_handler(websocket):
    global latest_reading
    connected.add(websocket)
    log.info(f'Browser connected — {len(connected)} client(s)')
    # immediately send last known reading so UI populates instantly
    if latest_reading:
        try:
            await websocket.send(json.dumps(latest_reading))
        except Exception:
            pass
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                if data.get('type') == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))
            except Exception:
                pass
    except Exception:
        pass
    finally:
        connected.discard(websocket)
        log.info(f'Browser disconnected — {len(connected)} client(s)')


async def broadcast(data):
    if not connected: return
    msg  = json.dumps(data)
    dead = set()
    for c in list(connected):
        try:
            await c.send(msg)
        except Exception:
            dead.add(c)
    connected.difference_update(dead)


async def serial_loop(port):
    global latest_reading
    ser   = None
    cycle = 0
    while True:
        if ser is None or not ser.is_open:
            try:
                ser = serial.Serial(port, BAUD, timeout=1)
                log.info(f'Opened {port} at {BAUD} baud — waiting for data...')
            except Exception as e:
                log.warning(f'Cannot open {port}: {e} — retrying in 3s')
                await asyncio.sleep(3)
                continue
        try:
            raw = ser.readline().decode('utf-8', errors='ignore')
        except Exception as e:
            log.warning(f'Read error: {e}')
            try: ser.close()
            except: pass
            ser = None
            await asyncio.sleep(1)
            continue

        result = parse_line(raw)
        if result is None:
            await asyncio.sleep(0.05)
            continue

        temp, vib, curr = result
        cycle += 1
        derived = derive(temp, vib, curr)
        reading = {
            'timestamp':           datetime.now().isoformat(),
            'cycle':               cycle,
            'temperature_c':       round(temp, 2),
            'vibration_rms_mm_s2': round(vib,  2),
            'spindle_current_a':   round(curr, 2),
            'tool_id':             'TB001',
            'tool_material':       'Carbide',
            'coating':             'TiN',
            **derived,
        }
        latest_reading = reading
        await broadcast(reading)
        log.info(f'#{cycle} TEMP={temp:.1f}C VIB={vib:.2f} CURR={curr:.2f}A -> {derived["tool_status"]}')
        await asyncio.sleep(0.05)


async def main():
    print('=' * 50)
    print('  BROACHING SENSOR BRIDGE v4.0')
    print(f'  Arduino : {ARDUINO_PORT}')
    print(f'  WebSocket: ws://localhost:{WS_PORT}/ws')
    print('=' * 50)
    async with ws_serve(
        ws_handler,
        HOST,
        WS_PORT,
        ping_interval=10,
        ping_timeout=30,
        close_timeout=10,
    ):
        await serial_loop(ARDUINO_PORT)


if __name__ == '__main__':
    asyncio.run(main())
