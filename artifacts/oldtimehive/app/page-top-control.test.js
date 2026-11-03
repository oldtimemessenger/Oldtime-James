import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowPageTop } from "./page-top-control.js";
import { readFileSync } from "node:fs";

test("back to top appears only after meaningful vertical page scrolling",()=>{
  assert.equal(shouldShowPageTop(0,600,4000),false);
  assert.equal(shouldShowPageTop(600,600,4000),false);
  assert.equal(shouldShowPageTop(901,600,4000),true);
  assert.equal(shouldShowPageTop(400,220,2000),false);
  assert.equal(shouldShowPageTop(601,220,2000),true);
  assert.equal(shouldShowPageTop(1000,100,2000),false);
  assert.equal(shouldShowPageTop(1000,600,600),false);
});

test("posted-video controls cover Places, post details, Community attachments and profile playback",()=>{
  const app=readFileSync(new URL("./app.js",import.meta.url),"utf8");
  const detail=readFileSync(new URL("./post-detail.css",import.meta.url),"utf8");
  assert.doesNotMatch(app,/p\.kind === "video" && !placesViewer \? `<button type="button" class="clip-float-control"/);
  assert.doesNotMatch(detail,/\.clip\.post-detail > \.clip-float-control,/);
  assert.match(app,/const hasVideo = mediaMarkup\.includes\("<video "\)/);
  assert.match(app,/data-video-profile data-video-float/);
  assert.match(app,/floatingVideoOwner !== api\.me\(\)\?\.id/);
  assert.match(app,/if \(floatingVideoCleanup\) \{ vids\.forEach\(video => video\.pause\(\)\); return; \}/);
});
