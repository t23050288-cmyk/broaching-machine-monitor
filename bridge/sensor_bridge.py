#!/usr/bin/env python3
"""
Broaching Machine Sensor Bridge v4.0
Reads Arduino via COM port, uses AI to predict derived parameters,
streams everything to browser via WebSocket.

INSTALL: pip install pyserial websockets requests openai
RUN:     python sensor_bridge.py
"""

import asyncio, json, re, logging, sys, os
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

HOST         = 'localhost'
WS_PORT      = 8765
Baud         = 9600
ARDUINO_PORT = 'COM4'   # <-- change if needed

# ── NVIDIA / OpenAI API for predictions ─────────────────────────────────────
NVIDIA_API_KEY = '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'
NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
AI_MODEL = 'meta/llama-3.1-8b-instruct'

try:
    import serial
except ImportError:
    log.error('Run: pip install pyserial'); sys.exit(1)

try:
    from websockets.asyncio.server import serve as ws_serve
except ImportError:
    log.error('Run: pip install websockets'); sys.exit(1)

try:
    from openai import OpenAI
    ai_client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=NVIDIA_API_KEY)
    AI_AVAILABLE = True
    log.info('AI predictions enabled via NVIDIA API')
except ImportError:
    AI_AVAILABLE = False
    log.warning('openai not installed — using physics math. Run: pip install openai')

# ── History for daily report ──────────────────────────────────────────────────
reading_history = []
last_report_date = None

# ── Physics-based fallback (when AI unavailable) ──────────────────────────────
def physics_derive(temp, vib, curr):
    force  = max(2500, min(11500, curr*240 + vib*15 + (temp-25)*50))
    ae     = max(300,  min(650,   curr*12  + vib*2.5 + 200))
    wear   = min(1.5,  max(0,     (vib - 0.5) / 8.0 * 1.5))
    if   vib > 8.0 or temp > 88 or curr > 44: status = 'failed'
    elif vib > 5.0 or temp > 82 or curr > 41: status = 'worn'
    else:                                      status = 'new'
    return {
        'cutting_force_n':      round(force, 1),
        'acoustic_emission_db': round(ae, 1),
        'surface_finish_ra_um': 0.5 if status=='new' else (0.8 if status=='worn' else 1.2),
        'wear_progression':     round(wear, 4),
        'tool_status':          status,
        'spindle_speed_mmin':   round(15 + (curr - 5)*0.5, 1),
        'feed_rate_mmtooth':    round(0.065 + (temp - 25)*0.001, 4),
        'coolant_flow_lmin':    round(18 + (temp - 25)*0.2, 1),
        'prediction_source':    'physics',
    }

# ── AI prediction ─────────────────────────────────────────────────────────────
def ai_derive(temp, vib, curr):
    if not AI_AVAILABLE:
        return physics_derive(temp, vib, curr)
    try:
        prompt = f"""You are an expert in broaching machine tool monitoring.
Given these live sensor readings:
- Temperature: {temp:.2f} C
- Vibration RMS: {vib:.3f} m/s2
- Spindle Current: {curr:.3f} A

Predict these parameters for a carbide broaching tool (respond ONLY with valid JSON, no explanation):
{{
  "cutting_force_n": <number 2500-11500>,
  "acoustic_emission_db": <number 300-650>,
  "surface_finish_ra_um": <number 0.2-2.0>,
  "wear_progression": <number 0.0-1.5>,
  "tool_status": <"new" or "worn" or "failed">,
  "spindle_speed_mmin": <number 10-30>,
  "feed_rate_mmtooth": <number 0.04-0.12>,
  "coolant_flow_lmin": <number 15-25>
}}"""
        resp = ai_client.chat.completions.create(
            model=AI_MODEL,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.1,
            max_tokens=300,
            stream=False
        )
        text = resp.choices[0].message.content.strip()
        # Extract JSON from response
        m = re.search(r'\{[^{}]+\}', text, re.DOTALL)
        if m:
            result = json.loads(m.group())
            result['prediction_source'] = 'ai'
            return result
    except Exception as e:
        log.warning(f'AI prediction failed: {e} — using physics fallback')
    return physics_derive(temp, vib, curr)

# ── Daily AI report ───────────────────────────────────────────────────────────
def generate_daily_report(history):
    if not AI_AVAILABLE or not history:
        return None
    try:
        temps  = [r['temperature_c']       for r in history]
        vibs   = [r['vibration_rms_mm_s2'] for r in history]
        currs  = [r['spindle_current_a']   for r in history]
        wears  = [r.get('wear_progression', 0) for r in history]
        statuses = [r.get('tool_status', 'new') for r in history]
        prompt = f"""You are a broaching machine health expert. Generate a daily report based on today's sensor data.

Today's statistics ({len(history)} readings):
- Temperature: avg={sum(temps)/len(temps):.1f}C, max={max(temps):.1f}C, min={min(temps):.1f}C
- Vibration:   avg={sum(vibs)/len(vibs):.3f} m/s2, max={max(vibs):.3f} m/s2
- Current:     avg={sum(currs)/len(currs):.2f}A, max={max(currs):.2f}A
- Wear:        start={wears[0]:.3f}, end={wears[-1]:.3f}, progression={wears[-1]-wears[0]:.3f}
- Tool status: {', '.join(set(statuses))}

Write a concise daily health report covering:
1. Overall machine health today
2. Any concerning trends
3. Maintenance recommendations
4. Predicted tool life remaining
Keep it under 200 words, practical and clear."""
        resp = ai_client.chat.completions.create(
            model=AI_MODEL,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.3,
            max_tokens=400,
            stream=False
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        log.warning(f'Daily report generation failed: {e}')
        return None

# ── Serial parsing ────────────────────────────────────────────────────────────
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

# ── WebSocket ─────────────────────────────────────────────────────────────────
connected = set()

async def ws_handler(ws):
    connected.add(ws)
    log.info(f'Browser connected ({len(connected)} clients)')
    try:
        await ws.wait_closed()
    finally:
        connected.discard(ws)

async def broadcast(data):
    if not connected: return
    msg  = json.dumps(data)
    dead = set()
    for c in list(connected):
        try:    await c.send(msg)
        except: dead.add(c)
    connected.difference_update(dead)

# ── Main serial loop ──────────────────────────────────────────────────────────
async def serial_loop(port):
    global last_report_date
    ser   = None
    cycle = 0
    while True:
        if ser is None or not ser.is_open:
            try:
                ser = serial.Serial(port, Baud, timeout=1)
                log.info(f'Opened {port} at {Baud} baud — waiting for data...')
            except Exception as e:
                log.warning(f'Cannot open {port}: {e} — retrying in 3s')
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

        # Sanity clamp — ignore obviously bad sensor spikes
        temp = max(0,   min(150, temp))
        vib  = max(0,   min(50,  vib))
        curr = max(0,   min(60,  curr))

        cycle += 1

        # AI or physics derived parameters
        derived = await asyncio.get_event_loop().run_in_executor(None, ai_derive, temp, vib, curr)

        reading = {
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

        reading_history.append(reading)
        # Keep last 24h of data (at 1Hz = 86400 max)
        if len(reading_history) > 86400:
            reading_history.pop(0)

        await broadcast(reading)
        log.info(f'#{cycle} T={temp:.1f}C V={vib:.3f} I={curr:.3f}A -> {derived["tool_status"]} [{derived["prediction_source"]}]')

        # Daily report at midnight (or first run of new day)
        today = datetime.now().date()
        if last_report_date != today and datetime.now().hour == 23 and datetime.now().minute >= 55:
            log.info('Generating daily report...')
            report = await asyncio.get_event_loop().run_in_executor(None, generate_daily_report, list(reading_history))
            if report:
                await broadcast({'type': 'daily_report', 'date': str(today), 'report': report})
                log.info(f'Daily report:\n{report}')
                last_report_date = today
                # Save report to file
                with open(f'report_{today}.txt', 'w') as f:
                    f.write(f'Daily Report — {today}\n{"="*40}\n{report}\n')

        await asyncio.sleep(0.05)

# ── Entry point ───────────────────────────────────────────────────────────────
async def main():
    print('='*50)
    print('  BROACHING SENSOR BRIDGE v4')
    print(f'  Arduino  : {ARDUINO_PORT}')
    print(f'  WebSocket: ws://{HOST}:{WS_PORT}/ws')
    print(f'  AI       : {"NVIDIA API" if AI_AVAILABLE else "Physics math (install openai)"}')
    print('='*50)
    async with ws_serve(ws_handler, HOST, WS_PORT):
        await serial_loop(ARDUINO_PORT)

if __name__ == '__main__':
    asyncio.run(main())
