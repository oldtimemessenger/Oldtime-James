import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {feedFollowButton} from "./feed-follow.js";
const me = {id:"me"}, author = {id:"other",name:"A member",cloudAccountId:"cloud-account"};
const render = extra => feedFollowButton({me,author,className:"followpill",esc:String,...extra});
test("Home shows Follow for a cloud-backed author", () => {
  assert.match(render({}), /data-follow="other"[^>]*aria-pressed="false"/);
  assert.match(render({}), />Follow<\/button>/);
});
test("Following remains visible instead of disappearing", () => {
  assert.match(render({following:true}), /aria-pressed="true"/);
  assert.match(render({following:true}), />Following<\/button>/);
});
test("feed Follow and Following share a white outline without a colored fill", () => {
  const css = readFileSync(new URL("./quiet-interface.css",import.meta.url),"utf8");
  assert.match(css,/#app \.home-screen :is\(\.followpill,\.followchip\)\{[^}]*min-height:48px[^}]*background:transparent;color:#fff/);
  assert.match(css,/#app \.home-screen :is\(\.followpill,\.followchip\)::before\{[^}]*border:1\.5px solid #fff/);
  assert.match(css,/:is\(:hover,:active,\[aria-pressed=true\]\)\{background:transparent;color:#fff/);
});
test("pending requests and self posts have the appropriate action", () => {
  assert.match(render({requests:[{from:"me",to:"other"}]}), />Requested<\/button>/);
  assert.equal(render({author:me}),"");
});
test("only Community suggestion buttons receive the smaller treatment", () => {
  const css = readFileSync(new URL("./community-feeds.css",import.meta.url),"utf8");
  assert.match(css,/\.cf-person-actions \{[^}]*grid-template-columns:minmax\(0,1fr\)[^}]*max-width:100%/);
  assert.match(css,/\.cf-person-actions \.cf-follow \{[^}]*background:#111[^}]*border:4px solid transparent/);
  assert.match(css,/\.cf-person-actions button \{[^}]*min-height:48px/);
});
test("chat details omit profile shortcuts and retain follow, mute and voice rows", () => {
  const source = readFileSync(new URL("./chat.js",import.meta.url),"utf8");
  assert.doesNotMatch(source,/id="profile-shortcut"|id="search-shortcut"/);
  assert.match(source,/id="contact-follow"/);
  assert.match(source,/id="mute-shortcut" aria-haspopup="menu"/);
  assert.match(source,/class="shared-file-row"/);
  assert.doesNotMatch(source,/class="contact-presence">On Oldtime/);
});
