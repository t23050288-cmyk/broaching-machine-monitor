import { useState, useRef, useEffect } from 'react';
import { onReading, connectBridge } from '../utils/sensorBridge';
import { MessageCircle, Send, RefreshCw, Bot, User, Trash2 } from 'lucide-react';

// Backend proxy — no CORS issues
const AI_ENDPOINT = 'https://api.base44.com/api/apps/69c94fa77c9af5dded65069d/functions/askAI';

const CHAT_KEY = 'bmm_chat_history';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); }
  catch { return []; }
}
function saveHistory(msgs) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-100)));
}

const SUGGESTIONS = [
  'What does high vibration mean?',
  'When should I replace the broaching tool?',
  'Why is temperature rising?',
  'What is normal current draw?',
  'How to improve tool life?',
  'What is wear progression?',
];

export default function Chatbot() {
  const [messages, setMessages] = useState(() => loadHistory());
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [liveData, setLiveData] = useState(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    const unsub = onReading((msg) => {
      if (msg.type === 'reading') setLiveData(msg.data);
    });
    connectBridge();
    return () => unsub();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text) {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: userText, ts: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    saveHistory(updated);
    setLoading(true);

    try {
      // Build sensor context string if live data available
      let sensorContext = '';
      if (liveData) {
        sensorContext = `Temperature: ${liveData.temperature_c?.toFixed(2)}°C, Vibration: ${liveData.vibration_rms_mm_s2?.toFixed(3)} m/s², Current: ${liveData.spindle_current_a?.toFixed(3)} A, Tool Status: ${liveData.tool_status}, Wear: ${liveData.wear_progression?.toFixed(3)}`;
      }

      const history = updated.slice(-10).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, sensorContext }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Server error ${res.status}`);

      const aiMsg = { role: 'assistant', content: data.reply, ts: Date.now() };
      const final = [...updated, aiMsg];
      setMessages(final);
      saveHistory(final);
    } catch (e) {
      const errMsg = {
        role: 'assistant',
        content: `Sorry, something went wrong: ${e.message}`,
        ts: Date.now(),
        error: true,
      };
      const final = [...updated, errMsg];
      setMessages(final);
      saveHistory(final);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function clearChat() {
    setMessages([]);
    localStorage.removeItem(CHAT_KEY);
  }

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#181c22] border-b border-[#3b494c]/15 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#c084fc]/20 flex items-center justify-center">
            <Bot size={18} className="text-[#c084fc]"/>
          </div>
          <div>
            <div className="text-sm font-black text-[#dfe2eb]">KineticAI Assistant</div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-[#849396]">Broaching Machine Expert · NVIDIA AI</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {liveData && (
            <div className="flex items-center gap-1.5 text-[10px] text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-pulse"/>
              Sensors Live
            </div>
          )}
          {messages.length > 0 && (
            <button onClick={clearChat} className="text-[#849396] hover:text-[#ffb4ab] transition-colors" title="Clear chat">
              <Trash2 size={15}/>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-10">
            <div className="w-16 h-16 rounded-full bg-[#c084fc]/10 border border-[#c084fc]/20 flex items-center justify-center">
              <MessageCircle size={28} className="text-[#c084fc]"/>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-[#dfe2eb] mb-1">Ask me anything</div>
              <div className="text-xs text-[#849396]">I know everything about broaching machines,<br/>tool wear, sensors, and maintenance.</div>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-left text-xs text-[#849396] hover:text-[#dfe2eb] bg-[#181c22] hover:bg-[#1c2026] border border-[#3b494c]/20 hover:border-[#c084fc]/30 rounded-xl px-3 py-2.5 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
              ${msg.role === 'user' ? 'bg-[#00e5ff]/20' : 'bg-[#c084fc]/20'}`}>
              {msg.role === 'user'
                ? <User size={13} className="text-[#00e5ff]"/>
                : <Bot  size={13} className="text-[#c084fc]"/>}
            </div>
            <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed
              ${msg.role === 'user'
                ? 'bg-[#00e5ff]/10 border border-[#00e5ff]/15 text-[#dfe2eb] rounded-tr-sm'
                : msg.error
                  ? 'bg-[#ffb4ab]/10 border border-[#ffb4ab]/15 text-[#ffb4ab] rounded-tl-sm'
                  : 'bg-[#181c22] border border-[#3b494c]/20 text-[#dfe2eb] rounded-tl-sm'
              }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              <div className="text-[9px] text-[#3b494c] mt-1.5">
                {new Date(msg.ts).toLocaleTimeString('en', {hour:'2-digit', minute:'2-digit'})}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[#c084fc]/20 flex items-center justify-center flex-shrink-0">
              <Bot size={13} className="text-[#c084fc]"/>
            </div>
            <div className="bg-[#181c22] border border-[#3b494c]/20 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-[#c084fc] rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                <span className="w-1.5 h-1.5 bg-[#c084fc] rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                <span className="w-1.5 h-1.5 bg-[#c084fc] rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="px-4 py-4 bg-[#181c22] border-t border-[#3b494c]/15 flex-shrink-0">
        <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            placeholder="Ask about tool wear, vibration, maintenance..."
            disabled={loading}
            className="flex-1 bg-[#10141a] border border-[#3b494c]/40 text-[#dfe2eb] text-sm rounded-xl px-4 py-3 outline-none focus:border-[#c084fc]/50 placeholder-[#3b494c] disabled:opacity-50"/>
          <button type="submit" disabled={loading || !input.trim()}
            className="w-11 h-11 rounded-xl bg-[#c084fc] hover:bg-[#a855f7] disabled:bg-[#3b494c]/30 disabled:text-[#849396] text-white flex items-center justify-center transition-colors flex-shrink-0">
            {loading ? <RefreshCw size={15} className="animate-spin"/> : <Send size={15}/>}
          </button>
        </form>
        <div className="text-[9px] text-[#3b494c] mt-2 text-center">Powered by NVIDIA AI · Broaching Machine Expert</div>
      </div>
    </div>
  );
}
