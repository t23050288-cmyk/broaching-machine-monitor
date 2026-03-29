const WS_URL = 'ws://localhost:8765/ws';
let ws = null;
let reconnectTimer = null;
let listeners = [];
let connectionStatus = 'disconnected';

export function getBridgeStatus() { return connectionStatus; }

export function onReading(callback) {
  listeners.push(callback);
  return () => { listeners = listeners.filter(l => l !== callback); };
}

function notifyListeners(data) {
  listeners.forEach(l => { try { l(data); } catch(e) {} });
}

export function connectBridge() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  connectionStatus = 'connecting';
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      connectionStatus = 'connected';
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      notifyListeners({ type: 'status', status: 'connected' });
    };
    ws.onmessage = (event) => {
      try { notifyListeners({ type: 'reading', data: JSON.parse(event.data) }); } catch(e) {}
    };
    ws.onclose = () => {
      connectionStatus = 'disconnected';
      notifyListeners({ type: 'status', status: 'disconnected' });
      reconnectTimer = setTimeout(connectBridge, 3000);
    };
    ws.onerror = () => {
      connectionStatus = 'error';
      notifyListeners({ type: 'status', status: 'error' });
    };
  } catch(e) {
    connectionStatus = 'error';
    reconnectTimer = setTimeout(connectBridge, 5000);
  }
}

export function disconnectBridge() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) { ws.close(); ws = null; }
  connectionStatus = 'disconnected';
}
