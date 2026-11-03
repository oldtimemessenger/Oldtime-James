const PREFIX = "oldtime-media:";
const urls = new Map();
const urlExpiries = new Map();
const pendingUrls = new Map();
const pendingFeedVideoLoads = new WeakMap();
const quotaBlockedUntil = new Map();
const cloudClient = () => import("./store.js");
const safeRequestPath = path => String(path || "").split("?")[0]
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");

function diagnoseMediaFailure(stage, error, request = null) {
  if (error?.mediaDiagnostic) return error;
  const source = error instanceof Error ? error : new Error(String(error || "Unknown media error"));
  const original = source.cause || source.causingError || null;
  let responseBody = source.responseBody ?? source.originalResponse?.getBody?.() ?? null;
  if (responseBody && typeof responseBody !== "string") {
    try { responseBody = JSON.stringify(responseBody); } catch { responseBody = String(responseBody); }
  }
  const diagnostic = {
    time: new Date().toISOString(),
    stage,
    errorName: source.name || "Error",
    message: source.message,
    stack: original?.stack || source.stack || "",
    ...(original ? {
      originalError: {
        name: original.name || "Error",
        message: original.message || String(original),
        stack: original.stack || "",
      },
    } : {}),
    request: request || source.request || null,
    status: source.status ?? source.originalResponse?.getStatus?.() ?? null,
    responseBody: responseBody ? String(responseBody).slice(0, 1200) : null,
    requestId: source.requestId || null,
    video: source.videoDiagnostics || null,
  };
  console.error("[Oldtime media diagnostic]", diagnostic);
  try {
    source.mediaStage = stage;
    source.mediaDiagnostic = diagnostic;
    return source;
  } catch {
    const wrapped = new Error(source.message);
    wrapped.name = source.name || "Error";
    wrapped.stack = source.stack || wrapped.stack;
    wrapped.cause = source;
    wrapped.mediaStage = stage;
    wrapped.mediaDiagnostic = diagnostic;
    wrapped.request = diagnostic.request;
    wrapped.status = diagnostic.status;
    wrapped.responseBody = diagnostic.responseBody;
    wrapped.requestId = diagnostic.requestId;
    return wrapped;
  }
}

async function mediaStep(onProgress, stage, label, action, request = null) {
  if (onProgress?.reportMediaStages === true) {
    try { onProgress(0, "stage", { stage, label }); } catch {}
  }
  try {
    return await action();
  } catch (error) {
    throw diagnoseMediaFailure(stage, error, request);
  }
}

const cloudMediaRequest = async (requestCloudApi, path, options, timeoutMessage, timeoutMs = 20_000, stage = "cloud-request") => {
  try {
    return await requestCloudApi(path, { ...options, timeoutMs });
  } catch (error) {
    let failure = error;
    if (error?.name === "AbortError" || /timed?\s*out|took too long/i.test(String(error?.message || ""))) {
      failure = new Error(timeoutMessage);
      failure.name = "TimeoutError";
      failure.cause = error;
    }
    throw diagnoseMediaFailure(stage, failure, {
      method: String(options?.method || "GET").toUpperCase(),
      path: safeRequestPath(path),
    });
  }
};
const sha256Placeholder = "0".repeat(64);
let mediaObserver;

export function shouldRetryMediaUpload(error) {
  const status = Number(error?.originalResponse?.getStatus?.() || 0);
  if ([401, 402, 403, 413].includes(status)) return false;
  const isClientError = status >= 400 && status < 500;
  return (!isClientError || status === 409 || status === 423) &&
    (typeof navigator === "undefined" || navigator.onLine !== false);
}

function workerDigest(blob) {
  if (typeof Worker !== "function") return digestOnMainThread(blob);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./media-hash-worker.js", import.meta.url), { type: "module" });
    const timeout = setTimeout(() => {
      worker.terminate();
      const error = new Error("Media verification stopped responding. Your post is still in the editor; try again.");
      error.name = "MediaVerificationTimeout";
      reject(error);
    }, 90_000);
    worker.onmessage = event => {
      clearTimeout(timeout);
      worker.terminate();
      if (event.data?.error) reject(new Error(event.data.error));
      else resolve(event.data?.sha256 || "");
    };
    worker.onerror = event => {
      clearTimeout(timeout);
      worker.terminate();
      reject(event.error || new Error("The media file could not be verified."));
    };
    worker.postMessage(blob);
  }).catch(error => {
    if (error?.name === "MediaVerificationTimeout") throw error;
    return digestOnMainThread(blob);
  });
}

async function digestOnMainThread(blob) {
  const { createSHA256 } = await import("hash-wasm");
  const digest = await createSHA256();
  digest.init();
  const chunkSize = 8 * 1024 * 1024;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    digest.update(new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer()));
  }
  return digest.digest("hex");
}

export async function uploadResumableMedia(blob, ticket, onProgress, scope = "public") {
  const contentType = String(blob?.type || "").split(";")[0].trim().toLowerCase();
  if (!contentType) throw new Error("Choose a supported media file.");
  const endpoint = new URL(ticket.endpoint, globalThis.location.origin);
  if (endpoint.origin !== globalThis.location.origin || !endpoint.pathname.startsWith("/api/media/uploads/")) {
    throw new Error("The upload service returned an invalid address. Please try again.");
  }
  const { Upload } = await import("tus-js-client");
  return new Promise((resolve, reject) => {
    let upload, timer, finished = false;
    let lastRequest = null;
    const clearStall = () => clearTimeout(timer);
    const finish = () => {
      if (finished) return;
      finished = true; clearStall(); resolve();
    };
    const fail = error => {
      if (finished) return;
      finished = true; clearStall();
      try { upload?.abort(); } catch {}
      reject(error);
    };
    const refreshStall = () => {
      clearStall();
      timer = setTimeout(() => fail(new Error(
        "The Cloudflare upload stopped making progress. Your post is still in the editor; check your connection and try again.",
      )), 90_000);
    };
    upload = new Upload(blob, {
      endpoint: endpoint.href,
      headers: { "x-signature": ticket.token },
      metadata: {
        bucketName: ticket.bucketName,
        objectName: ticket.objectName,
        contentType,
        // Cloud media is immutable after confirmation; allow the Storage CDN
        // and browser to reuse it instead of transferring the same bytes again.
        // Match the five-minute signed-read lifetime so edge/browser caches
        // never extend private media access beyond the URL's authorization.
        cacheControl: scope === "message" ? "0" : "300",
      },
      // Match the Worker's R2 part limit. Larger parts reduce sequential
      // request overhead without changing the uploaded media bytes.
      chunkSize: 8 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      onShouldRetry: shouldRetryMediaUpload,
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      onProgress: (sent, total) => {
        refreshStall();
        onProgress?.(total ? sent / total : 0, "uploading");
      },
      onBeforeRequest: request => {
        try {
          const url = new URL(request.getURL(), globalThis.location.origin);
          lastRequest = {
            method: request.getMethod(),
            path: safeRequestPath(url.pathname),
            status: null,
            responseBody: null,
            requestId: null,
          };
        } catch {
          lastRequest = { method: "UNKNOWN", path: "/api/media/uploads/:id", status: null };
        }
      },
      onAfterResponse: (request, response) => {
        try {
          const url = new URL(request.getURL(), globalThis.location.origin);
          const body = response.getBody?.() || "";
          lastRequest = {
            method: request.getMethod(),
            path: safeRequestPath(url.pathname),
            status: response.getStatus(),
            responseBody: body ? body.slice(0, 1200) : null,
            requestId: response.getHeader?.("cf-ray") || null,
          };
        } catch {}
      },
      onError: error => {
        clearStall();
        const status = Number(error?.originalResponse?.getStatus?.() || 0);
        const originalResponse = error?.originalResponse;
        const originalRequest = error?.originalRequest;
        let request = lastRequest;
        try {
          if (originalRequest) {
            const url = new URL(originalRequest.getURL(), globalThis.location.origin);
            request = {
              method: originalRequest.getMethod(),
              path: safeRequestPath(url.pathname),
              status: status || lastRequest?.status || null,
              responseBody: originalResponse?.getBody?.()?.slice(0, 1200) || lastRequest?.responseBody || null,
              requestId: originalResponse?.getHeader?.("cf-ray") || lastRequest?.requestId || null,
            };
          }
        } catch {}
        const message = status === 402
          ? "Media uploads are temporarily restricted by the storage service. Please try again later."
          : status === 401 || status === 403
          ? "Upload authorization failed. Please try again."
          : status === 413
            ? "This file exceeds the storage service’s allowed size."
            : status === 409
              ? "This upload is already in progress. Wait a moment, then tap Post to retry."
              : status === 429
                ? "There have been too many upload attempts. Wait a minute, then try again."
                : status >= 500
                  ? "The storage service couldn't finish the upload. Your image and caption are still here; tap Post to retry."
                  : status === 0
                    ? "The upload connection dropped. Your image and caption are still here; tap Post to retry."
                    : `The storage service rejected this image (HTTP ${status}). Remove it and add it again.`;
        const failure = new Error(message);
        failure.status = status;
        failure.responseBody = originalResponse?.getBody?.()?.slice(0, 1200) || lastRequest?.responseBody || null;
        failure.requestId = lastRequest?.requestId || null;
        failure.cause = error;
        failure.request = request;
        fail(diagnoseMediaFailure("media-transfer", failure, request));
      },
      onSuccess: finish,
    });
    refreshStall();
    try { upload.start(); } catch (error) {
      fail(diagnoseMediaFailure("media-transfer-start", error, {
        method: "POST",
        path: safeRequestPath(endpoint.pathname),
      }));
    }
  });
}

export function isLocalMedia(value) { return String(value || "").startsWith(PREFIX); }
export function renderMediaUrl(value) { return isLocalMedia(value) ? "" : String(value || ""); }

export async function optimizeMediaForUpload(blob, { onProgress, audioSession = null } = {}) {
  if (!(blob instanceof Blob) || !blob.size || !Number.isSafeInteger(blob.size)) {
    throw new Error("Choose a supported media file.");
  }
  let contentType = String(blob.type || "").split(";")[0].trim().toLowerCase();
  if (!contentType) throw new Error("Choose a supported media file.");
  if (contentType.startsWith("image/")) {
    onProgress?.(0, "optimizing");
    const { compressImageForUpload } = await import("./image-compression.js");
    blob = await compressImageForUpload(blob, { onProgress });
    contentType = String(blob.type || "").split(";")[0].trim().toLowerCase();
  }
  if (contentType.startsWith("video/")) {
    onProgress?.(0, "preparing");
    const { compressVideoTo720p } = await import("./video-compression.js");
    blob = await compressVideoTo720p(blob, { onProgress, audioSession });
    contentType = String(blob.type || "").split(";")[0].trim().toLowerCase();
    if (!["video/mp4", "video/webm"].includes(contentType)) {
      throw new Error("The optimized video could not be verified. The original was not uploaded.");
    }
  }
  if (!blob.size || !Number.isSafeInteger(blob.size)) {
    throw new Error("The optimized media could not be verified.");
  }
  return blob;
}

export async function putLocalMedia(blob, requestedId, onProgress, options = {}) {
  const preserveBytes = options.preserveBytes === true;
  const audioSession = options.audioSession ?? null;
  const scope = options.scope ?? "public";
  const role = options.role ?? "media";
  const createThumbnail = options.createThumbnail !== false;
  if (!["public", "message"].includes(scope) || !["media", "thumbnail"].includes(role)) {
    throw new Error("The media storage destination is invalid.");
  }
  if (!(blob instanceof Blob) || !blob.size || !Number.isSafeInteger(blob.size)) {
    throw new Error("Choose a supported media file.");
  }
  const hasFixedId = typeof requestedId === "string" && requestedId.length > 0;
  let contentType = String(blob.type || "").split(";")[0].trim().toLowerCase();
  if (!contentType) throw new Error("Choose a supported media file.");
  if (role === "thumbnail" && !contentType.startsWith("image/")) {
    throw new Error("A video thumbnail must be an image.");
  }
  if (!preserveBytes) {
    blob = await mediaStep(onProgress, contentType.startsWith("video/") ? "video-preparation" : "media-preparation",
      contentType.startsWith("video/") ? "Preparing video…" : "Preparing media…",
      () => optimizeMediaForUpload(blob, { onProgress, audioSession }));
    contentType = String(blob.type || "").split(";")[0].trim().toLowerCase();
  }
  if (!blob.size || !Number.isSafeInteger(blob.size)) {
    throw new Error("The optimized media could not be verified.");
  }
  if (!hasFixedId) requestedId = crypto.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedId)) {
    throw new Error("The media reference is invalid.");
  }
  const { api, requestCloudApi } = await mediaStep(onProgress, "cloud-service", "Connecting to the upload service…", cloudClient);
  await mediaStep(onProgress, "account-check", "Checking your online account…", async () => {
    if (!api.cloudAccountId()) throw new Error("Sign in to your online account before uploading media.");
  });

  const id = requestedId;
  // New uploads can hash while bytes transfer; fixed IDs hash before reservation
  // so retries cannot accidentally reuse an existing asset with different bytes.
  const fixedIdHash = hasFixedId ? workerDigest(blob) : null;
  const reservationSha = fixedIdHash ? await fixedIdHash : sha256Placeholder;
  const reservation = await mediaStep(onProgress, "media-reservation", "Preparing secure media upload…", () => cloudMediaRequest(requestCloudApi, `/api/media/${encodeURIComponent(id)}/upload`, {
    method: "POST",
    body: { contentType, size: blob.size, sha256: reservationSha, scope, role },
  }, "Cloudflare did not respond while preparing this upload. Your post is still in the editor; tap Post to retry.", 20_000, "media-reservation"), {
    method: "POST",
    path: `/api/media/${id}/upload`,
  });
  const attachThumbnail = async () => {
    if (!createThumbnail || role !== "media" || !contentType.startsWith("video/") || reservation?.thumbnailId) return;
    const { generateVideoThumbnail } = await import("./video-compression.js");
    const thumbnail = await mediaStep(onProgress, "thumbnail-generation", "Preparing video thumbnail…", () => generateVideoThumbnail(blob));
    const thumbnailReference = await mediaStep(onProgress, "thumbnail-upload", "Uploading video thumbnail…", () => putLocalMedia(thumbnail, undefined, onProgress, {
      scope, role: "thumbnail", createThumbnail: false,
    }));
    const thumbnailId = thumbnailReference.slice(PREFIX.length);
    try {
      await mediaStep(onProgress, "thumbnail-attachment", "Attaching video thumbnail…", () => cloudMediaRequest(requestCloudApi, `/api/media/${encodeURIComponent(id)}/thumbnail`, {
        method: "PUT",
        body: { thumbnailId },
      }, "Cloudflare did not finish attaching the video thumbnail. Your post is still in the editor; try again.", 20_000, "thumbnail-attachment"), {
        method: "PUT",
        path: `/api/media/${id}/thumbnail`,
      });
    } catch (error) {
      await deleteLocalMedia(thumbnailReference).catch(() => {});
      throw error;
    }
  };
  if (reservation?.ready) {
    await attachThumbnail();
    onProgress?.(1, "complete", { size: blob.size, contentType });
    return `${PREFIX}${id}`;
  }

  let confirmed = false;
  try {
    const [sha256] = await Promise.all([
      fixedIdHash || mediaStep(onProgress, "media-integrity", "Verifying video file…", () => workerDigest(blob)),
      reservation?.uploaded
        ? Promise.resolve(onProgress?.(1, "uploading"))
        : mediaStep(onProgress, "media-transfer", "Uploading video…", () => uploadResumableMedia(blob, reservation, onProgress, scope), {
          method: "POST",
          path: safeRequestPath(reservation.endpoint),
        }),
    ]);
    if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("The media file could not be verified.");
    await mediaStep(onProgress, "media-confirmation", "Verifying uploaded video…", () => cloudMediaRequest(requestCloudApi, `/api/media/${encodeURIComponent(id)}/confirm`, {
      method: "POST",
      body: { sha256 },
    }, "Cloudflare did not confirm this upload in time. Your post is still in the editor; tap Post to retry.", 20_000, "media-confirmation"), {
      method: "POST",
      path: `/api/media/${id}/confirm`,
    });
    confirmed = true;
    await attachThumbnail();
  } catch (error) {
    if (confirmed && createThumbnail && role === "media" && contentType.startsWith("video/")) {
      await deleteLocalMedia(`${PREFIX}${id}`).catch(() => {});
    }
    throw diagnoseMediaFailure(error?.mediaStage || "media-finalization", error);
  }
  onProgress?.(1, "complete", { size: blob.size, contentType });
  return `${PREFIX}${id}`;
}

export async function mediaUrl(value, { timeoutMs = 20_000 } = {}) {
  if (!isLocalMedia(value)) {
    const url = String(value || "");
    if (!url || !/^(https?:|blob:|data:(audio|video|image)\/|\/|\.\/)/i.test(url)) {
      throw new Error("This media is unavailable.");
    }
    return url;
  }
  const id = value.slice(PREFIX.length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("This media reference is invalid.");
  }
  const { api, requestCloudApi } = await cloudClient();
  const cacheKey = `${api.cloudAccountId() || "signed-out"}:${value}`;
  const owner = api.cloudAccountId() || "signed-out";
  if ((quotaBlockedUntil.get(owner) || 0) > Date.now()) {
    throw Object.assign(new Error("Media is temporarily restricted by the storage service. Please try again later."), { status: 402 });
  }
  quotaBlockedUntil.delete(owner);
  const cached = urls.get(cacheKey);
  if (cached && (urlExpiries.get(cacheKey) || 0) > Date.now() + 15000) return cached;
  if (pendingUrls.has(cacheKey)) return pendingUrls.get(cacheKey);
  const safeTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Math.max(5, Math.min(120_000, Number(timeoutMs)))
    : 20_000;
  const pending = cloudMediaRequest(
    requestCloudApi,
    `/api/media/${encodeURIComponent(id)}/url`,
    {},
    "The selected sound took too long to prepare. Your edit is still here; try again.",
    safeTimeoutMs,
  )
    .then(result => {
      if (!result?.url) throw new Error("This media is unavailable.");
      urls.set(cacheKey, result.url);
      urlExpiries.set(cacheKey, Date.now() + 4 * 60 * 1000);
      return result.url;
    })
    .catch(error => {
      // A provider-wide restriction is not a missing file. Avoid hammering
      // signing endpoints for every tile while the same restriction persists.
      if (error?.status === 402) quotaBlockedUntil.set(owner, Date.now() + 60_000);
      throw error;
    })
    .finally(() => pendingUrls.delete(cacheKey));
  pendingUrls.set(cacheKey, pending);
  return pending;
}

export function invalidateMediaUrl(value) {
  for (const key of urls.keys()) {
    if (key.endsWith(`:${value}`)) {
      urls.delete(key);
      urlExpiries.delete(key);
    }
  }
}

export async function migrateLocalMedia(value, ownerId, { scope = "public" } = {}) {
  const { api, requestCloudApi } = await cloudClient();
  if (!isLocalMedia(value) || !ownerId || api.me()?.id !== ownerId || !api.cloudAccountId()) {
    throw new Error("Sign in to the account that owns this media.");
  }
  const id = value.slice(PREFIX.length);
  try {
    const existing = await requestCloudApi(`/api/media/${encodeURIComponent(id)}/url`);
    if (existing?.url) return false;
  } catch (error) {
    if (error?.status !== 404) throw error;
  }
  const original = await operation("readonly", store => store.get(value));
  if (!(original instanceof Blob) || !original.size) {
    throw new Error("This media is not available in the account or as a legacy source.");
  }
  await putLocalMedia(original, id, undefined, { preserveBytes: true, scope });
  const verified = await requestCloudApi(`/api/media/${encodeURIComponent(id)}/url`);
  if (!verified?.url || verified.size !== original.size || verified.contentType !== original.type) {
    throw new Error("The cloud copy could not be verified. The original is still preserved.");
  }
  await operation("readwrite", store => store.delete(value));
  return true;
}

async function openDatabase() {
  if (!globalThis.indexedDB) throw new Error("Legacy media storage is unavailable.");
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open("oldtime-created-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(new Error("Couldn’t open legacy media storage.")); };
  });
  return database;
}
let database;
async function operation(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("files", mode);
    const request = action(transaction.objectStore("files"));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = transaction.onabort = () => reject(new Error("Couldn’t read legacy media."));
  });
}
async function blobDigest(blob) {
  const digest = await createSHA256();
  digest.init();
  const chunkSize = 8 * 1024 * 1024;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    digest.update(new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer()));
  }
  return digest.digest("hex");
}

export async function deleteLocalMedia(value) {
  if (!isLocalMedia(value)) return;
  const { api, requestCloudApi } = await cloudClient();
  const id = value.slice(PREFIX.length);
  for (const [key, url] of urls) {
    if (key.endsWith(`:${value}`) && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
      urls.delete(key);
      urlExpiries.delete(key);
    }
  }
  if (api.cloudAccountId() && /^[0-9a-f-]{36}$/i.test(id)) {
    try { await requestCloudApi(`/api/media/${encodeURIComponent(id)}`, { method: "DELETE" }); }
    catch (error) {
      if (!/404|not found/i.test(String(error?.message || ""))) throw error;
    }
  }
  await operation("readwrite", store => store.delete(value)).catch(() => {});
}

async function loadElement(element, { quiet = false } = {}) {
  if (!element.isConnected) return { loaded: false };
  const reference = element.dataset.localMedia;
  if (!reference || element.dataset.loadedMedia === reference) return { loaded: false };
  element.dataset.loadedMedia = reference;
  try {
    if (element.tagName === "VIDEO" && element.dataset.localPoster && !element.poster) {
      const posterReference = element.dataset.localPoster;
      const posterUrl = await mediaUrl(posterReference);
      if (!element.isConnected || element.dataset.localMedia !== reference) return;
      element.poster = posterUrl;
    }
    const url = await mediaUrl(reference);
    if (!element.isConnected || element.dataset.localMedia !== reference) return;
    element.parentElement?.querySelector(":scope > .local-media-unavailable")?.remove();
    element.classList.remove("media-load-failed");
    element.removeAttribute("aria-label");
    if (element.tagName !== "A") {
      // A signed link may expire while a tab is suspended. Refresh the cloud
      // link once; never substitute an old browser-only media copy.
      element.onerror = () => {
        if (!element.isConnected || element.dataset.localMedia !== reference) return;
        invalidateMediaUrl(reference);
        if (element.dataset.mediaRefreshAttempt !== reference) {
          element.dataset.mediaRefreshAttempt = reference;
          element.dataset.loadedMedia = "";
          void loadElement(element);
        } else {
          showMediaFailure(element, reference, new Error("The media could not load over this connection."));
        }
      };
    }
    if (element.tagName === "A") element.href = url;
    else {
      element.hidden = false;
      element.src = url;
    }
    if (element.tagName === "VIDEO" && !element.paused) void element.play().catch(() => {});
    return { loaded: true };
  } catch (error) {
    if (quiet) {
      if (element.dataset.localMedia === reference) element.dataset.loadedMedia = "";
    } else {
      showMediaFailure(element, reference, error);
    }
    return { loaded: false, error };
  }
}

function isFeedVideo(element) {
  return element?.tagName === "VIDEO" && Boolean(element.closest(".clip"));
}

async function loadFeedVideoPoster(element) {
  const posterReference = element.dataset.localPoster;
  if (!posterReference || element.poster || element.dataset.loadedPoster === posterReference) return;
  if (element.dataset.loadingPoster === posterReference) return;
  element.dataset.loadingPoster = posterReference;
  try {
    const posterUrl = await mediaUrl(posterReference);
    if (!element.isConnected || element.dataset.localPoster !== posterReference) return;
    element.poster = posterUrl;
    element.dataset.loadedPoster = posterReference;
  } catch {
    // A poster is an enhancement. Keep the video tile usable if it is missing.
  } finally {
    if (element.dataset.loadingPoster === posterReference) delete element.dataset.loadingPoster;
  }
}

export async function loadFeedVideo(element, { quiet = false } = {}) {
  const reference = element?.dataset?.localMedia;
  if (!isFeedVideo(element) || !isLocalMedia(reference)) return true;
  if (element.dataset.loadedMedia === reference && element.src) return true;
  const current = pendingFeedVideoLoads.get(element);
  if (current?.reference === reference) {
    const result = await current.promise;
    if (!result.loaded && !quiet && element.isConnected && element.dataset.localMedia === reference) {
      showMediaFailure(element, reference, result.error || new Error("The video could not be loaded."));
    }
    return result.loaded;
  }
  const promise = (async () => {
    const result = await loadElement(element, { quiet: true });
    return {
      loaded: result.loaded && element.dataset.localMedia === reference && Boolean(element.src),
      error: result.error,
    };
  })();
  const pending = { reference, promise };
  pendingFeedVideoLoads.set(element, pending);
  try {
    const result = await promise;
    if (!result.loaded && !quiet && element.isConnected && element.dataset.localMedia === reference) {
      showMediaFailure(element, reference, result.error || new Error("The video could not be loaded."));
    }
    return result.loaded;
  } finally {
    if (pendingFeedVideoLoads.get(element) === pending) pendingFeedVideoLoads.delete(element);
  }
}

function showMediaFailure(element, reference, error) {
  if (!element.isConnected || element.dataset.localMedia !== reference) return;
  element.dataset.loadedMedia = "";
  const status = Number(error?.status || 0);
  const video = element.tagName === "VIDEO";
  const mediaName = video ? "Video" : "Media";
  const message = status === 410 ? `The original ${mediaName.toLowerCase()} could not be found in cloud storage.`
    : status === 402 ? `${mediaName} is temporarily restricted by the storage service. Please try again later.`
    : status === 401 ? `Sign in again to load this ${mediaName.toLowerCase()}.`
    : status === 403 || status === 404 ? `This ${mediaName.toLowerCase()} is not accessible to this account.`
    : `${mediaName} could not load. Check your connection and try again.`;
  console.warn("[Oldtime media]", { status, reason: status ? "cloud-access" : "network-or-playback" });
  const cardThumb = Boolean(element.closest(".ot-collection-cover, .ot-collection-tile"));
  const profileAvatar = element.matches(".profile-avatar, .story-avatar-action img, .ring img, .cic-photo, .csc-media, .chat-avatar, .details-avatar, .chat-inbox-avatar img, .discovery-person-profile img, .cf-person-avatar img");
  const profileCover = Boolean(element.closest(".profile-cover"));
  element.classList.add("media-load-failed");
  if (element.tagName === "IMG") element.alt = "";
  element.setAttribute("aria-label", message);
  // A missing avatar should remain a quiet, fixed-size placeholder. Never add
  // a sibling status row that can spill into a name or story label.
  if (profileAvatar) return;
  if (element.tagName === "IMG" || element.tagName === "VIDEO") element.hidden = true;
  if (element.parentElement?.querySelector(":scope > .local-media-unavailable")) return;
  const notice = document.createElement(cardThumb ? "span" : "div");
  notice.className = `local-media-unavailable${cardThumb ? " local-media-unavailable--compact" : ""}${profileCover ? " local-media-unavailable--cover" : ""}`;
  notice.setAttribute("role", "status");
  const text = document.createElement("span");
  text.textContent = cardThumb ? "Unavailable" : profileCover ? "Cover unavailable"
    : status === 402 ? `${mediaName} temporarily unavailable`
    : status === 401 ? `Sign in to view ${video ? "this video" : "this media"}`
    : status === 403 || status === 404 ? `${mediaName} unavailable to you`
    : `${mediaName} unavailable`;
  notice.setAttribute("aria-label", message);
  if (cardThumb) {
    notice.append(text);
    element.after(notice);
    return;
  }
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Try again";
  retry.setAttribute("aria-label", "Retry loading media");
  retry.addEventListener("click", () => {
    invalidateMediaUrl(reference);
    element.dataset.mediaRefreshAttempt = "";
    element.dataset.loadedMedia = "";
    element.hidden = false;
    element.classList.remove("media-load-failed");
    element.removeAttribute("aria-label");
    notice.remove();
    void loadElement(element);
  });
  notice.append(text, retry);
  element.after(notice);
}

export function promoteCloudMediaSources(root) {
  const selector = 'img[src^="oldtime-media:"],video[src^="oldtime-media:"],audio[src^="oldtime-media:"]';
  const elements = [
    ...(root?.matches?.(selector) ? [root] : []),
    ...(root?.querySelectorAll?.(selector) || []),
  ];
  for (const element of elements) {
    const reference = element.getAttribute("src");
    if (!isLocalMedia(reference)) continue;
    if (element.dataset.localMedia !== reference) element.dataset.loadedMedia = "";
    element.dataset.localMedia = reference;
    element.removeAttribute("src");
  }
  return elements;
}

export function observeCloudMedia(root) {
  if (!root || typeof MutationObserver !== "function") return () => {};
  const pending = new Set();
  let scheduled = false;
  const enqueue = element => {
    if (!element?.querySelectorAll) return;
    pending.add(element);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      for (const node of pending) if (node.isConnected) void hydrateLocalMedia(node);
      pending.clear();
    });
  };
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") enqueue(record.target);
      else for (const node of record.addedNodes) enqueue(node);
    }
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "data-local-media"] });
  enqueue(root);
  return () => { observer.disconnect(); pending.clear(); };
}

export async function hydrateLocalMedia(root) {
  promoteCloudMediaSources(root);
  const elements = [
    ...(root?.matches?.("[data-local-media]") ? [root] : []),
    ...(root?.querySelectorAll?.("[data-local-media]") || []),
  ];
  if (!elements.length) return;
  if (!("IntersectionObserver" in globalThis)) {
    await Promise.all(elements.map(element =>
      isFeedVideo(element) ? loadFeedVideoPoster(element) : loadElement(element),
    ));
    return;
  }
  if (!mediaObserver) {
    mediaObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        mediaObserver.unobserve(entry.target);
        if (isFeedVideo(entry.target)) void loadFeedVideoPoster(entry.target);
        else void loadElement(entry.target);
      }
    }, { rootMargin: "80px 0px" });
  }
  for (const element of elements) {
    if (element.dataset.loadedMedia === element.dataset.localMedia) continue;
    if (element.tagName === "IMG") {
      element.loading = "lazy";
      element.decoding = "async";
      const rect = element.getBoundingClientRect();
      element.fetchPriority = rect.bottom > 0 && rect.top < window.innerHeight ? "high" : "low";
    } else if (element.tagName === "VIDEO") {
      // Signed links may be prepared near the viewport, but fetching video
      // bytes starts only when a player actually plays, not for gallery tiles.
      element.preload = "none";
    }
    mediaObserver.observe(element);
  }
}
