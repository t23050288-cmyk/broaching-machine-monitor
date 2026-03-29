import { useState, useEffect, useCallback } from 'react';
import {
  MACHINES,
  generateMachineState,
  generateTimeSeries,
  generateAlertLog,
} from '../data/mockData';

export function useMachineData(refreshInterval = 2000) {
  const [machineStates, setMachineStates]   = useState({});
  const [timeSeriesData, setTimeSeriesData] = useState({});
  const [alertLog, setAlertLog]             = useState([]);
  const [isConnected, setIsConnected]       = useState(false);

  // Initialize
  useEffect(() => {
    const initial = {};
    const ts      = {};
    MACHINES.forEach(m => {
      initial[m.id] = generateMachineState(m.id);
      ts[m.id] = {
        temperature:       generateTimeSeries(30, 60, 2, 30, 95),
        vibration:         generateTimeSeries(30, 1.5, 0.3, 0, 5),
        hydraulicPressure: generateTimeSeries(30, 165, 4, 100, 200),
        spindleSpeed:      generateTimeSeries(30, 500, 20, 200, 800),
        motorCurrent:      generateTimeSeries(30, 23, 1.5, 10, 40),
        cycleTime:         generateTimeSeries(30, 16, 1, 8, 35),
      };
    });
    setMachineStates(initial);
    setTimeSeriesData(ts);
    setAlertLog(generateAlertLog(25));
    setTimeout(() => setIsConnected(true), 800);
  }, []);

  // Live update loop
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setMachineStates(prev => {
        const next = { ...prev };
        MACHINES.forEach(m => {
          next[m.id] = generateMachineState(m.id, prev[m.id]);
        });
        return next;
      });

      setTimeSeriesData(prev => {
        const next = { ...prev };
        MACHINES.forEach(m => {
          const state = machineStates[m.id];
          if (!state) return;
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const append = (arr, val) => [...arr.slice(-29), { time: now, value: val }];
          next[m.id] = {
            temperature:       append(prev[m.id]?.temperature       || [], state.sensors.temperature),
            vibration:         append(prev[m.id]?.vibration         || [], state.sensors.vibration),
            hydraulicPressure: append(prev[m.id]?.hydraulicPressure || [], state.sensors.hydraulicPressure),
            spindleSpeed:      append(prev[m.id]?.spindleSpeed      || [], state.sensors.spindleSpeed),
            motorCurrent:      append(prev[m.id]?.motorCurrent      || [], state.sensors.motorCurrent),
            cycleTime:         append(prev[m.id]?.cycleTime         || [], state.sensors.cycleTime),
          };
        });
        return next;
      });
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [isConnected, machineStates, refreshInterval]);

  const acknowledgeAlert = useCallback((alertId) => {
    setAlertLog(prev => prev.map(a => a.id === alertId ? { ...a, resolved: true } : a));
  }, []);

  const getMachineInfo = useCallback((id) => MACHINES.find(m => m.id === id), []);

  return { machineStates, timeSeriesData, alertLog, isConnected, acknowledgeAlert, getMachineInfo, machines: MACHINES };
}
