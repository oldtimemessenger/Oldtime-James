const PREFIX = "oldtime-media:";
const urls = new Map();
let database;
async function openDatabase() {
  if (!globalThis.indexedDB) throw new Error("Media storage is unavailable in this browser.");
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open("oldtime-created-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(new Error("Couldn’t open media storage.")); };
  });
  return database;
}
async function operation(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("files", mode);
    const request = action(transaction.objectStore("files"));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = transaction.onabort = () => reject(new Error("Couldn’t save media. Check available device storage."));
  });
}
export function isLocalMedia(value) { return String(value || "").startsWith(PREFIX); }
export function renderMediaUrl(value) { return isLocalMedia(value) ? "" : String(value || ""); }
export async function putLocalMedia(blob) {
  if (!(blob instanceof Blob) || !blob.size || blob.size > 25 * 1024 * 1024) throw new Error("Media files must be smaller than 25 MB.");
  const key = `${PREFIX}${crypto.randomUUID()}`;
  await operation("readwrite", store => store.put(blob, key));
  return key;
}
export async function mediaUrl(value) {
  if (!isLocalMedia(value)) {
    const url = String(value || "");
    if (!url || !/^(https?:|blob:|data:(audio|video|image)\/|\/|\.\/)/i.test(url)) throw new Error("This media is unavailable.");
    return url;
  }
  if (urls.has(value)) return urls.get(value);
  const blob = await operation("readonly", store => store.get(value));
  if (!blob) throw new Error("This recording is unavailable.");
  const url = URL.createObjectURL(blob);
  urls.set(value, url);
  return url;
}
export async function deleteLocalMedia(value) {
  if (!isLocalMedia(value)) return;
  if (urls.has(value)) { URL.revokeObjectURL(urls.get(value)); urls.delete(value); }
  await operation("readwrite", store => store.delete(value));
}
export async function hydrateLocalMedia(root) {
  await Promise.all([...root.querySelectorAll("[data-local-media]")].map(async element => {
    try {
      const url = await mediaUrl(element.dataset.localMedia);
      if (element.isConnected) { element.src = url; if (element.tagName === "VIDEO" && !element.paused) void element.play().catch(() => {}); }
    } catch (error) {
      if (element.isConnected) { element.setAttribute("aria-label", error.message); element.insertAdjacentHTML("afterend", '<p class="sub">Recording unavailable</p>'); }
    }
  }));
}
