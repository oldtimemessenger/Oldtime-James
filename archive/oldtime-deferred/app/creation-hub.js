import "./creation-hub.css";
import { api } from "./store.js";
import { loadRecentPhotos } from "./creative-camera-recents.js";

let keyHandler = null;
let objectUrls = [];
let oldBodyOverflow = "";

export function closeCreationHub() {
  document.querySelector(".ch-back")?.remove();
  if (keyHandler) document.removeEventListener("keydown", keyHandler);
  keyHandler = null;
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
  document.body.style.overflow = oldBodyOverflow;
}

const fallbackIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>';
const actionIcon = (icons, name) => icons[name] || fallbackIcon;

export function openCreationHub(actions, icons = {}) {
  closeCreationHub();
  const fixedActions = [
    ["quote", "Quote", icons.edit],
    ["story", "Story", icons.timeCircle],
    ["blast", "Community", icons.comment],
    ["video", "Video note", icons.camera],
    ["challenge", "Challenges", icons.activity || icons.flag],
    ["event", "Events", icons.users],
    ["photo", "Main feed", icons.image]
  ];
  const availableActions = fixedActions.filter(([id]) =>
    id === "photo" ? typeof actions.media === "function" : typeof actions[id] === "function"
  );
  const primaryActions = [
    ["studio", "Oldtime Studio", icons.edit],
    ["camera", "Camera", icons.camera]
  ].filter(([id]) => typeof actions[id] === "function");
  const quickActions = availableActions.filter(([id]) => id === "quote");
  const shareActions = availableActions.filter(([id]) => id !== "quote");
  const button = ([id, label, glyph], className = "") =>
    `<button type="button" class="${className}" data-ch="${id}">${glyph || fallbackIcon}<span>${label}</span></button>`;

  const back = document.createElement("div");
  back.className = "ch-back";
  back.innerHTML = `
    <main class="ch-page" role="dialog" aria-modal="true" aria-labelledby="ch-title">
      <header class="ch-header">
        <button type="button" class="ch-close" data-ch-close aria-label="Close">${actionIcon(icons, "close")}</button>
        <h1 id="ch-title">Create post</h1>
        <span class="ch-header-spacer" aria-hidden="true"></span>
      </header>
      <div class="ch-scroll">
        <section class="ch-primary-actions" aria-label="Create with Oldtime">
          ${primaryActions.map(item => button(item, "ch-primary")).join("")}
        </section>
        ${quickActions.length ? `<section class="ch-quick-actions" aria-label="Quick actions">${quickActions.map(item => button(item, "ch-quick")).join("")}</section>` : ""}
        <section class="ch-recents-section" aria-labelledby="ch-recents-title">
          <div class="ch-section-heading">
            <h2 id="ch-recents-title">Recent on this device</h2>
            <span>Private to you</span>
          </div>
          <div class="ch-recents" data-ch-recents aria-live="polite">
            <p class="ch-empty">No recent photos yet. Choose Main feed below to pick a photo or video.</p>
          </div>
        </section>
        <section class="ch-share-section" aria-labelledby="ch-share-title">
          <div class="ch-section-heading"><h2 id="ch-share-title">More ways to share</h2></div>
          <div class="ch-action-grid">${shareActions.map(item => button(item, "ch-row")).join("")}</div>
        </section>
      </div>
      <input class="ch-file" data-ch-file type="file" accept="image/*,video/*" aria-label="Choose a photo or video">
    </main>`;
  document.body.appendChild(back);
  oldBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const pickMedia = () => back.querySelector("[data-ch-file]")?.click();
  back.addEventListener("click", event => {
    const close = event.target.closest("[data-ch-close]");
    if (close) { closeCreationHub(); return; }
    const target = event.target.closest("[data-ch]");
    if (!target) return;
    const id = target.dataset.ch;
    if (id === "photo") { pickMedia(); return; }
    closeCreationHub();
    actions[id]?.();
  });
  back.querySelector("[data-ch-file]")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const kind = file.type.startsWith("video/") ? "video" : "photo";
    closeCreationHub();
    actions.media(file, kind);
  });
  keyHandler = event => {
    if (event.key === "Escape") closeCreationHub();
  };
  document.addEventListener("keydown", keyHandler);
  back.querySelector(".ch-close")?.focus();

  const ownerId = api.me()?.id;
  if (ownerId) void loadRecentPhotos(ownerId).then(rows => {
    if (!back.isConnected) return;
    const list = back.querySelector("[data-ch-recents]");
    if (!list) return;
    if (!rows.length) return;
    list.replaceChildren();
    for (const row of rows) {
      const url = URL.createObjectURL(row.thumbnail);
      objectUrls.push(url);
      const recent = document.createElement("button");
      recent.type = "button";
      recent.className = "ch-recent";
      recent.setAttribute("aria-label", "Open a recent photo in the editor");
      recent.innerHTML = `<img alt="" loading="lazy"><span>${icons.check || ""}</span>`;
      recent.querySelector("img").src = url;
      recent.addEventListener("click", () => {
        closeCreationHub();
        actions.media(row.blob, "photo");
      }, { once: true });
      list.append(recent);
    }
  }).catch(() => {
    const list = back.querySelector("[data-ch-recents]");
    if (list) list.innerHTML = '<p class="ch-empty">Recent photos are unavailable. Choose Main feed below to pick a photo or video.</p>';
  });
}
