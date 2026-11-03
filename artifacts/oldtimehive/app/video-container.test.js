import test from "node:test";
import assert from "node:assert/strict";
import { fragmentedMp4FrameRate } from "./video-container.js";
import { readVideoFrameRate } from "./video-compression.js";

const words = (...values) => {
  const data = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => data.writeUInt32BE(value, index * 4));
  return data;
};
const box = (type, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([words(body.length + 8), Buffer.from(type), body]);
};
function fixture({ fps = 60, perSample = false, defaultsInTrack = false } = {}) {
  const duration = 60_000 / fps;
  const moov = box("moov",
    box("trak", box("tkhd", words(0, 0, 0, 1)),
      box("mdia", box("mdhd", words(0, 0, 0, 60_000)),
        box("hdlr", words(0, 0), Buffer.from("vide")))),
    box("mvex", box("trex", words(0, 1, 1, defaultsInTrack ? duration : 0, 0, 0))));
  const fragment = box("moof", box("traf",
    box("tfhd", defaultsInTrack ? words(0, 1) : words(8, 1, duration)),
    box("trun", words(perSample ? 0x100 : 0, 30),
      perSample ? words(...Array(30).fill(duration)) : Buffer.alloc(0))));
  return Buffer.concat([box("ftyp", Buffer.from("isom"), words(0)), moov, fragment]);
}
const buffer = data => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

test("fragmented recordings retain their actual 30/60 fps without playback callback guesses", async () => {
  for (const fps of [30, 60]) {
    for (const options of [{}, { perSample: true }, { defaultsInTrack: true }]) {
      const data = fixture({ fps, ...options });
      assert.equal(fragmentedMp4FrameRate(buffer(data)), fps);
      assert.equal(await readVideoFrameRate(new Blob([data], { type: "video/mp4" })), fps);
    }
  }
});
test("truncated or unrecognized fragments never establish a frame rate", () => {
  assert.equal(fragmentedMp4FrameRate(buffer(Buffer.from("not an mp4"))), null);
  const data = fixture();
  assert.equal(fragmentedMp4FrameRate(buffer(data.subarray(0, data.length - 4))), null);
});
