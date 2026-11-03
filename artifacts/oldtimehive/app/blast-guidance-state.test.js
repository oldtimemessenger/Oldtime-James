import assert from "node:assert/strict";
import test from "node:test";
import { isBlastGuidanceSafe, syncBlastGuidanceState } from "./blast-guidance-state.js";

test("helpful prompts are limited to safe Community views and hidden while settings are open", () => {
  for (const view of ["notes", "hub", "friends", "chats", "communities"]) {
    syncBlastGuidanceState(view, false);
    assert.equal(isBlastGuidanceSafe(), true, `${view} should allow a helpful prompt`);
  }
  for (const view of ["detail", "community", "create", "note-camera", "note-editor", "privacy"]) {
    syncBlastGuidanceState(view, false);
    assert.equal(isBlastGuidanceSafe(), false, `${view} should suppress a helpful prompt`);
  }
  syncBlastGuidanceState("notes", true);
  assert.equal(isBlastGuidanceSafe(), false);
  syncBlastGuidanceState("notes", false);
  assert.equal(isBlastGuidanceSafe(), true);
});
