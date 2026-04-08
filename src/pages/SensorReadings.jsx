import { useState, useEffect } from 'react';
import { useSimulation } from '../context/MachineContext';
import { Table, Wifi } from 'lucide-react';

export default function SensorReadings() {
  const { data } = useSimulation();
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!data) return;
    setLog(prev => [{ ...data, logTime: new Date().toLocaleTimeString() }, ...prev].slice(0, 200));
  }, [data?.timestamp]);

  const groups = data ? [
    { name: 'Vibration', color: '#38bdf8', items: [
      ['V1', data.V1], ['V2', data.V2], ['V3', data.V3],
      ['V4', data.V4], ['V5', data.V5], ['V6', data.V6],
    ]},
    { name: 'Force/Load', color: '#a78bfa', items: [
      ['L1', data.L1], ['L2', data.L2], ['L3', data.L3], ['L4', data.L4],
    ]},
    { name: 'Thermal', color: '#fb923c', items: [
      ['T1', data.T1], ['T2', data.T2], ['T3', data.T3], ['T4', data.T4],
    ]},
    { name: 'Acoustic', color: '#f472b6', items: [
      ['A1', data.A1], ['A2', data.A2],
    ]},
    { name: 'Process', color: '#34d399', items: [
      ['P1 (Pressure)', data.P1], ['P2 (Voltage)', data.P2],
      ['Current', data.spindle_current_a], ['Torque', data.spindle_torque_nm],
    ]},
  ] : [];

  return (
    <div className="p-6 space-y-5 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-100">Sensor Readings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live 18-sensor snapshot · {log.length} records</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <Wifi size={12}/> Live
        </div>
      </div>

      {/* Live grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map(g => (
          <div key={g.name} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }}/>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{g.name}</span>
            </div>
            <div className="space-y-1.5">
              {g.items.map(([label, val]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">{label}</span>
                  <span className="text-xs font-bold" style={{ color: g.color }}>
                    {typeof val === 'number' ? val.toFixed(label.startsWith('L') ? 0 : 4) : '--'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Scroll log */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Table size={13} className="text-slate-400"/>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Timestamped Log</span>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-[10px]">
          {log.slice(0, 50).map((r, i) => (
            <div key={i} className="flex gap-3 py-1 border-b border-slate-700/20 text-slate-400">
              <span className="text-slate-600 w-20 flex-shrink-0">{r.logTime}</span>
              <span>T={r.T1?.toFixed(1)}°C</span>
              <span>V={r.vibAvg?.toFixed(4)}</span>
              <span>I={r.spindle_current_a?.toFixed(4)}A</span>
              <span>P={r.hydraulic_pressure_bar?.toFixed(2)}bar</span>
              <span>RUL={r.remaining_life_pct?.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
