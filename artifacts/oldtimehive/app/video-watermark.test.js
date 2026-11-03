import test from "node:test";
import assert from "node:assert/strict";
import {drawOldtimeWatermark} from "./video-watermark.js";
import {readFileSync} from "node:fs";
test("encoded watermark is painted inside the frame without changing drawing state",()=>{
 const calls=[];const context={save:()=>calls.push("save"),restore:()=>calls.push("restore"),
 strokeText:(...args)=>calls.push(["outline",...args]),fillText:(...args)=>calls.push(["text",...args])};
 drawOldtimeWatermark({width:1080,height:1920,getContext:()=>context});
 assert.equal(calls[0],"save");assert.equal(calls.at(-1),"restore");
 assert.equal(calls[2][1],"Oldtime");assert.ok(calls[2][2]<1080);assert.ok(calls[2][3]<1920);
 const source=readFileSync(new URL("./creative-export.js",import.meta.url),"utf8");
 assert.match(source,/renderFrame\(time,target\);\s*if\(watermark\)drawOldtimeWatermark\(target\)/);
 assert.match(source,/watermark = false/);
 assert.match(source,/profile, render, seekVideo/);
});
test("device saves always encode through the watermarked path, never download the raw source",()=>{
 const source=readFileSync(new URL("./post-video-download.js",import.meta.url),"utf8");
 assert.match(source,/await exportCreativeVideo/);
 assert.match(source,/watermark:true/);
 assert.match(source,/URL\.createObjectURL\(result\)/);
 assert.doesNotMatch(source,/link\.href\s*=\s*source/);
});
test("published compositions do not opt into the device-download watermark",()=>{
 const editor=readFileSync(new URL("./creative-editor.js",import.meta.url),"utf8");
 const publication=editor.slice(editor.indexOf('if (["story", "post", "community"].includes(destination))'),editor.indexOf("if (!mediaBlob.size)"));
 assert.ok(publication.includes("await exportCreativeVideo"));
 assert.doesNotMatch(publication,/watermark\s*:\s*true/);
 assert.match(editor,/const blob = animated \? await exportCreativeVideo\([\s\S]*?watermark:true/);
});
