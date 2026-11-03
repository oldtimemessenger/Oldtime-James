// Story comments and visual-only reactions. Hearts and emoji bursts are local animation; nothing is delivered or synced.
import { createSwipeTracker, canStartSwipe } from "./creative-overlay.js";
import { isStoryActive, isStorySaved } from "./story-lifecycle.js";

export const MAX_BURSTS = 8, BURST_MS = 1000, MAX_COMMENT = 300;
export const QUICK_EMOJI = ["\u{1F602}", "\u{1F60D}", "\u{1F525}", "\u{1F44F}", "\u{1F62E}", "\u{1F64C}", "\u{1F499}", "\u{1F62D}"];
const IGNORE = "button,input,textarea,select,a,label,.row,.story-sheet,.story-bar,[data-ce-source],.creative-attribution,[contenteditable=true]";
export const isIgnoredTap = target => !target?.closest || !!target.closest(IGNORE);

export function createBurst({ host, create, max = MAX_BURSTS, ttl = BURST_MS, reduced = false, setTimer = setTimeout, clearTimer = clearTimeout, random = Math.random }) {
  const live = new Map();
  const drop = node => { clearTimer(live.get(node)); live.delete(node); node.remove(); };
  return {
    spawn(x, y, glyph = "\u2665") {
      if (reduced) return null;
      while (live.size >= max) drop(live.keys().next().value);
      const node = create(); node.className = "story-burst"; node.textContent = glyph; node.setAttribute("aria-hidden", "true");
      node.style.left = `${Math.round(x)}px`; node.style.top = `${Math.round(y)}px`;
      node.style.setProperty("--drift", `${Math.round((random() - .5) * 60)}px`);
      host.append(node); live.set(node, setTimer(() => drop(node), ttl)); return node;
    },
    count: () => live.size,
    dispose() { for (const node of [...live.keys()]) drop(node); },
  };
}

// Validates and saves a comment on a locally stored story. Throws explicit errors instead of faking success.
export function saveStoryComment({ api, mutate, storyId, ownerId, text, now = Date.now(), id = `sc-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}` }) {
  const body = String(text ?? "").trim();
  const me = api.me();
  if (!me || me.id !== ownerId) throw new Error("This session has changed. Reopen the story to comment.");
  if (!body) throw new Error("Write a comment first.");
  if (body.length > MAX_COMMENT) throw new Error(`Comments can be up to ${MAX_COMMENT} characters.`);
  const story = api.db().stories.find(item => item.id === storyId);
  if (!isStoryActive(story, now)) throw new Error("This story is no longer available.");
  if (!api.canSeeStory(story)) throw new Error("You can't comment on this story.");
  if (story.commentsEnabled === false) throw new Error("Comments are turned off for this story.");
  const comment = { id, author: me.id, text: body, created: now, local: true };
  mutate(db => {
    const target = db.stories.find(item => item.id === storyId);
    if (!target) throw new Error("This story is no longer available.");
    target.comments = [...(target.comments || []), comment];
  });
  return comment;
}
export function setStoryComments({ api, mutate, storyId, ownerId, enabled }) {
  if (api.me()?.id !== ownerId) throw new Error("This session has changed.");
  const story = api.db().stories.find(item => item.id === storyId);
  if (!story || story.author !== ownerId) throw new Error("Only the Story owner can change comments.");
  if (!isStoryActive(story)) throw new Error("This story is no longer available.");
  mutate(db => { db.stories.find(item => item.id === storyId).commentsEnabled = !!enabled; });
}

export function setStorySaved({ api, mutate, storyId, ownerId, saved, now = Date.now() }) {
  if (api.me()?.id !== ownerId) throw new Error("This session has changed.");
  const story = api.db().stories.find(item => item.id === storyId);
  if (!story || story.author !== ownerId) throw new Error("Only the story owner can change this setting.");
  if (!isStoryActive(story, now)) throw new Error("This story has expired.");
  mutate(db => {
    const target = db.stories.find(item => item.id === storyId);
    if (!target || target.author !== ownerId) throw new Error("This story is no longer available.");
    target.savedToProfile = !!saved;
  });
  return !!saved;
}

export function insertAtCursor(value, start, end, glyph, max = MAX_COMMENT) {
  const s = Math.max(0, Math.min(start ?? value.length, value.length)), e = Math.max(s, Math.min(end ?? s, value.length));
  const next = value.slice(0, s) + glyph + value.slice(e);
  return next.length > max ? { value, cursor: s } : { value: next, cursor: s + glyph.length };
}

export function createPause({ onPause, onResume }) {
  let holds = 0;
  return { hold() { if (holds++ === 0) onPause(); }, release() { if (holds > 0 && --holds === 0) onResume(); }, active: () => holds > 0, reset() { holds = 0; } };
}

export function mountStoryInteractions({ view, story, api, mutate, toast = () => {}, esc, icons = {}, pause, resume, win = window }) {
  const ownerId = api.me()?.id, doc = view.ownerDocument;
  const reduced = !!win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const layer = doc.createElement("div"); layer.className = "story-burst-layer"; view.append(layer);
  const burst = createBurst({ host: layer, create: () => doc.createElement("span"), reduced });
  const pauser = createPause({ onPause: pause, onResume: resume });
  const bar = doc.createElement("div"); bar.className = "story-bar";
  const count = () => (api.db().stories.find(item => item.id === story.id)?.comments || []).length;
  bar.innerHTML = `<button type="button" class="story-comment-open" aria-haspopup="dialog">Reply…</button>
    <button type="button" class="story-heart" aria-label="Show a heart (visual only)"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/></svg></button>
    <button type="button" class="story-reaction-open" aria-label="Choose a visual reaction" aria-expanded="false"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14s1 3 4 3 4-3 4-3M8 9h1m6 0h1"/></svg></button>
    <button type="button" class="story-more-open" aria-label="More story options" aria-expanded="false"><svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg></button>
    <div class="story-more-menu" role="group" aria-label="Story options" hidden>
      <b class="story-more-title">Story options</b>
      ${story.author === ownerId ? `<button type="button" class="story-more-item story-keep-item" aria-pressed="${isStorySaved(story)}">${isStorySaved(story) ? "Remove from profile" : "Keep on profile"}</button>` : ""}
      ${story.author === ownerId ? `<label class="story-reply-setting"><span>Who can reply?</span><select class="story-comment-setting" aria-label="Who can reply?"><option value="on" ${story.commentsEnabled !== false ? "selected" : ""}>Allow replies</option><option value="off" ${story.commentsEnabled === false ? "selected" : ""}>Don't allow replies</option></select></label>` : ""}
      <button type="button" class="story-more-item story-view-replies">View replies</button>
      <button type="button" class="story-more-item story-close-menu">Close story</button>
    </div>
    <div class="story-reaction-picker" role="group" aria-label="Visual story reactions" hidden>${QUICK_EMOJI.slice(0, 6).map(glyph => `<button type="button" data-reaction="${glyph}" aria-label="Show ${glyph} reaction">${glyph}</button>`).join("")}</div>`;
  view.append(bar);
  const open = bar.querySelector(".story-comment-open"), heartButton = bar.querySelector(".story-heart");
  const refreshCount = () => {
    const n = count(), enabled = api.db().stories.find(item => item.id === story.id)?.commentsEnabled !== false;
    open.hidden = !enabled;
    open.setAttribute("aria-label", `${n} replies. Reply to story`);
    bar.querySelector(".story-view-replies").hidden = !enabled;
  };
  const setting = bar.querySelector(".story-comment-setting");
  if (setting) setting.onchange = () => {
    try { setStoryComments({ api, mutate, storyId: story.id, ownerId, enabled: setting.value === "on" }); refreshCount(); }
    catch (error) { toast(error.message); }
  };
  const keepButton = bar.querySelector(".story-keep-item");
  if (keepButton) keepButton.onclick = () => {
    try {
      const saved = setStorySaved({ api, mutate, storyId: story.id, ownerId, saved: !isStorySaved(story) });
      keepButton.textContent = saved ? "Remove from profile" : "Keep on profile";
      keepButton.setAttribute("aria-pressed", String(saved));
      toast(saved ? "Story will stay on your profile" : "Story will disappear after 24 hours");
    } catch (error) { toast(error.message); }
  };
  const moreButton = bar.querySelector(".story-more-open"), moreMenu = bar.querySelector(".story-more-menu");
  moreButton.onclick = () => {
    hideReactions();
    moreMenu.hidden = !moreMenu.hidden;
    moreButton.setAttribute("aria-expanded", String(!moreMenu.hidden));
  };
  bar.querySelector(".story-view-replies").onclick = () => { moreMenu.hidden = true; moreButton.setAttribute("aria-expanded", "false"); open.click(); };
  bar.querySelector(".story-close-menu").onclick = () => view.querySelector("#sclose")?.click();
  refreshCount();
  const pointAt = element => { const box = view.getBoundingClientRect(), r = element.getBoundingClientRect(); return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2]; };
  heartButton.onclick = () => { burst.spawn(...pointAt(heartButton)); };
  const reactionButton = bar.querySelector(".story-reaction-open"), reactionPicker = bar.querySelector(".story-reaction-picker");
  const hideReactions = () => { reactionPicker.hidden = true; reactionButton.setAttribute("aria-expanded", "false"); };
  reactionButton.onclick = () => {
    moreMenu.hidden = true; moreButton.setAttribute("aria-expanded", "false");
    reactionPicker.hidden = !reactionPicker.hidden;
    reactionButton.setAttribute("aria-expanded", String(!reactionPicker.hidden));
  };
  reactionPicker.querySelectorAll("button").forEach(button => button.onclick = () => {
    burst.spawn(...pointAt(reactionButton), button.dataset.reaction);
    hideReactions();
  });
  const media = view.lastElementChild === bar || view.lastElementChild === layer ? view.querySelector(":scope > div[style*='height:100%']") : view.lastElementChild;
  const tap = event => {
    if (isIgnoredTap(event.target) || sheet) return;
    hideReactions();
    const box = view.getBoundingClientRect(); burst.spawn(event.clientX - box.left, event.clientY - box.top);
  };
  media?.addEventListener("click", tap);

  let sheet = null, sheetHold = false, cleanupViewport = null;
  const closeSheet = () => {
    if (!sheet) return; sheet.remove(); sheet = null; doc.removeEventListener("keydown", onKey, true);
    cleanupViewport?.(); cleanupViewport = null;
    if (sheetHold) { sheetHold = false; pauser.release(); } open.focus?.({ preventScroll: true });
  };
  const onKey = event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeSheet(); } };
  const openSheet = () => {
    if (sheet) return;
    hideReactions();
    sheet = doc.createElement("div"); sheet.className = "story-sheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "Story comments");
    sheet.innerHTML = `<div class="story-sheet-head" data-ce-grip><button type="button" class="story-sheet-handle" aria-label="Close comments"><span></span></button><button type="button" class="story-sheet-done">Done</button></div>
      <p class="story-sheet-note">Comments are saved on this device only. They are not sent to anyone.</p>
      <ul class="story-comment-list" aria-live="polite"></ul>
      <p class="story-sheet-error" role="alert" hidden></p>
      <div class="story-emoji" role="group" aria-label="Quick emoji">${QUICK_EMOJI.map(glyph => `<button type="button" data-glyph="${glyph}" aria-label="Insert ${glyph}">${glyph}</button>`).join("")}</div>
      <form class="story-compose"><textarea maxlength="${MAX_COMMENT}" rows="1" placeholder="Add a comment" aria-label="Comment"></textarea><button type="submit" class="story-send">Save</button></form>`;
    view.append(sheet); sheetHold = true; pauser.hold(); doc.addEventListener("keydown", onKey, true);
    const vv = win.visualViewport;
    const fitKeyboard = () => {
      if (!sheet || !vv) return;
      const bottom = Math.max(0, win.innerHeight - vv.height - vv.offsetTop);
      sheet.style.bottom = `${bottom}px`;
      sheet.style.maxHeight = `${Math.max(140, vv.height * .72)}px`;
    };
    vv?.addEventListener("resize", fitKeyboard); vv?.addEventListener("scroll", fitKeyboard);
    cleanupViewport = () => { vv?.removeEventListener("resize", fitKeyboard); vv?.removeEventListener("scroll", fitKeyboard); };
    fitKeyboard();
    const list = sheet.querySelector("ul"), field = sheet.querySelector("textarea"), err = sheet.querySelector(".story-sheet-error");
    const draw = () => {
      list.replaceChildren();
      const comments = api.db().stories.find(item => item.id === story.id)?.comments || [];
      if (!comments.length) { const li = doc.createElement("li"); li.className = "story-comment-empty"; li.textContent = "No comments yet."; list.append(li); }
      for (const item of comments) {
        const li = doc.createElement("li"), user = api.user(item.author);
        const name = doc.createElement("b"); name.textContent = `@${user?.username || "member"}`;
        const body = doc.createElement("span"); body.textContent = item.text;
        li.append(name, body); list.append(li);
      }
      list.scrollTop = list.scrollHeight;
    };
    draw();
    const setError = message => { err.textContent = message; err.hidden = !message; };
    sheet.querySelectorAll(".story-emoji button").forEach(button => button.onclick = () => {
      const next = insertAtCursor(field.value, field.selectionStart, field.selectionEnd, button.dataset.glyph);
      field.value = next.value; field.focus({ preventScroll: true }); field.setSelectionRange?.(next.cursor, next.cursor);
    });
    sheet.querySelectorAll(".story-sheet-handle,.story-sheet-done").forEach(button => button.onclick = closeSheet);
    sheet.querySelector("form").onsubmit = event => {
      event.preventDefault();
      try { saveStoryComment({ api, mutate, storyId: story.id, ownerId, text: field.value }); field.value = ""; setError(""); draw(); refreshCount(); }
      catch (failure) { setError(failure.message); toast(failure.message); }
    };
    const tracker = createSwipeTracker(); let dragging = false;
    sheet.addEventListener("touchstart", event => {
      if (event.touches.length !== 1 || !canStartSwipe(event.target)) return tracker.cancel();
      const t = event.touches[0]; tracker.start(t.clientX, t.clientY, { scrollTop: list.contains(event.target) ? list.scrollTop : 0, t: event.timeStamp });
    }, { passive: true });
    sheet.addEventListener("touchmove", event => {
      const t = event.touches[0], r = t && tracker.move(t.clientX, t.clientY);
      if (r?.mode === "drag") { dragging = true; if (event.cancelable) event.preventDefault(); sheet.style.transform = `translateY(${r.dy}px)`; }
    }, { passive: false });
    sheet.addEventListener("touchend", event => {
      const done = tracker.end(event.timeStamp); sheet.style.transform = ""; if (dragging && done) closeSheet(); dragging = false;
    });
    field.focus({ preventScroll: true });
  };
  open.onclick = () => { moreMenu.hidden = true; moreButton.setAttribute("aria-expanded", "false"); openSheet(); };
  return { burst, closeSheet, dispose() { closeSheet(); burst.dispose(); pauser.reset(); media?.removeEventListener("click", tap); bar.remove(); layer.remove(); }, isPaused: () => pauser.active() };
}
