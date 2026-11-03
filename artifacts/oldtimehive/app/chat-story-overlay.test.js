import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const start = app.indexOf("function openUniversalCreation(");
const end = app.indexOf("\nif (import.meta.env.DEV", start);
async function launch(options) {
  let editor, renders=0, focusOptions;
  const context = {
    tab:"chat", viewer:null, profileId:null, esc:String, ic:{}, toast(){},
    document:{activeElement:{isConnected:true,focus(value){focusOptions=value;}}},
    $(){return null;}, render(){renders++;},
    openCreativeEditor(value){editor=value;},
    loadStatusCapture:async()=>({openStatusCapture(value){editor=value;}}),
    openStory(){throw Error("Must not navigate to a story viewer");},
    openPostViewer(){throw Error("Must not navigate to a post");},
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start,end).replace('import("./status-capture.js")','loadStatusCapture()'),context);
  await context.openUniversalCreation(options);
  return {context,get editor(){return editor;},get renders(){return renders;},get focusOptions(){return focusOptions;}};
}
test("story photo and video selection opens over Messages without replacing it",async()=>{
  const flow=await launch({destination:"story",mediaPicker:true});
  assert.equal(flow.context.tab,"chat");
  assert.equal(flow.renders,0);
  assert.equal(flow.editor.source,"gallery");
  flow.editor.onClose();
  assert.equal(flow.renders,0);
  assert.equal(flow.focusOptions.preventScroll,true);
});
test("posting a story refreshes the inbox without navigating to Home",async()=>{
  const flow=await launch({destination:"story",startCamera:true});
  flow.editor.onPosted("story",true,false);
  assert.equal(flow.context.tab,"chat");
  assert.equal(flow.renders,1);
});
test("story completion does not force a return if the member already left Messages",async()=>{
  const flow=await launch({destination:"story"});
  flow.context.tab="updates";
  flow.editor.onPosted("story",true,true);
  assert.equal(flow.context.tab,"updates");
  assert.equal(flow.renders,0);
});
test("the creator is an independent fixed dialog with full cleanup",()=>{
  const editor=readFileSync(new URL("./creative-editor.js",import.meta.url),"utf8");
  const css=readFileSync(new URL("./creative-editor.css",import.meta.url),"utf8");
  assert.match(editor,/document\.body\.appendChild\(root\)/);
  assert.match(editor,/root\.remove\(\); currentEditor = null/);
  assert.match(editor,/document\.body\.style\.overflow = oldOverflow/);
  assert.match(css,/\.creative-editor \{ position: fixed; inset: 0/);
});
