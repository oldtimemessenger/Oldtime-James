import "./creative-mask-refiner.css";
import { mapMaskPointer, maskViewTransform } from "./creative-mask-geometry.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function drawSource(ctx, source, width, height, renderSource) {
  if (renderSource) renderSource(ctx, width, height);
  else if (source) ctx.drawImage(source, 0, 0, width, height);
}

function drawRestoreSegment(ctx, sourceCanvas, a, b, radius) {
  if (!sourceCanvas) return;
  const length = distance(a, b);
  const steps = Math.max(1, Math.ceil(length / Math.max(1, radius * 0.65)));
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    ctx.moveTo(a.x + (b.x - a.x) * t + radius, a.y + (b.y - a.y) * t);
    ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, radius, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.clip();
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();
}

function drawEraseSegment(ctx, a, b, radius) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = radius * 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

export function openCreativeMaskRefiner({ host, cutout, renderSource = null, onCommit, toast = () => {} } = {}) {
  const baseWidth = cutout?.naturalWidth || cutout?.videoWidth || cutout?.width || 0;
  const baseHeight = cutout?.naturalHeight || cutout?.videoHeight || cutout?.height || 0;
  if (!host || !cutout || !baseWidth || !baseHeight) throw new Error("The subject cutout is not ready to refine.");

  const scale = Math.min(1, 2048 / Math.max(baseWidth, baseHeight));
  const width = Math.max(1, Math.round(baseWidth * scale));
  const height = Math.max(1, Math.round(baseHeight * scale));
  const sourceCanvas = renderSource ? document.createElement("canvas") : null;
  if (sourceCanvas) {
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const context = sourceCanvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the original subject image.");
    drawSource(context, null, width, height, renderSource);
  }

  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const maskContext = mask.getContext("2d");
  if (!maskContext) throw new Error("Could not prepare the cutout mask.");
  const resetMask = () => {
    maskContext.clearRect(0, 0, width, height);
    drawSource(maskContext, sourceCanvas || cutout, width, height);
    maskContext.globalCompositeOperation = "destination-in";
    maskContext.drawImage(cutout, 0, 0, width, height);
    maskContext.globalCompositeOperation = "source-over";
  };
  resetMask();

  const overlay = document.createElement("section");
  const returnFocus = document.activeElement;
  overlay.className = "ce-mask-refiner";
  overlay.setAttribute("role", "group");
  overlay.setAttribute("aria-label", "Refine background removal");
  overlay.innerHTML = `
    <header class="ce-mask-head">
      <button type="button" class="ce-mask-back" data-mask-close aria-label="Cancel mask refinement">Back</button>
      <strong>Refine cutout</strong>
      <button type="button" class="ce-mask-done" data-mask-done>Done</button>
    </header>
    <div class="ce-mask-stage">
      <canvas class="ce-mask-preview" aria-label="Pinch to zoom. Brush over the subject to restore it or the background to erase it."></canvas>
      <p class="ce-mask-hint">Pinch to zoom · Paint to refine the edge</p>
    </div>
    <footer class="ce-mask-tools">
      <div class="ce-mask-actions" role="toolbar" aria-label="Mask brush">
        <button type="button" data-mask-mode="restore" aria-pressed="true" ${sourceCanvas ? "" : "disabled"}>Restore</button>
        <button type="button" data-mask-mode="erase" aria-pressed="false">Erase</button>
        <button type="button" data-mask-undo disabled aria-label="Undo last brush stroke">Undo</button>
      </div>
      <label class="ce-mask-size" for="ce-mask-size"><span>Brush</span><output data-mask-size-label>48 px</output>
        <input id="ce-mask-size" data-mask-size type="range" min="12" max="180" step="2" value="48" aria-label="Brush size">
      </label>
      <p class="ce-mask-note" data-mask-note>${sourceCanvas ? "Restore brings back the original photo; Erase removes background." : "Original photo pixels aren’t available here. Erase still works."}</p>
    </footer>`;
  host.append(overlay);

  const canvas = overlay.querySelector(".ce-mask-preview");
  const ctx = canvas.getContext("2d");
  const sizeInput = overlay.querySelector("[data-mask-size]");
  const sizeLabel = overlay.querySelector("[data-mask-size-label]");
  const restoreButton = overlay.querySelector('[data-mask-mode="restore"]');
  const eraseButton = overlay.querySelector('[data-mask-mode="erase"]');
  const undoButton = overlay.querySelector("[data-mask-undo]");
  const doneButton = overlay.querySelector("[data-mask-done]");
  const note = overlay.querySelector("[data-mask-note]");
  const points = new Map();
  const strokes = [];
  let activeStroke = null;
  let pinch = null;
  let mode = sourceCanvas ? "restore" : "erase";
  let brushSize = Number(sizeInput.value);
  let zoom = 1, panX = 0, panY = 0, cursor = null, closed = false, saving = false;
  let observer = null;

  const image = { width, height };
  const canvasRect = () => canvas.getBoundingClientRect();
  const imagePoint = (clientX, clientY) => {
    const rect = canvasRect();
    return mapMaskPointer(clientX, clientY, rect, image, zoom, panX, panY);
  };
  const currentTransform = rect => maskViewTransform({ width: rect.width, height: rect.height }, image, zoom, panX, panY);
  const paintSegment = (stroke, a, b) => {
    const radius = stroke.size / 2;
    if (stroke.mode === "erase") drawEraseSegment(maskContext, a, b, radius);
    else drawRestoreSegment(maskContext, sourceCanvas, a, b, radius);
  };
  const replayStrokes = () => {
    resetMask();
    for (const stroke of strokes) {
      if (stroke.points.length === 1) paintSegment(stroke, stroke.points[0], stroke.points[0]);
      else for (let i = 1; i < stroke.points.length; i++) paintSegment(stroke, stroke.points[i - 1], stroke.points[i]);
    }
  };
  const draw = () => {
    if (closed) return;
    const rect = canvasRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
    const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const transform = currentTransform(rect);
    ctx.drawImage(mask, transform.x, transform.y, width * transform.scale, height * transform.scale);
    if (cursor) {
      ctx.beginPath();
      ctx.arc(transform.x + cursor.x * transform.scale, transform.y + cursor.y * transform.scale,
        Math.max(4, brushSize * transform.scale / 2), 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = mode === "erase" ? "#ff5360" : "#ffffff";
      ctx.stroke();
    }
    undoButton.disabled = strokes.length === 0 || saving;
    doneButton.disabled = saving;
    sizeLabel.textContent = `${brushSize} px`;
  };
  const updateMode = next => {
    if (next === "restore" && !sourceCanvas) return;
    mode = next;
    restoreButton.setAttribute("aria-pressed", String(mode === "restore"));
    eraseButton.setAttribute("aria-pressed", String(mode === "erase"));
    note.textContent = mode === "restore"
      ? "Paint over a person or detail to bring back the original photo."
      : "Paint over background or missed areas to make them transparent.";
    draw();
  };
  restoreButton.onclick = () => updateMode("restore");
  eraseButton.onclick = () => updateMode("erase");
  sizeInput.oninput = () => { brushSize = Number(sizeInput.value); draw(); };
  undoButton.onclick = () => {
    if (!strokes.length || saving) return;
    strokes.pop();
    replayStrokes();
    draw();
  };

  const startPinch = () => {
    if (points.size !== 2) return;
    if (activeStroke) {
      activeStroke = null;
      replayStrokes();
    }
    const [a, b] = [...points.values()];
    const mid = midpoint(a, b);
    pinch = {
      zoom,
      distance: Math.max(1, distance(a, b)),
      anchor: imagePoint(mid.x, mid.y)
    };
  };
  const pointForEvent = event => {
    const rect = canvasRect();
    const p = imagePoint(event.clientX, event.clientY);
    const t = currentTransform(rect);
    const inside = event.clientX >= rect.left + t.x && event.clientX <= rect.left + t.x + width * t.scale &&
      event.clientY >= rect.top + t.y && event.clientY <= rect.top + t.y + height * t.scale;
    return { ...p, inside };
  };
  const down = event => {
    if (saving || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 2) {
      startPinch();
      draw();
      return;
    }
    if (points.size !== 1) return;
    const p = pointForEvent(event);
    cursor = p.inside ? p : null;
    if (!p.inside) { draw(); return; }
    activeStroke = { mode, size: brushSize, points: [{ x: p.x, y: p.y }] };
    paintSegment(activeStroke, activeStroke.points[0], activeStroke.points[0]);
    draw();
  };
  const move = event => {
    const previous = points.get(event.pointerId);
    if (!previous) {
      if (event.pointerType === "mouse") { cursor = pointForEvent(event); draw(); }
      return;
    }
    event.preventDefault();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size >= 2 && pinch) {
      const [a, b] = [...points.values()];
      const mid = midpoint(a, b);
      const rect = canvasRect();
      const nextZoom = clamp(pinch.zoom * distance(a, b) / pinch.distance, 1, 8);
      const fit = Math.min(rect.width / width, rect.height / height);
      const scaled = fit * nextZoom;
      zoom = nextZoom;
      panX = mid.x - rect.left - rect.width / 2 - (pinch.anchor.x - width / 2) * scaled;
      panY = mid.y - rect.top - rect.height / 2 - (pinch.anchor.y - height / 2) * scaled;
      draw();
      return;
    }
    if (activeStroke && points.size === 1) {
      const p = pointForEvent(event);
      const previousPoint = activeStroke.points.at(-1);
      if (distance(previousPoint, p) >= .5) {
        paintSegment(activeStroke, previousPoint, p);
        activeStroke.points.push({ x: p.x, y: p.y });
      }
      cursor = p;
      draw();
      return;
    }
    cursor = pointForEvent(event);
    draw();
  };
  const end = (event, cancelled = false) => {
    if (!points.has(event.pointerId)) return;
    if (activeStroke && points.size === 1) {
      if (!cancelled) strokes.push(activeStroke);
      else replayStrokes();
      activeStroke = null;
    }
    points.delete(event.pointerId);
    if (points.size < 2) pinch = null;
    draw();
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const keydown = event => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
  };
  const resize = () => draw();
  const close = () => {
    if (closed) return;
    closed = true;
    observer?.disconnect();
    window.removeEventListener("resize", resize);
    overlay.removeEventListener("keydown", keydown);
    overlay.remove();
    if (sourceCanvas) { sourceCanvas.width = 0; sourceCanvas.height = 0; }
    mask.width = mask.height = 0;
    returnFocus?.focus?.({ preventScroll: true });
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", event => end(event, true));
  overlay.addEventListener("keydown", keydown);
  window.addEventListener("resize", resize);
  if (typeof ResizeObserver === "function") {
    observer = new ResizeObserver(draw);
    observer.observe(canvas.parentElement);
  }
  overlay.querySelector("[data-mask-close]").onclick = close;
  doneButton.onclick = async () => {
    if (saving) return;
    if (!strokes.length) { close(); return; }
    saving = true;
    draw();
    try {
      const output = document.createElement("canvas");
      output.width = baseWidth;
      output.height = baseHeight;
      const outputContext = output.getContext("2d");
      if (!outputContext) throw new Error("Could not prepare the refined subject.");
      drawSource(outputContext, sourceCanvas || cutout, baseWidth, baseHeight, renderSource);
      outputContext.globalCompositeOperation = "destination-in";
      outputContext.drawImage(mask, 0, 0, baseWidth, baseHeight);
      outputContext.globalCompositeOperation = "source-over";
      const blob = await new Promise((resolve, reject) => output.toBlob(
        value => value ? resolve(value) : reject(new Error("Could not save the refined cutout.")), "image/png"
      ));
      output.width = output.height = 0;
      await onCommit?.(blob);
      close();
    } catch (error) {
      saving = false;
      note.textContent = error.message || "The refined mask could not be saved. Try again.";
      toast(error.message || "The refined mask could not be saved.");
      draw();
    }
  };
  draw();
  overlay.querySelector("[data-mask-close]").focus();
  return close;
}
