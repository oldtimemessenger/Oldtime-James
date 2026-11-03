// Private, device-local photo cache. This never reads the phone's unselected gallery.
export const RECENT_PHOTO_LIMIT = 24;
export const RECENT_BYTE_LIMIT = 64 * 1024 * 1024;
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
let database;
function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error("Recent-photo storage is unavailable on this device."));
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open("oldtime-camera-recents", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("photos", { keyPath: "id" });
      store.createIndex("ownerId", "ownerId");
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = null; };
      resolve(db);
    };
    request.onerror = request.onblocked = () => {
      database = null; reject(new Error("Couldn’t open recent-photo storage."));
    };
  });
  return database;
}
export function boundedRecentPhotos(rows, ownerId, max = RECENT_PHOTO_LIMIT, bytes = RECENT_BYTE_LIMIT) {
  let used = 0;
  return rows.filter(row => row.ownerId === ownerId)
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
    .filter(row => {
      const size = row.blob.size + row.thumbnail.size;
      if (used + size > bytes) return false;
      used += size; return true;
    }).slice(0, max);
}
async function transaction(ownerId, record) {
  if (!ownerId) throw new Error("Sign in to view recent photos.");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", record ? "readwrite" : "readonly");
    const store = tx.objectStore("photos");
    const request = store.index("ownerId").getAll(ownerId);
    let result = [];
    request.onsuccess = () => {
      try {
      const rows = request.result.filter(row => row.id !== record?.id);
      if(record)record.createdAt=Math.max(record.createdAt,...rows.map(row=>row.createdAt+1));
      result = boundedRecentPhotos(record ? [record, ...rows] : rows, ownerId);
      if (record) {
        const keep = new Set(result.map(row => row.id));
        for (const row of request.result) if (!keep.has(row.id)) store.delete(row.id);
        store.put(record);
      }
      } catch { tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(new Error("Couldn’t keep recent photos. Check available device storage."));
  });
}
export const loadRecentPhotos = ownerId => transaction(ownerId);
export async function prepareRecentPhoto(blob) {
  if (!(blob instanceof Blob) || !blob.type.startsWith("image/") || !blob.size) throw new Error("Choose a photo.");
  if (blob.size > MAX_PHOTO_BYTES) throw new Error("This photo is too large to keep in recents.");
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  let image, temporaryUrl;
  try {
    if (globalThis.createImageBitmap) image = await createImageBitmap(blob);
    else {
      temporaryUrl = URL.createObjectURL(blob);
      image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve; image.onerror = () => reject(new Error("Couldn’t preview this photo."));
        image.src = temporaryUrl;
      });
    }
    const width = image.width || image.naturalWidth, height = image.height || image.naturalHeight;
    const side = Math.min(width, height);
    if (!side) throw new Error("Couldn’t preview this photo.");
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 112;
    canvas.getContext("2d").drawImage(image, (width-side)/2, (height-side)/2, side, side, 0, 0, 112, 112);
    const thumbnail = await new Promise((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error("Couldn’t preview this photo.")), "image/jpeg", .78));
    return { hash, blob, thumbnail };
  } finally {
    image?.close?.();
    if (temporaryUrl) { URL.revokeObjectURL(temporaryUrl); image.src = ""; }
  }
}
export function saveRecentPhoto(ownerId, prepared) {
  return transaction(ownerId, {
    id: `${ownerId}:${prepared.hash}`, ownerId, createdAt: Date.now(),
    blob: prepared.blob, thumbnail: prepared.thumbnail,
  });
}
