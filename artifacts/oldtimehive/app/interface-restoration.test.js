import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { feedFollowButton } from "./feed-follow.js";
const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const app = read("./app.js");
const args = {author:{id:"creator"},me:{id:"viewer",following:["creator"]},className:"followpill",esc:String};
test("confirmed relationships decide Follow/Following, not a stale caller flag", () => {
  assert.match(feedFollowButton({...args,following:false}), />Following<\/button>/);
  assert.match(feedFollowButton({...args,me:{id:"viewer",following:[]},following:true}), />Follow<\/button>/);
  assert.doesNotMatch(app, /const following = !p\.cloud/);
});
test("owner settings opens directly and no longer offers a separate profile logout", () => {
  assert.match(app, /if \(mine\) \{ settingsView = "home"; navigateFromDrawer\("settings"\); return; \}/);
  assert.doesNotMatch(app, /id="logout"/);
});
test("Status emoji picker lives inside its full-screen overlay with a populated category", () => {
  assert.match(read("./status-capture.js"), /selectOnly: true, container: root, category: "Smileys"/);
  assert.match(read("./emoji.js"), /\(options.container \|\| document.body\).appendChild\(layer\)/);
});
test("Add story is attached to the avatar rather than a detached text row", () => {
  const source=read("./chat-inbox-console.js");
  assert.match(source, /class="cic-story-add" id="csc-create"/);
  assert.match(source, /cic-avatar-wrap">\$\{main\}\$\{c.isMe \? action/);
  assert.doesNotMatch(source, /aria-label="Add story">[^`]*<span>Add story<\/span>/);
});
test("Saved uses compact Search-style presentation and no public Reels or draft copy", () => {
  assert.doesNotMatch(read("./account-library.js"), /Reels|saved reels|posts and reels|Posts and reels/);
  assert.match(read("./account-library.css"), /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(app, /legal-draft|Draft placeholder|Placeholder: official support|Do not treat this draft/);
  const worker=read("../../api-server/src/cloudflare/worker.ts");
  assert.match(worker, /if \(path === "\/account\/library\/saved" \|\| isCommunityFeedPath/);
});
