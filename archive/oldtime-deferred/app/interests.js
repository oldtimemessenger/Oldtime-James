// Explicit, device-local interest preferences, scoped per account. Nothing is inferred or sent anywhere.
const KEY = "oldtime-interests-v1:";
export const INTERESTS = ["Sports", "Photography", "Music", "Comedy", "Food", "Travel", "Fitness", "News", "Art", "Gaming", "Fashion", "Technology"];
const store = s => s || globalThis.localStorage;
export function readInterests(accountId, storage) {
  try {
    const v = JSON.parse(store(storage).getItem(KEY + accountId) || "null");
    if (v === null) return { enabled: true, selected: [], decided: false };
    if (typeof v !== "object" || Array.isArray(v)) return null;
    return { enabled: v.enabled !== false, selected: (Array.isArray(v.selected) ? v.selected : []).filter(x => INTERESTS.includes(x)), decided: true };
  } catch { return null; }
}
export function saveInterests(accountId, { enabled = true, selected = [] }, storage) {
  const clean = [...new Set(selected.filter(x => INTERESTS.includes(x)))];
  try { store(storage).setItem(KEY + accountId, JSON.stringify({ enabled: !!enabled, selected: clean })); }
  catch { throw new Error("Your interests could not be saved on this device."); }
  return clean;
}
export function resetInterests(accountId, storage) {
  try { store(storage).removeItem(KEY + accountId); } catch { throw new Error("Your interests could not be reset."); }
}
/** Context fields for the help scheduler. Unreadable storage counts as decided, so no prompt appears. */
export function interestContext(accountId, storage) {
  const v = readInterests(accountId, storage);
  return v ? { interests: v.enabled ? v.selected : [], interestsSet: v.decided } : { interests: [], interestsSet: true };
}
