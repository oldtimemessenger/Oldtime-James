import test from "node:test";
import assert from "node:assert/strict";
import {drawProject,orderCreativeLayers} from "./creative-renderer.js";
import {createProject,createBackgroundForMedia,createLayer} from "./creative-project.js";
test("text-behind-subject keeps its cutout directly above the text after layer reordering",()=>{
  const text=createLayer("text",{id:"caption",behindSubject:true});
  const foreground=createLayer("image",{id:"person",subjectCutout:true,subjectForTextId:text.id});
  const overlay=createLayer("image",{id:"overlay"});
  assert.deepEqual(orderCreativeLayers([foreground,overlay,text]).map(layer=>layer.id),["overlay","caption","person"]);
});
test("photo looks run through the shared look stage for both the background and its subject cutout",()=>{
  const project=createProject(),image={naturalWidth:360,naturalHeight:640},drawn=[],applied=[],toned=[];
  project.background={kind:"photo",media:"owned-photo",adjustments:{saturation:0,brightness:100,contrast:100}};
  project.layers=[createLayer("image",{media:"owned-cutout",subjectCutout:true,width:1080,height:1920})];
  const work={width:0,height:0,getContext:()=>({clearRect(){},fillRect(){},save(){},restore(){},drawImage(){},translate(){},scale(){},rotate(){}})};
  const graded={graded:true};
  const assets={get:()=>image,createLookWork:()=>work,createLookStage:()=>({apply:(src,look)=>{applied.push(look);return graded;}}),toneSubject:(img,look)=>{toned.push(look);return {toned:true};}};
  const ctx={clearRect(){},save(){},restore(){},scale(){},fillRect(){},translate(){},rotate(){},drawImage(src){drawn.push(src);}};
  drawProject({width:1080,height:1920,getContext:()=>ctx},project,assets,()=>null,0,null,{preview:true,maxLookPixels:500_000});
  assert.equal(applied.length,1);assert.equal(applied[0].adjust.saturation,-100);
  assert.equal(drawn[0],graded);assert.equal(toned.length,1);assert.deepEqual(toned[0],applied[0]);
  assert.ok(work.width*work.height<=500_000,"preview work is bounded");
  // Export (no preview cap) renders at full project size through the same stage.
  drawProject({width:1080,height:1920,getContext:()=>ctx},project,assets,()=>null,0,null);
  assert.equal(applied.length,2);
  // Compare bypasses the look without mutating the project.
  const before=JSON.stringify(project);
  drawProject({width:1080,height:1920,getContext:()=>ctx},project,assets,()=>null,0,null,{preview:true,bypassLook:true});
  assert.equal(applied.length,2);assert.equal(JSON.stringify(project),before);
});
test("a selected upload renders without inheriting a mirrored live-camera preview",()=>{
  const project=createProject(),scales=[];
  project.background=createBackgroundForMedia({kind:"video",media:"live-camera",mirror:true},"video","uploaded-video","#000");
  const ctx={filter:"none",clearRect(){},save(){},restore(){},scale(x,y){scales.push([x,y]);},fillRect(){},translate(){},drawImage(){}};
  drawProject({width:1080,height:1920,getContext:()=>ctx},project,{get:()=>({videoWidth:720,videoHeight:1280})},()=>null);
  assert.equal(scales.some(([x])=>x<0),false);
});
