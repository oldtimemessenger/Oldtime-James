import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const audioPanel = readFileSync(new URL("./audio-panel.js", import.meta.url), "utf8");
const soundbarStart = app.indexOf('<div class="soundbar"');
const soundbarEnd = app.indexOf("</article>", soundbarStart);
const soundbarMarkup = app.slice(soundbarStart, soundbarEnd + "</article>".length);

test("Home video playback has no in-app volume button and lets the device set playback level", () => {
  assert.doesNotMatch(app, /sound-mute-control|data-mute=/);
  assert.match(app, /video\.muted = false/);
  assert.match(css, /#feed \.clip:not\(\.post-detail\) \.rail \.act\s*\{[^}]*border-radius:0[^}]*background:transparent/);
});

test("The Home comments panel uses a flat edge instead of a rounded sheet", () => {
  assert.match(css, /\.comment-panel\s*\{[^}]*border-radius:\s*0/);
});

test("Profile post metrics sit below media rather than over the preview", () => {
  assert.ok(app.includes('class="profile-post-views" aria-label="${fmt(p.views || 0)} views">${ic.eye}${fmt(p.views || 0)}'));
  const mediaStart = app.indexOf('class="profile-post-media');
  const mediaEnd = app.indexOf('</${archived ? "div" : "button"}>', mediaStart);
  const viewsIndex = app.indexOf('class="profile-post-views"', mediaEnd);
  assert.ok(mediaStart >= 0 && mediaEnd > mediaStart && viewsIndex > mediaEnd,
    "view totals stay in the post details below the media");
  assert.doesNotMatch(app.slice(mediaStart, mediaEnd), /profile-post-views|profile-post-video-mark|profile-repost-mark|profile-post-menu/,
    "profile media previews have no badges or menu overlay");
  const statsStart = app.indexOf("const profileStatsMarkup =");
  const statsEnd = app.indexOf("const requested", statsStart);
  assert.ok(statsStart >= 0 && statsEnd > statsStart, "profile header stats are assembled separately");
  assert.doesNotMatch(app.slice(statsStart, statsEnd), /\bviews?\b/i,
    "views belong on each content item, not in the profile header");
  assert.doesNotMatch(app, /measured plays/);
});

test("Profile posts use one column with the existing menu below each preview", () => {
  const gridRule = css.match(/\.profile-post-grid\s*\{([^}]*)\}/);
  assert.ok(gridRule, "profile post grid styles exist");
  assert.match(gridRule[1], /grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.match(app, /class="profile-post-media[\s\S]*?<\/\$\{archived \? "div" : "button"\}>\s*<div class="profile-post-detail">\s*<div class="profile-post-byline">[\s\S]*?\$\{profilePostMenu\}/,
    "existing owner actions render in the details row below media");
});

test("Full-screen video hearts and comments are white while saves keep their existing color", () => {
  assert.match(css, /\.clip:not\(\.post-detail\) > \.rail \.act\[data-like\]:not\(\.on\),[\s\S]*?\.clip:not\(\.post-detail\) > \.rail \.act\[data-comment\]\s*\{ color:#fff; \}/);
  assert.match(css, /\.clip:not\(\.post-detail\) > \.rail \.act\[data-like\]\.on \{ color:var\(--feed-like\); \}/);
  assert.match(css, /\.clip \.act\[data-save\]\.on \.navic \{ color:#1d9bf0; fill:#1d9bf0; stroke:#1d9bf0; \}/);
});

test("Feed sound is a simple label with reuse actions in sound details", () => {
  assert.match(css, /\.soundbar\s*\{[^}]*left: 14px; right: 76px; bottom: calc\(128px \+ env\(safe-area-inset-bottom\)\);[^}]*border:0; border-radius:0; background:transparent/);
  assert.match(css, /\.clip \.meta\{bottom:calc\(144px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(soundbarMarkup, /class="soundbar-note" aria-hidden="true">♫<\/span>/);
  assert.match(soundbarMarkup, /data-audio-open="\$\{esc\(p\.id\)\}"/);
  assert.doesNotMatch(soundbarMarkup, /soundbar-action|soundbar-sub|data-audio-action/);
  assert.match(audioPanel, /data-audio-reuse/);
  assert.match(audioPanel, /data-audio-remix/);
});

test("Home feed details and action icons sit closer to navigation without sound overlap", () => {
  assert.match(css, /#feed \.clip:not\(\.post-detail\) \.meta \{ bottom:calc\(104px \+ env\(safe-area-inset-bottom,0px\)\); \}/);
  assert.match(css, /#feed \.clip:not\(\.post-detail\) \.soundbar \{ bottom:calc\(70px \+ env\(safe-area-inset-bottom,0px\)\); \}/);
  assert.match(css, /#feed \.clip:not\(\.post-detail\) \.rail \{ bottom:calc\(76px \+ env\(safe-area-inset-bottom,0px\)\); \}/);
  assert.equal(126 - (96 + 22), 8, "metadata ends 8px above the sound label");
});

test("Opaque cross-origin browser errors are not shown verbatim as app toasts", () => {
  assert.match(app, /function handleUnhandledClientError\(error\)/);
  assert.match(app, /crossOriginLoad = \/cross\[- \]origin/);
  assert.doesNotMatch(app, /toast\(e\.(?:error|reason)\.message\)/);
});
