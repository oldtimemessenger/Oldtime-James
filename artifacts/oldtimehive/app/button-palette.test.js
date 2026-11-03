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
test("primary actions use royal blue with white text and no glass or blur", () => {
  assert.doesNotMatch(css, /backdrop-filter|@supports|rgba\(255,\s*210/i);
  assert.ok(ratio(token("bp-orange"), "#ffffff") >= 4.5);
  assert.ok(ratio("#12458f", "#ffffff") >= 4.5);
});
test("Sign in and signup actions are black while the Sign up link stays blue", () => {
  const auth = readFileSync(new URL("./auth-brand.css", import.meta.url), "utf8");
  const white = readFileSync(new URL("./ordinary-white.css", import.meta.url), "utf8");
  const entry = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const markup = readFileSync(new URL("./auth-design.js", import.meta.url), "utf8");
  const loginMarkup = markup.slice(markup.indexOf("export function loginMarkup"), markup.indexOf("export function signupMarkup"));
  const brandSelection = readFileSync(new URL("./brand-selection.css", import.meta.url), "utf8");
  assert.match(css, /\.auth\.ot-auth \.btn\.primary:disabled\s*\{[^}]*color:var\(--bp-disabled-ink\)/);
  assert.match(white, /\.auth\.ot-auth\{[^}]*background:#fff;color:#17191c/);
  assert.match(white, /\.auth\.ot-auth\.ot-auth-login #login\.btn\.primary:not\(:disabled\)[\s\S]*?background:#000;border-color:#000;color:#fff/);
  assert.match(white, /\.auth\.ot-auth:not\(\.ot-auth-login\) \.signup-form \.btn\.primary:not\(:disabled\)[\s\S]*?background:#000;border-color:#000;color:#fff/);
  assert.ok(entry.indexOf('import "./ordinary-white.css";') > entry.indexOf('import "./auth-brand.css";'));
  assert.match(markup, /class="btn ghost signup-login" id="back"/);
  assert.match(loginMarkup, /<h1>Sign in<\/h1>/);
  assert.match(loginMarkup, /Username or email/);
  assert.match(loginMarkup, /type="submit">Sign in<\/button>/);
  assert.match(loginMarkup, /class="btn auth-link" id="signup"/);
  assert.match(markup, /class="btn primary signup-next" type="button">Next<\/button>/);
  assert.doesNotMatch(loginMarkup, /@|🔒|> *@ *</);
  assert.match(brandSelection, /\.phone \.btn:not\(\.ghost\):not\(\.danger\):not\(:disabled\)/);
  assert.match(auth, /\.auth-success\{[^}]*color:#236b45/);
  assert.match(auth, /aspect-ratio:auto/); assert.match(auth, /object-fit:contain/); assert.match(auth,/background:transparent/);
  assert.ok(ratio("#ffffff","#17191c")>=4.5);
  for(const ink of ["#17191c","#6b6f76"]) assert.ok(ratio("#ffffff",ink)>=4.5);
  assert.doesNotMatch(auth,/mask-image/);
  assert.match(auth,/field:-webkit-autofill/);
  assert.doesNotMatch(auth,/yellow|#ffff00|#ff0(?:\W|$)/i);
  assert.match(auth,/\.ot-auth \.ot-art img\{width:48px;height:76px/);
  assert.match(auth,/align-self:center/);
  assert.match(readFileSync(new URL("./app.js", import.meta.url), "utf8"), /brand\/oldtime-feather\.png/);
  assert.doesNotMatch(css,/#12458f|#0d3470|#8fb4f0/);
});
test("royal blue is primary and burgundy stays a restrained accent", () => {
  assert.equal(token("bp-orange"), "#1456d9");
  assert.equal(token("accent-gold"), "#8e1b24");
  assert.equal(token("brand-red"),token("accent-gold"));
  assert.notEqual(token("brand-red"),token("bp-orange"));
  assert.match(css,/\.auth\.ot-auth\.ot-auth-login \.ot-switch \.btn\.auth-link\s*\{[^}]*background:transparent[^}]*border:0/);
  assert.match(css,/\.auth\.ot-auth\.ot-auth-login \.ot-switch \.btn\.auth-link\s*\{[^}]*color:var\(--bp-primary\)!important/);
  assert.doesNotMatch(css,/linear-gradient\(180deg,#ed3545/);
  assert.match(css,/\.profile-editor-header-save,\s*\.profile-editor-save\s*\{[^}]*background:var\(--bp-primary\)/);
});
test("transparent gallery glyph and strip are not repainted by the palette", () => {
  assert.doesNotMatch(css, /ce-camera-gallery-slot[^{]*\{[^}]*background/);
  assert.doesNotMatch(css, /\.ce-strip-upload\s*\{[^}]*background/);
  assert.doesNotMatch(css, /(^|\n)\s*(button|\.creative-editor button|\[type=button\])\s*[,{]/);
});
test("feature controls and legacy color aliases use the shared app palette",()=>{
  assert.equal(token("brand-red"),token("accent-gold"));
  for(const selector of [".audio-panel .ap-primary",".settings-save-bar > button",".phone .blast-screen .blast-primary",".bvn-editor-screen .bvn-share-submit",".ct-btn:not(.ghost)",".ap-btn:not(.ghost)"]) assert.ok(css.includes(selector),selector);
  assert.match(css,/background:var\(--bp-primary\)!important; color:#fff!important/);
  assert.match(css,/\.account-settings-screen \.settings-content \.btn\.ghost\s*\{[^}]*var\(--bp-neutral\)!important/);
  assert.match(css,/\.blast-screen \.blast-primary:disabled/);
});

test("screen-specific primary actions match the shared blue without repainting secondary controls",()=>{
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const paletteImport = app.indexOf('import "./button-palette.css";');
  for(const laterStyle of ['import "./compact-interface.css";','import "./profile-presentations.css";'])
    assert.ok(paletteImport > app.indexOf(laterStyle), `palette loads after ${laterStyle}`);
  for(const selector of [
    ".profile-note-panel .btn:not(.ghost):not(.danger)",
    ".light .btn:not(.ghost):not(.danger)",
    ".settings-content .btn:not(.ghost):not(.danger)",
    ".exp-primary",
    ".community-note-submit",
    ".chat-composer button[type=submit]",
    ".comment-send",
    ".live-comment-form button",
    ".vn-action.primary",
    ".pp-sheet button.pp-main",
    ".saved-social-panel .ss-primary",
    ".rn-save",
    ".gob .btn:not(.sec):not(.bad)",
    ".remix-studio .rs-record",
    ".guide-update > button",
  ]) assert.ok(css.includes(selector), selector);
  assert.match(css,/\.btn\.ghost,\s*\.contact-follow\.following,\s*\.cta-secondary\s*\{[^}]*background:var\(--bp-neutral\)/);
  assert.match(css,/\.btn\.danger,\s*\.btn\.ghost\.danger/);
});

test("Community feed keeps its palette while media rails use white saved bookmarks", () => {
  assert.equal(token("bp-orange"), "#1456d9");
  const ci = readFileSync(new URL("./compact-interface.css", import.meta.url), "utf8");
  const feed = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const finalCss = readFileSync(new URL("./unboxed-interface.css", import.meta.url), "utf8");
  assert.match(ci, /--feed-action:#6b6f76/);
  assert.match(ci, /--feed-like:#e0245e/);
  assert.match(ci, /--feed-save:#1456d9/);
  assert.match(ci, /--feed-repost:#6b6f76/);
  assert.match(feed, /button\.is-active\[data-like\]\s*\{\s*color:#e0245e/);
  assert.match(feed, /button\.is-active\[data-save\]\s*\{\s*color:inherit/);
  assert.match(feed, /button\.is-active\[data-save\]\s+\.navic\s*\{\s*color:var\(--color-primary\)/);
  assert.match(feed, /button\.is-active\[data-repost\]\s*\{\s*color:#536471/);
  assert.match(finalCss, /#app \.clip \.act\[data-save\]\.on \.navic[\s\S]*?fill:#fff!important/);
  assert.match(feed, /community-feed-tabs button\.on::after[^}]*background:var\(--color-primary\)/);
  assert.ok(feed.includes("background:#f8f9fb"), "posts use a subtle gray surface");
  assert.ok(feed.includes("grid-template-columns:repeat(5,minmax(0,1fr))"), "post actions keep evenly aligned positions without a Remix badge");
  assert.ok(feed.includes("margin:5px 0 0 47px"), "actions align with the post text rather than the avatar");
  assert.match(ci, /--notification-accent:#1456d9/);
  assert.match(ci, /--serif: var\(--font\)/);
  assert.doesNotMatch(ci, /Fraunces/);
  assert.ok(ratio("#f4212e", "#ffffff") >= 3.5);
});

test("feed social icons share a rounded outline style, with fill only for selected states", () => {
  const icons = readFileSync(new URL("./icons.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(icons, /export function icon\(name, filled = false, strokeWidth = 1\.75\)/);
  assert.match(icons, /icons\.commentFilled = icon\("comment"\)/);
  assert.match(icons, /icons\.repost = icon\("repost"\)/);
  assert.match(icons, /icons\.share = icon\("share"\)/);
  assert.match(icons, /share: '<path d="m14 4\.5 7 6\.8-7 6\.8v-4\.2c/);
  assert.ok(app.includes("${ic.share}"), "app share actions use the shared outline icon");
  assert.ok(app.includes("${liked ? ic.mediaHeartOn : ic.mediaHeart}"), "post rails use the approved media heart outline");
  assert.match(app, /data-save="\$\{p\.id\}"[^>]*aria-pressed="\$\{saved\}"[^>]*>\$\{saved \? ic\.mediaBookmarkOn : ic\.mediaBookmark\}<span class="act-count">\$\{fmt\(saveCount\)\}/);
  assert.match(styles, /#feed \.clip:not\(\.post-detail\) \.rail \.act-count/);
  assert.match(styles, /#feed \.clip:not\(\.post-detail\) \.rail \.act\[data-save\]\.on \{ color:#fff; \}/);
  assert.match(styles, /#feed \.clip:not\(\.post-detail\) \.rail \.act-label \{ color:#fff!important/);
});
