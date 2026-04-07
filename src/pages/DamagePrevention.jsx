import { useState, useEffect, useRef } from 'react';
import { useMachine } from '../context/MachineContext';
import { useSimulation } from '../hooks/useSimulation';
import { Target, ShieldAlert, CheckCircle2, Zap, FlaskConical, RotateCcw, Activity } from 'lucide-react';
import LiveChart from '../components/LiveChart';

// ── Virtual Relay visual ──────────────────────────────────────
function VirtualRelay({ open }) {
  return (
    <div className={`rounded-xl p-5 border transition-all duration-500 ${open ? 'bg-[#93000a]/20 border-[#ffb4ab]/40' : 'bg-[#181c22] border-[#3b494c]/20'}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mb-4 flex items-center gap-2">
        <Zap size={12} style={{ color: open ? '#ffb4ab' : '#00e5ff' }}/>
        Virtual Relay — Spindle Power Circuit
      </div>
      <div className="flex items-center justify-center gap-4 py-2">
        {/* Power source */}
        <div className="text-center">
          <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mx-auto mb-2 transition-all
            ${open ? 'border-[#3b494c]/40 bg-[#3b494c]/10' : 'border-[#00e5ff]/50 bg-[#00e5ff]/10'}`}>
            <Zap size={18} style={{ color: open ? '#3b494c' : '#00e5ff' }}/>
          </div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: open ? '#3b494c' : '#00e5ff' }}>POWER</div>
        </div>
        {/* Wire segment 1 */}
        <div className="flex items-center gap-0.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`w-3 h-1 rounded-sm transition-all ${open ? 'bg-[#ffb4ab]' : 'bg-[#00e5ff]'}`}/>
          ))}
        </div>
        {/* Relay switch */}
        <div className={`relative w-14 h-10 rounded-lg border-2 flex items-center justify-center transition-all
          ${open ? 'bg-[#93000a]/30 border-[#ffb4ab]/50' : 'bg-[#00e5ff]/10 border-[#00e5ff]/30'}`}>
          <div className={`text-[8px] font-black uppercase tracking-wider transition-all
            ${open ? 'text-[#ffb4ab]' : 'text-[#00e5ff]'}`}>
            {open ? 'OPEN' : 'CLOSED'}
          </div>
          {/* Switch arm */}
          <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded transition-all duration-500 origin-left
            ${open ? 'bg-[#ffb4ab] rotate-[-30deg]' : 'bg-[#00e5ff] rotate-0'}`}/>
        </div>
        {/* Wire segment 2 */}
        <div className="flex items-center gap-0.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`w-3 h-1 rounded-sm transition-all ${open ? 'bg-[#3b494c]' : 'bg-[#00e5ff]'}`}/>
          ))}
        </div>
        {/* Load (spindle) */}
        <div className="text-center">
          <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mx-auto mb-2 transition-all
            ${open ? 'border-[#3b494c]/40 bg-[#3b494c]/10' : 'border-[#00e5ff]/50 bg-[#00e5ff]/10'}`}>
            <Activity size={18} style={{ color: open ? '#3b494c' : '#00e5ff' }}/>
          </div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: open ? '#3b494c' : '#00e5ff' }}>SPINDLE</div>
        </div>
      </div>
      <div className={`text-center text-[10px] font-bold uppercase tracking-wider mt-2 transition-all
        ${open ? 'text-[#ffb4ab]' : 'text-[#00e5ff]'}`}>
        {open ? '⚡ Circuit OPEN — Spindle power isolated' : '✓ Circuit CLOSED — Normal operation'}
      </div>
    </div>
  );
}

// ── E-Stop overlay specific to this page ──────────────────────
function ChipPackingOverlay({ active, onReset }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-[#93000a]/50 animate-pulse"/>
      <div className="absolute inset-0 border-8 border-[#ffb4ab]/80 animate-pulse"/>
      <div className="relative z-10 bg-[#0a0d12]/95 backdrop-blur-md border-2 border-[#ffb4ab]/60 rounded-2xl p-8 max-w-lg mx-4 text-center shadow-2xl">
        <div className="text-6xl mb-3 animate-bounce">🛑</div>
        <div className="text-[11px] uppercase tracking-[0.35em] text-[#ffb4ab] mb-2">Autonomous Shutdown</div>
        <h2 className="text-3xl font-black font-headline text-[#ffb4ab] mb-4 leading-tight">
          CHIP PACKING<br/>DETECTED
        </h2>
        <div className="bg-[#181c22] rounded-xl p-4 border border-[#ffb4ab]/20 text-left mb-5 space-y-2">
          <div className="text-[9px] uppercase tracking-wider text-[#849396]">AI Diagnosis</div>
          <div className="text-sm text-[#dfe2eb]">Combined load spike exceeded threshold on <b>both Current and Pressure</b> simultaneously.</div>
          <div className="text-[11px] text-[#ffb4ab] font-bold">Probable cause: Chip packing / tool friction buildup</div>
          <div className="text-[11px] text-[#ffba38]">Action: Stop, clear chips, inspect tool edge. Regrind if worn.</div>
        </div>
        <button onClick={onReset}
          className="w-full py-3.5 rounded-xl font-bold text-sm border border-[#ffb4ab]/40 text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition-colors">
          <RotateCcw size={14} className="inline mr-2"/>Reset &amp; Resume
        </button>
      </div>
    </div>
  );
}

export default function DamagePrevention() {
  const { failureThreshold, systemStatus, triggerEStop, triggerWarning, resetStatus } = useMachine();
  const { data, history, stressTest, baseline, rul, calibrate, triggerStressTest, getDeviation, isCalibrated } = useSimulation();
  const prevBoth = useRef(false);

  const currDev  = isCalibrated ? getDeviation('current',  data?.spindle_current_a       ?? 0) : 0;
  const pressDev = isCalibrated ? getDeviation('pressure',  data?.hydraulic_pressure_bar  ?? 0) : 0;
  const bothExceed = currDev > failureThreshold && pressDev > failureThreshold;

  useEffect(() => {
    if (!isCalibrated) return;
    if (bothExceed && !prevBoth.current && systemStatus !== 'ESTOP') {
      triggerEStop('Chip Packing Detected — Current & Pressure combined spike. Autonomous shutdown triggered.');
    }
    prevBoth.current = bothExceed;
  }, [bothExceed, isCalibrated, systemStatus]);

  const isEStop = systemStatus === 'ESTOP';

  const bars = [
    { label: 'Motor Current', dev: currDev, val: data?.spindle_current_a?.toFixed(4), unit: 'A', color: '#818cf8', base: baseline?.current?.toFixed(4) },
    { label: 'Hyd. Pressure', dev: pressDev, val: data?.hydraulic_pressure_bar?.toFixed(2), unit: 'bar', color: '#ff9259', base: baseline?.pressure?.toFixed(2) },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <ChipPackingOverlay active={isEStop} onReset={resetStatus}/>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight flex items-center gap-2">
            <ShieldAlert size={22} className="text-amber-400"/> Damage Prevention
          </h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">
            Fused Correlation Engine · {(failureThreshold * 100).toFixed(0)}% threshold
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={calibrate}
            className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl border font-bold transition-all
              ${isCalibrated
                ? 'bg-[#00e5ff]/10 border-[#00e5ff]/30 text-[#00e5ff] hover:bg-[#00e5ff]/20'
                : 'bg-[#c084fc]/10 border-[#c084fc]/40 text-[#c084fc] hover:bg-[#c084fc]/20'}`}>
            <Target size={13}/>{isCalibrated ? '✓ Re-Calibrate' : 'Calibrate Baseline'}
          </button>
          <button onClick={triggerStressTest} disabled={stressTest}
            className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl border font-bold transition-all
              ${stressTest ? 'bg-[#ffb4ab]/20 border-[#ffb4ab]/50 text-[#ffb4ab] cursor-not-allowed animate-pulse' : 'bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab] hover:bg-[#ffb4ab]/20'}`}>
            <FlaskConical size={13}/>{stressTest ? 'Spike Running…' : 'Trigger Stress Test'}
          </button>
        </div>
      </div>

      {/* Baseline info */}
      {isCalibrated && (
        <div className="bg-[#0d1f0d]/60 border border-[#00e5ff]/20 rounded-xl px-4 py-3 flex items-center gap-2 text-xs">
          <CheckCircle2 size={14} className="text-[#00e5ff]"/>
          <span className="text-[#00e5ff] font-bold">Baseline Calibrated</span>
          <span className="text-[#849396] ml-2">
            Current: {baseline?.current?.toFixed(4)} A · Pressure: {baseline?.pressure?.toFixed(2)} bar
          </span>
        </div>
      )}
      {!isCalibrated && (
        <div className="bg-[#ffba38]/5 border border-[#ffba38]/20 rounded-xl px-4 py-3 text-xs text-[#ffba38]">
          ⚠ Calibrate first to activate the Fused Correlation Engine and deviation tracking.
        </div>
      )}

      {/* Logic Gate Visual */}
      <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mb-4 flex items-center gap-2">
          <Target size={12} className="text-[#c084fc]"/> Correlation Logic Gate
        </div>
        <div className="space-y-4">
          {bars.map(b => {
            const exceeds = b.dev > failureThreshold;
            const pct = Math.min(100, (b.dev / (failureThreshold * 1.5)) * 100);
            return (
              <div key={b.label}>
                <div className="flex items-center justify-between text-[9px] mb-2">
                  <span className="text-[#849396] uppercase tracking-wider font-bold">{b.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#3b494c]">base: {isCalibrated ? b.base : '—'} {b.unit}</span>
                    <span className="text-[#849396]">live: {b.val} {b.unit}</span>
                    <span style={{ color: exceeds ? '#ffb4ab' : b.color }}
                      className={`font-black text-xs ${exceeds ? 'animate-pulse' : ''}`}>
                      {isCalibrated ? `${(b.dev * 100).toFixed(1)}%` : '—'}
                      {exceeds && ' ▲ EXCEEDED'}
                    </span>
                  </div>
                </div>
                <div className="relative h-6 bg-[#10141a] rounded-full overflow-hidden border border-[#3b494c]/20">
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                    style={{
                      width: isCalibrated ? `${pct}%` : '0%',
                      background: exceeds
                        ? 'linear-gradient(90deg,#991b1b,#ffb4ab)'
                        : `linear-gradient(90deg,${b.color}44,${b.color})`,
                      boxShadow: exceeds ? '0 0 12px #ff444466' : 'none',
                    }}>
                    {pct > 20 && (
                      <span className="text-[8px] font-bold" style={{ color: exceeds ? '#ffb4ab' : '#10141a' }}>
                        {isCalibrated ? `${(b.dev * 100).toFixed(1)}%` : ''}
                      </span>
                    )}
                  </div>
                  {/* Threshold line */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-[#ffba38]"
                    style={{ left: `${(failureThreshold / (failureThreshold * 1.5)) * 100}%` }}>
                    <div className="absolute -top-0.5 -left-3 text-[8px] text-[#ffba38] whitespace-nowrap">
                      {(failureThreshold * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* AND gate result */}
        <div className={`mt-5 rounded-xl p-4 border text-center transition-all duration-500
          ${bothExceed ? 'bg-[#93000a]/20 border-[#ffb4ab]/40' : isCalibrated ? 'bg-[#0d1f0d]/30 border-[#00e5ff]/15' : 'bg-[#1c2026] border-[#3b494c]/20'}`}>
          <div className="text-[9px] uppercase tracking-[0.2em] text-[#849396] mb-1">AND Gate Output</div>
          <div className="text-lg font-black" style={{ color: bothExceed ? '#ffb4ab' : isCalibrated ? '#00e5ff' : '#3b494c' }}>
            {bothExceed ? '⚡ BOTH EXCEEDED → E-STOP TRIGGERED' : isCalibrated ? '✓ Normal — No correlation spike' : '— Awaiting calibration'}
          </div>
        </div>
      </div>

      {/* Virtual Relay */}
      <VirtualRelay open={isEStop}/>

      {/* Mini charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={history} dataKey="spindle_current_a" color="#818cf8" label="Current (A)" height={120}/>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={history} dataKey="hydraulic_pressure_bar" color="#ff9259" label="Pressure (bar)" height={120}/>
        </div>
      </div>
    </div>
  );
}
