// One atomic record contains the edit and its original media bytes. A failed
// replacement cannot remove the previous draft or leave orphaned media.
let database;
function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error("Draft storage is unavailable in this browser."));
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open("oldtime-creative-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = null; };
      resolve(db);
    };
    request.onerror = request.onblocked = () => {
      database = null;
      reject(new Error("Couldn’t open draft storage. Close other Oldtime tabs and try again."));
    };
  });
  return database;
}
async function operation(ownerId, context, mode, action) {
  if (!ownerId || !context) throw new Error("Sign in before saving a draft.");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", mode);
    const request = action(transaction.objectStore("drafts"), JSON.stringify([ownerId, context]));
    transaction.oncomplete = () => resolve(request.result ?? null);
    transaction.onerror = transaction.onabort = () =>
      reject(new Error("Couldn’t save the draft. Device storage may be full or unavailable. Your edit is still open."));
  });
}
function mapMedia(value, replace) {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (key === "media" && typeof item === "string") value[key] = replace(item);
    else mapMedia(item, replace);
  }
}
export function prepareCreativeDraft(project, state, blobs) {
  const snapshot = structuredClone({ project, state });
  const media = new Map();
  mapMedia(snapshot, value => {
    if (value === "live-camera") throw new Error("Capture your photo or stop recording before saving.");
    if (value.startsWith("blob:")) {
      const blob = blobs.get(value);
      if (!(blob instanceof Blob) || !blob.size) throw new Error("This media is unavailable. Upload it again before saving.");
      media.set(value, blob);
    }
    return value;
  });
  return { version: 1, ...snapshot, media: [...media], savedAt: Date.now() };
}
export function restoreCreativeDraft(draft, rememberBlob) {
  if (draft?.version !== 1 || !draft.project || !Array.isArray(draft.media)) throw new Error("This draft cannot be opened.");
  const snapshot = structuredClone({ project: draft.project, state: draft.state || {} });
  const replacements = new Map(draft.media.map(([key, blob]) => {
    if (!(blob instanceof Blob) || !blob.size) throw new Error("The draft’s media is unavailable.");
    return [key, rememberBlob(blob)];
  }));
  mapMedia(snapshot, value => {
    if (value.startsWith("blob:") && !replacements.has(value)) throw new Error("The draft’s media is unavailable.");
    return replacements.get(value) || value;
  });
  return snapshot;
}
export const saveCreativeDraft = (ownerId, context, draft) =>
  operation(ownerId, context, "readwrite", (store, key) => store.put(draft, key));
export const loadCreativeDraft = (ownerId, context) =>
  operation(ownerId, context, "readonly", (store, key) => store.get(key));
export const deleteCreativeDraft = (ownerId, context) =>
  operation(ownerId, context, "readwrite", (store, key) => store.delete(key));
