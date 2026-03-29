import { useState } from 'react';
import { getSettings, saveSettings } from '../utils/storage';
import { beep, alarmBeep } from '../utils/alerts';
import { Save, Volume2, VolumeX, Key } from 'lucide-react';

export default function SettingsPage() {
  const [s, setS] = useState(getSettings());
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
        <div className="flex justify-between items-center">
          <label className="text-[10px] uppercase tracking-[0.15em] text-[#849396]">{label} Limit</label>
          <span className="text-sm font-bold font-headline text-[#c3f5ff]">{val} <span className="text-[#849396] text-xs font-normal">{unit}</span></span>
        </div>
        <input type="range" min={min} max={max} step={step} value={val}
          onChange={e => update(stateKey, Number(e.target.value))}
          className="w-full h-1 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #00daf3 ${pct}%, #31353c ${pct}%)` }}/>
        <div className="flex justify-between text-[9px] text-[#3b494c]"><span>{min}</span><span>{max}</span></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Settings</h1>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">Thresholds · Alerts · AI</div>
      </div>
      <div className="bg-[#181c22] rounded-xl p-5 space-y-6">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Alert Thresholds</div>
        <SliderRow label="Temperature"   stateKey="tempLimit"    min={60}   max={100}  unit="°C"/>
        <SliderRow label="Vibration"     stateKey="vibLimit"     min={20}   max={40}   unit="mm/s²"/>
        <SliderRow label="Current"       stateKey="currentLimit" min={30}   max={50}   unit="A"/>
        <SliderRow label="Cutting Force" stateKey="forceLimit"   min={8000} max={12000} step={100} unit="N"/>
      </div>
      <div className="bg-[#181c22] rounded-xl p-5 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Alarm Sounds</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {s.beepEnabled ? <Volume2 size={16} className="text-[#00daf3]"/> : <VolumeX size={16} className="text-[#849396]"/>}
            <span className="text-sm text-[#dfe2eb]">Beep on high alerts</span>
          </div>
          <button onClick={() => update('beepEnabled', !s.beepEnabled)}
            className="relative w-12 h-6 rounded-full transition-all"
            style={{ background: s.beepEnabled ? '#00daf3' : '#31353c' }}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${s.beepEnabled ? 'left-[26px]' : 'left-0.5'}`}/>
          </button>
        </div>
        <button onClick={alarmBeep}
          className="text-xs text-[#849396] hover:text-[#c3f5ff] border border-[#3b494c]/30 px-3 py-2 rounded-xl transition-colors">
          🔊 Test alarm sound
        </button>
      </div>
      <div className="bg-[#181c22] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key size={13} className="text-[#ffba38]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">AI API Key (Optional)</span>
        </div>
        <p className="text-xs text-[#849396] leading-relaxed">
          Set <code className="text-[#00daf3] bg-[#1c2026] px-1 rounded">AI_API_KEY=sk-…</code> when running sensor_bridge.py for AI-powered estimation. Without it, physics math is used — still accurate.
        </p>
        <input type="password" value={s.aiApiKey || ''} onChange={e => update('aiApiKey', e.target.value)}
          placeholder="sk-…"
          className="w-full bg-[#1c2026] border border-[#3b494c]/30 text-[#dfe2eb] text-xs rounded-xl px-3 py-2.5 outline-none focus:border-[#00daf3]/40 placeholder-[#3b494c]"/>
      </div>
      <button onClick={handleSave}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
          saved ? 'bg-[#00daf3]/20 text-[#00daf3] border border-[#00daf3]/20' : 'bg-gradient-to-r from-[#c3f5ff] to-[#00e5ff] text-[#001f24] hover:opacity-90'}`}>
        <Save size={14}/>
        {saved ? '✓ Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
