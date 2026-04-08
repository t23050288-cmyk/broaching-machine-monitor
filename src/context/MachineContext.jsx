import { createContext, useContext, useState, useCallback, useEffect, useRef, Component } from 'react';

const MachineContext = createContext(null);

// ── Error Boundary ─────────────────────────────────────────────
export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-900 text-red-400 p-8 text-center">
          <div>
            <div className="text-4xl mb-4">⚠</div>
            <div className="font-bold text-lg mb-2">System Error</div>
            <div className="text-sm text-slate-400 max-w-md">{this.state.error?.message}</div>
            <button onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg border border-red-400/30 text-red-400 text-sm hover:bg-red-400/10">
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── 18-sensor simulation engine ────────────────────────────────
function useSimEngine() {
  const tickRef    = useRef(0);
  const latestRef  = useRef(null);
  const baselineRef = useRef(null);
  const thresholdRef = useRef(0.10); // 10% default

  const [data,      setData]      = useState(null);
  const [history,   setHistory]   = useState([]);
  const [baseline,  setBaseline]  = useState(null);
  const [threshold, setThresholdState] = useState(0.10);
  const [relayOpen, setRelayOpen] = useState(false); // E-Stop relay
  const [alerts,    setAlerts]    = useState([]);

  const setThreshold = useCallback((v) => {
    thresholdRef.current = v;
    setThresholdState(v);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;

      // ── Vibration sensors V1-V6 (mm/s²) ──
      const vibBase = 0.07 + Math.abs(Math.sin(t * 0.15)) * 0.03 + Math.random() * 0.012;
      const V1 = parseFloat((vibBase + Math.random() * 0.008).toFixed(4));
      const V2 = parseFloat((vibBase * 0.97 + Math.random() * 0.006).toFixed(4));
      const V3 = parseFloat((vibBase * 1.02 + Math.random() * 0.007).toFixed(4));
      const V4 = parseFloat((vibBase * 0.95 + Math.random() * 0.009).toFixed(4));
      const V5 = parseFloat((vibBase * 1.05 + Math.random() * 0.005).toFixed(4));
      const V6 = parseFloat((vibBase * 0.99 + Math.random() * 0.008).toFixed(4));
      const vibAvg = (V1+V2+V3+V4+V5+V6)/6;

      // ── Current scales WITH vibration (your real sensor behavior) ──
      // vibAvg ~0.07–0.12 → current 0.10–0.50 A
      const vibNorm = Math.min(1, (vibAvg - 0.06) / 0.08); // 0→1
      const currentBase = 0.10 + vibNorm * 0.40 + (Math.random() - 0.5) * 0.015;

      // ── Force/Load L1-L4 (N) ──
      const L1 = parseFloat((currentBase * 240 + vibAvg * 15 + (Math.random()-0.5)*20).toFixed(1));
      const L2 = parseFloat((L1 * 0.98 + (Math.random()-0.5)*15).toFixed(1));
      const L3 = parseFloat((L1 * 1.01 + (Math.random()-0.5)*18).toFixed(1));
      const L4 = parseFloat((L1 * 0.99 + (Math.random()-0.5)*12).toFixed(1));

      // ── Thermal T1-T4 (°C) ──
      const tempBase = 29.8 + Math.sin(t * 0.08) * 2 + vibNorm * 8 + (Math.random()-0.5)*1.2;
      const T1 = parseFloat(tempBase.toFixed(2));
      const T2 = parseFloat((tempBase * 0.98 + (Math.random()-0.5)*0.8).toFixed(2));
      const T3 = parseFloat((tempBase * 1.03 + (Math.random()-0.5)*0.6).toFixed(2));
      const T4 = parseFloat((tempBase * 0.96 + (Math.random()-0.5)*0.9).toFixed(2));

      // ── Acoustic A1-A2 (dB) ──
      const A1 = parseFloat((currentBase * 12 + vibAvg * 40 + 200 + (Math.random()-0.5)*2).toFixed(1));
      const A2 = parseFloat((A1 * 0.97 + (Math.random()-0.5)*1.5).toFixed(1));

      // ── Process P1=Hydraulic Pressure (bar), P2=Voltage (V) ──
      const P1 = parseFloat((20.0 + Math.sin(t*0.09)*1.0 + currentBase*8 + (Math.random()-0.5)*0.6).toFixed(2));
      const P2 = parseFloat((4.93 + Math.sin(t*0.05)*0.02 + (Math.random()-0.5)*0.015).toFixed(3));

      // ── Spindle Torque (derived, N·m) ──
      const torque = parseFloat((currentBase * 3.2 + vibAvg * 0.8 + (Math.random()-0.5)*0.1).toFixed(3));

      const wearRate = 0.11 + vibNorm * 0.4;
      const rulPct   = Math.max(0, 85 - t * 0.008 - vibNorm * 0.3);

      const d = {
        // Vibration
        V1, V2, V3, V4, V5, V6, vibAvg: parseFloat(vibAvg.toFixed(4)),
        // Force
        L1, L2, L3, L4,
        // Thermal
        T1, T2, T3, T4, tempAvg: parseFloat(tempBase.toFixed(2)),
        // Acoustic
        A1, A2,
        // Process
        P1, P2,
        // Key derived
        spindle_current_a:      parseFloat(currentBase.toFixed(4)),
        spindle_torque_nm:      torque,
        hydraulic_pressure_bar: P1,
        temperature_c:          T1,
        wear_progression:       parseFloat(wearRate.toFixed(3)),
        remaining_life_pct:     parseFloat(rulPct.toFixed(1)),
        cycles_remaining:       Math.round(rulPct * 50),
        tool_status:            wearRate > 0.4 ? 'worn' : 'new',
        timestamp:              new Date().toISOString(),
      };

      latestRef.current = d;

      // ── Correlation check (the 10% rule) ──
      const bl = baselineRef.current;
      if (bl) {
        const thr = thresholdRef.current;
        const currDev  = Math.abs((d.spindle_current_a       - bl.current)  / bl.current);
        const pressDev = Math.abs((d.hydraulic_pressure_bar  - bl.pressure) / bl.pressure);
        const torqDev  = Math.abs((d.spindle_torque_nm       - bl.torque)   / bl.torque);
        const exceedCount = [currDev > thr, pressDev > thr, torqDev > thr].filter(Boolean).length;
        const shouldOpen = exceedCount >= 2;
        setRelayOpen(shouldOpen);
        if (shouldOpen) {
          const pct = Math.round(Math.max(currDev, pressDev, torqDev) * 100);
          setAlerts(prev => {
            if (prev[0]?.type === 'correlation') return prev; // dedupe
            return [{
              id: Date.now(),
              type: 'correlation',
              level: 'ALARM',
              message: `${pct}% Deviation Intercepted — Current+Pressure correlation spike`,
              ts: new Date().toISOString(),
              currDev: (currDev*100).toFixed(1),
              pressDev: (pressDev*100).toFixed(1),
              torqDev: (torqDev*100).toFixed(1),
            }, ...prev].slice(0, 100);
          });
        }
      }

      const ts = new Date().toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      setData(d);
      setHistory(h => [...h, { ...d, time: ts }].slice(-200));
    }, 700);
    return () => clearInterval(id);
  }, []);

  const calibrate = useCallback(() => {
    const cur = latestRef.current;
    if (!cur) return;
    const bl = {
      current:  cur.spindle_current_a,
      pressure: cur.hydraulic_pressure_bar,
      torque:   cur.spindle_torque_nm,
      temp:     cur.temperature_c,
      vib:      cur.vibAvg,
    };
    baselineRef.current = bl;
    setBaseline(bl);
    setRelayOpen(false);
  }, []);

  const resetRelay = useCallback(() => setRelayOpen(false), []);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  return {
    data, history, baseline, threshold, relayOpen, alerts,
    calibrate, resetRelay, clearAlerts, setThreshold,
    isCalibrated: baseline !== null,
  };
}

// ── Provider ──────────────────────────────────────────────────
export function MachineProvider({ children }) {
  const [machineProfile, setMachineProfile] = useState(null);
  const [initialized,    setInitialized]    = useState(false);

  const sim = useSimEngine();

  const initMachine = useCallback((profile) => {
    setMachineProfile(profile);
    setInitialized(true);
  }, []);

  return (
    <MachineContext.Provider value={{
      machineProfile, initialized, initMachine, setMachineProfile, sim,
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

export function useSimulation() {
  return useMachine().sim;
}
