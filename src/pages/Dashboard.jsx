import { useSensorData } from '../hooks/useSensorData';
import GaugeCircle from '../components/GaugeCircle';
import LiveChart from '../components/LiveChart';
import StatusBadge from '../components/StatusBadge';
import ConnectionBanner from '../components/ConnectionBanner';
import { getSettings } from '../utils/storage';
import { Thermometer, Zap, Activity, Gauge, Wind, Volume2 } from 'lucide-react';

function MetricCard({ icon: Icon, label, value, unit, color = '#00daf3', alert }) {
  return (
    <div className={`bg-[#1c2026] rounded-xl p-4 flex flex-col gap-2 ${alert ? 'glow-red' : 'glow-cyan'} transition-all`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color }}/>
          <span className="text-[9px] uppercase tracking-[0.15em] text-[#849396]">{label}</span>
        </div>
        {alert && <span className="text-[9px] text-[#ffb4ab] flash-alert uppercase tracking-widest font-bold">HIGH</span>}
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-2xl font-black font-headline ${alert ? 'text-[#ffb4ab]' : 'text-[#c3f5ff]'}`}>{value}</span>
        <span className="text-[#849396] text-xs mb-1">{unit}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { bridgeStatus, latest, chartData, activeAlerts, isFlashing, connect } = useSensorData();
  const s = getSettings();
  const r = latest;
  const tempAlert  = r && r.temperature_c > s.tempLimit;
  const vibAlert   = r && r.vibration_rms_mm_s2 > s.vibLimit;
  const currAlert  = r && r.spindle_current_a > s.currentLimit;
  const forceAlert = r && r.cutting_force_n > s.forceLimit;

  return (
    <div className={`p-6 space-y-6 ${isFlashing ? 'ring-2 ring-[#ffb4ab] ring-inset' : ''} transition-all`}>
      {isFlashing && (
        <div className="fixed inset-0 pointer-events-none z-50 flash-alert"
          style={{ background: 'radial-gradient(circle, rgba(255,180,171,0.08) 0%, transparent 70%)' }}/>
      )}
      <ConnectionBanner status={bridgeStatus} onConnect={connect}/>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Health Pulse</h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">
            {r ? `Last update: ${new Date(r.timestamp).toLocaleTimeString()}` : 'Waiting for sensor data…'}
          </div>
        </div>
        {r && <StatusBadge status={r.tool_status}/>}
      </div>
      <div className="bg-[#181c22] rounded-xl p-6 flex justify-around flex-wrap gap-6">
        <GaugeCircle value={r?.temperature_c ?? 0} max={100} unit="°C" label="Temperature" color={tempAlert ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={r?.vibration_rms_mm_s2 ?? 0} max={40} unit="mm/s²" label="Vibration RMS" color={vibAlert ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={r?.spindle_current_a ?? 0} max={50} unit="A" label="Spindle Current" color={currAlert ? '#ffb4ab' : '#00daf3'}/>
        <GaugeCircle value={r?.wear_progression ?? 0} max={1.5} unit="wear" label="Wear Index" color="#ffba38"/>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={Thermometer} label="Temperature"   value={r?.temperature_c?.toFixed(1) ?? '--'}     unit="°C"    color="#00daf3" alert={tempAlert}/>
        <MetricCard icon={Activity}    label="Vibration"     value={r?.vibration_rms_mm_s2?.toFixed(1) ?? '--'} unit="mm/s²" color="#00daf3" alert={vibAlert}/>
        <MetricCard icon={Zap}         label="Current"       value={r?.spindle_current_a?.toFixed(1) ?? '--'}   unit="A"     color="#00daf3" alert={currAlert}/>
        <MetricCard icon={Gauge}       label="Cutting Force" value={r?.cutting_force_n?.toFixed(0) ?? '--'}     unit="N"     color="#ffba38" alert={forceAlert}/>
        <MetricCard icon={Volume2}     label="Acoustic Emis" value={r?.acoustic_emission_db?.toFixed(1) ?? '--'} unit="dB"   color="#ffd799"/>
        <MetricCard icon={Wind}        label="Coolant Flow"  value={r?.coolant_flow_lmin?.toFixed(1) ?? '--'}   unit="L/min" color="#9cf0ff"/>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={chartData} dataKey="temperature_c" color="#00daf3" label="Temperature °C" limit={s.tempLimit}/>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={chartData} dataKey="vibration_rms_mm_s2" color="#ffba38" label="Vibration mm/s²" limit={s.vibLimit}/>
        </div>
        <div className="bg-[#1c2026] rounded-xl p-4">
          <LiveChart data={chartData} dataKey="spindle_current_a" color="#9cf0ff" label="Current A" limit={s.currentLimit}/>
        </div>
      </div>
      {activeAlerts.length > 0 && (
        <div className="bg-[#93000a]/20 border border-[#ffb4ab]/20 rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#ffb4ab] mb-3 font-bold">⚠ Active Alerts</div>
          <div className="space-y-1.5">
            {activeAlerts.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.type === 'error' ? 'bg-[#ffb4ab]' : 'bg-[#ffba38]'}`}/>
                <span className="text-[#dfe2eb]">{a.param}</span>
                <span className="text-[#ffb4ab] font-bold">{a.value?.toFixed?.(1) ?? a.value} {a.unit}</span>
                <span className="text-[#849396]">limit: {a.limit} {a.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {r && (
        <div className="bg-[#1c2026] rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {[['Tool ID',r.tool_id],['Material',r.tool_material],['Coating',r.coating],['Workpiece',r.workpiece_material],
            ['Speed',`${r.spindle_speed_mmin} m/min`],['Feed Rate',`${r.feed_rate_mmtooth} mm/tooth`],
            ['Surface Finish',`${r.surface_finish_ra_um} Ra μm`],['Wear',r.wear_progression?.toFixed(3)]
          ].map(([k,v]) => (
            <div key={k}>
              <div className="text-[9px] uppercase tracking-[0.15em] text-[#849396] mb-0.5">{k}</div>
              <div className="text-[#dfe2eb] font-medium">{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
