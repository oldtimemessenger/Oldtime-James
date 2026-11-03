import test from "node:test";
import assert from "node:assert/strict";
import {readHelpState,canShowHelp,pickHelpPrompt,recordHelpChoice} from "./help-prompts.js";
const DAY=86400000,NOW=10*DAY;
const prefs={features:true,communities:true};
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};
test("completed tasks are not suggested and disabled categories stay disabled",()=>{
  const state={lastShownAt:0,items:{}};
  assert.equal(pickHelpPrompt({hasCover:true,friendCount:4,hasNote:true},state,prefs,NOW),null);
  assert.equal(pickHelpPrompt({hasCover:false,friendCount:0},state,{features:false,communities:false},NOW),null);
  assert.equal(pickHelpPrompt({hasCover:true,friendCount:0,hasNote:true},state,prefs,NOW).primaryRoute,"help-friends");
  assert.equal(pickHelpPrompt({hasCover:true,friendCount:2,hasNote:true},state,prefs,NOW).primaryRoute,"help-blast-invite");
  assert.equal(pickHelpPrompt({hasCover:true,friendCount:4,hasNote:false},state,prefs,NOW).primaryRoute,"help-note");
});
test("one prompt at most every 72 hours, with permanent per-prompt dismissal and account isolation",()=>{
  const s=storage();recordHelpChoice("a","help-cover","shown",NOW,s);
  assert.equal(canShowHelp(readHelpState("a",s),NOW+DAY),false);
  assert.equal(canShowHelp(readHelpState("a",s),NOW+3*DAY),true);
  recordHelpChoice("a","help-cover","never",NOW,s);
  const a=pickHelpPrompt({hasCover:false,friendCount:0},readHelpState("a",s),prefs,NOW+4*DAY);
  assert.notEqual(a.id,"help-cover");
  assert.equal(pickHelpPrompt({hasCover:false,friendCount:0},readHelpState("b",s),prefs,NOW+4*DAY).id,"help-cover");
});
test("repeated dismissals and action choices reduce repeat ranking",()=>{
  const s=storage();recordHelpChoice("a","help-cover","not-now",NOW,s);
  recordHelpChoice("a","help-cover","not-now",NOW,s);
  assert.equal(pickHelpPrompt({hasCover:false,friendCount:0},readHelpState("a",s),prefs,NOW).id,"help-friends");
  recordHelpChoice("b","help-cover","action",NOW,s);
  assert.equal(pickHelpPrompt({hasCover:false,friendCount:0},readHelpState("b",s),prefs,NOW).id,"help-friends");
});
test("unavailable or malformed storage does not cause repeat prompts",()=>{
  assert.equal(readHelpState("a",{getItem(){throw Error("blocked");}}),null);
  assert.equal(canShowHelp(null,NOW),false);
  assert.throws(()=>recordHelpChoice("a","help-cover","never",NOW,{getItem(){throw Error("blocked");}}));
});
test("prompts never interrupt composition and interest prompt needs explicit empty interests",()=>{
  const state={lastShownAt:0,items:{}},p={features:true};
  const ctx={page:"home",hasCover:true,friendCount:5,hasNote:true,interestsSet:false};
  assert.equal(pickHelpPrompt({...ctx,composing:true},state,p,NOW),null);
  assert.equal(pickHelpPrompt({...ctx,interestsSet:true},state,p,NOW)?.id!=="help-interests",true);
});
