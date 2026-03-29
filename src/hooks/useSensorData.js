import { useState, useEffect, useRef, useCallback } from 'react';
import { connectBridge, onReading, disconnectBridge } from '../utils/sensorBridge';
import { saveReading, getSettings, saveAlert } from '../utils/storage';
import { checkThresholds, alarmBeep } from '../utils/alerts';

function generateDemo() {
  const t = 77 + (Math.random() - 0.5) * 8;
  const v = 26 + (Math.random() - 0.5) * 6;
  const i = 38 + (Math.random() - 0.5) * 4;
  const force = i * 240 + v * 15;
  const ae = i * 12 + v * 2.5 + 200;
  const wear = Math.min(1.5, (v - 6) / 31 * 1.5);
  const status = v > 33 || t > 88 ? 'failed' : v > 28 || t > 82 ? 'worn' : 'new';
  return {
    timestamp: new Date().toISOString(),
    temperature_c: +t.toFixed(2), vibration_rms_mm_s2: +v.toFixed(2), spindle_current_a: +i.toFixed(2),
    cutting_force_n: +force.toFixed(1), acoustic_emission_db: +ae.toFixed(1),
    surface_finish_ra_um: status === 'new' ? 0.5 : 0.8,
    wear_progression: +wear.toFixed(3), tool_status: status,
    spindle_speed_mmin: +(15 + (i - 38) * 0.5).toFixed(1),
    feed_rate_mmtooth: +(0.065 + (t - 77) * 0.001).toFixed(3),
    coolant_flow_lmin: +(18 + (t - 77) * 0.2).toFixed(1),
    tool_id: 'TB001', tool_material: 'Carbide', coating: 'TiN', workpiece_material: 'Steel',
  };
}

export function useSensorData() {
  const [bridgeStatus, setBridgeStatus] = useState('disconnected');
  const [latest, setLatest] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const demoTimer = useRef(null);

  const processReading = useCallback((reading) => {
    const settings = getSettings();
    saveReading(reading);
    const thresh = checkThresholds(reading, settings);
    if (thresh.length > 0) {
      thresh.forEach(a => saveAlert({ ...a, reading }));
      const errors = thresh.filter(a => a.type === 'error');
      if (errors.length > 0) {
        setIsFlashing(true);
        if (settings.beepEnabled) alarmBeep();
        setTimeout(() => setIsFlashing(false), 5000);
      }
      setActiveAlerts(prev => [...thresh, ...prev].slice(0, 50));
    }
    setLatest(reading);
    const time = new Date(reading.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setChartData(prev => [...prev, { ...reading, time }].slice(-60));
  }, []);

  const startDemo = useCallback(() => {
    if (demoTimer.current) clearInterval(demoTimer.current);
    demoTimer.current = setInterval(() => processReading(generateDemo()), 2000);
  }, [processReading]);

  useEffect(() => {
    const unsub = onReading((msg) => {
      if (msg.type === 'status') {
        setBridgeStatus(msg.status);
        if (msg.status === 'connected') {
          if (demoTimer.current) { clearInterval(demoTimer.current); demoTimer.current = null; }
        } else {
          startDemo();
        }
      } else if (msg.type === 'reading') {
        processReading(msg.data);
      }
    });
    connectBridge();
    startDemo();
    return () => {
      unsub();
      if (demoTimer.current) clearInterval(demoTimer.current);
      disconnectBridge();
    };
  }, []);

  return { bridgeStatus, latest, chartData, activeAlerts, isFlashing, connect: connectBridge };
}
