import { useState } from 'react';
import { useMachine } from '../context/MachineContext';
import { Shield, Cpu, ChevronRight, AlertTriangle } from 'lucide-react';

export default function InitModal() {
  const { initMachine } = useMachine();
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(1); // 1=select profile, 2=confirm

  const profiles = [
    {
      id: 'legacy',
      label: 'Legacy Machine',
      sub: '20+ Years — High Mechanical Play',
      threshold: '15%',
      desc: 'Higher tolerance for natural wear & mechanical deviation. Alerts trigger at 15% deviation from baseline.',
      color: '#ffba38',
      icon: Shield,
    },
    {
      id: 'precision',
      label: 'Precision CNC',
      sub: 'New / High-Accuracy Build',
      threshold: '8%',
      desc: 'Tight tolerances. Any deviation is significant. Alerts trigger at 8% deviation — early intervention mode.',
      color: '#00e5ff',
      icon: Cpu,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0d12]/95 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#849396] mb-2">KINETIC FORGE</div>
          <h1 className="text-3xl font-black font-headline text-[#c3f5ff] tracking-tight">Adaptive Command Center</h1>
          <div className="text-sm text-[#849396] mt-2">Select your machine profile to initialize monitoring</div>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            {profiles.map(p => {
              const Icon = p.icon;
              const isSelected = selected === p.id;
              return (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200
                    ${isSelected
                      ? 'border-current bg-opacity-10'
                      : 'border-[#3b494c]/30 bg-[#181c22] hover:border-[#3b494c]/60'}`}
                  style={isSelected ? { borderColor: p.color, backgroundColor: p.color + '10' } : {}}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: p.color + '15', border: `1px solid ${p.color}30` }}>
                      <Icon size={20} style={{ color: p.color }}/>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-[#dfe2eb] text-sm">{p.label}</div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: p.color, backgroundColor: p.color + '15', border: `1px solid ${p.color}30` }}>
                          {p.threshold} THRESHOLD
                        </span>
                      </div>
                      <div className="text-[11px] text-[#849396] mt-0.5">{p.sub}</div>
                      <div className="text-[11px] text-[#6b7280] mt-2 leading-relaxed">{p.desc}</div>
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              onClick={() => selected && setStep(2)}
              disabled={!selected}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all mt-4
                ${selected
                  ? 'bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-[#00e5ff] hover:bg-[#00e5ff]/20'
                  : 'bg-[#1c2026] border border-[#3b494c]/20 text-[#3b494c] cursor-not-allowed'}`}>
              Continue <ChevronRight size={16}/>
            </button>
          </div>
        )}

        {step === 2 && (() => {
          const p = profiles.find(x => x.id === selected);
          return (
            <div className="bg-[#181c22] rounded-2xl p-6 border border-[#3b494c]/20 space-y-5">
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className="text-[#ffba38]"/>
                <div className="text-sm font-bold text-[#dfe2eb]">Confirm Initialization</div>
              </div>
              <div className="bg-[#10141a] rounded-xl p-4 border border-[#3b494c]/20">
                <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-2">Selected Profile</div>
                <div className="font-bold text-[#dfe2eb]" style={{ color: p.color }}>{p.label}</div>
                <div className="text-xs text-[#849396] mt-1">Failure threshold set to <b style={{ color: p.color }}>{p.threshold}</b> deviation</div>
              </div>
              <div className="text-xs text-[#849396] leading-relaxed">
                The Fused Correlation Engine will monitor live sensor data against this threshold.
                An E-Stop will be triggered if multiple sensors simultaneously exceed the limit.
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl border border-[#3b494c]/30 text-[#849396] text-sm hover:text-[#dfe2eb] hover:border-[#3b494c]/60 transition-colors">
                  Back
                </button>
                <button onClick={() => initMachine(selected)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                  style={{ backgroundColor: p.color + '20', borderWidth: 1, borderColor: p.color + '50', color: p.color }}>
                  Initialize System
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
