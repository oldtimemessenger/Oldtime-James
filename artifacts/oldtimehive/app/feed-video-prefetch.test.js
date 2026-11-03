import assert from "node:assert/strict";
import test from "node:test";
import {
  FEED_VIDEO_PREFETCH_ROOT_MARGIN,
  prefetchFeedVideoMetadata,
} from "./feed-video-prefetch.js";

function makeVideo({ source = "", localReference = "" } = {}) {
  const attributes = new Map();
  if (source) attributes.set("src", source);
  return {
    dataset: localReference ? { localMedia: localReference } : {},
    isConnected: true,
    currentSrc: "",
    preload: "none",
    readyState: 0,
    loadCalls: 0,
    getAttribute(name) { return attributes.get(name) || null; },
    set src(value) {
      attributes.set("src", value);
      this.currentSrc = value;
    },
    load() {
      this.loadCalls++;
      this.readyState = 1;
    },
    addEventListener() {},
  };
}

test("feed prefetch hints the browser to buffer the next authorized video's opening", async () => {
  const video = makeVideo({ source: "https://media.example/video.mp4" });
  const prefetched = await prefetchFeedVideoMetadata(video, async () => {
    assert.fail("Cloud video URLs should not need a second URL request.");
  });

  assert.equal(prefetched, true);
  assert.equal(video.preload, "auto");
  assert.equal(video.loadCalls, 1);
  assert.equal(await prefetchFeedVideoMetadata(video, async () => ""), false);
  assert.equal(video.loadCalls, 1, "the same element must not start duplicate preload requests");
  assert.equal(FEED_VIDEO_PREFETCH_ROOT_MARGIN, "0px 0px 320px 0px");
});

test("local video prefetch reuses the shared media loader without restarting its source", async () => {
  const video = makeVideo({ localReference: "oldtime-media:video-fixture" });
  let options;
  const prefetched = await prefetchFeedVideoMetadata(video, async (element, loadOptions) => {
    options = loadOptions;
    assert.equal(element.preload, "auto");
    element.src = "https://media.example/signed-video.mp4";
    return true;
  });

  assert.equal(prefetched, true);
  assert.deepEqual(options, { quiet: true });
  assert.equal(video.getAttribute("src"), "https://media.example/signed-video.mp4");
  assert.equal(video.loadCalls, 0, "assigning the local source should not trigger a second load()");
  assert.equal(video.dataset.feedInitialBufferPrefetched, "ready");
});

test("failed or detached local-video prefetch remains retryable", async () => {
  const failed = makeVideo({ localReference: "oldtime-media:video-failed" });
  assert.equal(await prefetchFeedVideoMetadata(failed, async () => false), false);
  assert.equal(failed.dataset.feedInitialBufferPrefetched, undefined);

  const detached = makeVideo({ localReference: "oldtime-media:video-detached" });
  let finishLoad;
  const pending = prefetchFeedVideoMetadata(detached, async () => new Promise(resolve => {
    finishLoad = () => {
      detached.src = "https://media.example/detached.mp4";
      resolve(true);
    };
  }));
  detached.isConnected = false;
  finishLoad();
  assert.equal(await pending, false);
  assert.equal(detached.dataset.feedInitialBufferPrefetched, undefined);
});
