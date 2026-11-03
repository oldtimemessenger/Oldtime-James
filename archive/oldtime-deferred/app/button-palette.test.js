import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./button-palette.css", import.meta.url), "utf8");
const token = name => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{3,6})`, "i"))[1].toLowerCase();
const lum = hex => { const h = hex.length === 4 ? [...hex.slice(1)].map(c => c + c).join("") : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };

test("button label pairs meet 4.5:1", () => {
  for (const [bg, fg] of [["bp-neutral", "bp-neutral-on"], ["bp-black", "bp-black-on"], ["bp-orange", "bp-orange-on"], ["bp-orange-press", "bp-orange-on"], ["bp-disabled-bg", "bp-disabled-ink"]])
    assert.ok(ratio(token(bg), token(fg)) >= 4.5, `${bg}/${fg}`);
  assert.ok(ratio(token("bp-soft"), "#15171b") >= 4.5, "soft on dark chrome");
  assert.ok(ratio(token("bp-orange"), "#ffffff") >= 4.5, "orange on light chrome");
});
test("orange is solid hard orange with white text: no glass, blur or transparency", () => {
  assert.doesNotMatch(css, /backdrop-filter|@supports|rgba\(255,\s*210/i);
  assert.ok(ratio(token("bp-orange"), "#ffffff") >= 4.5);
  assert.ok(ratio("#12458f", "#ffffff") >= 4.5);
});
test("login is predominantly red with neutral controls and the smaller supplied logo", () => {
  const auth = readFileSync(new URL("./auth-brand.css", import.meta.url), "utf8");
  assert.match(auth, /background:#990000/);
  assert.match(auth, /aspect-ratio:845\/1024/); assert.match(auth, /object-fit:contain/); assert.match(auth,/background:transparent/);
  assert.ok(ratio("#ffffff","#161823")>=4.5);
  for(const ink of ["#ffffff","#e7e7e9"]) assert.ok(ratio("#990000",ink)>=4.5);
  assert.doesNotMatch(auth,/mask-image/);
  assert.match(auth,/width:min\(88px,24vw\)/);
  assert.match(auth,/align-self:center/);
  assert.match(readFileSync(new URL("./app.js", import.meta.url), "utf8"), /brand\/oldtime-login-red\.png/);
  assert.doesNotMatch(css,/#12458f|#0d3470|#8fb4f0/);
});
test("no yellow anywhere; red only for danger", () => {
  assert.doesNotMatch(css, /#f7dc4f|#e7b85e|#d6b56d|--bp-yellow:/i);
  assert.equal(token("accent-gold"),token("bp-orange"));
  assert.equal(token("brand-red"),token("bp-orange"));
  const redLines = css.split("\n").filter(l => /#b51e29|#e5262f/i.test(l));
  assert.ok(redLines.every(l => /danger/.test(l)));
});
test("transparent gallery glyph and strip are not repainted by the palette", () => {
  assert.doesNotMatch(css, /ce-camera-gallery-slot[^{]*\{[^}]*background/);
  assert.doesNotMatch(css, /\.ce-strip-upload\s*\{[^}]*background/);
  assert.doesNotMatch(css, /(^|\n)\s*(button|\.creative-editor button|\[type=button\])\s*[,{]/);
});
test("feature controls and legacy color aliases use the shared app palette",()=>{
  assert.equal(token("brand-red"),token("bp-orange"));
  for(const selector of [".audio-panel .ap-primary",".settings-save-bar > button",".phone .blast-screen .blast-primary",".bvn-editor-screen .bvn-share-submit",".ct-btn:not(.ghost)",".ap-btn:not(.ghost)"]) assert.ok(css.includes(selector),selector);
  assert.match(css,/background:var\(--bp-orange\)!important; color:#fff!important/);
  assert.match(css,/\.account-settings-screen \.settings-content \.btn\.ghost\s*\{[^}]*var\(--bp-neutral\)!important/);
  assert.match(css,/\.blast-screen \.blast-primary:disabled/);
});

test("palette is monochrome: black/gray actions, red notifications, no orange/blue tokens", () => {
  assert.equal(token("bp-orange"), "#0f1419");
  assert.doesNotMatch(css, /#ca4c00|#a33b00|#ffae76|#ff9955/i);
  const ci = readFileSync(new URL("./compact-interface.css", import.meta.url), "utf8");
  assert.match(ci, /--notification-accent:#f4212e/);
  assert.match(ci, /--serif: var\(--font\)/);
  assert.doesNotMatch(ci, /Fraunces/);
  assert.ok(ratio("#f4212e", "#ffffff") >= 3.5);
});
