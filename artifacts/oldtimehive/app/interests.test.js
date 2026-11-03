import test from "node:test";
import assert from "node:assert/strict";
import { readInterests, saveInterests, resetInterests, interestContext } from "./interests.js";
import { mockCloudAccountState } from "./test-cloud-state.js";
import { api } from "./store.js";
test("interests are per account, validated, resettable and disableable", async () => {
  const cloud = mockCloudAccountState("a");
  assert.equal(interestContext("a").interestsSet, false);
  assert.deepEqual(await saveInterests("a", { selected: ["Sports", "Sports", "Bird watching", "<script>"] }), ["Sports", "Bird watching"]);
  assert.deepEqual(interestContext("a"), { interests: ["Sports", "Bird watching"], interestsSet: true });
  cloud.switchAccount("b");
  assert.equal(interestContext("b").interestsSet, false);
  cloud.switchAccount("a");
  await saveInterests("a", { enabled: false, selected: ["Music"] });
  assert.deepEqual(interestContext("a").interests, []);
  await resetInterests("a");
  assert.equal(readInterests("a").decided, false);
  cloud.restore();
});
test("unavailable account state never prompts", () => {
  const cloud = mockCloudAccountState("a");
  cloud.setLoaded(false);
  assert.equal(interestContext("a").interestsSet, true);
  cloud.restore();
});
test("signup interest ids remain visible and editable in the existing cloud preference controls",async()=>{
  const cloud=mockCloudAccountState("a");
  try{
    await api.updateCloudAccountState({interestPreferences:{enabled:true,selected:["fitness","basketball","study-groups","tech"]}});
    assert.deepEqual(readInterests("a").selected,["Fitness","Basketball","Study groups","Technology"]);
    await saveInterests("a",{selected:["running","yoga","college","Bogus"]});
    assert.deepEqual(readInterests("a").selected,["Running","Yoga","College life","Bogus"]);
  }finally{cloud.restore();}
});
