import { useState, useEffect, useRef } from 'react';
import { onReading, connectBridge, getBridgeStatus } from '../utils/sensorBridge';
import { Table, Wifi, WifiOff, Download, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'bmm_sensor_table';
const MAX_ROWS    = 500;

function loadRows() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveRows(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-MAX_ROWS)));
}

function fmt(v, dec = 1) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Number(v).toFixed(dec);
}

function statusColor(status) {
  if (!status) return '#849396';
  const s = status.toLowerCase();
  if (s === 'new')    return '#00e5ff';
  if (s === 'worn')   return '#ffba38';
  return '#ffb4ab';
}

export default function SensorReadings() {
  const [rows,         setRows]         = useState(() => loadRows());
  const [bridgeStatus, setBridgeStatus] = useState(getBridgeStatus());
  const [autoScroll,   setAutoScroll]   = useState(true);
  const tableEndRef = useRef(null);

  useEffect(() => {
    const unsub = onReading((msg) => {
      if (msg.type === 'status') {
        setBridgeStatus(msg.status);
      } else if (msg.type === 'reading') {
        const d = msg.data;
        const row = {
          time:         new Date(d.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          date:         new Date(d.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          temp:         d.temperature_c,
          vib:          d.vibration_rms_mm_s2,
          curr:         d.spindle_current_a,
          acoustic:     d.acoustic_emission_db,
          force:        d.cutting_force_n,
          surface:      d.surface_finish_ra_um,
          wear:         d.wear_progression,
          status:       d.tool_status,
          cycle:        d.cycle,
        };
        setRows(prev => {
          const updated = [row, ...prev].slice(0, MAX_ROWS);
          saveRows(updated);
          return updated;
        });
      }
    });
    connectBridge();
    return () => unsub();
  }, []);

  useEffect(() => {
    if (autoScroll) tableEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rows, autoScroll]);

  const isConnected = bridgeStatus === 'connected';

  function exportCSV() {
    const header = 'Date,Time,Cycle,Temp(°C),Vib(m/s²),Current(A),Acoustic(dB),Force(N),Surface Ra(µm),Wear,Status';
    const lines  = rows.map(r =>
      `${r.date},${r.time},${r.cycle ?? ''},${fmt(r.temp,2)},${fmt(r.vib,3)},${fmt(r.curr,3)},${fmt(r.acoustic,1)},${fmt(r.force,1)},${fmt(r.surface,2)},${fmt(r.wear,4)},${r.status ?? ''}`
    );
    const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `sensor_readings_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function clearData() {
    if (window.confirm('Clear all stored readings?')) {
      setRows([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Latest reading for the summary cards
  const latest = rows[0];

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black font-headline text-[#dfe2eb] tracking-tight flex items-center gap-2">
            <Table size={20} className="text-[#00e5ff]"/> Sensor Readings
          </h1>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396] mt-0.5">24/7 Live Log · {rows.length} readings stored</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full border font-bold
            ${isConnected ? 'text-[#00e5ff] bg-[#00e5ff]/10 border-[#00e5ff]/20' : 'text-[#ffb4ab] bg-[#ffb4ab]/10 border-[#ffb4ab]/20'}`}>
            {isConnected ? <><Wifi size={11}/> Live</> : <><WifiOff size={11}/> Offline</>}
          </div>
          <button onClick={exportCSV} disabled={!rows.length}
            className="flex items-center gap-1.5 text-xs text-[#00daf3] border border-[#00daf3]/30 px-3 py-1.5 rounded-lg hover:bg-[#00daf3]/10 transition-colors disabled:opacity-40">
            <Download size={12}/> Export CSV
          </button>
          <button onClick={clearData} disabled={!rows.length}
            className="flex items-center gap-1.5 text-xs text-[#849396] border border-[#3b494c]/30 px-3 py-1.5 rounded-lg hover:text-[#ffb4ab] hover:border-[#ffb4ab]/30 transition-colors disabled:opacity-40">
            <Trash2 size={12}/> Clear
          </button>
        </div>
      </div>

      {/* Live summary cards — shows latest values big and clear */}
      {latest ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Temp',     value: fmt(latest.temp, 1),     unit: '°C',    color: '#ff9259' },
            { label: 'Vibration',value: fmt(latest.vib, 3),      unit: 'm/s²',  color: '#00e5ff' },
            { label: 'Current',  value: fmt(latest.curr, 2),     unit: 'A',     color: '#818cf8' },
            { label: 'Acoustic', value: fmt(latest.acoustic, 1), unit: 'dB',    color: '#ffba38' },
            { label: 'Force',    value: fmt(latest.force, 0),    unit: 'N',     color: '#34d399' },
            { label: 'Surface Ra',value: fmt(latest.surface, 2), unit: 'µm',   color: '#c084fc' },
            { label: 'Tool Status',value: latest.status ?? '—',  unit: '',      color: statusColor(latest.status) },
          ].map(({ label, value, unit, color }) => (
            <div key={label} className="bg-[#181c22] rounded-xl p-3 text-center border border-[#3b494c]/15">
              <div className="text-[9px] uppercase tracking-wider text-[#849396] mb-1">{label}</div>
              <div className="text-xl font-black" style={{ color }}>{value}</div>
              {unit && <div className="text-[10px] text-[#849396]">{unit}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#181c22] rounded-xl p-6 text-center text-sm text-[#849396]">
          {isConnected
            ? '⏳ Waiting for first reading from sensors...'
            : '🔌 Start sensor_bridge.py to begin receiving data'}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#181c22] rounded-xl border border-[#3b494c]/15 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3b494c]/15">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#849396]">All Readings — newest first</div>
          <label className="flex items-center gap-2 text-[10px] text-[#849396] cursor-pointer">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}
              className="accent-[#00e5ff]"/>
            Auto-scroll
          </label>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#10141a] text-[#849396]">
              <tr>
                {['#', 'Date', 'Time', 'Temp (°C)', 'Vib (m/s²)', 'Curr (A)', 'Acoustic (dB)', 'Force (N)', 'Surface Ra', 'Wear', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider whitespace-nowrap font-semibold border-b border-[#3b494c]/20">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-[#849396]">
                    No data yet. Connect sensors and run the machine.
                  </td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr key={i}
                  className={`border-b border-[#3b494c]/10 transition-colors
                    ${i === 0 ? 'bg-[#00e5ff]/5' : 'hover:bg-[#1c2026]'}`}>
                  <td className="px-3 py-2 text-[#3b494c] font-mono">{row.cycle ?? rows.length - i}</td>
                  <td className="px-3 py-2 text-[#849396] whitespace-nowrap">{row.date}</td>
                  <td className="px-3 py-2 text-[#dfe2eb] font-mono whitespace-nowrap">{row.time}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: '#ff9259' }}>{fmt(row.temp, 1)}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: '#00e5ff' }}>{fmt(row.vib, 3)}</td>
                  <td className="px-3 py-2 font-bold" style={{ color: '#818cf8' }}>{fmt(row.curr, 2)}</td>
                  <td className="px-3 py-2" style={{ color: '#ffba38' }}>{fmt(row.acoustic, 1)}</td>
                  <td className="px-3 py-2" style={{ color: '#34d399' }}>{fmt(row.force, 0)}</td>
                  <td className="px-3 py-2" style={{ color: '#c084fc' }}>{fmt(row.surface, 2)}</td>
                  <td className="px-3 py-2 text-[#dfe2eb]">{fmt(row.wear, 4)}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                      style={{ color: statusColor(row.status), background: statusColor(row.status) + '20', border: `1px solid ${statusColor(row.status)}40` }}>
                      {row.status ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div ref={tableEndRef}/>
        </div>
      </div>
    </div>
  );
}
