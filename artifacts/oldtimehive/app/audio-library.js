import { api, mutate, requestCloudApi } from "./store.js";

let cachedSounds = new Map();
let savedSoundIds = new Set();
let cacheOwner = "";

function syncOwner() {
  const owner = api.me()?.id || "";
  if (owner !== cacheOwner) {
    cacheOwner = owner;
    cachedSounds = new Map();
    savedSoundIds = new Set();
  }
}

function rememberSound(sound) {
  if (sound?.id) cachedSounds.set(sound.id, sound);
  return sound;
}

function mediaReference(value) {
  return typeof value === "string" ? value
    : value?.reference || value?.url || value?.mediaReference || "";
}

function sourceFromSound(sound, fallback = {}) {
  if (!sound?.id) return null;
  return {
    id: sound.id,
    soundId: sound.sourcePostId ? null : sound.id,
    sourcePostId: sound.sourcePostId || null,
    title: sound.title || "Original audio",
    sound: sound.title || "Original audio",
    author: sound.author?.id || fallback.author?.id || fallback.author || "",
    authorProfile: sound.author || fallback.authorProfile || null,
    avatar: sound.author?.avatar || "",
    media: sound.mediaReference ? [sound.mediaReference] : [],
    audioReuseAllowed: sound.reuseAllowed === true,
    visibility: sound.reuseAllowed ? "public" : fallback.visibility || "public",
    audioUseCount: sound.useCount ?? fallback.audioUseCount ?? 0,
    kind: "audio-sound",
  };
}

function attributionSource(post) {
  const attribution = post?.audioSound;
  if (!attribution?.id) return null;
  const cached = cachedSounds.get(attribution.id);
  return sourceFromSound(cached || {
    ...attribution,
    reuseAllowed: post.audioReuseAllowed === true,
    useCount: post.audioUseCount,
  }, post);
}

export function audioSource(post, viewerId = api.me()?.id) {
  if (!post || !api.canSeePost(post, viewerId)) return null;
  const attributed = attributionSource(post);
  if (attributed) return attributed;
  const visited = new Set();
  while (post) {
    if (visited.has(post.id) || visited.size > 16 || !api.canSeePost(post, viewerId)) return null;
    visited.add(post.id);
    if (!post.audioSourcePostId) {
      const media = mediaReference(post.media?.[0]);
      return post.kind === "video" && media ? { ...post, media: [media], sourcePostId: post.id } : null;
    }
    post = api.post(post.audioSourcePostId);
  }
  return null;
}

export function canReuseAudio(post, viewerId = api.me()?.id) {
  if (post?.kind === "audio-sound") {
    if (!post.sourcePostId) return false;
    return post.available !== false && (post.audioReuseAllowed === true || post.owned === true);
  }
  if (!post || !api.canSeePost(post, viewerId)) return false;
  if (post.audioSound?.id) return post.audioReuseAllowed === true && post.visibility === "public";
  const source = audioSource(post, viewerId);
  if (source) return source.audioReuseAllowed === true && source.visibility === "public";
  // Cloudflare includes legacy source permission when a referenced post is not cached.
  return Boolean(post.audioSourcePostId && post.audioReuseAllowed === true && post.visibility === "public");
}

export async function loadAudioSource(post, viewerId = api.me()?.id) {
  if (!post || !api.canSeePost(post, viewerId)) return null;
  if (post.audioSound?.id) {
    syncOwner();
    let sound = cachedSounds.get(post.audioSound.id);
    if (!sound && api.authMode() === "cloud") {
      try {
        const result = await requestCloudApi(`/api/sounds/${encodeURIComponent(post.audioSound.id)}`);
        sound = rememberSound(result.sound);
      } catch {
        // Keep attribution visible even if the owner has since disabled new reuse.
        sound = { ...post.audioSound, available: false, reuseAllowed: false, mediaReference: "" };
      }
    }
    return sourceFromSound(sound || {
      ...post.audioSound,
      reuseAllowed: post.audioReuseAllowed === true,
      mediaReference: "",
    }, post);
  }
  const visited = new Set();
  let current = post;
  while (current) {
    if (visited.has(current.id) || visited.size > 16 || !api.canSeePost(current, viewerId)) return null;
    visited.add(current.id);
    if (!current.audioSourcePostId) {
      const media = mediaReference(current.media?.[0]);
      return current.kind === "video" && media ? { ...current, media: [media], sourcePostId: current.id } : null;
    }
    const sourceId = current.audioSourcePostId;
    current = api.post(sourceId);
    if (!current && api.authMode() === "cloud") {
      try { current = await api.loadCloudPost(sourceId); }
      catch { return null; }
    }
  }
  return null;
}

export function audioTitle(post) {
  if (post?.audioSound?.title) return post.audioSound.title;
  if (post?.soundId && post?.title) return post.title;
  const source = audioSource(post);
  const owner = source && api.user(source.author);
  return source?.sound && source.sound !== "Original audio" ? source.sound : `Original audio · @${owner?.username || "creator"}`;
}

export function savedAudio() {
  const user = api.me();
  if (!user) return [];
  return (user.savedAudioIds || []).slice(-50).reverse().map(id => {
    const post = api.post(id);
    if (!post) return { id, title: "Saved sound", author: "", avatar: "", unavailable: false };
    const source = audioSource(post);
    if (!source) return null;
    const owner = api.user(source.author);
    return { id: source.soundId || source.id, title: audioTitle(source), author: owner?.name || "", avatar: owner?.avatar || "", unavailable: !canReuseAudio(source) };
  }).filter(Boolean);
}

function toLibraryItem(sound) {
  return {
    id: sound.id,
    kind: "audio-sound",
    soundId: sound.sourcePostId ? null : sound.id,
    sourcePostId: sound.sourcePostId || null,
    sourceSoundId: sound.sourcePostId ? null : sound.id,
    title: sound.title,
    author: sound.author?.displayName || sound.author?.username || "",
    username: sound.author?.username || "",
    avatar: sound.author?.avatar || "",
    media: sound.mediaReference || "",
    mediaReference: sound.mediaReference || "",
    available: sound.available === true,
    reuseAllowed: sound.reuseAllowed === true,
    owned: sound.owned === true,
    unavailable: sound.available !== true,
    saved: sound.saved === true,
    useCount: sound.useCount || 0,
    trending: sound.trending === true,
    authorId: sound.author?.id || "",
  };
}

export async function loadAudioLibrary() {
  syncOwner();
  if (api.authMode() !== "cloud") return savedAudio();
  const result = await requestCloudApi("/api/sounds/library");
  const sounds = Array.isArray(result.sounds) ? result.sounds : [];
  savedSoundIds = new Set(sounds.filter(sound => sound.saved).map(sound => sound.id));
  return sounds.map(sound => toLibraryItem(rememberSound(sound)));
}

export async function discoverSounds(search = "") {
  syncOwner();
  if (api.authMode() !== "cloud") return [];
  const query = new URLSearchParams({ query: String(search || "").trim(), limit: "30" });
  const result = await requestCloudApi(`/api/sounds/discovery?${query}`);
  return (result.sounds || []).map(sound => {
    if (sound.saved) savedSoundIds.add(sound.id);
    else savedSoundIds.delete(sound.id);
    return toLibraryItem({ ...sound, sourcePostId: sound.id });
  });
}

export function audioSaved(post) {
  syncOwner();
  const soundId = post?.audioSound?.id || post?.sourcePostId || post?.sourceSoundId || post?.soundId;
  if (soundId && savedSoundIds.has(soundId)) return true;
  const source = audioSource(post);
  const sourceId=source?.sourcePostId||source?.soundId||source?.id;
  return Boolean(sourceId&&(savedSoundIds.has(sourceId)||api.me()?.savedAudioIds?.includes(sourceId)));
}

export function saveAudio(post, save = true) {
  const me = api.me(), source = audioSource(post);
  const soundId = post?.audioSound?.id || post?.sourceSoundId || post?.soundId || source?.soundId;
  if (!me || (!source && !soundId && !post?.sourcePostId) || !canReuseAudio(post)) throw new Error("This audio is unavailable for reuse.");
  const savedId=soundId||post?.sourcePostId||source?.sourcePostId||null;
  if (api.authMode() === "cloud" && savedId) {
    return requestCloudApi(`/api/sounds/${encodeURIComponent(savedId)}/save`, { method: save ? "PUT" : "DELETE" })
      .then(() => {
        syncOwner();
        if (save) savedSoundIds.add(savedId);
        else savedSoundIds.delete(savedId);
      });
  }
  mutate(db => {
    const owner = db.users.find(user => user.id === me.id);
    owner.savedAudioIds = (owner.savedAudioIds || []).filter(id => id !== savedId);
    if (save && savedId) owner.savedAudioIds.push(savedId);
  });
}

export function removeSavedAudio(id) {
  const me = api.me();
  if (!me) throw new Error("Sign in to manage saved audio.");
  if (api.authMode() === "cloud") {
    return requestCloudApi(`/api/sounds/${encodeURIComponent(id)}/save`, { method: "DELETE" })
      .then(() => { syncOwner(); savedSoundIds.delete(id); });
  }
  mutate(db => {
    const owner = db.users.find(user => user.id === me.id);
    owner.savedAudioIds = (owner.savedAudioIds || []).filter(value => value !== id);
  });
}

export function audioUses(post) {
  if (Number.isSafeInteger(post?.audioUseCount) && post.audioUseCount >= 0) return post.audioUseCount;
  const source = audioSource(post);
  if (!source) return 0;
  if (source.soundId && Number.isSafeInteger(source.audioUseCount)) return source.audioUseCount;
  const uses = new Set([...api.posts(), ...api.cloudPosts()]
    .filter(item => item.id !== source.id && audioSource(item)?.id === source.id)
    .map(item => item.id));
  return uses.size;
}
