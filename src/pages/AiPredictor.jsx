import { useState, useEffect } from 'react';
import { useSimulation } from '../context/MachineContext';
import { Brain, CheckCircle2, AlertOctagon, AlertTriangle, TrendingDown, Zap } from 'lucide-react';

function RFNode({ label, val, threshold, unit }) {
  const exceed = val > threshold;
  return (
    <div className={`rounded-lg border p-2.5 text-center transition-all ${exceed ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
      <div className="text-[8px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm font-black ${exceed ? 'text-red-400' : 'text-emerald-400'}`}>
        {typeof val === 'number' ? val.toFixed(3) : val}<span className="text-[8px] text-slate-500 ml-0.5">{unit}</span>
      </div>
      <div className={`text-[8px] mt-1 ${exceed ? 'text-red-400' : 'text-slate-600'}`}>
        {exceed ? '▲ FEATURE ACTIVE' : 'nominal'}
      </div>
    </div>
  );
}

export default function AiPredictor() {
  const { data, history } = useSimulation();
  const [prediction, setPrediction] = useState(null);

  // Random Forest inference (client-side decision tree simulation)
  useEffect(() => {
    if (!data) return;
    const {
      spindle_current_a: curr, hydraulic_pressure_bar: press,
      spindle_torque_nm: torq, vibAvg: vib, temperature_c: temp,
      wear_progression: wear, remaining_life_pct: rul,
    } = data;

    // 3 decision trees voting
    const tree1 = wear > 0.35 || curr > 0.30 ? 'worn' : 'healthy';
    const tree2 = vib  > 0.10 || temp > 45   ? 'worn' : 'healthy';
    const tree3 = rul  < 40   || press > 22  ? 'worn' : 'healthy';

    const votes = [tree1, tree2, tree3].filter(v => v === 'worn').length;
    const wornPct = Math.min(99, Math.round(wear * 250 + (curr - 0.10) * 80 + (vib - 0.07) * 300));

    let label, rec, icon, color;
    if (votes >= 2 || wornPct > 85) {
      label = `Tool ${wornPct}% Worn — Sharpening Required`;
      rec   = 'CRITICAL: Replace or regrind TB001. Continued operation risks workpiece damage and spindle overload.';
      icon  = 'alarm'; color = 'red';
    } else if (votes === 1 || wornPct > 50) {
      label = `Tool ${wornPct}% Worn — Monitor Closely`;
      rec   = 'WARNING: Schedule maintenance within 50 cycles. Increase inspection frequency. Consider light regrind.';
      icon  = 'warn'; color = 'amber';
    } else {
      label = `Tool ${wornPct}% Worn — Within Service Life`;
      rec   = 'HEALTHY: All parameters within normal operating range. No action required at this time.';
      icon  = 'ok'; color = 'emerald';
    }

    setPrediction({ label, rec, icon, color, votes, wornPct, wornPctNum: wornPct });
  }, [data]);

  const iconMap = {
    ok:    <CheckCircle2 size={32} className="text-emerald-400"/>,
    warn:  <AlertTriangle size={32} className="text-amber-400"/>,
    alarm: <AlertOctagon size={32} className="text-red-400"/>,
  };
  const bgMap   = { ok: 'border-emerald-500/30 bg-emerald-500/5', warn: 'border-amber-500/40 bg-amber-500/5', alarm: 'border-red-500/50 bg-red-500/10' };
  const txtMap  = { ok: 'text-emerald-400', warn: 'text-amber-400', alarm: 'text-red-400' };

  return (
    <div className="p-6 space-y-5 min-h-screen">
      <div>
        <h1 className="text-2xl font-black text-slate-100">AI Predictor</h1>
        <p className="text-xs text-slate-500 mt-0.5">Supervised Random Forest · 18-feature decision space · 3-tree ensemble</p>
      </div>

      {/* Main prediction card */}
      {prediction && (
        <div className={`rounded-xl border-2 p-6 transition-all ${bgMap[prediction.icon]}`}>
          <div className="flex items-start gap-4">
            {iconMap[prediction.icon]}
            <div className="flex-1">
              <div className={`text-xl font-black ${txtMap[prediction.icon]}`}>{prediction.label}</div>
              <div className="text-sm text-slate-400 mt-2 leading-relaxed">{prediction.rec}</div>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-black ${txtMap[prediction.icon]}`}>{prediction.wornPctNum}%</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Wear Score</div>
              <div className="text-[10px] text-slate-500 mt-1">{prediction.votes}/3 trees voting worn</div>
            </div>
          </div>
          <div className="mt-4 h-3 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${prediction.wornPctNum}%`, backgroundColor: prediction.icon === 'alarm' ? '#f87171' : prediction.icon === 'warn' ? '#f59e0b' : '#34d399' }}/>
          </div>
        </div>
      )}

      {/* RF Feature Space */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={14} className="text-violet-400"/>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Random Forest — 18 Feature Inputs</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {data && [
            ['Current', data.spindle_current_a, 0.30, 'A'],
            ['Pressure', data.hydraulic_pressure_bar, 22, 'bar'],
            ['Torque', data.spindle_torque_nm, 0.50, 'N·m'],
            ['Vib Avg', data.vibAvg, 0.10, 'mm/s²'],
            ['Temp', data.temperature_c, 50, '°C'],
            ['Wear Idx', data.wear_progression, 0.35, ''],
            ['V1', data.V1, 0.12, 'mm/s²'],
            ['V3', data.V3, 0.12, 'mm/s²'],
            ['L1', data.L1, 55, 'N'],
            ['L3', data.L3, 55, 'N'],
            ['T1', data.T1, 50, '°C'],
            ['T3', data.T3, 52, '°C'],
            ['A1', data.A1, 215, 'dB'],
            ['P1', data.P1, 22.5, 'bar'],
            ['RUL', data.remaining_life_pct, 30, '%'],
            ['Acoustic', data.A2, 214, 'dB'],
            ['V5', data.V5, 0.12, 'mm/s²'],
            ['L2', data.L2, 55, 'N'],
          ].map(([label, val, thr, unit]) => (
            <RFNode key={label} label={label} val={val} threshold={thr} unit={unit}/>
          ))}
        </div>
      </div>

      {/* Trend */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown size={13} className="text-rose-400"/>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Wear Progression Timeline</span>
        </div>
        <div className="space-y-2">
          {[
            ['Now',       data?.wear_progression ?? 0],
            ['+10 min',   Math.min(1.5, (data?.wear_progression ?? 0) + 0.02)],
            ['+30 min',   Math.min(1.5, (data?.wear_progression ?? 0) + 0.08)],
            ['+1 hour',   Math.min(1.5, (data?.wear_progression ?? 0) + 0.20)],
          ].map(([label, val]) => {
            const pct = Math.min(100, (val / 1.5) * 100);
            const c = pct > 70 ? '#f87171' : pct > 40 ? '#f59e0b' : '#34d399';
            return (
              <div key={label} className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500 w-16">{label}</span>
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c }}/>
                </div>
                <span className="text-[10px] font-bold w-12 text-right" style={{ color: c }}>{val.toFixed(3)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
