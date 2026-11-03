import { readFileSync } from "node:fs";
import assert from "node:assert";
import { test } from "node:test";
const js = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
test("narrow Messages headers reserve separate title and action columns",()=>{
  assert.match(css,/\.chat-list-topline\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(css,/\.chat-list-topline \.chat-head-actions\s*\{[^}]*position:static/);
  assert.doesNotMatch(readFileSync(new URL("./chat.js",import.meta.url),"utf8"),/id="saved"/);
});
test("long chat names truncate independently of verification badges",()=>{
  const chat=readFileSync(new URL("./chat.js",import.meta.url),"utf8");
  assert.match(chat,/class="chat-identity-name"/);
  assert.match(css,/\.chat-identity-name\s*\{[^}]*text-overflow:ellipsis/);
  assert.match(css,/\.chat-identity-copy \.verified\s*\{[^}]*flex:0 0 auto/);
});
test("Settings reserves separate account-name and profile-action columns",()=>{
  assert.match(css,/\.account-settings-screen \.settings-account-card\s*\{[^}]*grid-template-columns:auto minmax\(0,1fr\) auto/);
  assert.match(css,/\.account-settings-screen \.settings-account-card > span:nth-child\(2\)\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
});
test("full feed captions stay scrollable above the audio and navigation controls",()=>{
  assert.match(css,/\.clip \.meta\s*\{[^}]*bottom:calc\(144px[^}]*max-height:calc\(100% - 348px[^}]*overflow-y:auto[^}]*overscroll-behavior-y:contain/);
  assert.match(js,/<div class="meta" tabindex="0" aria-label="Post details">/);
});
test("Home keeps Stories out of the status tray", () => {
  assert.doesNotMatch(js, /class="home-story"/);
  assert.doesNotMatch(css, /\.home-stories?\b/);
});
test("story media fills the viewer and reply permissions stay in the options menu", () => {
  const interactions = readFileSync(new URL("./story-interactions.js", import.meta.url), "utf8");
  const interactionCss = readFileSync(new URL("./story-interactions.css", import.meta.url), "utf8");
  const icons = readFileSync(new URL("./icons.js", import.meta.url), "utf8");
  assert.match(js, /class="story-stage"/);
  assert.match(js, /class="story-stage-media"/);
  assert.match(interactionCss, /\.story-stage-media,[\s\S]*?object-fit:\s*cover/);
  assert.match(interactionCss, /\.storyview > \.story-stage\s*\{[^}]*inset:0/);
  assert.match(js, /class="story-header"/);
  assert.match(js, /Close Story/);
  assert.match(interactions, /class="story-more-open"/);
  assert.match(interactions, /class="story-comment-setting"/);
  assert.match(interactionCss, /\.story-more-menu\[hidden\][^{]*\{\s*display:none/);
  assert.match(interactions, /liveChat\.className = "story-live-chat"/);
  assert.match(interactions, /REPLY_FADE_MS = 6500/);
  assert.match(interactions, /className = "story-live-list"/);
  assert.match(interactions, /showReplyHistory/);
  assert.match(interactionCss, /\.story-live-message\.is-entering\s*\{[^}]*story-reply-in/);
  assert.match(interactionCss, /\.story-live-message\.is-faded\s*\{[^}]*opacity:0/);
  assert.match(interactionCss, /\.story-live-message > span\s*\{[^}]*border-radius:0[^}]*background:transparent/);
  assert.match(interactions, /liveChat\.addEventListener\("touchmove"/);
  assert.match(interactions, /liveChat\.addEventListener\("wheel"/);
  assert.match(interactions, /storyReplyFadeDelay/);
  assert.doesNotMatch(interactions, /slice\(-80\)/, "expanded history keeps every loaded Story reply");
  assert.match(interactionCss, /prefers-reduced-motion: reduce/);
  assert.match(interactions, /class="story-activity-open story-panel-tab"/);
  assert.match(interactions, /sideActions\.className = "story-side-actions"/);
  assert.doesNotMatch(interactions, /class="story-quick-reaction"/);
  assert.match(interactions, /class="story-reaction-open"/);
  assert.match(interactions, /class="story-heart"/);
  assert.match(interactions, /onShare/);
  assert.match(interactions, /story-more-menu story-sheet[\s\S]*?story-activity-open/);
  assert.match(interactions, /view\.append\(moreMenu\)/);
  assert.match(interactions, /closeReplyHistory\(true\)/);
  assert.match(interactions, /liveChat\.addEventListener\("touchcancel", finishHistoryTouch/);
  assert.match(interactionCss, /\.story-live-message\[hidden\]\s*\{[^}]*display:none!important/);
  assert.match(interactionCss, /\.story-reaction-picker\s*\{[^}]*background:transparent/);
  assert.match(icons, /more: '<circle cx="12" cy="5"[\s\S]*?cy="12"[\s\S]*?cy="19"/);
  assert.match(icons, /eye: '<path/);
  assert.match(icons, /smilePlus: '<circle/);
  assert.match(js, /id="sclose"/);
  assert.doesNotMatch(js, /id="ssave"|id="sdelete"/);
  assert.doesNotMatch(interactions, /story-close-menu|Close story/);
});
test("Story sharing opens a specific cloud Story and keeps access checks", () => {
  assert.match(js, /url\.searchParams\.set\("story", s\.id\)/);
  assert.match(js, /pendingStoryId = params\.get\("story"\)/);
  assert.match(js, /await api\.refreshCloudStories\(\)/);
  assert.match(js, /api\.canSeeStory\(story\)/);
  assert.match(js, /openStory\(story\.author, story\.id\)/);
});
test("stories share one expiry rule and the retired Hey Word prompt is absent", () => {
  const lifecycle = readFileSync(new URL("./story-lifecycle.js", import.meta.url), "utf8");
  const interactions = readFileSync(new URL("./story-interactions.js", import.meta.url), "utf8");
  const blast = readFileSync(new URL("./blast-social.js", import.meta.url), "utf8");
  const chat = readFileSync(new URL("./chat.js", import.meta.url), "utf8");
  assert.match(lifecycle, /STORY_LIFETIME_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(js, /isStoryActive\(s\)/);
  assert.match(blast, /isStoryActive\(story\)/);
  assert.match(chat, /isStoryActive\(story\)/);
  assert.doesNotMatch(interactions, /Keep on profile/);
  assert.match(interactions, /Save to profile/);
  assert.match(interactions, /onSave/);
  assert.doesNotMatch(js, /Share your take|Add yours/);
  assert.doesNotMatch(interactions, /Hey Word|hey-word/i);
});

test("Stories use quiet media preparation and media-synced playback timing", () => {
  const refinement = readFileSync(new URL("./story-visual-refinement.css", import.meta.url), "utf8");
  assert.match(js, /import "\.\/story-visual-refinement\.css"/);
  assert.match(js, /aria-label="Preparing story"/);
  assert.doesNotMatch(js, /story-cloud-loading[^\n]*Loading Story/);
  assert.match(js, /activeVideo\.addEventListener\("timeupdate"/);
  assert.match(js, /activeVideo\.addEventListener\("ended"/);
  assert.match(js, /activeVideo\.currentTime \/ duration/);
  assert.match(js, /: 5000/);
  assert.match(refinement, /story-loading-shimmer/);
  assert.match(refinement, /prefers-reduced-motion:reduce/);
});
