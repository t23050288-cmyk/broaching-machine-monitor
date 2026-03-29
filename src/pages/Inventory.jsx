import { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge';
import { getReadings } from '../utils/storage';
import { Package } from 'lucide-react';

const TOOLS = [
  { id: 'TB001', material: 'Carbide',    coating: 'TiN',   maxCycles: 2000, maxHours: 50 },
  { id: 'TB002', material: 'Coated HSS', coating: 'None',  maxCycles: 1800, maxHours: 45 },
  { id: 'TB003', material: 'Coated HSS', coating: 'TiAlN', maxCycles: 2200, maxHours: 55 },
  { id: 'TB004', material: 'HSS',        coating: 'TiN',   maxCycles: 1500, maxHours: 40 },
];

export default function Inventory() {
  const [latestByTool, setLatestByTool] = useState({});

  useEffect(() => {
    const load = () => {
      const readings = getReadings();
      const byTool = {};
      readings.forEach(r => { if (r.tool_id) byTool[r.tool_id] = r; });
      setLatestByTool(byTool);
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Tool Inventory</h1>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">Real-time tool health overview</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TOOLS.map(tool => {
          const latest = latestByTool[tool.id];
          const wearPct = latest ? Math.min(1, (latest.wear_progression || 0) / 1.5) : 0;
          const status = latest?.tool_status || 'new';
          return (
            <div key={tool.id} className={`bg-[#1c2026] rounded-xl p-5 border transition-all
              ${status === 'failed' ? 'border-[#ffb4ab]/20 glow-red' : status === 'worn' ? 'border-[#ffba38]/20 glow-amber' : 'border-[#3b494c]/15 glow-cyan'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#181c22] flex items-center justify-center">
                    <Package size={14} className="text-[#00daf3]"/>
                  </div>
                  <div>
                    <div className="font-bold font-headline text-[#dfe2eb]">{tool.id}</div>
                    <div className="text-[9px] text-[#849396] uppercase tracking-wider">{tool.material} · {tool.coating}</div>
                  </div>
                </div>
                <StatusBadge status={status}/>
              </div>
              {latest ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><div className="text-[9px] text-[#849396]">Temp</div><div className="font-bold text-[#c3f5ff]">{latest.temperature_c?.toFixed(1)}°C</div></div>
                    <div><div className="text-[9px] text-[#849396]">Vibration</div><div className="font-bold text-[#c3f5ff]">{latest.vibration_rms_mm_s2?.toFixed(1)}</div></div>
                    <div><div className="text-[9px] text-[#849396]">Current</div><div className="font-bold text-[#c3f5ff]">{latest.spindle_current_a?.toFixed(1)}A</div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] mb-1">
                      <span className="text-[#849396] uppercase tracking-wider">Wear Index</span>
                      <span className="text-[#ffba38]">{(wearPct * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-[#31353c] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${wearPct * 100}%`, background: wearPct > 0.9 ? '#ffb4ab' : wearPct > 0.7 ? '#ffba38' : '#00daf3' }}/>
                    </div>
                  </div>
                  <div className="text-[9px] text-[#3b494c]">Last: {new Date(latest.timestamp).toLocaleTimeString()}</div>
                </div>
              ) : (
                <div className="text-xs text-[#3b494c] text-center py-4">No sensor data yet — connect device</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
