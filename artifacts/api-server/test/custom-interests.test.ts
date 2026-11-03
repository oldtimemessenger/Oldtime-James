import test from "node:test";
import assert from "node:assert/strict";
import { signupPreferences, initialSignupState } from "../src/cloudflare/signup-preferences";
import { RegisterAccountBody } from "@workspace/api-zod";

test("signup accepts preset and custom interests without new storage", () => {
  const input = { interests: ["music", "Bird watching", "Ceramics"], followOldtime: false };
  const parsed = signupPreferences(input);
  assert.deepEqual(parsed, input);
  assert.deepEqual(initialSignupState("1990-01-01", parsed.interests), {
    profile: { birthday: "1990-01-01" },
    interestPreferences: { enabled: true, selected: input.interests },
  });
  assert.equal(RegisterAccountBody.safeParse({
    email: "layout@example.com", username: "layoutcheck", displayName: "Layout member",
    password: "test-only-fixture-password", birthday: "1990-01-01", ...input,
  }).success, true);
});

test("signup trims custom words and counts distinct interests ignoring case", () => {
  assert.deepEqual(signupPreferences({ interests: ["  Bird   watching ", "music", "Ceramics"] }).interests,
    ["Bird watching", "music", "Ceramics"]);
  assert.throws(() => signupPreferences({ interests: ["music", "Music", "MUSIC"] }));
  assert.throws(() => signupPreferences({ interests: ["music", "food"] }));
});

test("markup, controls, empty and oversized custom interests are rejected", () => {
  for (const value of ["<script>", "\u0000", "", "x".repeat(41)]) {
    assert.throws(() => signupPreferences({ interests: ["music", "food", value] }));
  }
});
