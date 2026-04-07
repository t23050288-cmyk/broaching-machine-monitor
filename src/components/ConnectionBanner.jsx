import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Usb, AlertTriangle, RefreshCw } from 'lucide-react';

export default function ConnectionBanner({ status, onConnect }) {
  const [trying, setTrying] = useState(false);

  // Auto-retry when disconnected
  useEffect(() => {
    if (status === 'disconnected') {
      const t = setTimeout(() => {
        onConnect && onConnect();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  async function handleConnect() {
    setTrying(true);
    try { await onConnect(); } finally { setTrying(false); }
  }

  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00e5ff]/5 border border-[#00e5ff]/20 text-[#00e5ff] text-xs font-bold">
        <Wifi size={13} className="animate-pulse"/>
        <span>LIVE — Arduino Sensors Connected</span>
      </div>
    );
  }

  if (status === 'unsupported') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 text-[#ffb4ab] text-xs">
        <AlertTriangle size={13}/>
        <span>Web Serial not supported. Use <strong>Chrome</strong> or <strong>Edge</strong> browser.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#1c2026] border border-[#3b494c]/30">
      <div className="flex items-center gap-2 text-xs text-[#849396]">
        <WifiOff size={13}/>
        <span>
          {status === 'connecting' ? 'Connecting to Arduino…' : 'Arduino not connected — click Connect to start live monitoring'}
        </span>
      </div>
      <button onClick={handleConnect} disabled={trying || status === 'connecting'}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition-all
          bg-[#00e5ff]/10 border border-[#00e5ff]/20 text-[#00e5ff] hover:bg-[#00e5ff]/20 disabled:opacity-50">
        {trying || status === 'connecting'
          ? <><RefreshCw size={11} className="animate-spin"/> Connecting…</>
          : <><Usb size={11}/> Connect Arduino</>}
      </button>
    </div>
  );
}
