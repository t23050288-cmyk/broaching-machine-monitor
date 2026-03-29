#!/usr/bin/env python3
"""
Broaching Machine Sensor Bridge v2.0
======================================
Run on the Windows PC next to the machine.
Reads USB sensors, sends real data to browser via WebSocket.

INSTALL:  pip install pyserial websockets aiohttp
RUN:      python sensor_bridge.py
AI:       set AI_API_KEY=sk-... && python sensor_bridge.py

Your sensors should output simple lines via serial (USB):
  Temperature: '79.5' or 'TEMP:79.5'
  Vibration:   '24.3' or 'VIB:24.3'
  Current:     '38.7' or 'CURR:38.7'
"""

import asyncio, json, os, re, logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

HOST = 'localhost'
PORT = 8765
READ_INTERVAL = 1.0
AI_API_KEY = os.environ.get('AI_API_KEY', '')

# Set your COM ports here, or leave None to auto-detect
TEMP_PORT    = None  # e.g. 'COM3'
VIB_PORT     = None  # e.g. 'COM4'
CURRENT_PORT = None  # e.g. 'COM5'

try:
    import serial, serial.tools.list_ports
    SERIAL_OK = True
except ImportError:
    SERIAL_OK = False
    log.warning('pyserial not installed. Run: pip install pyserial')

try:
    import websockets
except ImportError:
    log.error('websockets not installed. Run: pip install websockets')
    exit(1)

try:
    from aiohttp import web
    AIOHTTP_OK = True
except ImportError:
    AIOHTTP_OK = False


class SensorReader:
    def __init__(self, port, baud=9600, label='sensor'):
        self.port = port; self.baud = baud; self.label = label
        self.ser = None; self.last_value = None

    def connect(self):
        try:
            self.ser = serial.Serial(self.port, self.baud, timeout=1)
            log.info(f'[{self.label}] Connected to {self.port}')
            return True
        except Exception as e:
            log.warning(f'[{self.label}] Cannot open {self.port}: {e}')
            return False

    def read(self):
        try:
            if not self.ser or not self.ser.is_open:
                self.connect(); return self.last_value
            line = self.ser.readline().decode('utf-8', errors='ignore').strip()
            if not line: return self.last_value
            v = float(re.sub(r'[^0-9.\-]', '', line.split(':')[-1].strip()))
            self.last_value = v
            return v
        except Exception as e:
            log.debug(f'[{self.label}] Read error: {e}')
            return self.last_value


def estimate_derived(temp, vib, current):
    """Physics-based estimation of unmeasured parameters."""
    force = max(2500, min(11500, current * 240 + vib * 15 + (temp - 77) * 50))
    ae    = max(300,  min(650,   current * 12  + vib * 2.5 + 200))
    wear  = min(1.5,  max(0,     (vib - 6) / 31 * 1.5))
    if   vib > 33 or temp > 88 or current > 44: status = 'failed'
    elif vib > 28 or temp > 82 or current > 41: status = 'worn'
    else:                                        status = 'new'
    sf = 0.5 if status == 'new' else (0.8 if status == 'worn' else 1.2)
    return {
        'cutting_force_n':     round(force, 1),
        'acoustic_emission_db': round(ae, 1),
        'surface_finish_ra_um': sf,
        'wear_progression':    round(wear, 3),
        'tool_status':         status,
        'spindle_speed_mmin':  round(15 + (current - 38) * 0.5, 1),
        'feed_rate_mmtooth':   round(0.065 + (temp - 77) * 0.001, 3),
        'coolant_flow_lmin':   round(18 + (temp - 77) * 0.2, 1),
    }


async def get_derived(temp, vib, current, api_key):
    if not api_key:
        return estimate_derived(temp, vib, current)
    try:
        import aiohttp
        prompt = (f'Broaching machine: Temp={temp:.1f}C, Vib={vib:.2f}mm/s2, Current={current:.2f}A. '
                  'Return JSON only: cutting_force_n, acoustic_emission_db, surface_finish_ra_um, '
                  'wear_progression(0-1.5), tool_status(new/worn/failed), spindle_speed_mmin, '
                  'feed_rate_mmtooth, coolant_flow_lmin')
        async with aiohttp.ClientSession() as s:
            async with s.post('https://api.openai.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {api_key}'},
                json={'model': 'gpt-4o-mini', 'messages': [{'role': 'user', 'content': prompt}], 'max_tokens': 250},
                timeout=aiohttp.ClientTimeout(total=5)) as r:
                res = await r.json()
                m = re.search(r'\{.*\}', res['choices'][0]['message']['content'], re.DOTALL)
                if m: return json.loads(m.group())
    except Exception as e:
        log.debug(f'AI error: {e}')
    return estimate_derived(temp, vib, current)


connected = set()

async def ws_handler(websocket):
    connected.add(websocket)
    log.info(f'Browser connected ({len(connected)} clients)')
    try: await websocket.wait_closed()
    finally:
        connected.discard(websocket)
        log.info(f'Browser disconnected ({len(connected)} clients)')


async def broadcast(data):
    if not connected: return
    msg = json.dumps(data)
    dead = set()
    for c in list(connected):
        try: await c.send(msg)
        except: dead.add(c)
    connected.difference_update(dead)


def auto_detect_ports():
    if not SERIAL_OK: return None, None, None
    ports = [p.device for p in serial.tools.list_ports.comports()]
    log.info(f'Available COM ports: {ports}')
    return (ports + [None, None, None])[:3]


async def sensor_loop(t_s, v_s, c_s):
    cycle = 0
    while True:
        await asyncio.sleep(READ_INTERVAL)
        cycle += 1
        temp = t_s.read() if t_s else None
        vib  = v_s.read()  if v_s  else None
        curr = c_s.read()  if c_s  else None
        if all(v is None for v in [temp, vib, curr]):
            continue
        temp = temp or 25.0; vib = vib or 0.0; curr = curr or 0.0
        derived = await get_derived(temp, vib, curr, AI_API_KEY)
        reading = {
            'timestamp': datetime.now().isoformat(), 'cycle': cycle,
            'temperature_c': round(temp, 2),
            'vibration_rms_mm_s2': round(vib, 2),
            'spindle_current_a': round(curr, 2),
            'tool_id': 'TB001', 'tool_material': 'Carbide', 'coating': 'TiN',
            **derived
        }
        await broadcast(reading)
        log.info(f'#{cycle} T={temp:.1f}C V={vib:.2f} I={curr:.2f}A → {derived["tool_status"]}')


async def http_health(request):
    return web.Response(
        text=json.dumps({'status': 'ok', 'clients': len(connected)}),
        content_type='application/json',
        headers={'Access-Control-Allow-Origin': '*'}
    )


async def main():
    print('=' * 50)
    print('  BROACHING SENSOR BRIDGE v2.0')
    print('=' * 50)
    tp = TEMP_PORT; vp = VIB_PORT; cp = CURRENT_PORT
    if not any([tp, vp, cp]):
        tp, vp, cp = auto_detect_ports()
    t_s = SensorReader(tp, label='TEMP')    if tp else None
    v_s = SensorReader(vp, label='VIB')     if vp else None
    c_s = SensorReader(cp, label='CURRENT') if cp else None
    if t_s: t_s.connect()
    if v_s: v_s.connect()
    if c_s: c_s.connect()
    if AIOHTTP_OK:
        app = web.Application()
        app.router.add_get('/health', http_health)
        runner = web.AppRunner(app)
        await runner.setup()
        await web.TCPSite(runner, HOST, PORT).start()
    await websockets.serve(ws_handler, HOST, PORT, path='/ws')
    print(f'\nBridge live  →  ws://{HOST}:{PORT}/ws')
    print(f'Health check →  http://{HOST}:{PORT}/health')
    print('Open the app in Chrome/Edge — it auto-connects.\n')
    await sensor_loop(t_s, v_s, c_s)


if __name__ == '__main__':
    asyncio.run(main())
