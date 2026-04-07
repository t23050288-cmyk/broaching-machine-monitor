import { Wifi, WifiOff, Loader, Usb, AlertTriangle } from 'lucide-react';

export default function ConnectionBanner({ status, onConnect, onDisconnect }) {
  const cfg = {
    connected:    { icon: Wifi,         color: '#00e5ff', bg: 'bg-[#00e5ff]/10 border-[#00e5ff]/20',  text: 'LIVE — Arduino connected via USB Serial' },
    connecting:   { icon: Loader,       color: '#ffba38', bg: 'bg-[#ffba38]/10 border-[#ffba38]/20',  text: 'Connecting to Arduino…' },
    disconnected: { icon: WifiOff,      color: '#849396', bg: 'bg-[#1c2026] border-[#3b494c]/30',     text: 'Arduino not connected — click Connect to start live monitoring' },
    error:        { icon: WifiOff,      color: '#ffb4ab', bg: 'bg-[#ffb4ab]/10 border-[#ffb4ab]/20', text: 'Connection lost — reconnect Arduino USB and try again' },
    unsupported:  { icon: AlertTriangle,color: '#ffba38', bg: 'bg-[#ffba38]/10 border-[#ffba38]/20',  text: 'Use Chrome or Edge browser — Web Serial not supported here' },
  };
  const c = cfg[status] || cfg.disconnected;
  const Icon = c.icon;
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs ${c.bg}`}>
      <Icon size={14} style={{ color: c.color }} className={status === 'connecting' ? 'animate-spin' : ''}/>
      <span style={{ color: c.color }} className="font-medium flex-1">{c.text}</span>
      {status === 'connected' && onDisconnect && (
        <button onClick={onDisconnect}
          className="text-[10px] uppercase tracking-widest text-[#849396] hover:text-[#ffb4ab] border border-[#3b494c]/40 hover:border-[#ffb4ab]/40 px-2 py-1 rounded transition-colors">
          Disconnect
        </button>
      )}
      {(status === 'disconnected' || status === 'error') && (
        <button onClick={onConnect}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-[#00e5ff] bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 border border-[#00e5ff]/30 px-3 py-1.5 rounded-lg transition-colors">
          <Usb size={11}/> Connect Arduino
        </button>
      )}
      {status === 'unsupported' && (
        <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer"
          className="text-[10px] uppercase tracking-widest text-[#ffba38] border border-[#ffba38]/40 px-2 py-1 rounded hover:bg-[#ffba38]/10 transition-colors">
          Get Chrome
        </a>
      )}
    </div>
  );
}
