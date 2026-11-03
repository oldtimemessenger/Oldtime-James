import { projectSources } from "./creative-project.js";
import { automaticAvatar, resolveProfileAvatar } from "./profile-avatars.js";
import { cloudApiUrl } from "./api-origin.js";

const KEY = "oldtime-v1";
const CLOUD_SESSION_KEY = "oldtime-cloud-session-v1";
const DEFAULT_AVATAR = new URL("./avatar.svg", import.meta.url).href;
let cloudFeed = [];
let deletedCloudPostIds = new Set();
let cloudProfiles = new Map();
let cloudFeedLoaded = false;
let cloudFeedLoading = false;
let cloudFeedOwnerToken = null;
let cloudFeedError = "";
let cloudFeedNextOffset = 0;
let cloudFeedHasMore = false;
const CLOUD_FEED_PAGE_SIZE = 30;
let cloudPostMigration = {
  accountId: null,
  loading: false,
  done: false,
  error: "",
  confirmed: 0,
  pending: 0,
  unsupported: 0,
  conflicts: 0
};
let cloudPostMigrationPromise = null;
let authOperationVersion = 0;

function discardUnusedAuthSession(auth) {
  if (!auth?.accessToken || getCloudSession()?.accessToken === auth.accessToken) return;
  void fetch(cloudApiUrl("/api/auth/logout"), { method: "POST", keepalive: true,
    headers: { Authorization: `Bearer ${auth.accessToken}` } }).catch(() => {});
}

function ensureCurrentAuthOperation(version, auth) {
  if (version === authOperationVersion) return;
  discardUnusedAuthSession(auth);
  throw new Error("This sign-in was cancelled because your account or sign-in attempt changed.");
}

function clearCloudContent() {
  cloudFeed = [];
  deletedCloudPostIds = new Set();
  cloudProfiles = new Map();
  cloudFeedLoaded = false;
  cloudFeedLoading = false;
  cloudFeedOwnerToken = null;
  cloudFeedError = "";
  cloudFeedNextOffset = 0;
  cloudFeedHasMore = false;
  cloudPostMigration = {
    accountId: null,
    loading: false,
    done: false,
    error: "",
    confirmed: 0,
    pending: 0,
    unsupported: 0,
    conflicts: 0
  };
  cloudPostMigrationPromise = null;
}

function getCloudSession() {
  try {
    const value = JSON.parse(globalThis.sessionStorage?.getItem(CLOUD_SESSION_KEY) || "null");
    if (!value?.accessToken || !value?.account?.id || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function ensureCurrentCloudSession(session) {
  if (!session?.accessToken || getCloudSession()?.accessToken !== session.accessToken) {
    throw new Error("Your signed-in account changed before the online request finished.");
  }
}

function saveCloudSession(response) {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) throw new Error("Session storage is unavailable.");
    storage.setItem(CLOUD_SESSION_KEY, JSON.stringify({
      accessToken: response.accessToken,
      expiresAt: response.expiresAt,
      account: response.account,
      authProvider: response.authProvider === "cognito" ? "cognito" : "password"
    }));
  } catch {
    throw new Error("Secure sign-in could not be saved in this browser. Check your storage settings and try again.");
  }
}

function clearCloudSession() {
  authOperationVersion++;
  const session = getCloudSession();
  clearCloudContent();
  try { globalThis.sessionStorage?.removeItem(CLOUD_SESSION_KEY); } catch { /* sign-out still clears local state */ }
  if (session?.accessToken && typeof fetch === "function") {
    void fetch(cloudApiUrl("/api/auth/logout"), {
      method: "POST",
      keepalive: true,
      headers: { Authorization: `Bearer ${session.accessToken}` }
    }).catch(() => {});
  }
}

async function authRequest(endpoint, body, accessToken = null) {
  let response;
  try {
    const headers = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    response = await fetch(cloudApiUrl(`/api/auth/${endpoint}`), {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error("The secure account service could not be reached.");
  }
  let result = {};
  try { result = await response.json(); } catch { /* handled by the status below */ }
  if (!response.ok) {
    const error = new Error(result.error || "Secure sign-in failed. Try again.");
    error.status = response.status;
    throw error;
  }
  return result;
}

async function cloudRequest(path, { method = "GET", body, rawBody, contentType, responseType, session = getCloudSession() } = {}) {
  if (!session?.accessToken) throw new Error("Sign in to an online account to continue.");
  ensureCurrentCloudSession(session);

  let response;
  try {
    const headers = { Authorization: `Bearer ${session.accessToken}` };
    if (rawBody !== undefined) headers["Content-Type"] = contentType || "image/png";
    else if (body !== undefined) headers["Content-Type"] = "application/json";
    response = await fetch(cloudApiUrl(path), {
      method,
      headers,
      ...(rawBody !== undefined ? { body: rawBody } : body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch {
    ensureCurrentCloudSession(session);
    throw new Error("The online service could not be reached. Check your connection and try again.");
  }

  ensureCurrentCloudSession(session);
  if (response.status === 401) {
    clearCloudSession();
    mutate(state => { state.session = null; });
    throw Object.assign(new Error("Your online session has expired. Sign in again."), { status: 401 });
  }
  if (response.status === 204) return null;
  if (response.ok && responseType === "blob") {
    const blob = await response.blob();
    ensureCurrentCloudSession(session);
    return blob;
  }
  let result = {};
  try { result = await response.json(); } catch { /* handled by the status below */ }
  ensureCurrentCloudSession(session);
  if (!response.ok) {
    const error = new Error(result.error || "The online request failed. Try again.");
    error.status = response.status;
    throw error;
  }
  return result;
}

export function requestCloudApi(path, options = {}) {
  return cloudRequest(path, options);
}

function cloudAuthorId(author) {
  const session = getCloudSession();
  const me = api.me();
  if (session?.account?.id === author.id) return me?.id || author.id;

  const profile = {
    id: author.id,
    cloudAccountId: author.id,
    username: author.username,
    name: author.displayName || author.username,
    bio: "",
    avatar: automaticAvatar(author.id),
    city: "",
    verified: false,
    private: false,
    followers: [],
    following: [],
    friends: [],
    closeFriends: [],
    interests: [],
    profileVisibility: { city: false, interests: false }
  };
  cloudProfiles.set(author.id, profile);
  return author.id;
}

function normalizeCloudPost(post) {
  if (!post?.id || !post.author?.id || typeof post.text !== "string") {
    throw new Error("The online feed returned an invalid post.");
  }
  const me = api.me();
  const created = Number(post.createdAt);
  return {
    id: post.id,
    sourceId: post.sourceId || null,
    author: cloudAuthorId(post.author),
    kind: post.sportsCard?.imageUrl ? (post.sportsCard.mediaType === "video" ? "video" : "photo") : "text",
    caption: post.text,
    tags: [...post.text.matchAll(/#([a-z0-9_]+)/gi)].map(match => match[1].toLowerCase()),
    media: typeof post.sportsCard?.imageUrl === "string" ? [post.sportsCard.imageUrl] : [],
    sportsCard: post.sportsCard || null,
    sound: "Original audio",
    location: post.place?.label || "",
    place: post.place || null,
    visibility: "public",
    likes: post.likedByMe && me ? [me.id] : [],
    likedBy: (Array.isArray(post.likedBy)?post.likedBy:[]).map(person=>{
      const id=cloudAuthorId(person), user=api.user(id);
      return {id,displayName:user?.name||person.displayName,avatarUrl:user?.avatar||""};
    }),
    likeCount: Number.isFinite(post.likeCount) && post.likeCount >= 0 ? post.likeCount : 0,
    comments: [],
    saves: me?.savedPostIds?.includes(post.id) ? [me.id] : [],
    reposts: [],
    created: Number.isFinite(created) ? created : Date.now(),
    views: 0,
    shares: 0,
    cloud: true
  };
}

function saveCloudAccount(auth) {
  clearCloudContent();
  const account = auth.account;
  const email = String(account.email || "").trim().toLowerCase();
  const username = String(account.username || "").trim().toLowerCase();
  const existing = db.users.find(user => user.cloudAccountId === account.id || user.id === account.id) ||
    db.users.find(user => !user.cloudAccountId && email && user.email === email && user.username === username);
  const localId = existing?.id || account.id;
  saveCloudSession(auth);
  try {
    mutate(state => {
      let user = state.users.find(item => item.id === localId);
      if (!user) {
        user = {
          id: localId,
          username,
          name: account.displayName || username,
          bio: "",
          avatar: automaticAvatar(account.id),
          city: "",
          verified: false,
          private: false,
          followers: [],
          following: [],
          friends: [],
          closeFriends: [],
          interests: [],
          profileVisibility: { city: true, interests: true },
          email
        };
        state.users.push(user);
      }
      user.friends = Array.isArray(user.friends) ? user.friends : [];
      user.closeFriends = Array.isArray(user.closeFriends) ? user.closeFriends : [];
      user.cloudAccountId = account.id;
      user.username = username;
      user.name = account.displayName || username;
      user.email = email;
      delete user.password;
      state.session = localId;
    });
  } catch (error) {
    clearCloudSession();
    throw error;
  }
  return localId;
}

async function loginAccount(identifier, password) {
  const version = ++authOperationVersion;
  const normalized = String(identifier || "").trim().toLowerCase();
  const auth = await authRequest("login", { identifier: normalized, password });
  ensureCurrentAuthOperation(version, auth);
  saveCloudAccount(auth);
  return "cloud";
}

export function seed() {
  return {
    session: null,
    settings: { readReceipts: true, lastSeen: "everyone" },
    users: [],
    requests: [],
    friendRequests: [],
    posts: [],
    stories: [],
    convos: [],
    notes: [],
    blocks: [],
    reports: [],
    campaigns: [],
    interests: {},
    resets: []
  };
}

let db = load();
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw || !raw.users) return seed();
    raw.requests = Array.isArray(raw.requests) ? raw.requests : [];
    raw.friendRequests = Array.isArray(raw.friendRequests) ? raw.friendRequests : [];
    raw.resets = Array.isArray(raw.resets) ? raw.resets : [];
    raw.posts = Array.isArray(raw.posts) ? raw.posts : [];
    raw.stories = Array.isArray(raw.stories) ? raw.stories : [];
    raw.convos = Array.isArray(raw.convos) ? raw.convos : [];
    raw.notes = Array.isArray(raw.notes) ? raw.notes : [];
    raw.blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
    raw.reports = Array.isArray(raw.reports) ? raw.reports : [];
    raw.campaigns = Array.isArray(raw.campaigns) ? raw.campaigns : [];
    const userIds = new Set(raw.users.map(user => user.id));
    // Retire only studio-generated identities; preserve profile photos and classic icons.
    for (const user of raw.users) {
      if (user.avatarPreset === "alter-ego" || /^\/api\/alter-ego\/users\//.test(user.avatar || "")) {
        user.avatar = automaticAvatar(user.cloudAccountId || user.id);
        user.avatarPreset = "automatic";
      }
    }
    raw.users = raw.users.map(user => ({
      ...user,
      avatar: resolveProfileAvatar(user, DEFAULT_AVATAR),
      email: typeof user.email === "string" ? user.email.trim().toLowerCase() : "",
      followers: [...new Set((Array.isArray(user.followers) ? user.followers : [])
        .filter(id => typeof id === "string" && id !== user.id && userIds.has(id)))],
      following: [...new Set((Array.isArray(user.following) ? user.following : [])
        .filter(id => typeof id === "string" && id !== user.id && userIds.has(id)))],
      friends: [...new Set((Array.isArray(user.friends) ? user.friends : [])
        .filter(id => typeof id === "string" && id !== user.id && userIds.has(id)))],
      closeFriends: [...new Set((Array.isArray(user.closeFriends) ? user.closeFriends : [])
        .filter(id => typeof id === "string" && id !== user.id && userIds.has(id)))],
      interests: [...new Set((Array.isArray(user.interests) ? user.interests : [])
        .filter(value => typeof value === "string")
        .map(value => value.trim().toLowerCase())
        .filter(Boolean))],
      profileVisibility: {
        city: user.profileVisibility?.city !== false,
        interests: user.profileVisibility?.interests !== false
      }
    }));
    enforceCloseFriends(raw);
    raw.settings = { readReceipts: true, lastSeen: "everyone", ...raw.settings };
    if (raw.settings.readReceipts === undefined) raw.settings.readReceipts = true;
    if (!raw.settings.lastSeen) raw.settings.lastSeen = "everyone";
    return raw;
  } catch { return seed(); }
}
function persist() {
  try { const value = JSON.stringify(db); if (localStorage.getItem(KEY) !== value) localStorage.setItem(KEY, value); }
  catch { throw new Error("Device storage is full or unavailable. Free up space and try again."); }
}
function enforceCloseFriends(state) {
  const users = new Map(state.users.map(user => [user.id, user]));
  for (const user of state.users) {
    user.closeFriends = [...new Set(user.closeFriends || [])].filter(id => {
      const other = users.get(id);
      return other && id !== user.id && user.friends?.includes(id) && other.friends?.includes(user.id) &&
        !state.blocks?.some(block => (block.by === user.id && block.who === id) || (block.by === id && block.who === user.id));
    });
  }
}
export const api = {
  db: () => db,
  me: () => {
    const cloud = getCloudSession();
    if (cloud) {
      return db.users.find(user =>
        user.cloudAccountId === cloud.account.id || user.id === cloud.account.id
      ) || null;
    }
    const local = db.users.find(user => user.id === db.session) || null;
    return local?.cloudAccountId ? null : local;
  },
  cloudAccountId: () => getCloudSession()?.account?.id || null,
  cloudAccessToken: () => getCloudSession()?.accessToken || null,
  // Public lifecycle counter only; personalization must never inspect authentication tokens.
  authRevision: () => authOperationVersion,
  cloudAuthorId,
  authMode: () => getCloudSession() ? "cloud" : "local",
  authProvider: () => getCloudSession()?.authProvider || "password",
  async finishCognitoSignIn(input, expectedAccountId = null) {
    const session = getCloudSession();
    if ((input.intent === "link" && !expectedAccountId) ||
      (expectedAccountId && session?.account.id !== expectedAccountId)) {
      throw new Error("Your signed-in account changed. Start secure sign-in again.");
    }
    const version = ++authOperationVersion;
    const auth = await authRequest("cognito/exchange", input,
      input.intent === "link" ? session.accessToken : null);
    ensureCurrentAuthOperation(version, auth);
    if ((getCloudSession()?.accessToken || null) !== (session?.accessToken || null)) {
      discardUnusedAuthSession(auth);
      throw new Error("Your signed-in account changed. Start secure sign-in again.");
    }
    if (expectedAccountId && auth.account?.id !== expectedAccountId) {
      discardUnusedAuthSession(auth);
      throw new Error("Secure sign-in returned a different account. Your current account has not been changed.");
    }
    saveCloudAccount(auth);
    return input.intent;
  },
  user: (id) => db.users.find(u => u.id === id) || db.users.find(u => u.username === id) || cloudProfiles.get(id),
  cloudPosts: () => [...cloudFeed],
  cloudPost: (id) => cloudFeed.find(post => post.id === id) || null,
  post(id) { return db.posts.find(post => post.id === id) || this.cloudPost(id); },
  cloudPostMigrationStatus: () => ({ ...cloudPostMigration }),
  cloudFeedStatus: () => ({
    loaded: cloudFeedLoaded,
    loading: cloudFeedLoading,
    error: cloudFeedError,
    hasMore: cloudFeedHasMore
  }),
  async refreshCloudFeed() {
    const session = getCloudSession();
    if (!session?.accessToken) throw new Error("Sign in to an online account to continue.");
    if (cloudFeedLoading && cloudFeedOwnerToken === session.accessToken) return cloudFeed;
    cloudFeedLoading = true;
    cloudFeedOwnerToken = session.accessToken;
    cloudFeedError = "";
    try {
      const result = await cloudRequest(`/api/feed?limit=${CLOUD_FEED_PAGE_SIZE}&offset=0`, { session });
      ensureCurrentCloudSession(session);
      if (!Array.isArray(result.posts)) throw new Error("The online feed returned an invalid response.");
      const page = result.posts.filter(post => !deletedCloudPostIds.has(post.id)).map(normalizeCloudPost);
      cloudFeed = page;
      cloudFeedNextOffset = Number.isSafeInteger(result.nextOffset) && result.nextOffset >= 0
        ? result.nextOffset
        : result.posts.length;
      cloudFeedHasMore = typeof result.hasMore === "boolean"
        ? result.hasMore
        : result.posts.length === CLOUD_FEED_PAGE_SIZE;
      cloudFeedLoaded = true;
      return [...cloudFeed];
    } catch (error) {
      if (getCloudSession()?.accessToken === session.accessToken) {
        cloudFeedError = error.message || "The online feed could not be loaded.";
      }
      throw error;
    } finally {
      if (cloudFeedOwnerToken === session.accessToken) {
        cloudFeedLoading = false;
        cloudFeedOwnerToken = null;
      }
    }
  },
  async loadMoreCloudFeed() {
    const session = getCloudSession();
    if (!session?.accessToken) throw new Error("Sign in to an online account to continue.");
    if (cloudFeedLoading && cloudFeedOwnerToken === session.accessToken) return [...cloudFeed];
    if (!cloudFeedHasMore) return [...cloudFeed];
    cloudFeedLoading = true;
    cloudFeedOwnerToken = session.accessToken;
    cloudFeedError = "";
    try {
      const result = await cloudRequest(
        `/api/feed?limit=${CLOUD_FEED_PAGE_SIZE}&offset=${cloudFeedNextOffset}`,
        { session }
      );
      ensureCurrentCloudSession(session);
      if (!Array.isArray(result.posts)) throw new Error("The online feed returned an invalid response.");
      const page = result.posts.filter(post => !deletedCloudPostIds.has(post.id)).map(normalizeCloudPost);
      const seen = new Set(cloudFeed.map(post => post.id));
      cloudFeed = [...cloudFeed, ...page.filter(post => !seen.has(post.id))];
      cloudFeedNextOffset = Number.isSafeInteger(result.nextOffset) && result.nextOffset >= cloudFeedNextOffset
        ? result.nextOffset
        : cloudFeedNextOffset + result.posts.length;
      cloudFeedHasMore = typeof result.hasMore === "boolean"
        ? result.hasMore
        : result.posts.length === CLOUD_FEED_PAGE_SIZE;
      cloudFeedLoaded = true;
      return [...cloudFeed];
    } catch (error) {
      if (getCloudSession()?.accessToken === session.accessToken) {
        cloudFeedError = error.message || "The online feed could not be loaded.";
      }
      throw error;
    } finally {
      if (cloudFeedOwnerToken === session.accessToken) {
        cloudFeedLoading = false;
        cloudFeedOwnerToken = null;
      }
    }
  },
  migrateCloudTextPosts({ retry = false } = {}) {
    const session = getCloudSession();
    const me = api.me();
    if (!session?.account?.id || !me) return Promise.reject(new Error("Sign in to an online account to migrate posts."));
    if (!retry && cloudPostMigration.accountId === session.account.id && cloudPostMigration.done) {
      return Promise.resolve({ ...cloudPostMigration });
    }
    if (cloudPostMigrationPromise) return cloudPostMigrationPromise;

    const ownPosts = db.posts.filter(post => post.author === me.id && !post.cloud);
    const eligible = ownPosts.filter(post => {
      const text = String(post.caption || "").trim();
      return post.kind === "text" && !post.creativeProject && !post.sourceComment &&
        (!Array.isArray(post.media) || post.media.length === 0) &&
        (post.visibility || "public") === "public" &&
        post.closeFriends !== true &&
        typeof post.id === "string" &&
        post.id.length > 0 &&
        text.length > 0 &&
        text.length <= 1000 &&
        Number.isSafeInteger(Number(post.created)) &&
        Number(post.created) >= 0 &&
        Number(post.created) <= 8640000000000000;
    });
    const migration = cloudPostMigration = {
      accountId: session.account.id,
      loading: true,
      done: false,
      error: "",
      confirmed: 0,
      pending: 0,
      unsupported: ownPosts.length - eligible.length,
      conflicts: 0
    };
    const operation = Promise.resolve().then(async () => {
      try {
        for (let offset = 0; offset < eligible.length; offset += 50) {
          const batch = eligible.slice(offset, offset + 50);
          const result = await cloudRequest("/api/posts/import", {
            session,
            method: "POST",
            body: {
              posts: batch.map(post => ({
                sourceId: post.id,
                text: String(post.caption).trim(),
                createdAt: Number(post.created)
              }))
            }
          });
          ensureCurrentCloudSession(session);
          if (!Array.isArray(result.results) || result.results.length !== batch.length) {
            throw new Error("The server did not confirm every post in the import batch.");
          }
          const outcomes = new Map(result.results.map(item => [item.sourceId, item]));
          if (outcomes.size !== batch.length || batch.some(post => !outcomes.has(post.id))) {
            throw new Error("The server returned an incomplete post import confirmation.");
          }
          for (const post of batch) {
            const outcome = outcomes.get(post.id).outcome;
            if (outcome === "imported" || outcome === "already-imported") migration.confirmed++;
            else if (outcome === "conflict") migration.conflicts++;
            else throw new Error("The server returned an unknown post import status.");
          }
        }
        migration.pending = eligible.length - migration.confirmed;
        migration.done = true;
        return { ...migration };
      } catch (error) {
        migration.pending = eligible.length - migration.confirmed;
        migration.error = error.message || "Some posts could not be confirmed by the server.";
        throw error;
      } finally {
        migration.loading = false;
        if (cloudPostMigrationPromise === operation) cloudPostMigrationPromise = null;
      }
    });
    cloudPostMigrationPromise = operation;
    return operation;
  },
  async createCloudPost(text, sportsFields = {}) {
    const session = getCloudSession();
    const hadLoadedFeed = cloudFeedLoaded;
    const result = await cloudRequest("/api/posts", { session, method: "POST", body: { text, ...sportsFields } });
    ensureCurrentCloudSession(session);
    const post = normalizeCloudPost(result.post);
    cloudFeed = [post, ...cloudFeed.filter(item => item.id !== post.id)];
    if (hadLoadedFeed) cloudFeedNextOffset += 1;
    else {
      cloudFeedNextOffset = 1;
      cloudFeedHasMore = true;
    }
    cloudFeedLoaded = true;
    cloudFeedError = "";
    return post;
  },
  async setCloudLike(id, liked) {
    const session = getCloudSession();
    const path = `/api/posts/${encodeURIComponent(id)}/like`;
    const result = await cloudRequest(path, { session, method: liked ? "PUT" : "DELETE" });
    ensureCurrentCloudSession(session);
    const post = cloudFeed.find(item => item.id === id);
    if (post) {
      post.likeCount = result.likeCount;
      const me = api.me();
      post.likes = liked && me ? [me.id] : [];
      post.likedBy=(post.likedBy||[]).filter(person=>person.id!==me?.id);
      if(liked&&me)post.likedBy.unshift({id:me.id,displayName:me.name,avatarUrl:me.avatar||""});
    }
    return result;
  },
  async deleteOwnPost(id) {
    const post = this.post(id);
    const ownerId = this.me()?.id;
    if (!post || !ownerId || post.author !== ownerId) throw new Error("You can only delete your own posts.");
    if (post.cloud) return this.deleteCloudPost(id);
    mutate(state => {
      state.posts = state.posts.filter(item => item.id !== id);
    });
  },
  async deleteOwnStory(id) {
    const story = this.db().stories.find(item => item.id === id);
    const ownerId = this.me()?.id;
    if (!story || !ownerId || story.author !== ownerId) throw new Error("You can only delete your own Stories.");
    mutate(state => {
      state.stories = state.stories.filter(item => item.id !== id);
    });
  },
  async deleteCloudPost(id) {
    const session = getCloudSession();
    const post = this.cloudPost(id);
    const ownerId = this.me()?.id;
    if (!post || post.author !== ownerId) throw new Error("You can only delete your own online posts.");
    await cloudRequest(`/api/posts/${encodeURIComponent(id)}`, { session, method: "DELETE" });
    ensureCurrentCloudSession(session);
    deletedCloudPostIds.add(id);
    cloudFeed = cloudFeed.filter(item => item.id !== id);
    cloudFeedNextOffset = Math.max(0, cloudFeedNextOffset - 1);
    // Remove an imported original only after the server confirms deletion,
    // otherwise the automatic legacy importer would publish it again.
    if (post.sourceId) {
      mutate(state => {
        state.posts = state.posts.filter(item => !(item.id === post.sourceId && item.author === ownerId));
      });
    }
  },
  reset: () => { clearCloudSession(); db = seed(); persist(); },
  async signup(form) {
    const username = (form.username || "").toLowerCase();
    const email = (form.email || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error("Username must be 3–24 lowercase letters, numbers, or _");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a real email");
    if (!form.password || form.password.length < 8) throw new Error("Password needs at least 8 characters");
    const version = ++authOperationVersion;
    const auth = await authRequest("register", {
      email,
      username,
      displayName: String(form.name || username).trim().slice(0, 60) || username,
      password: form.password
    });
    ensureCurrentAuthOperation(version, auth);
    saveCloudAccount(auth);
    return "cloud";
  },
  changePassword(currentPassword, newPassword) {
    const session = getCloudSession();
    if (!session?.accessToken) {
      return Promise.reject(new Error("Sign in to an online account to change its password."));
    }
    return authRequest("password", { currentPassword, newPassword }, session.accessToken);
  },
  login(identifier, password) { return loginAccount(identifier, password); },
  logout() { clearCloudSession(); mutate(db => { db.session = null; }); },
  emailInUse(email, exceptId = null) {
    const normalized = String(email || "").trim().toLowerCase();
    return db.users.some(user => typeof user.email === "string" &&
      user.email.trim().toLowerCase() === normalized && user.id !== exceptId);
  },
  blocked(a, b) { return db.blocks.some(x => (x.by === a && x.who === b) || (x.by === b && x.who === a)); },
  areFriends(a, b) {
    const first = this.user(a);
    const second = this.user(b);
    return Boolean(first && second &&
      Array.isArray(first.friends) && first.friends.includes(second.id) &&
      Array.isArray(second.friends) && second.friends.includes(first.id));
  },
  isCloseFriend(authorId, viewerId) {
    const author = this.user(authorId);
    return Boolean(author && viewerId && this.areFriends(authorId, viewerId) && !this.blocked(authorId, viewerId) &&
      Array.isArray(author.closeFriends) && author.closeFriends.includes(viewerId));
  },
  canSee(authorId, viewerId = this.me()?.id) {
    const me = viewerId ? this.user(viewerId) : null;
    const author = this.user(authorId);
    if (!author) return false;
    if (me && this.blocked(me.id, author.id)) return false;
    if (author.private && author.id !== me?.id &&
      !author.followers.includes(me?.id) &&
      !this.areFriends(author.id, me?.id) &&
      !this.isCloseFriend(author.id, me?.id)) return false;
    return true;
  },
  canSeePost(post, viewerId = this.me()?.id, lineage = new Set()) {
    if (!post || !this.canSee(post.author, viewerId)) return false;
    if (lineage.has(post.id) || lineage.size > 16) return false;
    lineage.add(post.id);
    for (const id of new Set([post.remixOf, post.audioSourcePostId].filter(Boolean))) {
      const original = this.post(id);
      if (!original || !this.canSeePost(original, viewerId, new Set(lineage))) return false;
    }
    const sources = [...projectSources(post.creativeProject),
      ...(post.sourceComment ? [{ postId: post.sourceComment.post, commentId: post.sourceComment.comment }] : [])];
    for (const source of sources) {
      const original = this.post(source.postId);
      const comment = original?.comments?.flatMap(item => [item, ...(item.replies || [])]).find(item => item.id === source.commentId);
      if (!original || !comment || (source.commentAuthorId && comment.author !== source.commentAuthorId) ||
        this.blocked(comment.author, viewerId) || !this.canSeePost(original, viewerId, new Set(lineage))) return false;
    }
    const me = viewerId ? this.user(viewerId) : null;
    const author = this.user(post.author);
    const visibility = post.closeFriends === true ? "close-friends" : (post.visibility || "public");
    if (me?.id === author.id || visibility === "public") return true;
    if (visibility === "followers") return author.followers.includes(me?.id);
    if (visibility === "friends") return this.areFriends(author.id, me?.id);
    if (visibility === "closeFriends" || visibility === "close-friends") return this.isCloseFriend(author.id, me?.id);
    return false;
  },
  canSeeStory(story) {
    if (!story || !this.canSee(story.author)) return false;
    if ((story.creativeProject || story.sourceComment) && !this.canSeePost(story)) return false;
    const me = this.me();
    const author = this.user(story.author);
    if (!author) return false;
    if (author.id === me?.id) return true;
    const visibility = String(story.visibility || story.audience || "")
      .toLowerCase()
      .replace(/_/g, "-");
    if (visibility === "close-friends" || visibility === "closefriends" || story.closeFriends === true) {
      return this.isCloseFriend(author.id, me?.id);
    }
    if (visibility === "friends") {
      return this.areFriends(author.id, me?.id);
    }
    if (visibility === "followers") {
      return Boolean(me && author.followers.includes(me.id));
    }
    return true;
  },
  posts() {
    return db.posts.filter(p => this.canSeePost(p));
  },
  ranked(mode) {
    const me = this.me();
    const importedSources = new Set(cloudFeed.map(post => post.sourceId).filter(Boolean));
    let list = this.posts().filter(post => !importedSources.has(String(post.id)));
    if (mode === "following" && me) list = list.filter(p => me.following.includes(p.author) || p.author === me.id);
    else list = [...list, ...cloudFeed];
    return list.sort((a, b) => score(b, me) - score(a, me));
  }
};
function score(p, me) {
  const completion = p.watch || 0.35;
  const fresh = Math.max(0, 1 - (Date.now() - p.created) / 864e5);
  const interest = (p.tags || []).reduce((n, t) => n + ((me && db.interests[t]) || 0), 0);
  const small = (p.views || 0) < 3000 ? 0.35 : 0;
  return completion * 5 + (p.replays || 0) * 3 + (p.shares || 0) * 2 + p.saves.length * 2 + p.comments.length * 1.4 + p.likes.length + fresh + interest + small;
}
export function mutate(fn) {
  const before = structuredClone(db);
  try { fn(db); enforceCloseFriends(db); persist(); }
  catch (error) { db = before; throw error; }
}
export function profileEmailValidationMessage(value, currentValue, emailInUse) {
  const email = String(value || "").trim().toLowerCase();
  const currentEmail = String(currentValue || "").trim().toLowerCase();
  if (!email || email === currentEmail) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email";
  if (emailInUse(email)) return "Email already registered";
  return "";
}
export function notify(db, note) {
  if (db.users.find(u => u.id === note.user)?.notifs === false || api.blocked(note.user, note.actor)) return;
  db.notes.unshift(note);
}
export function fileToData(file) {
  if (!file || file.size > 2 * 1024 * 1024) return Promise.reject(new Error("Files must be 2 MB or smaller."));
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ url: r.result, video: file.type.startsWith("video"), name: file.name });
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
window.addEventListener("storage", e => {
  if (e.key !== KEY) return;
  db = load();
  window.dispatchEvent(new Event("oldtime-data"));
});
