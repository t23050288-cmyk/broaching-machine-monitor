import { useSimulation } from '../context/MachineContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Thermometer, Zap, Activity, Info } from 'lucide-react';

export default function OriginalSensor() {
  const { data, history } = useSimulation();

  // Show temperature, vibration, current — original 3 sensors
  // Current increases WITH vibration (real sensor behavior)
  const recent = history.slice(-60);

  const statCard = (label, value, unit, Icon, color, note) => (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} style={{ color }}/>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-4xl font-black mb-1" style={{ color }}>
        {value}<span className="text-base text-slate-500 ml-1">{unit}</span>
      </div>
      {note && <div className="text-[10px] text-slate-500 mt-2 leading-relaxed bg-slate-900/50 rounded-lg p-2 border border-slate-700/30">{note}</div>}
    </div>
  );

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1 text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-2">
            <Info size={10}/> Original Prototype Sensor Data
          </div>
          <h1 className="text-2xl font-black text-slate-100">Original 3-Sensor Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Temperature · Vibration · Motor Current — the sensors we first worked with
          </p>
        </div>
      </div>

      {/* Behaviour explainer */}
      <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Activity size={16} className="text-sky-400 mt-0.5 flex-shrink-0"/>
          <div>
            <div className="text-xs font-bold text-sky-400 mb-1">Key Sensor Relationship Discovered</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              During hardware testing, we found that <b className="text-amber-400">Motor Current (A) rises proportionally with Vibration (mm/s²)</b>.
              As vibration increases, current climbs (0.3A → 0.4A → 0.5A). When vibration drops,
              current drops too. This correlation revealed a problem: our current sensor was tripping
              off the moment we applied load — the Teflon (PTFE) shielding upgrade was the solution.
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCard(
          'Temperature', data ? data.temperature_c.toFixed(1) : '--', '°C', Thermometer, '#fb923c',
          'Spindle bearing temperature. Rises ~8°C under high vibration load due to increased friction.'
        )}
        {statCard(
          'Vibration RMS', data ? data.vibAvg.toFixed(4) : '--', 'mm/s²', Activity, '#38bdf8',
          'Average of V1-V6. The primary trigger for current increase — as vib rises, mechanical resistance rises, drawing more current.'
        )}
        {statCard(
          'Motor Current', data ? data.spindle_current_a.toFixed(4) : '--', 'A', Zap, '#34d399',
          'Directly coupled to vibration. At rest: ~0.10A. Under load with high vib: 0.30–0.50A. Sensor trips off at ≥0.5A without PTFE shielding.'
        )}
      </div>

      {/* Combined chart */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
          Live — Temperature, Vibration × 100, Current × 1000 mA
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={recent} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.4}/>
            <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#64748b' }} interval="preserveStartEnd"/>
            <YAxis tick={{ fontSize: 8, fill: '#64748b' }}/>
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 10 }}
              formatter={(val, name) => {
                if (name === 'temp') return [`${val.toFixed(1)} °C`, 'Temperature'];
                if (name === 'vib100') return [`${(val/100).toFixed(4)} mm/s²`, 'Vibration'];
                if (name === 'curr') return [`${val.toFixed(0)} mA`, 'Current'];
                return [val, name];
              }}/>
            <Legend formatter={v => v === 'temp' ? 'Temperature (°C)' : v === 'vib100' ? 'Vibration ×100' : 'Current (mA)'}/>
            <Line type="monotone" dataKey="T1" name="temp"   stroke="#fb923c" dot={false} strokeWidth={2} isAnimationActive={false}/>
            <Line type="monotone"
              dataKey={d => d.vibAvg * 100} name="vib100"
              stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false}/>
            <Line type="monotone"
              dataKey={d => d.spindle_current_a * 1000} name="curr"
              stroke="#34d399" dot={false} strokeWidth={2} isAnimationActive={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Side-by-side current vs vib */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity size={12} className="text-sky-400"/> Vibration (mm/s²)
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={recent}>
              <YAxis tick={{ fontSize: 8, fill: '#64748b' }} domain={[0.05, 0.15]}/>
              <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#64748b' }} hide/>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 10 }} formatter={v => [`${v.toFixed(4)} mm/s²`, 'Vibration']}/>
              <Line type="monotone" dataKey="vibAvg" stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Zap size={12} className="text-emerald-400"/> Motor Current (A) — follows vibration
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={recent}>
              <YAxis tick={{ fontSize: 8, fill: '#64748b' }} domain={[0.08, 0.55]}/>
              <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#64748b' }} hide/>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 10 }} formatter={v => [`${v.toFixed(4)} A`, 'Current']}/>
              <Line type="monotone" dataKey="spindle_current_a" stroke="#34d399" dot={false} strokeWidth={2} isAnimationActive={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Annotation table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Sensor Behavior Annotation</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                {['Condition','Temperature','Vibration','Current','Status'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-[9px] text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {[
                ['Idle / No Load',       '~30°C',   '~0.07 mm/s²',  '~0.10 A',  'Normal',   'text-emerald-400'],
                ['Light Cut',            '~34°C',   '~0.09 mm/s²',  '~0.25 A',  'Normal',   'text-emerald-400'],
                ['Heavy Cut',            '~40°C',   '~0.11 mm/s²',  '~0.38 A',  'Warning',  'text-amber-400'],
                ['Tool Wear Onset',      '~48°C',   '~0.13 mm/s²',  '~0.45 A',  'Warning',  'text-amber-400'],
                ['Chip Pack / Seizure',  '>55°C',   '>0.15 mm/s²',  '>0.50 A',  'ALARM',    'text-red-400'],
                ['PTFE Fault (Old HW)',  'Any',     'Decreasing',   'Trips off', 'FAULT',    'text-red-400'],
              ].map(([cond, temp, vib, curr, status, sc]) => (
                <tr key={cond} className="hover:bg-slate-700/20">
                  <td className="py-2 px-3 text-slate-300 font-medium">{cond}</td>
                  <td className="py-2 px-3 text-orange-400">{temp}</td>
                  <td className="py-2 px-3 text-sky-400">{vib}</td>
                  <td className="py-2 px-3 text-emerald-400">{curr}</td>
                  <td className={`py-2 px-3 font-bold ${sc}`}>{status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
