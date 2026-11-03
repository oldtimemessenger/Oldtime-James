// Bounded "Liked by" participant sheet. Server orders people; nothing is fetched automatically.
import { api, requestCloudApi } from "./store.js";

export const LIKES_PAGE = 20;
export const LIKES_MAX = 100;

/** Append a page, dropping duplicate ids, never exceeding LIKES_MAX. */
export function mergeLikes(current, page) {
  const seen = new Set(current.map(p => p.id));
  const out = [...current];
  for (const p of Array.isArray(page) ? page : []) {
    if (!p?.id || seen.has(p.id) || out.length >= LIKES_MAX) continue;
    seen.add(p.id); out.push(p);
  }
  return out;
}
export const canLoadMore = (list, hasMore) => hasMore === true && list.length < LIKES_MAX;

export function openPostLikes(postId, { sheet, esc, icons, count, onProfile, onClose }) {
  if (!sheet || !postId) return;
  let live = true, people = [], offset = 0, hasMore = false, loading = false, error = "";
  const close = () => { live = false; sheet.classList.remove("on"); sheet.innerHTML = ""; sheet.onclick = sheet.onkeydown = null; onClose?.(); };
  const current = () => live && sheet.querySelector("[data-likes-sheet]");
  sheet.classList.add("on");
  sheet.innerHTML = `<section class="panel comment-panel likes-panel" data-likes-sheet="${esc(postId)}" role="dialog" aria-modal="true" aria-label="Likes" tabindex="-1">
    <div class="grab" aria-hidden="true"></div>
    <div class="comment-toolbar likes-head"><b>Likes</b><span class="likes-total" data-likes-total>${Number(count) > 0 ? `${esc(String(count))} likes` : ""}</span>
      <button type="button" class="comment-close" data-likes-close aria-label="Close likes">${icons.close}</button></div>
    <div class="comment-list likes-list" data-likes-list></div></section>`;
  sheet.querySelector("[data-likes-close]").onclick = close;
  sheet.onclick = e => { if (e.target === sheet) close(); };
  sheet.onkeydown = e => { if (e.key === "Escape") close(); };
  sheet.querySelector("[data-likes-sheet]").focus();

  const draw = () => {
    if (!current()) return;
    const rows = people.map(p => `<button type="button" class="likes-row" data-likes-profile="${esc(p.localId)}">
      <img class="comment-avatar" src="${esc(p.avatar || "")}" alt="" loading="lazy" />
      <span><b>${esc(p.displayName || p.username)}</b><small>@${esc(p.username)}</small></span></button>`).join("");
    const tail = loading ? `<div class="likes-skel" aria-hidden="true"></div><div class="likes-skel" aria-hidden="true"></div>`
      : error ? `<div class="comment-status" role="alert">${esc(error)}</div><button type="button" class="comment-retry" data-likes-retry>Try again</button>`
      : canLoadMore(people, hasMore) ? `<button type="button" class="comment-retry" data-likes-more>View more</button>` : "";
    const list = sheet.querySelector("[data-likes-list]");
    list.innerHTML = rows + tail || `<div class="comment-empty">No likes to show.</div>`;
    list.querySelectorAll("[data-likes-profile]").forEach(b => b.onclick = () => { const id = b.dataset.likesProfile; close(); onProfile?.(id); });
    list.querySelector("[data-likes-more]")?.addEventListener("click", load);
    list.querySelector("[data-likes-retry]")?.addEventListener("click", load);
  };
  async function load() {
    if (loading || !current()) return;
    loading = true; error = ""; draw();
    try {
      const r = await requestCloudApi(`/api/posts/${encodeURIComponent(postId)}/likes?limit=${LIKES_PAGE}&offset=${offset}`);
      if (!current()) return;
      const page = (Array.isArray(r?.likes) ? r.likes : []).filter(p => p?.id && p?.username)
        .map(p => ({ id: p.id, localId: api.cloudAuthorId(p), username: p.username, displayName: p.displayName, avatar: api.user(api.cloudAuthorId(p))?.avatar || p.avatar || "" }));
      people = mergeLikes(people, page);
      hasMore = r?.hasMore === true;
      offset = Number.isInteger(r?.nextOffset) && r.nextOffset > offset ? r.nextOffset : offset + page.length;
      if (!page.length) hasMore = false;
      if (Number.isInteger(r?.total)) sheet.querySelector("[data-likes-total]").textContent =
        `${r.total} ${r.total === 1 ? "like" : "likes"}`;
    } catch (e) { if (current()) error = e?.message || "Likes could not load."; }
    finally { loading = false; draw(); }
  }
  void load();
}
