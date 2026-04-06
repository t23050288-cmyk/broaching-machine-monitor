import { useState } from 'react';
import { useSensorData } from '../hooks/useSensorData';
import GaugeCircle from '../components/GaugeCircle';
import LiveChart from '../components/LiveChart';
import StatusBadge from '../components/StatusBadge';
import ConnectionBanner from '../components/ConnectionBanner';
import { getSettings } from '../utils/storage';
import { Thermometer, Zap, Activity, Gauge, Wind, Volume2, FlaskConical, Wifi } from 'lucide-react';

function MetricCard({ icon: Icon, label, value, unit, color = '#00daf3', alert }) {
  return (
    <div className={`bg-[#1c2026] rounded-xl p-4 flex flex-col gap-2 ${alert ? 'glow-red' : 'glow-cyan'} transition-all`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color }}/>
          <span className="text-[9px] uppercase tracking-[0.15em] text-[#849396]">{label}</span>
        </div>
        {alert && <span className="text-[9px] text-[#ffb4ab] flash-alert uppercase tracking-widest font-bold">HIGH</span>}
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-2xl font-black font-headline ${alert ? 'text-[#ffb4ab]' : 'text-[#c3f5ff]'}`}>{value}</span>
        <span className="text-[#849396] text-xs mb-1">{unit}</span>
      </div>
    </div>
  );
}

const DEFAULT_SIM = { temperature_c: 65, vibration_rms_mm_s2: 3.5, spindle_current_a: 5.2 };

export default function Dashboard() {
  const { bridgeStatus, latest, chartData, activeAlerts, isFlashing, connect } = useSensorData();
  const s = getSettings();

  // Simulate mode
  const [simMode, setSimMode] = useState(false);
  const [simTemp, setSimTemp] = useState('65');
  const [simVib,  setSimVib]  = useState('3.5');
  const [simCurr, setSimCurr] = useState('5.2');

  // Use real or simulated data
  const r = simMode
    ? {
        ...latest,
        temperature_c:       parseFloat(simTemp) || 0,
        vibration_rms_mm_s2: parseFloat(simVib)  || 0,
        spindle_current_a:   parseFloat(simCurr) || 0,
        // derive simple physics for other fields
        cutting_force_n:     Math.round((parseFloat(simCurr)||0)*240 + (parseFloat(simVib)||0)*15 + ((parseFloat(simTemp)||25)-25)*50),
        acoustic_emission_db: Math.round((parseFloat(simCurr)||0)*12  + (parseFloat(simVib)||0)*2.5 + 200),
        coolant_flow_lmin:   Math.round(18 + ((parseFloat(simTemp)||25)-25)*0.2),
        wear_progression:    Math.min(1.5, Math.max(0, ((parseFloat(simVib)||0)-0.5)/8.0*1.5)),
        tool_status:         (parseFloat(simVib)||0)>8||(parseFloat(simTemp)||0)>88||(parseFloat(simCurr)||0)>44 ? 'failed'
                           : (parseFloat(simVib)||0)>5||(parseFloat(simTemp)||0)>82||(parseFloat(simCurr)||0)>41 ? 'worn' : 'new',
        timestamp:           new Date().toISOString(),
      }
    : latest;

  const tempAlert  = r && r.temperature_c        > s.tempLimit;
  const vibAlert   = r && r.vibration_rms_mm_s2  > s.vibLimit;
  const currAlert  = r && r.spindle_current_a    > s.currentLimit;
  const forceAlert = r && r.cutting_force_n      > s.forceLimit;

  return (
    <div className={`p-6 space-y-6 ${isFlashing && !simMode ? 'ring-2 ring-[#ffb4ab] ring-inset' : ''} transition-all`}>
      {isFlashing && !simMode && (
        <div className="fixed inset-0 pointer-events-none z-50 flash-alert"
          style={{ background: 'radial-gradient(circle, rgba(255,180,171,0.08) 0%, transparent 70%)' }}/>
      )}

      <ConnectionBanner status={bridgeStatus} onConnect={connect}/>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Health Pulse</h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">
            {simMode ? '🧪 Simulation Mode — values are manual'
              : r ? `Last update: ${new Date(r.timestamp).toLocaleTimeString()}` : 'Waiting for sensor data…'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {r && !simMode && <StatusBadge status={r.tool_status}/>}
          {/* Simulate toggle */}
          <button onClick={() => setSimMode(m => !m)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-bold transition-all
              ${simMode
                ? 'bg-[#ffba38]/10 border-[#ffba38]/40 text-[#ffba38] hover:bg-[#ffba38]/20'
                : 'bg-[#3b494c]/10 border-[#3b494c]/30 text-[#849396] hover:text-[#dfe2eb] hover:border-[#dfe2eb]/20'}`}>
            {simMode ? <><Wifi size={13}/> Back to Live</> : <><FlaskConical size={13}/> Simulate</>}
          </button>
        </div>
      </div>

      {/* Simulation input panel */}
      {simMode && (
        <div className="bg-[#1a1a10] border border-[#ffba38]/30 rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#ffba38] mb-4 font-bold flex items-center gap-2">
            <FlaskConical size={12}/> Simulation Mode — enter test values
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#ff9259] mb-1.5">Temperature (°C)</label>
              <input value={simTemp} onChange={e => setSimTemp(e.target.value)} type="number" min="0" max="150"
                className="w-full bg-[#10141a] border border-[#ff9259]/40 rounded-lg px-3 py-2.5 text-sm font-mono text-[#dfe2eb] outline-none focus:border-[#ff9259]/70"/>
              <div className="text-[9px] text-[#849396] mt-1">Normal: 20-40°C | High: 60-90°C</div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#00e5ff] mb-1.5">Vibration (m/s²)</label>
              <input value={simVib} onChange={e => setSimVib(e.target.value)} type="number" min="0" max="20" step="0.1"
                className="w-full bg-[#10141a] border border-[#00e5ff]/40 rounded-lg px-3 py-2.5 text-sm font-mono text-[#dfe2eb] outline-none focus:border-[#00e5ff]/70"/>
              <div className="text-[9px] text-[#849396] mt-1">Normal: 0.5-3 | High: 5-10+</div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#818cf8] mb-1.5">Current (A)</label>
              <input value={simCurr} onChange={e => setSimCurr(e.target.value)} type="number" min="0" max="60" step="0.1"
                className="w-full bg-[#10141a] border border-[#818cf8]/40 rounded-lg px-3 py-2.5 text-sm font-mono text-[#dfe2eb] outline-none focus:border-[#818cf8]/70"/>
              <div className="text-[9px] text-[#849396] mt-1">Idle: 0-1A | Cutting: 5-45A</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            {[{label:'Idle',    t:'27', v:'0.9',  c:'0.1'},
              {label:'Light Cut',t:'45', v:'2.5', c:'8'},
              {label:'Normal',  t:'65', v:'3.5',  c:'18'},
              {label:'Heavy',   t:'80', v:'6.0',  c:'35'},
              {label:'Critical',t:'90', v:'9.0',  c:'45'},
            ].map(p => (
              <button key={p.label}
                onClick={() => { setSimTemp(p.t); setSimVib(p.v); setSimCurr(p.c); }}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-[#10141a] border border-[#3b494c]/40 text-[#849396] hover:text-[#dfe2eb] hover:border-[#dfe2eb]/30 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gauges */}
      <div className="bg-[#181c22] rounded-xl p-6 flex justify-around flex-wrap gap-6">
        <GaugeCircle value={r?.temperature_c ?? 0}       max={100}  unit="°C"    label="Temperature"    color={tempAlert ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={r?.vibration_rms_mm_s2 ?? 0} max={40}   unit="mm/s²" label="Vibration RMS"   color={vibAlert  ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={r?.spindle_current_a ?? 0}   max={50}   unit="A"      label="Spindle Current" color={currAlert ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={r?.wear_progression ?? 0}    max={1.5}  unit="wear"   label="Wear Index"      color="#ffba38"/>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={Thermometer} label="Temperature"   value={r?.temperature_c?.toFixed(1) ?? '--'}        unit="°C"    color="#00daf3" alert={tempAlert}/>
        <MetricCard icon={Activity}    label="Vibration"     value={r?.vibration_rms_mm_s2?.toFixed(1) ?? '--'}  unit="mm/s²" color="#00daf3" alert={vibAlert}/>
        <MetricCard icon={Zap}         label="Current"       value={r?.spindle_current_a?.toFixed(1) ?? '--'}    unit="A"     color="#00daf3" alert={currAlert}/>
        <MetricCard icon={Gauge}       label="Cutting Force" value={r?.cutting_force_n?.toFixed(0) ?? '--'}       unit="N"     color="#ffba38" alert={forceAlert}/>
        <MetricCard icon={Volume2}     label="Acoustic Emis" value={r?.acoustic_emission_db?.toFixed(1) ?? '--'}  unit="dB"    color="#ffd799"/>
        <MetricCard icon={Wind}        label="Coolant Flow"  value={r?.coolant_flow_lmin?.toFixed(1) ?? '--'}    unit="L/min" color="#9cf0ff"/>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={chartData} dataKey="temperature_c"       color="#00daf3" label="Temperature °C"  limit={s.tempLimit}/>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={chartData} dataKey="vibration_rms_mm_s2" color="#ffba38" label="Vibration mm/s²" limit={s.vibLimit}/>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={chartData} dataKey="spindle_current_a"   color="#9cf0ff" label="Current A"       limit={s.currentLimit}/>
        </div>
      </div>

      {/* Alerts */}
      {activeAlerts.length > 0 && !simMode && (
        <div className="bg-[#93000a]/20 border border-[#ffb4ab]/20 rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#ffb4ab] mb-3 font-bold">⚠ Active Alerts</div>
          <div className="space-y-1.5">
            {activeAlerts.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.type === 'error' ? 'bg-[#ffb4ab]' : 'bg-[#ffba38]'}`}/>
                <span className="text-[#dfe2eb]">{a.param}</span>
                <span className="text-[#ffb4ab] font-bold">{a.value?.toFixed?.(1) ?? a.value} {a.unit}</span>
                <span className="text-[#849396]">limit: {a.limit} {a.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom info */}
      {r && (
        <div className="bg-[#1c2026] rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {[['Tool ID', r.tool_id], ['Material', r.tool_material], ['Coating', r.coating], ['Workpiece', r.workpiece_material],
            ['Speed', `${r.spindle_speed_mmin} m/min`], ['Feed Rate', `${r.feed_rate_mmtooth} mm/tooth`],
            ['Surface Finish', `${r.surface_finish_ra_um} Ra μm`], ['Wear', r.wear_progression?.toFixed(3)],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[9px] uppercase tracking-[0.15em] text-[#849396] mb-0.5">{k}</div>
              <div className="text-[#dfe2eb] font-medium">{v ?? '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
