import test from "node:test";
import assert from "node:assert/strict";
import { FEED_SOUND_PREFERENCE_KEY, feedSoundPreferenceKey, readFeedSoundMuted, saveFeedSoundMuted } from "./feed-sound-preference.js";

test("video sound choice persists across feed renders and defaults to muted", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(readFeedSoundMuted("account-a", storage), true);
  assert.equal(saveFeedSoundMuted(false, "account-a", storage), false);
  assert.equal(readFeedSoundMuted("account-a", storage), false);
  assert.equal(values.get(feedSoundPreferenceKey("account-a")), "false");
  assert.equal(values.has(FEED_SOUND_PREFERENCE_KEY), false);
  assert.equal(readFeedSoundMuted("account-b", storage), true);
  saveFeedSoundMuted(true, "account-a", storage);
  assert.equal(readFeedSoundMuted("account-a", storage), true);
});

test("sound preference handles storage blocked by browser privacy settings", () => {
  assert.equal(readFeedSoundMuted("account-a", { getItem() { throw new Error("blocked"); } }), true);
  assert.equal(saveFeedSoundMuted(false, "account-a", { setItem() { throw new Error("blocked"); } }), false);
});
