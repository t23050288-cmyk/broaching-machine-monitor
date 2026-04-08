import { useState } from 'react';
import { useMachine } from '../context/MachineContext';
import { Shield, Cpu, Zap, ChevronRight } from 'lucide-react';

export default function InitModal() {
  const { initMachine } = useMachine();
  const [selected, setSelected] = useState(null);

  const profiles = [
    { id: 'legacy',    label: 'Legacy Machine',   sub: '20+ yrs — High mechanical play', threshold: '15%', color: 'amber',   Icon: Shield },
    { id: 'precision', label: 'Precision CNC',     sub: 'New / High-accuracy build',      threshold: '8%',  color: 'emerald', Icon: Cpu   },
    { id: 'broach',    label: 'Broaching Machine', sub: 'High-force linear cutting',      threshold: '10%', color: 'sky',     Icon: Zap   },
  ];

  const colorMap = {
    amber:   { border: 'border-amber-500/50',   bg: 'bg-amber-500/10',   text: 'text-amber-400'   },
    emerald: { border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    sky:     { border: 'border-sky-500/50',     bg: 'bg-sky-500/10',     text: 'text-sky-400'     },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Project Zenith — ADPS v3.0</span>
          </div>
          <h1 className="text-3xl font-black text-slate-100 tracking-tight">Active Damage Prevention System</h1>
          <p className="text-slate-400 text-sm mt-2">Select machine profile to initialize 18-sensor monitoring</p>
        </div>

        <div className="space-y-3">
          {profiles.map(({ id, label, sub, threshold, color, Icon }) => {
            const c = colorMap[color];
            const isSelected = selected === id;
            return (
              <button key={id} onClick={() => setSelected(id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all
                  ${isSelected ? `${c.border} ${c.bg}` : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? c.bg : 'bg-slate-700/50'}`}>
                    <Icon size={18} className={isSelected ? c.text : 'text-slate-400'}/>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 text-sm">{label}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border}`}>
                        {threshold} THRESHOLD
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={() => selected && initMachine(selected)} disabled={!selected}
          className={`w-full mt-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
            ${selected ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                       : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'}`}>
          Initialize System <ChevronRight size={16}/>
        </button>

        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>
          Industrial Hardening Active: Teflon (PTFE) Shielded Data Stream
        </div>
      </div>
    </div>
  );
}
