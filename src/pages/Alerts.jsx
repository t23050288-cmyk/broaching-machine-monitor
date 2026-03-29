import { useState, useEffect } from 'react';
import { getAlerts, markAlertsRead, getReadings, getSettings } from '../utils/storage';
import { Bell, BellOff, CheckCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [statusReport, setStatusReport] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);

  useEffect(() => {
    const load = () => setAlerts(getAlerts());
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    generateReport();
    const t = setInterval(generateReport, 3 * 60 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  function generateReport() {
    const readings = getReadings();
    const settings = getSettings();
    if (!readings.length) return;
    const last3h = readings.filter(r => r.timestamp > Date.now() - 3 * 60 * 60 * 1000);
    if (!last3h.length) return;
    const avgTemp = last3h.reduce((a, r) => a + (r.temperature_c || 0), 0) / last3h.length;
    const avgVib  = last3h.reduce((a, r) => a + (r.vibration_rms_mm_s2 || 0), 0) / last3h.length;
    const avgCurr = last3h.reduce((a, r) => a + (r.spindle_current_a || 0), 0) / last3h.length;
    const maxTemp = Math.max(...last3h.map(r => r.temperature_c || 0));
    const failedCount = last3h.filter(r => r.tool_status === 'failed').length;
    let overall = 'good';
    const issues = [];
    if (avgTemp > settings.tempLimit * 0.9) { overall = 'warning'; issues.push(`High avg temp: ${avgTemp.toFixed(1)}°C`); }
    if (avgVib  > settings.vibLimit  * 0.9) { overall = 'warning'; issues.push(`High avg vibration: ${avgVib.toFixed(1)} mm/s²`); }
    if (maxTemp > settings.tempLimit)        { overall = 'critical'; issues.push(`EXCEEDED temp limit: ${maxTemp.toFixed(1)}°C`); }
    if (failedCount > 0)                     { overall = 'critical'; issues.push(`${failedCount} failed readings detected`); }
    setStatusReport({ overall, issues, avgTemp, avgVib, avgCurr, failedCount, readingsCount: last3h.length });
    setLastCheck(new Date());
  }

  const unread = alerts.filter(a => !a.read).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight">Alert Center</h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">Maintenance & Status Reports</div>
        </div>
        <button onClick={() => { markAlertsRead(); setAlerts(getAlerts()); }}
          className="flex items-center gap-2 text-xs text-[#849396] hover:text-[#c3f5ff] border border-[#3b494c]/40 px-3 py-2 rounded-xl transition-colors">
          <CheckCheck size={13}/> Mark all read
        </button>
      </div>

      <div className="bg-[#181c22] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={14} className="text-[#00daf3]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">3-Hour Status Report</span>
          {lastCheck && <span className="text-[9px] text-[#3b494c] ml-auto">Last: {lastCheck.toLocaleTimeString()}</span>}
          <button onClick={generateReport} className="text-[9px] uppercase tracking-widest text-[#849396] hover:text-[#c3f5ff] ml-2 border border-[#3b494c]/30 px-2 py-0.5 rounded transition-colors">Refresh</button>
        </div>
        {statusReport ? (
          <div className={`rounded-xl p-4 border ${
            statusReport.overall === 'good'     ? 'bg-[#00e5ff]/5 border-[#00e5ff]/15' :
            statusReport.overall === 'warning'  ? 'bg-[#feb300]/5 border-[#feb300]/15' :
            'bg-[#93000a]/10 border-[#ffb4ab]/20'}`}>
            <div className="flex items-center gap-3 mb-3">
              {statusReport.overall === 'good' ? <Bell size={16} className="text-[#00e5ff]"/> :
               statusReport.overall === 'warning' ? <AlertTriangle size={16} className="text-[#ffba38]"/> :
               <AlertOctagon size={16} className="text-[#ffb4ab] flash-alert"/>}
              <span className={`font-bold text-sm font-headline uppercase tracking-wider ${
                statusReport.overall === 'good' ? 'text-[#00e5ff]' :
                statusReport.overall === 'warning' ? 'text-[#ffba38]' : 'text-[#ffb4ab]'}`}>
                Machine Status: {statusReport.overall.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
              <div><div className="text-[#849396] text-[9px] uppercase tracking-wider">Avg Temp</div><div className="text-[#dfe2eb] font-bold">{statusReport.avgTemp.toFixed(1)}°C</div></div>
              <div><div className="text-[#849396] text-[9px] uppercase tracking-wider">Avg Vibration</div><div className="text-[#dfe2eb] font-bold">{statusReport.avgVib.toFixed(1)} mm/s²</div></div>
              <div><div className="text-[#849396] text-[9px] uppercase tracking-wider">Avg Current</div><div className="text-[#dfe2eb] font-bold">{statusReport.avgCurr.toFixed(1)} A</div></div>
              <div><div className="text-[#849396] text-[9px] uppercase tracking-wider">Readings (3h)</div><div className="text-[#dfe2eb] font-bold">{statusReport.readingsCount}</div></div>
            </div>
            {statusReport.issues.length > 0 ? (
              <div className="space-y-1">
                {statusReport.issues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#ffba38]">
                    <span className="w-1 h-1 rounded-full bg-[#ffba38] flex-shrink-0"/>
                    {issue}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#00e5ff]">✓ All parameters within normal limits over the last 3 hours.</div>
            )}
          </div>
        ) : (
          <div className="text-xs text-[#849396]">No readings yet — connect sensors to generate status reports.</div>
        )}
      </div>

      <div className="bg-[#181c22] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={14} className="text-[#ffba38]"/>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Alert Feed</span>
          {unread > 0 && <span className="bg-[#ffb4ab]/20 text-[#ffb4ab] text-[9px] px-2 py-0.5 rounded-full ml-auto">{unread} new</span>}
        </div>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-[#849396] text-sm">
            <BellOff size={24} className="mx-auto mb-2 opacity-40"/>
            No alerts yet. Machine is running normally.
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 50).map((a) => (
              <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl text-xs border transition-all
                ${!a.read ? 'bg-[#1c2026] border-[#3b494c]/30' : 'bg-[#181c22] border-transparent opacity-60'}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.type === 'error' ? 'bg-[#ffb4ab]' : 'bg-[#ffba38]'}`}/>
                <span className={`font-bold ${a.type === 'error' ? 'text-[#ffb4ab]' : 'text-[#ffba38]'}`}>{a.param}</span>
                <span className="text-[#dfe2eb]">{a.value?.toFixed?.(1) ?? a.value} {a.unit}</span>
                <span className="text-[#849396]">› limit {a.limit} {a.unit}</span>
                <span className="text-[#3b494c] ml-auto">{timeAgo(a.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
