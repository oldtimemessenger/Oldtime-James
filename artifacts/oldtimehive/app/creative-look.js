// Oldtime look pipeline: filter presets + adjustments + geometry for the background media.
// One pure math definition is shared by the WebGL stage (preview + export) and the CPU fallback,
// so the published pixels always match what the editor showed.

export const ADJUSTMENTS = [
  { key: "exposure", label: "Exposure", min: -100, max: 100 },
  { key: "brightness", label: "Brightness", min: -100, max: 100 },
  { key: "contrast", label: "Contrast", min: -100, max: 100 },
  { key: "highlights", label: "Highlights", min: -100, max: 100 },
  { key: "shadows", label: "Shadows", min: -100, max: 100 },
  { key: "saturation", label: "Saturation", min: -100, max: 100 },
  { key: "warmth", label: "Warmth", min: -100, max: 100 },
  { key: "tint", label: "Tint", min: -100, max: 100 },
  { key: "sharpen", label: "Sharpen", min: 0, max: 100 },
  { key: "vignette", label: "Vignette", min: 0, max: 100 },
  { key: "grain", label: "Grain", min: 0, max: 100 },
];
const RANGE = Object.fromEntries(ADJUSTMENTS.map(item => [item.key, item]));

// Twenty original presets. Values are adjustment deltas at 100% intensity.
export const FILTER_PRESETS = [
  { id: "none", name: "Original", adjust: {} },
  { id: "harbor", name: "Harbor", adjust: { warmth: -22, contrast: 12, saturation: -8, shadows: 10 } },
  { id: "porch", name: "Porch Light", adjust: { warmth: 30, exposure: 6, highlights: -14, saturation: 6 } },
  { id: "ledger", name: "Ledger", adjust: { saturation: -100, contrast: 22, grain: 18 } },
  { id: "tintype", name: "Tintype", adjust: { saturation: -88, warmth: 26, contrast: 18, vignette: 44, grain: 26 } },
  { id: "parlor", name: "Parlor", adjust: { warmth: 16, tint: 12, contrast: -8, shadows: 18, vignette: 22 } },
  { id: "almanac", name: "Almanac", adjust: { warmth: 22, saturation: -30, contrast: -12, brightness: 8, grain: 14 } },
  { id: "riverstone", name: "Riverstone", adjust: { saturation: -40, warmth: -10, contrast: 8, highlights: -10 } },
  { id: "brick", name: "Brick Lane", adjust: { tint: 18, warmth: 12, contrast: 20, saturation: 10 } },
  { id: "matinee", name: "Matinee", adjust: { contrast: 28, saturation: 14, vignette: 30, shadows: -12 } },
  { id: "frost", name: "Frost Window", adjust: { warmth: -34, brightness: 10, contrast: -10, saturation: -16 } },
  { id: "orchard", name: "Orchard", adjust: { saturation: 24, warmth: 14, highlights: -8, shadows: 8 } },
  { id: "dusk", name: "Late Supper", adjust: { exposure: -10, warmth: 24, tint: 10, vignette: 34 } },
  { id: "cobalt", name: "Cobalt Hour", adjust: { warmth: -40, tint: 8, contrast: 16, exposure: -6 } },
  { id: "linen", name: "Linen", adjust: { brightness: 14, contrast: -22, saturation: -20, highlights: -12 } },
  { id: "newsprint", name: "Newsprint", adjust: { saturation: -100, contrast: 46, sharpen: 30, grain: 34 } },
  { id: "kodiak", name: "Kodiak", adjust: { contrast: 18, warmth: 8, saturation: 18, sharpen: 16 } },
  { id: "velvet", name: "Velvet", adjust: { tint: 22, saturation: -6, shadows: 14, contrast: 10 } },
  { id: "meadow", name: "Meadow", adjust: { tint: -18, saturation: 16, brightness: 6 } },
  { id: "drive-in", name: "Drive-In", adjust: { contrast: 24, saturation: 30, warmth: 18, vignette: 26, grain: 12 } },
];
export const PRESET_BY_ID = Object.fromEntries(FILTER_PRESETS.map(item => [item.id, item]));

const clampN = (value, min, max) => { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min < 0 ? 0 : min; };
export const clampAdjust = (key, value) => { const r = RANGE[key]; return r ? clampN(value, r.min, r.max) : 0; };
export const clampIntensity = value => clampN(value ?? 100, 0, 100);

export function defaultLook() { return { preset: "none", intensity: 100, adjust: Object.fromEntries(ADJUSTMENTS.map(a => [a.key, 0])) }; }

// Read a look without mutating; legacy percentage adjustments (100 = neutral) are migrated.
export function readLook(background = {}) {
  const look = defaultLook(), source = background?.look;
  if (source) {
    look.preset = PRESET_BY_ID[source.preset] ? source.preset : "none";
    look.intensity = clampIntensity(source.intensity);
    for (const a of ADJUSTMENTS) look.adjust[a.key] = clampAdjust(a.key, source.adjust?.[a.key] ?? 0);
  } else if (background?.adjustments) {
    for (const key of ["brightness", "contrast", "saturation"]) {
      const v = background.adjustments[key];
      if (Number.isFinite(Number(v))) look.adjust[key] = clampAdjust(key, Number(v) - 100);
    }
  }
  return look;
}
export function readGeometry(background = {}) {
  const t = background?.transform || {};
  const rotate = ((Math.round(Number(t.rotate) / 90) * 90 % 360) + 360) % 360 || 0;
  return { rotate, straighten: clampN(t.straighten ?? 0, -45, 45) };
}
export const geometryActive = background => { const g = readGeometry(background); return g.rotate !== 0 || g.straighten !== 0; };

// Keep a single canonical state on the background. The `filter` marker makes the
// publication path re-render instead of reusing the untouched original file.
export function writeLook(background, look) {
  const next = readLook({ look });
  background.look = next;
  delete background.adjustments;
  syncLookMarker(background);
  return next;
}
export function syncLookMarker(background) {
  if (lookActive(readLook(background)) || geometryActive(background)) background.filter = background.look?.preset && background.look.preset !== "none" ? background.look.preset : "adjusted";
  else if (background.filter === "adjusted" || PRESET_BY_ID[background.filter]) delete background.filter;
}
export function migrateLook(background) {
  if (!background || background.look || !background.adjustments) return background;
  writeLook(background, readLook(background));
  return background;
}

export function effectiveAdjust(look) {
  const l = readLook({ look }), preset = PRESET_BY_ID[l.preset]?.adjust || {}, k = l.intensity / 100, out = {};
  for (const a of ADJUSTMENTS) out[a.key] = clampAdjust(a.key, l.adjust[a.key] + (preset[a.key] || 0) * k);
  return out;
}
export const lookActive = look => Object.values(effectiveAdjust(look)).some(v => Math.abs(v) > 1e-6);
export const lookKey = look => JSON.stringify(effectiveAdjust(look));

export function setAdjust(background, key, value) { const l = readLook(background); l.adjust[key] = clampAdjust(key, value); return writeLook(background, l); }
export function resetAdjust(background, key) { return setAdjust(background, key, 0); }
export function resetAllAdjust(background) { const l = readLook(background); l.adjust = defaultLook().adjust; return writeLook(background, l); }
export function setPreset(background, id, intensity) {
  const l = readLook(background); l.preset = PRESET_BY_ID[id] ? id : "none";
  if (intensity !== undefined) l.intensity = clampIntensity(intensity);
  return writeLook(background, l);
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const grainNoise = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

// Color grade for one pixel (0..1 channels). Shared definition, mirrored in GLSL below.
export function gradePixel(r, g, b, a, u = .5, v = .5, px = 0, py = 0) {
  const e = Math.pow(2, a.exposure / 100 * 1.5);
  r *= e; g *= e; b *= e;
  const br = a.brightness / 100 * .25; r += br; g += br; b += br;
  const c = 1 + a.contrast / 100; r = (r - .5) * c + .5; g = (g - .5) * c + .5; b = (b - .5) * c + .5;
  let L = r * .2126 + g * .7152 + b * .0722;
  const tone = smooth(.5, 1, L) * a.highlights / 100 * .25 + (1 - smooth(0, .5, L)) * a.shadows / 100 * .25;
  r += tone; g += tone; b += tone;
  L = r * .2126 + g * .7152 + b * .0722;
  const s = 1 + a.saturation / 100; r = L + (r - L) * s; g = L + (g - L) * s; b = L + (b - L) * s;
  const w = a.warmth / 100 * .08, t = a.tint / 100 * .08;
  r += w + t * .4; b += -w + t * .4; g -= t;
  if (a.vignette) { const d = Math.hypot(u - .5, v - .5) / .7071; const f = 1 - a.vignette / 100 * .75 * smooth(.35, 1, d); r *= f; g *= f; b *= f; }
  if (a.grain) { const n = (grainNoise(px, py) - .5) * a.grain / 100 * .16; r += n; g += n; b += n; }
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

// CPU implementation over RGBA bytes. `colorOnly` skips position-dependent effects (used for cutouts).
export function applyLookPixels(data, width, height, look, { colorOnly = false } = {}) {
  const a = effectiveAdjust(look);
  if (colorOnly) { a.vignette = 0; a.grain = 0; a.sharpen = 0; }
  const src = a.sharpen ? new Uint8ClampedArray(data) : data, amt = a.sharpen / 100 * 1.2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    let r = src[i] / 255, g = src[i + 1] / 255, b = src[i + 2] / 255;
    if (amt) {
      const n = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].map(([nx, ny]) => (Math.min(height - 1, Math.max(0, ny)) * width + Math.min(width - 1, Math.max(0, nx))) * 4);
      const avg = ch => n.reduce((s, j) => s + src[j + ch], 0) / 1020;
      r += (r - avg(0)) * amt; g += (g - avg(1)) * amt; b += (b - avg(2)) * amt;
    }
    const [R, G, B] = gradePixel(r, g, b, a, (x + .5) / width, (y + .5) / height, x, y);
    data[i] = R * 255; data[i + 1] = G * 255; data[i + 2] = B * 255;
  }
  return data;
}

// Cover-draw with crop, straighten and 90° rotation. Mirror (camera semantics) stays outermost.
export function geometryScale(width, height, sw, sh, rotate, straighten) {
  const swapped = rotate % 180 !== 0, w = swapped ? sh : sw, h = swapped ? sw : sh;
  const base = Math.max(width / w, height / h), th = Math.abs(straighten) * Math.PI / 180;
  const extra = Math.max((width * Math.cos(th) + height * Math.sin(th)) / width, (width * Math.sin(th) + height * Math.cos(th)) / height);
  return base * extra;
}
export function drawBackgroundSource(ctx, image, width, height, background = {}) {
  const w = image.videoWidth || image.naturalWidth || image.width, h = image.videoHeight || image.naturalHeight || image.height;
  if (!w || !h || image.tagName === "VIDEO" && image.readyState < 2) return false;
  const crop = background.crop, { rotate, straighten } = readGeometry(background);
  const sx = (crop?.x || 0) * w, sy = (crop?.y || 0) * h, sw = (crop?.width || 1) * w, sh = (crop?.height || 1) * h;
  ctx.save();
  if (background.mirror) { ctx.translate(width, 0); ctx.scale(-1, 1); }
  if (!rotate && !straighten) {
    const ratio = background.fit === "contain" ? Math.min(width / sw, height / sh) : Math.max(width / sw, height / sh);
    ctx.drawImage(image, sx, sy, sw, sh, (width - sw * ratio) / 2, (height - sh * ratio) / 2, sw * ratio, sh * ratio);
  } else {
    const angle = (rotate + straighten) * Math.PI / 180;
    const ratio = background.fit === "contain"
      ? Math.min(width / (Math.abs(sw * Math.cos(angle)) + Math.abs(sh * Math.sin(angle))),
        height / (Math.abs(sw * Math.sin(angle)) + Math.abs(sh * Math.cos(angle))))
      : geometryScale(width, height, sw, sh, rotate, straighten);
    ctx.translate(width / 2, height / 2); ctx.rotate((rotate + straighten) * Math.PI / 180);
    ctx.drawImage(image, sx, sy, sw, sh, -sw * ratio / 2, -sh * ratio / 2, sw * ratio, sh * ratio);
  }
  ctx.restore();
  return true;
}

const VERT = `attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision mediump float;varying vec2 uv;uniform sampler2D img;uniform vec2 px;uniform vec2 size;
uniform float ex,br,co,hi,sh,sa,wa,ti,sp,vi,gr;
float sm(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
void main(){vec4 s=texture2D(img,uv);vec3 c=s.rgb;
 if(sp>0.){vec3 n=(texture2D(img,uv+vec2(px.x,0.)).rgb+texture2D(img,uv-vec2(px.x,0.)).rgb+texture2D(img,uv+vec2(0.,px.y)).rgb+texture2D(img,uv-vec2(0.,px.y)).rgb)*.25;c+=(c-n)*sp/100.*1.2;}
 c*=pow(2.,ex/100.*1.5);c+=br/100.*.25;c=(c-.5)*(1.+co/100.)+.5;
 float L=dot(c,vec3(.2126,.7152,.0722));c+=sm(.5,1.,L)*hi/100.*.25+(1.-sm(0.,.5,L))*sh/100.*.25;
 L=dot(c,vec3(.2126,.7152,.0722));c=L+(c-L)*(1.+sa/100.);
 float w=wa/100.*.08,t=ti/100.*.08;c+=vec3(w+t*.4,-t,-w+t*.4);
 if(vi>0.){float d=length(uv-.5)/.7071;c*=1.-vi/100.*.75*sm(.35,1.,d);}
 if(gr>0.){vec2 q=floor(uv*size);float n=fract(sin(q.x*12.9898+q.y*78.233)*43758.5453)-.5;c+=n*gr/100.*.16;}
 gl_FragColor=vec4(clamp(c,0.,1.),s.a);}`;

// Bounded, reusable GPU stage: one canvas, one context, one texture. Falls back to the CPU
// implementation of the exact same math (never silently drops the look).
export class LookStage {
  constructor() { this.canvas = document.createElement("canvas"); this.mode = null; this.gl = null; }
  init() {
    if (this.mode) return;
    try {
      const gl = this.canvas.getContext("webgl", { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
      if (!gl) throw new Error("no webgl");
      const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const prog = gl.createProgram(); gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      this.uniforms = Object.fromEntries(["px", "size", "ex", "br", "co", "hi", "sh", "sa", "wa", "ti", "sp", "vi", "gr"].map(n => [n, gl.getUniformLocation(prog, n)]));
      this.gl = gl; this.program = prog; this.buffer = buf; this.mode = "gpu";
    } catch { this.gl = null; this.canvas = document.createElement("canvas"); this.mode = "cpu"; }
  }
  apply(source, look) {
    this.init();
    const { width, height } = source;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    if (this.mode === "gpu" && !this.gl.isContextLost()) {
      const gl = this.gl, a = effectiveAdjust(look), u = this.uniforms;
      gl.viewport(0, 0, width, height);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform2f(u.px, 1 / width, 1 / height); gl.uniform2f(u.size, width, height);
      for (const [n, k] of [["ex", "exposure"], ["br", "brightness"], ["co", "contrast"], ["hi", "highlights"], ["sh", "shadows"], ["sa", "saturation"], ["wa", "warmth"], ["ti", "tint"], ["sp", "sharpen"], ["vi", "vignette"], ["gr", "grain"]]) gl.uniform1f(u[n], a[k]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return this.canvas;
    }
    if (this.mode === "gpu") { this.mode = "cpu"; this.gl = null; this.canvas = document.createElement("canvas"); this.canvas.width = width; this.canvas.height = height; }
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, width, height); ctx.drawImage(source, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height);
    applyLookPixels(pixels.data, width, height, look); ctx.putImageData(pixels, 0, 0);
    return this.canvas;
  }
  dispose() {
    const gl = this.gl;
    if (gl) { gl.deleteTexture(this.texture); gl.deleteBuffer(this.buffer); gl.deleteProgram(this.program); gl.getExtension("WEBGL_lose_context")?.loseContext(); }
    this.gl = null; this.mode = null; this.canvas.width = this.canvas.height = 0;
  }
}

// Preview cap: phones render the look at a bounded pixel budget; export always passes no cap.
export const previewLookPixels = () => (globalThis.matchMedia?.("(max-width: 767px)")?.matches ? 900_000 : 2_100_000);
export function lookWorkSize(width, height, maxPixels = Infinity) {
  const scale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}
