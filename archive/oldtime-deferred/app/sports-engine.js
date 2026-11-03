import { api, requestCloudApi } from "./store.js";
import { records, persist, erase } from "./sports-db.js";
import { calculateWorkout, metres, MAX_SPEED_METRES_PER_SECOND } from "../../../lib/sports/metrics.js";

export const ACTIVITIES = [
  { id: "run", label: "Running", description: "Find your rhythm", icon: "run" },
  { id: "walk", label: "Walking", description: "Every step counts", icon: "walk" },
  { id: "cycle", label: "Cycling", description: "Take the long way", icon: "cycle" },
  { id: "hike", label: "Hiking", description: "Get off the beaten path", icon: "hike" },
];
const listeners = new Set();
let owner = "", active = null, history = [], gpsStatus = "idle", warning = "", error = "", loading = false, saving = false;
let nextOffset = null;
let watch = null, wakeLock = null, writeChain = Promise.resolve(), generation = 0, hydration = null;
const who = () => api.me()?.cloudAccountId || api.me()?.id || "";
function snapshot() {
  if (active) active.summary = calculateWorkout(active);
  return { active, history, gpsStatus, accuracyM: active?.points.at(-1)?.accuracy ?? null,
    warning, error, loading, saving, hasMore: nextOffset !== null };
}
function emit() { const state = snapshot(); listeners.forEach(fn => fn(state)); }
function saveDraft() {
  if (!active) return writeChain;
  active.updatedAt = Date.now();
  const data = structuredClone(active), account = owner;
  writeChain = writeChain.catch(() => {}).then(() => persist(account, data)).catch(e => {
    error = e.message;
    if (active?.id === data.id && active.status === "recording") pause();
    emit(); throw e;
  });
  // Errors remain visible and finishing awaits the chain; no unhandled timer rejection.
  void writeChain.catch(() => {});
  return writeChain;
}
function stopSensors() {
  if (watch !== null) navigator.geolocation?.clearWatch(watch);
  watch = null;
  void wakeLock?.release().catch(() => {}); wakeLock = null;
}
function startSensors() {
  stopSensors();
  if (!navigator.geolocation) { gpsStatus = "unavailable"; warning = "Location is unavailable. Duration is recording; distance is not."; emit(); return; }
  gpsStatus = "locating"; warning = ""; emit();
  const token = generation;
  watch = navigator.geolocation.watchPosition(position => {
    if (token !== generation || owner !== who() || active?.status !== "recording") return;
    const c = position.coords;
    if (!Number.isFinite(c.accuracy) || c.accuracy > 50) {
      gpsStatus = "weak"; warning = "GPS accuracy is poor. Inaccurate points are not added."; emit(); return;
    }
    const timestamp = Math.round(position.timestamp);
    if (!Number.isFinite(c.latitude) || c.latitude < -90 || c.latitude > 90 ||
        !Number.isFinite(c.longitude) || c.longitude < -180 || c.longitude > 180 ||
        timestamp < active.events.at(-1).timestamp) return;
    const previous = active.points.at(-1);
    if (timestamp < active.startedAt || timestamp > Date.now() + 60000 ||
        (previous && (timestamp <= previous.timestamp || timestamp - previous.timestamp < 900))) return;
    const elapsed = previous ? (timestamp - previous.timestamp) / 1000 : 0;
    const resumed = active.events.at(-1)?.type === "resume" && (!previous || active.events.at(-1).timestamp > previous.timestamp);
    if (previous && !resumed && elapsed <= 45 && elapsed > 0 &&
        metres(previous, { lat: c.latitude, lon: c.longitude }) / elapsed >
          MAX_SPEED_METRES_PER_SECOND[active.activityType] +
          Math.max(3, Math.min(20, (previous.accuracy + c.accuracy) * .5)) / elapsed) {
      gpsStatus = "weak"; warning = "An implausible GPS jump was ignored. Waiting for a steady location."; emit(); return;
    }
    if (active.points.length >= 5000) { pause(); warning = "Route limit reached. Finish this workout before starting another."; emit(); return; }
    active.points.push({ lat: c.latitude, lon: c.longitude, timestamp, accuracy: c.accuracy,
      altitude: Number.isFinite(c.altitude) ? c.altitude : null,
      altitudeAccuracy: Number.isFinite(c.altitudeAccuracy) ? c.altitudeAccuracy : null,
      breakBefore: !!(resumed || previous && timestamp - previous.timestamp > 45000) });
    gpsStatus = "tracking"; warning = ""; void saveDraft(); emit();
  }, e => {
    if (token !== generation || !active) return;
    gpsStatus = e.code === 1 ? "denied" : "gap";
    warning = e.code === 1 ? "Location permission was denied. Duration only—allow location and resume to record a route." : "GPS interrupted. Duration continues; missing route sections will not be invented.";
    emit();
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  if (navigator.wakeLock && document.visibilityState === "visible") {
    void navigator.wakeLock.request("screen").then(lock => {
      if (token !== generation || active?.status !== "recording") void lock.release(); else wakeLock = lock;
    }).catch(() => {});
  }
}
async function accountChanged() {
  const next = who(); if (next === owner) return hydration;
  if (active?.status === "recording") pause();
  generation++; stopSensors(); owner = next; active = null; history = []; nextOffset = null; error = ""; warning = ""; gpsStatus = "idle"; emit();
  if (owner) {
    const token = generation;
    hydration = loadHistory().finally(() => { if (token === generation) hydration = null; });
    await hydration;
  } else hydration = null;
}
async function loadHistory() {
  const next = who();
  if (owner !== next) return accountChanged();
  const account = owner, token = generation;
  if (!account) return;
  loading = true; emit();
  try {
    const local = await records(account);
    if (token !== generation) return;
    const recovered = !active && local.find(w => w.status === "recording" || w.status === "paused");
    if (recovered) active = recovered;
    if (recovered?.status === "recording") {
      active.events.push({ type: "pause", timestamp: active.updatedAt || active.startedAt });
      active.status = "paused"; gpsStatus = "paused";
      warning = "An interrupted recording was recovered and paused. Resume when you are ready.";
      await saveDraft();
    }
    history = local.filter(w => w.status === "completed").sort((a, b) => b.startedAt - a.startedAt);
    if (api.me()?.cloudAccountId) {
      try {
        const result = await requestCloudApi("/api/sports/workouts");
        if (token !== generation) return;
        nextOffset = result.nextOffset ?? null;
        const merged = new Map(history.map(w => [w.id, w]));
        for (const w of result.workouts) merged.set(w.id, { ...merged.get(w.id), ...w, synced: true });
        history = [...merged.values()].sort((a, b) => b.startedAt - a.startedAt);
      } catch (e) { error = `${e.message} Device recordings remain available.`; }
    }
  } catch (e) { error = e.message; }
  finally { if (token === generation) { loading = false; emit(); } }
}
async function loadMore() {
  if (nextOffset === null || loading || owner !== who()) return;
  const token = generation;
  loading = true; error = ""; emit();
  try {
    const result = await requestCloudApi(`/api/sports/workouts?offset=${nextOffset}`);
    if (token !== generation) return;
    const merged = new Map(history.map(w => [w.id, w]));
    for (const w of result.workouts) merged.set(w.id, { ...merged.get(w.id), ...w, synced: true });
    history = [...merged.values()].sort((a, b) => b.startedAt - a.startedAt);
    nextOffset = result.nextOffset ?? null;
  } catch (e) { error = e.message; }
  finally { if (token === generation) { loading = false; emit(); } }
}
async function start(type) {
  await accountChanged();
  if (!owner) throw new Error("Sign in before recording.");
  if (active) throw new Error("Finish or discard your current workout first.");
  if (!ACTIVITIES.some(a => a.id === type)) throw new Error("Choose an activity.");
  const now = Date.now();
  const workout = { id: crypto.randomUUID(), activityType: type, startedAt: now, endedAt: null,
    updatedAt: now, status: "recording", points: [], events: [{ type: "start", timestamp: now }], synced: false };
  await persist(owner, workout); active = workout; error = ""; startSensors(); emit();
}
function pause() {
  if (active?.status !== "recording") return;
  active.events.push({ type: "pause", timestamp: Date.now() }); active.status = "paused";
  stopSensors(); gpsStatus = "paused"; void saveDraft(); emit();
}
function resume() {
  if (active?.status !== "paused" || who() !== owner) return;
  active.events.push({ type: "resume", timestamp: Date.now() }); active.status = "recording";
  void saveDraft(); startSensors(); emit();
}
function retryGps() {
  if (active?.status !== "recording") return false;
  warning = ""; error = ""; startSensors(); return true;
}
async function sync(id) {
  if (!api.me()?.cloudAccountId) throw new Error("Sign in to sync this activity with your account.");
  const account = owner, token = generation;
  const local = (await records(owner)).find(w => w.id === id);
  if (!local) throw new Error("This device does not have that workout recording.");
  const result = await requestCloudApi(`/api/sports/workouts/${id}`, { method: "PUT", body: {
    activityType: local.activityType, startedAt: local.startedAt, endedAt: local.endedAt,
    points: local.points, events: local.events,
  } });
  if (token !== generation) throw new Error("The signed-in account changed.");
  const saved = { ...local, ...result.workout, synced: true };
  await persist(account, saved); history = [saved, ...history.filter(w => w.id !== id)].sort((a, b) => b.startedAt - a.startedAt); emit();
  return saved;
}
async function finish() {
  if (!active || saving) throw new Error("No workout is ready to finish.");
  saving = true; emit();
  try {
    stopSensors(); const now = Date.now();
    active.events.push({ type: "finish", timestamp: now }); active.endedAt = now; active.status = "completed";
    active.summary = calculateWorkout(active); await saveDraft();
    const completed = structuredClone(active); active = null; gpsStatus = "idle";
    history = [completed, ...history.filter(w => w.id !== completed.id)];
    if (api.me()?.cloudAccountId) {
      try { return await sync(completed.id); } catch (e) { error = `${e.message} This activity is waiting to sync with your account.`; }
    } else warning = "Activity recorded. Sign in to sync it with your account and include it in your activity history and reports.";
    return completed;
  } catch (e) {
    // A failed local save must leave a recoverable recording, never silently lose it.
    if (active) {
      active.status = "paused"; active.endedAt = null; active.events.pop(); gpsStatus = "paused";
      if (active.events.at(-1)?.type !== "pause") active.events.push({ type: "pause", timestamp: Date.now() });
    }
    error = e.message; throw e;
  } finally { saving = false; emit(); }
}
async function discard() {
  if (!active) return;
  stopSensors(); await writeChain.catch(() => {}); await erase(owner, active.id);
  active = null; gpsStatus = "idle"; warning = ""; error = ""; emit();
}
async function detail(id) {
  const local = (await records(owner)).find(w => w.id === id);
  if (local) return { ...local, synced: local.synced === true, summary: calculateWorkout(local, local.endedAt) };
  const account = owner;
  const result = await requestCloudApi(`/api/sports/workouts/${id}`);
  if (account !== owner) throw new Error("The signed-in account changed.");
  return { ...result.workout, synced: true };
}
async function markSyncPending(id) {
  const account = owner, token = generation;
  const local = (await records(account)).find(w => w.id === id);
  if (!local || token !== generation) return null;
  const saved = { ...local, synced: false };
  await persist(account, saved);
  if (token !== generation) return null;
  history = history.map(w => w.id === id ? { ...w, synced: false } : w);
  emit();
  return { ...saved, summary: calculateWorkout(saved, saved.endedAt) };
}
async function remove(id) {
  const entry = history.find(w => w.id === id);
  if (entry?.synced) await requestCloudApi(`/api/sports/workouts/${id}`, { method: "DELETE" });
  await erase(owner, id); history = history.filter(w => w.id !== id);
  if (nextOffset !== null && entry?.synced) nextOffset = Math.max(0, nextOffset - 1);
  emit();
}
document.addEventListener("visibilitychange", () => {
  if (active?.status !== "recording") return;
  if (document.hidden) {
    // Keep receiving genuine fixes where the browser permits it, without
    // pretending browser GPS can survive OS suspension or inventing gaps.
    void saveDraft();
    warning = "Recording continues where the browser allows GPS. Locked-phone background tracking requires the native app.";
  } else {
    const last = active.points.at(-1);
    warning = last && Date.now() - last.timestamp > 20000
      ? "GPS was interrupted in the background. Missing sections stay as gaps; elapsed time continues."
      : "";
    if (navigator.wakeLock) navigator.wakeLock.request("screen").then(lock => { wake = lock; }).catch(() => {});
  }
  emit();
});
window.addEventListener("online", async () => {
  if (owner !== who()) return;
  await loadHistory();
  if (api.me()?.cloudAccountId) for (const w of history.filter(w => !w.synced)) {
    try { await sync(w.id); } catch (e) { error = e.message; emit(); break; }
  }
});
setInterval(() => {
  if (active) {
    if (who() !== owner) { void accountChanged(); return; }
    if (active.status === "recording" && active.points.at(-1) && Date.now() - active.points.at(-1).timestamp > 45000) {
      gpsStatus = "gap"; warning = "Waiting for GPS. Missing route sections are not filled in.";
    }
    emit(); if (active.status === "recording" && Date.now() - active.updatedAt >= 5000) void saveDraft();
  }
}, 1000);
export const sports = { snapshot, subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); },
  start, pause, resume, retryGps, finish, discard, sync, detail, markSyncPending, remove, loadHistory, loadMore, accountChanged };
