import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Cpu, AlertTriangle, TrendingUp, Zap, CheckCircle } from 'lucide-react';
import Header from '../components/Header';
import MachineCard from '../components/MachineCard';
import { oeeColor, statusColor } from '../utils/helpers';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

export default function Dashboard({ machines, machineStates, alertLog, isConnected }) {
  const navigate  = useNavigate();
  const running   = machines.filter(m => machineStates[m.id]?.status === 'running').length;
  const faults    = machines.filter(m => machineStates[m.id]?.status === 'fault').length;
  const activeAlerts = alertLog.filter(a => !a.resolved).length;
  const avgEff    = machines.length
    ? (machines.reduce((s, m) => s + (machineStates[m.id]?.efficiency || 0), 0) / machines.length).toFixed(1)
    : 0;

  const effData = machines.map(m => ({
    name:  m.id,
    value: machineStates[m.id]?.efficiency || 0,
  }));

  const kpis = [
    { label: 'Machines Running', value: `${running}/${machines.length}`, icon: Cpu,           color: '#00ff88'  },
    { label: 'Active Alerts',    value: activeAlerts,                    icon: AlertTriangle,  color: activeAlerts > 0 ? '#ff4444' : '#00ff88' },
    { label: 'Avg Efficiency',   value: `${avgEff}%`,                    icon: TrendingUp,     color: oeeColor(parseFloat(avgEff)) },
    { label: 'Faults',           value: faults,                          icon: Zap,            color: faults > 0 ? '#ff4444' : '#00ff88' },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <Header
        title="Operations Dashboard"
        subtitle="Real-time broaching machine monitoring"
        alertCount={activeAlerts}
      />

      <div className="p-8 grid-bg min-h-screen">

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {kpis.map(kpi => (
            <div key={kpi.label} className="rounded-2xl p-5 card-hover"
              style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
              <div className="flex items-center justify-between mb-3">
                <kpi.icon size={20} style={{ color: kpi.color }} />
                <span className="status-dot" style={{ background: kpi.color, boxShadow: `0 0 6px ${kpi.color}` }}></span>
              </div>
              <p className="text-3xl font-bold font-mono" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Machine cards */}
        <h2 className="text-sm font-mono mb-4 tracking-widest" style={{ color: '#64748b' }}>— MACHINE STATUS</h2>
        <div className="grid grid-cols-2 gap-5 mb-8">
          {machines.map(m => (
            <MachineCard key={m.id} machine={m} state={machineStates[m.id]} />
          ))}
        </div>

        {/* Bottom row: efficiency chart + recent alerts */}
        <div className="grid grid-cols-2 gap-5">

          {/* Efficiency chart */}
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
            <h3 className="text-sm font-mono mb-4 tracking-widest" style={{ color: '#64748b' }}>EFFICIENCY BY MACHINE</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={effData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f44" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip formatter={v => [`${v}%`, 'Efficiency']}
                  contentStyle={{ background: '#1a2235', border: '1px solid #1e3a5f', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {effData.map((e, i) => (
                    <Cell key={i} fill={oeeColor(e.value)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent alerts */}
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
            <h3 className="text-sm font-mono mb-4 tracking-widest" style={{ color: '#64748b' }}>RECENT ALERTS</h3>
            <div className="space-y-2 max-h-52 overflow-auto">
              {alertLog.slice(0, 8).map(alert => (
                <div key={alert.id} className="flex items-center gap-3 py-2 border-b"
                  style={{ borderColor: '#1e3a5f22' }}>
                  <span className="status-dot flex-shrink-0" style={{ background: alert.color }}></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: alert.resolved ? '#64748b' : '#e2e8f0' }}>
                      {alert.label}
                    </p>
                    <p className="text-xs" style={{ color: '#334155' }}>{alert.machineId}</p>
                  </div>
                  {alert.resolved
                    ? <CheckCircle size={12} style={{ color: '#00ff88', flexShrink: 0 }} />
                    : <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: '#ff444415', color: '#ff4444' }}>ACTIVE</span>
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
