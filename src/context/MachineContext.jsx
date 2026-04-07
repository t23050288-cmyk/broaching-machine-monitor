import { createContext, useContext, useState, useCallback } from 'react';

const MachineContext = createContext(null);

export function MachineProvider({ children }) {
  const [machineProfile, setMachineProfile] = useState(null);
  const [systemStatus,   setSystemStatus]   = useState('ARMED');
  const [diagnosticsLog, setDiagnosticsLog] = useState([]);
  const [initialized,    setInitialized]    = useState(false);

  const failureThreshold = machineProfile === 'precision' ? 0.08 : 0.15;

  const initMachine = useCallback((profile) => {
    setMachineProfile(profile);
    setInitialized(true);
    setSystemStatus('ARMED');
  }, []);

  const setProfile = useCallback((profile) => {
    setMachineProfile(profile);
  }, []);

  const addDiagnostic = useCallback((entry) => {
    setDiagnosticsLog(prev => [
      { ...entry, id: Date.now(), ts: new Date().toISOString() },
      ...prev,
    ].slice(0, 50));
  }, []);

  const triggerEStop = useCallback((reason) => {
    setSystemStatus('ESTOP');
    addDiagnostic({ level: 'CRITICAL', type: 'estop', message: reason });
  }, [addDiagnostic]);

  const triggerWarning = useCallback((reason) => {
    setSystemStatus(s => {
      if (s !== 'ESTOP') {
        addDiagnostic({ level: 'WARNING', type: 'warning', message: reason });
        return 'WARNING';
      }
      return s;
    });
  }, [addDiagnostic]);

  const resetStatus = useCallback(() => {
    setSystemStatus('ARMED');
  }, []);

  return (
    <MachineContext.Provider value={{
      machineProfile, systemStatus, diagnosticsLog,
      failureThreshold, initialized,
      initMachine, setProfile,
      addDiagnostic, triggerEStop, triggerWarning, resetStatus,
    }}>
      {children}
    </MachineContext.Provider>
  );
}

export function useMachine() {
  const ctx = useContext(MachineContext);
  if (!ctx) throw new Error('useMachine must be inside MachineProvider');
  return ctx;
}
