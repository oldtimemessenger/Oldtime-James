import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { icon, iconPaths } from "./icons.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = name => readFileSync(path.join(dir, name), "utf8");

test("the shared overflow icon is three vertically stacked dots", () => {
  const circles = [...iconPaths.more.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/>/g)]
    .map(([, x, y]) => [Number(x), Number(y)]);
  assert.deepEqual(circles, [[12, 5], [12, 12], [12, 19]]);
  assert.equal((icon("more").match(/<circle\b/g) || []).length, 3);
});

test("new-message icon is an original outlined chat bubble with a plus", () => {
  assert.match(iconPaths.messagePlus, /<path d="M4 8\.5/);
  assert.match(iconPaths.messagePlus, /M9 11v5m-2\.5-2\.5h5/);
  assert.equal((icon("messagePlus").match(/<path\b/g) || []).length, 2);
});

test("Messages is an original outline stack with an open pair of back edges",()=>{
  assert.match(iconPaths.messages,/class="conversation-front"/);
  assert.match(iconPaths.messages,/v10l-3\.5-2H4/);
  assert.match(iconPaths.messages,/<path fill="none" d="M6 5\.5/);
  assert.match(icon("messages"),/stroke-width="1\.75"/);
  assert.doesNotMatch(iconPaths.messages,/<(?:image|text|circle)\b/);
  assert.doesNotMatch(icon('bad"><script>'),/<script>/);
});

test("studio, sports, story and comment menus use the vertical overflow glyph or tune icon", () => {
  assert.match(source("creative-view-icons.js"), /more:\s*svg\(iconPaths\.more\)/);
  assert.match(source("sports-mode.js"), /more:\s*iconPaths\.more/);
  assert.match(source("story-interactions.js"), /icon\("tune"\)/);
  assert.match(source("app.js"), /aria-label="Comment actions">\$\{ic\.tune\}/);
});

test("the signed-in profile uses a hamburger menu while other profiles keep their action menu", () => {
  const app = source("app.js");
  assert.match(app, /mine \? ic\.menu : ic\.(?:more|tune)/);
  assert.match(app, /mine \? "Open profile settings and actions" : "More profile actions"/);
  assert.ok(iconPaths.gear.includes('<circle cx="12" cy="12" r="3"/>'));
  assert.match(icon("gear"), /<svg[^>]*><path d=/);
});

test("comment controls use a heart for Like and a downward thumb for Dislike", () => {
  const app = source("app.js");
  assert.match(app, /data-clike="\$\{esc\(comment\.id\)\}"[^>]*>\$\{ic\.mediaHeart\}/);
  assert.match(app, /data-cdislike="\$\{esc\(comment\.id\)\}"[^>]*><svg[^>]*><path transform="rotate\(180 12 12\)"/);
});

test("social post actions use recognizable outlined heart, bubble, bookmark and repost glyphs", () => {
  assert.match(iconPaths.heart, /a5\.6 5\.6 0 0 0-7\.9 0/);
  assert.match(iconPaths.comment, /a8\.5 8\.5 0 0 1-8\.5 8\.5/);
  assert.match(iconPaths.bookmark, /v17l-6-4-6 4z/);
  assert.match(iconPaths.repost, /m17 3 4 4-4 4/);
  assert.match(icon("heart"), /fill="none"/);
  assert.match(icon("bookmark"), /fill="none"/);
});

test("media post rails use the approved heart, comment, and bookmark silhouettes", () => {
  const app = source("app.js");
  const blast = source("blast-social.js");
  const places = source("places-view.js");
  assert.match(iconPaths.mediaHeart, /matrix\(\.3 0 0 \.3 -10\.8 -\.45\)/);
  assert.match(iconPaths.mediaComment, /M77 164c-16 0-29 12-29 28/);
  assert.match(iconPaths.mediaBookmark, /M61 312h30c5 0 8 3 8 8/);
  assert.match(icon("mediaHeart"), /vector-effect="non-scaling-stroke"/);
  assert.match(icon("mediaHeart", true), /fill="currentColor"/);
  assert.ok(app.includes("${liked ? ic.mediaHeartOn : ic.mediaHeart}"));
  assert.ok(app.includes("${ic.mediaComment}"));
  assert.ok(app.includes("${saved ? ic.mediaBookmarkOn : ic.mediaBookmark}"));
  assert.ok(app.includes("${liked ? ic.heartOn : ic.heart}"), "Community post controls keep their original heart");
  assert.ok(app.includes("${ic.comment}"), "Community post controls keep their original comment bubble");
  assert.ok(app.includes("${saved ? ic.bookmarkOn : ic.bookmark}"), "Community post controls keep their original bookmark");
  assert.ok(blast.includes('icon("mediaHeart")'));
  assert.ok(blast.includes('icon("mediaComment")'));
  assert.ok(blast.includes('icon("mediaBookmark", isSaved)'));
  assert.ok(places.includes("matrix(.3 0 0 .3 -10.8 -.45)"));
});

test("Community quick actions follow the supplied comment, repost, like, save, share order", () => {
  const app = source("app.js");
  assert.match(app, /class="community-post-actions" aria-label="Post actions">\$\{commentButton\}\$\{repostButton\}\$\{likeButton\}\$\{saveButton\}\$\{shareButton\}/);
});
