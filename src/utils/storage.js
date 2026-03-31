/**
 * storage.js
 * All sensor data is stored in localStorage on this machine.
 * Data is also synced to a shared cloud bin so multiple devices
 * can view the same readings without any external service accounts.
 */

const DB_KEY       = 'bmm_readings';
const ALERTS_KEY   = 'bmm_alerts';
const SETTINGS_KEY = 'bmm_settings';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export const defaultSettings = {
  tempLimit:    85,
  vibLimit:     32,
  currentLimit: 44,
  forceLimit:   10500,
  beepEnabled:  true,
  syncBinId:    '',   // optional JSONBin bin ID for cross-device sync
  syncApiKey:   '',   // optional JSONBin API key
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

// ---------------------------------------------------------------------------
// Readings  (localStorage)
// ---------------------------------------------------------------------------
export function getReadings() {
  try {
    const r = localStorage.getItem(DB_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

export function saveReading(reading) {
  const readings = getReadings();
  readings.push({ ...reading, timestamp: reading.timestamp || new Date().toISOString() });
  // Keep only last 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filtered = readings.filter(r => new Date(r.timestamp).getTime() > cutoff);
  localStorage.setItem(DB_KEY, JSON.stringify(filtered));
  return filtered;
}

export function clearOldReadings() {
  const readings  = getReadings();
  const dayAgo    = Date.now() - 24 * 60 * 60 * 1000;
  const recent    = readings.filter(r => new Date(r.timestamp).getTime() > dayAgo);
  const old       = readings.filter(r => new Date(r.timestamp).getTime() <= dayAgo);
  const settings  = getSettings();
  const important = old.filter(r =>
    r.temperature_c       > settings.tempLimit    ||
    r.vibration_rms_mm_s2 > settings.vibLimit     ||
    r.spindle_current_a   > settings.currentLimit
  );
  localStorage.setItem(DB_KEY, JSON.stringify([...recent, ...important]));
}

// ---------------------------------------------------------------------------
// Alerts  (localStorage)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------
export function exportToCSV(readings) {
  if (!readings.length) return;
  const cols = Object.keys(readings[0]);
  const csv  = [
    cols.join(','),
    ...readings.map(r => cols.map(c => r[c] ?? '').join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `broaching_readings_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
