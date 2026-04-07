import { useState, useEffect } from 'react';
import { useMachine } from '../context/MachineContext';
import { useSensorData } from '../hooks/useSensorData';
import {
  Brain, AlertOctagon, AlertTriangle, CheckCircle2,
  Cpu, RefreshCw, Clock, Activity, Zap, TrendingDown
} from 'lucide-react';

// ── Dummy fluctuating data for when no sensor connected ───────
function useDemoSensor() {
  const [d, setD] = useState({ temperature_c: 29.8, supply_voltage_v: 4.93, remaining_life_pct: 87, cycles_remaining: 3820, wear_progression: 0.11 });
  useEffect(() => {
    const id = setInterval(() => setD({
      temperature_c:     29.8 + (Math.random() - 0.5) * 4,
      supply_voltage_v:  4.93 + (Math.random() - 0.5) * 0.06,
      remaining_life_pct: 87 + (Math.random() - 0.5) * 2,
      cycles_remaining:  3820 + Math.round((Math.random() - 0.5) * 30),
      wear_progression:  0.11 + Math.random() * 0.02,
    }), 2000);
    return () => clearInterval(id);
  }, []);
  return d;
}

function DiagnosticCard({ entry }) {
  const isEStop   = entry.type === 'estop';
  const isWarning = entry.type === 'warning';
  const Icon = isEStop ? AlertOctagon : isWarning ? AlertTriangle : CheckCircle2;
  const color = isEStop ? '#ffb4ab' : isWarning ? '#ffba38' : '#00e5ff';
  const bg    = isEStop ? 'bg-[#93000a]/15 border-[#ffb4ab]/25' : isWarning ? 'bg-[#ffba38]/8 border-[#ffba38]/25' : 'bg-[#00e5ff]/5 border-[#00e5ff]/20';
  return (
    <div className={`rounded-xl p-4 border ${bg} transition-all`}>
      <div className="flex items-start gap-3">
        <Icon size={16} style={{ color }} className={isEStop ? 'animate-pulse mt-0.5' : 'mt-0.5'}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
              {entry.level}
            </span>
            <span className="text-[9px] text-[#849396]">
              {new Date(entry.ts).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-xs text-[#dfe2eb] mt-1 leading-relaxed">{entry.message}</div>
        </div>
      </div>
    </div>
  );
}

function RULCard({ latest, demo }) {
  const d      = latest ?? demo;
  const pct    = d?.remaining_life_pct ?? 87;
  const cycles = d?.cycles_remaining   ?? 3820;
  const wear   = d?.wear_progression   ?? 0.11;
  const color  = pct > 60 ? '#00e5ff' : pct > 30 ? '#ffba38' : '#ffb4ab';

  // Trend: project wear rate → RUL
  const cyclesDisplay = cycles.toLocaleString();

  return (
    <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown size={14} className="text-[#c084fc]"/>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">RUL — Remaining Useful Life</span>
        <span className="ml-auto text-[9px] text-[#849396]">Wear trend projection</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#10141a] rounded-xl p-4 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1">Life Remaining</div>
          <div className="text-2xl font-black font-headline" style={{ color }}>{pct.toFixed(1)}<span className="text-sm">%</span></div>
          <div className="h-1.5 bg-[#1c2026] rounded-full overflow-hidden mt-2">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.7s' }}/>
          </div>
        </div>
        <div className="bg-[#10141a] rounded-xl p-4 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1 flex items-center justify-center gap-1">
            <RefreshCw size={8}/> Est. Cycles
          </div>
          <div className="text-2xl font-black font-headline" style={{ color }}>{cyclesDisplay}</div>
          <div className="text-[9px] text-[#849396] mt-1">remaining</div>
        </div>
        <div className="bg-[#10141a] rounded-xl p-4 text-center">
          <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1">Wear Index</div>
          <div className="text-2xl font-black font-headline text-[#ffba38]">{wear.toFixed(3)}</div>
          <div className="text-[9px] text-[#849396] mt-1">of 1.5 max</div>
        </div>
      </div>
      <div className="text-[10px] text-[#849396] bg-[#10141a] rounded-lg px-3 py-2 border border-[#3b494c]/10">
        💡 At current wear rate:
        <span className="font-bold ml-1" style={{ color }}>
          Estimated {cyclesDisplay} cycles remaining
        </span>
        {' '}before tool replacement recommended.
      </div>
    </div>
  );
}

export default function AiPredictor() {
  const { diagnosticsLog, systemStatus, machineProfile, failureThreshold } = useMachine();
  const { latest } = useSensorData();
  const demo = useDemoSensor();
  const d    = latest ?? demo;

  const profileLabel = machineProfile === 'precision' ? 'Precision CNC' : 'Legacy Machine';

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight flex items-center gap-2">
            <Brain size={22} className="text-[#c084fc]"/> AI Diagnostics
          </h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">
            Autonomous diagnostics · {profileLabel} · {(failureThreshold * 100).toFixed(0)}% threshold
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full border font-bold
          ${systemStatus === 'ESTOP' ? 'text-[#ffb4ab] bg-[#ffb4ab]/10 border-[#ffb4ab]/20 animate-pulse' :
            systemStatus === 'WARNING' ? 'text-[#ffba38] bg-[#ffba38]/10 border-[#ffba38]/20' :
            'text-[#00e5ff] bg-[#00e5ff]/10 border-[#00e5ff]/20'}`}>
          <Cpu size={11}/>
          {systemStatus === 'ESTOP' ? ' E-STOP ACTIVE' : systemStatus === 'WARNING' ? ' WARNING ACTIVE' : ' SYSTEM ARMED'}
        </div>
      </div>

      {/* RUL Card */}
      <RULCard latest={latest} demo={demo}/>

      {/* Live sensor snapshot */}
      <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={14} className="text-[#00e5ff]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Live Sensor Snapshot</span>
          {latest && <span className="ml-auto text-[9px] text-[#00e5ff] animate-pulse">● LIVE</span>}
          {!latest && <span className="ml-auto text-[9px] text-[#849396]">Demo data</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Temperature', d?.temperature_c?.toFixed(1) ?? '--', '°C', '#ff9259'],
            ['Supply Voltage', d?.supply_voltage_v?.toFixed(2) ?? '--', 'V', '#4ade80'],
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

      {/* Autonomous Diagnostics Log */}
      <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} className="text-[#ffba38]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Autonomous Diagnostics Log</span>
          {diagnosticsLog.length > 0 && (
            <span className="ml-auto text-[9px] bg-[#ffb4ab]/15 text-[#ffb4ab] px-2 py-0.5 rounded-full border border-[#ffb4ab]/20">
              {diagnosticsLog.length} event{diagnosticsLog.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {diagnosticsLog.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <CheckCircle2 size={24} className="mx-auto text-[#00e5ff]/40"/>
            <div className="text-sm text-[#849396]">No diagnostic events yet</div>
            <div className="text-[10px] text-[#3b494c]">Calibrate the tool baseline and the engine will auto-diagnose any deviations</div>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {diagnosticsLog.map(entry => <DiagnosticCard key={entry.id} entry={entry}/>)}
          </div>
        )}

        {/* Logic reference */}
        <div className="mt-4 border-t border-[#3b494c]/15 pt-4 space-y-1.5">
          <div className="text-[9px] uppercase tracking-wider text-[#3b494c] mb-2">Diagnostic Logic</div>
          <div className="text-[10px] text-[#849396] flex gap-2">
            <span className="text-[#ffba38]">▸</span>
            Temperature &gt; threshold only → "Thermal Anomaly. Check coolant / ambient."
          </div>
          <div className="text-[10px] text-[#849396] flex gap-2">
            <span className="text-[#ffb4ab]">▸</span>
            Temperature + Voltage both exceed → "Critical Correlation Spike. E-Stop deployed."
          </div>
        </div>
      </div>
    </div>
  );
}
