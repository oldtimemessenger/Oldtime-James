import test from "node:test";
import assert from "node:assert/strict";
import { installVideoMediaSession } from "./media-session.js";

function eventRoot() {
  const handlers = new Map();
  return {
    addEventListener(type, handler) {
      const list = handlers.get(type) || [];
      list.push(handler);
      handlers.set(type, list);
    },
    removeEventListener(type, handler) {
      handlers.set(type, (handlers.get(type) || []).filter(item => item !== handler));
    },
    dispatch(type, target) {
      for (const handler of handlers.get(type) || []) handler({ target });
    },
  };
}

test("video playback uses Oldtime feather artwork in system media controls", () => {
  const root = eventRoot();
  const session = { metadata: null, playbackState: "none" };
  class FakeMetadata {
    constructor(values) { Object.assign(this, values); }
  }
  const detach = installVideoMediaSession({
    root,
    mediaSession: session,
    Metadata: FakeMetadata,
    baseURI: "https://oldtime.example/app/",
  });
  const video = { tagName: "VIDEO", src: "https://cdn.example/video.mp4", srcObject: null };

  root.dispatch("play", video);
  assert.equal(session.playbackState, "playing");
  assert.equal(session.metadata.title, "Video");
  assert.equal(session.metadata.artist, "Oldtime");
  assert.deepEqual(session.metadata.artwork, [{
    src: "https://oldtime.example/app/app-icon-512.png",
    sizes: "512x512",
    type: "image/png",
  }]);

  root.dispatch("pause", video);
  assert.equal(session.playbackState, "paused");
  root.dispatch("ended", video);
  assert.equal(session.playbackState, "none");
  assert.equal(session.metadata, null);
  detach();
});

test("camera streams and unsupported browsers do not create media metadata", () => {
  const root = eventRoot();
  const session = { metadata: null, playbackState: "none" };
  const detach = installVideoMediaSession({
    root,
    mediaSession: session,
    Metadata: class {},
    baseURI: "https://oldtime.example/app/",
  });
  root.dispatch("play", { tagName: "VIDEO", srcObject: {} });
  assert.equal(session.metadata, null);
  assert.equal(session.playbackState, "none");
  detach();

  assert.equal(installVideoMediaSession({
    root,
    mediaSession: null,
    Metadata: class {},
    baseURI: "https://oldtime.example/app/",
  }) instanceof Function, true);
});
