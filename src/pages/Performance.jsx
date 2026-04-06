import { useState, useEffect } from 'react';
import { getReadings } from '../utils/storage';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { Activity, TrendingUp, Clock, Zap, CheckCircle } from 'lucide-react';

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

function OEECard({ label, value, color, icon: Icon, unit = '%' }) {
  return (
    <div className="bg-[#1c2026] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} style={{ color }}/>
        <span className="text-[9px] uppercase tracking-[0.15em] text-[#849396]">{label}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-black font-headline" style={{ color }}>{value}</span>
        <span className="text-[#849396] text-sm mb-1">{unit}</span>
      </div>
    </div>
  );
}

export default function Performance() {
  const [readings, setReadings] = useState([]);

  useEffect(() => {
    const load = () => setReadings(getReadings().slice(-300));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const chartData = readings.map(r => ({
    time:    new Date(r.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    temp:    r.temperature_c,
    vib:     r.vibration_rms_mm_s2,
    current: r.spindle_current_a,
    force:   r.cutting_force_n,
    life:    r.remaining_life_pct,
    wear:    r.wear_progression,
  }));

  const toolGroups = {};
  readings.forEach(r => {
    if (!toolGroups[r.tool_id]) toolGroups[r.tool_id] = { new: 0, worn: 0, failed: 0 };
    if (r.tool_status) toolGroups[r.tool_id][r.tool_status] = (toolGroups[r.tool_id][r.tool_status] || 0) + 1;
  });
  const barData = Object.entries(toolGroups).map(([id, s]) => ({ id, ...s }));

  const total   = readings.length;
  const newCount    = readings.filter(r => r.tool_status === 'new').length;
  const wornCount   = readings.filter(r => r.tool_status === 'worn').length;
  const failedCount = readings.filter(r => r.tool_status === 'failed').length;

  // OEE calculation
  // Availability = non-failed readings / total
  // Performance  = (new + worn) / total
  // Quality      = new readings / total
  const availability = total ? ((total - failedCount) / total * 100) : 0;
  const performance  = total ? ((newCount + wornCount) / total * 100) : 0;
  const quality      = total ? (newCount / total * 100) : 0;
  const oee          = (availability / 100) * (performance / 100) * (quality / 100) * 100;

  const avgTemp  = total ? (readings.reduce((a, r) => a + (r.temperature_c || 0), 0) / total).toFixed(1) : '--';
  const avgVib   = total ? (readings.reduce((a, r) => a + (r.vibration_rms_mm_s2 || 0), 0) / total).toFixed(2) : '--';
  const failRate = total ? ((failedCount / total) * 100).toFixed(1) : '0';
  const latestLife = readings.length ? readings[readings.length - 1]?.remaining_life_pct : null;

  const oeeColor = oee >= 85 ? '#00e5ff' : oee >= 65 ? '#ffba38' : '#ffb4ab';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Performance Analysis</h1>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">Last {total} readings from your device</div>
      </div>

      {/* OEE Section */}
      <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-[#00daf3]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">OEE — Overall Equipment Effectiveness</span>
          <span className="text-[9px] text-[#849396] ml-auto">Availability × Performance × Quality</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <OEECard label="OEE Score"     value={oee.toFixed(1)}          color={oeeColor}    icon={TrendingUp}/>
          <OEECard label="Availability"  value={availability.toFixed(1)} color="#00e5ff"     icon={CheckCircle}/>
          <OEECard label="Performance"   value={performance.toFixed(1)}  color="#ffba38"     icon={Activity}/>
          <OEECard label="Quality Rate"  value={quality.toFixed(1)}      color="#818cf8"     icon={Zap}/>
        </div>
        {/* OEE bar */}
        <div>
          <div className="flex justify-between text-[9px] text-[#849396] mb-1.5">
            <span>OEE TARGET: 85%</span>
            <span style={{ color: oeeColor }}>{oee.toFixed(1)}% ACTUAL</span>
          </div>
          <div className="h-2.5 bg-[#10141a] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, oee)}%`, background: `linear-gradient(90deg, ${oeeColor}99, ${oeeColor})` }}/>
          </div>
          <div className="text-[9px] text-[#849396] mt-1">
            {oee >= 85 ? '✓ World-class OEE achieved' : oee >= 65 ? '⚠ Below target — check worn/failed readings' : '✗ Poor OEE — immediate attention required'}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Avg Temperature', avgTemp,  '°C',  '#00daf3'],
          ['Avg Vibration',   avgVib,   'mm/s²','#ffba38'],
          ['Failure Rate',    failRate, '%',    '#ffb4ab'],
          ['Tool Life Left',  latestLife != null ? latestLife.toFixed(1) : '--', '%', '#00e5ff'],
        ].map(([l, v, u, c]) => (
          <div key={l} className="bg-[#1c2026] rounded-xl p-4">
            <div className="text-[9px] uppercase tracking-[0.15em] text-[#849396] mb-2">{l}</div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-black font-headline" style={{ color: c }}>{v}</span>
              <span className="text-[#849396] text-sm mb-1">{u}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tool Life trend chart */}
      {chartData.some(d => d.life != null) && (
        <div className="bg-[#1c2026] rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mb-4 flex items-center gap-2">
            <Clock size={12} className="text-[#00e5ff]"/> Tool Life % Over Time
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="lifeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00e5ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3b494c22"/>
              <XAxis dataKey="time" tick={{ fill: '#849396', fontSize: 9 }} interval="preserveStartEnd"/>
              <YAxis domain={[0, 100]} tick={{ fill: '#849396', fontSize: 9 }}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="life" stroke="#00e5ff" fill="url(#lifeGrad)" strokeWidth={2} name="Life %"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sensor trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1c2026] rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mb-4">Temperature & Vibration</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tempG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00daf3" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00daf3" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="vibG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ffba38" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ffba38" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3b494c22"/>
              <XAxis dataKey="time" tick={{ fill: '#849396', fontSize: 9 }} interval="preserveStartEnd"/>
              <YAxis tick={{ fill: '#849396', fontSize: 9 }}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{ fontSize: '10px', color: '#849396' }}/>
              <Area type="monotone" dataKey="temp"    stroke="#00daf3" fill="url(#tempG)" strokeWidth={2} name="Temp °C"/>
              <Area type="monotone" dataKey="vib"     stroke="#ffba38" fill="url(#vibG)"  strokeWidth={2} name="Vib mm/s²"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1c2026] rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mb-4">Tool Status Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3b494c22"/>
              <XAxis dataKey="id" tick={{ fill: '#849396', fontSize: 9 }}/>
              <YAxis tick={{ fill: '#849396', fontSize: 9 }}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{ fontSize: '10px', color: '#849396' }}/>
              <Bar dataKey="new"    fill="#00e5ff" name="New"    radius={[3,3,0,0]}/>
              <Bar dataKey="worn"   fill="#ffba38" name="Worn"   radius={[3,3,0,0]}/>
              <Bar dataKey="failed" fill="#ffb4ab" name="Failed" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
