// Server-backed Followers/Following list sheet for any profile (owner or visitor).
// GET /api/profiles/{username}/{followers|following}?limit=30&offset=N -> { users, hasMore, nextOffset }
// 403 = the member keeps this list private, 404 = blocked/unavailable. Counts are never hidden here.
import { api } from "./store.js";
import { hiddenListMessage } from "./profile-list-visibility.js";

export const PROFILE_LIST_PAGE = 30;
export const PROFILE_LIST_MAX = 300;

export function profileListErrorMessage(error, kind, name) {
  if (error?.status === 403) return hiddenListMessage(kind, name);
  if (error?.status === 404) return "This list isn’t available.";
  return error?.message || "This list couldn’t be loaded.";
}

export function openProfileListSheet({ sheet, kind, profile, isOwner = false, esc = String, mediaSource = v => `src="${esc(v || "")}"`, toast = () => {},
  onProfile = () => {}, onFollow = async () => {}, isFollowing = () => false, isRequested = () => false, onClose = () => {} } = {}) {
  if (!sheet || !profile) return;
  const owner = api.cloudAccountId();
  const title = kind === "followers" ? "Followers" : "Following";
  const name = profile.name || `@${profile.username}`;
  const state = { users: [], hasMore: false, nextOffset: 0, status: "loading", error: "", request: 0 };
  sheet.innerHTML = `<section class="panel pl-sheet" role="dialog" aria-modal="true" aria-label="${esc(`${name} ${title}`)}">
    <header class="pl-head"><h2>${esc(title)}</h2><button type="button" class="pl-close" data-pl-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
    <div class="pl-body" aria-live="polite"></div>
  </section>`;
  sheet.classList.add("on");
  const body = sheet.querySelector(".pl-body");
  const live = () => body.isConnected && api.cloudAccountId() === owner;
  const close = () => { state.request++; sheet.classList.remove("on"); sheet.innerHTML = ""; sheet.onclick = null; sheet.onkeydown = null; onClose(); };
  sheet.onclick = event => { if (event.target === sheet) close(); };
  sheet.onkeydown = event => { if (event.key === "Escape") close(); };
  sheet.querySelector("[data-pl-close]").onclick = close;

  const followLabel = id => isFollowing(id) ? "Following" : isRequested(id) ? "Requested" : "Follow";
  const draw = () => {
    if (!live()) return;
    const me = api.me()?.id;
    const rows = state.users.map(person => {
      const id = person.localId || person.id;
      return `<li class="pl-row">
        <button type="button" class="pl-person" data-pl-profile="${esc(id)}">
          <img ${mediaSource(person.avatar || "")} alt="" /><span><b>${esc(person.displayName || person.name || person.username)}</b><small>@${esc(person.username || "member")}</small></span>
        </button>
        ${id !== me ? `<button type="button" class="pl-follow" data-pl-follow="${esc(id)}" aria-pressed="${isFollowing(id)}">${followLabel(id)}</button>` : ""}
      </li>`;
    }).join("");
    const skeleton = `<li class="pl-row pl-skel"><span></span><i></i></li>`.repeat(4);
    const capped = state.users.length >= PROFILE_LIST_MAX;
    body.innerHTML = state.status === "error" && !state.users.length
      ? `<div class="pl-empty"><p>${esc(state.error)}</p>${state.forbidden ? "" : `<button type="button" data-pl-retry>Try again</button>`}</div>`
      : state.status === "loading" && !state.users.length
        ? `<ul class="pl-list">${skeleton}</ul>`
        : !state.users.length
          ? `<div class="pl-empty"><p>${kind === "followers" ? (isOwner ? "No followers yet." : `${esc(name)} has no followers yet.`) : (isOwner ? "You aren’t following anyone yet." : `${esc(name)} isn’t following anyone yet.`)}</p></div>`
          : `<ul class="pl-list">${rows}</ul>${state.status === "error" ? `<p class="pl-note">${esc(state.error)} <button type="button" data-pl-retry>Try again</button></p>`
            : state.hasMore && !capped ? `<button type="button" class="pl-more" data-pl-more ${state.status === "loading" ? "disabled" : ""}>${state.status === "loading" ? "Loading…" : "Show more"}</button>` : ""}`;
    body.querySelector("[data-pl-retry]")?.addEventListener("click", () => load(state.users.length > 0));
    body.querySelector("[data-pl-more]")?.addEventListener("click", () => load(true));
    body.querySelectorAll("[data-pl-profile]").forEach(button => button.onclick = () => { const id = button.dataset.plProfile; close(); onProfile(id); });
    body.querySelectorAll("[data-pl-follow]").forEach(button => button.onclick = async () => {
      if (button.disabled) return;
      button.disabled = true;
      try { await onFollow(button.dataset.plFollow); } finally {
        if (button.isConnected) { button.disabled = false; button.textContent = followLabel(button.dataset.plFollow); button.setAttribute("aria-pressed", String(isFollowing(button.dataset.plFollow))); }
      }
    });
  };
  async function load(append = false) {
    if (state.status === "loading" && append) return;
    const request = ++state.request;
    state.status = "loading"; state.error = ""; state.forbidden = false;
    draw();
    try {
      const page = await api.loadCloudProfileList(profile.username, kind, append ? state.nextOffset : 0, PROFILE_LIST_PAGE);
      if (request !== state.request || !live()) return;
      const seen = new Set(append ? state.users.map(user => user.id) : []);
      state.users = (append ? state.users : []).concat(page.users.filter(user => !seen.has(user.id) && seen.add(user.id))).slice(0, PROFILE_LIST_MAX);
      state.hasMore = page.hasMore; state.nextOffset = page.nextOffset; state.status = "ready";
    } catch (error) {
      if (request !== state.request || !live()) return;
      state.status = "error"; state.forbidden = error?.status === 403 || error?.status === 404;
      state.error = profileListErrorMessage(error, kind, name);
    }
    draw();
  }
  if (api.authMode() !== "cloud") { state.status = "error"; state.forbidden = true; state.error = "Lists are available for online accounts."; draw(); return; }
  void load(false);
  sheet.querySelector("[data-pl-close]").focus();
}
