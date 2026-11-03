// Native receive-only transport. No Socket.IO polling, message history, calls,
// permanent credentials in URLs, or background-tab requests.
export function createCloudflareTransport({ url, requestTicket, isCurrent }) {
  const listeners = new Map();
  let websocket = null, stopped = false, opening = false, denied = false, attempts = 0;
  let reconnectTimer, heartbeatTimer, flushTimer;
  let notificationsPending = false, allChatsPending = false;
  const chatsPending = new Set();
  const visible = () => !document.hidden && navigator.onLine !== false;
  const emit = (name, value) => {
    for (const fn of listeners.get(name) || []) { try { fn(value); } catch {} }
  };
  function flush() {
    flushTimer = null;
    if (!visible() || !isCurrent()) return;
    if (allChatsPending || chatsPending.size) emit("chat:changed", { conversationId: !allChatsPending && chatsPending.size === 1 ? [...chatsPending][0] : null });
    if (notificationsPending) emit("notifications:changed");
    notificationsPending = false; allChatsPending = false; chatsPending.clear();
  }
  function queue(message) {
    if (message.event === "notifications:changed") notificationsPending = true;
    if (message.event === "chat:changed") {
      if (typeof message.data?.conversationId === "string") chatsPending.add(message.data.conversationId);
      else allChatsPending = true;
    }
    if (!flushTimer) flushTimer = setTimeout(flush, 150);
  }
  function retry(error) {
    if (stopped || denied || !visible() || !isCurrent() || reconnectTimer) return;
    const delay = error?.status === 429 ? 60000 : Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)) * (0.8 + Math.random() * 0.4);
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay);
  }
  async function connect() {
    if (stopped || denied || opening || !visible() || !isCurrent() || websocket?.readyState === WebSocket.OPEN || websocket?.readyState === WebSocket.CONNECTING) return;
    opening = true;
    try {
      const ticket = await requestTicket();
      if (stopped || !visible() || !isCurrent()) return;
      const endpoint = new URL(url, window.location.origin);
      endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
      endpoint.searchParams.set("ticket", ticket.ticket);
      const current = new WebSocket(endpoint);
      websocket = current;
      current.onopen = () => {
        if (stopped || !visible() || !isCurrent()) { current.close(); return; }
        attempts = 0;
        heartbeatTimer = setInterval(() => { if (current.readyState === WebSocket.OPEN) current.send("ping"); }, 45000);
        emit("connect");
      };
      current.onmessage = event => {
        if (stopped || !visible() || !isCurrent() || event.data === "pong" || typeof event.data !== "string") return;
        try {
          const message = JSON.parse(event.data);
          if (message.event === "session:expired") {
            denied = true;
            current.close(1000, "Session expired");
            // Refresh through the authenticated HTTP client so the existing
            // session-expiry handling clears stale account views.
            emit("chat:changed", { conversationId: null });
            emit("notifications:changed");
            return;
          }
          if (message.event === "chat:changed" || message.event === "notifications:changed") queue(message);
        } catch {}
      };
      current.onerror = () => current.close();
      current.onclose = () => {
        clearInterval(heartbeatTimer);
        if (websocket === current) websocket = null;
        emit("disconnect");
        retry();
      };
    } catch (error) {
      denied = error?.status === 401;
      emit("connect_error", error);
      retry(error);
    } finally { opening = false; }
  }
  function visibilityChanged() {
    clearTimeout(reconnectTimer); reconnectTimer = null;
    if (!visible()) {
      clearInterval(heartbeatTimer);
      websocket?.close(1000, "App paused");
    } else connect();
  }
  // Preserve an HTTP refresh fallback when a network blocks WebSockets, but
  // only while visible and subscribed, and never faster than twice a minute.
  const fallbackTimer = setInterval(() => {
    if (!stopped && visible() && isCurrent() && websocket?.readyState !== WebSocket.OPEN) emit("connect");
  }, 30000);
  window.addEventListener("online", visibilityChanged);
  document.addEventListener("visibilitychange", visibilityChanged);
  const transport = {
    get connected() { return websocket?.readyState === WebSocket.OPEN; },
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return transport;
    },
    disconnect() {
      stopped = true;
      clearTimeout(reconnectTimer); clearTimeout(flushTimer);
      clearInterval(heartbeatTimer); clearInterval(fallbackTimer);
      window.removeEventListener("online", visibilityChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
      websocket?.close(1000, "Session changed");
      websocket = null;
      listeners.clear();
    },
  };
  // Allow the existing subscription facade to register handlers first.
  queueMicrotask(connect);
  return transport;
}
