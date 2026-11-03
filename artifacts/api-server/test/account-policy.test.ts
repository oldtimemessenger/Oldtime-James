import assert from "node:assert/strict";
import test from "node:test";
import {
  isOfficialOldtimeAccount,
  hasPermanentBlueBadge,
  isReservedAccountUsername,
  OFFICIAL_OLDTIME_ACCOUNT_ID,
} from "@workspace/api-zod/account-policy";

test("Oldtime identity is official and its username stays reserved", () => {
  assert.equal(isOfficialOldtimeAccount(OFFICIAL_OLDTIME_ACCOUNT_ID), true);
  assert.equal(isOfficialOldtimeAccount(OFFICIAL_OLDTIME_ACCOUNT_ID.toUpperCase()), true);
  assert.equal(hasPermanentBlueBadge(OFFICIAL_OLDTIME_ACCOUNT_ID), true);
  assert.equal(hasPermanentBlueBadge("00000000-0000-4000-8000-000000000000"), false,
    "only IDs explicitly added to the permanent badge allowlist are exempt from membership");
  assert.equal(
    isReservedAccountUsername(" OldTime ", OFFICIAL_OLDTIME_ACCOUNT_ID),
    false,
    "the official account keeps its handle",
  );
  assert.equal(isReservedAccountUsername("oldtime", "another-account"), true);
  assert.equal(isReservedAccountUsername("OLDTIME"), true);
  assert.equal(isReservedAccountUsername("oldtime_"), false);
});
