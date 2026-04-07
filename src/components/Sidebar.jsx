import { useState } from 'react';
import { Activity, BarChart2, AlertTriangle, Settings, Package, Database, ChevronLeft, ChevronRight, Brain, MessageCircle, Table, ShieldAlert } from 'lucide-react';

const navItems = [
  { icon: Activity,      label: 'Health Pulse',      path: 'dashboard' },
  { icon: BarChart2,     label: 'Performance',        path: 'performance' },
  { icon: Package,       label: 'Tool Inventory',     path: 'inventory' },
  { icon: ShieldAlert,   label: 'Damage Prevention',  path: 'damage' },
  { icon: AlertTriangle, label: 'Alert Center',       path: 'alerts' },
  { icon: Database,      label: 'Data Records',       path: 'records' },
  { icon: Table,         label: 'Sensor Readings',    path: 'readings' },
  { icon: Brain,         label: 'AI Predictor',       path: 'predictor' },
  { icon: MessageCircle, label: 'AI Chatbot',         path: 'chatbot' },
  { icon: Settings,      label: 'Settings',           path: 'settings' },
];

const AI_PATHS = ['predictor', 'chatbot'];

export default function Sidebar({ current, onChange }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside className={`flex flex-col h-screen py-6 bg-[#181c22] border-r border-[#3b494c]/15 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} flex-shrink-0`}>
      <div className="px-4 mb-8 flex items-center justify-between">
        {!collapsed && (
          <div>
            <div className="text-base font-black text-[#c3f5ff] font-headline uppercase tracking-widest">KINETIC FORGE</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">Broaching Intelligence</div>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="text-[#849396] hover:text-[#c3f5ff] transition-colors ml-auto">
          {collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
        </button>
      </div>
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isAI     = AI_PATHS.includes(path);
          const isDmg    = path === 'damage';
          const isActive = current === path;
          return (
            <button key={path} onClick={() => onChange(path)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all duration-150 rounded-lg
                ${
                  isActive && isAI  ? 'bg-[#c084fc]/10 border-l-2 border-[#c084fc] text-[#c084fc]' :
                  isActive && isDmg ? 'bg-amber-500/10 border-l-2 border-amber-400 text-amber-400' :
                  isActive          ? 'bg-[#1c2026] border-l-2 border-[#00e5ff] text-[#c3f5ff]' :
                  isAI              ? 'text-[#849396] hover:bg-[#c084fc]/5 hover:text-[#c084fc]' :
                  isDmg             ? 'text-[#849396] hover:bg-amber-500/5 hover:text-amber-400' :
                                      'text-[#849396] hover:bg-[#1c2026] hover:text-[#dfe2eb]'
                }`}>
              <Icon size={18} className="flex-shrink-0"/>
              {!collapsed && <span className="font-body truncate">{label}</span>}
              {!collapsed && isAI && (
                <span className="ml-auto text-[8px] bg-[#c084fc]/20 text-[#c084fc] px-1.5 py-0.5 rounded-full font-bold">AI</span>
              )}
              {!collapsed && isDmg && (
                <span className="ml-auto text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
              )}
            </button>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="px-4 mt-4">
          <div className="text-[9px] uppercase tracking-[0.2em] text-[#3b494c] text-center">v4.0 · AI Enhanced</div>
        </div>
      )}
    </aside>
  );
}
