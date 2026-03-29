import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';

function CustomTooltip({ active, payload, label, unit }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl px-3 py-2 text-xs font-mono"
        style={{ background: '#1a2235', border: '1px solid #1e3a5f', color: '#e2e8f0' }}>
        <p style={{ color: '#64748b' }}>{label}</p>
        <p style={{ color: payload[0].color }}>{payload[0].value} {unit}</p>
      </div>
    );
  }
  return null;
}

export default function LiveChart({ data = [], color = '#00d4ff', unit = '', warnLine, critLine }) {
  const vals  = data.map(d => d.value);
  const min   = Math.floor(Math.min(...vals) * 0.9);
  const max   = Math.ceil(Math.max(...vals) * 1.1);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`line-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f44" />
        <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#334155' }} interval="preserveStartEnd" />
        <YAxis domain={[min, max]} tick={{ fontSize: 9, fill: '#334155' }} />
        <Tooltip content={<CustomTooltip unit={unit} />} />
        {warnLine && <ReferenceLine y={warnLine} stroke="#ffd70066" strokeDasharray="4 4" />}
        {critLine && <ReferenceLine y={critLine} stroke="#ff444466" strokeDasharray="4 4" />}
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
