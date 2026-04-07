/**
 * sensorBridge.js v4.1 — Web Serial API with full error reporting
 * Works in Chrome/Edge on HTTPS (GitHub Pages qualifies).
 * Falls back to WebSocket (Python bridge) if Web Serial fails.
 */

const BAUD_RATE = 9600;
const WS_FALLBACK = 'ws://localhost:8765';

let port = null, reader = null, ws = null;
let status = 'disconnected', stopping = false, mode = null;
const listeners = new Set();

function notifyAll(msg) { listeners.forEach(fn => { try { fn(msg); } catch(_){} }); }
export function getBridgeStatus() { return status; }
export function onReading(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function onChatReply(fn) { return () => {}; }
export function sendChatMessage() {}

// ── Parse Arduino serial line ─────────────────────────────────
function parseLine(line) {
  line = line.trim();
  if (!line) return null;
  // Skip debug/info lines
  if (/^\[DBG\]|^READY|^ACS|^Calibr|^MPU|^Broach/i.test(line)) return null;
  try {
    const tM = line.match(/TEMP[:\s]+([-\d.]+)/i);
    const vM = line.match(/VIB[:\s]+([-\d.]+)/i);
    const cM = line.match(/CURR[:\s]+([-\d.]+)/i);
    const uM = line.match(/VOLT[:\s]+([-\d.]+)/i);
    if (tM && vM && cM) {
      return {
        temperature_c:       parseFloat(tM[1]),
        vibration_rms_mm_s2: parseFloat(vM[1]),
        spindle_current_a:   parseFloat(cM[1]),
        supply_voltage_v:    uM ? parseFloat(uM[1]) : null,
      };
    }
  } catch (_) {}
  return null;
}

// ── Kalman filter ─────────────────────────────────────────────
function makeKalman(q = 0.01, r = 0.5) {
  let x = null, p = 1;
  return (z) => {
    if (z === null || z === undefined) return null;
    if (x === null) { x = z; return z; }
    p += q; const k = p / (p + r); x = x + k * (z - x); p = (1 - k) * p;
    return Math.round(x * 1000) / 1000;
  };
}

const vibBuffer = [];
const FFT_WINDOW = 32;
let cycleCount = 0, cumDamage = 0;
const damageHistory = [];
const kTemp = makeKalman(0.01, 0.5), kVib = makeKalman(0.05, 1.0), kCurr = makeKalman(0.01, 0.3), kVolt = makeKalman(0.005, 0.1);

function dominantFreq(buffer) {
  if (buffer.length < FFT_WINDOW) return null;
  const n = FFT_WINDOW, vals = buffer.slice(-n);
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const dc = vals.map(v => v - mean);
  let best = null, bestMag = 0;
  for (let k = 1; k < n / 2; k++) {
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { re += dc[i] * Math.cos(2*Math.PI*k*i/n); im += dc[i] * Math.sin(2*Math.PI*k*i/n); }
    const mag = Math.sqrt(re*re + im*im);
    if (mag > bestMag) { bestMag = mag; best = k/n; }
  }
  return best !== null ? Math.round(best * 1000) / 1000 : null;
}

function toolStatus(temp, vib, curr) {
  let fail = 0, warn = 0;
  if (temp > 88) fail++; else if (temp > 82) warn++;
  if (vib  > 33) fail++; else if (vib  > 28) warn++;
  if (curr > 44) fail++; else if (curr > 41) warn++;
  return fail >= 2 ? 'failed' : (warn >= 2 || fail === 1) ? 'worn' : 'new';
}

function processRaw(raw) {
  const temp = kTemp(raw.temperature_c);
  const vib  = kVib(raw.vibration_rms_mm_s2);
  const curr = kCurr(raw.spindle_current_a);
  const volt = kVolt(raw.supply_voltage_v);
  vibBuffer.push(vib);
  if (vibBuffer.length > FFT_WINDOW * 2) vibBuffer.shift();
  const domFreq = dominantFreq(vibBuffer);
  const st = toolStatus(temp, vib, curr);
  const wear = Math.min(1.5, Math.max(0, (vib - 0.5) / 8.0 * 1.5));
  const dpCycle = { new: 0.01, worn: 0.05, failed: 0.20 }[st] ?? 0.02;
  cumDamage = Math.min(100, cumDamage + dpCycle);
  cycleCount++;
  damageHistory.push(dpCycle);
  if (damageHistory.length > 60) damageHistory.shift();
  const avgRate = damageHistory.reduce((a,b) => a+b, 0) / damageHistory.length || 0.02;
  const remainPct = Math.max(0, 100 - cumDamage);
  const cyclesLeft = avgRate > 0 ? Math.round(remainPct / avgRate) : 5000;
  const h = Math.floor(cyclesLeft/3600), m = Math.floor((cyclesLeft%3600)/60);
  const timeLeft = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return {
    timestamp: new Date().toISOString(), cycle: cycleCount,
    temperature_c:        Math.round(temp * 100) / 100,
    vibration_rms_mm_s2:  Math.round(vib * 1000) / 1000,
    spindle_current_a:    Math.round(curr * 1000) / 1000,
    supply_voltage_v:     volt != null ? Math.round(volt * 1000) / 1000 : null,
    dominant_freq_hz:     domFreq,
    tool_status:          st, tool_id: 'TB001', tool_material: 'Carbide', coating: 'TiN',
    remaining_life_pct:   Math.round(remainPct * 10) / 10,
    cycles_remaining:     cyclesLeft,
    estimated_time_left:  timeLeft,
    wear_progression:     Math.round(wear * 1000) / 1000,
    cutting_force_n:      Math.round(Math.max(2500, Math.min(11500, curr*240 + vib*15 + (temp-77)*50)) * 10) / 10,
    acoustic_emission_db: Math.round(Math.max(300, Math.min(650, curr*12 + vib*2.5 + 200)) * 10) / 10,
    coolant_flow_lmin:    Math.round(Math.max(0, 18 + (temp-77)*0.2) * 10) / 10,
    surface_finish_ra_um: st === 'new' ? 0.5 : st === 'worn' ? 0.8 : 1.2,
  };
}

// ── Web Serial read loop ──────────────────────────────────────
async function startSerialReadLoop() {
  const textDecoder = new TextDecoderStream();
  const closed = port.readable.pipeTo(textDecoder.writable);
  reader = textDecoder.readable.getReader();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done || stopping) break;
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const raw = parseLine(line);
        if (raw) notifyAll({ type: 'reading', data: processRaw(raw) });
      }
    }
  } catch (e) {
    if (!stopping) console.error('[Serial] Read loop error:', e);
  } finally {
    try { reader.releaseLock(); } catch(_) {}
    try { await closed; } catch(_) {}
    if (!stopping) {
      status = 'disconnected';
      notifyAll({ type: 'status', status: 'disconnected' });
    }
  }
}

// ── WebSocket fallback (Python bridge) ───────────────────────
function startWebSocket() {
  mode = 'websocket';
  console.log('[Bridge] Trying WebSocket fallback:', WS_FALLBACK);
  ws = new WebSocket(WS_FALLBACK);
  ws.onopen = () => {
    status = 'connected';
    notifyAll({ type: 'status', status: 'connected', via: 'websocket' });
    console.log('[Bridge] WebSocket connected');
  };
  ws.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      if (d.type === 'reading') notifyAll({ type: 'reading', data: processRaw(d.data) });
      else if (d.type === 'status') notifyAll(d);
    } catch(_) {}
  };
  ws.onerror = (e) => { console.warn('[Bridge] WebSocket error:', e); };
  ws.onclose = () => {
    if (!stopping) {
      status = 'disconnected';
      notifyAll({ type: 'status', status: 'disconnected' });
    }
  };
}

// ── Main connect ──────────────────────────────────────────────
export async function connectBridge() {
  if (status === 'connected' || status === 'connecting') return;
  stopping = false;

  // Try Web Serial first
  if ('serial' in navigator) {
    console.log('[Bridge] Web Serial API available — requesting port…');
    try {
      status = 'connecting';
      notifyAll({ type: 'status', status: 'connecting' });

      // Check if we already have permission to a port
      const existingPorts = await navigator.serial.getPorts();
      console.log('[Bridge] Existing authorized ports:', existingPorts.length);

      port = existingPorts.length > 0
        ? existingPorts[0]
        : await navigator.serial.requestPort();  // shows picker

      console.log('[Bridge] Port selected, opening at', BAUD_RATE, 'baud…');
      await port.open({ baudRate: BAUD_RATE });

      mode = 'serial';
      status = 'connected';
      notifyAll({ type: 'status', status: 'connected', via: 'serial' });
      console.log('[Bridge] Serial port open — reading data…');
      startSerialReadLoop();
      return;
    } catch (e) {
      console.error('[Bridge] Web Serial failed:', e.name, e.message);
      port = null;
      // Fall through to WebSocket
    }
  } else {
    console.warn('[Bridge] Web Serial API not available in this browser');
  }

  // Try WebSocket fallback
  console.log('[Bridge] Falling back to WebSocket (Python bridge)…');
  startWebSocket();
}

export async function disconnectBridge() {
  stopping = true;
  if (mode === 'serial') {
    try { if (reader) await reader.cancel(); } catch(_) {}
    try { if (port) await port.close(); } catch(_) {}
    port = null; reader = null;
  }
  if (mode === 'websocket') {
    try { if (ws) ws.close(); } catch(_) {}
    ws = null;
  }
  mode = null;
  status = 'disconnected';
  notifyAll({ type: 'status', status: 'disconnected' });
}
