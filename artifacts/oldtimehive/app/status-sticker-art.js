// Draws Status stickers into a canvas (preview, image export and every video export frame).
// All sticker families preserve the uploaded original art, including expanded answers.
import { STICKER_LABELS, STICKER_JOIN, ART_SIZE } from "./status-sticker-editor.js";

const assetUrl = make => { try { return make(); } catch { return ""; } };
// Original uploaded artwork, edge-connected black removed (IM7 alpha floodfill), baked brand words masked
// with the art's own sampled gradient. Editable wording is drawn back into those holes below.
export const STICKER_ART = {
  questions: assetUrl(() => new URL("./assets/status-stickers/questions.png", import.meta.url).href),
  trendsetters: assetUrl(() => new URL("./assets/status-stickers/trendsetters.png", import.meta.url).href),
  "hey-world": assetUrl(() => new URL("./assets/status-stickers/hey-world.png", import.meta.url).href),
};
// Text holes as fractions of the art box: [x0, y0, x1, y1].
export const ART_HOLES = {
  questions: { main: [.177, .343, .868, .502], sub: [.222, .502, .856, .600] },
  trendsetters: { main: [.322, .601, .730, .712], join: [.293, .778, .728, .892] },
  "hey-world": { main: [.263, .591, .789, .682], join: [.286, .728, .719, .846] },
};
const PALETTE = { white: "#fbfaff", ink: "#16141c", purple: "#6a3fd8", purpleSoft: "#efe9fd", muted: "#5d5870" };
const art = new Map(); // kind -> { img, ready, failed }


/** Starts (or reuses) loading of sticker art. Resolves when loaded or failed; never rejects. */
export function loadStickerArt(kinds = Object.keys(STICKER_ART), { required = false } = {}) {
  kinds = [...new Set(kinds.map(kind => kind === "answer" ? "questions" : kind))];
  if (typeof Image === "undefined") return Promise.resolve();
  return Promise.all(kinds.filter(k => STICKER_ART[k]).map(kind => {
    let entry = art.get(kind);
    if (!entry) {
      const img = new Image();
      img.decoding = "async";
      entry = { img, ready: false, failed: false };
      entry.promise = new Promise(resolve => {
        img.onload = () => { entry.ready = true; resolve(); };
        img.onerror = () => { entry.failed = true; resolve(); };
      });
      img.src = STICKER_ART[kind];
      art.set(kind, entry);
    }
    return entry.promise;
  })).then(() => {
    if (required && kinds.some(kind => !art.get(kind)?.ready)) throw new Error("Couldn't load the sticker artwork. Your Status is still here; try again.");
  });
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Word-wraps into at most maxLines; shrinks font down to minSize first, then ellipsizes. */
function fitText(ctx, value, maxWidth, maxLines, size, minSize, weight = 800) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  for (let s = size; s >= minSize; s -= 1) {
    ctx.font = `${weight} ${s}px Manrope, system-ui, sans-serif`;
    const lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) line = next;
      else { if (line) lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxWidth)) return { lines, size: s, truncated: false };
    if (s === minSize) {
      const kept = lines.slice(0, maxLines);
      let last = kept[kept.length - 1] || "";
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      if (lines.length > maxLines || last !== kept[kept.length - 1]) kept[kept.length - 1] = `${last.trimEnd()}…`;
      return { lines: kept, size: s, truncated: true };
    }
  }
  return { lines: [], size: minSize };
}

function drawLines(ctx, { lines, size }, cx, top, color, lineHeight = 1.18) {
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, cx, top + i * size * lineHeight));
  return lines.length * size * lineHeight;
}

function drawAnswer(ctx, s, w, h, u) {
  const entry = art.get("questions");
  if (!entry?.ready) return;
  // Extend only the card's empty middle areas. The crown, logo, rounded ends
  // and signature stay at their original proportions instead of stretching.
  const nw = 631, nh = 578, targetHeight = Math.max(760, nw * h / w);
  const scale = Math.min(w / nw, h / targetHeight), extra = targetHeight - nh;
  const answered = Boolean(String(s.answer || "").trim());
  const questionExtra = extra * (answered ? .45 : 1), answerExtra = extra - questionExtra;
  ctx.save();
  ctx.translate(-nw * scale / 2, -targetHeight * scale / 2); ctx.scale(scale, scale);
  for (const [sy, sh, dy, dh] of [
    [0, 320, 0, 320], [320, 1, 320, 1 + questionExtra],
    [321, 98, 321 + questionExtra, 98], [419, 1, 419 + questionExtra, 1 + answerExtra],
    [420, 158, 420 + extra, 158],
  ]) ctx.drawImage(entry.img, 0, sy, nw, sh, 0, dy, nw, dh);
  // Replace the old "Type something" / send artwork only inside its field.
  ctx.save();
  ctx.translate(330, 428 + questionExtra + answerExtra / 2); ctx.rotate(-5 * Math.PI / 180);
  roundRect(ctx, -277, -(155 + answerExtra) / 2, 554, 155 + answerExtra, 65);
  ctx.fillStyle = answered ? "#d7d7e0" : "#f0eff5"; ctx.fill(); ctx.restore();
  const block = (value, x, y, width, height, size, weight, color) => {
    ctx.save(); ctx.translate(x + width / 2, y + height / 2); ctx.rotate(-5 * Math.PI / 180);
    ctx.beginPath(); ctx.rect(-width / 2, -height / 2, width, height); ctx.clip();
    const fitted = fitHole(ctx, value, width * .94, height * .9, size, 12, weight);
    ctx.font = `${weight} ${fitted.size}px Manrope, system-ui, sans-serif`;
    drawLines(ctx, fitted, 0, -fitted.lines.length * fitted.size * 1.18 / 2, color);
    ctx.restore();
  };
  block(s.title || "Your question", 100, 202, 460, 45, 32, 800, PALETTE.ink);
  block(s.prompt, 92, 250, 465, answered ? 90 + questionExtra : 235 + extra, 33, 700, PALETTE.ink);
  if (answered) block(s.answer, 88, 368 + questionExtra, 475, 110 + answerExtra, 36, 700, PALETTE.ink);
  ctx.restore();
  void u;
}

/** Lines that fit the hole: shrink first, then ellipsize. Line count follows the hole height. */
function fitHole(ctx, value, hw, hh, size, min, weight) {
  for (let s0 = size; s0 >= min; s0 -= 1) {
    const lines = Math.max(1, Math.floor(hh / (s0 * 1.15)));
    const f = fitText(ctx, value, hw, lines, s0, s0, weight);
    if (!f.truncated || s0 === min) return f;
  }
  return fitText(ctx, value, hw, 1, min, min, weight);
}
function holeText(ctx, hole, box, value, color, weight, maxSize, tilt = 0) {
  const [x0, y0, x1, y1] = hole, { left, top, iw, ih } = box;
  const hx = left + x0 * iw, hy = top + y0 * ih, hw = (x1 - x0) * iw, hh = (y1 - y0) * ih;
  ctx.save();
  ctx.translate(hx + hw / 2, hy + hh / 2);
  ctx.rotate(tilt * Math.PI / 180);
  ctx.beginPath(); ctx.rect(-hw / 2, -hh / 2, hw, hh); ctx.clip();
  const f = fitHole(ctx, value, hw * .96, hh * .92, Math.min(maxSize, hh * .78), Math.max(6, hh * .2), weight);
  const th = f.lines.length * f.size * 1.15;
  ctx.font = `${weight} ${f.size}px Manrope, system-ui, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "top";
  f.lines.forEach((l, i) => ctx.fillText(l, 0, -th / 2 + i * f.size * 1.15 + f.size * .04));
  ctx.restore();
}
/** Full original art aspect-fit (contain) into the sticker box; no card, no header. */
export function artBox(kind, w, h) {
  const [aw, ah] = ART_SIZE[kind] || [1, 1], k = Math.min(w / aw, h / ah);
  const iw = aw * k, ih = ah * k;
  return { left: -iw / 2, top: -ih / 2, iw, ih };
}
export function stickerWording(s) {
  const joined = [s.title, s.prompt].map(v => String(v || "").trim()).filter(Boolean).join(" · ");
  if (s.kind === "questions") {
    const title = String(s.title || "").trim(), prompt = String(s.prompt || "").trim();
    return { main: title || prompt || "Ask me anything", sub: title && prompt !== title ? prompt : "Drop a question…" };
  }
  return { main: joined || STICKER_LABELS[s.kind], join: STICKER_JOIN };
}
function drawArt(ctx, s, w, h) {
  const box = artBox(s.kind, w, h), entry = art.get(s.kind), words = stickerWording(s), holes = ART_HOLES[s.kind];
  if (entry?.ready && entry.img.naturalWidth) ctx.drawImage(entry.img, box.left, box.top, box.iw, box.ih);
  else { // art still loading: name only, inside the same box (no card)
    holeText(ctx, [0, .3, 1, .6], box, STICKER_LABELS[s.kind], "#ffffff", 800, 60);
    return;
  }
  if (s.kind === "questions") {
    holeText(ctx, holes.main, box, words.main, "#16141c", 800, box.iw * .10, -5);
    holeText(ctx, holes.sub, box, words.sub, "#6b6878", 600, box.iw * .063, -5);
  } else {
    const scale = box.iw / ART_SIZE[s.kind][0], tilt = s.kind === "hey-world" ? 4 : 0;
    holeText(ctx, holes.main, box, words.main, s.kind === "trendsetters" ? "#f3f1fb" : "#16141c", 800, 46 * scale, tilt);
    holeText(ctx, holes.join, box, words.join, s.kind === "trendsetters" ? "#16141c" : "#6a3fd8", 800, 54 * scale, tilt);
  }
}

/**
 * drawStatusStickers(canvasOrCtx, stickers, width, height, { selectedId })
 * Draws in canvas pixel space (identity transform). selectedId adds a thin outline (preview only).
 */
export function drawStatusStickers(target, stickers = [], width, height, { selectedId = null } = {}) {
  const ctx = target?.getContext ? target.getContext("2d") : target;
  if (!ctx || !stickers?.length) return;
  const W = width ?? ctx.canvas?.width, H = height ?? ctx.canvas?.height;
  const u = W / 540;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.filter = "none";
  for (const s of stickers) {
    const w = s.width * W, h = s.height * H;
    ctx.save();
    ctx.translate(s.x * W, s.y * H); ctx.rotate(s.rotation * Math.PI / 180);
    if (s.kind === "answer") {
      drawAnswer(ctx, s, w, h, u);
    } else drawArt(ctx, s, w, h); // transparent original art only
    if (selectedId && s.id === selectedId) {
      ctx.setLineDash([10 * u, 7 * u]); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = "#ffffff";
      roundRect(ctx, -w / 2 - 6 * u, -h / 2 - 6 * u, w + 12 * u, h + 12 * u, 26 * u); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
