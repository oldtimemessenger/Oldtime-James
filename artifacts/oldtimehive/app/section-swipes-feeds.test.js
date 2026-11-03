import test from "node:test";
import assert from "node:assert/strict";
import {ownsHorizontalGesture,bindSectionSwipes} from "./section-swipes.js";
test("ordinary video, button and link touches permit sideways navigation",()=>{
 for(const tag of ["video","button","a","canvas"]){
  const target={closest:selector=>selector.split(",").includes(tag)?{}:null};
  assert.equal(ownsHorizontalGesture(target,{}),false);
 }
});
test("a sideways drag follows the finger without moving navigation and suppresses its click",()=>{
 const events={},style={},content={style,clientWidth:390},root={querySelector:()=>content,addEventListener:(name,fn)=>{events[name]=fn;}};
 let targetSection="",prevented=false,clicked=false;
 bindSectionSwipes({root,current:()=>"updates",enabled:()=>true,navigate:value=>targetSection=value});
 const target={closest:()=>null,parentElement:root};
 events.touchstart({target,touches:[{clientX:250,clientY:100}],timeStamp:1});
 events.touchmove({touches:[{clientX:120,clientY:105}],cancelable:true,preventDefault:()=>prevented=true});
 assert.equal(prevented,true);assert.match(style.transform,/translate3d/);
 events.touchend({changedTouches:[{clientX:120,clientY:105}],timeStamp:200});
 assert.equal(targetSection,"blast");assert.equal(style.transform,"");
 events.click({preventDefault:()=>clicked=true,stopImmediatePropagation:()=>{}});
 assert.equal(clicked,true);
});
