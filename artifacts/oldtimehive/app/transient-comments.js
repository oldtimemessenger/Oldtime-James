// Visibility only. Comment records remain in the store and full conversation.
export function createTransientComments({
  schedule = (fn, ms) => setTimeout(fn, ms), cancel = id => clearTimeout(id),
  onChange = () => {}, visibleMs = 6000, fadeMs = 420, readingMs = 8000,
  seenIds = new Set(),
} = {}) {
  const entries = new Map();
  let active = [], reading = false, readTimer = null, disposed = false;
  const clear = entry => { for (const timer of entry.timers) cancel(timer); entry.timers.clear(); };
  const later = (entry, fn, ms) => {
    const timer = schedule(() => { entry.timers.delete(timer); if (!disposed) fn(); }, ms);
    entry.timers.add(timer);
  };
  const arm = (entry, delay) => {
    clear(entry);
    later(entry, () => {
      if (reading) return;
      entry.phase = "leaving";
      later(entry, () => { entry.phase = "hidden"; onChange(); }, fadeMs);
      onChange();
    }, delay);
  };
  return {
    hasSeen: id => entries.has(String(id)),
    phase: id => entries.get(String(id))?.phase || "hidden",
    isReading: () => reading,
    sync(ids) {
      if (disposed) return;
      active = ids.map(String);
      for (const [index, id] of active.entries()) {
        if (entries.has(id)) {
          if (reading) { const entry = entries.get(id); clear(entry); entry.phase = "visible"; }
          continue;
        }
        const entry = { phase: seenIds.has(id) && !reading ? "hidden" : "visible", timers: new Set() };
        seenIds.add(id);
        entries.set(id, entry);
        if (!reading && entry.phase === "visible") arm(entry, visibleMs + index * 300);
      }
      if (entries.size > 256) for (const [id, entry] of entries) {
        if (!active.includes(id)) { clear(entry); entries.delete(id); }
        if (entries.size <= 256) break;
      }
      onChange();
    },
    read() {
      if (disposed) return;
      reading = true;
      if (readTimer !== null) cancel(readTimer);
      for (const id of active) { const entry = entries.get(id); clear(entry); entry.phase = "visible"; }
      readTimer = schedule(() => {
        readTimer = null; reading = false;
        active.forEach((id, index) => arm(entries.get(id), index * 300));
      }, readingMs);
      onChange();
    },
    dispose() {
      disposed = true;
      if (readTimer !== null) cancel(readTimer);
      for (const entry of entries.values()) clear(entry);
      entries.clear();
    },
  };
}
