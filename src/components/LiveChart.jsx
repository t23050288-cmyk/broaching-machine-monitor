import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2026] border border-[#3b494c]/30 px-3 py-2 rounded-xl text-xs">
      <div className="text-[#849396] mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: <b>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</b></div>
      ))}
    </div>
  );
};

export default function LiveChart({ data, dataKey, color = '#00daf3', unit = '', limit, label, height = 120 }) {
  return (
    <div>
      {label && <div className="text-[9px] uppercase tracking-[0.15em] text-[#bac9cc] mb-2">{label}</div>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#849396' }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
          <YAxis tick={{ fontSize: 9, fill: '#849396' }} axisLine={false} tickLine={false} width={35}/>
          <Tooltip content={<CustomTooltip/>}/>
          {limit && <ReferenceLine y={limit} stroke="#ffb4ab" strokeDasharray="3 3" strokeOpacity={0.6}/>}
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false}
            name={label || dataKey} style={{ filter: `drop-shadow(0 0 4px ${color}55)` }}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
