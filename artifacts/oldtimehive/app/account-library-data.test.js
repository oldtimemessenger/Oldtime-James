import test from "node:test";
import assert from "node:assert/strict";
import { createAccountLibraryData } from "./account-library-data.js";

function fixture(initial={}) {
  let owner="owner",state=structuredClone(initial);
  const writes=[],requests=[];
  const api={cloudAccountId:()=>owner,loadCloudAccountState:async()=>structuredClone(state),
    async updateCloudAccountState(patch,options){writes.push({patch,options});state={...state,...patch};},
    cacheCloudExplorePosts:posts=>posts.map(p=>({...p,normalized:true}))};
  return {api,writes,requests,changeOwner:()=>{owner="other";},state:()=>state,
    library:createAccountLibraryData({api,request:async path=>{requests.push(path);return {posts:[{id:"post"}],hasMore:false,nextOffset:1};}})};
}
test("Saved loads the bounded authenticated endpoint and normalizes posts",async()=>{
  const f=fixture(),result=await f.library.saved({filter:"reels",offset:18,limit:18});
  assert.equal(f.requests[0],"/api/account/library/saved?filter=reels&offset=18&limit=18");
  assert.equal(result.posts[0].normalized,true);
});
test("collections persist narrow private patches without changing saves or account settings",async()=>{
  const f=fixture({savedPostIds:["keep"],accountPrivacy:"private",savedCollections:[]});
  const result=await f.library.saveCollection({title:"Ideas",postIds:["p1","p1","p2"]});
  assert.deepEqual(result.collection.postIds,["p1","p2"]);
  await f.library.saveCollection({id:result.collection.id,title:"New name"});
  assert.deepEqual(f.state().savedCollections[0].postIds,["p1","p2"]);
  await f.library.deleteCollection(result.collection.id);
  assert.deepEqual(f.state().savedCollections,[]);
  assert.deepEqual(f.state().savedPostIds,["keep"]);
  assert.equal(f.state().accountPrivacy,"private");
  assert.ok(f.writes.every(w=>w.options.patchOnly===true&&Object.keys(w.patch).length===1));
});
test("archive settings do not remove old records or resend unrelated preferences",async()=>{
  const f=fixture({archivePreferences:{autoArchiveStories:true,allowPostArchive:true},savedPostIds:["keep"]});
  assert.deepEqual(await f.library.updatePreferences({autoArchiveStories:false}),{autoArchiveStories:false,allowPostArchive:true});
  assert.deepEqual(f.writes[0].patch,{archivePreferences:{autoArchiveStories:false,allowPostArchive:true}});
  assert.deepEqual(f.state().savedPostIds,["keep"]);
});
test("an account switch prevents private library requests and changes",async()=>{
  const f=fixture();f.changeOwner();
  await assert.rejects(f.library.saved(),/account changed/);
  await assert.rejects(f.library.saveCollection({title:"No"}),/account changed/);
  assert.equal(f.requests.length,0);assert.equal(f.writes.length,0);
});
