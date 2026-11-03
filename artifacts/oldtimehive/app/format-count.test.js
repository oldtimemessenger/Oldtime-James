import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCount } from "./format-count.js";
test("public counts use compact units at 1,000 without overstating totals", () => {
  for (const [input, expected] of [[0,"0"],[999,"999"],[1000,"1k"],[1500,"1.5k"],[10999,"10.9k"],
    [999999,"999.9k"],[1000000,"1m"],[1500000,"1.5m"],[1e9,"1b"],[-1,"0"],[NaN,"0"],[Infinity,"0"]])
    assert.equal(formatCount(input), expected);
});
