import assert from "node:assert/strict";
import test from "node:test";
import { selectFeedVideoCandidate } from "./feed-video-focus.js";

const entry = (target, intersectionRatio, top, height = 400, isIntersecting = true) => ({
  target, intersectionRatio, isIntersecting, boundingClientRect: { top, height },
});

test("feed video focus chooses the most visible video in an observer batch", () => {
  const barelyVisible = {};
  const mostlyVisible = {};
  assert.equal(selectFeedVideoCandidate([
    entry(barelyVisible, 0.68, 10),
    entry(mostlyVisible, 0.94, 500),
  ]), mostlyVisible);
});

test("feed video focus uses distance from feed center to break visibility ties", () => {
  const farther = {};
  const centered = {};
  assert.equal(selectFeedVideoCandidate([
    entry(farther, 0.8, 700),
    entry(centered, 0.8, 100),
  ]), centered);
});

test("feed video focus ignores exited entries and handles empty batches", () => {
  const exited = {};
  assert.equal(selectFeedVideoCandidate([entry(exited, 1, 0, 400, false)]), null);
  assert.equal(selectFeedVideoCandidate([]), null);
  assert.equal(selectFeedVideoCandidate(null), null);
});
