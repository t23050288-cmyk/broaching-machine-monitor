import React, { useState } from 'react';
import Header from '../components/Header';
import LiveChart from '../components/LiveChart';
import { oeeColor, SENSOR_LABELS } from '../utils/helpers';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#00d4ff', '#00ff88', '#ffd700', '#ff8c00'];

export default function Analytics({ machines, machineStates, timeSeriesData, alertLog }) {
  const [selected, setSelected] = useState(machines[0]?.id);
  const activeAlerts = alertLog.filter(a => !a.resolved).length;

  const ts   = timeSeriesData[selected] || {};
  const state = machineStates[selected];

  // OEE per machine
  const oeeData = machines.map(m => {
    const s = machineStates[m.id];
    if (!s) return { name: m.id, oee: 0 };
    const avail = s.uptime / 100;
    const perf  = s.efficiency / 100;
    const qual  = s.goodParts / (s.totalParts || 1);
    return { name: m.id, oee: parseFloat((avail * perf * qual * 100).toFixed(1)) };
  });

  // Parts production per machine
  const partsData = machines.map((m, i) => ({
    name: m.id,
    total: machineStates[m.id]?.totalParts || 0,
    good:  machineStates[m.id]?.goodParts  || 0,
    fill:  COLORS[i % COLORS.length],
  }));

  // Radar for first selected machine
  const radarData = state ? [
    { metric: 'Efficiency', value: state.efficiency },
    { metric: 'Uptime',     value: state.uptime },
    { metric: 'Quality',    value: state.totalParts ? (state.goodParts / state.totalParts * 100) : 0 },
    { metric: 'Temperature',value: 100 - ((state.sensors.temperature - 20) / 80 * 100) },
    { metric: 'Vibration',  value: 100 - (state.sensors.vibration / 5 * 100) },
    { metric: 'Pressure',   value: (state.sensors.hydraulicPressure / 200 * 100) },
  ] : [];

  return (
    <div className="flex-1 overflow-auto">
      <Header title="Analytics" subtitle="Performance metrics and trends" alertCount={activeAlerts} />
      <div className="p-8 grid-bg min-h-screen">

        {/* Machine selector */}
        <div className="flex gap-2 mb-6">
          {machines.map(m => (
            <button key={m.id} onClick={() => setSelected(m.id)}
              className="px-4 py-2 rounded-xl text-sm font-mono transition-all"
              style={{
                background: selected === m.id ? '#00d4ff18' : '#111827',
                color:      selected === m.id ? '#00d4ff'   : '#64748b',
                border:     `1px solid ${selected === m.id ? '#00d4ff33' : '#1e3a5f'}`,
              }}>
              {m.id}
            </button>
          ))}
        </div>

        {/* OEE strip */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {oeeData.map(o => (
            <div key={o.name} className="rounded-2xl p-5 text-center card-hover"
              style={{ background: '#111827', border: `1px solid ${oeeColor(o.oee)}33` }}>
              <p className="text-3xl font-bold font-mono" style={{ color: oeeColor(o.oee) }}>{o.oee}%</p>
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>OEE · {o.name}</p>
            </div>
          ))}
        </div>

        {/* Charts row 1: live sensor + radar */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
            <h3 className="text-xs font-mono mb-4 tracking-widest" style={{ color: '#64748b' }}>TEMPERATURE — {selected}</h3>
            <LiveChart data={ts.temperature || []} color="#ff8c00" unit="°C" warnLine={70} critLine={85} />
          </div>
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
            <h3 className="text-xs font-mono mb-4 tracking-widest" style={{ color: '#64748b' }}>MACHINE HEALTH RADAR — {selected}</h3>
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1e3a5f" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: '#64748b' }} />
                <Radar dataKey="value" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.15} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts row 2: vibration + parts pie */}
        <div className="grid grid-cols-2 gap-5">
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
            <h3 className="text-xs font-mono mb-4 tracking-widest" style={{ color: '#64748b' }}>VIBRATION — {selected}</h3>
            <LiveChart data={ts.vibration || []} color="#ffd700" unit="mm/s" warnLine={3} critLine={4} />
          </div>
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1e3a5f' }}>
            <h3 className="text-xs font-mono mb-4 tracking-widest" style={{ color: '#64748b' }}>PARTS PRODUCTION</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={partsData} dataKey="good" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {partsData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => [v.toLocaleString(), 'Good Parts']}
                  contentStyle={{ background: '#1a2235', border: '1px solid #1e3a5f', borderRadius: 12, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
