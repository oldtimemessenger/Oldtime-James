import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { uploadedMediaFrame, createBackgroundForMedia } from "./creative-project.js";
import { drawBackgroundSource } from "./creative-look.js";
const source = file => readFileSync(new URL(file, import.meta.url), "utf8");

test("fresh photo and video frames keep their orientation within the existing budget", () => {
  for (const [w,h] of [[4000,3000],[1080,1920],[1920,1080],[3000,4000],[4000,4000],[2560,1080]]) {
    const frame = uploadedMediaFrame({videoWidth:w,videoHeight:h});
    assert.ok(Math.abs(frame.width/frame.height - w/h) < .004);
    assert.equal(frame.width % 2,0); assert.equal(frame.height % 2,0);
    assert.ok(Math.max(frame.width,frame.height)<=1920);
    assert.ok(frame.width*frame.height<=1080*1920);
  }
  assert.equal(uploadedMediaFrame({width:0,height:200}),null);
});
test("contain preserves all source pixels while legacy cover stays unchanged", () => {
  const draws=[]; const ctx={save(){},restore(){},translate(){},rotate(){},drawImage(...args){draws.push(args)}};
  const image={width:1600,height:900};
  drawBackgroundSource(ctx,image,1080,1920,{fit:"contain"});
  const contain=draws.pop();
  assert.deepEqual(contain.slice(1,5),[0,0,1600,900]);
  assert.equal(contain[7],1080); assert.equal(contain[8],607.5);
  assert.ok(contain[6]>0);
  drawBackgroundSource(ctx,image,1080,1920,{});
  assert.ok(draws.pop()[7]>1080);
  drawBackgroundSource(ctx,image,1080,1920,{fit:"contain",geometry:{rotate:90,straighten:12}});
  const rotated=draws.pop();
  assert.ok(rotated.every(v=>typeof v!=="number"||Number.isFinite(v)));
});
test("contain is explicit for new uploads, not a rewrite of existing projects", () => {
  assert.equal(createBackgroundForMedia(null,"photo","x","#fff").fit,undefined);
  assert.equal(createBackgroundForMedia(null,"photo","x","#fff",{fit:"contain"}).fit,"contain");
  const editor=source("./creative-editor.js");
  assert.match(editor,/adoptFrame && !initialProject && !project\.layers\.length/);
  assert.match(editor,/adoptFrame: !initialProject/);
});
test("Status starts with choices and reuses the existing gallery artwork", () => {
  const status=source("./status-capture.js"), app=source("./app.js");
  assert.match(status,/source = "landing"/);
  assert.match(status,/assets\/gallery-glyph\.png/);
  assert.match(status,/data-testid="status-choice"/);
  assert.match(app,/mediaPicker\?"gallery":"landing"/);
  assert.match(status,/captureSequence !== openSeq/);
});
