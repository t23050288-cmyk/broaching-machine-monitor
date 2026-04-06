import { useState } from 'react';
import { useSensorData } from '../hooks/useSensorData';
import GaugeCircle from '../components/GaugeCircle';
import LiveChart from '../components/LiveChart';
import StatusBadge from '../components/StatusBadge';
import ConnectionBanner from '../components/ConnectionBanner';
import { getSettings } from '../utils/storage';
import { Thermometer, Zap, Activity, Gauge, Wind, Volume2, FlaskConical, Wifi, Clock, RefreshCw, BarChart2 } from 'lucide-react';

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

function WearLifeCard({ wear, remainingPct, cyclesLeft, timeLeft, status }) {
  const pct = remainingPct ?? 100;
  const barColor = pct > 60 ? '#00e5ff' : pct > 30 ? '#ffba38' : '#ffb4ab';
  const statusLabel = status === 'new' ? 'HEALTHY' : status === 'worn' ? 'WORN' : 'CRITICAL';

  return (
    <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="text-[#ffba38]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Tool Life Predictor</span>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border
          ${status === 'new'    ? 'text-[#00e5ff] bg-[#00e5ff]/10 border-[#00e5ff]/20' :
            status === 'worn'   ? 'text-[#ffba38] bg-[#ffba38]/10 border-[#ffba38]/20' :
                                  'text-[#ffb4ab] bg-[#ffb4ab]/10 border-[#ffb4ab]/20 flash-alert'}`}>
          {statusLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[9px] text-[#849396] mb-1.5">
          <span>TOOL LIFE REMAINING</span>
          <span style={{ color: barColor }} className="font-bold">{pct.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-[#10141a] rounded-full overflow-hidden border border-[#3b494c]/20">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}99, ${barColor})` }}/>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#10141a] rounded-lg p-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1">Wear Index</div>
          <div className="text-xl font-black font-headline text-[#ffba38]">{wear?.toFixed(3) ?? '--'}</div>
          <div className="text-[9px] text-[#849396]">/ 1.5 max</div>
        </div>
        <div className="bg-[#10141a] rounded-lg p-3 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1">Cycles Left</div>
          <div className="text-xl font-black font-headline" style={{ color: barColor }}>
            {cyclesLeft !== undefined ? cyclesLeft.toLocaleString() : '--'}
          </div>
          <div className="text-[9px] text-[#849396]">approx</div>
        </div>
        <div className="bg-[#10141a] rounded-lg p-3 text-center border border-[#3b494c]/10">
          <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1 flex items-center justify-center gap-1">
            <Clock size={8}/> Est. Time
          </div>
          <div className="text-lg font-black font-headline" style={{ color: barColor }}>
            {timeLeft ?? '--'}
          </div>
          <div className="text-[9px] text-[#849396]">remaining</div>
        </div>
      </div>
    </div>
  );
}

function FFTCard({ domFreq }) {
  return (
    <div className="bg-[#181c22] rounded-xl p-4 border border-[#3b494c]/20 flex items-center gap-4">
      <BarChart2 size={18} className="text-[#818cf8] flex-shrink-0"/>
      <div>
        <div className="text-[9px] uppercase tracking-[0.2em] text-[#849396]">Dominant Vibration Freq (FFT)</div>
        <div className="text-2xl font-black font-headline text-[#818cf8] mt-0.5">
          {domFreq != null ? `${domFreq.toFixed(3)} Hz` : '—'}
        </div>
        <div className="text-[9px] text-[#849396] mt-0.5">
          {domFreq == null ? 'Collecting samples…' :
           domFreq < 0.05 ? 'Low freq — smooth cut' :
           domFreq < 0.15 ? 'Mid freq — normal wear signature' :
                            'High freq — check tool condition'}
        </div>
      </div>
    </div>
  );
}

const DEFAULT_SIM = { temperature_c: 65, vibration_rms_mm_s2: 3.5, spindle_current_a: 5.2 };

export default function Dashboard() {
  const { bridgeStatus, latest, chartData, activeAlerts, isFlashing, connect } = useSensorData();
  const s = getSettings();

  const [simMode, setSimMode] = useState(false);
  const [simTemp, setSimTemp] = useState('65');
  const [simVib,  setSimVib]  = useState('3.5');
  const [simCurr, setSimCurr] = useState('5.2');

  const r = simMode
    ? {
        ...latest,
        temperature_c:       parseFloat(simTemp) || 0,
        vibration_rms_mm_s2: parseFloat(simVib)  || 0,
        spindle_current_a:   parseFloat(simCurr) || 0,
        cutting_force_n:     Math.round((parseFloat(simCurr)||0)*240 + (parseFloat(simVib)||0)*15 + ((parseFloat(simTemp)||25)-25)*50),
        acoustic_emission_db: Math.round((parseFloat(simCurr)||0)*12  + (parseFloat(simVib)||0)*2.5 + 200),
        coolant_flow_lmin:   Math.round(18 + ((parseFloat(simTemp)||25)-25)*0.2),
        wear_progression:    Math.min(1.5, Math.max(0, ((parseFloat(simVib)||0)-0.5)/8.0*1.5)),
        remaining_life_pct:  Math.max(0, 100 - Math.min(1.5, Math.max(0, ((parseFloat(simVib)||0)-0.5)/8.0*1.5)) / 1.5 * 100),
        cycles_remaining:    Math.round(Math.max(0, 100 - Math.min(1.5, Math.max(0, ((parseFloat(simVib)||0)-0.5)/8.0*1.5)) / 1.5 * 100) * 50),
        estimated_time_left: '—',
        tool_status:         (parseFloat(simVib)||0)>8||(parseFloat(simTemp)||0)>88||(parseFloat(simCurr)||0)>44 ? 'failed'
                           : (parseFloat(simVib)||0)>5||(parseFloat(simTemp)||0)>82||(parseFloat(simCurr)||0)>41 ? 'worn' : 'new',
        timestamp: new Date().toISOString(),
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
          <button onClick={() => setSimMode(m => !m)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-bold transition-all
              ${simMode
                ? 'bg-[#ffba38]/10 border-[#ffba38]/40 text-[#ffba38] hover:bg-[#ffba38]/20'
                : 'bg-[#3b494c]/10 border-[#3b494c]/30 text-[#849396] hover:text-[#dfe2eb] hover:border-[#dfe2eb]/20'}`}>
            {simMode ? <><Wifi size={13}/> Back to Live</> : <><FlaskConical size={13}/> Simulate</>}
          </button>
        </div>
      </div>

      {/* Simulation panel */}
      {simMode && (
        <div className="bg-[#1a1a10] border border-[#ffba38]/30 rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#ffba38] mb-4 font-bold flex items-center gap-2">
            <FlaskConical size={12}/> Simulation Mode — enter test values
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[['Temperature (°C)', simTemp, setSimTemp, '#ff9259', '0', '150', '1', 'Normal: 20-40°C | High: 60-90°C'],
              ['Vibration (m/s²)', simVib,  setSimVib,  '#00e5ff', '0', '20',  '0.1', 'Normal: 0.5-3 | High: 5-10+'],
              ['Current (A)',      simCurr, setSimCurr, '#818cf8', '0', '60',  '0.1', 'Idle: 0-1A | Cutting: 5-45A'],
            ].map(([label, val, setter, color, min, max, step, hint]) => (
              <div key={label}>
                <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color }}>{label}</label>
                <input value={val} onChange={e => setter(e.target.value)} type="number" min={min} max={max} step={step}
                  className="w-full bg-[#10141a] rounded-lg px-3 py-2.5 text-sm font-mono text-[#dfe2eb] outline-none border focus:border-opacity-70 transition-colors"
                  style={{ borderColor: color + '40' }}/>
                <div className="text-[9px] text-[#849396] mt-1">{hint}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {[{label:'Idle',t:'27',v:'0.9',c:'0.1'},{label:'Light Cut',t:'45',v:'2.5',c:'8'},
              {label:'Normal',t:'65',v:'3.5',c:'18'},{label:'Heavy',t:'80',v:'6.0',c:'35'},{label:'Critical',t:'90',v:'9.0',c:'45'}
            ].map(p => (
              <button key={p.label} onClick={() => { setSimTemp(p.t); setSimVib(p.v); setSimCurr(p.c); }}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-[#10141a] border border-[#3b494c]/40 text-[#849396] hover:text-[#dfe2eb] hover:border-[#dfe2eb]/30 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gauges */}
      <div className="bg-[#181c22] rounded-xl p-6 flex justify-around flex-wrap gap-6">
        <GaugeCircle value={r?.temperature_c ?? 0}       max={100} unit="°C"    label="Temperature"    color={tempAlert ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={r?.vibration_rms_mm_s2 ?? 0} max={40}  unit="mm/s²" label="Vibration RMS"   color={vibAlert  ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={r?.spindle_current_a ?? 0}   max={50}  unit="A"     label="Spindle Current" color={currAlert ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={r?.wear_progression ?? 0}    max={1.5} unit="wear"  label="Wear Index"      color="#ffba38"/>
      </div>

      {/* ── Tool Life Predictor ── */}
      <WearLifeCard
        wear={r?.wear_progression}
        remainingPct={r?.remaining_life_pct}
        cyclesLeft={r?.cycles_remaining}
        timeLeft={r?.estimated_time_left}
        status={r?.tool_status}
      />

      {/* ── FFT Card ── */}
      <FFTCard domFreq={r?.dominant_freq_hz}/>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={Thermometer} label="Temperature"   value={r?.temperature_c?.toFixed(1) ?? '--'}       unit="°C"    color="#00daf3" alert={tempAlert}/>
        <MetricCard icon={Activity}    label="Vibration"     value={r?.vibration_rms_mm_s2?.toFixed(1) ?? '--'} unit="mm/s²" color="#00daf3" alert={vibAlert}/>
        <MetricCard icon={Zap}         label="Current"       value={r?.spindle_current_a?.toFixed(1) ?? '--'}   unit="A"     color="#00daf3" alert={currAlert}/>
        <MetricCard icon={Gauge}       label="Cutting Force" value={r?.cutting_force_n?.toFixed(0) ?? '--'}     unit="N"     color="#ffba38" alert={forceAlert}/>
        <MetricCard icon={Volume2}     label="Acoustic Emis" value={r?.acoustic_emission_db?.toFixed(1) ?? '--'} unit="dB"   color="#ffd799"/>
        <MetricCard icon={Wind}        label="Coolant Flow"  value={r?.coolant_flow_lmin?.toFixed(1) ?? '--'}   unit="L/min" color="#9cf0ff"/>
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
          <LiveChart data={chartData} dataKey="spindle_current_a"   color="#818cf8" label="Current A"       limit={s.currentLimit}/>
        </div>
      </div>
    </div>
  );
}
