import { api } from "./store.js";
import { filterInbox } from "./inbox-helpers.js";
import { listBlastFriends, listBlastGroups } from "./blast-store.js";

const STORAGE_KEY = "oldtime-blast-video-notes-v1";
const DATABASE_NAME = "oldtime-blast-video-media-v1";
const DATABASE_VERSION = 1;
const MEDIA_STORE = "media";
const MAX_MEDIA_BYTES = 24 * 1024 * 1024;
const MAX_NOTE_SECONDS = 60;
const FEED_AUDIENCES = new Set(["public", "friends", "group", "only-me"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const objectUrls = new Map();

let databasePromise;

function makeId(prefix) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${id}`;
}

function currentUserId() {
  const user = api.me();
  if (!user) throw new Error("Sign in to use Blast.");
  return user.id;
}

function blankState() {
  return { version: 1, notes: [], chats: [], saved: [] };
}

function readState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error("Blast video-note storage is unavailable on this device.");
  }
  if (!raw) return blankState();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Blast video-note data could not be read. Your other Oldtime data is unchanged.");
  }
  if (!parsed || parsed.version !== 1) throw new Error("This Blast video-note data version is not supported.");
  for (const key of ["notes", "chats", "saved"]) {
    if (parsed[key] === undefined) parsed[key] = [];
    if (!Array.isArray(parsed[key])) throw new Error("Blast video-note data has an invalid format.");
  }
  return parsed;
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    throw new Error("Device storage is full or unavailable. Free up space and try again.");
  }
  window.dispatchEvent(new Event("blast-video-notes-changed"));
}

function updateState(change) {
  const state = readState();
  const result = change(state);
  writeState(state);
  return result;
}

function userPair(first, second) {
  return [first, second].sort((left, right) => left.localeCompare(right));
}

function areBlastFriends(first, second) {
  return Boolean(first && second && listBlastFriends(first).includes(second));
}

function openMediaDatabase() {
  if (databasePromise) return databasePromise;
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error("This browser cannot store video notes on this device."));
  }
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MEDIA_STORE)) {
        database.createObjectStore(MEDIA_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Could not open device storage for Blast media."));
    request.onblocked = () => reject(new Error("Blast media storage is busy in another tab. Close it and try again."));
  }).catch(error => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

function transact(mode, operation) {
  return openMediaDatabase().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE, mode);
    const store = transaction.objectStore(MEDIA_STORE);
    let result;
    try {
      result = operation(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result?.result);
    transaction.onerror = () => reject(new Error("Blast media could not be saved on this device."));
    transaction.onabort = () => reject(new Error("Blast media could not be saved on this device."));
  }));
}

function mediaTypeFor(blob) {
  const type = String(blob?.type || "").toLowerCase().split(";")[0];
  if (IMAGE_TYPES.has(type)) return { mimeType: type, mediaType: "image" };
  if (VIDEO_TYPES.has(type)) return { mimeType: type, mediaType: "video" };
  throw new Error("Choose a JPEG, PNG, WebP, AVIF, MP4, WebM, or QuickTime file.");
}

export async function saveBlastMedia(blob, name = "Blast media") {
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error("Choose a media file or record a video note first.");
  if (blob.size > MAX_MEDIA_BYTES) throw new Error("Blast media must be 24 MB or smaller.");
  const { mimeType, mediaType } = mediaTypeFor(blob);
  const id = makeId("media");
  await transact("readwrite", store => store.put({
    id,
    blob,
    mimeType,
    mediaType,
    name: String(name || "Blast media").slice(0, 120),
    createdAt: Date.now()
  }));
  return { id, mimeType, mediaType, size: blob.size };
}

export async function getBlastMediaBlob(mediaId) {
  const id = String(mediaId || "");
  if (!id) return null;
  return openMediaDatabase().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE, "readonly");
    const request = transaction.objectStore(MEDIA_STORE).get(id);
    request.onsuccess = () => resolve(request.result?.blob || null);
    request.onerror = () => reject(new Error("Blast media could not be loaded from this device."));
  }));
}

export async function getBlastMediaUrl(mediaId) {
  const id = String(mediaId || "");
  if (!id) return "";
  if (objectUrls.has(id)) return objectUrls.get(id);
  const blob = await getBlastMediaBlob(id);
  if (!blob) return "";
  const url = URL.createObjectURL(blob);
  objectUrls.set(id, url);
  return url;
}

export async function deleteBlastMedia(mediaId) {
  const id = String(mediaId || "");
  const url = objectUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(id);
  if (!id) return;
  await transact("readwrite", store => store.delete(id));
}

function cleanOverlays(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const number = (item, fallback, max = 100) => {
    const parsed = Number(item);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(max, parsed)) : fallback;
  };
  const strokes = Array.isArray(source.strokes) ? source.strokes.slice(0, 30).map(stroke => ({
    color: ["#ffffff", "#f4d35e", "#f28482", "#84a59d", "#5b8def"].includes(stroke?.color) ? stroke.color : "#ffffff",
    width: number(stroke?.width, 2.5, 8),
    points: (Array.isArray(stroke?.points) ? stroke.points : []).slice(0, 200)
      .map(point => ({ x: number(point?.x, 50), y: number(point?.y, 50) }))
  })).filter(stroke => stroke.points.length > 1) : [];
  const labels = Array.isArray(source.labels) ? source.labels.slice(0, 8).map(label => ({
    text: String(label?.text || "").trim().slice(0, 80),
    x: number(label?.x, 50),
    y: number(label?.y, 50),
    color: ["#ffffff", "#f4d35e", "#f28482", "#84a59d", "#5b8def"].includes(label?.color) ? label.color : "#ffffff",
    size: number(label?.size, 6, 12)
  })).filter(label => label.text) : [];
  return { strokes, labels };
}

function canViewNote(note, userId, state) {
  if (!note || !userId) return false;
  if (note.channel === "chat") {
    const peerId = note.authorId === userId ? note.recipientId : note.authorId;
    return Boolean(
      (note.authorId === userId || note.recipientId === userId) &&
      peerId &&
      areBlastFriends(userId, peerId) &&
      !api.blocked(userId, peerId)
    );
  }
  if (note.authorId === userId) return true;
  const author = api.user(note.authorId);
  if (!author || api.blocked(userId, author.id) || !api.canSee(author.id, userId)) return false;
  if (!areBlastFriends(userId, author.id)) return false;
  if (note.audience === "public") return true;
  if (note.audience === "friends") return areBlastFriends(note.authorId, userId);
  if (note.audience === "group") {
    const ownerGroup = listBlastGroups(note.authorId).some(group => group.id === note.groupId);
    const viewerGroup = listBlastGroups(userId).some(group => group.id === note.groupId);
    return ownerGroup && viewerGroup;
  }
  return false;
}

function findChat(state, first, second) {
  const pair = userPair(first, second);
  return state.chats.find(chat => chat.users?.[0] === pair[0] && chat.users?.[1] === pair[1]);
}

function getOrCreateChat(state, first, second) {
  let chat = findChat(state, first, second);
  if (!chat) {
    chat = { id: makeId("chat"), users: userPair(first, second), messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    state.chats.push(chat);
  }
  return chat;
}

export async function createBlastVideoNote(input = {}) {
  const authorId = currentUserId();
  const channel = input.channel === "chat" ? "chat" : "feed";
  const mediaId = String(input.mediaId || "");
  const blob = await getBlastMediaBlob(mediaId);
  if (!blob) throw new Error("The selected media is no longer available on this device.");
  const { mediaType, mimeType } = mediaTypeFor(blob);
  const duration = Math.max(0, Math.min(MAX_NOTE_SECONDS, Number(input.duration) || 0));
  let audience = null;
  let groupId = null;
  let recipientId = null;

  if (channel === "feed") {
    audience = input.audience === "public" ? "friends" : String(input.audience || "friends");
    if (!FEED_AUDIENCES.has(audience)) throw new Error("Choose who can see this note.");
    if (audience === "group") {
      groupId = String(input.groupId || "");
      if (!listBlastGroups(authorId).some(group => group.id === groupId)) {
        throw new Error("Choose one of your group conversations.");
      }
    }
  } else {
    recipientId = String(input.recipientId || "");
    if (!areBlastFriends(authorId, recipientId)) {
      throw new Error("Choose one of your Blast Friends for a private note.");
    }
    if (api.blocked(authorId, recipientId)) throw new Error("This conversation is unavailable.");
  }

  const note = {
    id: makeId("video-note"),
    authorId,
    channel,
    audience,
    groupId,
    recipientId,
    mediaId,
    mediaType,
    mimeType,
    duration: mediaType === "video" ? duration : 0,
    caption: String(input.caption || "").trim().slice(0, 500),
    overlays: cleanOverlays(input.overlays),
    ...(input.creativeProject ? { creativeProject: structuredClone(input.creativeProject) } : {}),
    comments: [],
    reactions: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  updateState(state => {
    state.notes.unshift(note);
    if (channel === "chat") {
      const chat = getOrCreateChat(state, authorId, recipientId);
      chat.messages.push({
        id: makeId("message"),
        kind: "video-note",
        noteId: note.id,
        authorId,
        createdAt: note.createdAt
      });
      chat.updatedAt = note.createdAt;
    }
  });
  return note;
}
export function updateBlastCreativeNote(noteId, change) {
  updateState(state=>{
    const note=state.notes.find(item=>item.id===noteId);
    if(!note||!canViewNote(note,currentUserId(),state))throw new Error("This note is no longer available.");
    change({...note,author:note.authorId});
  });
}

export function deleteBlastVideoNote(noteId) {
  const userId = currentUserId();
  const id = String(noteId || "");
  return updateState(state => {
    const note = state.notes.find(item => item.id === id);
    if (!note) throw new Error("This video note is no longer available.");
    if (note.authorId !== userId) throw new Error("You can only delete your own notes.");

    const deleted = {
      channel: note.channel,
      recipientId: note.recipientId,
      mediaId: note.mediaId
    };
    state.notes = state.notes.filter(item => item.id !== id);
    for (const chat of state.chats) {
      if (!Array.isArray(chat.messages)) continue;
      chat.messages = chat.messages.filter(message => !(message?.kind === "video-note" && message.noteId === id));
    }
    deleted.orphanedMediaId = deleted.mediaId && !state.notes.some(item => item.mediaId === deleted.mediaId)
      ? deleted.mediaId
      : "";
    return deleted;
  });
}

export function listBlastFeedVideoNotes(userId = currentUserId()) {
  const state = readState();
  return state.notes
    .filter(note => note.channel === "feed" && canViewNote(note, userId, state))
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function getBlastVideoNote(noteId, userId = currentUserId()) {
  const state = readState();
  const note = state.notes.find(item => item.id === String(noteId || ""));
  return note && canViewNote(note, userId, state) ? note : null;
}

export function addBlastVideoNoteComment(noteId, text) {
  const userId = currentUserId();
  const body = String(text || "").trim().slice(0, 500);
  if (!body) throw new Error("Write a comment first.");
  return updateState(state => {
    const note = state.notes.find(item => item.id === String(noteId || ""));
    if (!note || note.channel !== "feed" || !canViewNote(note, userId, state)) {
      throw new Error("This video note is no longer available.");
    }
    const comment = { id: makeId("comment"), authorId: userId, body, createdAt: Date.now() };
    note.comments.push(comment);
    note.updatedAt = comment.createdAt;
    return comment;
  });
}

export function toggleBlastVideoNoteReaction(noteId, kind = "heart") {
  const userId = currentUserId();
  if (kind !== "heart") throw new Error("That video-note reaction is not supported.");
  return updateState(state => {
    const note = state.notes.find(item => item.id === String(noteId || ""));
    if (!note || !canViewNote(note, userId, state)) {
      throw new Error("This video note is no longer available.");
    }
    note.reactions = Array.isArray(note.reactions) ? note.reactions : [];
    const existing = note.reactions.find(item => item.userId === userId && item.kind === kind);
    if (existing) note.reactions = note.reactions.filter(item => item !== existing);
    else note.reactions.push({ userId, kind });
    note.updatedAt = Date.now();
    return note.reactions.filter(item => item.kind === kind).length;
  });
}

export function listBlastChats(userId = currentUserId()) {
  const state = readState();
  return listBlastFriends(userId)
    .filter(peerId => !api.blocked(userId, peerId))
    .map(peerId => {
      const chat = findChat(state, userId, peerId);
      return {
        peerId,
        messages: chat?.messages || [],
        updatedAt: chat?.updatedAt || 0,
        lastMessage: chat?.messages?.at(-1) || null
      };
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function listBlastChatMessages(peerId, userId = currentUserId()) {
  if (!areBlastFriends(userId, String(peerId || "")) || api.blocked(userId, peerId)) {
    throw new Error("Choose one of your Blast Friends.");
  }
  const chat = findChat(readState(), userId, String(peerId));
  return chat?.messages || [];
}

export function addBlastChatReply(peerId, text, replyToNoteId = "") {
  const userId = currentUserId();
  const otherId = String(peerId || "");
  const body = String(text || "").trim().slice(0, 500);
  if (!body) throw new Error("Write a message first.");
  if (!areBlastFriends(userId, otherId) || api.blocked(userId, otherId)) {
    throw new Error("Choose one of your Blast Friends.");
  }
  return updateState(state => {
    const noteId = String(replyToNoteId || "").slice(0, 100);
    if (noteId) {
      const note = state.notes.find(item => item.id === noteId);
      if (!note || note.channel !== "chat" || !canViewNote(note, userId, state)) {
        throw new Error("That video note is no longer available in this chat.");
      }
      const notePeerId = note.authorId === userId ? note.recipientId : note.authorId;
      if (notePeerId !== otherId) throw new Error("Reply to a video note in this conversation.");
    }
    const chat = getOrCreateChat(state, userId, otherId);
    const message = {
      id: makeId("message"),
      kind: "text",
      authorId: userId,
      body,
      replyToNoteId: noteId,
      createdAt: Date.now()
    };
    chat.messages.push(message);
    chat.updatedAt = message.createdAt;
    return message;
  });
}

// Text a message can be searched/saved by. Video notes the viewer can no longer open (expired, removed) yield null.
function savableText(message, userId, state) {
  if(message.hiddenFor?.includes(userId)||message.expiresAt<=Date.now())return null;
  if (message.kind === "video-note") {
    const note = state.notes.find(item => item.id === message.noteId);
    return note && !(note.expiresAt<=Date.now()) && canViewNote(note, userId, state) ? (note.caption || "Video note") : null;
  }
  if (message.kind === "text" || message.kind === undefined) return message.body ? String(message.body) : null;
  return null;
}

export function listBlastSavedMessages(userId = currentUserId()) {
  const state = readState(), out = [];
  for (const entry of state.saved) {
    if (entry.ownerId !== userId) continue;
    if (!areBlastFriends(userId, entry.peerId) || api.blocked(userId, entry.peerId)) continue;
    const message = findChat(state, userId, entry.peerId)?.messages.find(item => item.id === entry.messageId);
    const text = message ? savableText(message, userId, state) : null;
    if (text !== null) out.push({ peerId: entry.peerId, message, text, savedAt: entry.savedAt || 0 });
  }
  return out.sort((left, right) => right.savedAt - left.savedAt);
}

export function isBlastMessageSaved(peerId, messageId, userId = currentUserId()) {
  return readState().saved.some(entry => entry.ownerId === userId && entry.peerId === peerId && entry.messageId === messageId);
}

export function toggleBlastSavedMessage(peerId, messageId) {
  const userId = currentUserId(), peer = String(peerId || ""), id = String(messageId || "");
  if (!areBlastFriends(userId, peer) || api.blocked(userId, peer)) throw new Error("Choose one of your Blast Friends.");
  return updateState(state => {
    const existing = state.saved.findIndex(entry => entry.ownerId === userId && entry.peerId === peer && entry.messageId === id);
    if (existing >= 0) { state.saved.splice(existing, 1); return false; }
    const message = findChat(state, userId, peer)?.messages.find(item => item.id === id);
    if (!message || savableText(message, userId, state) === null) throw new Error("This message can't be saved.");
    state.saved.push({ ownerId: userId, peerId: peer, messageId: id, savedAt: Date.now() });
    return true;
  });
}

// Search private chats by friend name/username and by real reply text or note captions.
export function searchBlastChats(query, userId = currentUserId()) {
  const state = readState();
  const chats = listBlastChats(userId);
  return filterInbox(chats, { query }, {
    name: chat => { const user = api.user(chat.peerId); return `${user?.name || ""} ${user?.username || ""}`; },
    messages: chat => chat.messages.filter(message => savableText(message, userId, state) !== null),
    textOf: message => savableText(message, userId, state) || "",
    isGroup: () => false,
    unread: () => false
  });
}

export function formatBlastNoteDuration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function getBlastVideoNoteLimits() {
  return { maxDurationSeconds: MAX_NOTE_SECONDS, maxMediaBytes: MAX_MEDIA_BYTES };
}

window.addEventListener("pagehide", () => {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
});
