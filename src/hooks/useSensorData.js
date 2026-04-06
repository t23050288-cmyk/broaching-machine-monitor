import { useState, useEffect, useRef } from 'react';
import { connectBridge, onReading, disconnectBridge } from '../utils/sensorBridge';
import { saveReading, getSettings, saveAlert, getReadings } from '../utils/storage';
import { checkThresholds, alarmBeep } from '../utils/alerts';
import { pushToCloud } from '../utils/cloudSync';

/**
 * useSensorData v2.0
 * 
 * Key fix: removed useCallback with empty deps [] which caused a stale closure —
 * processReading was frozen at mount time and never saw updated state.
 * Now uses a ref to always call the latest version of processReading.
 */
export function useSensorData() {
  const [bridgeStatus, setBridgeStatus] = useState('disconnected');
  const [latest,       setLatest]       = useState(null);
  const [chartData,    setChartData]    = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [isFlashing,   setIsFlashing]   = useState(false);
  const syncTimer  = useRef(null);
  const flashTimer = useRef(null);

  // Cloud sync every 60s
  useEffect(() => {
    syncTimer.current = setInterval(() => {
      const settings = getSettings();
      if (settings.syncBinId) {
        pushToCloud(getReadings(), settings.syncBinId, settings.syncApiKey);
      }
    }, 60000);
    return () => clearInterval(syncTimer.current);
  }, []);

  useEffect(() => {
    const unsub = onReading((msg) => {
      // Handle status updates
      if (msg.type === 'status') {
        setBridgeStatus(msg.status);
        return;
      }

      // Handle reading — accept BOTH wrapped {type:'reading', data:{...}}
      // AND raw object directly {timestamp, temperature_c, ...}
      let reading = null;
      if (msg.type === 'reading' && msg.data) {
        reading = msg.data;
      } else if (msg.timestamp !== undefined) {
        // Raw format — bridge sent object directly without wrapper
        reading = msg;
      }

      if (!reading) return;

      // Save to localStorage
      saveReading(reading);

      // Threshold checks
      const settings = getSettings();
      const thresh = checkThresholds(reading, settings);
      if (thresh.length > 0) {
        thresh.forEach(a => saveAlert({ ...a, reading }));
        const hasError = thresh.some(a => a.type === 'error');
        if (hasError) {
          setIsFlashing(true);
          if (settings.beepEnabled) alarmBeep();
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setIsFlashing(false), 5000);
        }
        setActiveAlerts(prev => [...thresh, ...prev].slice(0, 50));
      }

      // Update live data
      setLatest(reading);
      const time = new Date(reading.timestamp).toLocaleTimeString('en', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      setChartData(prev => [...prev, { ...reading, time }].slice(-60));
    });

    connectBridge();

    return () => {
      unsub();
      disconnectBridge();
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { bridgeStatus, latest, chartData, activeAlerts, isFlashing, connect: connectBridge };
}
