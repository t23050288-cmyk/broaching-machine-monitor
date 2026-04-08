import { useState, useEffect, useRef } from 'react';
import { useSimulation, useMachine } from '../context/MachineContext';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { ShieldCheck, ShieldAlert, Zap, RotateCcw, SlidersHorizontal, Activity } from 'lucide-react';

function RelayBadge({ open }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border-2 p-8 transition-all duration-500
      ${open ? 'border-red-500/80 bg-red-500/10 animate-pulse' : 'border-emerald-500/50 bg-emerald-500/5'}`}>
      {open ? (
        <>
          <ShieldAlert size={56} className="text-red-400 mb-3"/>
          <div className="text-2xl font-black text-red-400 tracking-widest">MACHINE HALTED</div>
          <div className="text-xs text-red-300/70 mt-1 uppercase tracking-wider">Relay Open — Power Isolated</div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"/>
            <span className="text-[10px] text-red-300 uppercase tracking-widest">Correlation Alarm Active</span>
          </div>
        </>
      ) : (
        <>
          <ShieldCheck size={56} className="text-emerald-400 mb-3"/>
          <div className="text-2xl font-black text-emerald-400 tracking-widest">SYSTEM ARMED</div>
          <div className="text-xs text-emerald-300/70 mt-1 uppercase tracking-wider">Relay Closed — All Systems Nominal</div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"/>
            <span className="text-[10px] text-emerald-300 uppercase tracking-widest">Fused Correlation Engine Active</span>
          </div>
        </>
      )}
    </div>
  );
}

function CorrelationPlot({ history, threshold, baseline }) {
  const pts = history.slice(-60).map(h => ({
    x: parseFloat((h.spindle_current_a * 1000).toFixed(2)),
    y: parseFloat(h.hydraulic_pressure_bar),
  }));

  const blX = baseline ? baseline.current * 1000 : null;
  const blY = baseline ? baseline.pressure : null;

  const CustomDot = (props) => {
    const { cx, cy, payload, index } = props;
    const total = pts.length;
    const alpha = 0.2 + (index / total) * 0.8;
    const isLast = index === total - 1;
    return (
      <circle cx={cx} cy={cy} r={isLast ? 5 : 3}
        fill={isLast ? '#f87171' : '#34d399'} opacity={alpha} stroke="none"/>
    );
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={14} className="text-sky-400"/>
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Correlation Engine — Current vs Pressure</span>
        <span className="ml-auto text-[9px] text-slate-500">Last 60 samples</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.4}/>
          <XAxis dataKey="x" name="Current" unit="mA" tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'Current (mA)', fontSize: 9, fill: '#64748b', position: 'insideBottom', offset: -2 }}/>
          <YAxis dataKey="y" name="Pressure" unit="b" tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'Pressure (bar)', fontSize: 9, fill: '#64748b', angle: -90, position: 'insideLeft' }}/>
          <Tooltip cursor={false} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 10 }}
            formatter={(val, name) => [val, name]}/>
          {blX && <ReferenceLine x={blX * (1 + threshold)} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1}/>}
          {blX && <ReferenceLine x={blX * (1 - threshold)} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1}/>}
          {blY && <ReferenceLine y={blY * (1 + threshold)} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1}/>}
          {blY && <ReferenceLine y={blY * (1 - threshold)} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1}/>}
          <Scatter data={pts} shape={<CustomDot/>}/>
        </ScatterChart>
      </ResponsiveContainer>
      {!baseline && (
        <div className="text-center text-xs text-slate-500 mt-1">Calibrate to see threshold bands</div>
      )}
    </div>
  );
}

export default function DamagePrevention() {
  const { sim } = useMachine();
  const { data, history, baseline, threshold, relayOpen, alerts, calibrate, resetRelay, setThreshold, isCalibrated } = sim;

  const [localThr, setLocalThr] = useState(Math.round(threshold * 100));

  const currDev  = isCalibrated && data ? Math.abs((data.spindle_current_a       - baseline.current)  / baseline.current)  * 100 : 0;
  const pressDev = isCalibrated && data ? Math.abs((data.hydraulic_pressure_bar  - baseline.pressure) / baseline.pressure) * 100 : 0;
  const torqDev  = isCalibrated && data ? Math.abs((data.spindle_torque_nm       - baseline.torque)   / baseline.torque)   * 100 : 0;

  const thr = threshold * 100;

  const devCard = (label, val, unit, color) => {
    const exceed = val > thr;
    return (
      <div className={`rounded-xl border p-4 transition-all ${exceed ? 'border-red-500/60 bg-red-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
        <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">{label}</div>
        <div className={`text-2xl font-black ${exceed ? 'text-red-400' : 'text-emerald-400'}`}>
          {val.toFixed(1)}<span className="text-xs text-slate-500 ml-1">{unit}</span>
        </div>
        <div className={`text-[10px] mt-1 font-bold ${exceed ? 'text-red-400' : 'text-slate-500'}`}>
          {exceed ? `▲ EXCEEDS ${thr.toFixed(0)}% THRESHOLD` : `Within ${thr.toFixed(0)}% band`}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-5 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              Industrial Hardening Active: Teflon (PTFE) Shielded Data Stream
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Active Damage Prevention</h1>
          <p className="text-xs text-slate-500 mt-0.5">Supervised Random Forest · 10% Correlation Rule · 18-Parameter Fusion</p>
        </div>
        <div className="flex items-center gap-2">
          {relayOpen && (
            <button onClick={resetRelay}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-all">
              <RotateCcw size={13}/> Reset Relay
            </button>
          )}
          <button onClick={calibrate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sky-500/40 text-sky-400 text-xs font-bold hover:bg-sky-500/10 transition-all">
            <Zap size={13}/> {isCalibrated ? 'Re-Calibrate' : 'Set Baseline'}
          </button>
        </div>
      </div>

      {/* Relay Badge + Threshold Slider */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RelayBadge open={relayOpen}/>

        <div className="space-y-4">
          {/* Threshold Slider */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal size={14} className="text-amber-400"/>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Deviation Sensitivity</span>
              <span className="ml-auto text-amber-400 font-black text-lg">{localThr}%</span>
            </div>
            <input type="range" min="5" max="20" value={localThr}
              onChange={e => { const v = Number(e.target.value); setLocalThr(v); setThreshold(v / 100); }}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #f59e0b ${((localThr-5)/15)*100}%, #334155 0%)` }}/>
            <div className="flex justify-between text-[9px] text-slate-500 mt-2">
              <span>5% — Tight (Precision)</span>
              <span>20% — Loose (Legacy)</span>
            </div>
            <div className="mt-3 text-[10px] text-slate-400 leading-relaxed bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
              <b className="text-amber-400">Logic Gate:</b> Alarm fires only when ≥2 of{' '}
              <span className="text-sky-400">Motor Current</span>,{' '}
              <span className="text-violet-400">Hydraulic Pressure</span>, and{' '}
              <span className="text-rose-400">Spindle Torque</span>{' '}
              simultaneously exceed <b className="text-amber-400">{localThr}%</b> deviation.
            </div>
          </div>

          {/* Deviation meters */}
          <div className="grid grid-cols-3 gap-2">
            {devCard('Motor Current', currDev, '%Δ', 'sky')}
            {devCard('Hyd. Pressure', pressDev, '%Δ', 'violet')}
            {devCard('Spindle Torque', torqDev, '%Δ', 'rose')}
          </div>
        </div>
      </div>

      {/* Correlation Scatter */}
      <CorrelationPlot history={history} threshold={threshold} baseline={baseline}/>

      {/* Live Parameter Strip */}
      {data && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            ['Current',   `${(data.spindle_current_a*1000).toFixed(0)} mA`, data.spindle_current_a > 0.3 ? 'text-amber-400' : 'text-emerald-400'],
            ['Pressure',  `${data.hydraulic_pressure_bar.toFixed(1)} bar`,  pressDev > thr ? 'text-red-400' : 'text-emerald-400'],
            ['Torque',    `${data.spindle_torque_nm.toFixed(2)} N·m`,        torqDev > thr ? 'text-red-400' : 'text-emerald-400'],
            ['Temp',      `${data.temperature_c.toFixed(1)} °C`,             data.temperature_c > 60 ? 'text-amber-400' : 'text-emerald-400'],
            ['Vibration', `${data.vibAvg.toFixed(3)} mm/s²`,                 data.vibAvg > 0.1 ? 'text-amber-400' : 'text-emerald-400'],
            ['Wear Idx',  `${data.wear_progression.toFixed(2)}`,             data.wear_progression > 0.3 ? 'text-amber-400' : 'text-emerald-400'],
          ].map(([label, val, cls]) => (
            <div key={label} className="bg-slate-800/50 rounded-lg border border-slate-700/40 p-3">
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
              <div className={`text-sm font-black ${cls}`}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Alerts */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Intercept Log</span>
          <span className="text-[9px] text-slate-500">{alerts.length} events</span>
        </div>
        {alerts.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-500">No correlation spikes detected</div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.slice(0, 10).map(a => (
              <div key={a.id} className="flex items-start gap-3 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                <ShieldAlert size={12} className="text-red-400 mt-0.5 flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-red-400">{a.message}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">
                    Curr: <b className="text-sky-400">{a.currDev}%</b> ·
                    Press: <b className="text-violet-400">{a.pressDev}%</b> ·
                    Torq: <b className="text-rose-400">{a.torqDev}%</b>
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 flex-shrink-0">{new Date(a.ts).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
