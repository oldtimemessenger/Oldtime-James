// Picture overlays for Status collages: pure helpers (no DOM). Layers are the renderer's "image" layers:
// center x/y normalized, width/height in project px (aspect kept), scale and rotation applied by drawProject.
export const MAX_OVERLAYS = 6;
export const OVERLAY_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const OVERLAY_ACCEPT = OVERLAY_TYPES.join(",");
export const isOverlayFile = file => OVERLAY_TYPES.includes(String(file?.type || "").toLowerCase());
export const overlayLayers = layers => (layers || []).filter(l => l.kind === "image" && l.statusOverlay);
export const overlaySlots = layers => Math.max(0, MAX_OVERLAYS - overlayLayers(layers).length);

/** Size that keeps the picture's aspect ratio and fits inside ~55% of the frame width / 40% of its height. */
export function overlaySize(naturalWidth, naturalHeight, projectWidth, projectHeight) {
  const w = Math.max(1, Number(naturalWidth) || 1), h = Math.max(1, Number(naturalHeight) || 1);
  const k = Math.min(projectWidth * .55 / w, projectHeight * .4 / h);
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

/** Staggered start position so several new pictures never stack exactly. */
export function overlayPosition(index) {
  const spots = [[.5, .4], [.32, .3], [.68, .3], [.32, .62], [.68, .62], [.5, .74]];
  const [x, y] = spots[index % spots.length];
  return { x, y };
}

/** Point (normalized) inside the layer's transformed (scaled + rotated) bounds. */
export function pointInOverlay(layer, px, py, projectWidth, projectHeight, pad = 0) {
  const dx = (px - layer.x) * projectWidth, dy = (py - layer.y) * projectHeight;
  const r = -(layer.rotation || 0) * Math.PI / 180, k = layer.scale || 1;
  const lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
  return Math.abs(lx) <= (layer.width || 480) * k / 2 + pad && Math.abs(ly) <= (layer.height || 480) * k / 2 + pad;
}

/** Topmost overlay picture under the point (later layers draw on top). */
export function hitOverlay(layers, px, py, projectWidth, projectHeight) {
  const list = overlayLayers(layers);
  for (let i = list.length - 1; i >= 0; i--) if (pointInOverlay(list[i], px, py, projectWidth, projectHeight, 8)) return list[i];
  return null;
}

export function scaleOverlay(layer, factor) { layer.scale = Math.min(4, Math.max(.2, (layer.scale || 1) * factor)); return layer; }
export function moveOverlay(layer, dx, dy) {
  layer.x = Math.min(1, Math.max(0, layer.x + dx)); layer.y = Math.min(1, Math.max(0, layer.y + dy)); return layer;
}

/** Index to insert a new overlay: above earlier pictures, below the drawing and the Status text. */
export function overlayInsertIndex(layers) {
  const i = (layers || []).findIndex(l => l.kind === "drawing" || (l.kind === "text"));
  return i < 0 ? (layers || []).length : i;
}
