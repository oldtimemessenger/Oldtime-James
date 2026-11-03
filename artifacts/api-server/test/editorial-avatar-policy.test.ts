import assert from "node:assert/strict";
import test from "node:test";
import {
  accountStateSchema,
  BLOCKED_PROFILE_IMAGE_FILES,
  RESERVED_PROFILE_IMAGE_ERROR,
  isBlockedProfileImage,
  profileUpdateSchema,
} from "@workspace/api-zod";

test("blocked profile artwork is rejected across account update paths", () => {
  for (const file of BLOCKED_PROFILE_IMAGE_FILES) {
    const url = `https://heyoldtime.com/avatars/${file}?version=1`;
    assert.equal(isBlockedProfileImage(url), true, `${file} is recognized`);
    assert.equal(accountStateSchema.safeParse({ profile: { avatar: url } }).success, false);
    assert.equal(accountStateSchema.safeParse({ profile: { cover: url } }).success, false);
    const update = profileUpdateSchema.safeParse({
      username: "sample_member",
      displayName: "Sample Member",
      email: "sample@example.com",
      profile: { avatar: url },
    });
    assert.equal(update.success, false);
    if (!update.success) {
       assert.ok(update.error.issues.some(issue => issue.message === RESERVED_PROFILE_IMAGE_ERROR));
    }
  }
});

test("blocked profile artwork detection handles alternate hosts and encoded paths", () => {
  assert.equal(isBlockedProfileImage("/avatars/courtside-daily.png"), true);
  assert.equal(isBlockedProfileImage("https://cdn.example/%61vatars/courtside-daily.png"), true);
  assert.equal(isBlockedProfileImage("https://cdn.example/avatars/member-photo.png"), false);
});

test("member profile media and built-in avatar artwork remain allowed", () => {
  const result = accountStateSchema.safeParse({
    profile: {
      avatar: "oldtime-media:12345678-1234-4234-8234-123456789012",
      cover: "/brand/avatars/blue.svg",
    },
  });
  assert.equal(result.success, true);
});
