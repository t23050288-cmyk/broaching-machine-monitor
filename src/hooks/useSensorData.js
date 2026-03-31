import { useState, useEffect, useCallback, useRef } from 'react';
import { connectBridge, onReading, disconnectBridge } from '../utils/sensorBridge';
import { saveReading, getSettings, saveAlert, getReadings } from '../utils/storage';
import { checkThresholds, alarmBeep } from '../utils/alerts';
import { pushToCloud } from '../utils/cloudSync';

/**
 * useSensorData
 * Connects to the Arduino bridge, processes every incoming reading,
 * saves to localStorage, and optionally syncs to a shared cloud bin.
 * Zero mock or demo data — shows waiting state until sensors connect.
 */
export function useSensorData() {
  const [bridgeStatus, setBridgeStatus] = useState('disconnected');
  const [latest,       setLatest]       = useState(null);
  const [chartData,    setChartData]    = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [isFlashing,   setIsFlashing]   = useState(false);
  const syncTimer = useRef(null);

  const processReading = useCallback((reading) => {
    const settings = getSettings();

    // 1. Save to localStorage
    saveReading(reading);

    // 2. Threshold checks & alerts
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

    // 3. Update UI
    setLatest(reading);
    const time = new Date(reading.timestamp).toLocaleTimeString('en', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    setChartData(prev => [...prev, { ...reading, time }].slice(-60));
  }, []);

  // Optional cloud sync every 60 seconds
  useEffect(() => {
    syncTimer.current = setInterval(() => {
      const settings = getSettings();
      if (settings.syncBinId) {
        const readings = getReadings();
        pushToCloud(readings, settings.syncBinId, settings.syncApiKey);
      }
    }, 60000);
    return () => clearInterval(syncTimer.current);
  }, []);

  useEffect(() => {
    const unsub = onReading((msg) => {
      if (msg.type === 'status') {
        setBridgeStatus(msg.status);
      } else if (msg.type === 'reading') {
        processReading(msg.data);
      }
    });
    connectBridge();
    return () => {
      unsub();
      disconnectBridge();
    };
  }, []);

  return { bridgeStatus, latest, chartData, activeAlerts, isFlashing, connect: connectBridge };
}
