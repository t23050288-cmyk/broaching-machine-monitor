import { Wifi, WifiOff, Loader } from 'lucide-react';

export default function ConnectionBanner({ status, onConnect }) {
  const cfg = {
    connected:    { icon: Wifi,    color: '#00e5ff', bg: 'bg-[#00e5ff]/10 border-[#00e5ff]/20', text: 'LIVE — USB Sensors Connected', btn: false },
    connecting:   { icon: Loader,  color: '#ffba38', bg: 'bg-[#ffba38]/10 border-[#ffba38]/20', text: 'Connecting to sensor bridge…', btn: false },
    disconnected: { icon: WifiOff, color: '#ffb4ab', bg: 'bg-[#ffb4ab]/10 border-[#ffb4ab]/20', text: 'No bridge — showing demo data. Start sensor_bridge.py to go live.', btn: true },
    error:        { icon: WifiOff, color: '#ffb4ab', bg: 'bg-[#ffb4ab]/10 border-[#ffb4ab]/20', text: 'Bridge not found on localhost:8765. Is sensor_bridge.py running?', btn: true },
  };
  const c = cfg[status] || cfg.disconnected;
  const Icon = c.icon;
  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border text-xs mb-4 ${c.bg}`}>
      <Icon size={14} style={{ color: c.color }} className={status === 'connecting' ? 'animate-spin' : ''}/>
      <span style={{ color: c.color }} className="font-medium flex-1">{c.text}</span>
      {c.btn && (
        <button onClick={onConnect} className="text-[10px] uppercase tracking-widest text-[#849396] hover:text-[#c3f5ff] border border-[#3b494c]/40 px-2 py-1 rounded transition-colors">
          Retry
        </button>
      )}
    </div>
  );
}
