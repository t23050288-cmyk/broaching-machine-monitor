import { useState } from 'react';
import {
  ShieldAlert, Activity, Package, Bell, Database,
  Brain, Table, History, Settings, ChevronLeft, ChevronRight, Cpu
} from 'lucide-react';

const nav = [
  { icon: ShieldAlert, label: 'Damage Prevention', path: 'damage',    badge: 'PRIMARY' },
  { icon: Activity,    label: '18-Sensor Telemetry', path: 'dashboard' },
  { icon: History,     label: 'Original Sensor Log', path: 'original', badge: 'DEMO'  },
  { icon: Package,     label: 'Tool Inventory & RUL', path: 'inventory' },
  { icon: Bell,        label: 'Alert Center',         path: 'alerts'   },
  { icon: Database,    label: 'Data Records',          path: 'records'  },
  { icon: Brain,       label: 'AI Predictor',          path: 'predictor' },
  { icon: Table,       label: 'Sensor Readings',       path: 'readings' },
  { icon: Settings,    label: 'Settings',              path: 'settings' },
];

export default function Sidebar({ current, onChange }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside className={`flex flex-col h-screen bg-slate-950 border-r border-slate-800 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-800 ${collapsed ? 'justify-center' : ''}`}>
        <Cpu size={20} className="text-emerald-400 flex-shrink-0"/>
        {!collapsed && (
          <div>
            <div className="font-black text-sm text-slate-100 tracking-wide">PROJECT ZENITH</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Industrial ADPS</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ icon: Icon, label, path, badge }) => {
          const active = current === path;
          return (
            <button key={path} onClick={() => onChange(path)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all relative
                ${active ? 'bg-emerald-500/10 text-emerald-400 border-r-2 border-emerald-400'
                         : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <Icon size={16} className="flex-shrink-0"/>
              {!collapsed && (
                <span className="text-xs font-medium flex-1">{label}</span>
              )}
              {!collapsed && badge && (
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded tracking-wider
                  ${badge === 'PRIMARY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all">
          {collapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
        </button>
      </div>
    </aside>
  );
}
