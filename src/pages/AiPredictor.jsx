import { useState, useEffect, useRef } from 'react';
import { getBridgeStatus, onReading, connectBridge } from '../utils/sensorBridge';
import { getReadings, getSettings } from '../utils/storage';
import { Brain, Cpu, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, Download, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react';

const NVIDIA_KEY  = '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';
const NVIDIA_URL  = 'https://integrate.api.nvidia.com/v1/chat/completions';
const AI_MODEL    = 'meta/llama-3.1-8b-instruct';

const DAILY_REPORT_KEY = 'bmm_daily_reports';
const LAST_AUTO_KEY    = 'bmm_last_auto_report';

function getDailyReports() {
  try { return JSON.parse(localStorage.getItem(DAILY_REPORT_KEY) || '[]'); }
  catch { return []; }
}
function saveDailyReport(report) {
  const reports = getDailyReports();
  reports.unshift(report);
  localStorage.setItem(DAILY_REPORT_KEY, JSON.stringify(reports.slice(0, 30)));
}

async function callAI(prompt) {
  const res = await fetch(NVIDIA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NVIDIA_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.15,
      max_tokens: 600,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

export default function AiPredictor() {
  const [bridgeStatus, setBridgeStatus] = useState(getBridgeStatus());
  const [liveReading,  setLiveReading]  = useState(null);
  const [form, setForm] = useState({
    toolId: 'TB001', toolMaterial: 'Carbide', coating: 'TiN', workpiece: 'Steel',
    toolAge: '', cyclesCompleted: '', spindleSpeed: '', feedRate: '',
    depthOfCut: '2.0', coolantFlow: '18', hardness: '200',
    temperature: '', vibration: '', current: '',
  });
  const [predicting, setPredicting] = useState(false);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState('');
  const [reports,    setReports]    = useState(getDailyReports());
  const [genReport,  setGenReport]  = useState(false);
  const [reportText, setReportText] = useState('');
  const [expanded,   setExpanded]   = useState(null);
  const intervalRef = useRef(null);

  // Listen for live sensor data
  useEffect(() => {
    const unsub = onReading((msg) => {
      if (msg.type === 'status') setBridgeStatus(msg.status);
      if (msg.type === 'reading') {
        setLiveReading(msg.data);
        setForm(prev => ({
          ...prev,
          temperature: msg.data.temperature_c?.toFixed(2)  ?? prev.temperature,
          vibration:   msg.data.vibration_rms_mm_s2?.toFixed(3) ?? prev.vibration,
          current:     msg.data.spindle_current_a?.toFixed(3)   ?? prev.current,
        }));
      }
    });
    connectBridge();
    return () => unsub();
  }, []);

  // Auto daily report check — runs once per day
  useEffect(() => {
    const checkAutoReport = () => {
      const last = localStorage.getItem(LAST_AUTO_KEY);
      const today = new Date().toDateString();
      if (last === today) return;
      const readings = getReadings();
      if (readings.length < 10) return;
      const now = new Date();
      // Trigger at 11 PM or later if not done today
      if (now.getHours() >= 23) {
        handleGenerateReport(readings, true);
        localStorage.setItem(LAST_AUTO_KEY, today);
      }
    };
    checkAutoReport();
    intervalRef.current = setInterval(checkAutoReport, 60 * 60 * 1000); // check every hour
    return () => clearInterval(intervalRef.current);
  }, []);

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const isConnected = bridgeStatus === 'connected';

  async function handlePredict() {
    setError('');
    setResult(null);

    if (!isConnected) {
      setError('⚠ Sensors not connected. Please start sensor_bridge.py and connect the Arduino via USB first.');
      return;
    }
    if (!form.temperature || !form.vibration || !form.current) {
      setError('⚠ Sensor readings (Temperature, Vibration, Current) are required. Waiting for live data...');
      return;
    }

    setPredicting(true);
    try {
      const prompt = `You are an expert broaching tool life prediction system.

Live sensor readings from the broaching machine:
- Temperature: ${form.temperature} °C
- Vibration RMS: ${form.vibration} m/s²
- Spindle Current: ${form.current} A

Tool configuration:
- Tool ID: ${form.toolId}
- Material: ${form.toolMaterial}
- Coating: ${form.coating}
- Workpiece: ${form.workpiece}
- Tool Age: ${form.toolAge || 'unknown'} hours
- Cycles Completed: ${form.cyclesCompleted || 'unknown'}
- Spindle Speed: ${form.spindleSpeed || 'auto'} RPM
- Feed Rate: ${form.feedRate || 'auto'} mm/rev
- Depth of Cut: ${form.depthOfCut} mm
- Coolant Flow: ${form.coolantFlow} L/min

Based on these readings, provide a detailed tool life prediction. Respond ONLY with valid JSON:
{
  "status": "Good/Safe" or "Warning" or "Critical/Replace Now",
  "condition": "one line summary of tool condition",
  "wear_percent": <0-100>,
  "remaining_life_hours": <estimated hours remaining>,
  "remaining_cycles": <estimated cycles remaining>,
  "cutting_force_n": <predicted cutting force in Newtons>,
  "acoustic_emission_db": <predicted dB>,
  "surface_finish_ra": <predicted Ra in microns>,
  "recommendation": "specific maintenance or action recommendation",
  "risk_factors": ["factor1", "factor2"],
  "next_inspection": "when to next inspect"
}`;

      const text = await callAI(prompt);
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI returned unexpected format');
      const parsed = JSON.parse(match[0]);
      setResult(parsed);
    } catch (e) {
      setError(`AI prediction failed: ${e.message}. Check your internet connection.`);
    } finally {
      setPredicting(false);
    }
  }

  async function handleGenerateReport(customReadings, auto = false) {
    const readings = customReadings || getReadings();
    if (!readings.length) {
      setError('No sensor data available for report. Run the machine first.');
      return;
    }
    setGenReport(true);
    setReportText('');
    try {
      const temps  = readings.map(r => r.temperature_c).filter(Boolean);
      const vibs   = readings.map(r => r.vibration_rms_mm_s2).filter(Boolean);
      const currs  = readings.map(r => r.spindle_current_a).filter(Boolean);
      const wears  = readings.map(r => r.wear_progression).filter(Boolean);
      const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
      const max = arr => arr.length ? Math.max(...arr) : 0;
      const min = arr => arr.length ? Math.min(...arr) : 0;

      const prompt = `You are a broaching machine health expert. Generate a comprehensive daily report.

Date: ${new Date().toLocaleDateString('en-IN', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}
Total readings analyzed: ${readings.length}

Sensor Statistics:
- Temperature: avg=${avg(temps).toFixed(1)}°C, max=${max(temps).toFixed(1)}°C, min=${min(temps).toFixed(1)}°C
- Vibration:   avg=${avg(vibs).toFixed(3)} m/s², max=${max(vibs).toFixed(3)} m/s²
- Current:     avg=${avg(currs).toFixed(2)}A, max=${max(currs).toFixed(2)}A
- Wear:        start=${wears[0]?.toFixed(3)||'N/A'}, end=${wears[wears.length-1]?.toFixed(3)||'N/A'}

Write a detailed daily health report with these sections:
1. EXECUTIVE SUMMARY (2-3 sentences)
2. MACHINE HEALTH STATUS (Good/Warning/Critical with reasoning)
3. SENSOR ANALYSIS (what each sensor trend means)
4. TOOL WEAR ASSESSMENT
5. MAINTENANCE RECOMMENDATIONS (specific actions)
6. TOMORROW'S OUTLOOK (predicted conditions)

Be specific, practical and clear. Use plain language.`;

      const text = await callAI(prompt);
      const reportObj = {
        id: Date.now(),
        date: new Date().toISOString(),
        dateLabel: new Date().toLocaleDateString('en-IN', {weekday:'short', month:'short', day:'numeric', year:'numeric'}),
        readingCount: readings.length,
        text,
        auto,
        avgTemp: avg(temps).toFixed(1),
        avgVib:  avg(vibs).toFixed(3),
        avgCurr: avg(currs).toFixed(2),
      };
      saveDailyReport(reportObj);
      setReports(getDailyReports());
      setReportText(text);
      setExpanded(reportObj.id);
    } catch (e) {
      setError(`Report generation failed: ${e.message}`);
    } finally {
      setGenReport(false);
    }
  }

  const statusColor = (s) => {
    if (!s) return '#849396';
    const sl = s.toLowerCase();
    if (sl.includes('good') || sl.includes('safe')) return '#00e5ff';
    if (sl.includes('warning')) return '#ffba38';
    return '#ffb4ab';
  };
  const statusBg = (s) => {
    if (!s) return 'bg-[#1c2026]';
    const sl = s.toLowerCase();
    if (sl.includes('good') || sl.includes('safe')) return 'bg-[#00e5ff]/10 border border-[#00e5ff]/20';
    if (sl.includes('warning')) return 'bg-[#ffba38]/10 border border-[#ffba38]/20';
    return 'bg-[#ffb4ab]/10 border border-[#ffb4ab]/20';
  };

  function Field({ label, value, onChange, type='text', placeholder='', readOnly=false }) {
    return (
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-[0.15em] text-[#849396]">{label}</label>
        <input type={type} value={value} onChange={e=>onChange(e.target.value)}
          placeholder={placeholder} readOnly={readOnly}
          className={`w-full bg-[#10141a] border border-[#3b494c]/40 text-[#dfe2eb] text-sm rounded-lg px-3 py-2 outline-none transition-colors
            ${readOnly ? 'text-[#00e5ff] border-[#00e5ff]/30 cursor-default' : 'focus:border-[#00daf3]/50 placeholder-[#3b494c]'}`}/>
      </div>
    );
  }

  function Select({ label, value, onChange, options }) {
    return (
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-[0.15em] text-[#849396]">{label}</label>
        <select value={value} onChange={e=>onChange(e.target.value)}
          className="w-full bg-[#10141a] border border-[#3b494c]/40 text-[#dfe2eb] text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00daf3]/50">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight flex items-center gap-2">
            <Brain size={22} className="text-[#c084fc]"/> AI Tool Life Predictor
          </h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">NVIDIA AI · Real-time Sensor Integration · Daily Reports</div>
        </div>
        {/* Connection badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border
          ${isConnected ? 'bg-[#00e5ff]/10 border-[#00e5ff]/30 text-[#00e5ff]' : 'bg-[#ffb4ab]/10 border-[#ffb4ab]/30 text-[#ffb4ab]'}`}>
          {isConnected ? <Wifi size={12}/> : <WifiOff size={12}/>}
          {isConnected ? 'Sensors Live' : 'Sensors Offline'}
        </div>
      </div>

      {/* Not connected warning */}
      {!isConnected && (
        <div className="bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-[#ffba38] flex-shrink-0 mt-0.5"/>
          <div>
            <div className="text-sm font-bold text-[#ffba38] mb-1">Sensors Not Connected</div>
            <div className="text-xs text-[#849396] leading-relaxed">
              AI prediction requires live sensor data. Please:
              <ol className="mt-1.5 space-y-0.5 list-decimal list-inside">
                <li>Connect Arduino via USB</li>
                <li>Open Command Prompt → run: <code className="text-[#00daf3] bg-[#10141a] px-1 rounded">python sensor_bridge.py</code></li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Live sensor strip */}
      {isConnected && liveReading && (
        <div className="bg-[#00e5ff]/5 border border-[#00e5ff]/20 rounded-xl p-3 flex flex-wrap gap-6">
          <div className="text-[10px] uppercase tracking-widest text-[#00e5ff] font-bold self-center">● LIVE SENSORS</div>
          {[
            ['Temperature', liveReading.temperature_c?.toFixed(1), '°C'],
            ['Vibration',   liveReading.vibration_rms_mm_s2?.toFixed(3), 'm/s²'],
            ['Current',     liveReading.spindle_current_a?.toFixed(3), 'A'],
          ].map(([l,v,u]) => (
            <div key={l} className="flex items-baseline gap-1">
              <span className="text-[9px] text-[#849396] uppercase tracking-wider">{l}</span>
              <span className="text-lg font-black text-[#c3f5ff]">{v}</span>
              <span className="text-xs text-[#849396]">{u}</span>
            </div>
          ))}
          <div className="text-[9px] text-[#849396] self-center ml-auto">
            Auto-filled below ↓
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-5">
          {/* Tool Info */}
          <div className="bg-[#181c22] rounded-xl p-5 space-y-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Tool Information</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tool ID" value={form.toolId} onChange={v=>update('toolId',v)}/>
              <Select label="Tool Material" value={form.toolMaterial} onChange={v=>update('toolMaterial',v)}
                options={['Carbide','HSS','Cobalt HSS','Cermet','CBN']}/>
              <Select label="Coating" value={form.coating} onChange={v=>update('coating',v)}
                options={['TiN','TiCN','TiAlN','DLC','Uncoated']}/>
              <Select label="Workpiece Material" value={form.workpiece} onChange={v=>update('workpiece',v)}
                options={['Steel','Stainless Steel','Cast Iron','Aluminum','Titanium']}/>
              <Field label="Tool Age (hours)" value={form.toolAge} onChange={v=>update('toolAge',v)} placeholder="e.g. 150"/>
              <Field label="Cycles Completed" value={form.cyclesCompleted} onChange={v=>update('cyclesCompleted',v)} placeholder="e.g. 4500"/>
            </div>
          </div>

          {/* Cutting Parameters */}
          <div className="bg-[#181c22] rounded-xl p-5 space-y-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Cutting Parameters</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Spindle Speed (RPM)" value={form.spindleSpeed} onChange={v=>update('spindleSpeed',v)} placeholder="e.g. 1200"/>
              <Field label="Feed Rate (mm/rev)" value={form.feedRate} onChange={v=>update('feedRate',v)} placeholder="e.g. 0.15"/>
              <Field label="Depth of Cut (mm)" value={form.depthOfCut} onChange={v=>update('depthOfCut',v)}/>
              <Field label="Coolant Flow (L/min)" value={form.coolantFlow} onChange={v=>update('coolantFlow',v)}/>
              <Field label="Hardness (HB)" value={form.hardness} onChange={v=>update('hardness',v)}/>
            </div>
          </div>

          {/* Sensor Readings */}
          <div className="bg-[#181c22] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Sensor Readings</div>
              {isConnected && <span className="text-[9px] text-[#00e5ff] uppercase tracking-wider">● Auto-updating</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Temperature (°C)" value={form.temperature} onChange={v=>update('temperature',v)}
                placeholder="waiting..." readOnly={isConnected}/>
              <Field label="Vibration (m/s²)" value={form.vibration} onChange={v=>update('vibration',v)}
                placeholder="waiting..." readOnly={isConnected}/>
              <Field label="Current (A)" value={form.current} onChange={v=>update('current',v)}
                placeholder="waiting..." readOnly={isConnected}/>
            </div>
            {!isConnected && (
              <p className="text-[10px] text-[#849396]">You can enter values manually while sensors are offline for a test prediction.</p>
            )}
          </div>

          {/* Predict button */}
          <button onClick={handlePredict} disabled={predicting}
            className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl text-sm font-bold transition-all
              ${predicting
                ? 'bg-[#c084fc]/20 text-[#c084fc] cursor-wait'
                : isConnected
                  ? 'bg-gradient-to-r from-[#c084fc] to-[#818cf8] text-white hover:opacity-90 shadow-lg shadow-[#c084fc]/20'
                  : 'bg-[#3b494c]/30 text-[#849396] hover:bg-[#ffb4ab]/10 hover:text-[#ffb4ab]'
              }`}>
            {predicting
              ? <><RefreshCw size={16} className="animate-spin"/> Analyzing with AI...</>
              : <><Brain size={16}/> Predict Tool Status</>
            }
          </button>

          {/* Error */}
          {error && (
            <div className="bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 rounded-xl p-3 flex items-start gap-2">
              <XCircle size={14} className="text-[#ffb4ab] flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-[#ffb4ab]">{error}</p>
            </div>
          )}
        </div>

        {/* Right: Result + Reports */}
        <div className="space-y-5">
          {/* Prediction Result */}
          {result ? (
            <div className={`rounded-xl p-5 space-y-4 ${statusBg(result.status)}`}>
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">AI Prediction Result</div>
                {result.status?.toLowerCase().includes('good') || result.status?.toLowerCase().includes('safe')
                  ? <CheckCircle size={18} style={{color: statusColor(result.status)}}/>
                  : <AlertTriangle size={18} style={{color: statusColor(result.status)}}/>}
              </div>

              {/* Big status */}
              <div className="text-center py-3">
                <div className="text-3xl font-black font-headline" style={{color: statusColor(result.status)}}>
                  {result.status}
                </div>
                <div className="text-sm text-[#849396] mt-1">{result.condition}</div>
              </div>

              {/* Wear + Life */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#10141a]/60 rounded-lg p-3 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[#849396]">Wear</div>
                  <div className="text-2xl font-black text-[#ffba38]">{result.wear_percent}%</div>
                </div>
                <div className="bg-[#10141a]/60 rounded-lg p-3 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[#849396]">Life Remaining</div>
                  <div className="text-xl font-black text-[#c3f5ff]">{result.remaining_life_hours}h</div>
                  <div className="text-[9px] text-[#849396]">{result.remaining_cycles} cycles</div>
                </div>
              </div>

              {/* Predicted params */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Force', result.cutting_force_n, 'N'],
                  ['Acoustic', result.acoustic_emission_db, 'dB'],
                  ['Surface Ra', result.surface_finish_ra, 'μm'],
                ].map(([l,v,u]) => (
                  <div key={l} className="bg-[#10141a]/60 rounded-lg p-2 text-center">
                    <div className="text-[9px] uppercase tracking-wider text-[#849396]">{l}</div>
                    <div className="text-sm font-bold text-[#dfe2eb]">{v} <span className="text-[9px] text-[#849396]">{u}</span></div>
                  </div>
                ))}
              </div>

              {/* Recommendation */}
              <div className="bg-[#10141a]/60 rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1">Recommendation</div>
                <p className="text-xs text-[#dfe2eb] leading-relaxed">{result.recommendation}</p>
              </div>

              {/* Risk factors */}
              {result.risk_factors?.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-2">Risk Factors</div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.risk_factors.map((r,i) => (
                      <span key={i} className="text-[10px] bg-[#ffba38]/10 text-[#ffba38] border border-[#ffba38]/20 px-2 py-0.5 rounded-full">{r}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[9px] text-[#849396] flex items-center gap-1">
                <Clock size={10}/> Next inspection: {result.next_inspection}
              </div>
            </div>
          ) : (
            <div className="bg-[#181c22] rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3">
              <Brain size={40} className="text-[#3b494c]"/>
              <div className="text-sm text-[#849396]">Fill in tool details and click<br/>"Predict Tool Status" to get AI analysis</div>
              {!isConnected && <div className="text-xs text-[#ffba38]">⚠ Connect sensors first for live data</div>}
            </div>
          )}

          {/* Daily Reports */}
          <div className="bg-[#181c22] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">Daily Reports</div>
              <button onClick={() => handleGenerateReport()} disabled={genReport}
                className="flex items-center gap-1.5 text-xs text-[#00daf3] hover:text-[#c3f5ff] border border-[#00daf3]/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                {genReport ? <RefreshCw size={11} className="animate-spin"/> : <Download size={11}/>}
                {genReport ? 'Generating...' : 'Generate Now'}
              </button>
            </div>

            <p className="text-[10px] text-[#849396]">Reports auto-generate daily at 11 PM. Click "Generate Now" anytime.</p>

            {reports.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#849396]">
                No reports yet. Run the machine and click "Generate Now".
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {reports.map(r => (
                  <div key={r.id} className="bg-[#10141a] rounded-lg border border-[#3b494c]/20">
                    <button onClick={() => setExpanded(expanded===r.id ? null : r.id)}
                      className="w-full flex items-center justify-between p-3 text-left">
                      <div>
                        <div className="text-xs font-bold text-[#dfe2eb]">{r.dateLabel}</div>
                        <div className="text-[9px] text-[#849396] mt-0.5">
                          {r.readingCount} readings · T:{r.avgTemp}°C · V:{r.avgVib} · I:{r.avgCurr}A
                          {r.auto && <span className="ml-2 text-[#00e5ff]">● auto</span>}
                        </div>
                      </div>
                      {expanded===r.id ? <ChevronUp size={14} className="text-[#849396]"/> : <ChevronDown size={14} className="text-[#849396]"/>}
                    </button>
                    {expanded===r.id && (
                      <div className="px-3 pb-3">
                        <div className="text-[11px] text-[#c3f5ff] leading-relaxed whitespace-pre-wrap border-t border-[#3b494c]/20 pt-3">
                          {r.text}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
