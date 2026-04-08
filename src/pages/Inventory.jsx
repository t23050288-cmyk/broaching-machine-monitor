import { useState, useEffect } from 'react';
import { useSimulation } from '../context/MachineContext';
import { Package, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const TOOLS = [
  { id: 'TB001', material: 'Carbide',    coating: 'TiN',   maxCycles: 2000, maxHours: 50, installed: '2026-04-01' },
  { id: 'TB002', material: 'Coated HSS', coating: 'None',  maxCycles: 1800, maxHours: 45, installed: '2026-03-28' },
  { id: 'TB003', material: 'Carbide',    coating: 'TiAlN', maxCycles: 2500, maxHours: 65, installed: '2026-04-05' },
  { id: 'TB004', material: 'CBN',        coating: 'DLC',   maxCycles: 3000, maxHours: 80, installed: '2026-04-06' },
];

export default function Inventory() {
  const { data } = useSimulation();
  const [cycles, setCycles] = useState({ TB001: 420, TB002: 1650, TB003: 80, TB004: 15 });

  useEffect(() => {
    const id = setInterval(() => {
      setCycles(prev => ({ ...prev, TB001: Math.min(prev.TB001 + 0.05, 2000) }));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const rulPct = (tool) => {
    const pct = Math.max(0, 100 - (cycles[tool.id] / tool.maxCycles) * 100);
    return parseFloat(pct.toFixed(1));
  };

  const rulColor = pct => pct > 50 ? 'text-emerald-400' : pct > 20 ? 'text-amber-400' : 'text-red-400';
  const rulBarColor = pct => pct > 50 ? '#34d399' : pct > 20 ? '#f59e0b' : '#f87171';
  const recommendation = pct => pct < 10 ? '⚠ Replace Immediately' : pct < 25 ? '🔧 Sharpening Required' : pct < 50 ? '📋 Schedule Maintenance' : '✅ Within Service Life';

  return (
    <div className="p-6 space-y-5 min-h-screen">
      <div>
        <h1 className="text-2xl font-black text-slate-100">Tool Inventory & RUL</h1>
        <p className="text-xs text-slate-500 mt-0.5">Remaining Useful Life tracker · Cycle-based degradation model</p>
      </div>

      {/* Active tool highlight */}
      {data && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Package size={20} className="text-emerald-400"/>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Currently Active</div>
            <div className="font-black text-slate-100">TB001 — Carbide / TiN</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Wear Index: <span className="text-amber-400 font-bold">{data.wear_progression.toFixed(3)}</span> ·
              Cycles: <span className="text-sky-400 font-bold">{Math.round(cycles.TB001)}</span> ·
              RUL: <span className={rulColor(rulPct(TOOLS[0]))}>{rulPct(TOOLS[0])}%</span>
            </div>
          </div>
          <div className="ml-auto text-sm font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">
            {recommendation(rulPct(TOOLS[0]))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TOOLS.map(tool => {
          const pct = rulPct(tool);
          const cyc = Math.round(cycles[tool.id] || 0);
          const rec = recommendation(pct);
          const isAlarm = pct < 10;
          const isWarn  = pct < 25 && pct >= 10;

          return (
            <div key={tool.id}
              className={`bg-slate-800/50 rounded-xl border p-5 transition-all
                ${isAlarm ? 'border-red-500/50' : isWarn ? 'border-amber-500/40' : 'border-slate-700/40'}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    {isAlarm ? <AlertTriangle size={14} className="text-red-400"/> :
                     isWarn  ? <AlertTriangle size={14} className="text-amber-400"/> :
                               <CheckCircle  size={14} className="text-emerald-400"/>}
                    <span className="font-black text-slate-100 text-sm">{tool.id}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{tool.material} · {tool.coating} coating</div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-black ${rulColor(pct)}`}>{pct.toFixed(0)}%</div>
                  <div className="text-[9px] text-slate-500">RUL</div>
                </div>
              </div>

              {/* RUL bar */}
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-3">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${pct}%`, backgroundColor: rulBarColor(pct) }}/>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  ['Cycles Used', `${cyc}/${tool.maxCycles}`],
                  ['Hours Used',  `${(cyc/40).toFixed(0)}/${tool.maxHours}h`],
                  ['Installed',   tool.installed],
                ].map(([l, v]) => (
                  <div key={l} className="bg-slate-900/50 rounded-lg p-2">
                    <div className="text-[8px] text-slate-600 uppercase tracking-wider">{l}</div>
                    <div className="text-[10px] font-bold text-slate-300 mt-0.5">{v}</div>
                  </div>
                ))}
              </div>

              <div className={`text-[10px] font-bold py-1.5 px-3 rounded-lg text-center
                ${isAlarm ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                  isWarn  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                {rec}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
