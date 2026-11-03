import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("status entry points use the separate capture flow rather than the post editor",()=>{
 const app=source("./app.js");
 assert.match(app,/if\(destination==="story"\)[\s\S]*?import\("\.\/status-capture\.js"\)/);
 assert.match(app,/source:startText\?"text":mediaPicker\?"gallery":"landing"/);
 assert.match(app,/onPosted:\(\)=>\{if\(tab===originTab\)render\(\);\}/);
});
test("chat Status invokes the separate creator and obsolete inline source choosers are absent",()=>{
 const binder=source("./chat-story-console.js"),inbox=source("./chat-inbox-console.js");
 assert.match(binder,/createStory,\[\{source:"camera"\}\]/);
 assert.doesNotMatch(inbox,/<div id="csc-chooser"/);
 assert.doesNotMatch(binder,/<div class="csc-chooser"/);
});
