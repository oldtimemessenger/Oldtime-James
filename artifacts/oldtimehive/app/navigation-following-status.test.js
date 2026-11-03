import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {followingPosts,relationshipPosts} from "./feed-posts.js";
import {isFeedHomePost} from "./post-surfaces.js";
const read=name=>readFileSync(new URL(name,import.meta.url),"utf8");
const app=read("./app.js"),store=read("./store.js"),css=read("./status-capture.css");
test("Search replaces Profile in bottom navigation; Profile is only in Home and Community headers",()=>{
  const nav=app.slice(app.indexOf('<nav class="nav ${light'),app.indexOf('</nav>',app.indexOf('<nav class="nav ${light')));
  assert.match(nav,/data-tab="search"/);assert.doesNotMatch(nav,/data-tab="profile"/);
  assert.match(app,/class="app-profile-shortcut" data-tab="profile"/);
  assert.match(app,/\.home-primary-row, \.community-header/);
  const shell=app.slice(app.indexOf("function shell("));
  assert.match(shell,/if \(!hideNav && \(tab === "communities" \|\| \(tab === "updates" && !profileId && !viewer\)\)\)/);
  const decoration=shell.slice(0,shell.indexOf('if (document.querySelector(".emoji-overlay"))'));
  assert.doesNotMatch(decoration,/chat-list-topline|search-app-header/);
  assert.ok(shell.indexOf("inner = inner.replace")<shell.indexOf("reconcileActiveScreen"),
    "the header shortcut belongs in both full and reconciled render markup");
  assert.match(shell,/profileShortcut\.onclick = \(\) => navigateMainSection\("profile"\)/);
  assert.match(app,/if \(communitiesScreen\) header\.querySelectorAll\("\.community-search-button"\).*button\.remove\(\)/);
});
test("shared header decoration leaves Search and Messages markup unchanged",()=>{
  const start=app.indexOf("function shell(");
  const prefix=app.slice(start,app.indexOf('  if (document.querySelector(".emoji-overlay"))',start));
  const decorate=tab=>Function("api","tab","profileId","viewer","chatId","ic","profileMediaSource",
    `${prefix}return inner;}return shell;`)({me:()=>({avatar:""})},tab,null,null,null,{user:"<svg></svg>"},()=>"");
  const search=app.match(/<header class="community-header search-app-header">[\s\S]*?<\/header>/)[0];
  const messages='<div class="chat-list-topline"><h1>Messages</h1><div class="chat-head-actions">Existing controls</div></div>';
  assert.equal(decorate("search")(search),search);
  assert.equal(decorate("chat")(messages),messages);
  const community='<header class="community-header"><h1>Community</h1></header>';
  const home='<div class="home-primary-row"><nav>Following · For You</nav></div>';
  assert.equal((decorate("communities")(community).match(/button-header-profile/g)||[]).length,1);
  assert.equal((decorate("updates")(home).match(/button-header-profile/g)||[]).length,1);
});
test("Following fails closed on cold relationship hydration even with an already-labelled shared cache",()=>{
  const start=store.indexOf("  ranked(mode) {");
  const method=store.slice(start,store.indexOf("\n};",start));
  const posts=[{id:"followed",author:"friend"},{id:"unexpected",author:"stranger"},{id:"own",author:"me"}];
  const ranked=Function("getCloudSession","cloudCommunityFeed","cloudFeed","followingPosts","relationshipPosts","cloudFeedSurface",
    `return ({${method}}).ranked`)(()=>true,[],posts,followingPosts,relationshipPosts,"following");
  const ctx={me:()=>({id:"me",following:["friend"]}),canSeePost:()=>true,cloudRelationshipsLoaded:()=>false};
  assert.deepEqual(ranked.call(ctx,"following").map(p=>p.id),["followed"]);
  ctx.me=()=>({id:"me",following:[]});
  assert.deepEqual(ranked.call(ctx,"following"),[]);
});
test("Home Following never contains Community or dual-surface posts, even from a followed author",()=>{
  const posts=["main","community","both"].map(destination=>({id:destination,author:"friend",destination,kind:"photo",media:["image"]}));
  assert.deepEqual(followingPosts(posts.filter(isFeedHomePost),{id:"me",following:["friend"]}).map(p=>p.id),["main"]);
  assert.match(app,/if \(homeView === "following"\) posts = followingPosts\(posts, me\)/);
});
test("Status textarea explicitly overrides global focus outlines without disabling normal text editing",()=>{
  assert.match(css,/\.sc-root \.sc-textarea:focus-visible\s*\{[^}]*outline:none!important[^}]*box-shadow:none!important[^}]*touch-action:pan-y/s);
  assert.match(css,/user-select:text/);
  const status=read("./status-capture.js");
  assert.doesNotMatch(status,/pinchTo|makeDraggable|resizeHandle|rotateHandle/);
  assert.match(status,/while \(ta\.scrollHeight > maxHeight && size > 16\)/);
  assert.match(status,/requestAnimationFrame\(fitField\)/);
});
