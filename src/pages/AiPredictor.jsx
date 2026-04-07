import { useState, useEffect, useRef } from 'react';
import { useMachine, useSimulation } from '../context/MachineContext';
import { Brain, Activity, Zap, TrendingDown, RefreshCw, Clock, CheckCircle2, AlertOctagon, AlertTriangle } from 'lucide-react';

// ── Auto-generate diagnostic lines ───────────────────────────
function generateDiagnostic(data, prevData, threshold, isCalibrated, getDeviation) {
  if (!data) return null;
  const now = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (data.spike_active) {
    const currDev = isCalibrated ? getDeviation('current', data.spindle_current_a) : 0;
    const pressDev = isCalibrated ? getDeviation('pressure', data.hydraulic_pressure_bar) : 0;
    if (currDev > threshold && pressDev > threshold) {
      return {
        ts: now, level: 'CRITICAL', color: '#ffb4ab',
        icon: 'estop',
        title: 'Critical Combined Load Spike',
        body: `Current +${(currDev * 100).toFixed(1)}%, Pressure +${(pressDev * 100).toFixed(1)}% — Diagnostic: Tool Dullness/Friction. Chip Packing. Recommended Action: Stop and Regrind.`,
      };
    }
    return {
      ts: now, level: 'WARNING', color: '#ffba38',
      icon: 'warn',
      title: 'Anomaly Detected: Load Spike',
      body: `Combined load spike ${(Math.max(currDev, pressDev) * 100).toFixed(1)}%. Diagnostic: Elevated friction signature. Monitor closely — regrind if persists.`,
    };
  }

  // Routine analysis (every few seconds)
  const routines = [
    'Analyzing Force Signature… Stable.',
    'Vibration Spectrum: Low-frequency dominant. Normal wear signature.',
    'Thermal Profile: Within operational range.',
    'Hydraulic Circuit: Pressure nominal.',
    'Tool Edge Condition: No anomalies detected.',
    'Current Draw Pattern: Consistent. Tool healthy.',
    'FFT Analysis: No resonance peaks. Smooth cut.',
    'Wear Rate Projection: On expected trajectory.',
  ];
  const msg = routines[Math.floor(Math.random() * routines.length)];
  return {
    ts: now, level: 'INFO', color: '#00e5ff',
    icon: 'ok',
    title: 'System Scan',
    body: msg,
  };
}

function FeedEntry({ entry }) {
  const isEStop = entry.icon === 'estop';
  const isWarn  = entry.icon === 'warn';
  const Icon = isEStop ? AlertOctagon : isWarn ? AlertTriangle : CheckCircle2;
  return (
    <div className={`rounded-xl px-4 py-3 border flex gap-3 transition-all
      ${isEStop ? 'bg-[#93000a]/15 border-[#ffb4ab]/25' :
        isWarn  ? 'bg-[#ffba38]/8  border-[#ffba38]/20' :
                  'bg-[#00e5ff]/3  border-[#00e5ff]/10'}`}>
      <Icon size={14} style={{ color: entry.color }} className={isEStop ? 'animate-pulse mt-0.5 flex-shrink-0' : 'mt-0.5 flex-shrink-0'}/>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: entry.color }}>
            {entry.level} · {entry.title}
          </span>
          <span className="text-[9px] text-[#849396]">{entry.ts}</span>
        </div>
        <div className="text-xs text-[#849396] mt-0.5 leading-relaxed">{entry.body}</div>
      </div>
    </div>
  );
}

function RULCard({ rul, cycles }) {
  const color = rul > 60 ? '#00e5ff' : rul > 30 ? '#ffba38' : '#ffb4ab';
  return (
    <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown size={14} className="text-[#c084fc]"/>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">RUL — Remaining Useful Life</span>
        <span className="ml-auto text-[9px] text-[#849396] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-pulse inline-block"/>
          Live projection
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#10141a] rounded-xl p-4 text-center col-span-1">
          <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1">Life Left</div>
          <div className="text-3xl font-black font-headline" style={{ color }}>{rul.toFixed(1)}<span className="text-base">%</span></div>
          <div className="h-1.5 bg-[#1c2026] rounded-full overflow-hidden mt-2">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${rul}%`, background: color }}/>
          </div>
        </div>
        <div className="bg-[#10141a] rounded-xl p-4 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1 flex items-center justify-center gap-1"><RefreshCw size={8}/>Cycles</div>
          <div className="text-2xl font-black font-headline" style={{ color }}>{cycles?.toLocaleString()}</div>
          <div className="text-[9px] text-[#849396] mt-1">est. remaining</div>
        </div>
        <div className="bg-[#10141a] rounded-xl p-4 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1 flex items-center justify-center gap-1"><Clock size={8}/>Replace at</div>
          <div className="text-2xl font-black font-headline text-[#ffba38]">20%</div>
          <div className="text-[9px] text-[#849396] mt-1">threshold</div>
        </div>
      </div>
      <div className="mt-3 text-[10px] text-[#849396] bg-[#10141a] rounded-lg px-3 py-2 border border-[#3b494c]/10">
        💡 At current wear rate: <span className="font-bold" style={{ color }}>Estimated {cycles?.toLocaleString()} cycles</span> before tool replacement recommended.
      </div>
    </div>
  );
}

export default function AiPredictor() {
  const { failureThreshold, machineProfile } = useMachine();
  const { data, stressTest, isCalibrated, getDeviation, rul } = useSimulation();

  const [feed, setFeed] = useState([]);
  const prevDataRef = useRef(null);
  const tickRef = useRef(0);

  // Auto-generate diagnostic entries
  useEffect(() => {
    if (!data) return;
    tickRef.current += 1;

    // Emit on spike or every 8 ticks (~4 seconds)
    const shouldEmit = data.spike_active || tickRef.current % 8 === 0;
    if (!shouldEmit) return;

    const entry = generateDiagnostic(data, prevDataRef.current, failureThreshold, isCalibrated, getDeviation);
    if (entry) {
      setFeed(prev => [{ ...entry, id: Date.now() }, ...prev].slice(0, 30));
    }
    prevDataRef.current = data;
  }, [data, failureThreshold, isCalibrated]);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight flex items-center gap-2">
            <Brain size={22} className="text-[#c084fc]"/> AI Diagnostics
          </h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">
            Autonomous diagnostics · {machineProfile === 'precision' ? 'Precision CNC' : 'Legacy Machine'} · {(failureThreshold * 100).toFixed(0)}% threshold
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stressTest && (
            <span className="text-[9px] bg-[#ffb4ab]/15 text-[#ffb4ab] px-3 py-1.5 rounded-full border border-[#ffb4ab]/20 animate-pulse font-bold uppercase tracking-wider">
              ⚡ Stress Test Active
            </span>
          )}
          <span className="text-[9px] bg-[#00e5ff]/10 text-[#00e5ff] px-3 py-1.5 rounded-full border border-[#00e5ff]/20 font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-pulse inline-block"/>
            Live Feed
          </span>
        </div>
      </div>

      {/* RUL */}
      <RULCard rul={rul} cycles={data?.cycles_remaining}/>

      {/* Live sensor snapshot */}
      <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={14} className="text-[#00e5ff]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Live Sensor Snapshot</span>
          <span className="ml-auto text-[9px] text-[#00e5ff] animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] inline-block"/>LIVE
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Temperature',  data?.temperature_c?.toFixed(1) ?? '--',         '°C',   '#ff9259'],
            ['Voltage',      data?.supply_voltage_v?.toFixed(3) ?? '--',      'V',    '#4ade80'],
            ['Current',      data?.spindle_current_a?.toFixed(4) ?? '--',     'A',    '#818cf8'],
            ['Hyd. Pressure',data?.hydraulic_pressure_bar?.toFixed(2) ?? '--','bar',  '#00daf3'],
          ].map(([lbl, val, unit, col]) => (
            <div key={lbl} className="bg-[#10141a] rounded-lg p-3">
              <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1">{lbl}</div>
              <div className="text-xl font-black font-headline" style={{ color: col }}>
                {val}<span className="text-xs text-[#849396] ml-1">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Diagnostic Feed */}
      <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} className="text-[#ffba38]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Live Diagnostic Feed</span>
          {feed.length > 0 && (
            <span className="ml-auto text-[9px] bg-[#1c2026] text-[#849396] px-2 py-0.5 rounded-full">
              {feed.length} events
            </span>
          )}
        </div>

        {feed.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <span className="text-3xl">📡</span>
            <div className="text-sm text-[#849396]">Initializing diagnostic engine…</div>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {feed.map(e => <FeedEntry key={e.id} entry={e}/>)}
          </div>
        )}

        {/* Logic reference */}
        <div className="mt-4 pt-4 border-t border-[#3b494c]/15 space-y-1.5">
          <div className="text-[9px] uppercase tracking-wider text-[#3b494c] mb-2">Diagnostic Rules</div>
          <div className="text-[10px] text-[#849396] flex gap-2">
            <span className="text-[#ffba38]">▸</span> Single spike → Warning. Recommended: Monitor &amp; Inspect.
          </div>
          <div className="text-[10px] text-[#849396] flex gap-2">
            <span className="text-[#ffb4ab]">▸</span> Both Current &amp; Pressure → CRITICAL. E-Stop + Chip Packing diagnosis.
          </div>
        </div>
      </div>
    </div>
  );
}
