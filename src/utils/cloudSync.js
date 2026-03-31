/**
 * cloudSync.js
 * Optional cross-device sync using JSONBin.io (free, no account needed for reading).
 * Set a Bin ID in Settings to enable — readings are pushed here every minute
 * and any other device with the same Bin ID can pull them.
 *
 * JSONBin is a free, open REST-based JSON storage service.
 * Create a free bin at https://jsonbin.io  (no login required for public bins)
 */

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';

/**
 * Push latest readings to the shared bin.
 * binId  — the JSONBin bin ID (from Settings)
 * apiKey — your JSONBin API key (from Settings, optional for public bins)
 */
export async function pushToCloud(readings, binId, apiKey) {
  if (!binId || !readings.length) return;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-Access-Key'] = apiKey;
    const payload = {
      updated: new Date().toISOString(),
      count:   readings.length,
      readings: readings.slice(-500), // keep last 500 readings in cloud
    };
    await fetch(`${JSONBIN_BASE}/${binId}`, {
      method:  'PUT',
      headers,
      body:    JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[cloudSync] push failed:', e);
  }
}

/**
 * Pull readings from the shared bin (for other devices).
 */
export async function pullFromCloud(binId, apiKey) {
  if (!binId) return null;
  try {
    const headers = {};
    if (apiKey) headers['X-Access-Key'] = apiKey;
    const res  = await fetch(`${JSONBIN_BASE}/${binId}/latest`, { headers });
    const json = await res.json();
    return json?.record?.readings ?? null;
  } catch (e) {
    console.warn('[cloudSync] pull failed:', e);
    return null;
  }
}
