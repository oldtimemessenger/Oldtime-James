// Messages inbox "people console": a compact, horizontally swipeable deck of rectangular
// portrait cards built ONLY from real, eligible people (you, conversation contacts, story
// authors, note authors, friends). Pure helpers are exported for tests; no fabricated data.

const text = value => String(value ?? "").trim();
/** True only when the story record itself says the viewer has seen it; never inferred. */
export function storySeenBy(story, viewerId) {
  if (!story || !viewerId) return false;
  if (story.seen === true || story.viewedByMe === true) return true;
  if (Array.isArray(story.views) && story.views.some(v => v === viewerId || v?.id === viewerId || v?.userId === viewerId)) return true;
  if (Array.isArray(story.viewers) && story.viewers.some(v => v === viewerId || v?.id === viewerId || v?.userId === viewerId)) return true;
  return false;
}
const isGroup = members => Array.isArray(members) && members.length > 2;

/**
 * @param {object} input
 * @param {{id:string}} input.me
 * @param {Array} input.convos      eligible inbox conversations, most recent first
 * @param {Array} input.users       known users
 * @param {Map<string,object>} input.storyByAuthor active, viewable stories keyed by author
 * @param {(a:string,b:string)=>boolean} input.blocked
 * @param {(id:string)=>boolean} input.canSee
 * @param {(a:string,b:string)=>boolean} [input.areFriends]
 * @param {number} [input.limit]
 */
export function buildConsolePeople({ me, convos = [], users = [], storyByAuthor = new Map(), blocked = () => false, canSee = () => true, areFriends = () => false, limit = 40 }) {
  if (!me?.id) return [];
  const byId = new Map(users.map(user => [user.id, user]));
  byId.set(me.id, { ...byId.get(me.id), ...me });
  const directConvo = new Map();
  for (const convo of convos) {
    if (convo.locked || convo.legacyArchive || convo.group || isGroup(convo.members)) continue;
    const other = convo.members?.find(id => id !== me.id);
    if (other && !directConvo.has(other)) directConvo.set(other, convo.id);
  }
  const order = [me.id, ...directConvo.keys(), ...storyByAuthor.keys(),
    ...users.filter(u => text(u.profileNote)).map(u => u.id),
    ...users.filter(u => u.id !== me.id && areFriends(me.id, u.id)).map(u => u.id)];
  const seen = new Set(), cards = [];
  for (const id of order) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const person = byId.get(id);
    if (!person) continue;
    const isMe = id === me.id;
    if (!isMe && (blocked(me.id, id) || blocked(id, me.id) || !canSee(id))) continue;
    const story = storyByAuthor.get(id) || null;
    const visibility = String(story?.visibility || story?.audience || "").toLowerCase().replace(/_/g, "-");
    cards.push({
      id, isMe,
      name: isMe ? "You" : text(person.name) || text(person.username) || "Member",
      username: text(person.username),
      avatar: person.avatar || person.avatarUrl || person.avatar_url || "",
      note: text(person.profileNote),
      conversationId: isMe ? null : directConvo.get(id) || null,
      story: story ? { closeFriends: story.closeFriends === true || visibility === "close-friends" } : null,
      storyId: story?.id || "",
      seen: !isMe && storySeenBy(story, me.id),
    });
    if (cards.length >= limit) break;
  }
  return cards;
}

export function consoleMatches(card, query) {
  const q = text(query).toLowerCase().replace(/^@/, "");
  if (!q) return true;
  return [card.name, card.username, card.note].some(value => String(value || "").toLowerCase().includes(q));
}

/** Indices of cards whose real note may be featured by the gentle rotation. */
export const rotatableNotes = cards => cards.map((card, index) => card.note ? index : -1).filter(index => index >= 0);

/**
 * Idle note rotation. Never reorders cards — it only moves a "featured" highlight between
 * real notes. Holds while the user interacts, while hidden, or when motion is reduced.
 */
export function createNoteRotation({ count, intervalMs = 5200, idleMs = 6000, onTick, setTimer = setTimeout, clearTimer = clearTimeout, reducedMotion = false, isHidden = () => false, now = () => Date.now() }) {
  let index = 0, timer = null, holdUntil = 0, stopped = count < 2 || reducedMotion, userPaused = false;
  const schedule = () => {
    if (stopped || userPaused) return;
    clearTimer(timer);
    timer = setTimer(step, intervalMs);
  };
  function step() {
    timer = null;
    if (stopped || userPaused) return;
    if (isHidden() || now() < holdUntil) return schedule();
    index = (index + 1) % count;
    onTick?.(index);
    schedule();
  }
  return {
    get index() { return index; },
    get running() { return !stopped && !userPaused; },
    get paused() { return userPaused; },
    start() { if (!stopped) schedule(); return this; },
    hold(ms = idleMs) { holdUntil = Math.max(holdUntil, now() + ms); },
    setPaused(value) { userPaused = !!value; if (userPaused) { clearTimer(timer); timer = null; } else schedule(); },
    stop() { stopped = true; clearTimer(timer); timer = null; },
  };
}

export function renderConsole(cards, { esc, icons }) {
  const notes = rotatableNotes(cards);
  const card = c => {
    const photo = c.avatar ? `<img class="cic-photo" ${String(c.avatar).startsWith("oldtime-media:") ? `data-local-media="${esc(c.avatar)}"` : `src="${esc(c.avatar)}"`} alt="${esc(c.name)}" loading="lazy" />` : `<span class="cic-photo cic-initial" aria-hidden="true">${icons.user || ""}</span>`;
    const storyAction=c.story
      ? `data-story-author="${esc(c.id)}" data-story-id="${esc(c.storyId || "")}" aria-label="${esc(c.isMe ? "View your story" : `View ${c.name}'s story`)}"`
      : c.isMe ? `id="csc-own-add" aria-label="Add story"`
      : `data-console-person="${esc(c.id)}"${c.conversationId ? ` data-console-convo="${esc(c.conversationId)}"` : ""} aria-label="${esc(`Message ${c.name}`)}"`;
    const main=`<button type="button" class="cic-open" ${storyAction}><span class="cic-portrait">${photo}${c.isMe && !c.story ? `<span class="cic-add-story" aria-hidden="true">${icons.plus || "+"}</span>` : ""}</span><span class="cic-name">${esc(c.isMe ? (c.story ? "Your story" : "Add story") : c.name)}</span></button>`;
    const note = c.isMe
      ? `<button type="button" class="cic-note${c.note ? "" : " is-empty"}" data-chat-note="${esc(c.id)}" aria-label="${esc(c.note ? `Your note: ${c.note}. Edit your note` : "Add a note")}"><span class="cic-note-text">${esc(c.note || "Add a note")}</span></button>`
      : c.note ? `<button type="button" class="cic-note" data-chat-note="${esc(c.id)}" aria-label="${esc(`${c.name}'s note: ${c.note}. Open profile`)}"><span class="cic-note-text">${esc(c.note)}</span></button>` : "";
    const action=c.isMe&&c.story
      ? `<button type="button" class="cic-story-add" id="csc-create" aria-label="Add story">${icons.plus || "+"}</button>`
      : !c.isMe&&c.story ? `<button type="button" class="cic-card-action" data-console-person="${esc(c.id)}"${c.conversationId ? ` data-console-convo="${esc(c.conversationId)}"` : ""}>Message</button>` : "";
    return `<li class="cic-card${c.isMe ? " is-me" : ""}${c.story ? " has-story" : ""}${c.story?.closeFriends ? " is-close" : ""}${c.seen ? " is-seen" : ""}" data-console-card="${esc(c.id)}">${note}<span class="cic-avatar-wrap">${main}${c.isMe ? action : ""}</span>${c.isMe ? "" : action}</li>`;
  };
  return `<section class="cic csc" aria-label="Stories and notes">
    <div class="cic-head">${notes.length > 1 ? `<button type="button" class="cic-pause" id="cic-pause" aria-pressed="false" aria-label="Pause note rotation">${icons.pause}</button>` : ""}</div>
    <ul class="cic-track" id="cic-track" aria-label="People with stories and notes" tabindex="0">
      ${cards.map(card).join("")}
    </ul>
    <p class="cic-empty" id="cic-empty" hidden>No people match your search.</p>
  </section>`;
}

/** Wires keyboard paging, search filtering and the rotation. Returns a cleanup function. */
export function bindConsole(root, cards, { reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true } = {}) {
  const track = root.querySelector("#cic-track");
  if (!track) return { filter() {}, cleanup() {} };
  const notes = rotatableNotes(cards);
  const feature = position => {
    if (!track.isConnected) { rotation?.stop(); return; }
    track.querySelectorAll(".cic-card.is-featured").forEach(node => node.classList.remove("is-featured"));
    const target = cards[notes[position]];
    if (target) track.querySelector(`[data-console-card="${CSS.escape(target.id)}"]`)?.classList.add("is-featured");
  };
  // eslint-disable-next-line prefer-const
  var rotation = createNoteRotation({ count: notes.length, reducedMotion, isHidden: () => document.hidden, onTick: feature }).start();
  if (notes.length > 1 && !reducedMotion) feature(0);
  const hold = () => rotation.hold();
  const events = ["pointerdown", "pointerenter", "focusin", "wheel", "scroll", "touchstart", "keydown"];
  events.forEach(type => track.addEventListener(type, hold, { passive: true }));
  const pause = root.querySelector("#cic-pause");
  if (pause) {
    if (reducedMotion) { pause.hidden = true; }
    pause.onclick = () => { rotation.setPaused(!rotation.paused); pause.setAttribute("aria-pressed", String(rotation.paused)); pause.setAttribute("aria-label", rotation.paused ? "Resume note rotation" : "Pause note rotation"); };
  }
  track.addEventListener("keydown", event => {
    if (event.target !== track && !event.target.closest?.(".cic-card")) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const items = [...track.querySelectorAll(".cic-card:not([hidden]) .cic-open")];
    const at = items.indexOf(document.activeElement);
    const next = items[Math.max(0, Math.min(items.length - 1, (at < 0 ? -1 : at) + (event.key === "ArrowRight" ? 1 : -1)))];
    if (next) { event.preventDefault(); next.focus(); next.scrollIntoView?.({ block: "nearest", inline: "nearest" }); }
  });
  const filter = query => {
    hold();
    let shown = 0;
    for (const c of cards) {
      const node = track.querySelector(`[data-console-card="${CSS.escape(c.id)}"]`);
      const match = consoleMatches(c, query);
      if (node) node.hidden = !match;
      if (match) shown++;
    }
    const newCard = track.querySelector(".cic-card.is-new");
    if (newCard) newCard.hidden = !!text(query);
    const empty = root.querySelector("#cic-empty");
    if (empty) empty.hidden = !(text(query) && !shown);
  };
  return { filter, rotation, cleanup() { rotation.stop(); events.forEach(type => track.removeEventListener(type, hold)); } };
}
