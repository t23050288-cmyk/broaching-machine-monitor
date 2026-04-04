/**
 * sensorBridge.js
 * Manages the WebSocket connection to sensor_bridge.py (localhost:8765)
 * Handles both sensor readings and AI chat messages.
 */

const WS_URL = 'ws://localhost:8765';

let ws            = null;
let status        = 'disconnected';
let reconnectTimer = null;
const listeners   = new Set();
const chatListeners = new Set();

export function getBridgeStatus() {
  return status;
}

function notifyAll(msg) {
  listeners.forEach(fn => fn(msg));
}

function notifyChat(reply) {
  chatListeners.forEach(fn => fn(reply));
}

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

export function connectBridge() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    status = 'connected';
    notifyAll({ type: 'status', status: 'connected' });
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'chat_reply') {
        notifyChat(msg.reply);
      } else {
        notifyAll(msg);
        if (msg.type === 'status') status = msg.status;
      }
    } catch (e) {
      console.warn('Bridge parse error:', e);
    }
  };

  ws.onerror = () => {
    status = 'error';
    notifyAll({ type: 'status', status: 'disconnected' });
  };

  ws.onclose = () => {
    status = 'disconnected';
    notifyAll({ type: 'status', status: 'disconnected' });
    ws = null;
    // Auto-reconnect every 3 seconds
    reconnectTimer = setTimeout(connectBridge, 3000);
  };
}

export function disconnectBridge() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.close(); ws = null; }
  status = 'disconnected';
}
