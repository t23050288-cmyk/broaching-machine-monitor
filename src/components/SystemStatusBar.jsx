import { useMachine } from '../context/MachineContext';
import { ShieldCheck, AlertTriangle, Zap, RotateCcw, Settings } from 'lucide-react';

export default function SystemStatusBar({ onOpenSettings }) {
  const { systemStatus, machineProfile, failureThreshold, resetStatus, sensorBaseline } = useMachine();

  const cfg = {
    ARMED:   { color: '#00e5ff', bg: 'bg-[#00e5ff]/5  border-[#00e5ff]/15',  icon: ShieldCheck, label: 'ARMED — All Systems Normal',         pulse: false },
    WARNING: { color: '#ffba38', bg: 'bg-[#ffba38]/10 border-[#ffba38]/30',  icon: AlertTriangle, label: 'WARNING — Threshold Approaching',   pulse: true  },
    ESTOP:   { color: '#ffb4ab', bg: 'bg-[#93000a]/20 border-[#ffb4ab]/40',  icon: Zap,           label: 'E-STOP TRIGGERED — Power Cut',       pulse: true  },
  };
  const c    = cfg[systemStatus];
  const Icon = c.icon;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs ${c.bg} transition-all`}>
      <Icon size={14} style={{ color: c.color }} className={c.pulse ? 'animate-pulse' : ''}/>
      <span style={{ color: c.color }} className="font-bold tracking-widest uppercase flex-1">{c.label}</span>

      <div className="flex items-center gap-3 text-[#849396]">
        <span className="text-[9px] uppercase tracking-wider">
          Profile: <b className="text-[#dfe2eb]">{machineProfile === 'precision' ? 'Precision CNC' : 'Legacy'}</b>
        </span>
        <span className="text-[9px] uppercase tracking-wider">
          Threshold: <b style={{ color: c.color }}>{(failureThreshold * 100).toFixed(0)}%</b>
        </span>
        {sensorBaseline.temperature && (
          <span className="text-[9px] uppercase tracking-wider text-[#00e5ff]">● CALIBRATED</span>
        )}
      </div>

      {systemStatus === 'ESTOP' && (
        <button onClick={resetStatus}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-[#ffb4ab]/30 text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition-colors">
          <RotateCcw size={11}/> Reset
        </button>
      )}
    </div>
  );
}
