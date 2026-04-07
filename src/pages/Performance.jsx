import { useState, useEffect } from 'react';
import { getReadings } from '../utils/storage';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Activity, TrendingUp, CheckCircle, Zap, Clock } from 'lucide-react';

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

// Realistic dummy OEE data when no sensor readings exist
function useDummyOEE() {
  const [data, setData] = useState([]);
  useEffect(() => {
    const now = Date.now();
    const pts = Array.from({ length: 20 }, (_, i) => {
      const t = new Date(now - (19 - i) * 60000);
      return {
        time: t.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        oee:  88 + (Math.random() - 0.5) * 4,
        avail: 91 + (Math.random() - 0.5) * 3,
        perf:  93 + (Math.random() - 0.5) * 3,
        qual:  96 + (Math.random() - 0.5) * 2,
        temp:  29.8 + (Math.random() - 0.5) * 4,
        volt:  4.93 + (Math.random() - 0.5) * 0.06,
      };
    });
    setData(pts);
    const id = setInterval(() => {
      setData(prev => {
        const t = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
        return [...prev.slice(-29), {
          time: t,
          oee:  88 + (Math.random() - 0.5) * 4,
          avail: 91 + (Math.random() - 0.5) * 3,
          perf:  93 + (Math.random() - 0.5) * 3,
          qual:  96 + (Math.random() - 0.5) * 2,
          temp:  29.8 + (Math.random() - 0.5) * 4,
          volt:  4.93 + (Math.random() - 0.5) * 0.06,
        }];
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);
  return data;
}

function StatCard({ label, value, unit, color, icon: Icon, sub }) {
  return (
    <div className="bg-[#1c2026] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} style={{ color }}/>
        <span className="text-[9px] uppercase tracking-[0.15em] text-[#849396]">{label}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-black font-headline" style={{ color }}>{value}</span>
        <span className="text-[#849396] text-sm mb-1">{unit}</span>
      </div>
      {sub && <div className="text-[9px] text-[#849396] mt-1">{sub}</div>}
    </div>
  );
}

export default function Performance() {
  const [readings, setReadings] = useState([]);
  const dummyData = useDummyOEE();

  useEffect(() => {
    const load = () => setReadings(getReadings().slice(-300));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const hasRealData = readings.length > 5;

  // Build chart data from real readings or dummy
  const chartData = hasRealData
    ? readings.map(r => ({
        time: new Date(r.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        temp: r.temperature_c,
        volt: r.supply_voltage_v,
        life: r.remaining_life_pct,
      }))
    : dummyData;

  // OEE — realistic if real data, dummy if not
  let oee, availability, performance, quality;
  if (hasRealData) {
    const total      = readings.length;
    const failed     = readings.filter(r => r.tool_status === 'failed').length;
    const newCount   = readings.filter(r => r.tool_status === 'new').length;
    const wornCount  = readings.filter(r => r.tool_status === 'worn').length;
    availability = total ? ((total - failed) / total * 100) : 0;
    performance  = total ? ((newCount + wornCount) / total * 100) : 0;
    quality      = total ? (newCount / total * 100) : 0;
    oee          = (availability / 100) * (performance / 100) * (quality / 100) * 100;
  } else {
    const latest = dummyData[dummyData.length - 1] ?? {};
    oee          = latest.oee   ?? 88.5;
    availability = latest.avail ?? 91.2;
    performance  = latest.perf  ?? 93.4;
    quality      = latest.qual  ?? 96.1;
  }

  const oeeColor = oee >= 85 ? '#00e5ff' : oee >= 65 ? '#ffba38' : '#ffb4ab';

  // Avg temp from real or last dummy point
  const avgTemp = hasRealData
    ? (readings.reduce((a, r) => a + (r.temperature_c || 0), 0) / readings.length).toFixed(1)
    : (dummyData.reduce((a, d) => a + (d.temp || 0), 0) / (dummyData.length || 1)).toFixed(1);

  const latestVolt = hasRealData
    ? (readings[readings.length - 1]?.supply_voltage_v ?? 4.93).toFixed(2)
    : (dummyData[dummyData.length - 1]?.volt ?? 4.93).toFixed(2);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Performance Analysis</h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">
            {hasRealData ? `${readings.length} live readings` : 'Demo mode — realistic simulated OEE'}
          </div>
        </div>
        {!hasRealData && (
          <span className="text-[9px] bg-[#ffba38]/10 text-[#ffba38] border border-[#ffba38]/20 px-3 py-1.5 rounded-full uppercase tracking-wider">
            Demo Data
          </span>
        )}
      </div>

      {/* OEE Section */}
      <div className="bg-[#181c22] rounded-xl p-5 border border-[#3b494c]/20">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-[#00daf3]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">OEE — Overall Equipment Effectiveness</span>
          <span className="text-[9px] text-[#849396] ml-auto">Availability × Performance × Quality</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard label="OEE Score"    value={oee.toFixed(1)}          color={oeeColor}   icon={TrendingUp} unit="%"/>
          <StatCard label="Availability" value={availability.toFixed(1)} color="#00e5ff"    icon={CheckCircle} unit="%"/>
          <StatCard label="Performance"  value={performance.toFixed(1)}  color="#ffba38"    icon={Activity} unit="%"/>
          <StatCard label="Quality Rate" value={quality.toFixed(1)}      color="#818cf8"    icon={Zap} unit="%"/>
        </div>
        <div>
          <div className="flex justify-between text-[9px] text-[#849396] mb-1.5">
            <span>TARGET: 85%</span>
            <span style={{ color: oeeColor }}>{oee.toFixed(1)}% ACTUAL</span>
          </div>
          <div className="h-2.5 bg-[#10141a] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, oee)}%`, background: `linear-gradient(90deg, ${oeeColor}88, ${oeeColor})` }}/>
          </div>
          <div className="text-[9px] text-[#849396] mt-1.5">
            {oee >= 85 ? '✓ World-class OEE' : oee >= 65 ? '⚠ Below target — monitor worn readings' : '✗ Poor OEE — immediate attention'}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Avg Temperature"  value={avgTemp}     unit="°C" color="#ff9259" icon={Activity}/>
        <StatCard label="Supply Voltage"   value={latestVolt}  unit="V"  color="#4ade80" icon={Zap}/>
        <StatCard label="OEE Score"        value={oee.toFixed(1)} unit="%" color={oeeColor} icon={TrendingUp}/>
        <StatCard label="Data Points"      value={hasRealData ? readings.length : dummyData.length} unit="" color="#818cf8" icon={Clock} sub={hasRealData ? 'Live readings' : 'Demo points'}/>
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1c2026] rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mb-4">OEE Trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="oeeG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={oeeColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={oeeColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3b494c22"/>
              <XAxis dataKey="time" tick={{ fill: '#849396', fontSize: 9 }} interval="preserveStartEnd"/>
              <YAxis domain={[60, 100]} tick={{ fill: '#849396', fontSize: 9 }}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="oee" stroke={oeeColor} fill="url(#oeeG)" strokeWidth={2} name="OEE %"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1c2026] rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mb-4">Temperature Trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tempG2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff9259" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ff9259" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3b494c22"/>
              <XAxis dataKey="time" tick={{ fill: '#849396', fontSize: 9 }} interval="preserveStartEnd"/>
              <YAxis tick={{ fill: '#849396', fontSize: 9 }}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="temp" stroke="#ff9259" fill="url(#tempG2)" strokeWidth={2} name="Temp °C"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
