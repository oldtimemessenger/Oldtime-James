import { requestCloudApi } from "./store.js";
import { hasSeenHelp, readHelpState, recordHelpChoice } from "./help-prompts.js";

const FEED_CATEGORIES = new Set(["welcome", "feature", "community", "creator"]);
const MAX_CARDS = 1;
const ANNOUNCEMENT_GAP_MS = 72 * 60 * 60 * 1000;
const CACHE_TTL = 60_000;
let cacheAccountId = null;
let cachedAt = 0;
let cachedAnnouncements = null;
let pendingLoad = null;
let pendingAccountId = null;
let activeAccountId = null;
let activeCardIds = new Set();
let activeObserver = null;
const recordedViews = new Set();
let helpWriteQueue = Promise.resolve();

export function selectCommunityAnnouncementCards(announcements, state, now = Date.now()) {
  const lastShownAt = Number(state?.lastShownAt);
  if (Number.isFinite(lastShownAt) && lastShownAt > 0 && now - lastShownAt < ANNOUNCEMENT_GAP_MS) return [];
  return (Array.isArray(announcements) ? announcements : [])
    .filter(item => item
      && item.optional === true
      && item.enabled !== false
      && FEED_CATEGORIES.has(item.category)
      && typeof item.id === "string"
      && /^[a-z0-9-]{1,80}$/.test(item.id)
      && typeof item.title === "string"
      && item.title.trim()
      && typeof item.description === "string"
      && item.description.trim()
      && typeof item.primaryRoute === "string"
      && typeof item.primaryLabel === "string"
      && !hasSeenHelp(state, item.id))
    .slice(0, MAX_CARDS);
}

export function setCommunityAnnouncementCards(accountId, ids) {
  if (activeAccountId !== accountId) {
    activeAccountId = accountId;
  }
  activeCardIds = new Set(ids);
}

export function hasCommunityAnnouncementCard(accountId, id) {
  return activeAccountId === accountId && activeCardIds.has(id);
}

function loadAnnouncements(accountId, force = false) {
  if (cacheAccountId !== accountId) {
    cacheAccountId = accountId;
    cachedAt = 0;
    cachedAnnouncements = null;
    pendingLoad = null;
    pendingAccountId = null;
    recordedViews.clear();
  }
  if (!force && cachedAnnouncements && Date.now() - cachedAt < CACHE_TTL) {
    return Promise.resolve(cachedAnnouncements);
  }
  if (pendingLoad && pendingAccountId === accountId) return pendingLoad;
  pendingAccountId = accountId;
  pendingLoad = requestCloudApi("/api/announcements")
    .then(result => {
      if (!Array.isArray(result?.announcements)) throw new Error("Official updates are unavailable.");
      if (cacheAccountId === accountId) {
        cachedAnnouncements = result.announcements;
        cachedAt = Date.now();
      }
      return result.announcements;
    })
    .finally(() => {
      if (pendingAccountId === accountId) {
        pendingLoad = null;
        pendingAccountId = null;
      }
    });
  return pendingLoad;
}

function iconFor(item, icons) {
  if (item.category === "community") return icons.users || icons.home || "";
  if (item.category === "creator") return icons.video || icons.home || "";
  if (item.category === "feature") return icons.video || icons.home || "";
  return icons.home || "";
}

function categoryLabel(category) {
  return ({ welcome: "Welcome", feature: "Feature", community: "Community", creator: "Creator" })[category] || "Update";
}

export function renderCommunityAnnouncementCard(item, { esc, icons = {}, baseUrl = "/" }) {
  const label = categoryLabel(item.category);
  const featureIcon = iconFor(item, icons);
  const image = item.category === "creator" ? "creator.jpg" : "community.jpg";
  const assetBase = `${String(baseUrl || "/").replace(/\/?$/, "/")}announcements/`;
  return `<article class="community-announcement-card" data-announcement-card="${esc(item.id)}">
    <div class="community-announcement-visual" data-category="${esc(item.category)}">
      <img class="community-announcement-image" src="${esc(`${assetBase}${image}`)}" alt="" loading="lazy" decoding="async" />
      <span class="community-announcement-visual-label">Official Oldtime update</span>
      <button type="button" class="community-announcement-dismiss" data-announcement-dismiss="${esc(item.id)}" aria-label="Dismiss this update">${icons.close || "×"}</button>
    </div>
    <div class="community-announcement-copy">
      <div class="community-announcement-meta-row">
        <span class="community-announcement-category-icon" data-category="${esc(item.category)}" aria-hidden="true">${featureIcon}</span>
        <p class="community-announcement-meta">${esc(label)} · Oldtime</p>
      </div>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.description)}</p>
      <footer class="community-announcement-footer">
        <span class="community-announcement-brand">OLDTIME</span>
        <button type="button" class="community-announcement-action" data-announcement-action="${esc(item.id)}">${esc(item.primaryLabel)}</button>
      </footer>
    </div>
  </article>`;
}

function recordImpression(accountId, item) {
  const key = `${accountId}:${item.id}`;
  if (recordedViews.has(key)) return;
  recordedViews.add(key);
  requestCloudApi(`/api/announcements/${encodeURIComponent(item.id)}/event`, {
    method: "POST",
    body: { event: "shown" },
  }).catch(() => {});
  if (!readHelpState(accountId)) return;
  helpWriteQueue = helpWriteQueue
    .then(() => recordHelpChoice(accountId, item.id, "shown"))
    .catch(() => {});
}

export function mountCommunityAnnouncementCards(slot, {
  accountId, esc, icons, baseUrl = "/", navigate, toast = () => {}, hasCommunityPosts = false,
} = {}) {
  if (!slot || typeof accountId !== "string" || !accountId) return;
  activeObserver?.disconnect();
  const retry = async () => {
    slot.innerHTML = "";
    try {
      const announcements = await loadAnnouncements(accountId, true);
      if (!slot.isConnected) return;
      const cards = selectCommunityAnnouncementCards(announcements, readHelpState(accountId));
      setCommunityAnnouncementCards(accountId, cards.map(item => item.id));
       slot.innerHTML = cards.map(item => renderCommunityAnnouncementCard(item, { esc, icons, baseUrl })).join("");
      bindCards(cards);
    } catch {
      if (!slot.isConnected) return;
      slot.innerHTML = `<div class="community-announcement-error" role="status">Official updates couldn’t load. <button type="button" data-announcement-retry>Try again</button></div>`;
      slot.querySelector("[data-announcement-retry]")?.addEventListener("click", retry, { once: true });
    }
  };
  const bindCards = cards => {
    const cardById = new Map(cards.map(item => [item.id, item]));
    slot.querySelectorAll("[data-announcement-action]").forEach(button => {
      button.addEventListener("click", async () => {
        const item = cardById.get(button.dataset.announcementAction);
        if (!item || button.disabled) return;
        button.disabled = true;
        await Promise.allSettled([
          requestCloudApi(`/api/announcements/${encodeURIComponent(item.id)}/event`, {
            method: "POST", body: { event: "action" },
          }),
          recordHelpChoice(accountId, item.id, "action"),
        ]);
        navigate?.(item.primaryRoute);
      });
    });
    slot.querySelectorAll("[data-announcement-dismiss]").forEach(button => {
      button.addEventListener("click", async () => {
        const item = cardById.get(button.dataset.announcementDismiss);
        const card = button.closest("[data-announcement-card]");
        if (!item || !card || button.disabled) return;
        button.disabled = true;
        try {
          await requestCloudApi(`/api/announcements/${encodeURIComponent(item.id)}/dismiss`, {
            method: "POST", body: { choice: "not-now" },
          });
          card.remove();
          if (slot.isConnected && !hasCommunityPosts && !slot.querySelector("[data-announcement-card]")) {
            slot.hidden = true;
          }
        } catch {
          button.disabled = false;
          toast("This update couldn’t be dismissed. Try again when you’re online.");
        }
      });
    });
    if (typeof IntersectionObserver === "function") {
      activeObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const item = cardById.get(entry.target.dataset.announcementCard);
          if (item) recordImpression(accountId, item);
          activeObserver?.unobserve(entry.target);
        }
      }, { root: slot.closest(".stories-feed-scroll"), threshold: 0.25 });
      slot.querySelectorAll("[data-announcement-card]").forEach(card => activeObserver.observe(card));
    }
  };
  void retry();
}
