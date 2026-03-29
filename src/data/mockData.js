// Simulated real-time machine data generator

export const MACHINES = [
  { id: 'BM-001', name: 'Broach Line Alpha', location: 'Bay A', type: 'Vertical' },
  { id: 'BM-002', name: 'Broach Line Beta',  location: 'Bay B', type: 'Horizontal' },
  { id: 'BM-003', name: 'Broach Line Gamma', location: 'Bay C', type: 'Vertical' },
  { id: 'BM-004', name: 'Broach Line Delta', location: 'Bay D', type: 'Surface' },
];

export const ALERT_TYPES = {
  TEMP_HIGH:    { label: 'High Temperature',      severity: 'critical', color: '#ff4444' },
  VIBRATION:    { label: 'Excessive Vibration',   severity: 'warning',  color: '#ffd700' },
  PRESSURE_LOW: { label: 'Low Hydraulic Pressure',severity: 'warning',  color: '#ffd700' },
  OIL_LEVEL:    { label: 'Low Oil Level',         severity: 'info',     color: '#00d4ff' },
  TOOL_WEAR:    { label: 'Tool Wear Detected',    severity: 'warning',  color: '#ff8c00' },
  MOTOR_FAULT:  { label: 'Motor Fault',           severity: 'critical', color: '#ff4444' },
  CYCLE_SLOW:   { label: 'Slow Cycle Time',       severity: 'info',     color: '#00d4ff' },
};

// Generate a random value within range with optional drift
export function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

// Generate time-series data for charts
export function generateTimeSeries(points = 30, baseVal, variance, min, max) {
  const data = [];
  let val = baseVal;
  const now = Date.now();
  for (let i = points; i >= 0; i--) {
    val = clamp(val + randomInRange(-variance, variance), min, max);
    data.push({
      time: new Date(now - i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: parseFloat(val.toFixed(2)),
    });
  }
  return data;
}

// Generate a full machine state snapshot
export function generateMachineState(machineId, prevState = null) {
  const isRunning = prevState ? prevState.status === 'running' : Math.random() > 0.2;
  const hasFault  = !isRunning && Math.random() > 0.6;

  const base = prevState?.sensors || {
    temperature:    randomInRange(45, 65),
    vibration:      randomInRange(0.5, 2.5),
    hydraulicPressure: randomInRange(150, 180),
    spindleSpeed:   randomInRange(400, 600),
    feedRate:       randomInRange(80, 120),
    oilLevel:       randomInRange(60, 95),
    motorCurrent:   randomInRange(18, 28),
    cycleTime:      randomInRange(12, 20),
  };

  const drift = (v, d, min, max) => clamp(v + randomInRange(-d, d), min, max);

  const sensors = {
    temperature:       drift(base.temperature,       1.5, 30, 95),
    vibration:         drift(base.vibration,         0.2, 0,  5),
    hydraulicPressure: drift(base.hydraulicPressure, 3,   100, 200),
    spindleSpeed:      drift(base.spindleSpeed,      15,  200, 800),
    feedRate:          drift(base.feedRate,          5,   50,  180),
    oilLevel:          drift(base.oilLevel,          0.5, 10,  100),
    motorCurrent:      drift(base.motorCurrent,      1,   10,  40),
    cycleTime:         drift(base.cycleTime,         0.5, 8,   35),
  };

  // Generate alerts based on sensor values
  const alerts = [];
  if (sensors.temperature > 80)          alerts.push({ ...ALERT_TYPES.TEMP_HIGH,    ts: new Date().toISOString() });
  if (sensors.vibration > 4.0)           alerts.push({ ...ALERT_TYPES.VIBRATION,    ts: new Date().toISOString() });
  if (sensors.hydraulicPressure < 120)   alerts.push({ ...ALERT_TYPES.PRESSURE_LOW, ts: new Date().toISOString() });
  if (sensors.oilLevel < 20)             alerts.push({ ...ALERT_TYPES.OIL_LEVEL,    ts: new Date().toISOString() });
  if (sensors.motorCurrent > 36)         alerts.push({ ...ALERT_TYPES.MOTOR_FAULT,  ts: new Date().toISOString() });

  const totalParts   = (prevState?.totalParts   || Math.floor(randomInRange(200, 800))) + (isRunning ? Math.floor(randomInRange(0, 3)) : 0);
  const goodParts    = Math.floor(totalParts * randomInRange(0.94, 0.99));
  const efficiency   = isRunning ? parseFloat(randomInRange(75, 98).toFixed(1)) : 0;
  const uptime       = isRunning ? (prevState?.uptime || randomInRange(60, 95)) : (prevState?.uptime || 0);

  return {
    id:       machineId,
    status:   hasFault ? 'fault' : isRunning ? 'running' : 'idle',
    sensors:  Object.fromEntries(Object.entries(sensors).map(([k, v]) => [k, parseFloat(v.toFixed(2))])),
    alerts,
    totalParts,
    goodParts,
    efficiency,
    uptime:   parseFloat(uptime.toFixed(1)),
    lastUpdate: new Date().toISOString(),
  };
}

// Pre-built alert log
export function generateAlertLog(count = 20) {
  const log = [];
  const types = Object.values(ALERT_TYPES);
  const machines = MACHINES.map(m => m.id);
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const type    = types[Math.floor(Math.random() * types.length)];
    const machine = machines[Math.floor(Math.random() * machines.length)];
    log.push({
      id:        `ALT-${String(i + 1).padStart(4, '0')}`,
      machineId: machine,
      ...type,
      ts:        new Date(now - Math.floor(randomInRange(0, 86400000))).toISOString(),
      resolved:  Math.random() > 0.4,
    });
  }
  return log.sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

// OEE computation
export function computeOEE(availability, performance, quality) {
  return parseFloat((availability * performance * quality / 10000).toFixed(1));
}
