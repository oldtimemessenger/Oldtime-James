import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function moduleUnderTest(label) {
  const source=(await readFile(new URL("./community-feeds.js",import.meta.url),"utf8")).replace(/^import "\.\/community-feeds\.css";\s*/,"");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${label}`);
}
const account="11111111-1111-4111-8111-111111111111";
const preferences={pinned:["following","discover","popular","friends","media"],filters:{},mutedWords:[],mutedAccounts:[],caughtUp:{}};
function dependencies(module,respond){
  const node={addEventListener(){},setAttribute(){},dataset:{},style:{}};
  const state={html:"",renders:0,unavailable:0,calls:[]};
  const deps={
    api:{
      cloudAccountId:()=>account,me:()=>({id:account,following:[],friends:[]}),
      cloudPost:()=>null,cacheCloudExplorePosts:posts=>posts,blocked:()=>false,
      db:()=>({requests:[],blocks:[]}),
    },
    requestCloudApi:async(path,options)=>{state.calls.push(path);return respond(path,options);},
    app:{querySelector:()=>node,querySelectorAll:()=>[]},
    shell:html=>{state.html=html;},esc:value=>String(value??""),icon:()=>"",toast(){},
    renderPost:()=>"<article>Fixture post</article>",bindPosts(){},isActive:()=>true,
    onCompose(){},onSearch(){},onProfile(){},onFollow(){},
    onUnavailable(){state.unavailable++;},
    refresh(){
      state.renders++;
      assert.ok(state.renders<12,"render must not refetch continuously when a cached post is absent");
      if(!state.unavailable)module.renderCommunityFeeds(deps);
    },
  };
  return {deps,state};
}
const settled=()=>new Promise(resolve=>setTimeout(resolve,25));

test("The default Community header keeps exactly four core tabs through loading and network errors",async()=>{
  const module=await moduleUnderTest("four-default-tabs");
  const {deps,state}=dependencies(module,async()=>{throw new Error("Offline");});
  const pinned=()=>[...state.html.matchAll(/data-cf-feed="([^"]+)"/g)].map(match=>match[1]);
  module.renderCommunityFeeds(deps);
  assert.deepEqual(pinned(),["following","discover","popular","friends"]);
  await settled();
  assert.deepEqual(pinned(),["following","discover","popular","friends"]);
});

test("unavailable preferences never switch to the legacy screen or loop requests",async()=>{
  const module=await moduleUnderTest("older-server");
  const {deps,state}=dependencies(module,async path=>{
    if(path.endsWith("/preferences"))throw Object.assign(new Error("Not found"),{status:404});
    if(path.includes("/lists"))return {lists:[]};
    if(path.includes("/people"))return {suggestions:[]};
    return {posts:[],hasMore:false,nextOffset:0};
  });
  module.renderCommunityFeeds(deps);await settled();
  assert.equal(state.unavailable,0);
  assert.equal(state.calls.filter(path=>path.endsWith("/preferences")).length,1);
});

test("Discover is the starting feed and missing cached posts cannot start a refetch loop",async()=>{
  const module=await moduleUnderTest("bounded-cache-miss");
  const {deps,state}=dependencies(module,async path=>{
    if(path.endsWith("/preferences"))return {preferences,mutedAccounts:[]};
    if(path.includes("/lists"))return {lists:[]};
    if(path.includes("/people"))return {suggestions:[{profile:{id:"other",username:"genuine_member",displayName:"Genuine Member"}}]};
    return {posts:[{id:"cache-missing",author:{id:"other"},text:"Fixture"}],hasMore:false,nextOffset:1};
  });
  module.renderCommunityFeeds(deps);await settled();
  assert.equal(state.calls.filter(path=>path.includes("/community/feed?")).length,1);
  assert.match(state.calls.find(path=>path.includes("/community/feed?"))||"",/feed=discover/);
  assert.match(state.html,/People you may like/);
  assert.match(state.html,/Genuine Member/);
});

test("shared-interest suggestions have their own row without duplicating general suggestions",async()=>{
  const module=await moduleUnderTest("separate-interest-row");
  const {deps,state}=dependencies(module,async path=>{
    if(path.endsWith("/preferences"))return {preferences,mutedAccounts:[]};
    if(path.includes("/lists"))return {lists:[]};
    if(path.includes("/people"))return {suggestions:[
      {profile:{id:"general",username:"general_member"},reason:"mutual-followers"},
      {profile:{id:"shared",username:"shared_member"},sharedInterests:["Music"]},
      {profile:{id:"matching",username:"matching_member"},sharedInterests:[],matchingInterests:["Art"]},
      {profile:{id:"blocked",username:"blocked_member"},sharedInterests:["Music"]},
      {profile:{id:"followed",username:"followed_member"},sharedInterests:["Music"]},
    ]};
    return {posts:[],hasMore:false,nextOffset:0};
  });
  deps.api.blocked=(_,id)=>id==="blocked";
  deps.api.me=()=>({id:account,following:["followed"],friends:[]});
  module.renderCommunityFeeds(deps);await settled();
  const sections=[...state.html.matchAll(/<section class="cf-suggestions"[^>]*>[\s\S]*?<\/section>/g)].map(match=>match[0]);
  assert.equal(sections.length,2);
  assert.match(sections[0],/People you may like/);
  assert.match(sections[0],/@general_member/);
  assert.doesNotMatch(sections[0],/@shared_member|@matching_member/);
  assert.match(sections[1],/People who share your interests/);
  assert.match(sections[1],/@shared_member/);
  assert.match(sections[1],/@matching_member/);
  assert.doesNotMatch(state.html,/@blocked_member|@followed_member/);
  assert.ok(state.html.indexOf('class="cf-footer"')<state.html.indexOf("People who share your interests"));
});

test("shared-interest row appears once at the very bottom after all posts and feed controls",async()=>{
  const module=await moduleUnderTest("interest-row-in-feed");
  const {deps,state}=dependencies(module,async path=>{
    if(path.endsWith("/preferences"))return {preferences,mutedAccounts:[]};
    if(path.includes("/lists"))return {lists:[]};
    if(path.includes("/people"))return {suggestions:[{profile:{id:"shared",username:"shared_member"},sharedInterests:["Music"]}]};
    return {posts:[1,2,3,4].map(id=>({id:String(id)})),hasMore:false,nextOffset:4};
  });
  deps.api.cloudPost=id=>({id});
  deps.renderPost=post=>`<article>Post ${post.id}</article>`;
  module.renderCommunityFeeds(deps);await settled();
  assert.equal((state.html.match(/aria-label="People who share your interests"/g)||[]).length,1);
  assert.ok(state.html.indexOf("Post 4")<state.html.indexOf("People who share your interests"));
  assert.ok(state.html.indexOf("Mark caught up")<state.html.indexOf("People who share your interests"));
});

test("a server-confirmed Community post appears immediately in Discover",async()=>{
  const module=await moduleUnderTest("published-post-discover");
  const {deps,state}=dependencies(module,async path=>{
    if(path.endsWith("/preferences"))return {preferences,mutedAccounts:[]};
    if(path.includes("/lists"))return {lists:[]};
    if(path.includes("/people"))return {suggestions:[]};
    return {posts:[],hasMore:false,nextOffset:0};
  });
  const post={id:"new-community-post",author:{id:account},destination:"community",text:"Newly published Community post"};
  deps.api.cloudPost=id=>id===post.id?post:null;
  deps.renderPost=item=>`<article>${item.text}</article>`;
  module.renderCommunityFeeds(deps);await settled();
  assert.equal(module.showPublishedPost(post),true);
  module.renderCommunityFeeds(deps);
  assert.match(state.html,/Newly published Community post/);
  assert.match(state.html,/data-cf-feed="discover" aria-current="page"/);
  assert.equal(module.showPublishedPost({...post,id:"main-only-post",destination:"main"}),false);
});
