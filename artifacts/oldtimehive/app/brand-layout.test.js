import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=name=>readFileSync(new URL(name,import.meta.url),"utf8");
test("entrance centers the supplied feather above its name with a subtle finite fade",()=>{
 const html=source("../index.html");
 assert.match(html,/brand\/oldtime-feather.png/);
 assert.match(html,/class="oldtime-startup-name">Oldtime</);
 assert.match(html,/oldtime-startup-art \{[^}]*left:6px/);
 assert.match(html,/@keyframes oldtime-feather-arrive \{ from \{ opacity:0;transform:scale\(\.88\)/);
 assert.doesNotMatch(html,/oldtime-feather-depart|scale\(12\)|clip-path:inset/);
 assert.match(html,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(html,/Bluesky|butterfly/i);
});
test("auth branding has separate image dimensions and no cropping container",()=>{
 const css=source("./auth-brand.css");
 assert.match(css,/\.ot-auth \.ot-art\{[^}]*aspect-ratio:auto[^}]*max-height:none[^}]*overflow:visible/);
 assert.match(css,/\.ot-auth \.ot-art img\{width:48px;height:76px/);
 assert.match(source("./auth-design.js"),/ot-brand-name">Oldtime/);
});
test("Home header has no brand overlay and icon motion suppression leaves page motion intact",()=>{
 assert.doesNotMatch(source("./app.js"),/home-brand-lockup|home-brand-mark/);
 const css=source("./quiet-interface.css");
 assert.match(css,/\.navic\{animation:none!important/);
 assert.doesNotMatch(css,/\.screen[^}]*animation:none/);
});
test("notes wait for cloud confirmation and preserve other profile metadata",()=>{
 const app=source("./app.js");
 const note=app.slice(app.indexOf("function editProfileNote()"),app.indexOf("// Vertical browsing for posts"));
 assert.match(note,/await requestCloudApi\("\/api\/account\/profile"\)/);
 assert.match(note,/await api\.updateCloudAccountProfile\(\{profile:\{\.\.\.current\.profile,profileNote\}\}\)/);
 assert.match(note,/api\.me\(\)\?\.profileNote!==profileNote/);
 assert.doesNotMatch(note,/mutate\(db/);
});
