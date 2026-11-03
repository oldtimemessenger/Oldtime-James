import test from "node:test";
import assert from "node:assert/strict";
import {timelineLanes,trimLayerTiming,moveLayerTiming,timeAtFraction,STUDIO_TOOLS} from "./creative-studio-workspace.js";
import {createProject,createLayer} from "./creative-project.js";

test("lanes are backed by actual project content",()=>{
  const p=createProject();p.duration=8;
  p.background={kind:"video",media:"v",videoEdit:{sourceDuration:10,clips:[{id:"a",in:0,out:4,speed:1},{id:"b",in:6,out:8,speed:.5}]}};
  p.layers=[createLayer("text",{id:"t",text:"Hello",startTime:1,endTime:3}),createLayer("image",{id:"o",media:"x"}),createLayer("emoji",{id:"e",text:"x"}),
    createLayer("image",{id:"cut",subjectCutout:true,subjectForTextId:"t"})];
  p.audioTracks=[{id:"s",title:"Porch song",media:"m"}];
  const lanes=timelineLanes(p);
  assert.deepEqual(lanes.media.map(c=>[c.id,c.start,c.end]),[["a",0,4],["b",4,8]]);
  assert.deepEqual(lanes.text.map(i=>[i.id,i.start,i.end,i.label]),[["t",1,3,"Hello"]]);
  assert.deepEqual(lanes.overlay.map(i=>i.id),["o","e"]);
  assert.deepEqual(lanes.audio.map(i=>i.kind),["sound","original"]);
  p.background.audioMuted=true;assert.equal(timelineLanes(p).audio[1].muted,true);
  p.background={kind:"photo",media:"ph"};p.audioTracks=[];
  assert.deepEqual(timelineLanes(p).media.map(i=>i.kind),["photo"]);assert.equal(timelineLanes(p).audio.length,0,"photos need no sound");
});
test("trim keeps a minimum length inside the project, move preserves length",()=>{
  const l=createLayer("text",{startTime:1,endTime:3});
  trimLayerTiming(l,"start",2.95,5);assert.ok(Math.abs(l.startTime-2.9)<1e-9);
  trimLayerTiming(l,"start",-3,5);assert.equal(l.startTime,0);
  trimLayerTiming(l,"end",9,5);assert.equal(l.endTime,5);
  trimLayerTiming(l,"end",-1,5);assert.ok(Math.abs(l.endTime-.1)<1e-9);
  const m=createLayer("text",{startTime:1,endTime:3});
  moveLayerTiming(m,4.5,5);assert.deepEqual([m.startTime,m.endTime],[3,5]);
  moveLayerTiming(m,-2,5);assert.deepEqual([m.startTime,m.endTime],[0,2]);
});
test("scrub maps fractions to clamped time and the seven bottom tools exist",()=>{
  assert.equal(timeAtFraction(.5,8),4);assert.equal(timeAtFraction(2,8),8);assert.equal(timeAtFraction(-1,8),0);
  assert.deepEqual(STUDIO_TOOLS.map(t=>t[1]),["Edit","Audio","Text","Overlay","Filters","Adjust","Canvas"]);
});
