const DB_KEY = 'bmm_readings';
const ALERTS_KEY = 'bmm_alerts';
const SETTINGS_KEY = 'bmm_settings';

export const defaultSettings = {
  tempLimit: 85, vibLimit: 32, currentLimit: 44, forceLimit: 10500,
  aiApiKey: '', beepEnabled: true,
};

export function getSettings() {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    return s ? { ...defaultSettings, ...JSON.parse(s) } : defaultSettings;
  } catch { return defaultSettings; }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function getReadings() {
  try {
    const r = localStorage.getItem(DB_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

export function saveReading(reading) {
  const readings = getReadings();
  readings.push({ ...reading, timestamp: reading.timestamp || Date.now() });
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filtered = readings.filter(r => (r.timestamp > cutoff));
  localStorage.setItem(DB_KEY, JSON.stringify(filtered));
  return filtered;
}

export function clearOldReadings() {
  const readings = getReadings();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = readings.filter(r => r.timestamp > dayAgo);
  const old = readings.filter(r => r.timestamp <= dayAgo);
  const settings = getSettings();
  const oldWithIssues = old.filter(r =>
    r.temperature_c > settings.tempLimit ||
    r.vibration_rms_mm_s2 > settings.vibLimit ||
    r.spindle_current_a > settings.currentLimit
  );
  localStorage.setItem(DB_KEY, JSON.stringify([...recent, ...oldWithIssues]));
}

export function getAlerts() {
  try {
    const a = localStorage.getItem(ALERTS_KEY);
    return a ? JSON.parse(a) : [];
  } catch { return []; }
}

export function saveAlert(alert) {
  const alerts = getAlerts();
  alerts.unshift({ ...alert, id: Date.now(), timestamp: Date.now(), read: false });
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts.slice(0, 200)));
}

export function markAlertsRead() {
  localStorage.setItem(ALERTS_KEY, JSON.stringify(getAlerts().map(a => ({ ...a, read: true }))));
}

export function exportToCSV(readings) {
  if (!readings.length) return;
  const cols = Object.keys(readings[0]);
  const csv = [cols.join(','), ...readings.map(r => cols.map(c => r[c] ?? '').join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `broaching_readings_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
