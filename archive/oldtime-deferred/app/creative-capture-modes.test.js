import test from "node:test";
import {bindCaptureModes} from "./creative-capture-modes.js";
test("capture modes initialize without the obsolete gallery button",t=>{
  const previous=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=fn=>fn();
  t.after(()=>{if(previous===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previous;});
  const nodes={
    destination:{value:"post"},
    "capture-picker":{querySelectorAll:()=>[],querySelector:()=>null,addEventListener:()=>{}},
    "carousel-tray":{},
    "carousel-next":{}
  };
  const modes=bindCaptureModes({
    root:{},editor:{classList:{contains:()=>false},dataset:{}},q:name=>nodes[name]||null,
    project:{},assets:{},canEdit:()=>true,alive:()=>true,changed:()=>{}
  });
  assert.equal(modes.mode(),"photo");
  assert.equal(typeof nodes["carousel-next"].onclick,"function");
});
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {captureChoice} from "./creative-capture-modes.js";
test("swipe choices select capture type and audience destination without taking a picture",()=>{
  assert.deepEqual(captureChoice("story"),{capture:"photo",destination:"story",quote:false});
  assert.deepEqual(captureChoice("video"),{capture:"video",destination:"post",quote:false});
  assert.equal(captureChoice("carousel").capture,"photo");assert.equal(captureChoice("quote").quote,true);
  assert.throws(()=>captureChoice("unsupported"));
});

test("Quote and Camera use the same full-screen stage without changing Studio",()=>{
  const css=readFileSync(new URL("./creative-editor.css",import.meta.url),"utf8");
  const shared=".creative-editor.is-basic:is(.is-camera-open,.is-quote):not(.is-cropping)";
  for(const element of [".ce-body",".ce-stage-wrap",".ce-stage","#ce-canvas",".ce-head",".ce-save-bar"]){
    assert.ok(css.includes(`${shared} ${element}`),`${element} must keep the camera viewport in Quote`);
  }
  assert.match(css,/is-basic:is\(\.is-camera-open,\.is-quote\):not\(\.is-cropping\) \.ce-stage\{[^}]*width:100%!important;[^}]*height:100%/);
  assert.match(css,/is-basic\.is-quote:not\(\.is-cropping\) \.ce-dock\{position:absolute/);
  assert.match(css,/is-basic\.is-quote\.is-typing \.ce-head,[\s\S]*?\.ce-save-bar\{visibility:hidden\}/);
});
