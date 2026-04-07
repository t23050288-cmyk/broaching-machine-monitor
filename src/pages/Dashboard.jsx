import { useState, useEffect, useRef } from 'react';
import { useSensorData } from '../hooks/useSensorData';
import { useMachine } from '../context/MachineContext';
import GaugeCircle from '../components/GaugeCircle';
import LiveChart from '../components/LiveChart';
import StatusBadge from '../components/StatusBadge';
import ConnectionBanner from '../components/ConnectionBanner';
import SystemStatusBar from '../components/SystemStatusBar';
import { getSettings } from '../utils/storage';
import {
  Thermometer, Zap, Battery, FlaskConical, Wifi,
  Clock, RefreshCw, BarChart2, Target, AlertTriangle, CheckCircle2
} from 'lucide-react';

// ── Realistic dummy data when no serial connected ─────────────
function useDummyData(enabled) {
  const [dummy, setDummy] = useState(null);
  const [dummyChart, setDummyChart] = useState([]);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const base = {
        temperature_c:       29.8 + (Math.random() - 0.5) * 4,
        vibration_rms_mm_s2: 0.06 + Math.random() * 0.04,
        spindle_current_a:   0.06 + Math.random() * 0.02,
        supply_voltage_v:    4.93 + (Math.random() - 0.5) * 0.06,
        remaining_life_pct:  87 + (Math.random() - 0.5) * 3,
        cycles_remaining:    3820 + Math.round((Math.random() - 0.5) * 40),
        estimated_time_left: '4h 12m',
        wear_progression:    0.11 + Math.random() * 0.02,
        dominant_freq_hz:    0.031 + Math.random() * 0.005,
        tool_status:         'new',
        timestamp:           new Date().toISOString(),
      };
      setDummy(base);
      setDummyChart(prev => {
        const t = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return [...prev, { ...base, time: t }].slice(-60);
      });
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, [enabled]);
  return { dummy, dummyChart };
}

// ── Fused Correlation Engine ──────────────────────────────────
function FusedCorrelationEngine({ liveData }) {
  const { sensorBaseline, failureThreshold, triggerEStop, triggerWarning, systemStatus } = useMachine();
  const hasBaseline = sensorBaseline.temperature != null;

  const calcDev = (live, base) => base ? Math.abs((live - base) / base) : 0;

  const tempDev = hasBaseline ? calcDev(liveData?.temperature_c     ?? 0, sensorBaseline.temperature) : 0;
  const voltDev = hasBaseline ? calcDev(liveData?.supply_voltage_v  ?? 0, sensorBaseline.voltage)     : 0;

  const tempExceeds = tempDev  > failureThreshold;
  const voltExceeds = voltDev  > failureThreshold;
  const bothExceed  = tempExceeds && voltExceeds;

  const prevBoth = useRef(false);
  const prevTemp = useRef(false);
  useEffect(() => {
    if (!hasBaseline || systemStatus === 'ESTOP') return;
    if (bothExceed && !prevBoth.current) {
      triggerEStop('Critical Correlation Spike — Temperature & Voltage both exceeded threshold simultaneously.');
    } else if (tempExceeds && !prevTemp.current && !bothExceed) {
      triggerWarning('Thermal Anomaly Detected. Temperature deviation exceeds threshold.');
    }
    prevBoth.current = bothExceed;
    prevTemp.current = tempExceeds;
  }, [bothExceed, tempExceeds, hasBaseline, systemStatus]);

  const bars = [
    { label: 'Temperature', dev: tempDev, exceeds: tempExceeds, color: '#ff9259' },
    { label: 'Voltage',     dev: voltDev, exceeds: voltExceeds, color: '#4ade80' },
  ];

  return (
    <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
      <div className="flex items-center gap-2 mb-4">
        <Target size={14} className="text-[#c084fc]"/>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Fused Correlation Engine</span>
        {bothExceed && (
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#ffb4ab] bg-[#93000a]/30 px-2 py-0.5 rounded-full border border-[#ffb4ab]/30 animate-pulse">
            ⚡ CORRELATION SPIKE
          </span>
        )}
        {!bothExceed && !hasBaseline && (
          <span className="ml-auto text-[9px] text-[#849396] uppercase tracking-wider">Calibrate to activate</span>
        )}
      </div>

      <div className="space-y-3">
        {bars.map(b => {
          const pct = Math.min(100, b.dev * 100 / (failureThreshold * 2) * 100);
          const devPct = (b.dev * 100).toFixed(1);
          return (
            <div key={b.label}>
              <div className="flex justify-between text-[9px] mb-1.5">
                <span className="text-[#849396] uppercase tracking-wider">{b.label} Deviation</span>
                <span style={{ color: b.exceeds ? '#ffb4ab' : b.color }} className={`font-bold ${b.exceeds ? 'animate-pulse' : ''}`}>
                  {hasBaseline ? `${devPct}%` : '—'}
                  {b.exceeds && ' ⚠'}
                </span>
              </div>
              <div className="h-2 bg-[#10141a] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: hasBaseline ? `${pct}%` : '0%',
                    background: b.exceeds
                      ? 'linear-gradient(90deg, #ff4444, #ffb4ab)'
                      : `linear-gradient(90deg, ${b.color}88, ${b.color})`,
                    boxShadow: b.exceeds ? '0 0 8px #ff444488' : 'none'
                  }}/>
              </div>
              {/* Threshold marker */}
              <div className="relative h-1">
                <div className="absolute top-0 h-2 w-0.5 bg-[#ffba38]/50 -translate-y-2"
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

// ── Tool Life Card ────────────────────────────────────────────
function WearLifeCard({ wear, remainingPct, cyclesLeft, timeLeft, status }) {
  const pct      = remainingPct ?? 100;
  const barColor = pct > 60 ? '#00e5ff' : pct > 30 ? '#ffba38' : '#ffb4ab';
  const label    = status === 'new' ? 'HEALTHY' : status === 'worn' ? 'WORN' : 'CRITICAL';
  return (
    <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="text-[#ffba38]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">RUL — Remaining Useful Life</span>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
          style={{ color: barColor, backgroundColor: barColor + '15', borderColor: barColor + '30' }}>
          {label || 'WAITING'}
        </span>
      </div>
      <div className="mb-4">
        <div className="flex justify-between text-[9px] text-[#849396] mb-1.5">
          <span>TOOL LIFE REMAINING</span>
          <span style={{ color: barColor }} className="font-bold">{pct.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-[#10141a] rounded-full overflow-hidden border border-[#3b494c]/20">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}88, ${barColor})` }}/>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Wear Index', wear != null ? wear.toFixed(3) : '--', '/ 1.5 max', '#ffba38'],
          ['Est. Cycles', cyclesLeft != null ? cyclesLeft.toLocaleString() : '--', 'remaining', barColor],
          ['Est. Time', timeLeft ?? '--', 'remaining', barColor],
        ].map(([lbl, val, sub, col]) => (
          <div key={lbl} className="bg-[#10141a] rounded-lg p-3 text-center">
            <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1 flex items-center justify-center gap-1">
              <Clock size={8}/>{lbl}
            </div>
            <div className="text-xl font-black font-headline" style={{ color: col }}>{val}</div>
            <div className="text-[9px] text-[#849396]">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FFT Card ──────────────────────────────────────────────────
function FFTCard({ domFreq }) {
  return (
    <div className="bg-[#181c22] rounded-xl p-4 border border-[#3b494c]/20 flex items-center gap-4">
      <BarChart2 size={18} className="text-[#818cf8] flex-shrink-0"/>
      <div className="flex-1">
        <div className="text-[9px] uppercase tracking-[0.2em] text-[#849396]">Dominant Vibration Frequency (FFT)</div>
        <div className="text-2xl font-black font-headline text-[#818cf8] mt-0.5">
          {domFreq != null ? `${domFreq.toFixed(3)} Hz` : '—'}
        </div>
        <div className="text-[9px] text-[#849396] mt-0.5">
          {domFreq == null ? 'Collecting samples…' :
           domFreq < 0.05  ? 'Low freq — smooth cut' :
           domFreq < 0.15  ? 'Mid freq — normal wear signature' :
                             'High freq — check tool condition'}
        </div>
      </div>
    </div>
  );
}

// ── Calibrate Button ──────────────────────────────────────────
function CalibrateButton({ liveData }) {
  const { calibrate, sensorBaseline } = useMachine();
  const [done, setDone] = useState(false);
  const handleCal = () => {
    if (!liveData) return;
    calibrate(liveData);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };
  return (
    <button onClick={handleCal} disabled={!liveData}
      className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl border font-bold transition-all
        ${done
          ? 'bg-[#00e5ff]/15 border-[#00e5ff]/40 text-[#00e5ff]'
          : liveData
            ? 'bg-[#c084fc]/10 border-[#c084fc]/40 text-[#c084fc] hover:bg-[#c084fc]/20'
            : 'bg-[#1c2026] border-[#3b494c]/20 text-[#3b494c] cursor-not-allowed'}`}>
      {done ? <><CheckCircle2 size={13}/> Baseline Saved!</> : <><Target size={13}/> Calibrate Tool</>}
    </button>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const { bridgeStatus, latest, chartData, isFlashing, connect, disconnect } = useSensorData();
  const { systemStatus } = useMachine();
  const s = getSettings();

  const noLive   = !latest;
  const { dummy, dummyChart } = useDummyData(noLive);

  const r      = latest  ?? dummy;
  const charts = latest ? chartData : dummyChart;

  const [simMode, setSimMode] = useState(false);
  const [simTemp, setSimTemp] = useState('29.8');
  const [simVolt, setSimVolt] = useState('4.93');

  const simData = simMode ? {
    temperature_c:       parseFloat(simTemp) || 0,
    supply_voltage_v:    parseFloat(simVolt) || 0,
    vibration_rms_mm_s2: 0.065,
    spindle_current_a:   0.068,
    wear_progression:    0.12,
    remaining_life_pct:  87,
    cycles_remaining:    4350,
    estimated_time_left: '4h 30m',
    dominant_freq_hz:    0.031,
    tool_status:         'new',
    timestamp:           new Date().toISOString(),
  } : null;

  const activeData = simMode ? simData : r;

  const isEStop   = systemStatus === 'ESTOP';
  const isWarning = systemStatus === 'WARNING';

  const tempAlert = activeData && activeData.temperature_c    > (s.tempLimit    || 85);
  const voltAlert = activeData && activeData.supply_voltage_v  < 4.8 && activeData.supply_voltage_v > 0;

  return (
    <div className={`p-6 space-y-5 transition-all duration-300 min-h-screen
      ${isEStop   ? 'ring-4 ring-inset ring-[#ffb4ab]/60' : ''}
      ${isWarning ? 'ring-2 ring-inset ring-[#ffba38]/40' : ''}`}>

      {/* E-Stop full-screen flash overlay */}
      {isEStop && (
        <div className="fixed inset-0 pointer-events-none z-40 animate-pulse"
          style={{ background: 'radial-gradient(ellipse at center, rgba(147,0,10,0.15) 0%, transparent 65%)', border: '3px solid rgba(255,180,171,0.4)' }}/>
      )}

      <ConnectionBanner status={bridgeStatus} onConnect={connect} onDisconnect={disconnect}/>
      <SystemStatusBar/>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Health Pulse</h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">
            {simMode
              ? '🧪 Manual Simulation'
              : bridgeStatus === 'connected' && latest
                ? `Live Arduino — ${new Date(latest.timestamp).toLocaleTimeString()}`
                : `Demo mode — connect Arduino for live data`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeData && <StatusBadge status={activeData.tool_status}/>}
          <CalibrateButton liveData={activeData}/>
          <button onClick={() => setSimMode(m => !m)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-bold transition-all
              ${simMode ? 'bg-[#ffba38]/10 border-[#ffba38]/40 text-[#ffba38]' : 'bg-[#3b494c]/10 border-[#3b494c]/30 text-[#849396] hover:text-[#dfe2eb]'}`}>
            {simMode ? <><Wifi size={13}/> Live</> : <><FlaskConical size={13}/> Simulate</>}
          </button>
        </div>
      </div>

      {/* Sim panel — only voltage + temp since that's what we have */}
      {simMode && (
        <div className="bg-[#1a1a10] border border-[#ffba38]/30 rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#ffba38] mb-3 font-bold">🧪 Simulation — Live Sensor Override</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#ff9259] mb-1.5">Temperature (°C)</label>
              <input value={simTemp} onChange={e => setSimTemp(e.target.value)} type="number" step="0.1"
                className="w-full bg-[#10141a] border border-[#ff9259]/40 rounded-lg px-3 py-2.5 text-sm font-mono text-[#dfe2eb] outline-none"/>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#4ade80] mb-1.5">Voltage (V)</label>
              <input value={simVolt} onChange={e => setSimVolt(e.target.value)} type="number" step="0.01"
                className="w-full bg-[#10141a] border border-[#4ade80]/40 rounded-lg px-3 py-2.5 text-sm font-mono text-[#dfe2eb] outline-none"/>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            {[{l:'Normal',t:'29.8',v:'4.95'},{l:'Warm',t:'45',v:'4.90'},{l:'Hot',t:'72',v:'4.82'},{l:'Critical',t:'90',v:'4.70'}].map(p => (
              <button key={p.l} onClick={() => { setSimTemp(p.t); setSimVolt(p.v); }}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-[#10141a] border border-[#3b494c]/40 text-[#849396] hover:text-[#dfe2eb] transition-colors">
                {p.l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gauges */}
      <div className="bg-[#181c22] rounded-xl p-5 flex justify-around flex-wrap gap-4">
        <GaugeCircle value={activeData?.temperature_c    ?? 0} max={100} unit="°C"  label="Temperature"   color={tempAlert ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={activeData?.supply_voltage_v ?? 0} max={6}   unit="V"   label="Supply Voltage" color={voltAlert ? '#ffb4ab' : '#4ade80'}/>
        <GaugeCircle value={activeData?.wear_progression ?? 0} max={1.5} unit="wear" label="Wear Index"    color="#ffba38"/>
        <GaugeCircle value={activeData?.remaining_life_pct ?? 100} max={100} unit="%" label="Tool Life"   color="#818cf8"/>
      </div>

      {/* RUL Card */}
      <WearLifeCard
        wear={activeData?.wear_progression}
        remainingPct={activeData?.remaining_life_pct}
        cyclesLeft={activeData?.cycles_remaining}
        timeLeft={activeData?.estimated_time_left}
        status={activeData?.tool_status}
      />

      {/* Fused Correlation Engine */}
      <FusedCorrelationEngine liveData={activeData}/>

      {/* FFT */}
      <FFTCard domFreq={activeData?.dominant_freq_hz}/>

      {/* Metric cards — only sensors we actually have */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#1c2026] rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Thermometer size={14} className="text-[#ff9259]"/>
            <span className="text-[9px] uppercase tracking-[0.15em] text-[#849396]">Temperature</span>
            {tempAlert && <span className="ml-auto text-[9px] text-[#ffb4ab] font-bold animate-pulse">HIGH</span>}
          </div>
          <div className="text-2xl font-black font-headline text-[#c3f5ff]">
            {activeData?.temperature_c?.toFixed(1) ?? '--'}<span className="text-[#849396] text-xs ml-1">°C</span>
          </div>
          <div className="text-[9px] text-[#849396]">DHT11 Sensor</div>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Battery size={14} className="text-[#4ade80]"/>
            <span className="text-[9px] uppercase tracking-[0.15em] text-[#849396]">Supply Voltage</span>
            {voltAlert && <span className="ml-auto text-[9px] text-[#ffb4ab] font-bold animate-pulse">LOW</span>}
          </div>
          <div className="text-2xl font-black font-headline text-[#c3f5ff]">
            {activeData?.supply_voltage_v?.toFixed(2) ?? '--'}<span className="text-[#849396] text-xs ml-1">V</span>
          </div>
          <div className="text-[9px] text-[#849396]">A1 Voltage Divider</div>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-[#818cf8]"/>
            <span className="text-[9px] uppercase tracking-[0.15em] text-[#849396]">FFT Freq</span>
          </div>
          <div className="text-2xl font-black font-headline text-[#818cf8]">
            {activeData?.dominant_freq_hz?.toFixed(3) ?? '--'}<span className="text-[#849396] text-xs ml-1">Hz</span>
          </div>
          <div className="text-[9px] text-[#849396]">MPU6050 Vibration</div>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[#ffba38]"/>
            <span className="text-[9px] uppercase tracking-[0.15em] text-[#849396]">Wear Index</span>
          </div>
          <div className="text-2xl font-black font-headline text-[#ffba38]">
            {activeData?.wear_progression?.toFixed(3) ?? '--'}<span className="text-[#849396] text-xs ml-1">/1.5</span>
          </div>
          <div className="text-[9px] text-[#849396]">Derived from sensors</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={charts} dataKey="temperature_c" color="#ff9259" label="Temperature °C" limit={s.tempLimit || 85}/>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={charts} dataKey="supply_voltage_v" color="#4ade80" label="Supply Voltage V" limit={4.8}/>
        </div>
      </div>
    </div>
  );
}
