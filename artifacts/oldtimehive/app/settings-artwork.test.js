import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {tipIllustration,tipIllustrationKey} from "./tip-illustrations.js";

const topics=["welcome","cover","friends","blast","note","studio","communities","saved",
  "privacy","chat-privacy","notifications","safety","interests"];
const source=name=>readFileSync(new URL(name,import.meta.url),"utf8");

test("every guide has a distinct editorial scene, including compound topic names",()=>{
  const keys=topics.map(topic=>tipIllustrationKey(`${topic}.webp`));
  assert.equal(new Set(keys).size,topics.length);
  assert.equal(new Set(topics.map(topic=>tipIllustration(`${topic}.webp`))).size,topics.length);
  assert.equal(tipIllustrationKey("tips/chat-privacy.webp"),"chat");
  assert.equal(tipIllustrationKey("tips/cover.webp"),"cover");
});

test("illustrations have transparent canvases and contain no bitmap artwork",()=>{
  for(const topic of topics){
    const svg=tipIllustration(`${topic}.webp`);
    assert.match(svg,/viewBox="0 0 320 180"/);
    assert.doesNotMatch(svg,/<image\b|<rect width="320"|<path d="M38 150/);
    assert.match(svg,/<(?:path|rect|circle)\b/);
  }
});

test("guide labels have their own selector and narrow phones do not enlarge artwork",()=>{
  assert.match(source("guide-library.js"),/class="guide-label"/);
  assert.doesNotMatch(source("guide-library.js"),/<img loading="lazy"/);
  const css=source("guide-library.css");
  assert.match(css,/\.guide-label\{font:600 12px/);
  assert.doesNotMatch(css,/span:first-of-type|grid-template-rows:88px/);
});

test("base and compact UI layers use the same typography tokens",()=>{
  const base=source("styles.css"),compact=source("compact-interface.css");
  assert.equal(base.match(/--font:\s*([^;]+);/)[1],compact.match(/--font:\s*([^;]+);/)[1]);
  assert.match(base,/--font-heading:\s*var\(--font\)/);
  assert.match(compact,/--font-heading:\s*var\(--font\)/);
});
