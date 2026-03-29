import React, { useState } from 'react';
import Header from '../components/Header';
import { CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { formatDate, severityColor } from '../utils/helpers';

function SeverityIcon({ severity }) {
  if (severity === 'critical') return <XCircle      size={14} style={{ color: '#ff4444' }} />;
  if (severity === 'warning')  return <AlertTriangle size={14} style={{ color: '#ffd700' }} />;
  return                              <Info          size={14} style={{ color: '#00d4ff' }} />;
}

export default function Alerts({ alertLog, acknowledgeAlert }) {
  const [filter, setFilter] = useState('all');

  const filtered = alertLog.filter(a => {
    if (filter === 'active')   return !a.resolved;
    if (filter === 'resolved') return  a.resolved;
    if (filter === 'critical') return  a.severity === 'critical';
    return true;
  });

  const active    = alertLog.filter(a => !a.resolved).length;
  const critical  = alertLog.filter(a => a.severity === 'critical' && !a.resolved).length;
  const warnings  = alertLog.filter(a => a.severity === 'warning'  && !a.resolved).length;
  const resolved  = alertLog.filter(a =>  a.resolved).length;

  return (
    <div className="flex-1 overflow-auto">
      <Header title="Alert Center" subtitle="Monitor and acknowledge system alerts" alertCount={active} />
      <div className="p-8 grid-bg min-h-screen">

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Alerts', value: active,   color: active   > 0 ? '#ff4444' : '#00ff88', icon: AlertTriangle },
            { label: 'Critical',      value: critical, color: critical > 0 ? '#ff4444' : '#00ff88', icon: XCircle },
            { label: 'Warnings',      value: warnings, color: warnings > 0 ? '#ffd700' : '#00ff88', icon: AlertTriangle },
            { label: 'Resolved',      value: resolved, color: '#00ff88',                             icon: CheckCircle  },
          ].map(c => (
            <div key={c.label} className="rounded-2xl p-5 card-hover"
              style={{ background: '#111827', border: `1px solid ${c.color}33` }}>
              <div className="flex items-center justify-between mb-3">
                <c.icon size={18} style={{ color: c.color }} />
              </div>
              <p className="text-3xl font-bold font-mono" style={{ color: c.color }}>{c.value}</p>
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>{c.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {['all', 'active', 'critical', 'resolved'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-widest transition-all"
              style={{
                background: filter === f ? '#00d4ff18' : '#111827',
                color:      filter === f ? '#00d4ff'   : '#64748b',
                border:     `1px solid ${filter === f ? '#00d4ff33' : '#1e3a5f'}`,
              }}>
              {f}
            </button>
          ))}
        </div>

        {/* Alert table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1e3a5f', fontSize: 10 }}>
                {['ID', 'Severity', 'Alert', 'Machine', 'Time', 'Status', 'Action'].map(h => (
                  <th key={h} className="px-5 py-3 text-left font-mono tracking-widest" style={{ color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center" style={{ color: '#334155' }}>No alerts match this filter</td></tr>
              )}
              {filtered.map(a => (
                <tr key={a.id} className="border-b transition-all hover:bg-white hover:bg-opacity-5"
                  style={{ borderColor: '#1e3a5f18' }}>
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: '#64748b' }}>{a.id}</td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1.5 text-xs"
                      style={{ color: severityColor(a.severity) }}>
                      <SeverityIcon severity={a.severity} />
                      {a.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: a.resolved ? '#64748b' : '#e2e8f0' }}>{a.label}</td>
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: '#00d4ff' }}>{a.machineId}</td>
                  <td className="px-5 py-3 text-xs font-mono" style={{ color: '#64748b' }}>{formatDate(a.ts)}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                      style={{
                        background: a.resolved ? '#00ff8815' : '#ff444415',
                        color:      a.resolved ? '#00ff88'   : '#ff4444',
                        border:     `1px solid ${a.resolved ? '#00ff8833' : '#ff444433'}`,
                      }}>
                      {a.resolved ? 'RESOLVED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {!a.resolved && (
                      <button onClick={() => acknowledgeAlert(a.id)}
                        className="text-xs px-3 py-1 rounded-lg transition-all hover:opacity-80"
                        style={{ background: '#00ff8818', color: '#00ff88', border: '1px solid #00ff8833' }}>
                        ACK
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
