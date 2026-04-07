/**
 * sensorBridge.js v4.0 — Python Bridge via WebSocket
 *
 * All pages connect to the local Python bridge (sensor_bridge.py)
 * running on ws://localhost:8765
 *
 * Run once: python sensor_bridge.py
 * Then ALL pages get live data automatically.
 */

const WS_URL = 'ws://localhost:8765';
const RECONNECT_DELAY = 3000;

let ws = null;
let status = 'disconnected';
let reconnectTimer = null;
let stopping = false;

const listeners = new Set();
const chatListeners = new Set();

function notifyAll(msg) {
  listeners.forEach(fn => fn(msg));
}

export function getBridgeStatus() { return status; }

export function onReading(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onChatReply(fn) {
  chatListeners.add(fn);
  return () => chatListeners.delete(fn);
}

export function sendChatMessage(messages) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'chat', messages }));
  }
}

function scheduleReconnect() {
  if (stopping) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (!stopping) connectBridge();
  }, RECONNECT_DELAY);
}

export function connectBridge() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  stopping = false;

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      status = 'connected';
      notifyAll({ type: 'status', status: 'connected' });
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'reading') {
          notifyAll({ type: 'reading', data: msg.data });
        } else if (msg.type === 'chat_reply') {
          chatListeners.forEach(fn => fn(msg.content));
        } else if (msg.type === 'status') {
          notifyAll({ type: 'status', status: msg.status });
        }
      } catch (_) {}
    };

    ws.onerror = () => {
      status = 'disconnected';
      notifyAll({ type: 'status', status: 'disconnected' });
    };

    ws.onclose = () => {
      status = 'disconnected';
      notifyAll({ type: 'status', status: 'disconnected' });
      scheduleReconnect();
    };

  } catch (e) {
    status = 'disconnected';
    notifyAll({ type: 'status', status: 'disconnected' });
    scheduleReconnect();
  }
}

export function disconnectBridge() {
  stopping = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.close(); ws = null; }
  status = 'disconnected';
  notifyAll({ type: 'status', status: 'disconnected' });
}

// Auto-connect when module loads
connectBridge();
