import test from "node:test";
import assert from "node:assert/strict";
import {FILTER_PRESETS,ADJUSTMENTS,readLook,writeLook,setPreset,setAdjust,resetAdjust,resetAllAdjust,effectiveAdjust,lookActive,clampAdjust,clampIntensity,migrateLook,applyLookPixels,gradePixel,readGeometry,geometryScale,lookWorkSize,syncLookMarker} from "./creative-look.js";
import {originalPublicationMedia} from "./media-publication.js";
import {ProjectHistory,createProject,createBackgroundForMedia} from "./creative-project.js";

test("twenty original named presets with unique ids",()=>{
  assert.equal(FILTER_PRESETS.length,20);
  assert.equal(new Set(FILTER_PRESETS.map(p=>p.id)).size,20);
  assert.equal(new Set(FILTER_PRESETS.map(p=>p.name)).size,20);
  for(const p of FILTER_PRESETS)for(const [k,v] of Object.entries(p.adjust))assert.equal(clampAdjust(k,v),v,`${p.id}.${k} in range`);
});
test("preset intensity scales and clamps",()=>{
  const bg={kind:"photo",media:"m"};
  setPreset(bg,"ledger",50);assert.equal(effectiveAdjust(bg.look).saturation,-50);
  setPreset(bg,"ledger",250);assert.equal(bg.look.intensity,100);
  setPreset(bg,"ledger",-4);assert.equal(bg.look.intensity,0);assert.equal(lookActive(bg.look),false);
  setPreset(bg,"not-real");assert.equal(bg.look.preset,"none");
  assert.equal(clampIntensity("abc"),0);
  setAdjust(bg,"saturation",-90);setPreset(bg,"ledger",100);assert.equal(effectiveAdjust(bg.look).saturation,-100,"sum is clamped");
});
test("adjustments clamp, reset individually and all at once",()=>{
  const bg={kind:"photo",media:"m"};
  assert.equal(ADJUSTMENTS.length,11);
  setAdjust(bg,"exposure",400);assert.equal(bg.look.adjust.exposure,100);
  setAdjust(bg,"grain",-30);assert.equal(bg.look.adjust.grain,0);
  setAdjust(bg,"warmth",40);resetAdjust(bg,"warmth");assert.equal(bg.look.adjust.warmth,0);assert.equal(bg.look.adjust.exposure,100);
  setPreset(bg,"harbor",70);resetAllAdjust(bg);
  assert.ok(Object.values(bg.look.adjust).every(v=>v===0));assert.equal(bg.look.preset,"harbor","reset-all keeps the filter");
});
test("legacy percentage adjustments migrate and history round-trips the look",()=>{
  const bg={kind:"photo",media:"m",adjustments:{brightness:120,contrast:100,saturation:0}};
  assert.equal(readLook(bg).adjust.brightness,20);
  migrateLook(bg);assert.equal(bg.adjustments,undefined);assert.equal(bg.look.adjust.saturation,-100);assert.ok(bg.filter);
  const project=createProject();project.background={kind:"photo",media:"m"};
  const history=new ProjectHistory(project);history.record();setAdjust(project.background,"contrast",30);
  assert.equal(history.undo(),true);assert.equal(readLook(project.background).adjust.contrast,0);
  assert.equal(history.redo(),true);assert.equal(project.background.look.adjust.contrast,30);
});
test("camera look carries onto captured media",()=>{
  const cam={kind:"video",media:"live-camera"};setPreset(cam,"porch",60);
  const bg=createBackgroundForMedia(cam,"photo","shot","#000");
  assert.deepEqual(bg.look,cam.look);
});
test("pixel math: neutral is identity, controls move in the expected direction, alpha untouched",()=>{
  const zero=effectiveAdjust(readLook({}));
  assert.deepEqual(gradePixel(.4,.5,.6,zero).map(v=>+v.toFixed(5)),[.4,.5,.6]);
  const px=()=>new Uint8ClampedArray([200,100,50,77]);
  const run=look=>applyLookPixels(px(),1,1,look);
  assert.ok(run({adjust:{exposure:60}})[0]>=200&&run({adjust:{exposure:60}})[1]>100);
  const gray=run({adjust:{saturation:-100}});assert.ok(Math.abs(gray[0]-gray[2])<=1);
  assert.ok(run({adjust:{warmth:80}})[0]>run({adjust:{warmth:-80}})[0]);
  assert.ok(run({adjust:{tint:80}})[1]<run({adjust:{tint:-80}})[1]);
  assert.equal(run({preset:"tintype"})[3],77);
  const big=new Uint8ClampedArray(9*9*4).fill(128);applyLookPixels(big,9,9,{adjust:{vignette:100}});
  assert.ok(big[0]<big[(4*9+4)*4],"vignette darkens corners");
});
test("geometry: rotation normalises, straighten scales to cover, preview work is bounded",()=>{
  assert.deepEqual(readGeometry({transform:{rotate:450,straighten:90}}),{rotate:90,straighten:45});
  assert.equal(geometryScale(100,100,100,100,0,0),1);
  assert.ok(geometryScale(100,100,100,100,0,10)>1);
  const s=lookWorkSize(1080,1920,900_000);assert.ok(s.width*s.height<=900_000);
  assert.deepEqual(lookWorkSize(1080,1920),{width:1080,height:1920});
});
test("an edited look forces a rendered upload instead of reusing the untouched original",()=>{
  const blob=new Blob(["x"],{type:"image/png"}),project=createProject();
  project.background={kind:"photo",media:"blob:a"};
  const blobs=new Map([["blob:a",blob]]),asset={naturalWidth:1080,naturalHeight:1920};
  assert.equal(originalPublicationMedia(project,blobs,asset),blob);
  setPreset(project.background,"matinee");assert.equal(originalPublicationMedia(project,blobs,asset),null);
  setPreset(project.background,"none");assert.equal(originalPublicationMedia(project,blobs,asset),blob);
  project.background.transform={rotate:90};syncLookMarker(project.background);assert.equal(originalPublicationMedia(project,blobs,asset),null);
  writeLook(project.background,{});
});
