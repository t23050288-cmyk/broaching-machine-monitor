import { useState, useEffect, useRef } from 'react';
import { connectBridge, disconnectBridge, onReading } from '../utils/sensorBridge';
import { saveReading, getSettings, saveAlert, getReadings } from '../utils/storage';
import { checkThresholds, alarmBeep } from '../utils/alerts';
import { pushToCloud } from '../utils/cloudSync';

export function useSensorData() {
  const [bridgeStatus, setBridgeStatus] = useState('disconnected');
  const [latest,       setLatest]       = useState(null);
  const [chartData,    setChartData]    = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [isFlashing,   setIsFlashing]   = useState(false);
  const syncTimer = useRef(null);
  const flashTimer = useRef(null);

  useEffect(() => {
    syncTimer.current = setInterval(() => {
      const settings = getSettings();
      if (settings.syncBinId) pushToCloud(getReadings(), settings.syncBinId, settings.syncApiKey);
    }, 60000);
    return () => clearInterval(syncTimer.current);
  }, []);

  useEffect(() => {
    const unsub = onReading((msg) => {
      if (msg.type === 'status') { setBridgeStatus(msg.status); return; }
      let reading = (msg.type === 'reading' && msg.data) ? msg.data : (msg.timestamp !== undefined ? msg : null);
      if (!reading) return;
      saveReading(reading);
      const settings = getSettings();
      const thresh = checkThresholds(reading, settings);
      if (thresh.length > 0) {
        thresh.forEach(a => saveAlert({ ...a, reading }));
        if (thresh.some(a => a.type === 'error')) {
          setIsFlashing(true);
          if (settings.beepEnabled) alarmBeep();
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setIsFlashing(false), 5000);
        }
        setActiveAlerts(prev => [...thresh, ...prev].slice(0, 50));
      }
      setLatest(reading);
      const time = new Date(reading.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setChartData(prev => [...prev, { ...reading, time }].slice(-60));
    });
    return () => { unsub(); if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, []);

  const connect    = () => connectBridge();
  const disconnect = () => { disconnectBridge(); setBridgeStatus('disconnected'); };
  return { bridgeStatus, latest, chartData, activeAlerts, isFlashing, connect, disconnect };
}
