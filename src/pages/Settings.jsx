import { useState } from 'react';
import { useMachine } from '../context/MachineContext';
import { getSettings, saveSettings } from '../utils/storage';
import { beep } from '../utils/alerts';
import { Save, Shield, Cpu, ToggleLeft, ToggleRight } from 'lucide-react';

export default function SettingsPage() {
  const { machineProfile, setProfile, failureThreshold } = useMachine();
  const [s, setS]     = useState(getSettings());
  const [saved, setSaved] = useState(false);
  const update = (key, val) => setS(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    saveSettings(s);
    setSaved(true);
    if (s.beepEnabled) beep(440, 200, 'sine');
    setTimeout(() => setSaved(false), 2000);
  };

  function SliderRow({ label, stateKey, min, max, step = 1, unit }) {
    const val = s[stateKey];
    const pct = ((val - min) / (max - min)) * 100;
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-[#849396] uppercase tracking-wider text-[10px]">{label}</span>
          <span className="text-[#c3f5ff] font-bold">{val} {unit}</span>
        </div>
        <div className="relative h-2 bg-[#10141a] rounded-full">
          <div className="absolute inset-y-0 left-0 bg-[#00e5ff] rounded-full transition-all" style={{ width: `${pct}%` }}/>
          <input type="range" min={min} max={max} step={step} value={val}
            onChange={e => update(stateKey, parseFloat(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"/>
        </div>
        <div className="flex justify-between text-[9px] text-[#3b494c]">
          <span>{min}{unit}</span><span>{max}{unit}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Settings</h1>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">System configuration</div>
      </div>

      {/* ── Machine Age Toggle ─────────────────────────────── */}
      <div className="bg-[#181c22] rounded-2xl p-6 border border-[#3b494c]/20 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={15} className="text-[#ffba38]"/>
          <span className="text-sm font-bold text-[#dfe2eb]">Machine Age Profile</span>
          <span className="ml-auto text-[9px] uppercase tracking-wider px-2 py-1 rounded-full font-bold"
            style={{
              color: machineProfile === 'precision' ? '#00e5ff' : '#ffba38',
              background: machineProfile === 'precision' ? '#00e5ff15' : '#ffba3815',
              border: `1px solid ${machineProfile === 'precision' ? '#00e5ff30' : '#ffba3830'}`,
            }}>
            Active: {machineProfile === 'precision' ? 'Precision CNC' : 'Legacy'}
          </span>
        </div>
        <p className="text-xs text-[#849396] leading-relaxed">
          Old machines have natural mechanical play and noise. The AI adapts its sensitivity threshold accordingly —
          so you don't get false alarms on a legacy machine, and catch micro-deviations on a new CNC.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'legacy',    label: 'Legacy Machine', sub: '20+ Years · High Mechanical Play', threshold: '15%', color: '#ffba38', icon: Shield },
            { id: 'precision', label: 'Precision CNC',  sub: 'New / High Accuracy Build',        threshold: '8%',  color: '#00e5ff', icon: Cpu   },
          ].map(p => {
            const active = machineProfile === p.id;
            const Icon = p.icon;
            return (
              <button key={p.id} onClick={() => setProfile(p.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all duration-200
                  ${active ? '' : 'bg-[#10141a] border-[#3b494c]/20 hover:border-[#3b494c]/50'}`}
                style={active ? { borderColor: p.color, backgroundColor: p.color + '12' } : {}}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} style={{ color: active ? p.color : '#849396' }}/>
                  <span className="text-sm font-bold" style={{ color: active ? p.color : '#dfe2eb' }}>{p.label}</span>
                  {active && (
                    <span className="ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ color: p.color, background: p.color + '20' }}>ACTIVE</span>
                  )}
                </div>
                <div className="text-[10px] text-[#849396]">{p.sub}</div>
                <div className="text-[10px] font-bold mt-1.5" style={{ color: p.color }}>
                  Alert threshold: {p.threshold}
                </div>
              </button>
            );
          })}
        </div>
        <div className="bg-[#10141a] rounded-lg px-3 py-2 text-[10px] text-[#849396] border border-[#3b494c]/10">
          Current failure threshold: <b className="text-[#c3f5ff]">{(failureThreshold * 100).toFixed(0)}%</b> deviation from calibrated baseline
        </div>
      </div>

      {/* ── Alert Thresholds ───────────────────────────────── */}
      <div className="bg-[#181c22] rounded-2xl p-6 border border-[#3b494c]/15 space-y-5">
        <div className="text-sm font-bold text-[#dfe2eb]">Sensor Alert Thresholds</div>
        <SliderRow label="Temperature Limit"   stateKey="tempLimit"    min={50}  max={120} unit="°C"/>
        <SliderRow label="Vibration Limit"     stateKey="vibLimit"     min={5}   max={50}  unit="m/s²"/>
        <SliderRow label="Current Limit"       stateKey="currentLimit" min={0.05} max={0.5} step={0.01} unit="A"/>
        <SliderRow label="Cutting Force Limit" stateKey="forceLimit"   min={5000} max={15000} step={100} unit="N"/>
      </div>

      {/* ── Beep ──────────────────────────────────────────── */}
      <div className="bg-[#181c22] rounded-2xl p-5 border border-[#3b494c]/15">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-[#dfe2eb]">Alert Beep</div>
            <div className="text-[10px] text-[#849396] mt-0.5">Audible alarm on threshold breach</div>
          </div>
          <button onClick={() => update('beepEnabled', !s.beepEnabled)}
            className="transition-colors">
            {s.beepEnabled
              ? <ToggleRight size={32} className="text-[#00e5ff]"/>
              : <ToggleLeft  size={32} className="text-[#3b494c]"/>}
          </button>
        </div>
      </div>

      <button onClick={handleSave}
        className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
          ${saved
            ? 'bg-[#00e5ff]/15 border border-[#00e5ff]/30 text-[#00e5ff]'
            : 'bg-[#1c2026] border border-[#3b494c]/30 text-[#849396] hover:text-[#dfe2eb] hover:border-[#dfe2eb]/20'}`}>
        <Save size={15}/>{saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
