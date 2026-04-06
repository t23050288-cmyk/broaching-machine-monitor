#!/usr/bin/env python3
"""
Broaching Machine Sensor Bridge v5.1
- Fixed: websockets compatibility (removed 'path' arg)
- Fixed: COM port set to COM7
- Reads Arduino via serial, streams to browser via WebSocket
- Handles AI chat from browser

INSTALL: pip install pyserial websockets openai
RUN:     python sensor_bridge.py
"""

import asyncio, json, re, logging, sys
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

HOST         = 'localhost'
WS_PORT      = 8765
BAUD         = 9600
ARDUINO_PORT = 'COM7'   # <-- your Arduino port

NVIDIA_API_KEY  = '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'
NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
AI_MODEL        = 'meta/llama-3.1-8b-instruct'

CHAT_SYSTEM = """You are KineticAI, an expert assistant for broaching machine monitoring and tool life management.
You have deep knowledge of broaching machine operations, tool wear, sensor data interpretation,
cutting parameters, coolant systems, coatings, and safety protocols.
Be concise, practical, and helpful. Use simple language."""

try:
    import serial
except ImportError:
    log.error('Run: pip install pyserial'); sys.exit(1)

try:
    import websockets
    from websockets.asyncio.server import serve as ws_serve
    NEW_WS = True
except ImportError:
    try:
        import websockets
        NEW_WS = False
    except ImportError:
        log.error('Run: pip install websockets'); sys.exit(1)

try:
    from openai import OpenAI
    ai_client   = OpenAI(base_url=NVIDIA_BASE_URL, api_key=NVIDIA_API_KEY)
    AI_AVAILABLE = True
    log.info('AI enabled via NVIDIA API')
except ImportError:
    AI_AVAILABLE = False
    log.warning('openai not installed — run: pip install openai')

# ── Shared state ────────────────────────────────────────────────────────────
connected       = set()
latest_data     = None
reading_history = []

# ── Physics fallback ────────────────────────────────────────────────────────
def physics_derive(temp, vib, curr):
    force   = max(2500, min(11500, curr*240 + vib*15 + (temp-25)*50))
    ae      = max(300,  min(650,   curr*12  + vib*2.5 + 200))
    wear    = min(1.5,  max(0,     (vib - 0.5) / 8.0 * 1.5))
    surface = 0.5 if vib < 2.5 else (0.8 if vib < 5 else 1.2)
    if   vib > 8.0 or temp > 88 or curr > 44: status = 'failed'
    elif vib > 5.0 or temp > 82 or curr > 41: status = 'worn'
    else:                                       status = 'new'
    return {
        'cutting_force_n':      round(force, 1),
        'acoustic_emission_db': round(ae, 1),
        'surface_finish_ra_um': surface,
        'wear_progression':     round(wear, 4),
        'tool_status':          status,
        'spindle_speed_mmin':   round(15 + (curr - 5)*0.5, 1),
        'feed_rate_mmtooth':    round(0.065 + (temp - 25)*0.001, 4),
        'coolant_flow_lmin':    round(18 + (temp - 25)*0.2, 1),
        'prediction_source':    'physics',
    }

def ai_derive(temp, vib, curr):
    if not AI_AVAILABLE:
        return physics_derive(temp, vib, curr)
    try:
        prompt = f"""You are an expert in broaching machine tool monitoring.
Given live sensor readings:
- Temperature: {temp:.2f} C
- Vibration RMS: {vib:.3f} m/s2
- Spindle Current: {curr:.3f} A
Predict (respond ONLY with valid JSON):
{{"cutting_force_n":<2500-11500>,"acoustic_emission_db":<300-650>,"surface_finish_ra_um":<0.2-2.0>,"wear_progression":<0.0-1.5>,"tool_status":"new" or "worn" or "failed","spindle_speed_mmin":<10-30>,"feed_rate_mmtooth":<0.04-0.12>,"coolant_flow_lmin":<15-25>}}"""
        resp = ai_client.chat.completions.create(
            model=AI_MODEL,
            messages=[{'role':'user','content':prompt}],
            temperature=0.1, max_tokens=300, stream=False
        )
        text = resp.choices[0].message.content.strip()
        m = re.search(r'\{[^{}]+\}', text, re.DOTALL)
        if m:
            result = json.loads(m.group())
            result['prediction_source'] = 'ai'
            return result
    except Exception as e:
        log.warning(f'AI derive failed: {e}')
    return physics_derive(temp, vib, curr)

def ai_chat(messages, sensor_context=''):
    if not AI_AVAILABLE:
        return 'AI not available. Run: pip install openai'
    try:
        system = CHAT_SYSTEM
        if sensor_context:
            system += f'\n\nCurrent live sensor readings:\n{sensor_context}'
        resp = ai_client.chat.completions.create(
            model=AI_MODEL,
            messages=[{'role':'system','content':system}] + messages,
            temperature=0.4, max_tokens=500, stream=False
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        return f'AI error: {e}'

# ── Serial parsing ───────────────────────────────────────────────────────────
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
    except:
        pass
    return None

# ── WebSocket broadcast ──────────────────────────────────────────────────────
async def broadcast(data):
    if not connected: return
    msg  = json.dumps(data)
    dead = set()
    for c in list(connected):
        try:    await c.send(msg)
        except: dead.add(c)
    connected.difference_update(dead)

# ── WebSocket handler ────────────────────────────────────────────────────────
async def ws_handler(ws):
    global latest_data
    # websockets legacy API passes (ws, path), new API passes just ws
    connected.add(ws)
    log.info(f'Browser connected ({len(connected)} clients)')
    await ws.send(json.dumps({'type': 'status', 'status': 'connected'}))
    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
                if msg.get('type') == 'chat':
                    messages   = msg.get('messages', [])
                    ctx        = ''
                    if latest_data:
                        ctx = (f"Temperature: {latest_data.get('temperature_c')}C, "
                               f"Vibration: {latest_data.get('vibration_rms_mm_s2')} m/s2, "
                               f"Current: {latest_data.get('spindle_current_a')}A, "
                               f"Tool Status: {latest_data.get('tool_status')}, "
                               f"Wear: {latest_data.get('wear_progression')}")
                    reply = await asyncio.get_event_loop().run_in_executor(None, ai_chat, messages, ctx)
                    await ws.send(json.dumps({'type': 'chat_reply', 'reply': reply}))
            except json.JSONDecodeError:
                pass
    finally:
        connected.discard(ws)
        log.info(f'Browser disconnected ({len(connected)} clients)')

# ── Legacy handler wrapper (for older websockets that passes path) ────────────
async def ws_handler_legacy(ws, path=None):
    await ws_handler(ws)

# ── Serial loop ──────────────────────────────────────────────────────────────
async def serial_loop(port):
    global latest_data
    ser   = None
    cycle = 0
    while True:
        if ser is None or not ser.is_open:
            try:
                ser = serial.Serial(port, BAUD, timeout=1)
                log.info(f'Opened {port} at {BAUD} baud — waiting for data...')
                await broadcast({'type': 'status', 'status': 'connected'})
            except Exception as e:
                log.warning(f'Cannot open {port}: {e} — retrying in 3s')
                await broadcast({'type': 'status', 'status': 'disconnected'})
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
            await asyncio.sleep(0.05)
            continue

        temp, vib, curr = result
        temp = max(0, min(150, temp))
        vib  = max(0, min(50,  vib))
        curr = max(0, min(60,  curr))
        cycle += 1

        derived = await asyncio.get_event_loop().run_in_executor(None, ai_derive, temp, vib, curr)
        reading = {
            'type': 'reading',
            'data': {
                'timestamp':           datetime.now().isoformat(),
                'cycle':               cycle,
                'temperature_c':       round(temp, 2),
                'vibration_rms_mm_s2': round(vib,  3),
                'spindle_current_a':   round(curr, 3),
                'tool_id':             'TB001',
                'tool_material':       'Carbide',
                'coating':             'TiN',
                **derived,
            }
        }
        latest_data = reading['data']
        reading_history.append(reading['data'])
        if len(reading_history) > 86400:
            reading_history.pop(0)

        await broadcast(reading)
        log.info(f'#{cycle} T={temp:.1f}C V={vib:.3f} I={curr:.3f}A -> {derived["tool_status"]} [{derived["prediction_source"]}]')
        await asyncio.sleep(0.05)

# ── Main ─────────────────────────────────────────────────────────────────────
async def main():
    print('=' * 52)
    print('  BROACHING SENSOR BRIDGE v5.1')
    print(f'  Arduino  : {ARDUINO_PORT}')
    print(f'  WebSocket: ws://{HOST}:{WS_PORT}')
    print(f'  AI       : {"ENABLED" if AI_AVAILABLE else "install openai"}')
    print('=' * 52)

    # Support both new and old websockets versions
    try:
        # New websockets (>=12) — no 'path' argument
        from websockets.asyncio.server import serve as ws_serve_new
        server = ws_serve_new(ws_handler, HOST, WS_PORT)
    except ImportError:
        # Old websockets (<12)
        import websockets as _ws
        server = _ws.serve(ws_handler_legacy, HOST, WS_PORT)

    async with server:
        log.info(f'WebSocket server running on ws://{HOST}:{WS_PORT}')
        await serial_loop(ARDUINO_PORT)

if __name__ == '__main__':
    asyncio.run(main())
