import { useState, useEffect, useRef } from 'react';
import { onReading, connectBridge, getBridgeStatus, sendChatMessage, onChatReply } from '../utils/sensorBridge';
import { Brain, Zap, ThermometerSun, Activity, Gauge, RefreshCw, Wifi, WifiOff, Lock, Unlock } from 'lucide-react';

const PREDICT_PROMPT = (temp, vib, curr, speed, feed, depth, coolant, hardness) => `
You are an expert in broaching machine tool condition monitoring.
Analyze these parameters and predict tool status:

SENSOR READINGS (live):
- Temperature: ${temp} °C
- Vibration RMS: ${vib} m/s²
- Spindle Current: ${curr} A

CUTTING PARAMETERS:
- Spindle Speed: ${speed} RPM
- Feed Rate: ${feed} mm/rev
- Depth of Cut: ${depth} mm
- Coolant Flow: ${coolant} L/min
- Workpiece Hardness: ${hardness} HB

Respond ONLY with valid JSON (no extra text):
{"tool_status":"new" or "worn" or "failed","wear_progression":<0.0-1.5>,"cutting_force_n":<2500-11500>,"acoustic_emission_db":<300-650>,"surface_finish_ra_um":<0.2-2.0>,"remaining_life_percent":<0-100>,"recommendation":"<one sentence action>","confidence":<50-99>}
`;

function statusColor(s) {
  if (!s) return '#849396';
  const l = s.toLowerCase();
  if (l === 'new')    return '#00e5ff';
  if (l === 'worn')   return '#ffba38';
  return '#ffb4ab';
}

export default function AiPredictor() {
  // Live sensor values from bridge
  const [liveTemp, setLiveTemp] = useState('');
  const [liveVib,  setLiveVib]  = useState('');
  const [liveCurr, setLiveCurr] = useState('');

  // Whether user has locked (manually overridden) the sensor fields
  const [locked, setLocked] = useState(false);

  // Displayed / editable sensor fields
  const [temp,    setTemp]    = useState('');
  const [vib,     setVib]     = useState('');
  const [curr,    setCurr]    = useState('');

  // Cutting parameters
  const [speed,     setSpeed]     = useState('4');
  const [feed,      setFeed]      = useState('0.15');
  const [depth,     setDepth]     = useState('2.0');
  const [coolant,   setCoolant]   = useState('18');
  const [hardness,  setHardness]  = useState('200');

  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [bridge,   setBridge]   = useState(getBridgeStatus());

  const pendingRef = useRef(null);

  useEffect(() => {
    const unsubRead = onReading((msg) => {
      if (msg.type === 'status') setBridge(msg.status);
      if (msg.type === 'reading') {
        const d = msg.data;
        setLiveTemp(String(d.temperature_c ?? ''));
        setLiveVib(String(d.vibration_rms_mm_s2 ?? ''));
        setLiveCurr(String(d.spindle_current_a ?? ''));
        // Only update display fields if user hasn't locked them
        if (!locked) {
          setTemp(String(d.temperature_c ?? ''));
          setVib(String(d.vibration_rms_mm_s2 ?? ''));
          setCurr(String(d.spindle_current_a ?? ''));
        }
      }
    });
    const unsubChat = onChatReply((reply) => {
      if (pendingRef.current) {
        pendingRef.current(reply);
        pendingRef.current = null;
      }
    });
    connectBridge();
    return () => { unsubRead(); unsubChat(); };
  }, [locked]);

  const isConnected = bridge === 'connected';

  async function predict() {
    const t = parseFloat(temp);
    const v = parseFloat(vib);
    const c = parseFloat(curr);
    if (isNaN(t) || isNaN(v) || isNaN(c)) {
      setError('Please enter Temperature, Vibration, and Current values first.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    const prompt = PREDICT_PROMPT(t, v, c, speed, feed, depth, coolant, hardness);

    try {
      if (!isConnected) throw new Error('Bridge not running. Start sensor_bridge.py first.');

      // Send through WebSocket bridge — no CORS issues
      const reply = await new Promise((resolve, reject) => {
        pendingRef.current = resolve;
        sendChatMessage([{ role: 'user', content: prompt }]);
        setTimeout(() => {
          if (pendingRef.current) {
            pendingRef.current = null;
            reject(new Error('AI timed out. Is the bridge still running?'));
          }
        }, 30000);
      });

      const match = reply.match(/\{[^{}]+\}/);
      if (!match) throw new Error('AI returned unexpected format.');
      const parsed = JSON.parse(match[0]);
      setResult(parsed);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleLock() {
    if (locked) {
      // Unlock — restore live values
      setTemp(liveTemp);
      setVib(liveVib);
      setCurr(liveCurr);
    }
    setLocked(l => !l);
  }

  const ResultCard = ({ label, value, unit, color }) => (
    <div className="bg-[#10141a] rounded-xl p-4 text-center border border-[#3b494c]/20">
      <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-2">{label}</div>
      <div className="text-2xl font-black" style={{ color }}>{value}</div>
      {unit && <div className="text-[10px] text-[#849396] mt-1">{unit}</div>}
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight flex items-center gap-2">
            <Brain size={22} className="text-[#c084fc]"/> AI Predictor
          </h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">NVIDIA AI · Real-time tool condition analysis</div>
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full border font-bold
          ${isConnected ? 'text-[#00e5ff] bg-[#00e5ff]/10 border-[#00e5ff]/20' : 'text-[#ffb4ab] bg-[#ffb4ab]/10 border-[#ffb4ab]/20'}`}>
          {isConnected ? <><Wifi size={11}/> Bridge Live</> : <><WifiOff size={11}/> Bridge Offline</>}
        </div>
      </div>

      {/* Sensor Readings */}
      <div className="bg-[#181c22] rounded-2xl p-5 border border-[#3b494c]/15">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-[#00e5ff]"/>
            <span className="text-sm font-bold text-[#dfe2eb]">Sensor Readings</span>
            {isConnected && !locked && (
              <span className="text-[9px] bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/20 px-2 py-0.5 rounded-full animate-pulse">● AUTO UPDATING</span>
            )}
            {locked && (
              <span className="text-[9px] bg-[#ffba38]/10 text-[#ffba38] border border-[#ffba38]/20 px-2 py-0.5 rounded-full">● LOCKED FOR EDITING</span>
            )}
          </div>
          {/* Lock/Unlock toggle */}
          <button onClick={toggleLock}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
              ${locked
                ? 'text-[#ffba38] border-[#ffba38]/30 bg-[#ffba38]/10 hover:bg-[#ffba38]/20'
                : 'text-[#849396] border-[#3b494c]/30 hover:text-[#dfe2eb] hover:border-[#dfe2eb]/20'}`}>
            {locked ? <><Unlock size={12}/> Unlock (resume live)</> : <><Lock size={12}/> Lock to edit</>}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[{ label:'Temperature (°C)', val:temp, set:setTemp, icon:ThermometerSun, color:'#ff9259' },
            { label:'Vibration (m/s²)', val:vib,  set:setVib,  icon:Activity,      color:'#00e5ff' },
            { label:'Current (A)',      val:curr,  set:setCurr, icon:Gauge,         color:'#818cf8' },
          ].map(({ label, val, set, icon: Icon, color }) => (
            <div key={label}>
              <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color }}>
                <Icon size={10} className="inline mr-1"/>{label}
              </label>
              <input
                value={val}
                onChange={e => { if (locked) set(e.target.value); }}
                readOnly={!locked}
                className={`w-full bg-[#10141a] border rounded-lg px-3 py-2.5 text-sm font-mono text-[#dfe2eb] outline-none transition-colors
                  ${locked
                    ? 'border-[#ffba38]/40 focus:border-[#ffba38]/70 cursor-text'
                    : 'border-[#3b494c]/30 cursor-default opacity-80'}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-[#849396]">
          {locked
            ? '✏️ You can now edit values manually. Click Unlock to resume live updates.'
            : '🔄 Values auto-update from Arduino. Click Lock to edit manually.'}
        </div>
      </div>

      {/* Cutting Parameters */}
      <div className="bg-[#181c22] rounded-2xl p-5 border border-[#3b494c]/15">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={15} className="text-[#ffba38]"/>
          <span className="text-sm font-bold text-[#dfe2eb]">Cutting Parameters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label:'Spindle Speed (RPM)',   val:speed,    set:setSpeed,    ph:'e.g. 100' },
            { label:'Feed Rate (mm/rev)',    val:feed,     set:setFeed,     ph:'e.g. 0.15' },
            { label:'Depth of Cut (mm)',     val:depth,    set:setDepth,    ph:'e.g. 2.0' },
            { label:'Coolant Flow (L/min)',  val:coolant,  set:setCoolant,  ph:'e.g. 18' },
            { label:'Hardness (HB)',         val:hardness, set:setHardness, ph:'e.g. 200' },
          ].map(({ label, val, set, ph }) => (
            <div key={label}>
              <label className="block text-[10px] uppercase tracking-wider text-[#849396] mb-1.5">{label}</label>
              <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
                className="w-full bg-[#10141a] border border-[#3b494c]/30 rounded-lg px-3 py-2.5 text-sm text-[#dfe2eb] outline-none focus:border-[#c084fc]/50 placeholder-[#3b494c]"/>
            </div>
          ))}
        </div>
      </div>

      {/* Predict Button */}
      <button onClick={predict} disabled={loading || !isConnected}
        className="w-full py-4 rounded-2xl font-black text-base tracking-wide transition-all
          bg-gradient-to-r from-[#7c3aed] to-[#c084fc] hover:from-[#6d28d9] hover:to-[#a855f7]
          disabled:from-[#3b494c]/30 disabled:to-[#3b494c]/30 disabled:text-[#849396]
          text-white flex items-center justify-center gap-2 shadow-lg shadow-[#c084fc]/10">
        {loading
          ? <><RefreshCw size={18} className="animate-spin"/> Analysing with AI...</>
          : !isConnected
          ? <><WifiOff size={18}/> Start sensor_bridge.py to enable AI</>
          : <><Brain size={18}/> Predict Tool Status</>}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 rounded-xl px-4 py-3 text-sm text-[#ffb4ab] flex items-center gap-2">
          ⚠️ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="bg-[#181c22] rounded-2xl p-5 border-2 space-y-4"
            style={{ borderColor: statusColor(result.tool_status) + '40' }}>
            {/* Status banner */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#849396] mb-1">Tool Status</div>
                <div className="text-3xl font-black uppercase" style={{ color: statusColor(result.tool_status) }}>
                  {result.tool_status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-[#849396] mb-1">AI Confidence</div>
                <div className="text-3xl font-black text-[#dfe2eb]">{result.confidence}%</div>
              </div>
            </div>

            {/* Remaining life bar */}
            <div>
              <div className="flex justify-between text-[10px] text-[#849396] mb-1.5">
                <span>Remaining Tool Life</span>
                <span className="font-bold text-[#dfe2eb]">{result.remaining_life_percent}%</span>
              </div>
              <div className="h-2.5 bg-[#10141a] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${result.remaining_life_percent}%`,
                    background: result.remaining_life_percent > 60 ? '#00e5ff'
                              : result.remaining_life_percent > 30 ? '#ffba38' : '#ffb4ab'
                  }}/>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ResultCard label="Wear Progress" value={Number(result.wear_progression).toFixed(3)} unit="mm" color="#ffba38"/>
              <ResultCard label="Cutting Force" value={Math.round(result.cutting_force_n)} unit="N" color="#34d399"/>
              <ResultCard label="Acoustic" value={Number(result.acoustic_emission_db).toFixed(1)} unit="dB" color="#818cf8"/>
              <ResultCard label="Surface Ra" value={Number(result.surface_finish_ra_um).toFixed(2)} unit="μm" color="#c084fc"/>
            </div>

            {/* Recommendation */}
            {result.recommendation && (
              <div className="bg-[#10141a] rounded-xl px-4 py-3 text-sm text-[#dfe2eb] border border-[#3b494c]/20">
                <span className="text-[#c084fc] font-bold">Recommendation: </span>{result.recommendation}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
