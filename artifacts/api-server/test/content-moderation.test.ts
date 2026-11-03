import assert from "node:assert/strict";
import test from "node:test";
import { moderatePublication, moderationScores, type ModerationAsset, type WorkersAiBinding } from "../src/cloudflare/content-moderation";
import type { MediaBucket } from "../src/cloudflare/runtime";

function fixtureBucket(dataByKey: Record<string, Uint8Array> = {}) {
  return {
    async get(key: string) {
      const bytes = dataByKey[key];
      if (!bytes) return null;
      return { size: bytes.byteLength, body: new Response(bytes).body };
    },
  } as unknown as MediaBucket;
}

function asset(id: string, overrides: Partial<ModerationAsset> = {}): ModerationAsset {
  return {
    id,
    object_key: `media/${id}`,
    content_type: "image/jpeg",
    size: 2,
    sha256: `hash-${id}`,
    thumbnail_id: null,
    ...overrides,
  };
}

function reviewAi(scores = { violation: 0.01, uncertain: 0.01 }, calls?: Record<string, unknown>[]): WorkersAiBinding {
  return {
    async run(model, input) {
      assert.equal(model, "@cf/cloudflare/clef-omni");
      calls?.push(input);
      return {
        answers: {
          clear_violation: { noul: scores.violation },
          needs_review: { noul: scores.uncertain },
        },
      };
    },
  };
}

test("publication review parses both confidence answers and rejects malformed output", () => {
  assert.deepEqual(moderationScores({
    answers: { clear_violation: { noul: 0.8 }, needs_review: { probability: "0.2" } },
  }), { violation: 0.8, uncertain: 0.2 });
  assert.equal(moderationScores({ answers: { clear_violation: { noul: 0.1 } } }), null);
});

test("text and multiple image/video segments are reviewed in bounded batches", async () => {
  const calls: Record<string, unknown>[] = [];
  const media = new Uint8Array([1, 2]);
  const assets = [
    ...Array.from({ length: 5 }, (_, index) => asset(`image-${index}`)),
    ...Array.from({ length: 3 }, (_, index) => asset(`video-${index}`, {
      content_type: "video/mp4",
      sha256: `video-hash-${index}`,
    })),
  ];
  const data = Object.fromEntries(assets.map(item => [item.object_key, media]));

  await moderatePublication(reviewAi(undefined, calls), fixtureBucket(data), "A safe caption", assets);

  assert.equal(calls.length, 3, "five images and three videos are split into safe-size batches");
  assert.deepEqual((calls[0].images as string[]).length, 4);
  assert.equal(calls[0].videos, undefined);
  assert.deepEqual((calls[1].images as string[]).length, 1);
  assert.equal((calls[1].videos as string[]).length, 2);
  assert.equal((calls[2].videos as string[]).length, 1);
  assert.ok(calls.every(call => (call.state as any).caption === "A safe caption"));
});

test("a clearly disallowed result blocks publication; an inconclusive result also fails closed", async () => {
  const bucket = fixtureBucket();
  await assert.rejects(
    moderatePublication(reviewAi({ violation: 0.91, uncertain: 0.02 }), bucket, "unsafe test", []),
    (error: any) => error.status === 422 && /Nothing was published/.test(error.message),
  );
  await assert.rejects(
    moderatePublication(reviewAi({ violation: 0.12, uncertain: 0.73 }), bucket, "unclear test", []),
    (error: any) => error.status === 422 && /couldn’t confirm/.test(error.message),
  );
});

test("large video is checked using its existing owner-owned thumbnail", async () => {
  const image = new Uint8Array([5, 6, 7]);
  const video = asset("large-video", {
    object_key: "video/original",
    content_type: "video/mp4",
    size: 20 * 1024 * 1024,
    sha256: "large-video-hash",
    thumbnail_id: "thumb-1",
    thumbnail_object_key: "video/poster",
    thumbnail_content_type: "image/webp",
    thumbnail_size: image.byteLength,
    thumbnail_sha256: "poster-hash",
  });
  const calls: Record<string, unknown>[] = [];

  await moderatePublication(reviewAi(undefined, calls), fixtureBucket({ "video/poster": image }), "", [video]);

  assert.equal(calls.length, 1);
  assert.equal((calls[0].images as string[])[0], `data:image/webp;base64,${Buffer.from(image).toString("base64")}`);
  assert.equal(calls[0].videos, undefined, "oversized originals are not sent to the model");
});

test("model errors and unavailable bindings never pass content through", async () => {
  await assert.rejects(
    moderatePublication(undefined, fixtureBucket(), "caption", []),
    (error: any) => error.status === 503 && /Nothing was published/.test(error.message),
  );
  await assert.rejects(
    moderatePublication({ async run() { throw new Error("model unavailable"); } }, fixtureBucket(), "caption", []),
    (error: any) => error.status === 503 && /temporarily unavailable/.test(error.message),
  );
});
