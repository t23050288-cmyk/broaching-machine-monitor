import { createContext, useContext, useState, useCallback } from 'react';

const MachineContext = createContext(null);

export function MachineProvider({ children }) {
  const [machineProfile, setMachineProfile] = useState(null); // null = not selected yet
  const [sensorBaseline, setSensorBaseline] = useState({ current: null, pressure: null, vibration: null, temperature: null, voltage: null });
  const [systemStatus,   setSystemStatus]   = useState('ARMED'); // 'ARMED' | 'WARNING' | 'ESTOP'
  const [diagnosticsLog, setDiagnosticsLog] = useState([]);
  const [initialized,    setInitialized]    = useState(false);

  const failureThreshold = machineProfile === 'precision' ? 0.08 : 0.15;

  const initMachine = useCallback((profile) => {
    setMachineProfile(profile);
    setInitialized(true);
    setSystemStatus('ARMED');
  }, []);

  const calibrate = useCallback((liveData) => {
    setSensorBaseline({
      current:     liveData.spindle_current_a   ?? null,
      vibration:   liveData.vibration_rms_mm_s2 ?? null,
      temperature: liveData.temperature_c        ?? null,
      voltage:     liveData.supply_voltage_v     ?? null,
    });
  }, []);

  const addDiagnostic = useCallback((entry) => {
    setDiagnosticsLog(prev => [{ ...entry, id: Date.now(), ts: new Date().toISOString() }, ...prev].slice(0, 50));
  }, []);

  const triggerEStop = useCallback((reason) => {
    setSystemStatus('ESTOP');
    addDiagnostic({ level: 'CRITICAL', type: 'estop', message: reason });
  }, [addDiagnostic]);

  const triggerWarning = useCallback((reason) => {
    if (systemStatus !== 'ESTOP') {
      setSystemStatus('WARNING');
      addDiagnostic({ level: 'WARNING', type: 'warning', message: reason });
    }
  }, [systemStatus, addDiagnostic]);

  const resetStatus = useCallback(() => {
    setSystemStatus('ARMED');
  }, []);

  return (
    <MachineContext.Provider value={{
      machineProfile, sensorBaseline, systemStatus, diagnosticsLog,
      failureThreshold, initialized,
      initMachine, calibrate, addDiagnostic, triggerEStop, triggerWarning, resetStatus,
    }}>
      {children}
    </MachineContext.Provider>
  );
}

export function useMachine() {
  const ctx = useContext(MachineContext);
  if (!ctx) throw new Error('useMachine must be used inside MachineProvider');
  return ctx;
}
