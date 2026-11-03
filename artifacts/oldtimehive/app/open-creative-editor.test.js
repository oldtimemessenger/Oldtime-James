import test from "node:test";
import assert from "node:assert/strict";
import {openCreativeEditor} from "./open-creative-editor.js";
test("story gallery opens in the tap and cancel never mounts an empty editor", async () => {
  const previous = globalThis.document;
  let clicked = false, removed = false, errors = 0;
  const input = {
    click() { clicked = true; this.oncancel(); },
    remove() { removed = true; },
  };
  globalThis.document = {createElement:() => input, body:{appendChild:node => assert.equal(node,input)}};
  try {
    const pending = openCreativeEditor({destination:"story",mediaPicker:true,toast:() => errors++});
    assert.equal(clicked,true,"the native picker must open before the first async pause");
    assert.equal(input.accept,"image/*,video/*");
    assert.equal(await pending,null);
    assert.equal(removed,true); assert.equal(errors,0);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
