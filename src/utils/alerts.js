let audioCtx = null;

export function beep(frequency = 880, duration = 300, type = 'square') {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration / 1000);
  } catch (e) { console.warn('Beep failed:', e); }
}

export function alarmBeep() {
  beep(880, 200);
  setTimeout(() => beep(660, 200), 250);
  setTimeout(() => beep(880, 200), 500);
}

export function checkThresholds(reading, settings) {
  const alerts = [];
  if (reading.temperature_c > settings.tempLimit)
    alerts.push({ type: 'error', param: 'Temperature', value: reading.temperature_c, limit: settings.tempLimit, unit: '°C' });
  if (reading.vibration_rms_mm_s2 > settings.vibLimit)
    alerts.push({ type: 'error', param: 'Vibration', value: reading.vibration_rms_mm_s2, limit: settings.vibLimit, unit: 'mm/s²' });
  if (reading.spindle_current_a > settings.currentLimit)
    alerts.push({ type: 'error', param: 'Spindle Current', value: reading.spindle_current_a, limit: settings.currentLimit, unit: 'A' });
  if (reading.cutting_force_n > settings.forceLimit)
    alerts.push({ type: 'warning', param: 'Cutting Force', value: reading.cutting_force_n, limit: settings.forceLimit, unit: 'N' });
  if (reading.temperature_c > settings.tempLimit * 0.9 && reading.temperature_c <= settings.tempLimit)
    alerts.push({ type: 'warning', param: 'Temperature approaching limit', value: reading.temperature_c, limit: settings.tempLimit, unit: '°C' });
  if (reading.vibration_rms_mm_s2 > settings.vibLimit * 0.9 && reading.vibration_rms_mm_s2 <= settings.vibLimit)
    alerts.push({ type: 'warning', param: 'Vibration approaching limit', value: reading.vibration_rms_mm_s2, limit: settings.vibLimit, unit: 'mm/s²' });
  return alerts;
}
