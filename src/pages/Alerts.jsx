import { useSimulation } from '../context/MachineContext';
import { ShieldAlert, Bell, CheckCheck } from 'lucide-react';

export default function AlertsPage() {
  const { alerts, clearAlerts } = useSimulation();

  const levelColor = l => l === 'ALARM' ? 'text-red-400 border-red-500/30 bg-red-500/5'
    : l === 'WARNING' ? 'text-amber-400 border-amber-500/30 bg-amber-500/5'
    : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5';

  return (
    <div className="p-6 space-y-5 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-100">Alert Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">5–10% Deviation Intercept Log · Correlation alarms</p>
        </div>
        {alerts.length > 0 && (
          <button onClick={clearAlerts}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-xs hover:text-slate-200 hover:border-slate-600 transition-all">
            <CheckCheck size={12}/> Clear All
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Total Intercepts', alerts.length, 'text-slate-100'],
          ['ALARM Events',  alerts.filter(a => a.level === 'ALARM').length,   'text-red-400'],
          ['Cleared',       0, 'text-emerald-400'],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 text-center">
            <div className={`text-3xl font-black ${c}`}>{v}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-1">{l}</div>
          </div>
        ))}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Bell size={32} className="mb-3 opacity-30"/>
          <div className="text-sm">No correlation events intercepted</div>
          <div className="text-xs mt-1 text-slate-600">Calibrate baseline then trigger a stress test</div>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className={`rounded-xl border p-4 ${levelColor(a.level)}`}>
              <div className="flex items-start gap-3">
                <ShieldAlert size={14} className="mt-0.5 flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs">{a.message}</div>
                  <div className="text-[9px] text-slate-500 mt-1">
                    5–10% Deviation Intercepted ·
                    Current: <b>{a.currDev}%</b> ·
                    Pressure: <b>{a.pressDev}%</b> ·
                    Torque: <b>{a.torqDev}%</b>
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 flex-shrink-0">
                  {new Date(a.ts).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
