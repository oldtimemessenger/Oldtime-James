import assert from "node:assert/strict";
import test from "node:test";
import { audioRecorderMimeType, validateAudioExcerptDuration } from "./audio-extract.js";

test("audio extraction picks a supported audio-only container", () => {
  class Recorder {
    static isTypeSupported(type) { return type === "audio/webm;codecs=opus"; }
  }
  assert.equal(audioRecorderMimeType(Recorder), "audio/webm;codecs=opus");
});

test("audio extraction fails explicitly when the browser has no audio recorder", () => {
  assert.throws(() => audioRecorderMimeType(undefined), /unavailable/i);
  class Recorder { static isTypeSupported() { return false; } }
  assert.throws(() => audioRecorderMimeType(Recorder), /cannot save an audio excerpt/i);
});

test("audio excerpt duration is validated without silently clipping it", () => {
  assert.equal(validateAudioExcerptDuration(14), 14);
  assert.throws(() => validateAudioExcerptDuration(0), /duration is invalid/i);
  assert.throws(() => validateAudioExcerptDuration(Number.NaN), /duration is invalid/i);
});
