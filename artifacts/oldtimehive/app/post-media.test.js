import assert from "node:assert/strict";
import test from "node:test";
import { postMediaReferences } from "./post-media.js";

test("normalizes cloud media objects and omits default avatar placeholders", () => {
  assert.deepEqual(postMediaReferences({
    media: [
      { id: "one", reference: "oldtime-media:one" },
      { url: "https://cdn.example/photo.jpg" },
      { mediaReference: "/app/avatar.svg" },
      { reference: "" },
    ],
  }), ["oldtime-media:one", "https://cdn.example/photo.jpg"]);
});

test("returns no post media when the server omits its media list", () => {
  assert.deepEqual(postMediaReferences({}), []);
  assert.deepEqual(postMediaReferences({ media: null }), []);
});
