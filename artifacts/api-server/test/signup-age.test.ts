import test from "node:test";
import assert from "node:assert/strict";
import { signupAgeError } from "@workspace/api-zod/signup-age";

const now = new Date("2026-10-28T12:00:00.000Z");

test("signup age validation checks the exact 16th birthday", () => {
  assert.equal(signupAgeError("2010-10-28", now), null);
  assert.equal(signupAgeError("2010-10-29", now), "Oldtime is for people 16 and older.");
});

test("signup age validation rejects invalid and future dates", () => {
  assert.equal(signupAgeError("2010-02-30", now), "Enter a valid birthday.");
  assert.equal(signupAgeError("2027-01-01", now), "Enter a valid birthday.");
  assert.equal(signupAgeError("", now), "Enter a valid birthday.");
});

test("leap-day birthdays become eligible on March 1 in non-leap years", () => {
  assert.equal(signupAgeError("2012-02-29", new Date("2028-02-29T00:00:00.000Z")), null);
  assert.equal(signupAgeError("2012-02-29", new Date("2028-02-28T00:00:00.000Z")), "Oldtime is for people 16 and older.");
});
