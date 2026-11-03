// Followers/Following list visibility. The server is authoritative; the client only reflects it.
// Other people's defaults: followers hidden, following visible. Owners always see both. Counts are never hidden.

export const DEFAULT_LIST_VISIBILITY = Object.freeze({ followers: false, following: true });
export const LIST_VISIBILITY_PATH = "/api/account/profile-list-visibility";

export function normalizeListVisibility(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    followers: typeof source.followers === "boolean" ? source.followers : DEFAULT_LIST_VISIBILITY.followers,
    following: typeof source.following === "boolean" ? source.following : DEFAULT_LIST_VISIBILITY.following,
  };
}

/** Reads the public DTO field from either the flat profile or a { profile } wrapper. */
export function listVisibilityOf(record) {
  return normalizeListVisibility(record?.profileListVisibility ?? record?.profile?.profileListVisibility);
}

export function canSeeProfileList(kind, { isOwner = false, visibility } = {}) {
  if (isOwner) return true;
  return normalizeListVisibility(visibility)[kind === "followers" ? "followers" : "following"] === true;
}

export function hiddenListMessage(kind, name = "This member") {
  return `${name} keeps their ${kind === "followers" ? "followers" : "following"} list private.`;
}

const storeRequest = async (...args) => (await import("./store.js")).requestCloudApi(...args);

export async function fetchListVisibility(request = storeRequest) {
  return normalizeListVisibility(await request(LIST_VISIBILITY_PATH, { timeoutMs: 15_000 }));
}

export async function saveListVisibility(next, request = storeRequest) {
  const body = normalizeListVisibility(next);
  return normalizeListVisibility(await request(LIST_VISIBILITY_PATH, { method: "PUT", body, timeoutMs: 15_000 }));
}
