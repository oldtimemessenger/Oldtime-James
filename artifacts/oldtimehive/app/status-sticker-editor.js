// Status interactive stickers: pure model + geometry (no DOM). Shared by the editor, exporter and viewer.
// Coordinates are normalized to the 9:16 Status frame: x/y = center (0..1), width/height = fraction of W/H.
export const STICKER_KINDS = ["questions", "trendsetters", "hey-world", "answer"];
export const PICKER_KINDS = ["questions", "trendsetters", "hey-world"];
export const MAX_STICKERS = 4;
export const TITLE_MAX = 60;
export const PROMPT_MAX = 140;
export const ANSWER_MAX = 600;
export const ANSWER_PROMPT_MAX = 300; // original question text is preserved verbatim for answers
const promptMax = kind => kind === "answer" ? ANSWER_PROMPT_MAX : PROMPT_MAX;
export const MIN_WIDTH = .28;
export const MAX_WIDTH = .96;
export const STICKER_LABELS = { questions: "Questions", trendsetters: "Add Yours", "hey-world": "Add Yours", answer: "Answer" };
export const DEFAULT_PROMPTS = { questions: "Ask me anything", trendsetters: "Show us your take", "hey-world": "Say hello to the world", answer: "" };
export const STICKER_CTA = "Add Yours"; // native Add Yours sticker action
export const STICKER_JOIN = "Add Yours";
// Natural pixel size of the original transparent art (assets/status-stickers/*.png).
export const ART_SIZE = { questions: [631, 578], trendsetters: [900, 529], "hey-world": [601, 648], answer: [631, 850] };
// Default height (fraction of H) at width .7 in the 9:16 frame: the full art aspect-fits the hitbox exactly.
const artAspect = k => .7 * (ART_SIZE[k][1] / ART_SIZE[k][0]) * (9 / 16);
const ASPECT = { questions: artAspect("questions"), trendsetters: artAspect("trendsetters"), "hey-world": artAspect("hey-world"), answer: .24 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const text = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = v => typeof v === "string" && UUID.test(v);

export function stickerId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${h()}${h()}-${h()}-4${h().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${h().slice(1)}-${h()}${h()}${h()}`;
}

/** Clamp geometry so the sticker center stays inside the frame and size is sane. Height follows width. */
export function clampSticker(s) {
  const ratio = (s.height > 0 && s.width > 0) ? s.height / s.width : (ASPECT[s.kind] || .24) / .7;
  s.width = clamp(num(s.width, .7), MIN_WIDTH, MAX_WIDTH);
  s.height = clamp(s.width * ratio, .06, s.kind === "answer" ? .78 : .7);
  s.x = clamp(num(s.x, .5), .05, .95);
  s.y = clamp(num(s.y, .55), .05, .95);
  s.rotation = ((num(s.rotation, 0) % 360) + 540) % 360 - 180;
  return s;
}

export function createSticker(kind, values = {}) {
  if (!STICKER_KINDS.includes(kind)) throw new Error(`Unknown sticker kind: ${kind}`);
  const s = {
    id: isUuid(values.id) ? values.id : stickerId(), kind,
    title: text(values.title, TITLE_MAX),
    prompt: text(values.prompt ?? (kind === "answer" ? "" : DEFAULT_PROMPTS[kind]), promptMax(kind)),
    x: num(values.x, .5), y: num(values.y, .55), width: num(values.width, .7), height: num(values.height, ASPECT[kind]), rotation: num(values.rotation, 0),
  };
  if (kind === "answer") {
    s.answer = text(values.answer, ANSWER_MAX);
    if (values.height === undefined) s.height = answerStickerHeight(s);
    if (isUuid(values.questionId)) s.questionId = values.questionId;
  }
  if (isUuid(values.sourceStickerId)) s.sourceStickerId = values.sourceStickerId;
  return clampSticker(s);
}

/** Normalize seeds/drafts: valid kinds, one per kind, max 4, answer requires questionId. */
export function normalizeStickers(list = [], { answerQuestionId = null } = {}) {
  const out = [], seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw || !STICKER_KINDS.includes(raw.kind) || seen.has(raw.kind) || out.length >= MAX_STICKERS) continue;
    const values = raw.kind === "answer" && !isUuid(raw.questionId) && isUuid(answerQuestionId) ? { ...raw, questionId: answerQuestionId } : raw;
    if (raw.kind === "answer" && !isUuid(values.questionId)) continue;
    seen.add(raw.kind); out.push(createSticker(raw.kind, values));
  }
  return out;
}

export function canAddSticker(list, kind) {
  return PICKER_KINDS.includes(kind) && list.length < MAX_STICKERS && !list.some(s => s.kind === kind);
}

/** Adds a sticker in place (staggered so it never fully covers another). Returns the new sticker or null. */
export function addSticker(list, kind) {
  if (!canAddSticker(list, kind)) return null;
  const s = createSticker(kind, { y: clamp(.42 + list.length * .08, .2, .8) });
  list.push(s);
  return s;
}

export function removeSticker(list, id) {
  const i = list.findIndex(s => s.id === id);
  if (i >= 0) list.splice(i, 1);
  return i >= 0;
}

export function updateStickerText(s, { title, prompt, answer } = {}) {
  const previousHeight = s.kind === "answer" ? answerStickerHeight(s) : 0;
  if (title !== undefined) s.title = text(title, TITLE_MAX);
  if (prompt !== undefined && s.kind !== "answer") s.prompt = text(prompt, PROMPT_MAX); // answer prompt is read-only
  if (answer !== undefined && s.kind === "answer") s.answer = text(answer, ANSWER_MAX);
  if (s.kind === "answer" && answer !== undefined) s.height = clamp(s.height * answerStickerHeight(s) / previousHeight, .2, .78);
  return s;
}

export function answerStickerHeight(sticker) {
  const lines = Math.ceil(String(sticker.prompt || "").length / 45) + Math.ceil(String(sticker.answer || "").length / 45);
  return clamp((sticker.width || .75) * (9 / 16) * (780 + Math.min(400, lines * 26)) / 631, .38, .78);
}

export function questionAnswerSeed(question, title = "") {
  if (!isUuid(question?.id)) throw new Error("Choose a question from your private inbox.");
  return {
    initialStickers: [createSticker("answer", { questionId: question.id, title, prompt: question.body, answer: "", x: .5, y: .5, width: .78 })],
    answerQuestionId: question.id,
  };
}

export function resizeSticker(s, factor) {
  const ratio = s.height / s.width;
  s.width = clamp(s.width * factor, MIN_WIDTH, MAX_WIDTH);
  s.height = s.width * ratio;
  return clampSticker(s);
}

export function moveSticker(s, dx, dy) { s.x += dx; s.y += dy; return clampSticker(s); }

/** Normalized hitbox for viewers: center, size and rotation in degrees. */
export function stickerHitbox(s) {
  return { id: s.id, kind: s.kind, x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation };
}

/** Point (normalized) inside rotated sticker box? aspect = W/H of the frame (9/16). */
export function pointInSticker(s, px, py, aspect = 9 / 16, pad = 0) {
  const dx = (px - s.x) * aspect, dy = py - s.y; // work in H units
  const r = -s.rotation * Math.PI / 180;
  const lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
  return Math.abs(lx) <= s.width * aspect / 2 + pad && Math.abs(ly) <= s.height / 2 + pad;
}

/** Topmost sticker under the point. */
export function hitSticker(list, px, py, aspect = 9 / 16) {
  for (let i = list.length - 1; i >= 0; i--) if (pointInSticker(list[i], px, py, aspect, .01)) return list[i];
  return null;
}

/** Two-pointer gesture delta: midpoint translation, distance scale, angle rotation (degrees). */
export function pinchDelta(a0, b0, a1, b1) {
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const m0 = mid(a0, b0), m1 = mid(a1, b1);
  return { dx: m1.x - m0.x, dy: m1.y - m0.y, scale: dist(a1, b1) / dist(a0, b0), rotation: (ang(a1, b1) - ang(a0, b0)) * 180 / Math.PI };
}

/** Media transform used by the renderer: background.statusTransform = {x, y, scale}. */
export function clampMediaTransform(t = {}) {
  return { x: clamp(num(t.x, 0), -1, 1), y: clamp(num(t.y, 0), -1, 1), scale: clamp(num(t.scale, 1), .5, 4) };
}

/** Publish-safe copy (no editor-only fields). */
export function publishStickers(list = []) {
  return normalizeStickers(list).map(s => {
    const o = { id: s.id, kind: s.kind, title: s.title, prompt: s.prompt, x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation };
    if (s.kind === "answer") { o.answer = s.answer || ""; o.questionId = s.questionId; }
    if (s.sourceStickerId) o.sourceStickerId = s.sourceStickerId;
    return o;
  });
}
