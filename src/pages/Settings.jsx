import React, { useState } from 'react';
import Header from '../components/Header';
import { Save, RefreshCw } from 'lucide-react';

const DEFAULT_THRESHOLDS = {
  temperature:       { warn: 70, crit: 85 },
  vibration:         { warn: 3.0, crit: 4.0 },
  hydraulicPressure: { warn: 130, crit: 110 },
  motorCurrent:      { warn: 32, crit: 36 },
  cycleTime:         { warn: 25, crit: 30 },
};

export default function Settings() {
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [refreshRate, setRefreshRate] = useState(2000);
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({ email: false, sound: true, popup: true });

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex-1 overflow-auto">
      <Header title="Settings" subtitle="Configure thresholds and notifications" alertCount={0} />
      <div className="p-8 grid-bg min-h-screen">

        <div className="max-w-3xl space-y-6">

          {/* Refresh rate */}
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
            <h3 className="text-sm font-mono mb-4 tracking-widest" style={{ color: '#00d4ff' }}>DATA REFRESH RATE</h3>
            <div className="flex gap-3">
              {[1000, 2000, 5000, 10000].map(r => (
                <button key={r} onClick={() => setRefreshRate(r)}
                  className="px-4 py-2 rounded-xl text-sm font-mono transition-all"
                  style={{
                    background: refreshRate === r ? '#00d4ff18' : '#0a0e1a',
                    color:      refreshRate === r ? '#00d4ff'   : '#64748b',
                    border:     `1px solid ${refreshRate === r ? '#00d4ff33' : '#1e3a5f'}`,
                  }}>
                  {r / 1000}s
                </button>
              ))}
            </div>
          </div>

          {/* Thresholds */}
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
            <h3 className="text-sm font-mono mb-4 tracking-widest" style={{ color: '#00d4ff' }}>ALERT THRESHOLDS</h3>
            <div className="space-y-4">
              {Object.entries(thresholds).map(([key, val]) => (
                <div key={key} className="grid grid-cols-3 gap-4 items-center">
                  <p className="text-sm capitalize" style={{ color: '#e2e8f0' }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <div>
                    <label className="text-xs font-mono mb-1 block" style={{ color: '#ffd700' }}>WARN</label>
                    <input
                      type="number"
                      value={val.warn}
                      onChange={e => setThresholds(prev => ({
                        ...prev,
                        [key]: { ...prev[key], warn: parseFloat(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 rounded-xl text-sm font-mono outline-none"
                      style={{ background: '#0a0e1a', border: '1px solid #ffd70033', color: '#ffd700' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono mb-1 block" style={{ color: '#ff4444' }}>CRITICAL</label>
                    <input
                      type="number"
                      value={val.crit}
                      onChange={e => setThresholds(prev => ({
                        ...prev,
                        [key]: { ...prev[key], crit: parseFloat(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 rounded-xl text-sm font-mono outline-none"
                      style={{ background: '#0a0e1a', border: '1px solid #ff444433', color: '#ff4444' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
            <h3 className="text-sm font-mono mb-4 tracking-widest" style={{ color: '#00d4ff' }}>NOTIFICATIONS</h3>
            <div className="space-y-3">
              {Object.entries(notifications).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm capitalize" style={{ color: '#e2e8f0' }}>{key} Notifications</span>
                  <button
                    onClick={() => setNotifications(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="w-12 h-6 rounded-full transition-all relative"
                    style={{ background: val ? '#00d4ff' : '#1e3a5f' }}>
                    <span className="absolute top-1 w-4 h-4 rounded-full transition-all"
                      style={{
                        left: val ? '26px' : '4px',
                        background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <button onClick={handleSave}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-mono text-sm transition-all"
            style={{
              background: saved ? '#00ff8818' : '#00d4ff18',
              color:      saved ? '#00ff88'   : '#00d4ff',
              border:     `1px solid ${saved ? '#00ff8833' : '#00d4ff33'}`,
            }}>
            {saved ? <><RefreshCw size={16} /> SAVED!</> : <><Save size={16} /> SAVE SETTINGS</>}
          </button>
        </div>
      </div>
    </div>
  );
}
