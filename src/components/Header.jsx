import React, { useState, useEffect } from 'react';
import { Bell, RefreshCw } from 'lucide-react';

export default function Header({ title, subtitle, alertCount }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="flex items-center justify-between px-8 py-5 border-b"
      style={{ borderColor: '#1e3a5f', background: '#0d1321' }}>

      <div>
        <h1 className="text-xl font-bold tracking-wide" style={{ color: '#e2e8f0' }}>{title}</h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>{subtitle}</p>}
      </div>

      <div className="flex items-center gap-6">
        {/* Live clock */}
        <div className="text-right">
          <p className="text-lg font-mono font-semibold" style={{ color: '#00d4ff' }}>
            {time.toLocaleTimeString()}
          </p>
          <p className="text-xs" style={{ color: '#64748b' }}>
            {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>

        {/* Refresh indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
          <RefreshCw size={12} style={{ color: '#00ff88', animation: 'sweep 3s linear infinite' }} />
          <span className="text-xs font-mono" style={{ color: '#00ff88' }}>LIVE</span>
        </div>

        {/* Alert bell */}
        <div className="relative cursor-pointer p-2 rounded-lg transition-all"
          style={{ background: alertCount > 0 ? '#ff444415' : '#111827', border: `1px solid ${alertCount > 0 ? '#ff444433' : '#1e3a5f'}` }}>
          <Bell size={18} style={{ color: alertCount > 0 ? '#ff4444' : '#64748b' }} />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
              style={{ background: '#ff4444', color: 'white' }}>
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
