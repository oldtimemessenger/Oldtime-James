const PREFIX = "oldtime-help-delivery-fallback-v2:";
const COOLDOWN_MS = 72 * 60 * 60 * 1000;

function localStorageOrNull() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function createHelpDeliveryGuard(storage = localStorageOrNull()) {
  const memory = new Map();

  return {
    isSuppressed(accountId, now = Date.now()) {
      const memoryUntil = memory.get(accountId) || 0;
      if (memoryUntil > now) return true;
      try {
        const shownAt = Number(storage?.getItem(PREFIX + accountId));
        return Number.isFinite(shownAt) && shownAt > 0 && now - shownAt < COOLDOWN_MS;
      } catch {
        return false;
      }
    },
    suppress(accountId, now = Date.now()) {
      memory.set(accountId, now + COOLDOWN_MS);
      try {
        storage?.setItem(PREFIX + accountId, String(now));
      } catch {
        // In-memory suppression still prevents repeated tips in this page session.
      }
    },
  };
}
