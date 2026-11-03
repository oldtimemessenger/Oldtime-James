import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./community-screen.css", import.meta.url), "utf8");
const iconSource = readFileSync(new URL("./icons.js", import.meta.url), "utf8");

test("Community keeps the clean header and preserves the separate non-cloud legacy tabs", () => {
  const start = source.indexOf('<header class="community-header">');
  const header = source.slice(start, source.indexOf("</header>", start));
  assert.ok(start >= 0);
  assert.match(header, /<h1>Community<\/h1>/);
  assert.match(header, /class="community-new-post[^"]*" id="community-note-open" aria-label="New post">\$\{icon\("plus"\)\}/, "New post is an accessible + icon");
  assert.match(iconSource, /edit:\s*'<path d=/);
  assert.match(iconSource, /stroke="currentColor"/);
  assert.match(source, /className: "community-post-actions-menu"/);
  assert.match(source, /data-post-edit="\$\{esc\(p\.id\)\}"[^>]*><span>Edit post<\/span>/);
  assert.match(source, /data-attach-edit="\$\{index\}"[^`]*\$\{ic\.edit\}/);
  assert.doesNotMatch(source, /community-story-section|community-story-rail|data-community-topic/);

  const tabsStart = source.indexOf('<nav class="community-feed-tabs"');
  const tabs = source.slice(tabsStart, source.indexOf("</nav>", tabsStart));
  assert.match(tabs, />Following<\/button>/);
  assert.match(tabs, />For You<\/button>/);
  assert.doesNotMatch(tabs, />Discover<\/button>/);

  assert.match(css, /\.community-header h1\s*\{[^}]*font:\s*700 21px/);
  assert.match(css, /\.community-new-post\s*\{[^}]*background:\s*#1456d9/);
  assert.match(css, /\.community-new-post\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.community-feed-tabs button\.on::after\s*\{[^}]*background:\s*#1456d9/);
  assert.match(css, /\.community-screen > \.stories-feed-scroll\s*\{\s*padding:\s*0 0 calc\(70px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.community-header\s*\{[^}]*height:\s*calc\(64px \+ env\(safe-area-inset-top, 0px\)\)/s);
  assert.match(css, /\.community-feed-tabs\s*\{[^}]*top:\s*calc\(64px \+ env\(safe-area-inset-top, 0px\)\)/s);
});

test("Community header has no Search; Search is bottom nav and Profile is top-left on Home/Community only", () => {
  for (let start = source.indexOf('<header class="community-header">'); start >= 0; start = source.indexOf('<header class="community-header">', start + 1)) {
    const header = source.slice(start, source.indexOf("</header>", start));
    assert.doesNotMatch(header, /community-search-open|aria-label="Search"/, "Community header carries no Search");
  }
  const nav = source.slice(source.indexOf('<nav class="nav '), source.indexOf("</nav>", source.indexOf('<nav class="nav ')));
  assert.match(nav, /data-tab="search"[^>]*aria-label="Search"/);
  assert.doesNotMatch(nav, /data-tab="profile"/);
  assert.match(source, /tab === "communities" \|\| \(tab === "updates" && !profileId && !viewer\)/, "header Profile shortcut is limited to Home and Community");
  assert.match(source, /data-tab="chat"[^>]*aria-label="Messages"/);
  assert.match(source, /<span class="nav-label">Messages<\/span>/);
  assert.match(css, /\.community-nav\.nav\s*\{[^}]*grid-template-columns:\s*repeat\(5/);
  const cardStart = source.indexOf("function communityPostCard(post)");
  const card = source.slice(cardStart, source.indexOf("\nfunction peopleSearchQuery", cardStart));
  assert.match(card, /class="community-post-avatar" data-profile="\$\{esc\(author\.id\)\}"/);
  assert.doesNotMatch(card, /story or profile|data-story=/);
});

test("Community post actions match the reference order and retain server actions", () => {
  const start = source.indexOf("function communityPostCard(post)");
  const card = source.slice(start, source.indexOf("\nfunction peopleSearchQuery", start));
  const like = card.indexOf('data-like="${esc(post.id)}"');
  const repost = card.indexOf('data-repost="${esc(post.id)}"');
  const comment = card.indexOf('data-comment="${esc(post.id)}"');
  const save = card.indexOf('data-save="${esc(post.id)}"');
  const share = card.indexOf('data-share="${esc(post.id)}"');
  assert.ok(like < repost && repost < comment && comment < save && save < share);
  assert.match(source, /community-post-avatar[^>]*data-profile=/);
  assert.match(css, /\.community-post-actions button\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.community-post-actions button\s*\{[^}]*justify-content:\s*center/);
});

test("Community cards use outlined profile and solid follow actions; unread markers do not tint the bell", () => {
  assert.match(css, /\.stories-phone \.people-match-actions \.people-match-view\s*\{[^}]*background:\s*transparent !important/);
  assert.match(css, /\.stories-phone \.people-match-actions \.people-match-follow\s*\{[^}]*background:\s*#17191c !important/);
  const compact = readFileSync(new URL("./compact-interface.css", import.meta.url), "utf8");
  assert.match(compact, /--notification-accent:#1456d9; --notification-red:#e02432/);
  assert.match(compact, /\.notification-filter span, \.chat-inbox-unread-dot, \.stories-notice, \.home-notification-dot \{ background:var\(--notification-red\); \}/);
  const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.home-notifications-button \{ position:relative; \}/);
  assert.doesNotMatch(styles, /\.home-notifications-button \{[^}]*color:\s*#e02432/);
  assert.doesNotMatch(source, /id="community-search-open"/, "Community has no header Search");
});
