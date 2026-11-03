import test from "node:test";
import assert from "node:assert/strict";
import { getRepostView, writeRepost } from "./repost-state.js";

test("a local repost note saves without editing the original or peers",()=>{
  const post={id:"p",author:"source",caption:"Original",media:["photo"],visibility:"friends",reposts:["peer"],repostNotes:{peer:"Their note"}};
  const db={posts:[post]};
  writeRepost(db,post,"me"," My note ");
  assert.deepEqual(post.reposts,["peer","me"]);
  assert.deepEqual(post.repostNotes,{peer:"Their note",me:"My note"});
  assert.equal(post.caption,"Original");assert.equal(post.visibility,"friends");
  assert.deepEqual(post.media,["photo"]);
  writeRepost(db,post,"me","",true);
  assert.deepEqual(post.reposts,["peer"]);
  assert.deepEqual(post.repostNotes,{peer:"Their note"});
});
test("online notes persist by reference, not by copying source content",()=>{
  const post={id:"online",cloud:true,caption:"Never snapshot this",media:["private-source"],reposts:[]};
  let db={posts:[]};
  writeRepost(db,post,"me","Saved reaction");
  db=JSON.parse(JSON.stringify(db));
  const view=getRepostView(post,db);
  assert.deepEqual(view.reposts,["me"]);
  assert.equal(view.repostNotes.me,"Saved reaction");
  assert.equal(post.repostNotes,undefined);
  assert.equal(db.posts.length,0);
  assert.doesNotMatch(JSON.stringify(db),/Never snapshot|private-source/);
});
test("editing/removing one online note does not change another user's note",()=>{
  const post={id:"online",cloud:true};
  const db={posts:[]};
  writeRepost(db,post,"peer","Their note");
  writeRepost(db,post,"me","First");
  writeRepost(db,post,"me","Edited");
  assert.equal(getRepostView(post,db).repostNotes.me,"Edited");
  writeRepost(db,post,"me","",true);
  assert.deepEqual(getRepostView(post,db).reposts,["peer"]);
  assert.equal(getRepostView(post,db).repostNotes.peer,"Their note");
});
test("an empty note still permits a repost; removing it cleans its reference",()=>{
  const post={id:"online",cloud:true};const db={posts:[]};
  writeRepost(db,post,"me");
  assert.deepEqual(getRepostView(post,db).reposts,["me"]);
  writeRepost(db,post,"me","",true);
  assert.deepEqual(db.localRepostsByPost,{});
});
test("unavailable local sources fail rather than creating a snapshot",()=>{
  assert.throws(()=>writeRepost({posts:[]},{id:"missing"},"me","note"),/no longer available/);
});
