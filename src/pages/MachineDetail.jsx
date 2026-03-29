import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity } from 'lucide-react';
import Header from '../components/Header';
import SensorGauge from '../components/SensorGauge';
import LiveChart from '../components/LiveChart';
import { statusColor, statusLabel, SENSOR_LABELS, formatDate } from '../utils/helpers';

const SENSOR_CONFIG = {
  temperature:       { min: 20,  max: 100, color: '#ff8c00', warnLine: 70, critLine: 85 },
  vibration:         { min: 0,   max: 6,   color: '#ffd700', warnLine: 3,  critLine: 4  },
  hydraulicPressure: { min: 80,  max: 210, color: '#00d4ff', warnLine: 130, critLine: 110 },
  spindleSpeed:      { min: 100, max: 900, color: '#a78bfa'  },
  motorCurrent:      { min: 5,   max: 45,  color: '#f472b6', warnLine: 32, critLine: 36 },
  cycleTime:         { min: 5,   max: 40,  color: '#34d399', warnLine: 25, critLine: 30 },
};

export default function MachineDetail({ machines, machineStates, timeSeriesData, alertLog }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('sensors');

  const machine = machines.find(m => m.id === id);
  const state   = machineStates[id];
  const ts      = timeSeriesData[id] || {};

  if (!machine || !state) return (
    <div className="flex-1 flex items-center justify-center" style={{ color: '#64748b' }}>
      Machine not found
    </div>
  );

  const machineAlerts = alertLog.filter(a => a.machineId === id);
  const sc = statusColor(state.status);

  return (
    <div className="flex-1 overflow-auto">
      <Header
        title={machine.name}
        subtitle={`${machine.id} · ${machine.location} · ${machine.type} Broach`}
        alertCount={machineAlerts.filter(a => !a.resolved).length}
      />

      <div className="p-8 grid-bg min-h-screen">

        {/* Back + status */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/machines')}
            className="flex items-center gap-2 text-sm transition-colors hover:text-white"
            style={{ color: '#64748b' }}>
            <ArrowLeft size={16} /> Back to Machines
          </button>
          <span className="flex items-center gap-2 px-4 py-2 rounded-full font-mono text-sm font-bold"
            style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}44` }}>
            <span className="status-dot" style={{ background: sc, boxShadow: `0 0 8px ${sc}` }}></span>
            {statusLabel(state.status)}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Parts',   value: state.totalParts.toLocaleString(), color: '#00d4ff'  },
            { label: 'Good Parts',    value: state.goodParts.toLocaleString(),  color: '#00ff88'  },
            { label: 'Efficiency',    value: `${state.efficiency}%`,            color: '#ffd700'  },
            { label: 'Uptime',        value: `${state.uptime}%`,               color: '#a78bfa'  },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-5 text-center" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
              <p className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['sensors', 'charts', 'alerts'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 rounded-xl text-sm font-mono transition-all"
              style={{
                background: tab === t ? '#00d4ff18' : '#111827',
                color:      tab === t ? '#00d4ff'   : '#64748b',
                border:     `1px solid ${tab === t ? '#00d4ff33' : '#1e3a5f'}`,
              }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab: sensors */}
        {tab === 'sensors' && (
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(SENSOR_LABELS).map(([key, info]) => (
              <SensorGauge
                key={key}
                label={info.label}
                value={state.sensors[key]}
                unit={info.unit}
                min={SENSOR_CONFIG[key]?.min ?? 0}
                max={SENSOR_CONFIG[key]?.max ?? 100}
                sensorKey={key}
              />
            ))}
          </div>
        )}

        {/* Tab: charts */}
        {tab === 'charts' && (
          <div className="grid grid-cols-2 gap-5">
            {Object.entries(SENSOR_CONFIG).map(([key, cfg]) => (
              <div key={key} className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-mono" style={{ color: '#e2e8f0' }}>{SENSOR_LABELS[key]?.label}</p>
                  <span className="text-xs font-mono font-bold" style={{ color: cfg.color }}>
                    {state.sensors[key]} {SENSOR_LABELS[key]?.unit}
                  </span>
                </div>
                <LiveChart
                  data={ts[key] || []}
                  color={cfg.color}
                  unit={SENSOR_LABELS[key]?.unit}
                  warnLine={cfg.warnLine}
                  critLine={cfg.critLine}
                />
              </div>
            ))}
          </div>
        )}

        {/* Tab: alerts */}
        {tab === 'alerts' && (
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #1e3a5f', color: '#64748b', fontSize: 11 }}>
                  {['ID', 'Alert', 'Severity', 'Time', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-mono tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {machineAlerts.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center" style={{ color: '#334155' }}>No alerts for this machine</td></tr>
                )}
                {machineAlerts.map(a => (
                  <tr key={a.id} className="border-b transition-colors" style={{ borderColor: '#1e3a5f22' }}>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: '#64748b' }}>{a.id}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: '#e2e8f0' }}>{a.label}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                        style={{ background: `${a.color}18`, color: a.color, border: `1px solid ${a.color}33` }}>
                        {a.severity}
                      </span>
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
