#!/usr/bin/env python3
"""
Broaching Machine Sensor Bridge v3.1
======================================
Reads ALL 3 sensors through a SINGLE Arduino Uno COM port.
Arduino sends one line per second:
  TEMP:25.30,VIB:0.45,CURR:2.10

- Streams live data to browser via WebSocket (ws://localhost:8765/ws)
- Saves every reading permanently to cloud database

INSTALL:  pip install pyserial websockets requests
RUN:      python sensor_bridge.py
"""

import asyncio, json, re, logging, sys, threading
import requests
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

HOST          = 'localhost'
WS_PORT       = 8765
BAUD_RATE     = 9600
READ_INTERVAL = 0.1

# Cloud API endpoint — saves data permanently
CLOUD_API_URL = 'https://machine-ed65069d.base44.app/functions/saveSensorReading'

# Set your Arduino COM port here, or leave None to auto-detect
ARDUINO_PORT = None   # e.g. 'COM3'

# Thresholds for alerts
THRESHOLDS = {
    'temperature_c':        {'warn': 82, 'error': 88},
    'vibration_rms_mm_s2':  {'warn': 28, 'error': 33},
    'spindle_current_a':    {'warn': 41, 'error': 44},
}

try:
    import serial
    import serial.tools.list_ports
    SERIAL_OK = True
except ImportError:
    SERIAL_OK = False
    log.error('pyserial not installed. Run: pip install pyserial')
    sys.exit(1)

try:
    import websockets
except ImportError:
    log.error('websockets not installed. Run: pip install websockets')
    sys.exit(1)


def auto_detect_port():
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        return None
    for p in ports:
        log.info(f'Found port: {p.device} — {p.description}')
    for p in ports:
        desc = (p.description or '').lower()
        if any(x in desc for x in ['arduino', 'ch340', 'ch341', 'usb serial', 'usb-serial', 'uart']):
            log.info(f'Auto-selected: {p.device}')
            return p.device
    log.info(f'Auto-selected (fallback): {ports[0].device}')
    return ports[0].device


def parse_line(line: str):
    line = line.strip()
    if not line:
        return None
    try:
        t_m = re.search(r'TEMP[:\s]+([-\d.]+)', line, re.IGNORECASE)
        v_m = re.search(r'VIB[:\s]+([-\d.]+)',  line, re.IGNORECASE)
        c_m = re.search(r'CURR[:\s]+([-\d.]+)', line, re.IGNORECASE)
        if t_m and v_m and c_m:
            return float(t_m.group(1)), float(v_m.group(1)), float(c_m.group(1))
        parts = [p.strip() for p in line.split(',')]
        if len(parts) >= 3:
            return float(parts[0]), float(parts[1]), float(parts[2])
    except Exception as e:
        log.debug(f'Parse error on "{line}": {e}')
    return None


def derive_params(temp, vib, curr):
    force = max(2500, min(11500, curr * 240 + vib * 15 + (temp - 77) * 50))
    ae    = max(300,  min(650,   curr * 12 + vib * 2.5 + 200))
    wear  = min(1.5,  max(0,     (vib - 6) / 31 * 1.5))
    if   vib > 33 or temp > 88 or curr > 44: status = 'failed'
    elif vib > 28 or temp > 82 or curr > 41: status = 'worn'
    else:                                     status = 'new'
    sf = 0.5 if status == 'new' else (0.8 if status == 'worn' else 1.2)
    return {
        'cutting_force_n':      round(force, 1),
        'acoustic_emission_db': round(ae, 1),
        'surface_finish_ra_um': sf,
        'wear_progression':     round(wear, 3),
        'tool_status':          status,
        'spindle_speed_mmin':   round(15 + (curr - 38) * 0.5, 1),
        'feed_rate_mmtooth':    round(0.065 + (temp - 77) * 0.001, 3),
        'coolant_flow_lmin':    round(18 + (temp - 77) * 0.2, 1),
    }


def check_alerts(reading):
    alerts = []
    for param, limits in THRESHOLDS.items():
        val = reading.get(param)
        if val is None:
            continue
        if val >= limits['error']:
            alerts.append({'type': 'error', 'parameter': param, 'value': val, 'threshold': limits['error'],
                           'message': f'{param} critically high: {val}'})
        elif val >= limits['warn']:
            alerts.append({'type': 'warning', 'parameter': param, 'value': val, 'threshold': limits['warn'],
                           'message': f'{param} high: {val}'})
    return alerts


def save_to_cloud(reading, alerts):
    """Save reading to cloud DB in a background thread (non-blocking)."""
    def _post():
        try:
            resp = requests.post(
                CLOUD_API_URL,
                json={'reading': reading, 'alerts': alerts},
                timeout=5
            )
            if resp.status_code == 200:
                log.debug(f'Cloud save OK — id={resp.json().get("id")}')
            else:
                log.warning(f'Cloud save failed: {resp.status_code} {resp.text}')
        except Exception as e:
            log.warning(f'Cloud save error: {e}')
    threading.Thread(target=_post, daemon=True).start()


# ── WebSocket server ────────────────────────────────────────────────────────
connected_clients = set()

async def ws_handler(websocket):
    connected_clients.add(websocket)
    log.info(f'Browser connected — {len(connected_clients)} client(s)')
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)
        log.info(f'Browser disconnected — {len(connected_clients)} client(s)')


async def broadcast(payload: dict):
    if not connected_clients:
        return
    msg  = json.dumps(payload)
    dead = set()
    for client in list(connected_clients):
        try:
            await client.send(msg)
        except Exception:
            dead.add(client)
    connected_clients.difference_update(dead)


# ── Serial reading loop ──────────────────────────────────────────────────────
async def serial_loop(port: str):
    ser   = None
    cycle = 0
    while True:
        if ser is None or not ser.is_open:
            try:
                ser = serial.Serial(port, BAUD_RATE, timeout=1)
                log.info(f'Opened {port} at {BAUD_RATE} baud')
            except Exception as e:
                log.warning(f'Cannot open {port}: {e}  — retrying in 3s')
                await asyncio.sleep(3)
                continue
        try:
            raw = ser.readline().decode('utf-8', errors='ignore')
        except Exception as e:
            log.warning(f'Read error: {e}')
            ser = None
            await asyncio.sleep(1)
            continue

        result = parse_line(raw)
        if result is None:
            await asyncio.sleep(READ_INTERVAL)
            continue

        temp, vib, curr = result
        cycle += 1
        derived = derive_params(temp, vib, curr)
        reading = {
            'timestamp':           datetime.now().isoformat(),
            'cycle':               cycle,
            'temperature_c':       round(temp, 2),
            'vibration_rms_mm_s2': round(vib,  2),
            'spindle_current_a':   round(curr,  2),
            'tool_id':             'TB001',
            'tool_material':       'Carbide',
            'coating':             'TiN',
            **derived,
        }

        alerts = check_alerts(reading)

        # 1. Stream to browser (instant)
        await broadcast(reading)

        # 2. Save to cloud database (background, non-blocking)
        save_to_cloud(reading, alerts)

        log.info(f'#{cycle} TEMP={temp:.1f}°C  VIB={vib:.2f}  CURR={curr:.2f}A  → {derived["tool_status"]}  ☁ saved')
        await asyncio.sleep(READ_INTERVAL)


# ── Main ────────────────────────────────────────────────────────────────────
async def main():
    print('=' * 55)
    print('  BROACHING SENSOR BRIDGE v3.1')
    print('  Live stream + Cloud database storage')
    print('=' * 55)

    port = ARDUINO_PORT or auto_detect_port()
    if not port:
        log.error('No COM port found. Plug in your Arduino and try again.')
        sys.exit(1)

    print(f'  Arduino port : {port}')
    print(f'  WebSocket    : ws://{HOST}:{WS_PORT}/ws')
    print(f'  Cloud DB     : {CLOUD_API_URL}')
    print('  Waiting for browser to connect...')
    print('=' * 55)

    await websockets.serve(ws_handler, HOST, WS_PORT, path='/ws')
    await serial_loop(port)


if __name__ == '__main__':
    asyncio.run(main())
