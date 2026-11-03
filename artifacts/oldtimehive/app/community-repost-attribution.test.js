import test from "node:test";
import assert from "node:assert/strict";
import { compactRepostSummary } from "./community-repost-attribution.js";

test("Community repost attribution keeps one original post and summarizes other reposters", () => {
  assert.deepEqual(compactRepostSummary([{ username: "first" }], 1), {
    firstName: "@first",
    extraLabel: "",
    label: "Reposted by @first",
  });
  assert.deepEqual(compactRepostSummary([{ username: "first" }], 4), {
    firstName: "@first",
    extraLabel: "and 3 others",
    label: "Reposted by @first and 3 others",
  });
  assert.equal(compactRepostSummary([], 0), null);
});
