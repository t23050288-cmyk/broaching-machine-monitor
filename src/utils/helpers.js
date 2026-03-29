export function statusColor(status) {
  switch (status) {
    case 'running': return '#00ff88';
    case 'idle':    return '#ffd700';
    case 'fault':   return '#ff4444';
    default:        return '#64748b';
  }
}

export function statusLabel(status) {
  switch (status) {
    case 'running': return 'RUNNING';
    case 'idle':    return 'IDLE';
    case 'fault':   return 'FAULT';
    default:        return 'UNKNOWN';
  }
}

export function sensorThreshold(key, value) {
  const thresholds = {
    temperature:       { warn: 70, crit: 85 },
    vibration:         { warn: 3.0, crit: 4.0 },
    hydraulicPressure: { warn: 130, crit: 110, invert: true },
    spindleSpeed:      { warn: null, crit: null },
    feedRate:          { warn: null, crit: null },
    oilLevel:          { warn: 30, crit: 15, invert: true },
    motorCurrent:      { warn: 32, crit: 36 },
    cycleTime:         { warn: 25, crit: 30 },
  };
  const t = thresholds[key];
  if (!t) return 'normal';
  if (t.invert) {
    if (value <= t.crit) return 'critical';
    if (value <= t.warn) return 'warning';
    return 'normal';
  }
  if (t.crit !== null && value >= t.crit) return 'critical';
  if (t.warn !== null && value >= t.warn) return 'warning';
  return 'normal';
}

export function sensorValueColor(key, value) {
  const level = sensorThreshold(key, value);
  if (level === 'critical') return '#ff4444';
  if (level === 'warning')  return '#ffd700';
  return '#00ff88';
}

export function formatTs(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function severityColor(severity) {
  switch (severity) {
    case 'critical': return '#ff4444';
    case 'warning':  return '#ffd700';
    case 'info':     return '#00d4ff';
    default:         return '#64748b';
  }
}

export function oeeColor(val) {
  if (val >= 85) return '#00ff88';
  if (val >= 65) return '#ffd700';
  return '#ff4444';
}

export const SENSOR_LABELS = {
  temperature:       { label: 'Temperature',      unit: '°C',  icon: '🌡️'  },
  vibration:         { label: 'Vibration',        unit: 'mm/s',icon: '📳'  },
  hydraulicPressure: { label: 'Hydraulic Press.', unit: 'bar', icon: '💧'  },
  spindleSpeed:      { label: 'Spindle Speed',    unit: 'RPM', icon: '⚙️'  },
  feedRate:          { label: 'Feed Rate',        unit: 'mm/m',icon: '➡️'  },
  oilLevel:          { label: 'Oil Level',        unit: '%',   icon: '🛢️'  },
  motorCurrent:      { label: 'Motor Current',    unit: 'A',   icon: '⚡'  },
  cycleTime:         { label: 'Cycle Time',       unit: 's',   icon: '⏱️'  },
};
