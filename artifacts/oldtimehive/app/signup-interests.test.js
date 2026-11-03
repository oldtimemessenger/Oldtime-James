import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeSignupInterests, signupInterestsError, signupInterestsCountLabel, SIGNUP_INTERESTS_MIN, SIGNUP_INTERESTS_MAX } from "./signup-interests.js";

const allowed = [{ id: "music", label: "Music" }, { id: "food", label: "Food" }, { id: "tech", label: "Tech" }, { id: "art", label: "Art & design" }];

test("signup requires three different interests and accepts custom words", () => {
  assert.equal(SIGNUP_INTERESTS_MIN, 3);
  assert.equal(SIGNUP_INTERESTS_MAX, 24);
  assert.match(signupInterestsError(["music", "food"], allowed), /at least 3/);
  assert.equal(signupInterestsError(["music", "food", "Bird watching"], allowed), "", "custom interests count");
  assert.equal(signupInterestsError(["music", "food", "tech"], allowed), "");
  assert.deepEqual(normalizeSignupInterests(["music", "Music", "Bird watching", "bird watching", "art"], allowed), ["music", "Bird watching", "art"]);
  assert.deepEqual(normalizeSignupInterests(["<script>", "x".repeat(41), "   "], allowed), []);
  assert.equal(signupInterestsCountLabel(1), "1 of 3 minimum selected");
  assert.equal(signupInterestsCountLabel(4), "4 selected");
});

test("signup markup has five steps, an escaped interest picker and an explicit optional follow choice", () => {
  const html = readFileSync(new URL("./auth-design.js", import.meta.url), "utf8");
  assert.equal((html.match(/data-signup-step="\d"/g) || []).length, 5);
  assert.match(html, /data-signup-interest="\$\{safe\(item\.id\)\}"/, "interest ids are escaped");
  assert.match(html, /\$\{safe\(item\.label\)\}/, "interest labels are escaped");
  assert.match(html, /id="su-follow-oldtime" type="checkbox" data-testid/);
  assert.doesNotMatch(html, /id="su-follow-oldtime"[^>]*\bchecked\b/);
  assert.match(html, /Follow @oldtime for app updates/);
  assert.match(html, /Optional\. You can turn this off now or unfollow anytime\./);
  for (const id of ["su-first", "su-last", "su-email", "su-user", "su-birthday", "su-pass", "go", "signup-step-back", "back"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.ok(html.indexOf("su-interest-count") < html.indexOf('id="su-pass"'), "interests come before the final password step");
});

test("signup submit passes selected ids and the follow choice; age check is kept", () => {
  const src = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  assert.match(src, /interests: normalizeSignupInterests\(signupInterests, PROFILE_INTERESTS\)/);
  assert.match(src, /followOldtime: \$\("#su-follow-oldtime"\)\.checked === true/);
  assert.match(src, /signupAgeError\(\$\("#su-birthday"\)\.value\)/);
});
