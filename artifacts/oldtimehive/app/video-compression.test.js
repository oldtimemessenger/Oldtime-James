import test from "node:test";
import assert from "node:assert/strict";
import {
  fitVideoTo720p,
  fitVideoTo1080p,
  videoCompressionPlan,
  videoEncodingProfile,
  videoCaptureReachedEnd,
  compressVideoTo720p,
  createVideoAudioSession,
  startMutedCapturePlayback,
  MAX_VIDEO_DURATION_SECONDS,
} from "./video-compression.js";

test("tap-created audio session reuses an active context without closing it after video export", async () => {
  const originalAudioContext = globalThis.AudioContext;
  const originalWebkitAudioContext = globalThis.webkitAudioContext;
  let resumeCalls = 0, closeCalls = 0;
  const context = {
    state: "suspended",
    destination: {},
    resume() { resumeCalls++; this.state = "running"; return Promise.resolve(); },
    close() { closeCalls++; this.state = "closed"; return Promise.resolve(); },
    createOscillator() {
      return { connect() {}, start() {}, stop() {}, disconnect() {} };
    },
    createGain() {
      return { gain: { value: 1 }, connect() {}, disconnect() {} };
    },
  };
  try {
    globalThis.AudioContext = class AudioContext {
      constructor() { throw new Error("must reuse the active editor context"); }
    };
    globalThis.webkitAudioContext = undefined;
    const session = createVideoAudioSession(context);
    assert.equal(session.context, context);
    assert.equal(resumeCalls, 1);
    session.retainContext();
    await session.close();
    assert.equal(closeCalls, 0);
  } finally {
    if (originalAudioContext === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = originalAudioContext;
    if (originalWebkitAudioContext === undefined) delete globalThis.webkitAudioContext;
    else globalThis.webkitAudioContext = originalWebkitAudioContext;
  }
});

test("encoder playback starts muted, then restores the recorder audio route", async () => {
  let mutedWhenStarted;
  const video = {
    muted: false,
    currentTime: 0,
    ended: false,
    async play() {
      mutedWhenStarted = this.muted;
      this.currentTime = 0.04;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  await startMutedCapturePlayback(video);
  assert.equal(mutedWhenStarted, true);
  assert.equal(video.muted, false);
});

test("silent autoplay stalls report real playback state quickly", async () => {
  const video = {
    muted: false,
    currentTime: 0,
    ended: false,
    paused: true,
    readyState: 1,
    networkState: 1,
    playbackRate: 1,
    play: async () => {},
    addEventListener() {},
    removeEventListener() {},
  };
  await assert.rejects(
    startMutedCapturePlayback(video, { progressTimeoutMs: 5 }),
    error => error.videoDiagnostics?.paused === true &&
      error.videoDiagnostics?.playbackSeconds === 0,
  );
});

test("a blocked encoder playback leaves the video muted", async () => {
  const video = {
    muted: false,
    async play() {
      const error = new Error("Playback denied.");
      error.name = "NotAllowedError";
      throw error;
    },
  };
  await assert.rejects(startMutedCapturePlayback(video), error => error.name === "NotAllowedError");
  assert.equal(video.muted, true);
});

test("video dimensions preserve orientation, avoid upscaling, and cap future uploads at 1080p", () => {
  assert.deepEqual(fitVideoTo720p(3840, 2160), { width: 1280, height: 720 });
  assert.deepEqual(fitVideoTo720p(1080, 1920), { width: 720, height: 1280 });
  assert.deepEqual(fitVideoTo720p(640, 480), { width: 640, height: 480 });
  assert.deepEqual(fitVideoTo1080p(3840, 2160), { width: 1920, height: 1080 });
  assert.deepEqual(fitVideoTo1080p(1080, 1920), { width: 1080, height: 1920 });
  assert.deepEqual(fitVideoTo1080p(640, 480), { width: 640, height: 480 });
});

test("encoding targets scale by resolution and source frame rate", () => {
  assert.equal(videoEncodingProfile(1280, 720, 30).videoBitsPerSecond, 3_000_000);
  assert.equal(videoEncodingProfile(1280, 720, 60).videoBitsPerSecond, 4_000_000);
  assert.equal(videoEncodingProfile(1920, 1080, 30).videoBitsPerSecond, 4_500_000);
  assert.equal(videoEncodingProfile(1920, 1080, 60).videoBitsPerSecond, 6_000_000);
  assert.equal(videoEncodingProfile(1920, 1080, 60).audioBitsPerSecond, 128_000);
});

test("optimization stops on the final frame even when mobile playback omits ended", () => {
  assert.equal(videoCaptureReachedEnd({ currentTime: 9 - 1 / 60, ended: false }, 9, 60), true);
  assert.equal(videoCaptureReachedEnd({ currentTime: 9 - 2 / 60, ended: false }, 9, 60), false);
  assert.equal(videoCaptureReachedEnd({ currentTime: 0, ended: true }, 9, 30), true);
  assert.equal(videoCaptureReachedEnd({ currentTime: 1, ended: false }, 0, 30), false);
});

test("the upload plan caps only future encodes at 1080p and 60 fps", () => {
  const large = videoCompressionPlan({
    width: 3840, height: 2160, size: 80_000_000, duration: 60, frameRate: 60,
  });
  assert.equal(large.needsEncoding, true);
  assert.equal(large.width, 1920);
  assert.equal(large.height, 1080);
  assert.equal(large.videoBitsPerSecond, 6_000_000);
  assert.equal(large.audioBitsPerSecond, 128_000);
  assert.equal(large.frameRate, 60);

  const optimized = videoCompressionPlan({
    width: 1280, height: 720, size: 22_000_000, duration: 60, frameRate: 30,
  });
  assert.equal(optimized.needsEncoding, false);

  const highFrameRateSource = videoCompressionPlan({
    width: 1920, height: 1080, size: 60_000_000, duration: 60, frameRate: 90,
  });
  assert.equal(highFrameRateSource.needsEncoding, true);
  assert.equal(highFrameRateSource.frameRate, 60);
});

test("the upload plan transcodes incompatible formats but preserves compatible source quality", () => {
  const withinTarget = videoCompressionPlan({
    width: 1920, height: 1080, size: 45_000_000, duration: 60, frameRate: 60,
  });
  assert.equal(withinTarget.needsEncoding, false);

  const closeToTarget = videoCompressionPlan({
    width: 1920, height: 1080, size: 55_000_000, duration: 60, frameRate: 60,
  });
  assert.equal(closeToTarget.needsEncoding, false);

  const aboveQualityCeiling = videoCompressionPlan({
    width: 1920, height: 1080, size: 62_000_000, duration: 60, frameRate: 60,
  });
  assert.equal(aboveQualityCeiling.needsEncoding, true);

  const incompatible = videoCompressionPlan({
    width: 1280, height: 720, size: 10_000_000, duration: 60, frameRate: 30, compatible: false,
  });
  assert.equal(incompatible.needsEncoding, true);
});

test("new video uploads allow exactly 2 minutes 9 seconds and reject longer clips", () => {
  assert.equal(MAX_VIDEO_DURATION_SECONDS, 129);
  assert.doesNotThrow(() => videoCompressionPlan({
    width: 1280, height: 720, size: 7_000_000, duration: MAX_VIDEO_DURATION_SECONDS, frameRate: 30,
  }));
  assert.throws(() => videoCompressionPlan({
    width: 1280, height: 720, size: 7_000_000, duration: MAX_VIDEO_DURATION_SECONDS + 0.01, frameRate: 30,
  }), /2 minutes 9 seconds or shorter/);
});

test("video compression fails explicitly outside a browser instead of uploading the original", async () => {
  await assert.rejects(
    compressVideoTo720p(new Blob(["source"], { type: "video/mp4" })),
    /original was not uploaded/i,
  );
});

test("non-video media is passed through unchanged", async () => {
  const image = new Blob(["image"], { type: "image/jpeg" });
  assert.equal(await compressVideoTo720p(image), image);
});
