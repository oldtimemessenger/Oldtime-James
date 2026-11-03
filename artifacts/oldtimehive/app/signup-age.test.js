import test from "node:test";
import assert from "node:assert/strict";
import { signupAgeError } from "./signup-age.js";

const now = new Date("2026-10-28T12:00:00.000Z");

test("client signup age validation checks the exact 16th birthday", () => {
  assert.equal(signupAgeError("2010-10-28", now), null);
  assert.equal(signupAgeError("2010-10-29", now), "Oldtime is for people 16 and older.");
});

test("client signup age validation rejects invalid and future dates", () => {
  assert.equal(signupAgeError("2010-02-30", now), "Enter a valid birthday.");
  assert.equal(signupAgeError("2027-01-01", now), "Enter a valid birthday.");
  assert.equal(signupAgeError("", now), "Enter a valid birthday.");
});
