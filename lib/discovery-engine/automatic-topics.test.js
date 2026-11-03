import assert from "node:assert/strict";
import test from "node:test";
import { automaticTopicCandidates, normalizeTopicName, topicFingerprint, safeTopicName, sensitiveTopic, topicQualifies, topicTrendScore } from "./automatic-topics.js";
test("stable aliases, plurals, and conservative multi-topic basketball evidence",()=>{
  assert.equal(normalizeTopicName("  Chocolate CAKES!! "),"chocolate cake");
  assert.equal(normalizeTopicName("Lakers"),"lakers");
  const topics=automaticTopicCandidates({text:"NBA Lakers basketball practice and a three point shot"});
  for(const id of ["nba","nba-league","lakers"])assert(topics.some(t=>t.id===id));
  assert(!automaticTopicCandidates({text:"I trip on the stairs"}).some(t=>t.id==="travel"));
});
test("ordinary captions and explicit hashtags reuse a stable normalized candidate",()=>{
  const a=automaticTopicCandidates({text:"Coral gardening with shells"}).find(t=>t.normalized==="coral gardening");
  const b=automaticTopicCandidates({text:"#Coral_Gardening"}).find(t=>t.normalized==="coral gardening");
  assert(a);assert.equal(a.id,b.id);
  assert.equal(topicFingerprint("coral gardening 123"),topicFingerprint("CORAL gardening 456"));
});
test("candidate generation is bounded and does not publish weak or unsafe labels",()=>{
  const topics=automaticTopicCandidates({text:"A long ordinary caption about coral gardening and reef planting and plant growing near river banks"});
  assert(topics.filter(t=>!t.curated).length<=3);
  assert(!safeTopicName("follow everyone"));assert(!safeTopicName("fucking nonsense"));assert(sensitiveTopic("Mental health"));
  assert(!topicQualifies({posts:8,creators:1,uniqueContent:8,confidence:.9}));
  assert(!topicQualifies({posts:8,creators:3,uniqueContent:1,confidence:.9}));
  assert(topicQualifies({posts:3,creators:2,uniqueContent:3,confidence:.66}));
});
test("trend score rewards distinct creators and recent growth; engagement is capped",()=>{
  const current={posts:12,previous:3,creators:4,engagement:20,searches:10,ageHours:1};
  assert(topicTrendScore(current)>topicTrendScore({...current,creators:1}));
  assert(topicTrendScore(current)>topicTrendScore({...current,ageHours:100}));
  assert.equal(topicTrendScore({...current,engagement:100000}),topicTrendScore({...current,engagement:32}));
});
