import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSimulation — Industrial demo engine
 * Generates realistic fluctuating sensor data.
 * Supports: calibrate, stress-test spike, profile-aware thresholds.
 */
export function useSimulation() {
  const tickRef   = useRef(0);
  const spikeRef  = useRef(0); // counts down ticks during stress-test spike

  const [data, setData]           = useState(null);
  const [history, setHistory]     = useState([]);
  const [stressTest, setStressTest] = useState(false);
  const [baseline, setBaseline]   = useState(null);    // calibrated zero
  const [rul, setRul]             = useState(85.0);    // RUL countdown
  const rulRef = useRef(85.0);

  // Generate one tick of sensor values
  const generateTick = useCallback((spike) => {
    tickRef.current += 1;
    // Base normal ranges
    const baseTemp = 29.8 + Math.sin(tickRef.current * 0.08) * 2 + (Math.random() - 0.5) * 1.2;
    const baseVolt = 4.93 + Math.sin(tickRef.current * 0.05) * 0.02 + (Math.random() - 0.5) * 0.015;
    const baseCurr = 0.10 + Math.sin(tickRef.current * 0.12) * 0.01 + (Math.random() - 0.5) * 0.008;
    const basePress = 20.0 + Math.sin(tickRef.current * 0.09) * 1.0 + (Math.random() - 0.5) * 0.6;
    const baseVib  = 0.07 + Math.abs(Math.sin(tickRef.current * 0.15)) * 0.02 + Math.random() * 0.01;

    // Spike multiplier ramps up over 3 seconds (6 ticks @ 500ms)
    let spikeMult = 1.0;
    if (spike && spikeRef.current > 0) {
      const progress = (6 - spikeRef.current) / 6; // 0→1
      spikeMult = 1.0 + 0.18 * Math.min(1, progress * 1.5); // up to +18%
      spikeRef.current -= 1;
    }

    const current  = baseCurr  * spikeMult;
    const pressure = basePress * spikeMult;

    // Wear from current spikes
    const wearRate = 0.11 + (spikeMult - 1) * 0.5;

    // RUL slowly decays
    rulRef.current = Math.max(0, rulRef.current - 0.005 - (spikeMult - 1) * 0.2);

    // Derived
    const cuttingForce = Math.round(current * 240 + baseVib * 15 + (baseTemp - 25) * 50);
    const acoustic     = Math.round(current * 12 + baseVib * 2.5 + 200);

    return {
      temperature_c:        parseFloat(baseTemp.toFixed(2)),
      supply_voltage_v:     parseFloat(baseVolt.toFixed(3)),
      spindle_current_a:    parseFloat(current.toFixed(4)),
      hydraulic_pressure_bar: parseFloat(pressure.toFixed(2)),
      vibration_rms_mm_s2:  parseFloat(baseVib.toFixed(4)),
      wear_progression:     parseFloat(wearRate.toFixed(3)),
      remaining_life_pct:   parseFloat(rulRef.current.toFixed(2)),
      cycles_remaining:     Math.round(rulRef.current * 50),
      estimated_time_left:  `${Math.floor(rulRef.current * 0.5)}h ${Math.round((rulRef.current * 0.5 % 1) * 60)}m`,
      dominant_freq_hz:     parseFloat((0.031 + Math.random() * 0.005).toFixed(4)),
      cutting_force_n:      cuttingForce,
      acoustic_emission_db: acoustic,
      tool_status:          wearRate > 1.2 ? 'failed' : wearRate > 0.7 ? 'worn' : 'new',
      spike_active:         spikeMult > 1.01,
      spike_mult:           parseFloat(spikeMult.toFixed(3)),
      timestamp:            new Date().toISOString(),
    };
  }, []);

  // Main tick loop
  useEffect(() => {
    const id = setInterval(() => {
      setData(prev => {
        const d = generateTick(stressTest);
        const t = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setHistory(h => [...h, { ...d, time: t }].slice(-120));
        setRul(rulRef.current);
        return d;
      });
    }, 500);
    return () => clearInterval(id);
  }, [stressTest, generateTick]);

  // Calibrate: set current values as baseline
  const calibrate = useCallback(() => {
    setData(d => {
      if (!d) return d;
      setBaseline({
        current:  d.spindle_current_a,
        pressure: d.hydraulic_pressure_bar,
        temperature: d.temperature_c,
        voltage:  d.supply_voltage_v,
      });
      return d;
    });
  }, []);

  // Trigger stress test spike
  const triggerStressTest = useCallback(() => {
    spikeRef.current = 12; // 12 ticks = 6 seconds
    setStressTest(true);
    setTimeout(() => setStressTest(false), 7000);
  }, []);

  const resetRul = useCallback(() => {
    rulRef.current = 85.0;
    setRul(85.0);
  }, []);

  // Compute deviations from baseline
  const getDeviation = useCallback((key, live) => {
    if (!baseline) return 0;
    const base = baseline[key];
    if (!base) return 0;
    return Math.abs((live - base) / base);
  }, [baseline]);

  return {
    data,
    history,
    stressTest,
    baseline,
    rul,
    calibrate,
    triggerStressTest,
    resetRul,
    getDeviation,
    isCalibrated: baseline !== null,
  };
}
