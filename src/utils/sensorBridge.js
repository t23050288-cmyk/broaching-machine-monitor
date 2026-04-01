/**
 * sensorBridge.js
 * WebSocket client that connects to the local sensor_bridge.py script.
 * The bridge runs on the same PC as the Arduino and serves data on
 * ws://localhost:8765/ws
 */

const WS_URL = 'ws://localhost:8765/ws';
let ws               = null;
let reconnectTimer   = null;
let pingTimer        = null;
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

function startPing() {
  stopPing();
  pingTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: 'ping' })); } catch (e) { /* ignore */ }
    }
  }, 5000);
}

function stopPing() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
}

export function connectBridge() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  connectionStatus = 'connecting';
  notifyListeners({ type: 'status', status: 'connecting' });
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      connectionStatus = 'connected';
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      notifyListeners({ type: 'status', status: 'connected' });
      startPing();
    };
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'pong') return; // ignore pong
        notifyListeners({ type: 'reading', data: parsed });
      } catch (e) { /* ignore */ }
    };
    ws.onclose = () => {
      connectionStatus = 'disconnected';
      stopPing();
      notifyListeners({ type: 'status', status: 'disconnected' });
      reconnectTimer = setTimeout(connectBridge, 3000);
    };
    ws.onerror = () => {
      connectionStatus = 'error';
      stopPing();
      notifyListeners({ type: 'status', status: 'error' });
    };
  } catch (e) {
    connectionStatus = 'error';
    reconnectTimer = setTimeout(connectBridge, 5000);
  }
}

export function disconnectBridge() {
  stopPing();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) { ws.close(); ws = null; }
  connectionStatus = 'disconnected';
}
