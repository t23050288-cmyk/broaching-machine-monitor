import { useState, useEffect, useRef, useCallback } from 'react';
import { connectBridge, disconnectBridge, onReading, getBridgeStatus } from '../utils/sensorBridge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Thermometer, Zap, Activity, Usb, WifiOff, Wifi, Circle, AlertTriangle } from 'lucide-react';

const MAX_ROWS = 200;

export default function OriginalSensor() {
  const [bridgeStatus, setBridgeStatus] = useState(getBridgeStatus());
  const [readings,     setReadings]     = useState([]);
  const [latest,       setLatest]       = useState(null);
  const [connecting,   setConnecting]   = useState(false);
  const [error,        setError]        = useState(null);

  // Live listener
  useEffect(() => {
    const unsub = onReading((msg) => {
      if (msg.type === 'status') {
        setBridgeStatus(msg.status);
        setConnecting(false);
        if (msg.status === 'connected') setError(null);
      }
      if (msg.type === 'reading' && msg.data) {
        const d = msg.data;
        const ts = new Date().toLocaleTimeString('en', { hour12: false });
        const row = {
          time:       ts,
          temp:       d.temperature_c        ?? null,
          vib:        d.vibration_rms_mm_s2  ?? null,
          current:    d.spindle_current_a    ?? null,
          voltage:    d.supply_voltage_v     ?? null,
        };
        setLatest(row);
        setReadings(prev => [...prev, row].slice(-MAX_ROWS));
      }
    });
    return unsub;
  }, []);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectBridge();
    } catch (e) {
      setError(e.message || 'Connection failed');
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    await disconnectBridge();
    setBridgeStatus('disconnected');
  }, []);

  const isConnected = bridgeStatus === 'connected';
  const recent = readings.slice(-60);

  // Status color
  const statusCfg = {
    connected:    { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'CONNECTED — Live Arduino Data', icon: Wifi      },
    connecting:   { color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',     label: 'CONNECTING…',                 icon: Circle     },
    disconnected: { color: 'text-slate-400',   bg: 'bg-slate-700/30 border-slate-600/30',     label: 'DISCONNECTED',                icon: WifiOff    },
  };
  const sc = statusCfg[bridgeStatus] || statusCfg.disconnected;
  const StatusIcon = sc.icon;

  return (
    <div className="p-6 space-y-5 min-h-screen">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1 text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-2">
          <Usb size={10}/> Original Hardware Sensor
        </div>
        <h1 className="text-2xl font-black text-slate-100">Original Sensor Log</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Direct Arduino → Web Serial / WebSocket bridge · Temperature · Vibration · Current
        </p>
      </div>

      {/* Connection card */}
      <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 flex-wrap ${sc.bg}`}>
        <div className="flex items-center gap-3">
          <StatusIcon size={16} className={`${sc.color} ${bridgeStatus === 'connecting' ? 'animate-pulse' : ''}`}/>
          <div>
            <div className={`text-xs font-black uppercase tracking-widest ${sc.color}`}>{sc.label}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Chrome/Edge only · Web Serial API · Baud 9600 · COM7 (Arduino)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <button onClick={handleDisconnect}
              className="px-4 py-2 rounded-xl border border-slate-600 text-slate-400 text-xs font-bold hover:text-slate-200 transition-all">
              Disconnect
            </button>
          ) : (
            <button onClick={handleConnect} disabled={connecting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-500/50 text-emerald-400 text-xs font-bold hover:bg-emerald-500/10 transition-all disabled:opacity-50">
              <Usb size={12}/> {connecting ? 'Connecting…' : 'Connect Arduino'}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0"/>
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {/* How-to steps */}
      {!isConnected && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Usb size={12} className="text-sky-400"/> How to Connect Your Arduino
          </div>
          <div className="space-y-3">
            {[
              ['1', 'Plug Arduino into USB', 'Port should appear as COM7 (or shown in Device Manager)'],
              ['2', 'Click "Connect Arduino" above', 'Browser will show a port picker — select your Arduino port'],
              ['3', 'Arduino must be sending serial data', 'Format: TEMP: 31.2  VIB: 0.082  CURR: 0.154  at 9600 baud'],
              ['4', 'Alternatively — run sensor_bridge_new.py', 'Python bridge uses WebSocket on port 8765 as fallback'],
            ].map(([n, title, desc]) => (
              <div key={n} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-black text-sky-400">{n}</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">{title}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Arduino serial format expected */}
          <div className="mt-4 bg-slate-900/80 rounded-lg p-3 font-mono text-[10px] text-emerald-400 border border-slate-700/50">
            <div className="text-slate-500 mb-1">// Expected Arduino Serial.println format:</div>
            <div>TEMP: 31.20  VIB: 0.082  CURR: 0.154  VOLT: 4.931</div>
            <div className="text-slate-500 mt-2">// Or JSON format:</div>
            <div>{'{"temperature_c":31.2,"vibration_rms_mm_s2":0.082,"spindle_current_a":0.154}'}</div>
          </div>
        </div>
      )}

      {/* Live stat cards — only when connected */}
      {isConnected && latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Temperature', value: latest.temp,    unit: '°C',    Icon: Thermometer, color: '#fb923c', warn: latest.temp > 50   },
            { label: 'Vibration',   value: latest.vib,     unit: 'mm/s²', Icon: Activity,    color: '#38bdf8', warn: latest.vib > 0.12  },
            { label: 'Current',     value: latest.current, unit: 'A',     Icon: Zap,         color: '#34d399', warn: latest.current > 0.4},
            { label: 'Voltage',     value: latest.voltage, unit: 'V',     Icon: Zap,         color: '#a78bfa', warn: false               },
          ].map(({ label, value, unit, Icon, color, warn }) => (
            <div key={label}
              className={`bg-slate-800/60 rounded-xl border p-4 transition-all ${warn ? 'border-amber-500/50' : 'border-slate-700/40'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color }} />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>
              </div>
              <div className="text-3xl font-black" style={{ color: warn ? '#f59e0b' : color }}>
                {value != null ? value.toFixed(3) : <span className="text-slate-600 text-xl">—</span>}
                <span className="text-xs text-slate-500 ml-1">{unit}</span>
              </div>
              {warn && <div className="text-[9px] text-amber-400 mt-1">▲ Above threshold</div>}
            </div>
          ))}
        </div>
      )}

      {/* Charts — only when we have data */}
      {readings.length > 1 ? (
        <div className="space-y-4">
          {/* Combined chart */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Temperature · Vibration × 100 · Current × 1000 (mA)
            </div>
            <div className="text-[10px] text-slate-500 mb-3">
              Notice: current rises and falls with vibration — the key sensor coupling we discovered
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={recent} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.4}/>
                <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#64748b' }} interval="preserveStartEnd"/>
                <YAxis tick={{ fontSize: 8, fill: '#64748b' }}/>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 10 }}
                  formatter={(val, name) => {
                    if (name === 'temp')    return [`${val?.toFixed(2)} °C`,    'Temperature'];
                    if (name === 'vib100')  return [`${(val/100)?.toFixed(4)} mm/s²`, 'Vibration'];
                    if (name === 'curr_ma') return [`${val?.toFixed(1)} mA`,    'Current'];
                    return [val, name];
                  }}/>
                <Legend formatter={v =>
                  v === 'temp' ? 'Temp (°C)' : v === 'vib100' ? 'Vib × 100' : 'Current (mA)'}/>
                <Line type="monotone" dataKey="temp"                       name="temp"    stroke="#fb923c" dot={false} strokeWidth={2} isAnimationActive={false}/>
                <Line type="monotone" dataKey={d => (d.vib ?? 0) * 100}    name="vib100"  stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false}/>
                <Line type="monotone" dataKey={d => (d.current ?? 0)*1000} name="curr_ma" stroke="#34d399" dot={false} strokeWidth={2} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Two individual charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity size={12} className="text-sky-400"/> Vibration (mm/s²) — Raw
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={recent}>
                  <YAxis tick={{ fontSize: 8, fill: '#64748b' }}/>
                  <XAxis hide/>
                  <Tooltip contentStyle={{ background: '#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:10 }}
                    formatter={v => [`${v?.toFixed(4)} mm/s²`, 'Vibration']}/>
                  <Line type="monotone" dataKey="vib" stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap size={12} className="text-emerald-400"/> Motor Current (A) — follows vibration
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={recent}>
                  <YAxis tick={{ fontSize: 8, fill: '#64748b' }}/>
                  <XAxis hide/>
                  <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, fontSize:10 }}
                    formatter={v => [`${v?.toFixed(4)} A`, 'Current']}/>
                  <Line type="monotone" dataKey="current" stroke="#34d399" dot={false} strokeWidth={2} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : isConnected ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Activity size={28} className="mb-2 animate-pulse text-sky-400"/>
          <div className="text-sm">Waiting for sensor data from Arduino…</div>
          <div className="text-xs mt-1 text-slate-600">Make sure Arduino is sending serial output at 9600 baud</div>
        </div>
      ) : null}

      {/* Scrolling raw log */}
      {readings.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Raw Sensor Log</div>
          <div className="space-y-1 max-h-52 overflow-y-auto font-mono text-[10px]">
            {readings.slice().reverse().slice(0, 80).map((r, i) => (
              <div key={i} className="flex gap-4 py-1 border-b border-slate-700/20 text-slate-400">
                <span className="text-slate-600 w-20 flex-shrink-0">{r.time}</span>
                <span>T=<b className="text-orange-400">{r.temp?.toFixed(2) ?? '--'}°C</b></span>
                <span>V=<b className="text-sky-400">{r.vib?.toFixed(4) ?? '--'}</b></span>
                <span>I=<b className="text-emerald-400">{r.current?.toFixed(4) ?? '--'}A</b></span>
                {r.voltage != null && <span>U=<b className="text-violet-400">{r.voltage?.toFixed(3)}V</b></span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discovery note — always visible */}
      <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0"/>
          <div>
            <div className="text-xs font-bold text-amber-400 mb-1">Key Discovery from Hardware Testing</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              We observed that <b className="text-amber-400">Motor Current rises proportionally with Vibration</b>.
              As vibration increases (0.07 → 0.12 mm/s²), current climbs from 0.10A to ~0.50A.
              When vibration drops, current drops immediately. Root cause: our ACS712 current sensor
              was de-energizing under high-frequency vibration without PTFE shielding.
              <b className="text-emerald-400"> Solved by Teflon (PTFE) cable shielding.</b>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
