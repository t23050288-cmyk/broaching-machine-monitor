import { useSimulation } from '../context/MachineContext';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const GROUPS = [
  { key: 'vibration', label: 'Differential Vibration', color: '#38bdf8', sensors: [
    { id:'V1', label:'Axis X-Front' }, { id:'V2', label:'Axis X-Rear' },
    { id:'V3', label:'Axis Y-Left' }, { id:'V4', label:'Axis Y-Right' },
    { id:'V5', label:'Axis Z-Upper' }, { id:'V6', label:'Axis Z-Lower' },
  ]},
  { key: 'force', label: 'Force / Load', color: '#a78bfa', sensors: [
    { id:'L1', label:'Broach Entry' }, { id:'L2', label:'Mid-Stroke' },
    { id:'L3', label:'Exit Zone' },  { id:'L4', label:'Return Force' },
  ]},
  { key: 'thermal', label: 'Thermal', color: '#fb923c', sensors: [
    { id:'T1', label:'Spindle Bearing' }, { id:'T2', label:'Hydraulic Fluid' },
    { id:'T3', label:'Tool Interface' },  { id:'T4', label:'Ambient' },
  ]},
  { key: 'acoustic', label: 'Acoustic', color: '#f472b6', sensors: [
    { id:'A1', label:'Primary AE' }, { id:'A2', label:'Secondary AE' },
  ]},
  { key: 'process', label: 'Process', color: '#34d399', sensors: [
    { id:'P1', label:'Hyd. Pressure' }, { id:'P2', label:'Supply Voltage' },
  ]},
];

const UNITS = {
  V1:'mm/s²', V2:'mm/s²', V3:'mm/s²', V4:'mm/s²', V5:'mm/s²', V6:'mm/s²',
  L1:'N', L2:'N', L3:'N', L4:'N',
  T1:'°C', T2:'°C', T3:'°C', T4:'°C',
  A1:'dB', A2:'dB',
  P1:'bar', P2:'V',
};

const RANGES = {
  V1:[0,0.2], V2:[0,0.2], V3:[0,0.2], V4:[0,0.2], V5:[0,0.2], V6:[0,0.2],
  L1:[0,80],  L2:[0,80],  L3:[0,80],  L4:[0,80],
  T1:[20,90], T2:[20,90], T3:[20,90], T4:[20,90],
  A1:[195,225], A2:[195,225],
  P1:[18,28], P2:[4.8,5.1],
};

function MiniSparkline({ history, field, color }) {
  const pts = history.slice(-20).map((h, i) => ({ i, v: h[field] ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={pts} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SensorTile({ id, label, value, history, color }) {
  const unit = UNITS[id] || '';
  const [min, max] = RANGES[id] || [0, 100];
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const warn = pct > 75;

  return (
    <div className={`bg-slate-800/60 rounded-xl border p-3 transition-all
      ${warn ? 'border-amber-500/50' : 'border-slate-700/40'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[9px] font-black uppercase tracking-widest ${warn ? 'text-amber-400' : 'text-slate-500'}`}>{id}</span>
        <span className="text-[8px] text-slate-600">{label}</span>
      </div>
      <div className={`text-lg font-black mb-1 ${warn ? 'text-amber-400' : 'text-slate-100'}`}>
        {typeof value === 'number' ? value.toFixed(id.startsWith('L') ? 0 : 3) : '--'}
        <span className="text-[9px] text-slate-500 ml-1">{unit}</span>
      </div>
      <MiniSparkline history={history} field={id} color={warn ? '#f59e0b' : color}/>
      <div className="h-1 bg-slate-700 rounded-full mt-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: warn ? '#f59e0b' : color }}/>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, history } = useSimulation();

  return (
    <div className="p-6 space-y-6 min-h-screen">
      <div>
        <h1 className="text-2xl font-black text-slate-100">18-Sensor Telemetry</h1>
        <p className="text-xs text-slate-500 mt-0.5">Real-time fusion grid · Random Forest feature space</p>
      </div>

      {/* Key banner */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          ['Motor Current', data ? `${(data.spindle_current_a*1000).toFixed(0)} mA` : '--', '#38bdf8'],
          ['Hyd. Pressure', data ? `${data.hydraulic_pressure_bar.toFixed(1)} bar` : '--', '#a78bfa'],
          ['Spindle Torque', data ? `${data.spindle_torque_nm.toFixed(2)} N·m` : '--', '#f472b6'],
          ['Temperature',   data ? `${data.temperature_c.toFixed(1)} °C` : '--', '#fb923c'],
          ['Vib. Avg',      data ? `${data.vibAvg.toFixed(3)} mm/s²` : '--', '#34d399'],
          ['Tool RUL',      data ? `${data.remaining_life_pct.toFixed(0)}%` : '--', '#fbbf24'],
        ].map(([label, val, color]) => (
          <div key={label} className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-3 text-center">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
            <div className="text-lg font-black" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* 18-sensor groups */}
      {GROUPS.map(({ key, label, color, sensors }) => (
        <div key={key}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}/>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</span>
            <span className="text-[9px] text-slate-600">({sensors.length} sensors)</span>
          </div>
          <div className={`grid gap-3 ${sensors.length <= 2 ? 'grid-cols-2' : sensors.length === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
            {sensors.map(({ id, label: sLabel }) => (
              <SensorTile key={id} id={id} label={sLabel}
                value={data?.[id] ?? null} history={history} color={color}/>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
