import { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Zap, Gauge, Activity, RotateCcw, AlertTriangle, CheckCircle2, Cpu } from 'lucide-react';

// ── Animated progress bar ─────────────────────────────────────
function ParamBar({ label, value, max, unit, color, threshold, devPct }) {
  const pct      = Math.min(100, (value / max) * 100);
  const threshPx = Math.min(100, ((1 + devPct / 100) * (max * 0.5)) / max * 100); // threshold line position
  const exceeded = value > max * 0.5 * (1 + devPct / 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className={`font-black text-base ${exceeded ? 'text-amber-400' : 'text-emerald-400'}`}>
          {value.toFixed(1)} <span className="text-slate-500 text-xs font-normal">{unit}</span>
        </span>
      </div>
      <div className="relative h-3 bg-slate-800 rounded-full overflow-visible border border-slate-700">
        {/* Fill */}
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: exceeded ? '#f59e0b' : color }}
        />
        {/* Threshold line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-red-500 opacity-70"
          style={{ left: `${threshPx}%` }}
          title={`Threshold: ${devPct}% deviation`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-600">
        <span>0</span>
        <span className="text-red-500/70">▲ +{devPct}% threshold</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
}

// ── Logic gate display ────────────────────────────────────────
function LogicGate({ triggered, count }) {
  return (
    <div className={`rounded-xl border-2 p-4 transition-all duration-500 ${
      triggered
        ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20'
        : 'border-slate-700 bg-slate-800/50'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu size={16} className={triggered ? 'text-amber-400' : 'text-slate-500'}/>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">5–10% Logic Gate</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          triggered
            ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
            : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
        }`}>
          {triggered ? 'TRIGGERED' : 'NOMINAL'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {[0,1,2].map(i => (
          <div key={i} className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold border transition-all duration-300 ${
            i < count
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
              : 'bg-slate-700/50 border-slate-700 text-slate-600'
          }`}>
            {i < count ? '⚡ HI' : '— LO'}
          </div>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-slate-500 text-center">
        {count} / 3 parameters exceeded · {triggered ? '≥2 triggers correlation rule' : 'Need ≥2 to trigger'}
      </div>
      {triggered && (
        <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="text-amber-400 animate-pulse flex-shrink-0"/>
          <span className="text-xs font-bold text-amber-300">Potential Chip Packing Detected</span>
        </div>
      )}
    </div>
  );
}

// ── Hard Stop Relay ───────────────────────────────────────────
function RelayStatus({ tripped }) {
  return (
    <div className={`rounded-xl border-2 p-6 transition-all duration-500 ${
      tripped
        ? 'border-red-500 bg-red-500/10 shadow-xl shadow-red-500/30 animate-pulse'
        : 'border-emerald-600/50 bg-emerald-500/5'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-1">Hard-Stop Relay</div>
          <div className={`text-2xl font-black uppercase tracking-wider ${tripped ? 'text-red-400' : 'text-emerald-400'}`}>
            {tripped ? 'RELAY TRIPPED' : 'SYSTEM ARMED'}
          </div>
          <div className={`text-sm mt-1 font-medium ${tripped ? 'text-red-300' : 'text-emerald-600'}`}>
            {tripped ? 'MACHINE HALTED — Awaiting reset' : 'All parameters within safe limits'}
          </div>
        </div>
        <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center flex-shrink-0 ${
          tripped
            ? 'border-red-500 bg-red-500/20'
            : 'border-emerald-500 bg-emerald-500/10'
        }`}>
          {tripped
            ? <ShieldAlert size={28} className="text-red-400"/>
            : <CheckCircle2 size={28} className="text-emerald-400"/>
          }
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function DamagePrevention() {
  const [sensitivity, setSensitivity] = useState(10);
  const [relayTripped, setRelayTripped] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Live simulated sensor values
  const [current,  setCurrent]  = useState(12.4);
  const [pressure, setPressure] = useState(82.0);
  const [torque,   setTorque]   = useState(45.0);

  // Baselines (normal operating values)
  const BASE_CURR = 12.0;
  const BASE_PRES = 80.0;
  const BASE_TORQ = 44.0;
  const MAX_CURR  = 25;
  const MAX_PRES  = 160;
  const MAX_TORQ  = 90;

  // Simulate live fluctuating values
  useEffect(() => {
    if (relayTripped) return;
    const id = setInterval(() => {
      // Mean-reverting simulation: always pulled back toward baseline + small noise
      const revert = 0.15; // pull strength toward baseline
      setCurrent(v  => parseFloat((Math.max(0, v + revert*(12.0 - v) + (Math.random()-0.5)*0.6)).toFixed(2)));
      setPressure(v => parseFloat((Math.max(0, v + revert*(80.0 - v) + (Math.random()-0.5)*1.2)).toFixed(2)));
      setTorque(v   => parseFloat((Math.max(0, v + revert*(44.0 - v) + (Math.random()-0.5)*0.8)).toFixed(2)));
    }, 800);
    return () => clearInterval(id);
  }, [relayTripped, resetKey]);

  // Check thresholds
  const currExceeded = current  > BASE_CURR * (1 + sensitivity / 100);
  const presExceeded = pressure > BASE_PRES * (1 + sensitivity / 100);
  const torqExceeded = torque   > BASE_TORQ * (1 + sensitivity / 100);
  const exceedCount  = [currExceeded, presExceeded, torqExceeded].filter(Boolean).length;
  const correlated   = exceedCount >= 2;

  // Auto-trip relay when correlated
  useEffect(() => {
    if (correlated && !relayTripped) setRelayTripped(true);
  }, [correlated]);

  const handleReset = () => {
    setRelayTripped(false);
    setCurrent(BASE_CURR);
    setPressure(BASE_PRES);
    setTorque(BASE_TORQ);
    setResetKey(k => k + 1);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <ShieldAlert size={26} className="text-amber-400"/>
            Active Damage Prevention System
          </h1>
          <p className="text-slate-500 text-sm mt-1">Real-time correlation monitoring · Random Forest decision engine</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${
          relayTripped
            ? 'border-red-500/50 bg-red-500/10 text-red-400'
            : 'border-emerald-600/30 bg-emerald-500/5 text-emerald-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${relayTripped ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`}/>
          {relayTripped ? 'FAULT DETECTED' : 'MONITORING ACTIVE'}
        </div>
      </div>

      {/* Relay Status */}
      <RelayStatus tripped={relayTripped}/>

      {/* Threshold + Correlation Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Threshold Config */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-slate-400"/>
            <span className="text-xs uppercase tracking-widest font-bold text-slate-400">Threshold Configuration</span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-300 font-medium">Deviation Sensitivity</span>
              <span className="text-lg font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 px-3 py-0.5 rounded-full">
                {sensitivity}%
              </span>
            </div>
            <input
              type="range" min={5} max={20} step={1}
              value={sensitivity}
              onChange={e => setSensitivity(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #f59e0b ${((sensitivity-5)/15)*100}%, #334155 ${((sensitivity-5)/15)*100}%)`
              }}
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1.5">
              <span>5% — Very Sensitive</span>
              <span>20% — Fault Tolerant</span>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Threshold Baseline</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { l: 'Current', v: (BASE_CURR*(1+sensitivity/100)).toFixed(1), u: 'A' },
                { l: 'Pressure', v: (BASE_PRES*(1+sensitivity/100)).toFixed(1), u: 'Bar' },
                { l: 'Torque', v: (BASE_TORQ*(1+sensitivity/100)).toFixed(1), u: 'Nm' },
              ].map(({ l, v, u }) => (
                <div key={l} className="text-center">
                  <div className="text-slate-500">{l}</div>
                  <div className="text-amber-400 font-bold">{v} <span className="text-slate-600">{u}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Logic Gate */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-slate-400"/>
            <span className="text-xs uppercase tracking-widest font-bold text-slate-400">Correlation Engine</span>
          </div>
          <LogicGate triggered={correlated} count={exceedCount}/>
        </div>
      </div>

      {/* Correlation Status */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-6">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-slate-400"/>
          <span className="text-xs uppercase tracking-widest font-bold text-slate-400">Correlation Status — Live Parameters</span>
          <span className="ml-auto text-[10px] text-slate-600 animate-pulse">● LIVE</span>
        </div>
        <div className="space-y-6">
          <ParamBar label="Motor Current (Amps)"      value={current}  max={MAX_CURR}  unit="A"   color="#10b981" threshold devPct={sensitivity} />
          <ParamBar label="Hydraulic Pressure (Bar)"  value={pressure} max={MAX_PRES}  unit="Bar" color="#3b82f6" threshold devPct={sensitivity} />
          <ParamBar label="Spindle Torque (Nm)"       value={torque}   max={MAX_TORQ}  unit="Nm"  color="#8b5cf6" threshold devPct={sensitivity} />
        </div>
      </div>

      {/* Reset Button */}
      <div className="flex justify-center">
        <button
          onClick={handleReset}
          className="flex items-center gap-3 px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest
            bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 hover:border-slate-500
            transition-all duration-200 active:scale-95 shadow-lg"
        >
          <RotateCcw size={18} className="text-emerald-400"/>
          System Reset &amp; Re-calibrate
        </button>
      </div>

    </div>
  );
}
