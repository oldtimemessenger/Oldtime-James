import { tipIllustration } from "./tip-illustrations.js";
const art = topic => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(tipIllustration(topic))}`;
export const oldTimeArt = {
  insights: { src: art("analytics"), alt: "Account analytics" },
  badge: { src: art("membership"), alt: "Blue Badge membership" }
};
export const escHtml = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function artImg(kind, cls = "hc-art", decorative = false) {
  const a = oldTimeArt[kind] || (!kind ? oldTimeArt.insights : null);
  if (!a) return "";
  return `<img class="${cls}" src="${escHtml(a.src)}" alt="${decorative ? "" : escHtml(a.alt)}" loading="lazy">`;
}
const ILL = { insights: "Oldtime stopwatch beside a red glass graph and a feather", badge: "Oldtime Blue Badge" };
const FILES = { insights: "oldtime-insights.png", badge: "oldtime-blue-badge.png" };
export function illustration(name, cls = "hc-art") {
  if (!ILL[name]) return "";
  return artImg(name, cls);
}
