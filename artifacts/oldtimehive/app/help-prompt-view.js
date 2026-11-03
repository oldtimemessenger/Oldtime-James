import "./help-prompt-view.css";
import { tipIllustration } from "./tip-illustrations.js";

const TIP_FILES = new Set(["welcome.webp","cover.webp","friends.webp","blast.webp","note.webp",
  "communities.webp","saved.webp","privacy.webp","chat-privacy.webp","notifications.webp","safety.webp","interests.webp"]);
const LEGACY_TIP_FILES = {
  create:"studio.webp",connect:"friends.webp",discover:"interests.webp",
  messages:"chat-privacy.webp", "chat":"chat-privacy.webp"
};

function artworkFor(a) {
  const image = String(a?.image || "").split("/").pop().toLowerCase();
  const hint = `${a?.category || ""} ${a?.id || ""} ${a?.title || ""} ${image}`;
  if (/membership|blue-?badge/i.test(hint)) return { path:"guide/membership.webp", alt:"Blue Badge membership artwork" };
  const guideImage = `${String(a?.id || "").replace(/^help-/, "")}.webp`;
  if (TIP_FILES.has(guideImage)) return { path:`tips/${guideImage}`, alt:tipAlt(a) };
  if (TIP_FILES.has(image)) return { path:`tips/${image}`, alt:tipAlt(a) };
  const legacyName = image.replace(/\.(png|webp)$/i, "");
  const file = LEGACY_TIP_FILES[legacyName] || (/notification/i.test(hint) ? "notifications.webp" : /chat|message/i.test(hint) ? "chat-privacy.webp"
    : /privacy|safety/i.test(hint) ? "privacy.webp"
    : /friend|blast|communit|saved|connect/i.test(hint) ? "friends.webp"
     : /interest|discover|place/i.test(hint) ? "interests.webp" : "studio.webp");
  return { path:`tips/${file}`, alt:tipAlt(a) };
}

export function renderPromptCard(a, { esc, id, baseUrl = "" } = {}) {
  const art = artworkFor(a);
  void baseUrl;
  const scene = tipIllustration(art.path);
  const secondary = a.secondaryRoute
    ? `<button type="button" class="cta-secondary" data-cta="secondary-action">${esc(a.secondaryLabel || "More")}</button>` : "";
  const primary = a.primaryRoute
    ? `<button type="button" class="cta-primary" data-cta="action">${esc(a.primaryLabel || "Learn more")}</button>` : "";
  return `<section class="cta-modal hp-card" role="${a.local && !a.manual ? "region" : "dialog"}" ${a.local && !a.manual ? "" : 'aria-modal="true"'} aria-labelledby="${id}-t" aria-describedby="${id}-d" tabindex="-1">
    <div class="cta-top"><span class="cta-eyebrow">${esc(a.category || "Oldtime")}</span><button type="button" class="cta-x" data-cta="not-now" aria-label="Close">&times;</button></div>
    <div class="hp-art" role="img" aria-label="${esc(a.title || "Oldtime guide")}">${scene}</div>
    <h2 id="${id}-t">${esc(a.title)}</h2><p id="${id}-d">${esc(a.description || "")}</p>
    <div class="cta-err" role="alert" aria-live="assertive"></div>
    <div class="cta-actions">${primary}${secondary}
    <button type="button" class="cta-secondary" data-cta="not-now">Maybe later</button>
    <button type="button" class="cta-link" data-cta="never">Don't show again</button></div></section>`;
}
function tipAlt(a) {
  if (a?.imageAlt) return String(a.imageAlt);
  const id = String(a?.id || "");
  return `Guide artwork for ${String(a?.title || id.replace(/^help-/, "Oldtime"))}`;
}
