import { useMachine } from '../context/MachineContext';
import { Settings as Gear, Info } from 'lucide-react';

export default function Settings() {
  const { machineProfile, setMachineProfile } = useMachine();

  return (
    <div className="p-6 space-y-5 min-h-screen">
      <div>
        <h1 className="text-2xl font-black text-slate-100">Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">System configuration</p>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 space-y-4 max-w-lg">
        <div className="flex items-center gap-2">
          <Gear size={14} className="text-slate-400"/>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Machine Profile</span>
        </div>
        {['legacy','precision','broach'].map(p => (
          <label key={p} className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-all
            ${machineProfile === p ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700/50 hover:border-slate-600'}`}>
            <input type="radio" value={p} checked={machineProfile === p}
              onChange={() => setMachineProfile(p)} className="accent-emerald-400"/>
            <span className="text-sm text-slate-300 capitalize">{p === 'broach' ? 'Broaching Machine' : p === 'precision' ? 'Precision CNC' : 'Legacy Machine'}</span>
          </label>
        ))}
      </div>

      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 max-w-lg">
        <div className="flex items-start gap-3">
          <Info size={14} className="text-emerald-400 mt-0.5"/>
          <p className="text-xs text-slate-400 leading-relaxed">
            <b className="text-emerald-400">Industrial Hardening Active:</b> All sensor data streams are
            routed through a Teflon (PTFE) insulated shielded cable harness. This resolves the
            current-sensor trip-off issue observed under high-vibration conditions during initial
            prototype testing.
          </p>
        </div>
      </div>
    </div>
  );
}
