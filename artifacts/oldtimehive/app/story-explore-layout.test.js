import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const chat = readFileSync(new URL("./chat.js", import.meta.url), "utf8");
const store = readFileSync(new URL("./store.js", import.meta.url), "utf8");
const places = readFileSync(new URL("./places-view.js", import.meta.url), "utf8");
const explore = readFileSync(new URL("./explore-ecosystem.js", import.meta.url), "utf8");
const saved = readFileSync(new URL("./saved-sheets.js", import.meta.url), "utf8");
const shared = readFileSync(new URL("./shared-content.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const discoveryStyles = readFileSync(new URL("./search-discovery.css", import.meta.url), "utf8");
const ecosystemStyles = readFileSync(new URL("./explore-ecosystem.css", import.meta.url), "utf8");

test("Search People flows in two columns and Home has no recommendation dots", () => {
  assert.match(discoveryStyles, /\.xe-people-list\.xe-people-card-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(discoveryStyles, /\.xe-people-list\.xe-people-card-grid\s*\{[^}]*grid-auto-flow:\s*row/);
  assert.doesNotMatch(app, /<details class="feed-recommendation-menu"/);
});

test("Home is a plain feed without a status tray or layered hub", () => {
  const header = app.slice(app.indexOf('<header class="home-discovery-header">'), app.indexOf("</header>`}", app.indexOf('<header class="home-discovery-header">')));
  assert.doesNotMatch(header, /home-topic-tabs/);
  assert.doesNotMatch(app, /homeStoriesMarkup|home-hub|homeHub|data-home-story-author|class="stories home-stories"/);
  assert.doesNotMatch(styles, /home-hub|home-hub-progress|stories-scrolled/);
  assert.match(app, /openPersonAvatar\(b\.dataset\.avatarProfile\)/);
  assert.match(chat, /buildStoryRail\(/);
  assert.match(chat, /bindStoryConsole\(ctx\.app,storyRail,\{openStory:ctx\.openStory/);
  const views = app.slice(app.indexOf("const HOME_VIEWS = ["), app.indexOf("const HOME_TOPICS = ["));
  assert.match(views, /\{ id: "explore", label: "For You" \}/);
  assert.match(views, /\{ id: "following", label: "Following" \}/);
  assert.doesNotMatch(views, /Places/);
  assert.match(app, /data-discovery-home-topic="\$\{esc\(topic\.id\)\}"/);
});

test("Discover uses one topic bar, keeps browse controls, and never labels the page Stories", () => {
  const screen = app.slice(app.indexOf("function search()"), app.indexOf("\nfunction notes()", app.indexOf("function search()")));
  assert.match(screen, /<header class="community-header search-app-header">[\s\S]*?<h1>Search<\/h1>/);
  assert.doesNotMatch(screen, /<h1>Stories<\/h1>|class="discovery-tabs"/);
  assert.match(screen, /class="discovery-home-topic-tabs"/);
  assert.match(screen, /class="discovery-filter-button"/);
  assert.doesNotMatch(screen, /discoveryStoryRail|data-discovery-story/);
  assert.match(explore, /\["engagement", "Most interacted"\]/);
  assert.match(explore, /\["shuffle", "Shuffle"\]/);
  assert.match(screen, /data-discovery-home-topic="\$\{esc\(topic\.id\)\}"/);
  assert.match(screen, /data-discovery-explore-topic="\$\{esc\(topic\.id\)\}"/);
  assert.match(screen, /data-search-section="people"/);
  assert.match(screen, /data-search-section="places"/);
  assert.match(screen, /id="discovery-search-toggle"/);
  assert.doesNotMatch(screen, /discovery-stories-heading"><h2>Following<\/h2><span>Stories/);
});

test("Messages Stories use standard active and close-friends rings with the shared viewer", () => {
  assert.match(chat, /isStoryActive\(story\) && api\.canSeeStory\(story\)/);
  // Notes and story viewer actions share a single rectangular card per person.
  const consoleJs = readFileSync(new URL("./chat-inbox-console.js", import.meta.url), "utf8");
  assert.match(consoleJs, /data-story-author="\$\{esc\(c\.id\)\}"/);
  assert.match(consoleJs, /c\.story\?\.closeFriends \? " is-close"/);
  assert.match(chat, /storyByAuthor/);
  assert.match(chat, /ctx\.openStory\(button\.dataset\.inboxStory\)/);
});

test("Search removes Stories without removing the Messages Stories viewer", () => {
  assert.doesNotMatch(app, /discoveryStoryRail|bindDiscoveryStoryPreviews|loadCloudStoryPreview/);
  assert.match(chat, /buildStoryRail\(/);
  assert.match(chat, /bindStoryConsole\(ctx\.app,storyRail,\{openStory:ctx\.openStory/);
  assert.match(store, /async loadCloudStoryPreview\(id\)/);
  assert.match(app, /<h1>Search<\/h1>/);
  assert.doesNotMatch(app, /<h1>Stories<\/h1>/);
});

test("Explore media grids are two columns on mobile for both local and cloud data", () => {
  assert.match(discoveryStyles, /\.explore-feed-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(ecosystemStyles, /\.xe-grid,\s*\.xe-skeleton\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test("the built-in avatar fallback is never treated as post media", () => {
  assert.match(app, /const stored = postMediaReferences\(post\)/);
  assert.match(store, /post\.media\.filter\(item => !isDefaultAvatarMediaReference\(item\?\.reference\)\)/);
  assert.match(places, /return reference && !isDefaultAvatarMediaReference\(reference\)/);
  assert.match(explore, /isDefaultAvatarMediaReference\(rawMedia\) \? "" : rawMedia/);
  assert.match(saved, /isDefaultAvatarMediaReference\(image\) \? "" : safeUrl\(image\)/);
  assert.match(shared, /isDefaultAvatarMediaReference\(imageReference\) \? "" : safeImage\(imageReference\)/);
});
