// Story replies, views, and reactions use the cloud API. Tap bursts are visual-only animation.
import { icon } from "./icons.js";
import { bindMentionAutocomplete, renderMentionText } from "./mention-autocomplete.js";

export const MAX_BURSTS = 8, BURST_MS = 1000, MAX_COMMENT = 300, REPLY_FADE_MS = 6500, REPLY_FADE_STAGGER_MS = 850;
export function storyReplyFadeDelay(index = 0) {
  return REPLY_FADE_MS + Math.max(0, Math.floor(Number(index) || 0)) * REPLY_FADE_STAGGER_MS;
}
export const QUICK_EMOJI = ["\u{1F602}", "\u{1F60D}", "\u{1F525}", "\u{1F44F}", "\u{1F62E}", "\u{1F64C}", "\u{1F499}", "\u{1F62D}"];
const IGNORE = "button,input,textarea,select,a,label,.row,.story-sheet,.story-live-chat,.story-insights,.story-bar,[data-ce-source],.creative-attribution,[contenteditable=true]";
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

export function validateStoryComment(text) {
  const body = String(text ?? "").trim();
  if (!body) throw new Error("Write a reply first.");
  if (body.length > MAX_COMMENT) throw new Error(`Replies can be up to ${MAX_COMMENT} characters.`);
  return body;
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

export const STORY_HOLD_DELAY_MS = 180;
export function createPressPause({ hold, release, delay = STORY_HOLD_DELAY_MS, movement = 12, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let pointer = null, timer = null, held = false, suppressClick = false;
  const finish = (suppress = false) => {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (held) release();
    if (held && suppress) suppressClick = true;
    held = false;
    pointer = null;
  };
  return {
    start(event) {
      if (pointer || (event.button !== undefined && event.button !== 0)) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      timer = setTimer(() => {
        timer = null;
        if (!pointer) return;
        held = true;
        hold();
      }, delay);
    },
    move(event) {
      if (!pointer || (pointer.id !== undefined && event.pointerId !== pointer.id)) return;
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > movement) finish(true);
    },
    end(event) {
      if (!pointer || (pointer.id !== undefined && event.pointerId !== pointer.id)) return;
      finish(true);
    },
    cancel(event) {
      if (pointer && (pointer.id === undefined || event?.pointerId === undefined || event.pointerId === pointer.id)) finish(false);
    },
    consumeClick() {
      if (!suppressClick) return false;
      suppressClick = false;
      return true;
    },
    dispose() { finish(false); suppressClick = false; },
  };
}

export function mountStoryInteractions({ view, story, api, toast = () => {}, pause, resume, onSave, onDelete, onShare, onProfile, avatar = "", win = window }) {
  const ownerId = api.me()?.id, isOwner = story.cloud && story.author === ownerId, doc = view.ownerDocument;
  const reduced = !!win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const layer = doc.createElement("div"); layer.className = "story-burst-layer"; view.append(layer);
  const burst = createBurst({ host: layer, create: () => doc.createElement("span"), reduced });
  const pauser = createPause({ onPause: pause, onResume: resume });
  const bar = doc.createElement("div"); bar.className = "story-bar";
  bar.innerHTML = `<form class="story-compose" aria-label="Reply to Story">
      <input class="story-reply-input" type="text" maxlength="${MAX_COMMENT}" placeholder="Reply…" aria-label="Send a reply" autocomplete="off" />
      <button type="button" class="story-reaction-open" aria-label="More reactions" aria-expanded="false">${icon("smilePlus")}</button>
      <button type="submit" class="story-send" aria-label="Send reply" title="Send reply" hidden>${icon("send")}</button>
    </form>
    <div class="story-owner-controls">
      <div class="story-more-wrap">
        <button type="button" class="story-more-open" aria-label="Story activity and options" aria-haspopup="dialog" aria-expanded="false">${icon("tune")}</button>
        <div class="story-more-menu story-sheet" role="dialog" aria-label="Story activity and options" hidden>
          <div class="story-panel-handle" aria-hidden="true"></div>
          <header class="story-panel-head">
            <div class="story-panel-tabs" role="tablist" aria-label="Story controls">
              ${isOwner ? `<button type="button" class="story-activity-open story-panel-tab" role="tab" aria-selected="false">${icon("eye")}<span>Views</span></button>` : ""}
              <button type="button" class="story-options-open story-panel-tab" role="tab" aria-selected="true">Options</button>
            </div>
            <button type="button" class="story-panel-close" aria-label="Close Story controls">${icon("close")}</button>
          </header>
          <div class="story-panel-options" role="tabpanel">
          ${isOwner ? `<button type="button" class="story-more-item story-save">${story.savedToProfile ? "Remove from profile" : "Save to profile"}</button>
            <label class="story-reply-setting"><span>Who can reply?</span><select class="story-comment-setting" aria-label="Who can reply?"><option value="on" ${story.commentsEnabled !== false ? "selected" : ""}>Allow replies</option><option value="off" ${story.commentsEnabled === false ? "selected" : ""}>Don't allow replies</option></select></label>
            <button type="button" class="story-more-item story-delete">Delete Story</button>` : ""}
          <button type="button" class="story-more-item story-focus-replies">View replies</button>
          </div>
        </div>
      </div>
    </div>
    <div class="story-reaction-picker" role="group" aria-label="Story reactions" hidden>${QUICK_EMOJI.map(glyph => `<button type="button" data-reaction="${glyph}" aria-label="React ${glyph}">${glyph}</button>`).join("")}</div>`;
  const profileButton = doc.createElement("button");
  profileButton.type = "button";
  profileButton.className = "story-profile-mini";
  profileButton.setAttribute("aria-label", "Open Story author's profile");
  if (avatar) {
    const profileImage = doc.createElement("img");
    profileImage.alt = "";
    profileImage.src = avatar;
    profileImage.onerror = () => { profileImage.hidden = true; };
    profileButton.append(profileImage);
  } else {
    profileButton.innerHTML = icon("user");
  }
  profileButton.onclick = onProfile;
  bar.prepend(profileButton);
  const sideActions = doc.createElement("div");
  sideActions.className = "story-side-actions";
  sideActions.innerHTML = `<button type="button" class="story-heart" aria-label="Like Story" aria-pressed="false">${icon("mediaHeart")}</button>
    <button type="button" class="story-share" aria-label="Share Story">${icon("share")}</button>`;
  view.append(bar);
  view.append(sideActions);
  const liveChat = doc.createElement("div");
  liveChat.className = "story-live-chat";
  liveChat.setAttribute("role", "group");
  liveChat.setAttribute("aria-label", "Recent Story messages");
  const liveList = doc.createElement("div");
  liveList.className = "story-live-list";
  liveList.setAttribute("role", "log");
  liveList.setAttribute("aria-label", "Story messages");
  liveList.setAttribute("aria-live", "polite");
  liveList.tabIndex = 0;
  const latestReplies = doc.createElement("button");
  latestReplies.type = "button";
  latestReplies.className = "story-replies-latest";
  latestReplies.textContent = "Latest";
  latestReplies.hidden = true;
  const repliesToggle = doc.createElement("button");
  repliesToggle.type = "button";
  repliesToggle.className = "story-replies-toggle";
  repliesToggle.setAttribute("aria-label", "View Story messages");
  repliesToggle.title = "View Story messages";
  repliesToggle.innerHTML = icon("mediaComment");
  repliesToggle.hidden = true;
  liveChat.append(liveList, latestReplies, repliesToggle);
  liveChat.hidden = true;
  view.append(liveChat);
  const compose = bar.querySelector(".story-compose"), field = bar.querySelector(".story-reply-input");
  const mentionCleanup = bindMentionAutocomplete(field, { api });
  const sendButton = bar.querySelector(".story-send"), heartButton = sideActions.querySelector(".story-heart");
  const shareButton = sideActions.querySelector(".story-share");
  const moreButton = bar.querySelector(".story-more-open"), moreMenu = bar.querySelector(".story-more-menu");
  const activityButton = moreMenu.querySelector(".story-activity-open");
  const optionsButton = moreMenu.querySelector(".story-options-open");
  const optionsPanel = moreMenu.querySelector(".story-panel-options");
  view.append(moreMenu);
  const reactionButton = bar.querySelector(".story-reaction-open"), reactionPicker = bar.querySelector(".story-reaction-picker");
  let disposed = false, activityPanel = null, pollTimer = null, replyHold = false, historyHold = false, repliesExpanded = false, historyTouchStartY = null, reactionPending = false;
  let menuHold = false, menuCloseTimer = null, historyIdleTimer = null, historyTouching = false, panelTouchY = null;
  const replyRows = new Map(), replyTimers = new Map(), fadeTimers = new Map(), visibleReplyIds = new Set(), fadedReplyIds = new Set();
  if (!story.cloud) {
    heartButton.disabled = true;
    heartButton.setAttribute("aria-label", "Story reactions require an online Story");
    reactionButton.disabled = true;
    reactionButton.setAttribute("aria-label", "Story reactions require an online Story");
  }
  if (!story.cloud || typeof onShare !== "function") shareButton.hidden = true;
  const syncComposer = () => {
    const hasText = !!field.value.trim();
    sendButton.hidden = !hasText;
    reactionButton.hidden = hasText;
  };
  field.oninput = syncComposer;
  syncComposer();
  field.onfocus = () => { if (!replyHold) { replyHold = true; pauser.hold(); } };
  field.onblur = () => { if (replyHold) { replyHold = false; pauser.release(); } };

  const updateReactionState = () => {
    const liked = story.viewerReaction === "❤️";
    heartButton.classList.toggle("is-liked", liked);
    heartButton.setAttribute("aria-pressed", String(liked));
    for (const button of reactionPicker.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(story.viewerReaction === button.dataset.reaction));
    }
  };
  const refreshReplies = () => {
    const enabled = story.cloud && story.commentsEnabled !== false;
    compose.hidden = !enabled;
    moreMenu.querySelector(".story-focus-replies").hidden = !enabled;
    if (!enabled) {
      if (historyHold) { historyHold = false; pauser.release(); }
      repliesExpanded = false;
      for (const id of replyRows.keys()) clearReplyTimers(id);
      visibleReplyIds.clear();
      fadedReplyIds.clear();
      liveChat.classList.remove("is-expanded");
      liveChat.hidden = true;
      repliesToggle.hidden = true;
      latestReplies.hidden = true;
    }
  };
  const clearReplyTimers = id => {
    if (replyTimers.has(id)) win.clearTimeout(replyTimers.get(id));
    if (fadeTimers.has(id)) win.clearTimeout(fadeTimers.get(id));
    replyTimers.delete(id);
    fadeTimers.delete(id);
  };
  const syncLatestButton = () => {
    if (!repliesExpanded) {
      latestReplies.hidden = true;
      return;
    }
    latestReplies.hidden = liveList.scrollHeight - liveList.scrollTop - liveList.clientHeight < 24;
  };
  const updateReplyControls = comments => {
    const enabled = story.cloud && story.commentsEnabled !== false;
    const latest = comments.slice(-3);
    const hasVisibleRecent = latest.some(item => visibleReplyIds.has(String(item.id)));
    liveChat.hidden = !enabled || !comments.length;
    repliesToggle.hidden = !enabled || !comments.length || (!repliesExpanded && hasVisibleRecent);
    repliesToggle.setAttribute("aria-label", repliesExpanded ? "Close Story messages" : "View Story messages");
    repliesToggle.title = repliesExpanded ? "Close Story messages" : "View Story messages";
    repliesToggle.innerHTML = icon(repliesExpanded ? "close" : "comment");
    liveChat.setAttribute("aria-expanded", String(repliesExpanded));
    syncLatestButton();
  };
  const scheduleReplyFade = (id, staggerIndex = 0, delay = storyReplyFadeDelay(staggerIndex)) => {
    if (repliesExpanded || replyTimers.has(id)) return;
    visibleReplyIds.add(id);
    const row = replyRows.get(id);
    if (row) {
      row.hidden = false;
      row.classList.remove("is-faded");
    }
    replyTimers.set(id, win.setTimeout(() => {
      replyTimers.delete(id);
      if (repliesExpanded || disposed) return;
      visibleReplyIds.delete(id);
      fadedReplyIds.add(id);
      replyRows.get(id)?.classList.add("is-faded");
      fadeTimers.set(id, win.setTimeout(() => {
        fadeTimers.delete(id);
        if (!repliesExpanded && replyRows.has(id)) replyRows.get(id).hidden = true;
        updateReplyControls((story.comments || []).filter(item => item?.id));
      }, reduced ? 0 : 480));
      updateReplyControls((story.comments || []).filter(item => item?.id));
    }, delay));
  };
  const renderReplies = () => {
    const comments = (story.comments || []).filter(item => item?.id);
    const recentComments = comments.slice(-3);
    const recentIds = new Set(recentComments.map(item => String(item.id)));
    const recentOrder = new Map(recentComments.map((item, index) => [String(item.id), index]));
    const commentIds = new Set(comments.map(item => String(item.id)));
    for (const [id, row] of replyRows) {
      if (commentIds.has(id)) continue;
      clearReplyTimers(id);
      visibleReplyIds.delete(id);
      fadedReplyIds.delete(id);
      row.remove();
      replyRows.delete(id);
    }
    for (const item of comments) {
      const id = String(item.id);
      let row = replyRows.get(id);
      if (!row) {
        row = doc.createElement("div");
        row.className = "story-live-message is-entering";
        row.dataset.commentId = id;
        const message = doc.createElement("span");
        const name = doc.createElement("b");
        name.className = "story-live-name";
        const body = doc.createElement("span");
        body.className = "story-live-body";
        message.append(name, body);
        row.append(message);
        replyRows.set(id, row);
        liveList.append(row);
        win.setTimeout(() => row.classList.remove("is-entering"), reduced ? 0 : 360);
        if (recentIds.has(id)) scheduleReplyFade(id, recentOrder.get(id) || 0);
      }
      if (!repliesExpanded && recentIds.has(id) && !visibleReplyIds.has(id) && !fadedReplyIds.has(id)) scheduleReplyFade(id, recentOrder.get(id) || 0);
      row.querySelector(".story-live-name").textContent = `@${item.username || api.user(item.author)?.username || "member"} `;
      row.querySelector(".story-live-body").innerHTML = renderMentionText(item.text);
      row.hidden = !repliesExpanded && (!recentIds.has(id) || !visibleReplyIds.has(id));
      row.classList.toggle("is-faded", !repliesExpanded && (!recentIds.has(id) || !visibleReplyIds.has(id)));
      if (repliesExpanded) {
        row.hidden = false;
        row.classList.remove("is-faded");
      }
      row.querySelector(".story-comment-delete")?.remove();
      if (item.author === ownerId || isOwner) {
        const remove = doc.createElement("button");
        remove.type = "button"; remove.className = "story-comment-delete";
        remove.setAttribute("aria-label", "Delete reply"); remove.title = "Delete reply";
        remove.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>';
        remove.onclick = async () => {
          try {
            await api.deleteCloudStoryComment(story.id, item.id);
            story.comments = (story.comments || []).filter(comment => comment.id !== item.id);
            clearReplyTimers(id);
            visibleReplyIds.delete(id);
            fadedReplyIds.delete(id);
            replyRows.get(id)?.remove();
            replyRows.delete(id);
            renderReplies();
          } catch (error) { toast(error.message || "Reply could not be deleted."); }
        };
        row.append(remove);
      }
    }
    updateReplyControls(comments);
    if (!repliesExpanded) liveList.scrollTop = liveList.scrollHeight;
  };
  const loadReplies = async () => {
    if (!story.cloud || story.commentsEnabled === false || disposed) return;
    try {
      const replies = await api.loadCloudStoryComments(story.id);
      if (!disposed) {
        story.comments = replies;
        liveChat.classList.remove("has-error");
        liveList.querySelector(".story-live-error")?.remove();
        renderReplies();
      }
    } catch (error) {
      if (!disposed && !story.comments?.length) {
        liveList.textContent = "";
        const message = doc.createElement("span");
        message.className = "story-live-error";
        message.textContent = error.message || "Story messages could not be loaded.";
        liveList.append(message);
        liveChat.hidden = false;
        liveChat.classList.add("has-error");
      }
    }
  };
  refreshReplies();
  updateReactionState();
  renderReplies();
  if (story.cloud) {
    void loadReplies();
    pollTimer = win.setInterval(() => { void loadReplies(); }, 5000);
  }
  const setting = moreMenu.querySelector(".story-comment-setting");
  if (setting) setting.onchange = async () => {
    const enabled = setting.value === "on";
    try {
      await api.updateCloudStory(story.id, { commentsEnabled: enabled });
      story.commentsEnabled = enabled;
      refreshReplies(); renderReplies();
    } catch (error) {
      setting.value = story.commentsEnabled === false ? "off" : "on";
      toast(error.message || "Story settings could not be saved.");
    }
  };
  const hideReactions = () => { reactionPicker.hidden = true; reactionButton.setAttribute("aria-expanded", "false"); };
  const closeMenu = () => {
    moreMenu.classList.remove("is-open");
    moreMenu.setAttribute("aria-hidden", "true");
    moreMenu.inert = true;
    moreButton.setAttribute("aria-expanded", "false");
    closeActivity();
    if (menuHold) { menuHold = false; pauser.release(); }
    if (menuCloseTimer) win.clearTimeout(menuCloseTimer);
    menuCloseTimer = win.setTimeout(() => { moreMenu.hidden = true; menuCloseTimer = null; }, reduced ? 0 : 220);
  };
  const openMenu = () => {
    if (menuCloseTimer) { win.clearTimeout(menuCloseTimer); menuCloseTimer = null; }
    hideReactions();
    moreMenu.hidden = false;
    moreMenu.inert = false;
    moreMenu.setAttribute("aria-hidden", "false");
    moreButton.setAttribute("aria-expanded", "true");
    if (!menuHold) { menuHold = true; pauser.hold(); }
    if (doc.activeElement === field) field.blur();
    win.requestAnimationFrame(() => { if (menuHold && !disposed) moreMenu.classList.add("is-open"); });
  };
  const armHistoryIdle = () => {
    if (historyIdleTimer) win.clearTimeout(historyIdleTimer);
    historyIdleTimer = null;
    if (!repliesExpanded || historyTouching || disposed) return;
    historyIdleTimer = win.setTimeout(() => {
      historyIdleTimer = null;
      if (doc.activeElement === field) { armHistoryIdle(); return; }
      closeReplyHistory(true);
    }, REPLY_FADE_MS);
  };
  const showReplyHistory = () => {
    if (!story.cloud || story.commentsEnabled === false || !(story.comments || []).length) return;
    repliesExpanded = true;
    liveChat.classList.add("is-expanded");
    if (!historyHold) { historyHold = true; pauser.hold(); }
    for (const id of replyRows.keys()) clearReplyTimers(id);
    visibleReplyIds.clear();
    for (const item of (story.comments || [])) visibleReplyIds.add(String(item.id));
    renderReplies();
    liveList.scrollTop = liveList.scrollHeight;
    syncLatestButton();
    armHistoryIdle();
  };
  const closeReplyHistory = (fadeImmediately = false) => {
    if (!repliesExpanded) return;
    if (historyIdleTimer) win.clearTimeout(historyIdleTimer);
    historyIdleTimer = null;
    repliesExpanded = false;
    liveChat.classList.remove("is-expanded");
    if (historyHold) { historyHold = false; pauser.release(); }
    for (const id of replyRows.keys()) clearReplyTimers(id);
    visibleReplyIds.clear();
    for (const [index, item] of (story.comments || []).slice(-3).entries()) scheduleReplyFade(String(item.id), index, fadeImmediately ? 0 : storyReplyFadeDelay(index));
    renderReplies();
  };
  repliesToggle.onclick = () => repliesExpanded ? closeReplyHistory() : showReplyHistory();
  latestReplies.onclick = () => {
    liveList.scrollTo({ top: liveList.scrollHeight, behavior: reduced ? "auto" : "smooth" });
    syncLatestButton();
  };
  liveList.addEventListener("click", event => {
    if (!event.target.closest(".story-comment-delete") && !repliesExpanded) showReplyHistory();
    else if (repliesExpanded) armHistoryIdle();
  });
  liveList.addEventListener("scroll", () => { syncLatestButton(); armHistoryIdle(); }, { passive: true });
  liveList.addEventListener("keydown", event => {
    if (["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"].includes(event.key)) {
      if (!repliesExpanded) showReplyHistory();
      armHistoryIdle();
    }
  });
  liveChat.addEventListener("touchstart", event => {
    if (event.target?.closest?.("button")) return;
    historyTouching = true;
    if (historyIdleTimer) win.clearTimeout(historyIdleTimer);
    historyTouchStartY = event.touches?.[0]?.clientY ?? null;
  }, { passive: true });
  liveChat.addEventListener("touchmove", event => {
    if (repliesExpanded || historyTouchStartY === null || event.target?.closest?.("button")) return;
    const currentY = event.touches?.[0]?.clientY;
    if (Number.isFinite(currentY) && Math.abs(currentY - historyTouchStartY) > 14) {
      historyTouchStartY = null;
      showReplyHistory();
    }
  }, { passive: true });
  const finishHistoryTouch = () => { historyTouchStartY = null; historyTouching = false; armHistoryIdle(); };
  liveChat.addEventListener("touchend", finishHistoryTouch, { passive: true });
  liveChat.addEventListener("touchcancel", finishHistoryTouch, { passive: true });
  liveChat.addEventListener("wheel", event => {
    if (!repliesExpanded && Math.abs(event.deltaY) > 0 && !event.target?.closest?.("button")) showReplyHistory();
    armHistoryIdle();
  }, { passive: true });
  moreButton.onclick = () => {
    if (menuHold) closeMenu();
    else { openMenu(); if (isOwner) void openActivity(); }
  };
  moreMenu.querySelector(".story-focus-replies").onclick = () => { closeMenu(); showReplyHistory(); };
  const saveButton = moreMenu.querySelector(".story-save");
  if (saveButton) saveButton.onclick = async () => {
    try {
      await onSave?.();
      saveButton.textContent = story.savedToProfile ? "Remove from profile" : "Save to profile";
      toast(story.savedToProfile ? "Saved to your profile" : "Removed from your profile");
      closeMenu();
    } catch (error) { toast(error.message || "Story could not be saved."); }
  };
  const deleteButton = moreMenu.querySelector(".story-delete");
  if (deleteButton) deleteButton.onclick = async () => {
    closeMenu();
    await onDelete?.();
  };
  const pointAt = element => { const box = view.getBoundingClientRect(), r = element.getBoundingClientRect(); return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2]; };
  const saveReaction = async emoji => {
    if (!story.cloud) { toast("This Story is not available online for reactions."); return; }
    if (reactionPending) return;
    reactionPending = true;
    heartButton.setAttribute("aria-busy", "true");
    const previous = story.viewerReaction || null;
    try {
      if (previous === emoji) {
        await api.removeCloudStoryReaction(story.id);
        story.viewerReaction = null;
      } else {
        await api.setCloudStoryReaction(story.id, emoji);
        story.viewerReaction = emoji;
      }
      if (disposed) return;
      updateReactionState();
      burst.spawn(...pointAt(heartButton), emoji);
    } catch (error) {
      story.viewerReaction = previous;
      updateReactionState();
      toast(error.message || "Your reaction could not be sent.");
    } finally { reactionPending = false; heartButton.removeAttribute("aria-busy"); }
  };
  heartButton.onclick = () => { void saveReaction("❤️"); };
  reactionButton.onclick = () => {
    closeMenu();
    reactionPicker.hidden = !reactionPicker.hidden;
    reactionButton.setAttribute("aria-expanded", String(!reactionPicker.hidden));
  };
  reactionPicker.querySelectorAll("button").forEach(button => button.onclick = () => {
    hideReactions();
    void saveReaction(button.dataset.reaction);
  });
  shareButton.onclick = async () => {
    shareButton.disabled = true;
    try {
      const result = await onShare?.();
      if (result === "copied") toast("Story link copied");
      else if (result === "failed") toast("Story link could not be shared or copied.");
    } catch (error) { toast(error.message || "Story could not be shared."); }
    finally { shareButton.disabled = false; }
  };
  compose.onsubmit = async event => {
    event.preventDefault();
    try {
      const body = validateStoryComment(field.value);
      sendButton.disabled = true;
      const comment = await api.sendCloudStoryComment(story.id, body);
      story.comments = [...(story.comments || []).filter(item => item.id !== comment.id), comment].slice(-200);
      field.value = "";
      syncComposer();
      liveChat.classList.remove("has-error");
      renderReplies();
    } catch (error) { toast(error.message || "Reply could not be sent."); }
    finally { sendButton.disabled = false; }
  };

  const closeActivity = () => {
    if (!activityPanel) return;
    activityPanel.remove(); activityPanel = null; pauser.release();
    optionsPanel.hidden = false;
    activityButton?.setAttribute("aria-selected", "false");
    optionsButton.setAttribute("aria-selected", "true");
  };
  const openActivity = async () => {
    if (!isOwner || activityPanel) return;
    if (!menuHold) openMenu();
    hideReactions(); pauser.hold();
    optionsPanel.hidden = true;
    activityButton.setAttribute("aria-selected", "true");
    optionsButton.setAttribute("aria-selected", "false");
    activityPanel = doc.createElement("section");
    const panel = activityPanel;
    activityPanel.className = "story-insights";
    activityPanel.setAttribute("role", "tabpanel");
    activityPanel.setAttribute("aria-label", "Story activity");
    activityPanel.innerHTML = `<span class="story-insights-summary" aria-live="polite">Loading…</span><ul class="story-insights-list"></ul>`;
    moreMenu.append(activityPanel);
    const list = activityPanel.querySelector(".story-insights-list");
    try {
      const activity = await api.loadCloudStoryActivity(story.id);
      if (activityPanel !== panel || disposed) return;
      const summary = activityPanel.querySelector(".story-insights-summary");
      const ownReaction = isOwner && story.viewerReaction ? ` · You: ${story.viewerReaction}` : "";
      summary.textContent = `${activity.viewCount} ${activity.viewCount === 1 ? "view" : "views"} · ${activity.reactionCount} ${activity.reactionCount === 1 ? "reaction" : "reactions"}${ownReaction}`;
      if (!activity.viewers.length) {
        const empty = doc.createElement("li"); empty.className = "story-insights-empty"; empty.textContent = "No views yet."; list.append(empty);
      }
      for (const viewer of activity.viewers) {
        const row = doc.createElement("li"); row.className = "story-insights-person";
        const user = api.user(viewer.id), avatar = doc.createElement("img");
        avatar.alt = ""; avatar.src = user?.avatar || ""; avatar.onerror = () => { avatar.hidden = true; };
        const identity = doc.createElement("span"); identity.className = "story-insights-identity";
        const name = doc.createElement("b"); name.textContent = viewer.displayName;
        const handle = doc.createElement("small"); handle.textContent = `@${viewer.username}`;
        identity.append(name, handle); row.append(avatar, identity);
        const reaction = doc.createElement("span"); reaction.className = "story-insights-reaction";
        reaction.textContent = viewer.reaction || "Viewed";
        reaction.classList.toggle("has-reaction", !!viewer.reaction);
        row.append(reaction); list.append(row);
      }
    } catch (error) {
      if (activityPanel !== panel || disposed) return;
      const summary = activityPanel.querySelector(".story-insights-summary");
      summary.textContent = "We couldn't load views. Please try again.";
      const retry = doc.createElement("button");
      retry.type = "button"; retry.className = "story-more-item";
      retry.textContent = "Try again";
      retry.onclick = () => { closeActivity(); void openActivity(); };
      const item = doc.createElement("li"); item.append(retry); list.append(item);
    }
  };
  activityButton?.addEventListener("click", openActivity);
  optionsButton.onclick = closeActivity;
  moreMenu.querySelector(".story-panel-close").onclick = () => { closeMenu(); moreButton.focus({preventScroll:true}); };
  const panelHead = moreMenu.querySelector(".story-panel-head");
  const startPanelSwipe = event => { panelTouchY = event.touches?.[0]?.clientY ?? null; };
  const finishPanelSwipe = event => {
    if (panelTouchY !== null && (event.changedTouches?.[0]?.clientY ?? panelTouchY) - panelTouchY > 40) closeMenu();
    panelTouchY = null;
  };
  for (const handle of [panelHead, moreMenu.querySelector(".story-panel-handle")]) {
    handle.addEventListener("touchstart", startPanelSwipe, { passive:true });
    handle.addEventListener("touchend", finishPanelSwipe, { passive:true });
    handle.addEventListener("touchcancel", () => { panelTouchY = null; }, { passive:true });
  }
  const panelEscape = event => { if (menuHold && event.key === "Escape") { event.stopPropagation(); closeMenu(); moreButton.focus({preventScroll:true}); } };
  view.addEventListener("keydown", panelEscape);
  const media = view.querySelector(".story-stage");
  const pressPause = createPressPause({ hold: () => pauser.hold(), release: () => pauser.release(), setTimer: win.setTimeout.bind(win), clearTimer: win.clearTimeout.bind(win) });
  const pointerDown = event => {
    if (isIgnoredTap(event.target)) return;
    pressPause.start(event);
    try { if (media?.setPointerCapture && event.pointerId !== undefined) media.setPointerCapture(event.pointerId); } catch {}
  };
  const pointerMove = event => pressPause.move(event);
  const pointerEnd = event => pressPause.end(event);
  const pointerCancel = event => pressPause.cancel(event);
  const tap = event => {
    if (isIgnoredTap(event.target)) return;
    if (pressPause.consumeClick()) return;
    if (menuHold) { closeMenu(); return; }
    closeMenu();
    hideReactions();
    const box = view.getBoundingClientRect(); burst.spawn(event.clientX - box.left, event.clientY - box.top);
  };
  media?.addEventListener("pointerdown", pointerDown);
  media?.addEventListener("pointermove", pointerMove);
  media?.addEventListener("pointerup", pointerEnd);
  media?.addEventListener("pointercancel", pointerCancel);
  media?.addEventListener("lostpointercapture", pointerCancel);
  media?.addEventListener("click", tap);
  return {
    burst,
    closeSheet: closeMenu,
    dispose() {
      disposed = true;
      mentionCleanup();
      if (pollTimer) win.clearInterval(pollTimer);
      if (historyIdleTimer) win.clearTimeout(historyIdleTimer);
      if (menuCloseTimer) win.clearTimeout(menuCloseTimer);
      if (replyHold) { replyHold = false; pauser.release(); }
      if (historyHold) { historyHold = false; pauser.release(); }
      if (menuHold) { menuHold = false; pauser.release(); }
      for (const id of new Set([...replyTimers.keys(), ...fadeTimers.keys()])) clearReplyTimers(id);
      closeActivity(); pressPause.dispose(); burst.dispose(); pauser.reset();
      view.removeEventListener("keydown", panelEscape);
      media?.removeEventListener("pointerdown", pointerDown); media?.removeEventListener("pointermove", pointerMove);
      media?.removeEventListener("pointerup", pointerEnd); media?.removeEventListener("pointercancel", pointerCancel);
      media?.removeEventListener("lostpointercapture", pointerCancel); media?.removeEventListener("click", tap); bar.remove(); moreMenu.remove(); sideActions.remove(); liveChat.remove(); layer.remove();
    },
    isPaused: () => pauser.active(),
  };
}
