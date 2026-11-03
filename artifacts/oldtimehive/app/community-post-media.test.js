import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMMUNITY_MAX_ATTACHMENTS, communityMediaItems, communityMediaLayout, communityGridMarkup, commentPromptLabel, addComposerFiles, rejectionMessage, moveAttachment } from "./community-post-media.js";

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const deps = { esc, sourceAttr: s => `src="${esc(s)}"`, playIcon: "<svg></svg>", handle: "travel" };
const file = (name, type) => ({ name, type });

test("only a lone video becomes the full-bleed card; photos and mixed posts use the grid", () => {
  const video = communityMediaItems({ kind: "video", mediaTypes: ["video/mp4"] }, ["a"]);
  assert.equal(communityMediaLayout(video), "video-card");
  assert.equal(communityMediaLayout(communityMediaItems({ kind: "photo", mediaTypes: ["image/jpeg"] }, ["a"])), "grid");
  const mixed = communityMediaItems({ kind: "carousel", mediaTypes: ["image/png", "video/mp4"] }, ["a", "b"]);
  assert.equal(communityMediaLayout(mixed), "grid");
  assert.deepEqual(mixed.map(i => i.video), [false, true]);
  assert.equal(communityMediaLayout([]), "none");
  // legacy post without mediaTypes keeps old meaning
  assert.equal(communityMediaLayout(communityMediaItems({ kind: "video" }, ["a"])), "video-card");
});

test("grid tiles carry attachment index for the viewer and never repeat author or caption", () => {
  const items = communityMediaItems({ mediaTypes: ["image/png", "video/mp4", "image/png"] }, ["1", "2", "3"]);
  const html = communityGridMarkup("p1", items, { ...deps, alt: "Sunset caption" });
  assert.equal((html.match(/data-media-index=/g) || []).length, 3);
  assert.match(html, /data-media-index="1"[^>]*aria-label="Open video 2 of 3/);
  assert.equal((html.match(/community-grid-play/g) || []).length, 1, "play badge only on the video tile");
  assert.doesNotMatch(html, /community-post-identity|community-post-actions/);
  assert.match(html, /data-count="3"/);
});

test("grid caps at six tiles and labels overflow from older ten-item posts", () => {
  const refs = Array.from({ length: 8 }, (_, i) => `r${i}`);
  const html = communityGridMarkup("p", communityMediaItems({ mediaTypes: refs.map(() => "image/jpeg") }, refs), deps);
  assert.equal((html.match(/community-grid-tile/g) || []).length, 6);
  assert.match(html, /\+2/);
});

test("composer accepts up to six mixed files and reports every refused file", () => {
  assert.equal(COMMUNITY_MAX_ATTACHMENTS, 6);
  const picked = [1, 2, 3, 4, 5].map(n => file(`p${n}.jpg`, "image/jpeg")).concat(file("clip.mov", "video/quicktime"), file("extra.mp4", "video/mp4"), file("notes.pdf", "application/pdf"));
  const { next, rejected } = addComposerFiles([], picked);
  assert.equal(next.length, 6);
  assert.deepEqual(next.map(i => i.kind), ["photo", "photo", "photo", "photo", "photo", "video"]);
  assert.deepEqual(rejected, [{ name: "extra.mp4", reason: "limit" }, { name: "notes.pdf", reason: "type" }]);
  const message = rejectionMessage(rejected);
  assert.match(message, /up to 6/);
  assert.match(message, /extra\.mp4/);
  assert.match(message, /notes\.pdf/);
  assert.equal(addComposerFiles(next, [file("late.jpg", "image/jpeg")]).rejected[0].reason, "limit");
});

test("reorder moves one attachment and ignores out-of-range moves", () => {
  assert.deepEqual(moveAttachment(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveAttachment(["a", "b"], 0, 5), ["a", "b"]);
});

test("comment prompt copy", () => {
  assert.equal(commentPromptLabel(0), "Be the first to comment");
  assert.equal(commentPromptLabel(3), "Add a comment");
});

test("app composer keeps the draft on failure and uploads every attachment before publishing", () => {
  const source = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const start = source.indexOf("function openCommunityNoteComposer()");
  const body = source.slice(start, source.indexOf("function communityPostCard(", start));
  assert.match(body, /accept="image\/\*,video\/\*" multiple/);
  assert.match(body, /putLocalMedia\(item\.file, item\.id\)/);
  assert.match(body, /item\.uploadedId = uploadedId/, "confirmed uploads are reused on retry");
  assert.match(body, /mediaIds\.length !== total/);
  const catchBlock = body.slice(body.indexOf("} catch (failure) {"));
  assert.doesNotMatch(catchBlock.slice(0, catchBlock.indexOf("};")), /close\(\)/, "failed send never closes the composer");
  assert.match(source, /carouselIndex\[button\.dataset\.storiesPost\] = Number\(button\.dataset\.mediaIndex\)/);
});
