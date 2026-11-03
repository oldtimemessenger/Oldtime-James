import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderCommunityAnnouncementCard, selectCommunityAnnouncementCards } from "./feed-announcement-cards.js";

const esc = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

test("community announcement cards use only active, optional Oldtime feature categories and return one at a time", () => {
  const items = [
    { id: "feature-one", title: "Camera", description: "Create a post.", category: "feature", optional: true, primaryRoute: "updates", primaryLabel: "Open Camera" },
    { id: "creator-two", title: "Creator tools", description: "Share a video.", category: "creator", optional: true, primaryRoute: "updates", primaryLabel: "Explore" },
    { id: "offer", title: "Offer", description: "Join.", category: "membership", optional: true, primaryRoute: "blue-badge", primaryLabel: "Learn more" },
    { id: "required", title: "Service", description: "Read this.", category: "service", optional: false, primaryRoute: "updates", primaryLabel: "Read" },
    { id: "disabled", title: "Old feature", description: "No longer active.", category: "community", optional: true, enabled: false, primaryRoute: "communities", primaryLabel: "Open" },
  ];
  assert.deepEqual(selectCommunityAnnouncementCards(items, null).map(item => item.id), ["feature-one"]);
});

test("community announcement card escapes campaign copy and uses native Oldtime labels", () => {
  const item = {
    id: "welcome-old-time", category: "welcome", title: "<New feature>",
    description: "Keep <your> community close.", primaryLabel: "Explore Oldtime",
    primaryRoute: "updates", optional: true,
  };
  const html = renderCommunityAnnouncementCard(item, {
    esc,
    icons: { home: '<svg class="navic"></svg>', users: '<svg class="navic"></svg>', close: '<svg class="navic"></svg>' },
    baseUrl: "/oldtimehive/",
  });
  assert.match(html, /Official Oldtime update/);
  assert.match(html, /\/oldtimehive\/announcements\/community\.jpg/);
  assert.match(html, /community-announcement-category-icon/);
  assert.match(html, /&lt;New feature&gt;/);
  assert.match(html, /Keep &lt;your&gt; community close\./);
  assert.doesNotMatch(html, /community-announcement-panel/);
  assert.doesNotMatch(html, /Bluesky|Suno|TikTok|@creator|4\.3K|likes/);
});

test("a completed campaign is not selected again for that account", () => {
  const item = { id: "welcome-old-time", title: "Welcome", description: "Explore.", category: "welcome", optional: true, primaryRoute: "updates", primaryLabel: "Explore" };
  assert.deepEqual(selectCommunityAnnouncementCards([item], { items: { "welcome-old-time": { viewedAt: 123 } } }), []);
});

test("a recently shown campaign suppresses another card for three days", () => {
  const items = [
    { id: "welcome-old-time", title: "Welcome", description: "Explore.", category: "welcome", optional: true, primaryRoute: "updates", primaryLabel: "Explore" },
    { id: "feature-one", title: "Camera", description: "Create.", category: "feature", optional: true, primaryRoute: "updates", primaryLabel: "Open" },
  ];
  const now = 1_000_000_000;
  assert.deepEqual(selectCommunityAnnouncementCards(items, { lastShownAt: now - 24 * 60 * 60 * 1000 }, now), []);
  assert.deepEqual(selectCommunityAnnouncementCards(items, { lastShownAt: now - 72 * 60 * 60 * 1000 }, now).map(item => item.id), ["welcome-old-time"]);
});

test("announcement actions use the current brand colors independently of black sign-in buttons", () => {
  const css = readFileSync(new URL("./feed-announcement-cards.css", import.meta.url), "utf8");
  assert.ok(css.includes("background: var(--color-primary, #1456d9);"));
  assert.ok(css.includes("background: var(--color-primary-pressed, #1048bd);"));
  assert.ok(!css.includes("linear-gradient(180deg, #ed3545"));
});
