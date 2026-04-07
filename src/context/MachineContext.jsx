import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const MachineContext = createContext(null);

// ── Simulation engine (runs once, shared globally) ────────────
function useSimEngine() {
  const tickRef     = useRef(0);
  const spikeRef    = useRef(0);
  const stressRef   = useRef(false);
  const rulRef      = useRef(85.0);
  const baselineRef = useRef(null);

  const [simData,    setSimData]    = useState(null);
  const [history,    setHistory]    = useState([]);
  const [stressTest, setStressTest] = useState(false);
  const [baseline,   setBaseline]   = useState(null);
  const [rul,        setRul]        = useState(85.0);

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;
      const spike = stressRef.current && spikeRef.current > 0;

      const baseTemp  = 29.8 + Math.sin(t * 0.08) * 2   + (Math.random() - 0.5) * 1.2;
      const baseVolt  = 4.93 + Math.sin(t * 0.05) * 0.02 + (Math.random() - 0.5) * 0.015;
      const baseCurr  = 0.10 + Math.sin(t * 0.12) * 0.01 + (Math.random() - 0.5) * 0.008;
      const basePress = 20.0 + Math.sin(t * 0.09) * 1.0  + (Math.random() - 0.5) * 0.6;
      const baseVib   = 0.07 + Math.abs(Math.sin(t * 0.15)) * 0.02 + Math.random() * 0.01;

      let spikeMult = 1.0;
      if (spike) {
        const progress = Math.min(1, (14 - spikeRef.current) / 10);
        spikeMult = 1.0 + 0.22 * progress;
        spikeRef.current -= 1;
        if (spikeRef.current <= 0) {
          stressRef.current = false;
          setStressTest(false);
        }
      }

      const current  = baseCurr  * spikeMult;
      const pressure = basePress * spikeMult;
      const wearRate = 0.11 + (spikeMult - 1) * 0.5;
      rulRef.current = Math.max(0, rulRef.current - 0.004 - (spikeMult - 1) * 0.15);

      const d = {
        temperature_c:          parseFloat(baseTemp.toFixed(2)),
        supply_voltage_v:       parseFloat(baseVolt.toFixed(3)),
        spindle_current_a:      parseFloat(current.toFixed(4)),
        hydraulic_pressure_bar: parseFloat(pressure.toFixed(2)),
        vibration_rms_mm_s2:    parseFloat(baseVib.toFixed(4)),
        wear_progression:       parseFloat(wearRate.toFixed(3)),
        remaining_life_pct:     parseFloat(rulRef.current.toFixed(2)),
        cycles_remaining:       Math.round(rulRef.current * 50),
        dominant_freq_hz:       parseFloat((0.031 + Math.random() * 0.005).toFixed(4)),
        cutting_force_n:        Math.round(current * 240 + baseVib * 15 + (baseTemp - 25) * 50),
        acoustic_emission_db:   Math.round(current * 12 + baseVib * 2.5 + 200),
        tool_status:            wearRate > 1.2 ? 'failed' : wearRate > 0.7 ? 'worn' : 'new',
        spike_active:           spikeMult > 1.01,
        spike_mult:             parseFloat(spikeMult.toFixed(3)),
        timestamp:              new Date().toISOString(),
      };

      const ts = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSimData(d);
      setHistory(h => [...h, { ...d, time: ts }].slice(-150));
      setRul(rulRef.current);
    }, 600);
    return () => clearInterval(id);
  }, []);

  const calibrate = useCallback(() => {
    setSimData(cur => {
      if (!cur) return cur;
      const bl = {
        current:     cur.spindle_current_a,
        pressure:    cur.hydraulic_pressure_bar,
        temperature: cur.temperature_c,
        voltage:     cur.supply_voltage_v,
      };
      baselineRef.current = bl;
      setBaseline(bl);
      return cur;
    });
  }, []);

  const triggerStressTest = useCallback(() => {
    spikeRef.current  = 14;
    stressRef.current = true;
    setStressTest(true);
  }, []);

  const getDeviation = useCallback((key, live) => {
    const bl = baselineRef.current;
    if (!bl || !bl[key] || bl[key] === 0) return 0;
    return Math.abs((live - bl[key]) / bl[key]);
  }, []);

  return { simData, history, stressTest, baseline, rul, calibrate, triggerStressTest, getDeviation, isCalibrated: baseline !== null };
}

// ── Provider ──────────────────────────────────────────────────
export function MachineProvider({ children }) {
  const [machineProfile, setMachineProfile] = useState(null);
  const [systemStatus,   setSystemStatus]   = useState('ARMED');
  const [diagnosticsLog, setDiagnosticsLog] = useState([]);
  const [initialized,    setInitialized]    = useState(false);

  const failureThreshold = machineProfile === 'precision' ? 0.08 : 0.15;

  const sim = useSimEngine();

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
      { ...entry, id: Date.now() + Math.random(), ts: new Date().toISOString() },
      ...prev,
    ].slice(0, 50));
  }, []);

  const triggerEStop = useCallback((reason) => {
    setSystemStatus('ESTOP');
    addDiagnostic({ level: 'CRITICAL', type: 'estop', message: reason });
  }, [addDiagnostic]);

  const triggerWarning = useCallback((reason) => {
    setSystemStatus(prev => {
      if (prev !== 'ESTOP') {
        addDiagnostic({ level: 'WARNING', type: 'warning', message: reason });
        return 'WARNING';
      }
      return prev;
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
      // Simulation — shared single instance
      sim,
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

// Convenience hook — just grab sim from context
export function useSimulation() {
  const { sim } = useMachine();
  return sim;
}
