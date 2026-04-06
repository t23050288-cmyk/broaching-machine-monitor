#!/usr/bin/env python3
"""
Broaching Machine Sensor Bridge v5.1
- Kalman filter on all 4 sensor channels (temp, vib, curr, volt)
- FFT vibration frequency analysis (dominant frequency)
- Remaining life / time estimate
- MQTT export (optional)
- Built-in WebSocket ping/pong keepalive
- v5.1: Added voltage sensor, fixed broadcast to wrap in {type,data} for frontend

INSTALL: pip install pyserial websockets requests
OPTIONAL MQTT: pip install paho-mqtt
RUN: python sensor_bridge.py
"""

import asyncio, json, re, logging, sys, math
from datetime import datetime
from collections import deque

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

HOST         = '0.0.0.0'
WS_PORT      = 8765
BAUD         = 9600
ARDUINO_PORT = 'COM7'

# ── MQTT config (optional) ─────────────────────────────────────
MQTT_ENABLED = False
MQTT_BROKER  = 'localhost'
MQTT_PORT    = 1883
MQTT_TOPIC   = 'broaching/sensors'
# ──────────────────────────────────────────────────────────────

THRESHOLDS = {
    'temperature_c':       {'warn': 82,  'error': 88},
    'vibration_rms_mm_s2': {'warn': 28,  'error': 33},
    'spindle_current_a':   {'warn': 41,  'error': 44},
    'supply_voltage_v':    {'warn': 4.8, 'error': 4.5},  # low voltage warning
}

TOOL_MAX_CYCLES    = 5000
READINGS_PER_CYCLE = 1

try:
    import serial
except ImportError:
    log.error('pyserial not installed. Run: pip install pyserial'); sys.exit(1)

try:
    import websockets
    from websockets.asyncio.server import serve as ws_serve
except ImportError:
    log.error('websockets not installed. Run: pip install websockets'); sys.exit(1)

mqtt_client = None
if MQTT_ENABLED:
    try:
        import paho.mqtt.client as mqtt
        mqtt_client = mqtt.Client()
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
        log.info(f'MQTT connected to {MQTT_BROKER}:{MQTT_PORT}')
    except Exception as e:
        log.warning(f'MQTT not available: {e}')
        mqtt_client = None


# ── Kalman Filter ─────────────────────────────────────────────
class KalmanFilter:
    def __init__(self, process_var=1e-3, measure_var=0.1):
        self.q = process_var
        self.r = measure_var
        self.x = None
        self.p = 1.0

    def update(self, measurement):
        if self.x is None:
            self.x = measurement
            return measurement
        self.p += self.q
        k = self.p / (self.p + self.r)
        self.x = self.x + k * (measurement - self.x)
        self.p = (1 - k) * self.p
        return round(self.x, 4)


# ── FFT ───────────────────────────────────────────────────────
class FFTAnalyzer:
    def __init__(self, window=64, sample_rate=1.0):
        self.window      = window
        self.sample_rate = sample_rate
        self.buffer      = deque(maxlen=window)

    def add(self, value):
        self.buffer.append(value)

    def dominant_frequency(self):
        if len(self.buffer) < self.window:
            return None
        n    = self.window
        vals = list(self.buffer)
        mean = sum(vals) / n
        vals = [v - mean for v in vals]
        freqs = []
        for k in range(1, n // 2):
            re_part = sum(vals[i] * math.cos(2*math.pi*k*i/n) for i in range(n))
            im_part = sum(vals[i] * math.sin(2*math.pi*k*i/n) for i in range(n))
            mag = math.sqrt(re_part**2 + im_part**2)
            freq = k * self.sample_rate / n
            freqs.append((freq, mag))
        if not freqs: return None
        dom = max(freqs, key=lambda x: x[1])
        return round(dom[0], 4)


# ── Remaining Life Model ──────────────────────────────────────
class RemainingLifeEstimator:
    def __init__(self):
        self.cumulative_damage = 0.0
        self.cycle_count       = 0
        self.history           = deque(maxlen=60)

    def update(self, wear, status):
        damage_per_cycle = {
            'new':    0.01,
            'worn':   0.05,
            'failed': 0.20,
        }.get(status, 0.02)
        self.cumulative_damage = min(100.0, self.cumulative_damage + damage_per_cycle)
        self.cycle_count      += 1
        self.history.append(damage_per_cycle)
        return self._estimate()

    def _estimate(self):
        remaining_pct = max(0.0, 100.0 - self.cumulative_damage)
        if len(self.history) >= 5:
            avg_rate = sum(self.history) / len(self.history)
        else:
            avg_rate = 0.02
        if avg_rate <= 0:
            cycles_left = TOOL_MAX_CYCLES
        else:
            cycles_left = int(remaining_pct / avg_rate)
        seconds_left = cycles_left
        hours   = seconds_left // 3600
        minutes = (seconds_left % 3600) // 60
        time_str = f'{hours}h {minutes}m' if hours > 0 else f'{minutes}m'
        return {
            'remaining_life_pct':    round(remaining_pct, 1),
            'cycles_remaining':      cycles_left,
            'estimated_time_left':   time_str,
            'cumulative_damage_pct': round(self.cumulative_damage, 2),
            'cycle_count':           self.cycle_count,
        }


# ── Global state ──────────────────────────────────────────────
connected      = set()
latest_reading = None

kalman_temp = KalmanFilter(process_var=0.01, measure_var=0.5)
kalman_vib  = KalmanFilter(process_var=0.05, measure_var=1.0)
kalman_curr = KalmanFilter(process_var=0.01, measure_var=0.3)
kalman_volt = KalmanFilter(process_var=0.005, measure_var=0.1)

fft_analyzer   = FFTAnalyzer(window=32, sample_rate=1.0)
life_estimator = RemainingLifeEstimator()


def parse_line(line):
    """
    Parses Arduino output. Supports:
      TEMP:25.30,VIB:2.45,CURR:1.20,VOLT:4.95   (with voltage)
      TEMP:25.30,VIB:2.45,CURR:1.20              (without voltage — volt defaults to None)
      25.30,2.45,1.20                             (CSV fallback)
    """
    line = line.strip()
    if not line: return None
    try:
        t = re.search(r'TEMP[:\s]+([-\d.]+)', line, re.IGNORECASE)
        v = re.search(r'VIB[:\s]+([-\d.]+)',  line, re.IGNORECASE)
        c = re.search(r'CURR[:\s]+([-\d.]+)', line, re.IGNORECASE)
        u = re.search(r'VOLT[:\s]+([-\d.]+)', line, re.IGNORECASE)   # voltage (optional)
        if t and v and c:
            volt = float(u.group(1)) if u else None
            return float(t.group(1)), float(v.group(1)), float(c.group(1)), volt
        parts = [p.strip() for p in line.split(',')]
        if len(parts) >= 3:
            volt = float(parts[3]) if len(parts) >= 4 else None
            return float(parts[0]), float(parts[1]), float(parts[2]), volt
    except Exception as e:
        log.debug(f'Parse error: {e}')
    return None


def multi_sensor_status(temp, vib, curr):
    failed_count = 0
    warn_count   = 0
    if temp > THRESHOLDS['temperature_c']['error']:       failed_count += 1
    elif temp > THRESHOLDS['temperature_c']['warn']:      warn_count   += 1
    if vib  > THRESHOLDS['vibration_rms_mm_s2']['error']: failed_count += 1
    elif vib > THRESHOLDS['vibration_rms_mm_s2']['warn']: warn_count   += 1
    if curr > THRESHOLDS['spindle_current_a']['error']:   failed_count += 1
    elif curr > THRESHOLDS['spindle_current_a']['warn']:  warn_count   += 1
    if failed_count >= 2: return 'failed'
    if warn_count   >= 2: return 'worn'
    if failed_count == 1: return 'worn'
    return 'new'


def derive(temp, vib, curr, status):
    force = max(2500, min(11500, curr*240 + vib*15 + (temp-77)*50))
    ae    = max(300,  min(650,   curr*12  + vib*2.5 + 200))
    wear  = min(1.5,  max(0,     (vib-6) / 31 * 1.5))
    sf    = 0.5 if status=='new' else (0.8 if status=='worn' else 1.2)
    return {
        'cutting_force_n':      round(force, 1),
        'acoustic_emission_db': round(ae, 1),
        'surface_finish_ra_um': sf,
        'wear_progression':     round(wear, 3),
        'spindle_speed_mmin':   round(15 + (curr-38)*0.5, 1),
        'feed_rate_mmtooth':    round(0.065 + (temp-77)*0.001, 3),
        'coolant_flow_lmin':    round(18 + (temp-77)*0.2, 1),
    }


async def ws_handler(websocket):
    global latest_reading
    connected.add(websocket)
    log.info(f'Browser connected — {len(connected)} client(s)')
    if latest_reading:
        try:
            # Send wrapped so frontend always gets {type, data}
            await websocket.send(json.dumps({'type': 'reading', 'data': latest_reading}))
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
    # Wrap in {type: 'reading', data: ...} so frontend hook works correctly
    msg  = json.dumps({'type': 'reading', 'data': data})
    dead = set()
    for c in list(connected):
        try:
            await c.send(msg)
        except Exception:
            dead.add(c)
    connected.difference_update(dead)


async def serial_loop(port):
    global latest_reading
    ser = None
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

        raw_temp, raw_vib, raw_curr, raw_volt = result

        # ── Kalman filter ──────────────────────────────────────
        temp = kalman_temp.update(raw_temp)
        vib  = kalman_vib.update(raw_vib)
        curr = kalman_curr.update(raw_curr)
        volt = kalman_volt.update(raw_volt) if raw_volt is not None else None

        # ── FFT ───────────────────────────────────────────────
        fft_analyzer.add(vib)
        dom_freq = fft_analyzer.dominant_frequency()

        # ── Status ────────────────────────────────────────────
        status  = multi_sensor_status(temp, vib, curr)
        derived = derive(temp, vib, curr, status)

        # ── Life estimate ─────────────────────────────────────
        life = life_estimator.update(derived['wear_progression'], status)

        reading = {
            'timestamp':              datetime.now().isoformat(),
            'cycle':                  life['cycle_count'],
            'raw_temp':               round(raw_temp, 2),
            'raw_vib':                round(raw_vib, 2),
            'raw_curr':               round(raw_curr, 2),
            'raw_volt':               round(raw_volt, 3) if raw_volt is not None else None,
            # Filtered values
            'temperature_c':          round(temp, 2),
            'vibration_rms_mm_s2':    round(vib, 2),
            'spindle_current_a':      round(curr, 2),
            'supply_voltage_v':       round(volt, 3) if volt is not None else None,
            # FFT
            'dominant_freq_hz':       dom_freq,
            # Derived
            'tool_status':            status,
            'tool_id':                'TB001',
            'tool_material':          'Carbide',
            'coating':                'TiN',
            # Life
            'remaining_life_pct':     life['remaining_life_pct'],
            'cycles_remaining':       life['cycles_remaining'],
            'estimated_time_left':    life['estimated_time_left'],
            'cumulative_damage_pct':  life['cumulative_damage_pct'],
            **derived,
        }
        latest_reading = reading
        await broadcast(reading)

        volt_str = f' U={volt:.3f}V' if volt is not None else ''
        log.info(
            f'#{life["cycle_count"]} '
            f'T={temp:.1f}°C V={vib:.2f} C={curr:.2f}A{volt_str} '
            f'→ {status} | life={life["remaining_life_pct"]}% '
            f'({life["estimated_time_left"]} left)'
            + (f' | FFT={dom_freq:.3f}Hz' if dom_freq else '')
        )

        if mqtt_client:
            try:
                mqtt_client.publish(MQTT_TOPIC, json.dumps(reading))
            except Exception as e:
                log.warning(f'MQTT publish failed: {e}')

        await asyncio.sleep(0.05)


async def main():
    print('=' * 55)
    print('  BROACHING SENSOR BRIDGE v5.1')
    print(f'  Arduino   : {ARDUINO_PORT}')
    print(f'  WebSocket : ws://localhost:{WS_PORT}')
    print(f'  MQTT      : {"enabled → " + MQTT_BROKER if MQTT_ENABLED else "disabled"}')
    print('  Features  : Kalman | FFT | Voltage | Life | MQTT')
    print('=' * 55)
    async with ws_serve(
        ws_handler, HOST, WS_PORT,
        ping_interval=10, ping_timeout=30, close_timeout=10,
    ):
        await serial_loop(ARDUINO_PORT)


if __name__ == '__main__':
    asyncio.run(main())
