import { useState, useEffect, useRef } from 'react';
import { useMachine } from '../context/MachineContext';
import { useSimulation } from '../hooks/useSimulation';
import GaugeCircle from '../components/GaugeCircle';
import LiveChart from '../components/LiveChart';
import StatusBadge from '../components/StatusBadge';
import SystemStatusBar from '../components/SystemStatusBar';
import {
  Thermometer, Battery, Target, CheckCircle2, Zap,
  BarChart2, RefreshCw, Clock, FlaskConical, ShieldAlert
} from 'lucide-react';

// ── Calibrate Button ──────────────────────────────────────────
function CalibrateBtn({ onCalibrate, isCalibrated }) {
  const [done, setDone] = useState(false);
  const handle = () => {
    onCalibrate();
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };
  return (
    <button onClick={handle}
      className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl border font-bold transition-all
        ${done
          ? 'bg-[#00e5ff]/15 border-[#00e5ff]/40 text-[#00e5ff]'
          : 'bg-[#c084fc]/10 border-[#c084fc]/40 text-[#c084fc] hover:bg-[#c084fc]/20'}`}>
      {done ? <><CheckCircle2 size={13}/> Baseline Saved!</> : <><Target size={13}/> Calibrate Tool</>}
    </button>
  );
}

// ── Stress Test Button ────────────────────────────────────────
function StressTestBtn({ onTrigger, active }) {
  return (
    <button onClick={onTrigger} disabled={active}
      className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl border font-bold transition-all
        ${active
          ? 'bg-[#ffb4ab]/20 border-[#ffb4ab]/50 text-[#ffb4ab] animate-pulse cursor-not-allowed'
          : 'bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab] hover:bg-[#ffb4ab]/20'}`}>
      <FlaskConical size={13}/>
      {active ? 'Stress Test Running…' : 'Stress Test'}
    </button>
  );
}

// ── RUL Progress Bar ──────────────────────────────────────────
function RULBar({ rul }) {
  const color = rul > 60 ? '#00e5ff' : rul > 30 ? '#ffba38' : '#ffb4ab';
  return (
    <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="text-[#ffba38]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">RUL — Remaining Useful Life</span>
        </div>
        <span className="text-[9px] text-[#849396] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] inline-block animate-pulse"/>
          Calculating in real-time
        </span>
      </div>
      <div className="flex items-end gap-3 mb-3">
        <span className="text-4xl font-black font-headline" style={{ color }}>{rul.toFixed(1)}</span>
        <span className="text-[#849396] text-sm mb-1">%</span>
        <span className="text-[10px] text-[#849396] mb-2 ml-auto">
          ≈ {Math.round(rul * 50).toLocaleString()} cycles remaining
        </span>
      </div>
      <div className="h-4 bg-[#10141a] rounded-full overflow-hidden border border-[#3b494c]/20">
        <div className="h-full rounded-full transition-all duration-700 relative"
          style={{ width: `${rul}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}>
          <div className="absolute right-1 top-0 bottom-0 flex items-center">
            <span className="text-[8px] font-bold text-[#10141a]">{rul.toFixed(1)}%</span>
          </div>
        </div>
      </div>
      <div className="flex justify-between text-[9px] text-[#3b494c] mt-1.5">
        <span>0%</span>
        <span className="text-[#849396]">Target replace below 20%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// ── Fused Correlation Engine ──────────────────────────────────
function FusedEngine({ data, baseline, getDeviation, failureThreshold, isCalibrated }) {
  const { triggerEStop, triggerWarning, systemStatus } = useMachine();
  const prevBoth = useRef(false);
  const prevWarn = useRef(false);

  const currDev  = isCalibrated ? getDeviation('current',  data?.spindle_current_a       ?? 0) : 0;
  const pressDev = isCalibrated ? getDeviation('pressure',  data?.hydraulic_pressure_bar  ?? 0) : 0;
  const bothExceed = currDev > failureThreshold && pressDev > failureThreshold;
  const eitherWarn = (currDev > failureThreshold * 0.7 || pressDev > failureThreshold * 0.7) && !bothExceed;

  useEffect(() => {
    if (!isCalibrated) return;
    if (bothExceed && !prevBoth.current && systemStatus !== 'ESTOP') {
      triggerEStop('Critical Correlation Spike — Current & Pressure both exceeded threshold simultaneously. Chip Packing suspected. E-Stop deployed.');
    } else if (eitherWarn && !prevWarn.current && systemStatus === 'ARMED') {
      triggerWarning('Threshold approaching — one or more sensors near limit. Monitor closely.');
    }
    prevBoth.current = bothExceed;
    prevWarn.current = eitherWarn;
  }, [bothExceed, eitherWarn, isCalibrated, systemStatus]);

  const bars = [
    { label: 'Motor Current', dev: currDev,  color: '#818cf8', val: data?.spindle_current_a?.toFixed(4), unit: 'A' },
    { label: 'Hyd. Pressure', dev: pressDev, color: '#ff9259', val: data?.hydraulic_pressure_bar?.toFixed(2), unit: 'bar' },
  ];

  return (
    <div className={`rounded-xl p-5 border transition-all duration-500
      ${bothExceed ? 'bg-[#93000a]/20 border-[#ffb4ab]/40' : 'bg-[#181c22] border-[#3b494c]/20'}`}>
      <div className="flex items-center gap-2 mb-4">
        <Target size={14} className="text-[#c084fc]"/>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Fused Correlation Engine</span>
        {bothExceed && (
          <span className="ml-auto text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border text-[#ffb4ab] bg-[#93000a]/30 border-[#ffb4ab]/30 animate-pulse">
            ⚡ CORRELATION SPIKE
          </span>
        )}
        {!bothExceed && !isCalibrated && (
          <span className="ml-auto text-[9px] text-[#3b494c] uppercase">Calibrate to activate</span>
        )}
      </div>
      <div className="space-y-4">
        {bars.map(b => {
          const pct = Math.min(100, (b.dev / (failureThreshold * 2)) * 100);
          const exceeds = b.dev > failureThreshold;
          return (
            <div key={b.label}>
              <div className="flex justify-between text-[9px] mb-1.5">
                <span className="text-[#849396] uppercase tracking-wider">{b.label}</span>
                <span className="text-[#849396]">{b.val} {b.unit}</span>
                <span style={{ color: exceeds ? '#ffb4ab' : b.color }} className={`font-bold ml-2 ${exceeds ? 'animate-pulse' : ''}`}>
                  {isCalibrated ? `${(b.dev * 100).toFixed(1)}% dev${exceeds ? ' ⚠' : ''}` : '—'}
                </span>
              </div>
              <div className="h-3 bg-[#10141a] rounded-full overflow-hidden relative">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: isCalibrated ? `${pct}%` : '0%',
                    background: exceeds
                      ? 'linear-gradient(90deg,#ff4444,#ffb4ab)'
                      : `linear-gradient(90deg,${b.color}66,${b.color})`,
                    boxShadow: exceeds ? '0 0 10px #ff444466' : 'none',
                  }}/>
                {/* Threshold marker at 50% of bar = failureThreshold */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-[#ffba38]/60"
                  style={{ left: '50%' }}/>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[9px] text-[#3b494c] mt-3">
        Threshold: {(failureThreshold * 100).toFixed(0)}% · E-Stop fires when BOTH channels exceed simultaneously
      </div>
    </div>
  );
}

// ── E-Stop Overlay ────────────────────────────────────────────
function EStopOverlay({ active, onReset }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
      {/* Background flash */}
      <div className="absolute inset-0 bg-[#93000a]/40 animate-pulse"/>
      {/* Border flash */}
      <div className="absolute inset-0 border-8 border-[#ffb4ab]/80 animate-pulse rounded-none"/>
      {/* Card */}
      <div className="relative z-10 bg-[#0a0d12]/95 backdrop-blur-md border-2 border-[#ffb4ab]/60 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
        <div className="text-5xl mb-4">⚡</div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#ffb4ab] mb-2">Autonomous Shutdown</div>
        <h2 className="text-2xl font-black font-headline text-[#ffb4ab] mb-3">CHIP PACKING DETECTED</h2>
        <div className="text-sm text-[#849396] leading-relaxed mb-6">
          Combined Current & Pressure spike exceeded threshold simultaneously. 
          Virtual relay has opened. Power to spindle motor cut.
        </div>
        {/* Virtual Relay */}
        <div className="bg-[#181c22] rounded-xl p-4 mb-6 border border-[#ffb4ab]/20">
          <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-3">Virtual Relay Status</div>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full border-2 border-[#ffb4ab]/40 flex items-center justify-center mx-auto mb-1">
                <div className="w-4 h-4 rounded-full bg-[#ffb4ab]"/>
              </div>
              <div className="text-[9px] text-[#ffb4ab] font-bold">RELAY</div>
            </div>
            <div className="flex gap-1">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={`w-1 h-0.5 rounded ${i < 3 ? 'bg-[#ffb4ab]' : 'bg-[#3b494c]'}`}/>
              ))}
              <div className="w-2 h-3 -mt-1.5 border-r-2 border-[#ffb4ab] transform rotate-45"/>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="w-1 h-0.5 rounded bg-[#3b494c] ml-2"/>
              ))}
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full border-2 border-[#3b494c]/40 flex items-center justify-center mx-auto mb-1">
                <div className="w-4 h-4 rounded-full bg-[#3b494c]"/>
              </div>
              <div className="text-[9px] text-[#3b494c] font-bold">LOAD</div>
            </div>
          </div>
          <div className="text-[10px] text-[#ffb4ab] font-bold mt-2 uppercase tracking-wider">
            Circuit OPEN — Spindle Isolated
          </div>
        </div>
        <button onClick={onReset}
          className="w-full py-3 rounded-xl border border-[#ffb4ab]/40 text-[#ffb4ab] text-sm font-bold hover:bg-[#ffb4ab]/10 transition-colors">
          Reset System
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { systemStatus, failureThreshold, resetStatus } = useMachine();
  const sim = useSimulation();
  const { data, history, stressTest, baseline, rul, calibrate, triggerStressTest, getDeviation, isCalibrated } = sim;

  const isEStop   = systemStatus === 'ESTOP';
  const isWarning = systemStatus === 'WARNING';

  const tempAlert = data && data.temperature_c > 85;
  const voltAlert = data && data.supply_voltage_v < 4.8 && data.supply_voltage_v > 0;

  return (
    <div className={`p-6 space-y-5 min-h-screen transition-all duration-300
      ${isEStop   ? 'ring-4 ring-inset ring-[#ffb4ab]/60' : ''}
      ${isWarning ? 'ring-2 ring-inset ring-[#ffba38]/40' : ''}`}>

      <EStopOverlay active={isEStop} onReset={resetStatus}/>

      <SystemStatusBar/>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Health Pulse</h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">
            {data ? `Simulation active — ${new Date(data.timestamp).toLocaleTimeString()}` : 'Initializing…'}
            {data?.spike_active && <span className="ml-2 text-[#ffb4ab] font-bold animate-pulse">● STRESS TEST ACTIVE</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data && <StatusBadge status={data.tool_status}/>}
          <CalibrateBtn onCalibrate={calibrate} isCalibrated={isCalibrated}/>
          <StressTestBtn onTrigger={triggerStressTest} active={stressTest}/>
        </div>
      </div>

      {/* Gauges — temp, voltage, current, pressure */}
      <div className="bg-[#181c22] rounded-xl p-5 flex justify-around flex-wrap gap-4">
        <GaugeCircle value={data?.temperature_c         ?? 0} max={100} unit="°C"    label="Temperature"    color={tempAlert ? '#ffb4ab' : '#ff9259'}/>
        <GaugeCircle value={data?.supply_voltage_v       ?? 0} max={6}   unit="V"    label="Voltage"        color={voltAlert ? '#ffb4ab' : '#4ade80'}/>
        <GaugeCircle value={data?.spindle_current_a      ?? 0} max={0.3} unit="A"    label="Motor Current"  color={data?.spike_active ? '#ffb4ab' : '#818cf8'}/>
        <GaugeCircle value={data?.hydraulic_pressure_bar ?? 0} max={35}  unit="bar"  label="Hyd. Pressure"  color={data?.spike_active ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={data?.wear_progression       ?? 0} max={1.5} unit="wear" label="Wear Index"     color="#ffba38"/>
      </div>

      {/* RUL */}
      <RULBar rul={rul}/>

      {/* Fused Correlation Engine */}
      <FusedEngine
        data={data}
        baseline={baseline}
        getDeviation={getDeviation}
        failureThreshold={failureThreshold}
        isCalibrated={isCalibrated}
      />

      {/* Metric grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Temperature', data?.temperature_c?.toFixed(1) ?? '--', '°C', '#ff9259', Thermometer, tempAlert],
          ['Voltage',     data?.supply_voltage_v?.toFixed(3) ?? '--', 'V', '#4ade80', Battery, voltAlert],
          ['Current',     data?.spindle_current_a?.toFixed(4) ?? '--', 'A', '#818cf8', Zap, data?.spike_active],
          ['Hyd. Press',  data?.hydraulic_pressure_bar?.toFixed(2) ?? '--', 'bar', '#00daf3', BarChart2, data?.spike_active],
        ].map(([label, val, unit, color, Icon, alert]) => (
          <div key={label} className={`bg-[#1c2026] rounded-xl p-4 flex flex-col gap-2 border transition-all
            ${alert ? 'border-[#ffb4ab]/20' : 'border-transparent'}`}>
            <div className="flex items-center gap-2">
              <Icon size={14} style={{ color }}/>
              <span className="text-[9px] uppercase tracking-[0.15em] text-[#849396]">{label}</span>
              {alert && <span className="ml-auto text-[9px] text-[#ffb4ab] font-bold animate-pulse">!</span>}
            </div>
            <div className="text-2xl font-black font-headline text-[#c3f5ff]">
              {val}<span className="text-[#849396] text-xs ml-1">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={history} dataKey="spindle_current_a" color="#818cf8" label="Motor Current (A)" height={140}/>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={history} dataKey="hydraulic_pressure_bar" color="#00daf3" label="Hydraulic Pressure (bar)" height={140}/>
        </div>
      </div>
    </div>
  );
}
