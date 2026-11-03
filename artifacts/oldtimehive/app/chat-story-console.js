// Messages "Story console": a compact horizontal rail of rectangular Story cards shown
// above the people/notes console. "Your story" is always first (open + separate create),
// followed by currently viewable Stories from accepted connections only. Pure helpers are
// exported for tests. No fabricated data, no network work: thumbnails come only from
// already-resolved media references or existing posters.

const text = value => String(value ?? "").trim();
const stamp = story => Number(story?.createdAt || story?.created || 0);
const isVideoRef = ref => /^data:video\//.test(ref) || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(ref);
// Inline data payloads above ~1.5MB are never used as thumbnails (avoid decoding huge blobs).
const MAX_INLINE = 1_500_000;

/** Pick a cheap, already-available thumbnail. Never triggers a download of full media. */
export function storyThumb(story, { resolveMedia = () => "", getPost = () => null } = {}) {
  if (!story) return "";
  const post = story.sourcePost ? getPost(story.sourcePost) : null;
  const poster = text(story.poster || story.mediaPoster || story.thumbnail || post?.mediaPosters?.[0]);
  if (poster) return poster;
  let ref = "";
  try { ref = text(resolveMedia(story)); } catch { ref = ""; }
  if (!ref || isVideoRef(ref) || story.kind === "video" || post?.kind === "video") return "";
  if (ref.startsWith("data:") && ref.length > MAX_INLINE) return "";
  if (!/^(data:image\/|https?:|\/|blob:)/.test(ref)) return "";
  return ref;
}

/**
 * @param {object} input
 * @param {{id:string, following?:string[]}} input.me
 * @param {Array} input.stories          raw api.stories()
 * @param {(id:string)=>object|null} input.user
 * @param {(story:object)=>boolean} input.isActive   excludes expired
 * @param {(story:object)=>boolean} input.canSeeStory privacy policy
 * @param {(a:string,b:string)=>boolean} input.blocked
 * @param {(a:string,b:string)=>boolean} input.areFriends
 */
export function buildStoryRail({ me, stories = [], user = () => null, isActive = () => true, canSeeStory = () => true,
  blocked = () => false, areFriends = () => false, thumb = () => "", limit = 30 }) {
  if (!me?.id) return { mine: null, others: [] };
  const following = new Set(Array.isArray(me.following) ? me.following : []);
  const accepted = id => areFriends(me.id, id) || following.has(id);
  const live = stories.filter(story => story && story.author && isActive(story)).sort((a, b) => stamp(b) - stamp(a));
  const mineStories = live.filter(story => story.author === me.id);
  const byAuthor = new Map();
  for (const story of live) {
    const id = story.author;
    if (id === me.id || byAuthor.has(id)) continue;
    if (blocked(me.id, id) || blocked(id, me.id) || !accepted(id)) continue;
    let visible = false;
    try { visible = canSeeStory(story) === true; } catch { visible = false; }
    if (!visible) continue;
    const person = user(id);
    if (!person) continue;
    const count = live.filter(s => s.author === id).length;
    const vis = String(story.visibility || story.audience || "").toLowerCase().replace(/_/g, "-");
    byAuthor.set(id, {
      authorId: id, storyId: story.id, count,
      name: text(person.name) || text(person.username) || "Member",
      avatar: person.avatar || "", thumb: thumb(story) || "",
      closeFriends: story.closeFriends === true || vis === "close-friends",
      username: text(person.username), created: stamp(story),
    });
    if (byAuthor.size >= limit) break;
  }
  const latest = mineStories[0] || null;
  return {
    mine: { authorId: me.id, storyId: latest?.id || null, count: mineStories.length, avatar: me.avatar || "", thumb: latest ? thumb(latest) || "" : "", created: stamp(latest) },
    others: [...byAuthor.values()],
  };
}

export function storyMatches(card, query) {
  const q = text(query).toLowerCase().replace(/^@/, "");
  if (!q) return true;
  return [card.name, card.username].some(v => String(v || "").toLowerCase().includes(q));
}

const ago = (ms, now = Date.now()) => {
  if (!ms) return "";
  const m = Math.max(0, Math.round((now - ms) / 60000));
  return m < 60 ? `${m || 1}m` : `${Math.round(m / 60)}h`;
};

export function renderStoryConsole(rail, { esc, icons, now = Date.now() }) {
  if (!rail?.mine) return "";
  const face = (src, name, cls) => src
    ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" decoding="async" />`
    : `<span class="${cls} csc-initial" aria-hidden="true">${icons.user || ""}</span>`;
  const m = rail.mine;
  const mineMedia = m.thumb ? face(m.thumb, "Y", "csc-media") : face(m.avatar, "Y", "csc-media csc-media-avatar");
  const mineOpen = m.storyId
    ? `<button type="button" class="csc-open" id="csc-own-open" data-story-author="${esc(m.authorId)}" data-story-id="${esc(m.storyId)}" aria-label="${esc(`View your story, ${m.count} ${m.count === 1 ? "item" : "items"}`)}">${mineMedia}<span class="csc-meta"><b>Your story</b><small>${esc(ago(m.created, now))}</small></span></button>`
    : `<button type="button" class="csc-open" id="csc-own-add" aria-label="Create your story" aria-haspopup="menu">${mineMedia}<span class="csc-meta"><b>Your story</b><small>Add</small></span></button>`;
  const mine = `<li class="csc-card is-me${m.storyId ? " has-story" : ""}" data-story-card="${esc(m.authorId)}">${mineOpen}
    <button type="button" class="csc-plus" id="csc-create" aria-label="Create a new story">${icons.plus}</button></li>`;
  const card = c => `<li class="csc-card${c.closeFriends ? " is-close" : ""}" data-story-card="${esc(c.authorId)}">
    <button type="button" class="csc-open" data-story-author="${esc(c.authorId)}" data-story-id="${esc(c.storyId)}" aria-label="${esc(`View ${c.name}'s story${c.closeFriends ? ", close friends" : ""}`)}">
      ${c.thumb ? face(c.thumb, c.name, "csc-media") : face(c.avatar, c.name, "csc-media csc-media-avatar")}
      ${c.thumb && c.avatar ? `<img class="csc-chip" src="${esc(c.avatar)}" alt="" loading="lazy" />` : ""}
      ${c.count > 1 ? `<span class="csc-count" aria-hidden="true">${c.count}</span>` : ""}
      <span class="csc-meta"><b>${esc(c.name)}</b><small>${esc(ago(c.created, now))}</small></span>
    </button></li>`;
  return `<section class="csc" aria-labelledby="csc-title">
    <div class="csc-head"><h2 id="csc-title">Stories</h2></div>
    <ul class="csc-track" id="csc-track" tabindex="-1">${mine}${rail.others.map(card).join("")}</ul>
  </section>`;
}

/**
 * Wires the rail. Callbacks are read through a ref object so rerenders never rebind.
 * Returns { filter(query), cleanup() }.
 */
export function bindStoryConsole(root, rail, handlers) {
  const section = root?.querySelector?.(".csc");
  if (!section || !rail) return { filter() {}, cleanup() {} };
  const ref = { current: handlers };
  let alive = true;
  const chooser = section.querySelector("#csc-chooser");
  const plus = section.querySelector("#csc-create");
  let opener = plus;
  const setChooser = (open, from = plus) => {
    if (!chooser) return;
    if (open) opener = from || plus;
    chooser.hidden = !open;
    if (chooser.hasAttribute("popover") && typeof chooser.showPopover === "function") {
      if (open && !chooser.matches(":popover-open")) chooser.showPopover();
      if (!open && chooser.matches(":popover-open")) chooser.hidePopover();
    }
    plus?.setAttribute("aria-expanded", String(open));
    section.classList.toggle("is-choosing", open);
    if (open) chooser.querySelector("button")?.focus();
  };
  if (chooser?.hasAttribute("popover")) chooser.ontoggle = event => {
    if (event.newState === "closed") {
      chooser.hidden = true;
      plus?.setAttribute("aria-expanded", "false");
      section.classList.remove("is-choosing");
    }
  };
  const run = async (fn, args, fallback) => {
    if (!alive) return;
    if (typeof fn !== "function") return ref.current.toast?.(fallback);
    try { await fn(...args); }
    catch (error) { if (alive) ref.current.toast?.(error?.message || fallback); }
  };
  const onClick = event => {
    const t = event.target.closest?.("button");
    if (!t || !section.contains(t)) return;
    event.stopPropagation();
    if (t.hasAttribute("data-story-close")) { setChooser(false); opener?.focus(); return; }
    if (t.id === "csc-create" || t.id === "csc-own-add") return run(ref.current.createStory,[{source:"camera"}],"We couldn’t open the camera. Please try again.");
    if (t.dataset.storySource) {
      setChooser(false);
      return run(ref.current.createStory, [{ source: t.dataset.storySource }], "Story camera is unavailable.");
    }
    if (t.dataset.storyAuthor) {
      setChooser(false);
      return run(ref.current.openStory, [t.dataset.storyAuthor, t.dataset.storyId || undefined], "Story viewer is unavailable.");
    }
  };
  const outside = event => { if (chooser && !chooser.hidden && !section.contains(event.target)) setChooser(false); };
  const onKey = event => {
    if (event.key === "Tab" && chooser && !chooser.hidden) {
      const controls = [...chooser.querySelectorAll("button:not([disabled])")];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !chooser.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !chooser.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
      return;
    }
    if (event.key === "Escape" && chooser && !chooser.hidden) { event.preventDefault(); event.stopPropagation(); setChooser(false); opener?.focus(); return; }
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    if (chooser?.contains(event.target)) return;
    const items = [...section.querySelectorAll(".csc-card:not([hidden]) .csc-open")];
    const at = items.indexOf(document.activeElement);
    if (at < 0) return;
    const next = items[Math.max(0, Math.min(items.length - 1, at + (event.key === "ArrowRight" ? 1 : -1)))];
    if (next) { event.preventDefault(); next.focus(); next.scrollIntoView?.({ block: "nearest", inline: "nearest" }); }
  };
  section.addEventListener("click", onClick);
  section.addEventListener("keydown", onKey);
  document.addEventListener("pointerdown", outside);
  const filter = query => {
    if (!alive) return;
    // "Your story" and create controls stay put; only friends' cards filter. Chooser stays open.
    for (const c of rail.others) {
      const node = section.querySelector(`[data-story-card="${CSS.escape(c.authorId)}"]`);
      if (node) node.hidden = !storyMatches(c, query);
    }
  };
  return {
    filter,
    update(next) { ref.current = { ...ref.current, ...next }; },
    cleanup() {
      alive = false;
      section.removeEventListener("click", onClick);
      section.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", outside);
    },
  };
}
