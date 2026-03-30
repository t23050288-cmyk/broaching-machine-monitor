import { useState, useEffect, useCallback } from 'react';
import { connectBridge, onReading, disconnectBridge } from '../utils/sensorBridge';
import { saveReading, getSettings, saveAlert } from '../utils/storage';
import { checkThresholds, alarmBeep } from '../utils/alerts';

/**
 * useSensorData — LIVE ONLY, zero demo/mock data.
 * Shows "Waiting for sensors..." until the Arduino bridge connects.
 */
export function useSensorData() {
  const [bridgeStatus, setBridgeStatus] = useState('disconnected');
  const [latest, setLatest]             = useState(null);
  const [chartData, setChartData]       = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [isFlashing, setIsFlashing]     = useState(false);

  const processReading = useCallback((reading) => {
    const settings = getSettings();

    // Persist to localStorage (real data only)
    saveReading(reading);

    // Threshold checks
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
    const time = new Date(reading.timestamp).toLocaleTimeString('en', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    setChartData(prev => [...prev, { ...reading, time }].slice(-60));
  }, []);

  useEffect(() => {
    const unsub = onReading((msg) => {
      if (msg.type === 'status') {
        setBridgeStatus(msg.status);
      } else if (msg.type === 'reading') {
        processReading(msg.data);
      }
    });

    // Try to connect to Arduino bridge immediately and keep retrying
    connectBridge();

    return () => {
      unsub();
      disconnectBridge();
    };
  }, []);

  return {
    bridgeStatus,
    latest,
    chartData,
    activeAlerts,
    isFlashing,
    connect: connectBridge,
  };
}
