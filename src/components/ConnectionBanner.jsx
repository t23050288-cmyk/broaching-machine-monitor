import { Wifi, WifiOff, Terminal, RefreshCw } from 'lucide-react';
import { connectBridge } from '../utils/sensorBridge';

export default function ConnectionBanner({ status }) {
  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00e5ff]/5 border border-[#00e5ff]/20 text-[#00e5ff] text-xs font-bold">
        <Wifi size={13} className="animate-pulse"/>
        <span>LIVE — Arduino Sensors Connected via Bridge</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#1c2026] border border-[#ffba38]/20">
      <div className="flex items-center gap-2 text-xs text-[#849396]">
        <WifiOff size={13} className="text-[#ffba38]"/>
        <span className="text-[#ffba38] font-bold">Bridge Offline</span>
        <span className="text-[#849396]">— Run this in terminal to connect:</span>
        <code className="bg-[#10141a] px-2 py-0.5 rounded text-[#00e5ff] font-mono text-[10px]">
          python sensor_bridge.py
        </code>
      </div>
      <button onClick={() => connectBridge()}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition-all
          bg-[#ffba38]/10 border border-[#ffba38]/30 text-[#ffba38] hover:bg-[#ffba38]/20">
        <RefreshCw size={11}/> Retry
      </button>
    </div>
  );
}
