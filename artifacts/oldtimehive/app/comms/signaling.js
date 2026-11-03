// Receive-only account updates: messages and notifications stay on the API.
import { api, requestCloudApi } from "../store.js";
import { cloudApiUrl } from "../api-origin.js";
import { createCloudflareTransport } from "./cloudflare-transport.js";

const chatListeners = new Set();
const notificationListeners = new Set();
let transport = null;
let transportToken = "";

function notifyChatListeners(update) {
  for (const listener of chatListeners) {
    try { Promise.resolve(listener(update)).catch(() => {}); } catch {}
  }
}

function notifyNotificationListeners() {
  for (const listener of notificationListeners) {
    try { Promise.resolve(listener()).catch(() => {}); } catch {}
  }
}

function refreshLiveViews() {
  notifyChatListeners({ conversationId: null });
  notifyNotificationListeners();
}

function ensureConnected() {
  const token = api.cloudAccessToken();
  if (!token) {
    transport?.disconnect();
    transport = null;
    transportToken = "";
    return null;
  }
  if (transport && transportToken === token) return transport;

  transport?.disconnect();
  const currentToken = token;
  const current = createCloudflareTransport({
    url: cloudApiUrl("/api/realtime"),
    requestTicket: () => requestCloudApi("/api/realtime/ticket", { method: "POST", body: {} }),
    isCurrent: () => api.cloudAccessToken() === currentToken,
  });
  transport = current;
  transportToken = currentToken;
  current.on("chat:changed", notifyChatListeners)
    .on("notifications:changed", notifyNotificationListeners)
    .on("connect", refreshLiveViews);
  return current;
}

export function subscribeChatUpdates(fn) {
  chatListeners.add(fn);
  ensureConnected();
  return () => chatListeners.delete(fn);
}

export function subscribeNotificationUpdates(fn) {
  notificationListeners.add(fn);
  ensureConnected();
  return () => notificationListeners.delete(fn);
}

// Live rooms and one-to-one calling stay disabled. Never relay legacy signaling.
export function subscribe() { return () => {}; }
export function publish() { return false; }
export function reportCallTransport() { return false; }

export function maintainSignalConnection({ refresh = false } = {}) {
  const active = ensureConnected();
  if (refresh && active?.connected) refreshLiveViews();
}

if (typeof window !== "undefined") {
  window.addEventListener("oldtime-cloud-session-changed", () => maintainSignalConnection());
  window.addEventListener("online", () => maintainSignalConnection({ refresh: true }));
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) maintainSignalConnection({ refresh: true });
  });
}
