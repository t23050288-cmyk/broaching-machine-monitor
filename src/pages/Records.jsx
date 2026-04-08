import { useState } from 'react';
import { useSimulation } from '../context/MachineContext';
import { Download, Database } from 'lucide-react';

const COLS = [
  ['time','Time'], ['T1','Temp T1°C'], ['vibAvg','Vib Avg'], ['V1','V1'], ['V2','V2'], ['V3','V3'],
  ['L1','Load L1N'], ['L2','L2'], ['A1','Acoustic dB'],
  ['spindle_current_a','Current A'], ['hydraulic_pressure_bar','Pressure bar'],
  ['spindle_torque_nm','Torque N·m'], ['P2','Voltage V'], ['wear_progression','Wear Idx'],
  ['remaining_life_pct','RUL%'], ['tool_status','Status'],
];

function exportCSV(rows) {
  const header = COLS.map(c => c[1]).join(',');
  const body   = rows.map(r => COLS.map(([k]) => r[k] ?? '').join(',')).join('\n');
  const blob   = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = `zenith_18param_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function Records() {
  const { history } = useSimulation();
  const [search, setSearch] = useState('');

  const rows = history.filter(r =>
    !search || r.tool_status?.includes(search) || r.time?.includes(search)
  ).slice().reverse();

  return (
    <div className="p-6 space-y-4 min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-100">Data Records</h1>
          <p className="text-xs text-slate-500 mt-0.5">18-parameter CSV export · {history.length} records</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter…"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-sky-500/50 w-32"/>
          <button onClick={() => exportCSV(history)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/40 text-emerald-400 text-xs font-bold hover:bg-emerald-500/10 transition-all">
            <Download size={12}/> Export CSV (18 params)
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                {COLS.map(([k, l]) => (
                  <th key={k} className="text-left py-2.5 px-3 text-[9px] text-slate-500 uppercase tracking-wider whitespace-nowrap">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {rows.slice(0, 100).map((r, i) => (
                <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                  {COLS.map(([k]) => {
                    const v = r[k];
                    const isStatus = k === 'tool_status';
                    return (
                      <td key={k} className="py-2 px-3 whitespace-nowrap">
                        {isStatus ? (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full
                            ${v === 'new' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {v}
                          </span>
                        ) : (
                          <span className="text-slate-300">
                            {typeof v === 'number' ? v.toFixed(k.startsWith('L') ? 0 : 3) : v ?? '—'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="flex flex-col items-center py-12 text-slate-500">
            <Database size={28} className="mb-2 opacity-30"/>
            <div className="text-sm">Collecting data…</div>
          </div>
        )}
      </div>
    </div>
  );
}
