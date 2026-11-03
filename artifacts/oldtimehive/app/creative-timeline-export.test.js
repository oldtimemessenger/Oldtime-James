import test from "node:test";
import assert from "node:assert/strict";
import { exportFramePlan, originalAudioSegments, mixTimelineAudio, audioExportFailure } from "./creative-timeline-export.js";

test("encoding timestamps cover the full clip independently of slow rendering", () => {
  for (const rate of [24, 30, 33, 60]) {
    const plan = exportFramePlan(2.008, rate);
    assert.equal(plan.count, Math.ceil(2.008 * rate));
    assert.equal(plan.at(0), 0);
    assert.ok(Math.abs(plan.at(plan.count - 1) + plan.length(plan.count - 1) - 2.008) < 1e-9);
    for (let i = 1; i < plan.count; i++) assert.ok(plan.at(i) > plan.at(i - 1));
  }
});
test("export frame plan clamps unsupported frame rates, not duration", () => {
  assert.equal(exportFramePlan(13.652, 120).rate, 60);
  assert.equal(exportFramePlan(13.652, 0).rate, 30);
  assert.equal(exportFramePlan(13.652, 30).count, 410);
});
test("original audio uses the same trimmed, reordered and sped-up clip timeline", () => {
  const background = { videoEdit: { clips: [
    { id: "second", in: 5, out: 9, speed: 2 },
    { id: "first", in: 0, out: 1, speed: .5 },
  ] } };
  assert.deepEqual(originalAudioSegments(background, 4), [
    { in: 5, out: 9, speed: 2, offset: 0 },
    { in: 0, out: 1, speed: .5, offset: 2 },
  ]);
  assert.deepEqual(originalAudioSegments({}, 2.008), [{ in: 0, out: 2.008, speed: 1, offset: 0 }]);
});

function audioFixture(t, { failAfter = Infinity, musicFails = false, noTrack = false } = {}) {
  const previous = globalThis.OfflineAudioContext;
  const calls = [], nodes = [], warnings = [];
  let disposed = false, renders = 0, musicDecodes = 0;
  globalThis.OfflineAudioContext = class {
    destination = {};
    createBufferSource() {
      const node = {
        playbackRate: { value: 1 }, connected: false, stopped: false,
        connect() { this.connected = true; }, disconnect() { this.connected = false; },
        stop() { this.stopped = true; }, start(...args) { this.startArgs = args; },
      };
      nodes.push(node);
      return node;
    }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    async decodeAudioData() {
      musicDecodes++;
      if (musicFails) throw new DOMException("Selected music decode failed", "EncodingError");
      return { duration: 20, label: "music" };
    }
    async startRendering() {
      renders++;
      return { nodes: nodes.filter(node => node.connected && !node.stopped) };
    }
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.OfflineAudioContext;
    else globalThis.OfflineAudioContext = previous;
  });
  const m = {
    ALL_FORMATS: [],
    BlobSource: class {},
    Input: class {
      async getPrimaryAudioTrack() { return noTrack ? null : {}; }
      dispose() { disposed = true; }
    },
    AudioBufferSink: class {
      async *buffers(start, end) {
        calls.push([start, end]);
        for (let timestamp = 0; timestamp < end; timestamp++) {
          if (timestamp >= failAfter) throw new DOMException("InternalAudioDecoderCocoa decoding failed", "EncodingError");
          yield { timestamp, duration: 1, buffer: { label: timestamp } };
        }
      }
    },
  };
  const options = {
    video: {}, sourceBlob: new Blob(["source"]), background: {}, duration: 4,
    audioPlan: { needsAudio: true, original: true, music: [] },
    check() {}, onWarning: warning => warnings.push(warning),
  };
  return { m, options, calls, nodes, warnings,
    get disposed() { return disposed; }, get renders() { return renders; },
    get musicDecodes() { return musicDecodes; } };
}

test("multiple edited segments share one continuous decode from zero with correct timeline offsets", async t => {
  const f = audioFixture(t);
  f.options.background = { videoEdit: { clips: [
    { in: 5, out: 7, speed: 2 }, // Output 0..1
    { in: .5, out: 1.5, speed: .5 }, // Output 1..3, includes partial buffers
    { in: 5, out: 6, speed: 1 }, // Reuse already decoded source at output 3..4
  ] } };
  await mixTimelineAudio(f.m, f.options);
  assert.deepEqual(f.calls, [[0, 7]], "never restart decoding at an edited in-point");
  assert.deepEqual(f.nodes.map(node => ({
    source: node.buffer.label, rate: node.playbackRate.value, start: node.startArgs,
  })), [
    { source: 0, rate: .5, start: [1, .5, .5] },
    { source: 1, rate: .5, start: [2, 0, .5] },
    { source: 5, rate: 2, start: [0, 0, 1] },
    { source: 5, rate: 1, start: [3, 0, 1] },
    { source: 6, rate: 2, start: [.5, 0, 1] },
  ]);
  assert.deepEqual(f.warnings, []);
  assert.equal(f.disposed, true);
});

test("unedited audio remains a single pass from the beginning", async t => {
  const f = audioFixture(t);
  await mixTimelineAudio(f.m, f.options);
  assert.deepEqual(f.calls, [[0, 4]]);
  assert.deepEqual(f.nodes.map(node => node.startArgs[0]), [0, 1, 2, 3]);
});

test("decode failure removes all partial original audio but still mixes selected music", async t => {
  const f = audioFixture(t, { failAfter: 1 });
  f.options.background = { videoEdit: { clips: [
    { in: 0, out: 1, speed: 1 }, { in: 2, out: 3, speed: 2 },
  ] } };
  f.options.audioPlan.music = [{ media: new Blob(["music"]), offset: 2, volume: .6 }];
  const result = await mixTimelineAudio(f.m, f.options);
  assert.equal(f.musicDecodes, 1);
  assert.equal(f.nodes[0].stopped, true);
  assert.equal(f.nodes[0].connected, false);
  assert.deepEqual(result.nodes.map(node => node.buffer.label), ["music"]);
  assert.equal(f.warnings[0].stage, "original-audio-decode");
  assert.equal(f.warnings[0].errorName, "EncodingError");
  assert.match(f.warnings[0].userMessage, /original sound couldn’t be included/);
  assert.equal(f.disposed, true);
});

test("failed original audio without music produces a video-only result with a warning, not silent PCM", async t => {
  const f = audioFixture(t, { failAfter: 0 });
  assert.equal(await mixTimelineAudio(f.m, f.options), null);
  assert.equal(f.renders, 0, "do not encode a manufactured silent audio track");
  assert.equal(f.warnings.length, 1);
});

test("a legitimately silent source has no fabricated audio or decode warning", async t => {
  const f = audioFixture(t, { noTrack: true });
  assert.equal(await mixTimelineAudio(f.m, f.options), null);
  assert.equal(f.warnings.length, 0);
});

test("cancellation cleans up original nodes and must never publish a fallback", async t => {
  const f = audioFixture(t, { failAfter: 1 });
  const canceled = new Error("Export canceled.");
  let checks = 0;
  f.options.check = () => { if (++checks > 2) throw canceled; };
  await assert.rejects(mixTimelineAudio(f.m, f.options), error => error === canceled);
  assert.deepEqual(f.warnings, []);
  assert.equal(f.nodes[0].stopped, true);
  assert.equal(f.disposed, true);
});

test("music-decode remains diagnosable and encoding annotation preserves its actual failed step", async t => {
  const f = audioFixture(t, { failAfter: 0, musicFails: true });
  f.options.audioPlan.music = [{ media: new Blob(["music"]) }];
  await assert.rejects(mixTimelineAudio(f.m, f.options), error => {
    audioExportFailure(error, "encode");
    assert.equal(error.name, "EncodingError");
    assert.equal(error.publicationStage, "music-decode");
    assert.equal(error.audioDiagnostic.operation, "music-decode");
    return true;
  });
  const encoderError = audioExportFailure(new DOMException("Encoder failed", "EncodingError"), "encode");
  assert.equal(encoderError.publicationStage, "encode");
});
