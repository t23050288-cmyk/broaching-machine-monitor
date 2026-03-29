import { useState, useEffect } from 'react';
import { getReadings, exportToCSV, clearOldReadings } from '../utils/storage';
import StatusBadge from '../components/StatusBadge';
import { Download, Trash2, Database } from 'lucide-react';

const COLS = [
  ['timestamp','Time'],['tool_id','Tool'],['temperature_c','Temp °C'],
  ['vibration_rms_mm_s2','Vib mm/s²'],['spindle_current_a','Current A'],
  ['cutting_force_n','Force N'],['acoustic_emission_db','AE dB'],
  ['wear_progression','Wear'],['tool_status','Status']
];

export default function Records() {
  const [readings, setReadings] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const load = () => setReadings(getReadings().slice().reverse());
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const filtered = filter === 'all' ? readings : readings.filter(r => r.tool_status === filter);
  const storageSize = (JSON.stringify(readings).length / 1024).toFixed(1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Data Records</h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">
            {readings.length} readings · {storageSize} KB stored on this device
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="bg-[#1c2026] border border-[#3b494c]/30 text-[#dfe2eb] text-xs rounded-xl px-3 py-2">
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="worn">Worn</option>
            <option value="failed">Failed</option>
          </select>
          <button onClick={() => exportToCSV(filtered.length ? filtered : readings)}
            className="flex items-center gap-2 text-xs bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/20 px-3 py-2 rounded-xl transition-colors">
            <Download size={13}/> Export CSV
          </button>
          <button onClick={() => { clearOldReadings(); setReadings(getReadings().slice().reverse()); }}
            className="flex items-center gap-2 text-xs text-[#849396] hover:text-[#ffb4ab] border border-[#3b494c]/30 px-3 py-2 rounded-xl transition-colors">
            <Trash2 size={13}/> Clean Old
          </button>
        </div>
      </div>
      <div className="bg-[#181c22] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#3b494c]/15">
                {COLS.map(([k, label]) => (
                  <th key={k} className="text-left px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-[#849396] font-medium whitespace-nowrap">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((r, i) => (
                <tr key={i} className="border-b border-[#3b494c]/10 hover:bg-[#1c2026] transition-colors">
                  <td className="px-4 py-2 text-[#849396] whitespace-nowrap">{new Date(r.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2 text-[#dfe2eb]">{r.tool_id}</td>
                  <td className={`px-4 py-2 font-mono font-bold ${r.temperature_c > 85 ? 'text-[#ffb4ab]' : 'text-[#c3f5ff]'}`}>{r.temperature_c?.toFixed(1)}</td>
                  <td className={`px-4 py-2 font-mono font-bold ${r.vibration_rms_mm_s2 > 32 ? 'text-[#ffb4ab]' : 'text-[#c3f5ff]'}`}>{r.vibration_rms_mm_s2?.toFixed(2)}</td>
                  <td className={`px-4 py-2 font-mono font-bold ${r.spindle_current_a > 44 ? 'text-[#ffb4ab]' : 'text-[#c3f5ff]'}`}>{r.spindle_current_a?.toFixed(2)}</td>
                  <td className="px-4 py-2 font-mono text-[#ffd799]">{r.cutting_force_n?.toFixed(0)}</td>
                  <td className="px-4 py-2 font-mono text-[#9cf0ff]">{r.acoustic_emission_db?.toFixed(1)}</td>
                  <td className="px-4 py-2 font-mono text-[#ffba38]">{r.wear_progression?.toFixed(3)}</td>
                  <td className="px-4 py-2"><StatusBadge status={r.tool_status}/></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-[#849396]">
                  <Database size={24} className="mx-auto mb-2 opacity-30"/>
                  No records yet. Connect sensors to start recording.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-[10px] text-[#3b494c] text-center">
        Stored in browser localStorage on this device. Normal readings older than 24h auto-clean. Anomalies kept 7 days.
      </div>
    </div>
  );
}
