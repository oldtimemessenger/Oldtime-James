import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homeStatusStories } from "../app/feed-posts.js";

test("a new account never gets another member's public Status on Home", () => {
  const stories = [
    { id:"own", author:"new-account" },
    { id:"unrelated", author:"unknown-person", visibility:"public" },
    { id:"discovery-cache", author:"other", repostedByFollowing:true },
  ];
  assert.deepEqual(homeStatusStories(stories, {id:"new-account",following:[]}).map(s=>s.id), ["own"]);
  assert.deepEqual(homeStatusStories(stories, null), []);
});

test("Home permits own and explicitly followed Status authors, not friends or reposts alone", () => {
  const me = {id:"me",cloudAccountId:"my-cloud-id",following:["followed"],friends:["friend-only"]};
  const stories = [
    {id:"own",author:"me"}, {id:"own-cloud",author:"my-cloud-id"},
    {id:"followed",author:{id:"followed"}}, {id:"friend-only",author:"friend-only"},
    {id:"unknown",authorId:"unknown",repostedByFollowing:true},
    {id:"missing-author"},
  ];
  assert.deepEqual(homeStatusStories(stories,me).map(s=>s.id),["own","own-cloud","followed"]);
  assert.deepEqual(homeStatusStories(stories,{...me,following:[]}).map(s=>s.id),["own","own-cloud"]);
});

test("Home display and next/previous Status navigation share the same filter", () => {
  const source = readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
  assert.match(source, /const stories = homeStatusStories\(api\.stories\(\)\.filter\(s => isStoryActive\(s\) && api\.canSeeStory\(s\)\), me\)/);
  assert.match(source, /openStory\(button\.dataset\.homeStoryAuthor, button\.dataset\.homeStoryId, \{ source: "home" \}\)/);
  assert.match(source, /if \(source === "home"\) visibleStories = homeStatusStories\(visibleStories, api\.me\(\)\)/);
});
