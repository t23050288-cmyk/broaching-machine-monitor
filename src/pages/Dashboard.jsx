import { useState, useEffect, useRef } from 'react';
import { useMachine, useSimulation } from '../context/MachineContext';
import GaugeCircle from '../components/GaugeCircle';
import LiveChart from '../components/LiveChart';
import StatusBadge from '../components/StatusBadge';
import SystemStatusBar from '../components/SystemStatusBar';
import {
  Thermometer, Battery, Target, CheckCircle2, Zap,
  BarChart2, RefreshCw, Clock, FlaskConical
} from 'lucide-react';

function CalibrateBtn({ onCalibrate }) {
  const [flash, setFlash] = useState(false);
  return (
    <button onClick={() => { onCalibrate(); setFlash(true); setTimeout(() => setFlash(false), 2500); }}
      className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl border font-bold transition-all
        ${flash ? 'bg-[#00e5ff]/15 border-[#00e5ff]/40 text-[#00e5ff]' : 'bg-[#c084fc]/10 border-[#c084fc]/40 text-[#c084fc] hover:bg-[#c084fc]/20'}`}>
      {flash ? <><CheckCircle2 size={13}/> Baseline Saved!</> : <><Target size={13}/> Calibrate Tool</>}
    </button>
  );
}

function StressBtn({ onTrigger, active }) {
  return (
    <button onClick={onTrigger} disabled={active}
      className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl border font-bold transition-all
        ${active ? 'bg-[#ffb4ab]/20 border-[#ffb4ab]/50 text-[#ffb4ab] animate-pulse cursor-not-allowed'
                 : 'bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab] hover:bg-[#ffb4ab]/20'}`}>
      <FlaskConical size={13}/>{active ? 'Stress Test Running…' : 'Stress Test'}
    </button>
  );
}

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
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] inline-block animate-pulse"/> Calculating real-time
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
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${rul}%`, background: `linear-gradient(90deg,${color}88,${color})` }}/>
      </div>
      <div className="flex justify-between text-[9px] text-[#3b494c] mt-1.5">
        <span>CRITICAL 0%</span>
        <span className="text-[#849396]">Replace below 20%</span>
        <span>HEALTHY 100%</span>
      </div>
    </div>
  );
}

function EStopOverlay({ active, onReset }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[#93000a]/50 animate-pulse pointer-events-none"/>
      <div className="absolute inset-0 border-8 border-[#ffb4ab]/80 animate-pulse pointer-events-none"/>
      <div className="relative z-10 bg-[#0a0d12]/95 backdrop-blur-md border-2 border-[#ffb4ab]/60 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
        <div className="text-5xl mb-4">🛑</div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#ffb4ab] mb-2">Autonomous Shutdown</div>
        <h2 className="text-2xl font-black font-headline text-[#ffb4ab] mb-3">CHIP PACKING DETECTED</h2>
        <p className="text-sm text-[#849396] leading-relaxed mb-5">
          Current &amp; Pressure both spiked beyond threshold simultaneously.
          Virtual relay opened — spindle power isolated.
        </p>
        <div className="bg-[#181c22] rounded-xl p-4 border border-[#ffb4ab]/20 mb-5 text-left">
          <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-2">Relay Status</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ffb4ab] animate-pulse"/>
            <span className="text-[#ffb4ab] text-xs font-bold">OPEN — Spindle Isolated</span>
          </div>
          <div className="text-[10px] text-[#ffba38] mt-2">Action: Clear chips · Inspect tool edge · Regrind if worn</div>
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
  const { data, history, stressTest, calibrate, triggerStressTest, getDeviation, isCalibrated, rul } = useSimulation();

  const prevBoth = useRef(false);
  const { triggerEStop, triggerWarning } = useMachine();

  const currDev  = isCalibrated && data ? getDeviation('current',  data.spindle_current_a)       : 0;
  const pressDev = isCalibrated && data ? getDeviation('pressure',  data.hydraulic_pressure_bar)  : 0;
  const bothExceed = currDev > failureThreshold && pressDev > failureThreshold;

  useEffect(() => {
    if (!isCalibrated) return;
    if (bothExceed && !prevBoth.current && systemStatus !== 'ESTOP') {
      triggerEStop('Critical Correlation Spike — Current & Pressure both exceeded threshold. Chip Packing suspected. E-Stop deployed.');
    } else if (!bothExceed && (currDev > failureThreshold * 0.7 || pressDev > failureThreshold * 0.7) && systemStatus === 'ARMED') {
      // only warn once per event
    }
    prevBoth.current = bothExceed;
  }, [bothExceed, isCalibrated, systemStatus]);

  const isEStop   = systemStatus === 'ESTOP';
  const isWarning = systemStatus === 'WARNING';

  return (
    <div className={`p-6 space-y-5 min-h-screen
      ${isEStop   ? 'ring-4 ring-inset ring-[#ffb4ab]/60' : ''}
      ${isWarning ? 'ring-2 ring-inset ring-[#ffba38]/40' : ''}`}>

      <EStopOverlay active={isEStop} onReset={resetStatus}/>
      <SystemStatusBar/>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Health Pulse</h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">
            {data ? `Simulation active · ${new Date(data.timestamp).toLocaleTimeString()}` : 'Initializing…'}
            {data?.spike_active && <span className="ml-2 text-[#ffb4ab] font-bold animate-pulse">● STRESS TEST ACTIVE</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data && <StatusBadge status={data.tool_status}/>}
          <CalibrateBtn onCalibrate={calibrate}/>
          <StressBtn onTrigger={triggerStressTest} active={stressTest}/>
        </div>
      </div>

      {/* 5 gauges */}
      <div className="bg-[#181c22] rounded-xl p-5 flex justify-around flex-wrap gap-4">
        <GaugeCircle value={data?.temperature_c         ?? 0} max={100} unit="°C"   label="Temperature"    color={data?.temperature_c > 85 ? '#ffb4ab' : '#ff9259'}/>
        <GaugeCircle value={data?.supply_voltage_v       ?? 0} max={6}   unit="V"   label="Voltage"        color="#4ade80"/>
        <GaugeCircle value={data?.spindle_current_a      ?? 0} max={0.3} unit="A"   label="Motor Current"  color={data?.spike_active ? '#ffb4ab' : '#818cf8'}/>
        <GaugeCircle value={data?.hydraulic_pressure_bar ?? 0} max={35}  unit="bar" label="Hyd. Pressure"  color={data?.spike_active ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={data?.wear_progression       ?? 0} max={1.5} unit="idx" label="Wear Index"     color="#ffba38"/>
      </div>

      <RULBar rul={rul}/>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Temperature', data?.temperature_c?.toFixed(1)         ?? '--', '°C',   '#ff9259', Thermometer],
          ['Voltage',     data?.supply_voltage_v?.toFixed(3)       ?? '--', 'V',    '#4ade80', Battery],
          ['Current',     data?.spindle_current_a?.toFixed(4)      ?? '--', 'A',    '#818cf8', Zap],
          ['Hyd. Press',  data?.hydraulic_pressure_bar?.toFixed(2) ?? '--', 'bar',  '#00daf3', BarChart2],
        ].map(([label, val, unit, color, Icon]) => (
          <div key={label} className="bg-[#1c2026] rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Icon size={14} style={{ color }}/>
              <span className="text-[9px] uppercase tracking-[0.15em] text-[#849396]">{label}</span>
              {data?.spike_active && (label === 'Current' || label === 'Hyd. Press') && (
                <span className="ml-auto text-[9px] text-[#ffb4ab] font-bold animate-pulse">↑</span>
              )}
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
          <LiveChart data={history} dataKey="spindle_current_a"      color="#818cf8" label="Motor Current (A)"       height={130}/>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={history} dataKey="hydraulic_pressure_bar" color="#00daf3" label="Hydraulic Pressure (bar)" height={130}/>
        </div>
      </div>
    </div>
  );
}
