export const FEED_SOUND_PREFERENCE_KEY = "oldtime.feed-sound-muted";
export function feedSoundPreferenceKey(ownerId = "") {
  const owner = String(ownerId || "anonymous").trim();
  return `${FEED_SOUND_PREFERENCE_KEY}:${encodeURIComponent(owner)}`;
}

export function readFeedSoundMuted(ownerId = "", storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(feedSoundPreferenceKey(ownerId));
    return saved == null ? true : saved !== "false";
  } catch {
    return true;
  }
}

export function saveFeedSoundMuted(muted, ownerId = "", storage = globalThis.localStorage) {
  try { storage?.setItem(feedSoundPreferenceKey(ownerId), String(Boolean(muted))); } catch { /* Sound preference is optional. */ }
  return Boolean(muted);
}
