import React from 'react';
import { sensorValueColor, sensorThreshold } from '../utils/helpers';

export default function SensorGauge({ label, value, unit, min, max, sensorKey }) {
  const pct     = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const col     = sensorValueColor(sensorKey, value);
  const level   = sensorThreshold(sensorKey, value);

  const gradientId = `g-${sensorKey}`;

  return (
    <div className="rounded-2xl p-4" style={{ background: '#0a0e1a', border: '1px solid #1e3a5f' }}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs" style={{ color: '#64748b' }}>{label}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono"
          style={{
            background: `${col}15`,
            color: col,
            border: `1px solid ${col}33`,
          }}>
          {level.toUpperCase()}
        </span>
      </div>

      <p className="text-2xl font-bold font-mono mb-3" style={{ color: col }}>
        {value}<span className="text-sm ml-1 font-normal" style={{ color: '#64748b' }}>{unit}</span>
      </p>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#1e3a5f' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${col}88, ${col})`,
            boxShadow: `0 0 8px ${col}66`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs font-mono" style={{ color: '#1e3a5f' }}>{min}</span>
        <span className="text-xs font-mono" style={{ color: '#1e3a5f' }}>{max}</span>
      </div>
    </div>
  );
}
