import "./repost-affordance.css";
import { api } from "./store.js";
import { icon } from "./icons.js";

const PROMPTS = ["Your take?", "Add a reaction?", "Worth a repost?"];
const KIND_PROMPTS = { shared: "Add your take?", copied: "Add a thought?", reposted: "Edit your note?" };
const COOLDOWN = 60000;
let observer = null, lastPrompt = 0;
const timers = new Set();
const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
const note = (post, id) => String(post?.repostNotes?.[id] || "").trim().slice(0, 140);

function pick(post) {
  const me = api.me();
  const ids = [...new Set(Array.isArray(post?.reposts) ? post.reposts : [])];
  if (me && ids.includes(me.id)) return { mine: true, user: me };
  for (const id of ids) {
    if (id === me?.id) continue;
    const u = api.user(id);
    if (u && api.canSee(id)) return { mine: false, user: u };
  }
  return null;
}

export function renderRepostAffordance(post, { esc }) {
  if (!post?.id) return "";
  const me = api.me(), found = pick(post);
  const user = found?.user || me;
  if (!user) return "";
  const text = found ? note(post, user.id) : "";
  const name = user.name || user.username || "member";
  let bubble = "";
  if (text && found.mine) bubble = `<button type="button" class="rp-bubble" data-repost="${esc(post.id)}" aria-label="Edit your repost note: ${esc(text)}"><span class="rp-text">${esc(text)}</span></button>`;
  else if (text) bubble = `<div class="rp-bubble rp-other"><span class="rp-text" data-rp-text>${esc(text)}</span><button type="button" class="rp-more" data-rn-read aria-expanded="false" aria-label="Read the full note from ${esc(name)}">Read</button></div>`;
  const face = !found
    ? `<button type="button" class="rp-face" data-repost="${esc(post.id)}" aria-label="Repost with note"><img src="${esc(me.avatar || "")}" alt=""><span class="rp-badge">${icon("repost")}</span></button>`
    : found.mine
      ? `<button type="button" class="rp-face" data-repost="${esc(post.id)}" aria-label="${text ? "Edit your repost note" : "Your repost. Add a note"}"><img src="${esc(user.avatar || "")}" alt=""><span class="rp-badge">${icon("repost")}</span></button>`
      : `<button type="button" class="rp-face" data-profile="${esc(user.id)}" aria-label="${esc(name)} reposted this post. View profile"><img src="${esc(user.avatar || "")}" alt=""><span class="rp-badge">${icon("repost")}</span></button>`;
  return `<div class="rp-aff${found ? "" : " rp-cta"}" data-rp-post="${esc(post.id)}" data-rp-note="${text ? "1" : ""}">${bubble}<button type="button" class="rp-prompt" data-repost="${esc(post.id)}" aria-label="Add a repost note" hidden><span></span></button>${face}</div>`;
}

function hidePrompt(aff) {
  const p = aff.querySelector(".rp-prompt");
  if (p) p.hidden = true;
  if (aff.classList.contains("rp-cta")) aff.classList.remove("rp-live");
}
function showPrompt(aff, label) {
  if (aff.dataset.rpNote) return false;
  const p = aff.querySelector(".rp-prompt");
  if (!p) return false;
  p.firstElementChild.textContent = label;
  p.hidden = false;
  aff.classList.add("rp-live");
  later(() => hidePrompt(aff), 4000);
  return true;
}

export function mountRepostAffordances(root) {
  observer?.disconnect(); observer = null;
  timers.forEach(clearTimeout); timers.clear();
  if (!root) return;
  const affs = [...root.querySelectorAll(".rp-aff")];
  affs.forEach(aff => aff.querySelector("[data-rn-read]")?.addEventListener("click", e => {
    const open = aff.classList.toggle("rp-open");
    e.currentTarget.setAttribute("aria-expanded", String(open));
    e.currentTarget.textContent = open ? "Less" : "Read";
  }));
  if (!affs.length || typeof IntersectionObserver === "undefined") return;
  const watch = new Map();
  observer = new IntersectionObserver(entries => entries.forEach(en => {
    const aff = en.target.__rp;
    if (!aff) return;
    clearTimeout(watch.get(aff)); watch.delete(aff);
    if (en.intersectionRatio < .65) { hidePrompt(aff); return; }
    if (aff.dataset.rpNote) return;
    watch.set(aff, later(() => {
      const video=aff.closest(".clip")?.querySelector("video");
      if(video&&(video.paused||video.readyState<2))return;
      if (document.hidden || root.querySelector(".sheet.on,.creative-editor,.app-drawer.on") || document.querySelector(".rn-overlay") || Date.now() - lastPrompt < COOLDOWN) return;
      if (showPrompt(aff, PROMPTS[Math.floor(Math.random() * PROMPTS.length)])) lastPrompt = Date.now();
    }, 3000));
  }), { threshold: [0, .65] });
  affs.forEach(aff => { const host = aff.closest(".clip") || aff.parentElement; if (host) { host.__rp = aff; observer.observe(host); } });
}

export function showRepostPrompt(root, postId, kind = "shared") {
  const aff = (root || document).querySelector(`.rp-aff[data-rp-post="${CSS.escape(String(postId))}"]`);
  if (!aff) return false;
  if (showPrompt(aff, KIND_PROMPTS[kind] || KIND_PROMPTS.shared)) { lastPrompt = Date.now(); return true; }
  return false;
}
