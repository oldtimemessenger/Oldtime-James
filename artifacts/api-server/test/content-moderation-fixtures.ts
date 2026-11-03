import type { MediaBucket } from "../src/cloudflare/runtime";

const stored = new Map<string, Uint8Array>();

export const safeReviewAi = {
  async run() {
    return {
      answers: {
        clear_violation: { noul: 0.01 },
        needs_review: { noul: 0.02 },
      },
    };
  },
};

export const reviewMediaBucket = {
  async get(key: string) {
    const bytes = stored.get(key) ?? new Uint8Array(1024);
    const body = bytes;
    return { size: body.byteLength, body: new Response(body).body };
  },
  async put(key: string, value: Uint8Array | ArrayBuffer) {
    stored.set(key, value instanceof Uint8Array ? value : new Uint8Array(value));
  },
  async delete(key: string) {
    stored.delete(key);
  },
} as unknown as MediaBucket;
