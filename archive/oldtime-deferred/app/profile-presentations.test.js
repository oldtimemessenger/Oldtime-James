import assert from "node:assert/strict";
import test from "node:test";
import { renderCollectionShelf, renderQuoteStrip, renderQuoteViewer } from "./profile-presentations.js";

test("quote shelf supports local media and horizontal card navigation", () => {
  const html = renderQuoteStrip([{
    id: "q-1",
    text: "A line worth keeping",
    author: "A Person",
    authorPhoto: "https://cdn.example/avatar.jpg",
    media: ["oldtime-media:abc-123"],
    created: 1_800_000_000_000,
  }]);
  assert.match(html, /data-testid="quote-strip"/);
  assert.match(html, /data-quote-open="q-1"/);
  assert.match(html, /data-local-media="oldtime-media:abc-123"/);
});

test("quote viewer provides full-screen navigation, author photo, and a share action", () => {
  const html = renderQuoteViewer([
    { id: "q-1", text: "First", author: "A Person", authorPhoto: "https://cdn.example/avatar.jpg" },
    { id: "q-2", text: "Second", author: "A Person" },
  ], 0);
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /data-quote-prev[^>]*disabled/);
  assert.match(html, /data-quote-next/);
  assert.match(html, /data-quote-swipe/);
  assert.match(html, /data-quote-share="q-1"/);
  assert.match(html, /https:\/\/cdn\.example\/avatar\.jpg/);
});

test("quote shelf keeps long copy collapsed accessibly and exposes post actions", () => {
  const html = renderQuoteStrip([{
    id: "q-actions", text: "A thoughtful line ".repeat(14), caption: "A longer context ".repeat(8),
    likes: 13, comments: 4, reposts: 2, liked: true,
    icons: { heart: "<svg></svg>", comment: "<svg></svg>", repost: "<svg></svg>", share: "<svg></svg>" }
  }]);
  assert.match(html, /data-quote-open="q-actions"/);
  assert.match(html, /<summary>See more<\/summary>/);
  assert.match(html, /data-quote-like="q-actions"/);
  assert.match(html, /data-quote-comments="q-actions"/);
  assert.match(html, /data-quote-repost="q-actions"/);
  assert.match(html, /aria-pressed="true"/);
});

test("profile quote and collection content is escaped", () => {
  const quotes = renderQuoteStrip([{ id: "<q>", text: "<script>alert(1)</script>", author: "A&B" }]);
  const collection = renderCollectionShelf([{
    id: "a-1", type: "memory", title: "<Memory>", description: "<img src=x onerror=alert(1)>",
    items: [{ id: "m-1", postId: "p-1", media: "https://cdn.example/photo.jpg", caption: "safe" }],
  }], { selectedId: "a-1" });
  assert.doesNotMatch(quotes, /<script>/);
  assert.match(quotes, /&lt;script&gt;/);
  assert.doesNotMatch(collection, /<img src=x onerror=/);
  assert.match(collection, /&lt;Memory&gt;/);
  assert.match(collection, /data-post-id="p-1"/);
});

test("collection shelf supports creation and shows only selected recent media", () => {
  const shelf = renderCollectionShelf([], { showCreate: true });
  assert.match(shelf, /data-collection-create/);
  const detail = renderCollectionShelf([{
    id: "a-1", type: "album", title: "Summer", description: "Family days",
    items: [{ id: "m-1", postId: "p-1", media: "https://cdn.example/photo.jpg", mediaType: "image", caption: "Beach" }],
  }], { selectedId: "a-1", canDelete: true });
  assert.match(detail, /data-testid="collection-grid"/);
  assert.match(detail, /data-collection-close/);
  assert.match(detail, /data-collection-delete="a-1"/);
  assert.match(detail, /data-collection-item="m-1"/);
});
