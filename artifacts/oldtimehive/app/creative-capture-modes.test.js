import assert from "node:assert/strict";
import test from "node:test";
import {bindCaptureModes, captureChoice, captureRecordingState, MAX_CAPTURE_SECONDS} from "./creative-capture-modes.js";
import {renderCreativeEditor} from "./creative-editor-view.js";

test("recording time and progress use real elapsed time and the actual capture limit",()=>{
  assert.equal(MAX_CAPTURE_SECONDS,60);
  assert.deepEqual(captureRecordingState(0),{label:"00:00 / 01:00",progress:"0%"});
  assert.equal(captureRecordingState(2900).label,"00:02 / 01:00");
  assert.deepEqual(captureRecordingState(30000),{label:"00:30 / 01:00",progress:"50%"});
  assert.deepEqual(captureRecordingState(90000),{label:"01:00 / 01:00",progress:"100%"});
  assert.deepEqual(captureRecordingState(-1000),{label:"00:00 / 01:00",progress:"0%"});
});

test("capture modes select photo or video independently of the share destination",()=>{
  assert.deepEqual(captureChoice("video"),{capture:"video"});
  assert.deepEqual(captureChoice("photo"),{capture:"photo"});
  assert.throws(()=>captureChoice("story"),/Unknown capture mode/);
  assert.throws(()=>captureChoice("carousel"),/Unknown capture mode/);
  assert.throws(()=>captureChoice("quote"),/Unknown capture mode/);
  assert.throws(()=>captureChoice("unsupported"),/Unknown capture mode/);
});

test("the capture picker only exposes photo and video",()=>{
  const html=renderCreativeEditor();
  for(const mode of ["photo","video"])assert.match(html,new RegExp(`data-ce-capture-mode="${mode}"`));
  assert.doesNotMatch(html,/data-ce-capture-mode="story"|data-ce-capture-mode="carousel"|data-ce-capture-mode="quote"/);
});

test("selecting a capture mode toggles the camera without changing its share destination",t=>{
  const old=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=fn=>fn();
  t.after(()=>{if(old===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=old;});
  const buttons=["photo","video"].map(mode=>({
    dataset:{ceCaptureMode:mode},offsetLeft:0,offsetWidth:40,disabled:false,
    setAttribute(){},onclick:null,
  }));
  const picker={clientWidth:120,scrollTo(){},querySelector:selector=>buttons.find(button=>selector.includes(button.dataset.ceCaptureMode)),
    querySelectorAll:()=>buttons,addEventListener(){}};
  let photoClicks=0,recordClicks=0;
  const nodes={destination:{value:"post",addEventListener(){}}, "capture-picker":picker,photo:{click(){photoClicks++;}},record:{click(){recordClicks++;}}};
  const editor={dataset:{},classList:{contains:name=>name==="is-basic"||name==="is-camera-open"}};
  const modes=bindCaptureModes({editor,q:name=>nodes[name],changed(){},canEdit:()=>true});
  buttons.find(button=>button.dataset.ceCaptureMode==="video").onclick();
  assert.equal(modes.mode(),"video");
  assert.equal(nodes.destination.value,"post");
  assert.equal(photoClicks,0);
  assert.equal(recordClicks,1);
  buttons.find(button=>button.dataset.ceCaptureMode==="photo").onclick();
  assert.equal(modes.mode(),"photo");
  assert.equal(nodes.destination.value,"post");
  assert.equal(photoClicks,1);
});

test("sound-backed Create opens with video capture selected",t=>{
  const old=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=fn=>fn();
  t.after(()=>{if(old===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=old;});
  const buttons=["photo","video"].map(mode=>({
    dataset:{ceCaptureMode:mode},offsetLeft:0,offsetWidth:40,disabled:false,
    setAttribute(){},onclick:null,
  }));
  const picker={clientWidth:120,scrollTo(){},querySelector:selector=>buttons.find(button=>selector.includes(button.dataset.ceCaptureMode)),
    querySelectorAll:()=>buttons,addEventListener(){}};
  const nodes={destination:{value:"post",addEventListener(){}}, "capture-picker":picker,photo:{click(){}},record:{click(){}}};
  const editor={dataset:{},classList:{contains:name=>name==="is-basic"||name==="is-camera-open"}};
  const modes=bindCaptureModes({editor,q:name=>nodes[name],changed(){},canEdit:()=>true,initialMode:"video"});
  assert.equal(modes.mode(),"video");
  assert.equal(editor.dataset.captureMode,"video");
});
