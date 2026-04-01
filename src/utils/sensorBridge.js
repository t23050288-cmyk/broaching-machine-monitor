/**
 * sensorBridge.js  v4.0
 * WebSocket client — connects to local sensor_bridge.py
 * ws://localhost:8765/ws
 */

const WS_URL = 'ws://localhost:8765/ws';
let ws               = null;
let reconnectTimer   = null;
let listeners        = [];
let connectionStatus = 'disconnected';

export function getBridgeStatus() { return connectionStatus; }

export function onReading(callback) {
  listeners.push(callback);
  return () => { listeners = listeners.filter(l => l !== callback); };
}

function notifyListeners(data) {
  listeners.forEach(l => { try { l(data); } catch (e) { /* ignore */ } });
}

function setStatus(status) {
  connectionStatus = status;
  notifyListeners({ type: 'status', status });
}

export function connectBridge() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  setStatus('connecting');

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'pong') return;
        notifyListeners({ type: 'reading', data: parsed });
      } catch (e) { /* ignore */ }
    };

    ws.onclose = (e) => {
      ws = null;
      setStatus('disconnected');
      // reconnect after 2 seconds
      reconnectTimer = setTimeout(connectBridge, 2000);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, so just log
      setStatus('error');
    };

  } catch (e) {
    ws = null;
    setStatus('error');
    reconnectTimer = setTimeout(connectBridge, 3000);
  }
}

export function disconnectBridge() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) {
    ws.onclose = null; // prevent auto-reconnect
    ws.close();
    ws = null;
  }
  setStatus('disconnected');
}
