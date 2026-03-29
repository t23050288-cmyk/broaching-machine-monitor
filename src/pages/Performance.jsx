import { useState, useEffect } from 'react';
import { getReadings } from '../utils/storage';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c2026] border border-[#3b494c]/30 px-3 py-2 rounded-xl text-xs">
      <div className="text-[#849396] mb-1">{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: <b>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</b></div>)}
    </div>
  );
};

export default function Performance() {
  const [readings, setReadings] = useState([]);
  useEffect(() => {
    const load = () => setReadings(getReadings().slice(-200));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const chartData = readings.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    temp: r.temperature_c, vib: r.vibration_rms_mm_s2,
    current: r.spindle_current_a, force: r.cutting_force_n,
  }));

  const toolGroups = {};
  readings.forEach(r => {
    if (!toolGroups[r.tool_id]) toolGroups[r.tool_id] = { new: 0, worn: 0, failed: 0 };
    if (r.tool_status) toolGroups[r.tool_id][r.tool_status] = (toolGroups[r.tool_id][r.tool_status] || 0) + 1;
  });
  const barData = Object.entries(toolGroups).map(([id, s]) => ({ id, ...s }));

  const avgTemp  = readings.length ? (readings.reduce((a, r) => a + (r.temperature_c || 0), 0) / readings.length).toFixed(1) : '--';
  const avgVib   = readings.length ? (readings.reduce((a, r) => a + (r.vibration_rms_mm_s2 || 0), 0) / readings.length).toFixed(2) : '--';
  const failRate = readings.length ? ((readings.filter(r => r.tool_status === 'failed').length / readings.length) * 100).toFixed(1) : '0';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Performance Analysis</h1>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">Last {readings.length} readings from your device</div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[['Avg Temperature', avgTemp, '°C', '#00daf3'], ['Avg Vibration', avgVib, 'mm/s²', '#ffba38'], ['Failure Rate', failRate, '%', '#ffb4ab']].map(([l, v, u, c]) => (
          <div key={l} className="bg-[#1c2026] rounded-xl p-4 glow-cyan">
            <div className="text-[9px] uppercase tracking-[0.15em] text-[#849396] mb-2">{l}</div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-black font-headline" style={{ color: c }}>{v}</span>
              <span className="text-[#849396] text-sm mb-1">{u}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1c2026] rounded-xl p-4">
          <div className="text-[9px] uppercase tracking-[0.15em] text-[#849396] mb-3">Temperature & Vibration Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradT" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00daf3" stopOpacity={0.2}/><stop offset="95%" stopColor="#00daf3" stopOpacity={0}/></linearGradient>
                <linearGradient id="gradV" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ffba38" stopOpacity={0.15}/><stop offset="95%" stopColor="#ffba38" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3b494c" opacity={0.15}/>
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#849396' }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
              <YAxis tick={{ fontSize: 9, fill: '#849396' }} axisLine={false} tickLine={false} width={35}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{ fontSize: 10, color: '#849396' }}/>
              <Area type="monotone" dataKey="temp" stroke="#00daf3" fill="url(#gradT)" strokeWidth={2} name="Temp °C" dot={false}/>
              <Area type="monotone" dataKey="vib" stroke="#ffba38" fill="url(#gradV)" strokeWidth={2} name="Vib mm/s²" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4">
          <div className="text-[9px] uppercase tracking-[0.15em] text-[#849396] mb-3">Force & Current Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ffd799" stopOpacity={0.2}/><stop offset="95%" stopColor="#ffd799" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3b494c" opacity={0.15}/>
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#849396' }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
              <YAxis tick={{ fontSize: 9, fill: '#849396' }} axisLine={false} tickLine={false} width={35}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{ fontSize: 10, color: '#849396' }}/>
              <Area type="monotone" dataKey="force" stroke="#ffd799" fill="url(#gradF)" strokeWidth={2} name="Force N" dot={false}/>
              <Area type="monotone" dataKey="current" stroke="#9cf0ff" strokeWidth={2} name="Current A" dot={false} fill="none"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {barData.length > 0 && (
          <div className="bg-[#1c2026] rounded-xl p-4 lg:col-span-2">
            <div className="text-[9px] uppercase tracking-[0.15em] text-[#849396] mb-3">Tool Status Distribution</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3b494c" opacity={0.15}/>
                <XAxis dataKey="id" tick={{ fontSize: 10, fill: '#849396' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 9, fill: '#849396' }} axisLine={false} tickLine={false} width={30}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{ fontSize: 10, color: '#849396' }}/>
                <Bar dataKey="new" fill="#00daf3" name="New" radius={[2,2,0,0]}/>
                <Bar dataKey="worn" fill="#ffba38" name="Worn" radius={[2,2,0,0]}/>
                <Bar dataKey="failed" fill="#ffb4ab" name="Failed" radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
