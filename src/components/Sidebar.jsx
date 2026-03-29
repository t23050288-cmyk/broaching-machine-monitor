import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, LayoutDashboard, AlertTriangle, BarChart2, Settings, Cpu, Zap } from 'lucide-react';

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/machines',  icon: Cpu,             label: 'Machines'   },
  { to: '/analytics', icon: BarChart2,       label: 'Analytics'  },
  { to: '/alerts',    icon: AlertTriangle,   label: 'Alerts'     },
  { to: '/settings',  icon: Settings,        label: 'Settings'   },
];

export default function Sidebar({ isConnected, alertCount }) {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 z-50 flex flex-col"
      style={{ background: '#111827', borderRight: '1px solid #1e3a5f' }}>

      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: '#1e3a5f' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #00d4ff22, #00d4ff44)', border: '1px solid #00d4ff55' }}>
            <Zap size={20} style={{ color: '#00d4ff' }} />
          </div>
          <div>
            <p className="font-bold text-sm tracking-widest" style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono, monospace' }}>BROACH</p>
            <p className="text-xs" style={{ color: '#64748b' }}>MONITOR v2.0</p>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="px-4 py-3 mx-4 mt-4 rounded-lg" style={{ background: '#0a0e1a', border: '1px solid #1e3a5f' }}>
        <div className="flex items-center gap-2">
          <span className="status-dot" style={{
            background: isConnected ? '#00ff88' : '#ff4444',
            boxShadow: isConnected ? '0 0 8px #00ff88' : '0 0 8px #ff4444',
            animation: 'pulse-red 1.5s infinite',
          }}></span>
          <span className="text-xs font-mono" style={{ color: isConnected ? '#00ff88' : '#ff4444' }}>
            {isConnected ? 'LIVE · CONNECTED' : 'CONNECTING...'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${
                isActive
                  ? 'text-white font-medium'
                  : 'text-slate-400 hover:text-white'
              }`
            }
            style={({ isActive }) => isActive ? {
              background: 'linear-gradient(135deg, #00d4ff18, #00d4ff08)',
              border: '1px solid #00d4ff33',
              color: '#00d4ff',
            } : {}}
          >
            <Icon size={18} />
            <span>{label}</span>
            {label === 'Alerts' && alertCount > 0 && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-mono"
                style={{ background: '#ff444433', color: '#ff4444', border: '1px solid #ff444466' }}>
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t" style={{ borderColor: '#1e3a5f' }}>
        <p className="text-xs text-center font-mono" style={{ color: '#1e3a5f' }}>
          © 2026 BROACH SYSTEMS
        </p>
      </div>
    </aside>
  );
}
