import test from "node:test";
import assert from "node:assert/strict";
import { exportCreativeVideo } from "./creative-export.js";

function saveGlobals() {
  return {
    document: globalThis.document,
    window: globalThis.window,
    MediaRecorder: globalThis.MediaRecorder,
  };
}

function restoreGlobals(original) {
  for (const key of ["document", "window", "MediaRecorder"]) {
    if (original[key] === undefined) delete globalThis[key];
    else globalThis[key] = original[key];
  }
}

function mockCanvasStream() {
  const videoTrack = {
    stopped: false,
    requestFrame() {},
    stop() { this.stopped = true; },
  };
  const audioTracks = [];
  const stream = {
    getVideoTracks: () => [videoTrack],
    getAudioTracks: () => audioTracks,
    getTracks: () => [videoTrack, ...audioTracks],
    addTrack(track) { audioTracks.push(track); },
  };
  globalThis.document = {
    createElement: () => ({
      getContext:()=>({save(){},restore(){},strokeText(){},fillText(){}}),
      captureStream: () => stream,
      width: 0,
      height: 0,
    }),
  };
  return { stream, videoTrack };
}

test("a MediaRecorder that never emits stop releases the editor with a clear error", async () => {
  const original = saveGlobals();
  let recorder;
  class StalledRecorder {
    static isTypeSupported() { return true; }
    constructor() {
      this.mimeType = "video/webm";
      this.state = "inactive";
      recorder = this;
    }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; }
  }
  try {
    globalThis.MediaRecorder = StalledRecorder;
    const { videoTrack } = mockCanvasStream();
    await assert.rejects(exportCreativeVideo({
      canvas: { width: 720, height: 1280 },
      duration: 1,
      render() {},
      alive: () => true,
      timeouts: { recordingMs: 10 },
    }), /Video export stopped responding/);
    assert.equal(recorder.state, "inactive");
    assert.equal(videoTrack.stopped, true);
  } finally {
    restoreGlobals(original);
  }
});

test("video export reuses the audio context started by the publish tap", async () => {
  const original = saveGlobals();
  let createdContexts = 0;
  class AudioContext {
    state = "running";
    constructor() { createdContexts++; }
    createMediaStreamDestination() {
      return { stream: { getAudioTracks: () => [{ kind: "audio", stop() {} }] } };
    }
    createMediaElementSource() {
      return { connect() {}, disconnect() {} };
    }
    createGain() {
      return { gain: { value: 1 }, connect() {}, disconnect() {} };
    }
  }
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(_stream, options) {
      this.mimeType = options.mimeType;
      this.state = "inactive";
    }
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["encoded"], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  try {
    globalThis.MediaRecorder = Recorder;
    globalThis.window = { AudioContext };
    const { stream } = mockCanvasStream();
    globalThis.document = {
      createElement(kind) {
        if (kind === "canvas") return { getContext:()=>({save(){},restore(){},strokeText(){},fillText(){}}),captureStream: () => stream, width: 0, height: 0 };
        return {
          readyState: 2, loop: false,
          play: async () => {},
          pause() {},
          removeAttribute() {},
          load() {},
        };
      },
    };
    const tapContext = {
      state: "running",
      createMediaStreamDestination() {
        return { stream: { getAudioTracks: () => [{ kind: "audio", stop() {} }] } };
      },
      createMediaElementSource() {
        return { connect() {}, disconnect() {} };
      },
      createGain() {
        return { gain: { value: 1 }, connect() {}, disconnect() {} };
      },
      decodeAudioData: async () => ({duration: 1}),
      createBufferSource() {
        return {connect() {}, disconnect() {}, start() {}, stop() {}};
      },
    };
    const audioSession = { context: tapContext, ready: Promise.resolve() };
    const blob = await exportCreativeVideo({
      canvas: { width: 720, height: 1280 },
      duration: 0.01,
      render() {},
      alive: () => true,
      audioTracks: [{ media: "data:audio/wav;base64,AA==" }],
      audioSession,
      timeouts: { recordingMs: 1_000 },
    });
    assert.ok(blob.size > 0);
    assert.equal(createdContexts, 0, "export must not create an AudioContext outside the tap");
  } finally {
    restoreGlobals(original);
  }
});

test("a suspended audio context that never resumes fails instead of hanging", async () => {
  const original = saveGlobals();
  class StalledAudioContext {
    state = "suspended";
    resume() { return new Promise(() => {}); }
  }
  class Recorder {
    static isTypeSupported() { return true; }
  }
  try {
    globalThis.MediaRecorder = Recorder;
    globalThis.window = { AudioContext: StalledAudioContext };
    mockCanvasStream();
    const video = {
      currentTime: 0,
      muted: true,
      playbackRate: 1,
      pause() {},
    };
    await assert.rejects(exportCreativeVideo({
      canvas: { width: 720, height: 1280 },
      video,
      duration: 1,
      render() {},
      alive: () => true,
      timeouts: { stepMs: 10 },
    }), error => error.publicationStage === "audio-resume" &&
      error.audioDiagnostic.contextState === "suspended" && /timed out/.test(error.message));
  } finally {
    restoreGlobals(original);
  }
});
