import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const css=readFileSync(new URL("./compact-interface.css",import.meta.url),"utf8");
const policy=css.slice(css.indexOf("/* Long row/section rules"));

test("divider removal changes paint only, not spacing or layout",()=>{
  assert.ok(policy.includes(".details-section,.detail-row,.shared-file-row"));
  assert.ok(policy.includes(".settings-header,.settings-group,.settings-entry"));
  assert.match(policy,/border-top-color:var\(--ui-divider,transparent\)/);
  assert.match(policy,/border-bottom-color:var\(--ui-divider,transparent\)/);
  assert.doesNotMatch(policy,/(?:^|[;{])\s*(?:display|position|width|height|margin|padding|transform|border-width)\s*:/);
});
test("form outlines, active indicators and note tails are not divider targets",()=>{
  assert.doesNotMatch(policy,/[,(]\s*(?:input|textarea|select|button)\s*[,)]/);
  assert.doesNotMatch(policy,/\.cic-note|\.active|:focus|\.chat-composer/);
  assert.doesNotMatch(policy,/border:\s*(?:0|none)|border-color:\s*transparent\s*!important/);
});
