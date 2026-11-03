import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildStoryRail, storyThumb, storyMatches, renderStoryConsole } from "./chat-story-console.js";

const users = { me: { id: "me", name: "Me", following: ["f2"] }, f1: { id: "f1", name: "Ada" }, f2: { id: "f2", name: "Bo", username: "bo" },
  x: { id: "x", name: "Stranger" }, b: { id: "b", name: "Blocked" }, p: { id: "p", name: "Private" } };
const now = 1_000_000;
const stories = [
  { id: "s1", author: "f1", createdAt: now - 10, media: "/a.jpg" },
  { id: "s0", author: "f1", createdAt: now - 50 },
  { id: "s2", author: "f2", createdAt: now - 20, kind: "video", media: "/v.mp4" },
  { id: "s3", author: "x", createdAt: now - 5 },
  { id: "s4", author: "b", createdAt: now - 5 },
  { id: "s5", author: "p", createdAt: now - 5 },
  { id: "old", author: "f1", createdAt: now - 99, expired: true },
  { id: "mine", author: "me", createdAt: now - 3, media: "data:image/png;base64,AA" },
];
const base = { me: users.me, stories, user: id => users[id], isActive: s => !s.expired, canSeeStory: s => s.author !== "p",
  blocked: (a, c) => c === "b" || a === "b", areFriends: (a, c) => ["f1", "b", "p"].includes(c), thumb: s => storyThumb(s, { resolveMedia: x => x.media }) };

test("rail: own first, only accepted viewable non-blocked current stories", () => {
  const rail = buildStoryRail(base);
  assert.equal(rail.mine.storyId, "mine");
  assert.deepEqual(rail.others.map(c => c.authorId), ["f1", "f2"]);
  assert.equal(rail.others[0].storyId, "s1");
  assert.equal(rail.others[0].count, 2);
  assert.equal(rail.others[1].thumb, "", "video never used as thumbnail");
});

test("rail: own card exists without stories", () => {
  const rail = buildStoryRail({ ...base, stories: [] });
  assert.equal(rail.mine.storyId, null);
  assert.equal(rail.others.length, 0);
});

test("thumb: poster preferred, huge inline skipped", () => {
  assert.equal(storyThumb({ poster: "/p.jpg", media: "/v.mp4" }), "/p.jpg");
  assert.equal(storyThumb({ media: "data:image/png;" + "A".repeat(1_600_000) }, { resolveMedia: s => s.media }), "");
});

test("markup: Your story first, blue plus, chooser, no circles", () => {
  const esc = s => String(s).replace(/"/g, "&quot;");
  const html = renderStoryConsole(buildStoryRail(base), { esc, icons: { plus: "+", camera: "c", image: "i" }, now });
  assert.ok(html.indexOf("Your story") < html.indexOf("Ada"));
  assert.match(html, /id="csc-create"/);
  assert.doesNotMatch(html, /<div class="csc-chooser"/);
  assert.match(html, /data-story-author="f1" data-story-id="s1"/);
  assert.ok(storyMatches({ name: "Bo", username: "bo" }, "@bo"));
  const css = readFileSync(new URL("./chat-story-console.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /border-radius:\s*50%/);
  assert.match(css, /prefers-reduced-motion/);
});

test("chat.js wires the story console once and hides duplicate console badges", () => {
  const chat = readFileSync(new URL("./chat.js", import.meta.url), "utf8");
  assert.doesNotMatch(chat, /renderStoryConsole\(/);
  assert.match(chat, /renderConsole\(consoleCards/);
  assert.match(chat, /ctx\.createStory/);
  assert.match(chat, /peopleConsole\.filter\(query\)/);
  assert.match(chat, /storyConsole\.cleanup\(\)/);
});
