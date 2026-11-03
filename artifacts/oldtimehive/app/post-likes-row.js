const fallbackEsc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nameOf = (p) => String(p?.displayName || "").trim();

export function renderPostLikesRow({ id, count, people = [], viewerId, esc = fallbackEsc } = {}) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const e = esc || fallbackEsc;
  const known = (Array.isArray(people) ? people : []).filter((p) => p && p.id != null && nameOf(p));
  const seen = new Set();
  const uniq = known.filter((p) => !seen.has(p.id) && seen.add(p.id));
  if (!n) return "";
  const shown = uniq.slice(0, Math.min(3, n));
  const faces = shown.map((p) => {
    const initial = [...nameOf(p)][0].toUpperCase();
    const avatar = String(p.avatarUrl || "");
    const source = /^oldtime-media:[\w-]+$/i.test(avatar)
      ? `data-local-media="${e(avatar)}"`
      : `src="${e(avatar)}"`;
    const inner = avatar ? `<img ${source} alt="" loading="lazy" draggable="false">` : `<span aria-hidden="true">${e(initial)}</span>`;
    return `<button type="button" class="plr-face" data-avatar-profile="${e(p.id)}" aria-label="Open ${e(nameOf(p))}'s story or profile">${inner}</button>`;
  }).join("");
  const text = (() => {
    if (!uniq.length) return `<span class="plr-text"><button type="button" class="plr-count" data-likes-open="${e(id)}"><b>${n}</b> ${n === 1 ? "like" : "likes"}</button></span>`;
    const viewer = uniq.find((p) => viewerId != null && p.id === viewerId);
    const lead = viewer || uniq[0];
    const label = viewer ? "You" : nameOf(lead);
    const who = `<button type="button" class="plr-name" data-profile="${e(lead.id)}">${e(label)}</button>`;
    const rest = n - 1;
    if (!rest) return `<span class="plr-text">Liked by ${who} <button type="button" class="plr-count" data-likes-open="${e(id)}">See likes</button></span>`;
    return `<span class="plr-text">Liked by ${who} and <button type="button" class="plr-count" data-likes-open="${e(id)}"><b>${rest}</b> ${rest === 1 ? "other" : "others"}</button></span>`;
  })();
  return `<div class="plr" data-post-likes="${e(id)}">${faces ? `<span class="plr-faces">${faces}</span>` : ""}${text}</div>`;
}
