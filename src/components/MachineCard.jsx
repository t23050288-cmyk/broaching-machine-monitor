import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Zap } from 'lucide-react';
import { statusColor, statusLabel, sensorValueColor, SENSOR_LABELS } from '../utils/helpers';

const KEY_SENSORS = ['temperature', 'vibration', 'hydraulicPressure', 'motorCurrent'];

export default function MachineCard({ machine, state }) {
  const navigate = useNavigate();
  if (!state) return null;

  const sc = statusColor(state.status);

  return (
    <div
      className="card-hover cursor-pointer rounded-2xl p-5 transition-all"
      style={{ background: '#111827', border: `1px solid ${state.status === 'fault' ? '#ff444433' : '#1e3a5f'}` }}
      onClick={() => navigate(`/machines/${machine.id}`)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-mono mb-1" style={{ color: '#64748b' }}>{machine.id}</p>
          <h3 className="font-semibold text-base" style={{ color: '#e2e8f0' }}>{machine.name}</h3>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{machine.location} · {machine.type}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold"
            style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}44` }}>
            <span className="status-dot" style={{ background: sc, boxShadow: `0 0 6px ${sc}` }}></span>
            {statusLabel(state.status)}
          </span>
          {state.alerts.length > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#ff444418', color: '#ff4444', border: '1px solid #ff444433' }}>
              <AlertTriangle size={10} />
              {state.alerts.length} alert{state.alerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Efficiency', value: `${state.efficiency}%`, color: state.efficiency > 85 ? '#00ff88' : state.efficiency > 65 ? '#ffd700' : '#ff4444' },
          { label: 'Parts',      value: state.totalParts.toLocaleString(), color: '#00d4ff' },
          { label: 'Uptime',     value: `${state.uptime}%`, color: '#e2e8f0' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl p-3 text-center" style={{ background: '#0a0e1a' }}>
            <p className="text-lg font-bold font-mono" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Sensor rows */}
      <div className="space-y-2">
        {KEY_SENSORS.map(key => {
          const val = state.sensors[key];
          const col = sensorValueColor(key, val);
          const info = SENSOR_LABELS[key];
          return (
            <div key={key} className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: '#1e3a5f22' }}>
              <span className="text-xs" style={{ color: '#64748b' }}>{info.label}</span>
              <span className="text-xs font-mono font-semibold" style={{ color: col }}>
                {val} {info.unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
