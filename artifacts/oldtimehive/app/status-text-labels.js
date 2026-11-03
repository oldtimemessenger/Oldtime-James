// Independent Status text labels: pure helpers (no DOM). Labels are renderer "text" layers marked statusLabel,
// positioned by normalized center x/y with scale + rotation applied by drawProject.
export const MAX_TEXT_LABELS = 12;
export const STATUS_CAPTION_MAX = 2000;

export const textLabels = layers => (layers || []).filter(l => l.kind === "text" && l.statusLabel);
export const labelText = l => String(l?.text || "").trim();
export const canAddLabel = layers => textLabels(layers).length < MAX_TEXT_LABELS;
/** An existing empty label (e.g. a just-opened draft) that can be reused instead of creating another. */
export const emptyDraft = layers => textLabels(layers).find(l => !labelText(l)) || null;

/** Keep the tap point inside the frame with a small margin so a new label is reachable. */
export function placementPoint(p) {
  const c = v => Math.min(.94, Math.max(.06, Number.isFinite(v) ? v : .5));
  return { x: c(p?.x), y: c(p?.y) };
}

/** Approximate rendered box in project px (unscaled). */
export function labelSize(layer) {
  const lines = Math.max(1, String(layer.text || " ").split("\n").length);
  const font = layer.fontSize || 64;
  // Unboxed labels use the full wrap width; estimate the visible width from character count instead.
  const est = Math.min(layer.width || 920, Math.max(font * 1.2, Math.max(...String(layer.text || " ").split("\n").map(s => s.length)) * font * .58 + 60));
  return { width: layer.backgroundOn ? (layer.width || est) : est, height: font * 1.3 * lines + 40 };
}

/** Point (normalized) inside the label's scaled + rotated bounds, aspect aware. */
export function pointInLabel(layer, px, py, W, H, pad = 18) {
  const { width, height } = labelSize(layer), k = layer.scale || 1;
  const dx = (px - layer.x) * W, dy = (py - layer.y) * H, r = -(layer.rotation || 0) * Math.PI / 180;
  const lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
  return Math.abs(lx) <= width * k / 2 + pad && Math.abs(ly) <= height * k / 2 + pad;
}

/** Topmost non-empty label under the point. */
export function hitTextLabel(layers, px, py, W, H) {
  const list = textLabels(layers).filter(labelText);
  for (let i = list.length - 1; i >= 0; i--) if (pointInLabel(list[i], px, py, W, H)) return list[i];
  return null;
}

/** Story body metadata: optional share text plus every non-empty label, within the caption limit. */
export function joinLabelText(layers, shareText = "", max = STATUS_CAPTION_MAX) {
  const parts = [String(shareText || "").trim(), ...textLabels(layers).map(labelText)].filter(Boolean);
  return parts.join("\n").slice(0, max);
}
