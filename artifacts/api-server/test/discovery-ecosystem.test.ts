import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { discoveryRequest } from "../src/cloudflare/discovery";
import { socialRequest } from "../src/cloudflare/social";
import { soundRequest } from "../src/cloudflare/sounds";
import { analyticsRequest } from "../src/cloudflare/analytics";
import { canReadMedia } from "../src/cloudflare/media";
import { chatRequest } from "../src/cloudflare/chats";
import type { Database, Statement } from "../src/cloudflare/runtime";
import { reviewMediaBucket, safeReviewAi } from "./content-moderation-fixtures";
import {
  classifyDiscovery, makeDiscoveryDocument, emergingDiscoveryTopics, rankDiscovery, discoveryFtsQuery,
} from "../../../lib/discovery-engine/index.js";

function fixture(t:{after:(fn:()=>void)=>void}) {
  const sqlite=new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const directory=new URL("../migrations/",import.meta.url);
  for(const file of readdirSync(directory).filter(f=>f.endsWith(".sql")).sort())
    sqlite.exec(readFileSync(new URL(file,directory),"utf8"));
  t.after(()=>sqlite.close());
  function prepare(sql:string):Statement {
    let values:any[]=[];
    return {
      bind(...input:unknown[]){values=input;return this;},
      async all<T>(){return {success:true,results:sqlite.prepare(sql).all(...values) as T[]};},
      async first<T>(){return (sqlite.prepare(sql).get(...values)??null) as T|null;},
      async run<T>(){const value=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(value.changes)}};},
    };
  }
  const db:Database={prepare,async batch(statements){
    sqlite.exec("BEGIN");
    try {const values=await Promise.all(statements.map(s=>s.run()));sqlite.exec("COMMIT");return values;}
    catch(error){sqlite.exec("ROLLBACK");throw error;}
  }};
  function user(username:string,isPrivate=0){
    const id=randomUUID();
    sqlite.prepare(`INSERT INTO users(id,email,username,display_name,password_salt,password_hash,created_at,is_private)
      VALUES(?,?,?,?,?,?,?,?)`).run(id,`${username}@example.test`,username,username,"test-salt","test-hash",Date.now(),isPrivate);
    return id;
  }
  async function post(userId:string,text:string,extra:Record<string,unknown>={}){
    const result=await socialRequest(new Request("https://oldtime.test/api/posts",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({text,...extra})}),db,userId,"/posts",safeReviewAi,reviewMediaBucket);
    assert.equal(result.status,201);
    return (await result.json() as any).post;
  }
  async function search(userId:string,query=""){
    const response=await discoveryRequest(new Request(`https://oldtime.test/api/discovery/explore?${query}`),db,userId,"/discovery/explore");
    return response.json() as Promise<any>;
  }
  async function put(userId:string,path:string,data:unknown){
    return discoveryRequest(new Request(`https://oldtime.test/api${path}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}),db,userId,path);
  }
  return {sqlite,db,user,post,search,put};
}

test("public main-feed posts reject video media above 16 MB before moderation",async t=>{
  const f=fixture(t),owner=f.user("oversize_video_owner"),mediaId=randomUUID();
  f.sqlite.prepare(`INSERT INTO user_media_assets(id,user_id,object_key,content_type,size,sha256,ready)
    VALUES(?,?,?,?,?,?,1)`).run(mediaId,owner,`test/${mediaId}`,"video/mp4",16*1024*1024+1,"test-digest");
  await assert.rejects(socialRequest(new Request("https://oldtime.test/api/posts",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({text:"Oversized public video",mediaIds:[mediaId]}),
  }),f.db,owner,"/posts",safeReviewAi,reviewMediaBucket),(error:any)=>{
    assert.equal(error.status,400);
    assert.match(error.message,/16 MB/);
    return true;
  });
  const posts=await f.db.prepare("SELECT count(*) AS count FROM posts WHERE author_id=?").bind(owner).first<{count:number}>();
  assert.equal(Number(posts?.count),0);
});

test("topic results never expose text-only Community posts",async t=>{
  const f=fixture(t),viewer=f.user("topicviewer"),author=f.user("topicauthor");
  const community=await f.post(author,"running tips from the community",{destination:"community"});
  const request=new Request("https://oldtime.test/api/discovery/trending/running/posts");
  const response=await discoveryRequest(request,f.db,viewer,"/discovery/trending/running/posts");
  assert.equal(response.status,200);
  const result=await response.json() as any;
  assert.equal(result.posts.some((post:any)=>post.id===community.id),false);
});

test("Following and Community stay relationship-based while For You and Discovery can recommend public posts",async t=>{
  const f=fixture(t);
  const viewer=f.user("timeline-viewer");
  const followedA=f.user("timeline-followed-a");
  const followedB=f.user("timeline-followed-b");
  const friend=f.user("timeline-friend");
  const stranger=f.user("timeline-stranger");
  const privateStranger=f.user("timeline-private-stranger",1);
  const ownMain=await f.post(viewer,"Own timeline post");
  const followedMainA=await f.post(followedA,"Followed account main post");
  const followedMainB=await f.post(followedB,"Second followed account main post");
  const friendMain=await f.post(friend,"Friend main post");
  const strangerMain=await f.post(stranger,"Unconnected public main post");
  const strangerUnrelated=await f.post(stranger,"Unrelated stranger post");
  const privateMain=await f.post(privateStranger,"Private account post");
  const followedCommunityA=await f.post(followedA,"Followed community post",{destination:"community"});
  const followedCommunityB=await f.post(followedB,"Second followed community post",{destination:"community"});
  const friendCommunity=await f.post(friend,"Friend community post",{destination:"community"});
  const strangerCommunity=await f.post(stranger,"Unconnected public community post",{destination:"community"});
  f.sqlite.prepare("INSERT INTO post_reposts(post_id,user_id,updated_at) VALUES(?,?,?)")
    .run(strangerMain.id,followedA,Date.now());
  const feed=async(surface:string)=>{
    const response=await socialRequest(
      new Request(`https://oldtime.test/api/feed?surface=${surface}&limit=30`),f.db,viewer,"/feed");
    assert.equal(response.status,200);
    return response.json() as Promise<any>;
  };

  assert.deepEqual((await feed("following")).posts,[],"a new account has no followed posts");
  const newAccountForYou=await feed("main");
  assert.ok(newAccountForYou.posts.some((post:any)=>post.id===strangerMain.id),
    "For You can recommend eligible public posts from unconnected creators");
  assert.ok(!newAccountForYou.posts.some((post:any)=>post.id===privateMain.id),
    "private posts remain unavailable to unconnected viewers");
  assert.deepEqual((await feed("community")).posts,[],"Community does not import unrelated public posts");

  f.sqlite.prepare("INSERT INTO user_follows(follower_id,followed_id) VALUES(?,?)").run(viewer,followedA);
  f.sqlite.prepare("INSERT INTO user_follows(follower_id,followed_id) VALUES(?,?)").run(viewer,followedB);
  const [low,high]=[viewer,friend].sort();
  f.sqlite.prepare("INSERT INTO friendships(member_low_id,member_high_id) VALUES(?,?)").run(low,high);

  const followingIds=new Set((await feed("following")).posts.map((post:any)=>post.id));
  assert.deepEqual([...followingIds].sort(),[followedMainA.id,followedMainB.id].sort(),
    "Following contains followed authors only, never strangers admitted through reposts");
  const forYouIds=new Set((await feed("main")).posts.map((post:any)=>post.id));
  assert.ok(forYouIds.has(ownMain.id));
  assert.ok(forYouIds.has(followedMainA.id)&&forYouIds.has(followedMainB.id)&&forYouIds.has(friendMain.id));
  assert.ok(forYouIds.has(strangerMain.id)&&forYouIds.has(strangerUnrelated.id),
    "For You includes eligible public posts from people the viewer does not follow");
  assert.ok(!forYouIds.has(privateMain.id),"For You still enforces private-account visibility");

  const communityIds=new Set((await feed("community")).posts.map((post:any)=>post.id));
  assert.ok(communityIds.has(followedCommunityA.id)&&communityIds.has(followedCommunityB.id)&&communityIds.has(friendCommunity.id));
  assert.ok(communityIds.has(strangerMain.id),"a followed creator's repost may surface its public original in Community");
  assert.ok(!communityIds.has(strangerCommunity.id),"unconnected Community posts do not enter the Community feed");
  assert.ok(!communityIds.has(strangerUnrelated.id),"reposting one post does not expose the creator's unrelated posts");
  const communityFollowingIds=new Set((await feed("community-following")).posts.map((post:any)=>post.id));
  assert.ok(communityFollowingIds.has(followedCommunityA.id)&&communityFollowingIds.has(followedCommunityB.id)&&!communityFollowingIds.has(strangerMain.id));
  assert.ok(!communityFollowingIds.has(friendCommunity.id)&&!communityFollowingIds.has(strangerCommunity.id));

  f.sqlite.prepare("DELETE FROM user_follows WHERE follower_id=? AND followed_id=?").run(viewer,followedA);
  f.sqlite.prepare("DELETE FROM user_follows WHERE follower_id=? AND followed_id=?").run(viewer,followedB);
  assert.deepEqual((await feed("following")).posts,[],"unfollowing everyone empties Following immediately");
  const discovery=await f.search(viewer,"type=community&limit=24");
  assert.ok(discovery.posts.some((post:any)=>post.id===strangerCommunity.id),
    "public posts from unconnected creators remain available in Discovery");
});

test("interest recommendations use Cloudflare preferences and exclude followed, private, and unrelated creators",async t=>{
  const f=fixture(t),viewer=f.user("recommendation_viewer"),followed=f.user("recommendation_followed");
  const stranger=f.user("recommendation_stranger"),unrelated=f.user("recommendation_unrelated");
  const privateCreator=f.user("recommendation_private",1);
  f.sqlite.prepare("INSERT INTO account_state(user_id,data,updated_at) VALUES(?,?,?)")
    .run(viewer,JSON.stringify({interestPreferences:{enabled:true,selected:["Sports"]}}),Date.now());
  const followedPost=await f.post(followed,"A followed creator plays basketball");
  const relevantPost=await f.post(stranger,"Basketball highlights from last night");
  const unrelatedPost=await f.post(unrelated,"A quiet day making soup");
  const privatePost=await f.post(privateCreator,"Private basketball highlights");
  f.sqlite.prepare("INSERT INTO user_follows(follower_id,followed_id) VALUES(?,?)").run(viewer,followed);

  const recommendations=await f.search(viewer,"recommendations=true&type=all&limit=20");
  const ids=new Set(recommendations.posts.map((post:any)=>post.id));
  assert.ok(ids.has(relevantPost.id),"public posts that match a selected interest are recommended");
  assert.ok(!ids.has(followedPost.id),"followed creators are not duplicated in the recommendation shelf");
  assert.ok(!ids.has(unrelatedPost.id),"unrelated content is not put into the interest shelf");
  assert.ok(!ids.has(privatePost.id),"private creators never enter public recommendations");

  await f.put(viewer,"/discovery/preferences",{personalize:false,hiddenTopics:[]});
  const optedOut=await f.search(viewer,"recommendations=true&type=all&limit=20");
  assert.deepEqual(optedOut.posts,[],"the discovery personalization switch is honored");
});

test("explicit topic searches and show-less preferences shape For You, not Following",async t=>{
  const f=fixture(t),viewer=f.user("topicfeed_viewer"),a=f.user("topicfeed_author"),b=f.user("topicfeed_other");
  const first=await f.post(a,"Basketball practice and passing drills");
  const second=await f.post(a,"NBA Lakers basketball practice with teammates");
  const unrelated=await f.post(b,"A quiet garden with flowers");
  const search=await f.search(viewer,"type=all&q=nba");
  const topicId=search.selectedTopic?.id;
  assert.ok(topicId,"a topic-backed search returns its selected topic");

  const signal=await discoveryRequest(new Request("https://oldtime.test/api/discovery/topic-events",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({topicId,kind:"search"}),
  }),f.db,viewer,"/discovery/topic-events");
  assert.equal(signal.status,200);
  assert.equal((await signal.json() as any).accepted,true);

  const feed=async(surface:string)=>{
    const response=await socialRequest(
      new Request(`https://oldtime.test/api/feed?surface=${surface}&limit=30`),f.db,viewer,"/feed");
    assert.equal(response.status,200);
    return response.json() as Promise<any>;
  };
  const forYou=await feed("main");
  assert.ok([first.id,second.id].includes(forYou.posts[0]?.id),
    "a topic explicitly searched in Discover is promoted in Home For You");
  assert.deepEqual((await feed("following")).posts,[],
    "Search signals never add unfollowed posts to Following");

  const preferences=await f.put(viewer,"/discovery/preferences",{hiddenTopics:[topicId],personalize:true});
  assert.equal(preferences.status,200);
  const afterShowLess=await feed("main");
  assert.equal(afterShowLess.posts[0]?.id,unrelated.id,
    "Show less about a topic in Discover also downranks matching For You posts");
});

test("people suggestions do not expose private or already-connected accounts",async t=>{
  const f=fixture(t),viewer=f.user("suggestion_viewer"),privateAccount=f.user("suggestion_private",1);
  f.sqlite.prepare("INSERT INTO account_state(user_id,data,updated_at) VALUES(?,?,?)")
    .run(viewer,JSON.stringify({interestPreferences:{enabled:true,selected:["Sports"]}}),Date.now());
  f.sqlite.prepare("INSERT INTO account_state(user_id,data,updated_at) VALUES(?,?,?)")
    .run(privateAccount,JSON.stringify({profile:{interests:["Sports"]}}),Date.now());
  const response=await f.db.prepare("SELECT id FROM users WHERE username='suggestion_private'").first<any>();
  const result=await (await discoveryRequest(new Request("https://oldtime.test/api/discovery/people?limit=20"),
    f.db,viewer,"/discovery/people")).json() as any;
  assert.ok(!result.suggestions.some((suggestion:any)=>suggestion.profile.id===response.id),
    "private accounts are excluded before rendering suggestions");
});

test("post retries return the original post and never recreate it after deletion",async t=>{
  const {sqlite,db,user}=fixture(t),owner=user("idempotent_post_owner"),key=randomUUID();
  const publish=(text:string,retryKey=key)=>socialRequest(new Request("https://oldtime.test/api/posts",{
    method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":retryKey},
    body:JSON.stringify({text}),
  }),db,owner,"/posts",safeReviewAi,reviewMediaBucket);
  const first=await publish("Publish once");
  assert.equal(first.status,201);
  const original=(await first.json() as any).post;
  const replay=await publish("Publish once");
  assert.equal(replay.status,200);
  assert.equal(replay.headers.get("Idempotency-Replayed"),"true");
  assert.equal((await replay.json() as any).post.id,original.id);
  assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM posts WHERE author_id=?").get(owner)?.count,1);
  await assert.rejects(publish("Different post content"),(error:any)=>error.status===409);
  assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM posts WHERE author_id=?").get(owner)?.count,1);
  sqlite.prepare("DELETE FROM posts WHERE id=?").run(original.id);
  await assert.rejects(publish("Publish once"),(error:any)=>error.status===409);
  assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM posts WHERE author_id=?").get(owner)?.count,0);
});

test("post moderation blocks unsafe submissions before a post record is written",async t=>{
  const f=fixture(t),author=f.user("moderationblocked");
  const blockedAi={async run(){return {answers:{
    clear_violation:{noul:0.98},needs_review:{noul:0.01},
  }};}};
  const request=new Request("https://oldtime.test/api/posts",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({text:"blocked moderation fixture"})});
  await assert.rejects(socialRequest(request,f.db,author,"/posts",blockedAi,reviewMediaBucket),
    (error:any)=>error.status===422&&/Nothing was published/.test(error.message));
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) count FROM posts WHERE author_id=?").get(author)?.count,0);
});

test("editing a post rechecks its text and leaves the original unchanged when blocked",async t=>{
  const f=fixture(t),author=f.user("moderationedit");
  const original=await f.post(author,"A safe caption");
  const blockedAi={async run(){return {answers:{
    clear_violation:{noul:0.95},needs_review:{noul:0.02},
  }};}};
  const request=new Request(`https://oldtime.test/api/posts/${original.id}`,{
    method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:"blocked edit"}),
  });
  await assert.rejects(socialRequest(request,f.db,author,`/posts/${original.id}`,blockedAi,reviewMediaBucket),
    (error:any)=>error.status===422&&/Nothing was published/.test(error.message));
  assert.equal((f.sqlite.prepare("SELECT text FROM posts WHERE id=?").get(original.id) as any).text,"A safe caption");
});

test("chat settings enforce recipient choices; unread is private and unsend is author-only",async t=>{
  const {db,sqlite,user}=fixture(t),sender=user("chat_sender"),recipient=user("chat_recipient"),third=user("chat_third");
  async function request(actor:string,path:string,method="GET",data?:unknown){
    return chatRequest(new Request(`https://oldtime.test/api${path}`,{
      method,...(data===undefined?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}),
    }),db,actor,path);
  }
  const initial=await (await request(recipient,"/chats/preferences")).json() as any;
  assert.equal(initial.preferences.directMessages,"everyone");
  sqlite.prepare("INSERT INTO account_state(user_id,data,updated_at) VALUES(?,?,?)").run(
    recipient,JSON.stringify({profile:{bio:"Keep this"},savedPostIds:["keep"],settings:{otherSetting:true}}),Date.now());
  const preferences={directMessages:"following",groupInvites:"none",readReceipts:false};
  assert.deepEqual((await (await request(recipient,"/chats/preferences","PUT",preferences)).json() as any).preferences,preferences);
  const saved=JSON.parse((sqlite.prepare("SELECT data FROM account_state WHERE user_id=?").get(recipient) as any).data);
  assert.equal(saved.profile.bio,"Keep this");
  assert.deepEqual(saved.savedPostIds,["keep"]);
  assert.equal(saved.settings.otherSetting,true);
  await assert.rejects(request(recipient,"/chats/preferences","PUT",{...preferences,directMessages:"invalid"}),/valid chat settings/);
  const chatId=`cv${randomUUID()}`,chatBody={id:chatId,members:[sender,recipient]};
  sqlite.prepare("INSERT INTO user_follows(follower_id,followed_id,created_at) VALUES(?,?,?)").run(sender,recipient,Date.now());
  await assert.rejects(request(sender,"/chats","POST",chatBody),/not accepting new messages/);
  sqlite.prepare("INSERT INTO user_follows(follower_id,followed_id,created_at) VALUES(?,?,?)").run(recipient,sender,Date.now());
  assert.equal((await request(sender,"/chats","POST",chatBody)).status,201);
  await request(recipient,"/chats/preferences","PUT",{...preferences,directMessages:"none"});
  assert.equal((await request(sender,"/chats","POST",chatBody)).status,201,"ongoing conversations remain available");
  await assert.rejects(request(sender,"/chats","POST",{id:`cv${randomUUID()}`,members:[sender,recipient,third]}),/not accepting new group invites/);
  const messageId=randomUUID();
  await request(sender,`/chats/${chatId}/messages`,"POST",{clientId:messageId,kind:"text",body:"A real message in an isolated database",metadata:{},mediaIds:[]});
  const read=await (await request(recipient,`/chats/${chatId}/read`,"POST",{shareReceipts:true})).json() as any;
  assert.ok(Number.isSafeInteger(read.readThrough));
  const visible=await (await request(sender,`/chats/${chatId}/messages`)).json() as any;
  assert.deepEqual(visible.messages[0].readBy,[],"global read privacy overrides the client request");
  await request(recipient,`/chats/${chatId}/state`,"PUT",{state:{markedUnread:true}});
  const own=await (await request(recipient,"/chats")).json() as any;
  const peer=await (await request(sender,"/chats")).json() as any;
  assert.equal(own.chats[0].state.markedUnread,true);
  assert.equal(own.chats[0].state.readThrough,read.readThrough);
  assert.equal(peer.chats[0].state.markedUnread,undefined,"unread marker is not shared");
  await request(recipient,`/chats/${chatId}/read`,"POST",{shareReceipts:false});
  assert.equal((await (await request(recipient,"/chats")).json() as any).chats[0].state.markedUnread,false);
  await assert.rejects(request(recipient,`/chats/${chatId}/messages/${messageId}`,"DELETE"),/Only your messages/);
  assert.equal((await request(sender,`/chats/${chatId}/messages/${messageId}`,"DELETE")).status,204);
  assert.deepEqual((await (await request(recipient,`/chats/${chatId}/messages`)).json() as any).messages,[]);
});

test("profile totals come from all visible Cloudflare records, not a loaded page",async t=>{
  const f=fixture(t),owner=f.user("stats_owner"),viewer=f.user("stats_viewer"),peer=f.user("stats_peer");
  f.sqlite.prepare("UPDATE users SET followers_visible=1 WHERE id=?").run(owner);
  for(const [from,to] of [[viewer,owner],[peer,owner],[owner,peer]]){
    f.sqlite.prepare("INSERT INTO user_follows(follower_id,followed_id,created_at) VALUES(?,?,?)").run(from,to,Date.now());
  }
  const post=await f.post(owner,"A genuine qualifying view");
  for(let index=0;index<51;index++){
    f.sqlite.prepare("INSERT INTO posts(id,author_id,text,visibility,destination,created_at) VALUES(?,?,?,'public','main',?)")
      .run(randomUUID(),owner,`Additional post ${index}`,Date.now()+index);
  }
  const start=await analyticsRequest(new Request("https://oldtime.test/api/analytics/sessions",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ownerId:owner,sourceId:post.id,nonce:randomUUID(),source:"profile"}),
  }),f.db,viewer,"/analytics/sessions");
  assert.equal(start.status,200);
  const session=await start.json() as {id:string};
  // Advance only the isolated fixture's session clock. The live endpoint must
  // continue rejecting a claimed three-second view sent immediately.
  f.sqlite.prepare("UPDATE analytics_sessions SET started_at=started_at-5000 WHERE id=?").run(session.id);
  const update=await analyticsRequest(new Request(`https://oldtime.test/api/analytics/sessions/${session.id}`,{
    method:"PUT",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({visibleMs:3000,watchedMs:0,progress:0,ended:true}),
  }),f.db,viewer,`/analytics/sessions/${session.id}`);
  assert.equal(update.status,200);
  const response=await socialRequest(new Request("https://oldtime.test/api/profiles/stats_owner"),f.db,viewer,"/profiles/stats_owner");
  const result=await response.json() as any;
  assert.equal(result.posts.length,50);
  assert.equal(result.postCount,52);
  const {followerPreviews,followingPreviews,...totals}=result.stats;
  assert.deepEqual(totals,{followerCount:2,followingCount:1,viewCount:1});
  assert.deepEqual(new Set(followerPreviews.map((p:any)=>p.username)),new Set(["stats_peer","stats_viewer"]));
  assert.deepEqual(followingPreviews.map((p:any)=>p.username),["stats_peer"]);
  const detail=await socialRequest(new Request(`https://oldtime.test/api/posts/${post.id}`),f.db,viewer,`/posts/${post.id}`);
  assert.equal((await detail.json() as any).post.measuredViews,1);
});

test("an account without posts still has its confirmed follower totals",async t=>{
  const f=fixture(t),owner=f.user("empty_stats"),viewer=f.user("empty_viewer");
  f.sqlite.prepare("UPDATE users SET followers_visible=1 WHERE id=?").run(owner);
  f.sqlite.prepare("INSERT INTO user_follows(follower_id,followed_id,created_at) VALUES(?,?,?)").run(viewer,owner,Date.now());
  const response=await socialRequest(new Request("https://oldtime.test/api/profiles/empty_stats"),f.db,viewer,"/profiles/empty_stats");
  const result=await response.json() as any;
  const {followerPreviews,followingPreviews,...totals}=result.stats;
  assert.deepEqual(totals,{followerCount:1,followingCount:0,viewCount:0});
  assert.deepEqual(followerPreviews.map((p:any)=>p.id),[viewer]);assert.deepEqual(followingPreviews,[]);
  assert.equal(result.postCount,0);
});

test("deterministic engine uses metadata, multi-topics, boundaries and real multi-creator clusters",()=>{
  const doc=makeDiscoveryDocument({text:"Funny first date at a Lamborghini car meet in Miami"});
  const ids=doc.topics.map(t=>t.id);
  assert.ok(ids.includes("cars")&&ids.includes("dating-humor"));
  assert.equal(classifyDiscovery({text:"Educate the audience about concatenation"}).some(t=>t.id==="pets"),false);
  assert.deepEqual(classifyDiscovery({text:"funny",tags:Array(100).fill("funny")}),classifyDiscovery({text:"funny"}));
  assert.equal(classifyDiscovery({text:"A funny first date"},["dating-humor"]).some(t=>t.id==="dating-humor"),false);
  const corpus=[{id:"1",authorId:"a",text:"Miami nightlife restaurants"},{id:"2",authorId:"b",text:"Miami nightlife dinner"},{id:"3",authorId:"a",text:"Miami nightlife outfits"}];
  assert.ok(emergingDiscoveryTopics(corpus).some(t=>t.label==="miami nightlife"&&t.postCount===3&&t.creatorCount===2));
  assert.deepEqual(emergingDiscoveryTopics(corpus.map(p=>({...p,authorId:"spam"}))),[]);
  assert.equal(discoveryFtsQuery('humor" OR private*'),'"humor"* AND "private"*');
  const ranked=rankDiscovery([
    {id:"new",authorId:"a",text:"Miami cars",createdAt:1000},
    {id:"spam",authorId:"a",text:"Mixture",createdAt:1000,likes:100000000},
    {id:"other",authorId:"b",text:"Miami cars",createdAt:1000},
  ],{query:"Miami cars",now:1000});
  assert.equal(ranked[0].id,"new");
  assert.equal(ranked[1].id,"other");
});

test("indexed unified search discovers related topics, partial profiles, places, hashtags and spelling",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),alice=f.user("miamicreator"),bob=f.user("secondcreator");
  const place={id:"custom:miami",source:"custom",label:"Miami"};
  const car=await f.post(alice,"Lamborghini car meet and supercar photography #Nightlife",{place});
  await f.post(bob,"Funny first date in Miami #Miami");
  await f.post(alice,"Miami nightlife dinner");
  await f.post(bob,"Miami nightlife outfits");
  await f.post(alice,"Miami nightlife restaurant recommendations");
  const cars=await f.search(viewer,"q=cars");
  assert.ok(cars.posts.some((p:any)=>p.id===car.id),"semantic category index retrieves Lamborghini without word cars");
  assert.ok(cars.topics.some((p:any)=>p.id==="cars"));
  assert.ok(cars.people.some((p:any)=>p.id===alice));
  assert.equal(cars.places[0].place.label,"Miami");
  assert.ok(cars.hashtags.some((p:any)=>p.tag==="nightlife"));
  const dating=await f.search(viewer,"topic=dating-humor");
  assert.equal(dating.posts.length,1);
  const partial=await f.search(viewer,"q=miamicr&type=people");
  assert.ok(partial.people.some((p:any)=>p.id===alice));
  const corrected=await f.search(viewer,"q=lamborgini");
  assert.equal(corrected.correctedQuery,"lamborghini");
  assert.ok(corrected.posts.some((p:any)=>p.id===car.id));
  const all=await f.search(viewer);
  assert.ok(all.emergingTopics.some((p:any)=>p.label==="miami nightlife"));
  assert.equal((await f.search(viewer,"q=unmatchedvocabulary")).posts.length,0);
});

test("search enforces privacy and blocks, and edits/deletes keep the FTS index synchronized",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),alice=f.user("alice"),privateId=f.user("privatecreator",1),blocked=f.user("blockedcreator");
  const good=await f.post(alice,"Public Zephyr trails");
  await f.post(privateId,"Privateword Zephyr");
  await f.post(blocked,"Blockedword Zephyr");
  f.sqlite.prepare("INSERT INTO account_blocks(owner_id,blocked_id,created_at) VALUES(?,?,?)").run(viewer,blocked,Date.now());
  f.sqlite.prepare("INSERT INTO posts(id,author_id,text,visibility,destination,created_at) VALUES(?,?,?,'close-friends','both',?)")
    .run(randomUUID(),alice,"Secretword Zephyr",Date.now());
  const result=await f.search(viewer,"q=Zephyr");
  assert.deepEqual(result.posts.map((p:any)=>p.id),[good.id]);
  assert.ok(!result.people.some((p:any)=>[privateId,blocked].includes(p.id)));
  for(const word of ["Privateword","Blockedword","Secretword"]){
    const hidden=await f.search(viewer,`q=${word}`);
    assert.equal(hidden.posts.length,0);assert.equal(hidden.correctedQuery,null);
    assert.deepEqual(hidden.relatedSearches,[]);
  }
  await socialRequest(new Request(`https://oldtime.test/api/posts/${good.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:"Orchid recipe dinner"})}),f.db,alice,`/posts/${good.id}`,safeReviewAi,reviewMediaBucket);
  assert.equal((await f.search(viewer,"q=Zephyr")).posts.length,0);
  assert.equal((await f.search(viewer,"topic=food")).posts[0].id,good.id);
  await socialRequest(new Request(`https://oldtime.test/api/posts/${good.id}`,{method:"DELETE"}),f.db,alice,`/posts/${good.id}`);
  assert.equal((await f.search(viewer,"q=Orchid")).posts.length,0);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM discovery_documents WHERE post_id=?").get(good.id)!.n,0);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM discovery_fts WHERE discovery_fts MATCH 'Orchid'").get()!.n,0);
});

test("preferences and creator corrections are account-scoped, with bounded non-repeating pagination",async t=>{
  const f=fixture(t),alice=f.user("alice"),bob=f.user("bob");
  const first=await f.post(alice,"A funny first date");
  const path=`/discovery/posts/${first.id}/topics`;
  await assert.rejects(f.put(bob,path,{excludedTopics:["humor"]}),{status:403});
  await f.put(alice,path,{excludedTopics:["humor","dating-humor"]});
  assert.equal((await f.search(bob,"topic=humor")).posts.length,0);
  assert.equal((await f.search(bob,"topic=dating")).posts.length,1);
  const correction=await f.search(alice,"topic=dating");
  assert.deepEqual(correction.postTopics[0].excludedTopics,["humor","dating-humor"]);
  await f.put(bob,"/discovery/preferences",{hiddenTopics:["dating"],personalize:false});
  assert.equal((await f.search(bob)).posts.length,0);
  assert.equal((await f.search(alice)).posts.length,1);
  await f.put(bob,"/discovery/preferences",{hiddenTopics:[],personalize:true});
  for(let i=0;i<27;i++)await f.post(i%2?alice:bob,`Recipe number ${i} for dinner`);
  const page1=await f.search(bob,"limit=24"),page2=await f.search(bob,`limit=24&offset=${page1.nextOffset}`);
  assert.ok(page1.hasMore);
  assert.equal(new Set([...page1.posts,...page2.posts].map((p:any)=>p.id)).size,28);
  assert.equal(page2.hasMore,false);
  const text=await f.search(bob,"type=posts");
  assert.ok(text.posts.length>0&&text.posts.every((p:any)=>p.media.length===0));
  assert.equal((await f.search(bob,"type=videos")).posts.length,0);
  assert.equal((await f.search(bob,"type=photos")).posts.length,0);
  const videoId=randomUUID(),photoId=randomUUID(),videoPost=page1.posts[0].id,photoPost=page1.posts[1].id;
  for(const [mediaId,contentType,postId] of [[videoId,"video/mp4",videoPost],[photoId,"image/jpeg",photoPost]]){
    f.sqlite.prepare(`INSERT INTO user_media_assets(id,user_id,object_key,content_type,size,sha256,ready)
      VALUES(?,?,?,?,?,?,1)`).run(mediaId,bob,`test/${mediaId}`,contentType,10,"test-digest");
    f.sqlite.prepare("INSERT INTO post_media_assets(post_id,media_id,position) VALUES(?,?,0)").run(postId,mediaId);
  }
  assert.deepEqual((await f.search(bob,"type=videos")).posts.map((p:any)=>p.id),[videoPost]);
  assert.deepEqual((await f.search(bob,"type=photos")).posts.map((p:any)=>p.id),[photoPost]);
  assert.ok((await f.search(bob,"type=posts")).posts.every((p:any)=>![videoPost,photoPost].includes(p.id)));
  assert.ok((await f.search(bob,"type=community")).posts.every((p:any)=>["community","both"].includes(p.destination)));
  f.sqlite.prepare("UPDATE posts SET destination='community' WHERE id=?").run(videoPost);
  f.sqlite.prepare("UPDATE posts SET destination='both' WHERE id=?").run(photoPost);
  for(const results of [
    await f.search(bob),
    await f.search(bob,"type=videos"),
    await f.search(bob,"type=photos"),
    await f.search(bob,"type=community"),
  ]) assert.ok(results.posts.every((p:any)=>p.id!==videoPost&&p.id!==photoPost));
  await assert.rejects(f.search(bob,"limit=5000"),{status:400});
  await assert.rejects(f.put(bob,"/discovery/preferences",{hiddenTopics:["invented-topic"],personalize:true}),{status:400});
});

test("video Explore sorts by selected interests, recency, engagement and a stable fresh shuffle",async t=>{
  const f=fixture(t),viewer=f.user("video-hub-viewer"),creator=f.user("video-hub-creator");
  const addVideo=(userId:string)=>{
    const id=randomUUID();
    f.sqlite.prepare(`INSERT INTO user_media_assets(id,user_id,object_key,content_type,size,sha256,ready)
      VALUES(?,?,?,?,?,?,1)`).run(id,userId,`test/${id}`,"video/mp4",1024,"test-digest");
    return id;
  };
  f.sqlite.prepare("INSERT INTO account_state(user_id,data,updated_at) VALUES(?,?,?)")
    .run(viewer,JSON.stringify({interestPreferences:{enabled:true,selected:["Sports"]}}),Date.now());
  const videos=[];
  for(let i=0;i<8;i++){
    const caption=i===0?"Basketball practice highlights":i===1?"A quiet cooking video":`Everyday video ${i}`;
    videos.push(await f.post(creator,caption,{mediaIds:[addVideo(creator)]}));
  }
  videos.forEach((post:any,index:number)=>{
    f.sqlite.prepare("UPDATE posts SET created_at=? WHERE id=?").run(100_000+index,post.id);
  });
  const [popular,plain]=videos.slice(1,3);
  const reposterA=f.user("video-hub-reposter-a"),reposterB=f.user("video-hub-reposter-b"),reposterC=f.user("video-hub-reposter-c");
  f.sqlite.prepare("INSERT INTO post_reposts(post_id,user_id,updated_at) VALUES(?,?,?)").run(popular.id,reposterA,Date.now());
  f.sqlite.prepare("INSERT INTO post_reposts(post_id,user_id,updated_at) VALUES(?,?,?)").run(popular.id,reposterB,Date.now());
  f.sqlite.prepare("INSERT INTO post_reposts(post_id,user_id,updated_at) VALUES(?,?,?)").run(popular.id,reposterC,Date.now());
  f.sqlite.prepare("INSERT INTO post_likes(post_id,user_id) VALUES(?,?)").run(popular.id,reposterA);
  f.sqlite.prepare("INSERT INTO post_likes(post_id,user_id) VALUES(?,?)").run(plain.id,reposterB);

  const forYou=await f.search(viewer,"type=videos&sort=top&limit=20");
  assert.equal(forYou.posts.length,8);
  assert.equal(forYou.posts[0].id,videos[0].id,"For You promotes videos matching the viewer's selected Sports interest");
  const newest=await f.search(viewer,"type=videos&sort=recent&limit=20");
  assert.equal(newest.posts[0].id,videos.at(-1).id,"Newest orders videos by creation time");
  const mostInteracted=await f.search(viewer,"type=videos&sort=engagement&limit=20");
  assert.equal(mostInteracted.posts[0].id,popular.id,"Most interacted uses likes and reposts");

  const shuffled=await f.search(viewer,"type=videos&sort=shuffle&shuffleSeed=seed-one&limit=20");
  const repeated=await f.search(viewer,"type=videos&sort=shuffle&shuffleSeed=seed-one&limit=20");
  const reshuffled=await f.search(viewer,"type=videos&sort=shuffle&shuffleSeed=seed-two&limit=20");
  assert.deepEqual(shuffled.posts.map((post:any)=>post.id),repeated.posts.map((post:any)=>post.id),
    "a shuffle seed keeps pagination and retries stable");
  assert.notDeepEqual(shuffled.posts.map((post:any)=>post.id),reshuffled.posts.map((post:any)=>post.id),
    "a fresh seed generates a different shuffle");
  await assert.rejects(f.search(viewer,"type=videos&sort=shuffle&shuffleSeed=bad_seed"),{status:400});
});

test("source audio suggestions use original posts, private saves, and account-level consent",async t=>{
  const f=fixture(t),owner=f.user("sound-owner"),viewer=f.user("sound-viewer");
  const addVideo=(userId:string)=>{
    const id=randomUUID();
    f.sqlite.prepare(`INSERT INTO user_media_assets(id,user_id,object_key,content_type,size,sha256,ready)
      VALUES(?,?,?,?,?,?,1)`).run(id,userId,`test/${id}`,"video/mp4",1024,"test-digest");
    return id;
  };
  const addPhoto=(userId:string)=>{
    const id=randomUUID();
    f.sqlite.prepare(`INSERT INTO user_media_assets(id,user_id,object_key,content_type,size,sha256,ready)
      VALUES(?,?,?,?,?,?,1)`).run(id,userId,`test/${id}`,"image/webp",1024,"test-digest");
    return id;
  };
  const create=(userId:string,value:Record<string,unknown>)=>socialRequest(new Request("https://oldtime.test/api/posts",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value),
  }),f.db,userId,"/posts",safeReviewAi,reviewMediaBucket);
  const sounds=(userId:string)=>soundRequest(new Request("https://oldtime.test/api/sounds/discovery"),f.db,userId,"/sounds/discovery");
  const savedSounds=(userId:string)=>soundRequest(new Request("https://oldtime.test/api/sounds/library"),f.db,userId,"/sounds/library");
  const setReusePreference=(enabled:boolean)=>f.sqlite.prepare(`INSERT INTO account_state(user_id,data,updated_at)
    VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at`)
    .run(owner,JSON.stringify({soundReuseEnabled:enabled}),Date.now());

  await assert.rejects(
    create(owner,{text:"Original video",mediaIds:[addVideo(owner)],audioReuseAllowed:true}),
    {status:400},
  );

  const source=await f.post(owner,"Original sound clip",{
    mediaIds:[addVideo(owner)],audioReuseAllowed:true,audioRightsConfirmed:true,
  });
  assert.equal(source.audioReuseAllowed,true);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS count FROM sound_library").get().count,0,
    "the app must not create a platform-owned sound or audio copy");
  const used=await create(viewer,{
    text:"A video using the sound",mediaIds:[addVideo(viewer)],
    audioSourcePostId:source.id,
  });
  assert.equal(used.status,201);
  const usedPost=(await used.json() as any).post;
  assert.equal(usedPost.audioSound,null);
  assert.equal(usedPost.audioSourcePostId,source.id);
  assert.equal(usedPost.audioReuseAllowed,true);
  assert.equal(usedPost.audioUseCount,1);

  const secondUse=await create(viewer,{
    text:"Second reuse",mediaIds:[addVideo(viewer)],audioSourcePostId:source.id,
  });
  assert.equal(secondUse.status,201);
  const secondPost=(await secondUse.json() as any).post;
  assert.equal(secondPost.audioUseCount,2);
  const photoUse=await create(viewer,{
    text:"Photo with an optional source sound",mediaIds:[addPhoto(viewer)],audioSourcePostId:source.id,
  });
  assert.equal(photoUse.status,201,"sound is optional, and a selected sound does not require video output");
  const photoPost=(await photoUse.json() as any).post;
  assert.equal(photoPost.audioSourcePostId,source.id,"the optional sound stays attributed to its source post");
  const photoRecord=f.sqlite.prepare(`SELECT m.content_type FROM post_media_assets pm
    JOIN user_media_assets m ON m.id=pm.media_id WHERE pm.post_id=?`).get(photoPost.id) as {content_type:string};
  assert.equal(photoRecord.content_type,"image/webp","a still image remains image media");
  assert.equal(f.sqlite.prepare("SELECT count(*) AS count FROM post_media_assets WHERE post_id=?").get(photoPost.id).count,1,
    "the photo post keeps one image attachment instead of a video or copied audio");
  const photoWithoutSound=await create(viewer,{text:"Photo without a sound",mediaIds:[addPhoto(viewer)]});
  assert.equal(photoWithoutSound.status,201,"a photo can be published without any sound attached");
  const noSoundPost=(await photoWithoutSound.json() as any).post;
  const noSoundType=f.sqlite.prepare(`SELECT m.content_type FROM post_media_assets pm
    JOIN user_media_assets m ON m.id=pm.media_id WHERE pm.post_id=?`).get(noSoundPost.id) as {content_type:string};
  assert.equal(noSoundType.content_type,"image/webp","a photo without a sound remains image media");
  for(const username of ["sound-viewer-two","sound-viewer-three"]){
    const other=f.user(username);
    const reused=await create(other,{
      text:"Another account reuses the sound",mediaIds:[addVideo(other)],audioSourcePostId:source.id,
    });
    assert.equal(reused.status,201);
  }
  const discovery=await sounds(viewer);
  const discovered=(await discovery.json() as any).sounds.find((sound:any)=>sound.id===source.id);
  assert.equal(discovered.useCount,5);
  assert.equal(discovered.sourcePostId,source.id);
  assert.equal(discovered.trending,true,"recent reuse by three distinct accounts makes a sound trending");

  const save=await soundRequest(new Request(`https://oldtime.test/api/sounds/${source.id}/save`,{method:"PUT"}),f.db,viewer,`/sounds/${source.id}/save`);
  assert.equal((await save.json() as any).saved,true);
  const viewerSaved=(await (await savedSounds(viewer)).json() as any).sounds;
  assert.ok(viewerSaved.some((sound:any)=>sound.sourcePostId===source.id&&sound.saved),
    "a saved sound is visible in the saver’s private list");
  const otherSaved=(await (await savedSounds(f.user("sound-private-list-checker"))).json() as any).sounds;
  assert.ok(!otherSaved.some((sound:any)=>sound.sourcePostId===source.id),
    "another account cannot see the saver’s sound list");
  const otherDiscovery=await sounds(f.user("sound-private-discovery-checker"));
  assert.equal((await otherDiscovery.json() as any).sounds.find((sound:any)=>sound.id===source.id).saved,false,
    "private save state is not exposed to other accounts");

  setReusePreference(false);
  const optedOutPost=await create(owner,{
    text:"Audio reuse is off",mediaIds:[addVideo(owner)],audioReuseAllowed:true,audioRightsConfirmed:true,
  });
  assert.equal(optedOutPost.status,201);
  assert.equal((await optedOutPost.json() as any).post.audioReuseAllowed,false,
    "the account setting overrides a post-level reuse request");
  const hiddenByPreference=await sounds(viewer);
  assert.ok(!(await hiddenByPreference.json() as any).sounds.some((sound:any)=>sound.id===source.id),
    "turning reuse off removes suggestions without deleting private saves");
  await assert.rejects(create(viewer,{
    text:"reuse after opt out",mediaIds:[addVideo(viewer)],audioSourcePostId:source.id,
  }),{status:403});
  assert.ok((await (await savedSounds(viewer)).json() as any).sounds.some((sound:any)=>sound.sourcePostId===source.id),
    "the owner’s opt-out does not erase another person’s private save");
  setReusePreference(true);
  const restoredByPreference=await sounds(viewer);
  assert.ok((await restoredByPreference.json() as any).sounds.some((sound:any)=>sound.id===source.id),
    "turning reuse back on restores source-post suggestions");

  const nonOwnerArchive= socialRequest(new Request(`https://oldtime.test/api/posts/${source.id}/archive`,{method:"PUT"}),f.db,viewer,`/posts/${source.id}/archive`);
  await assert.rejects(nonOwnerArchive,{status:403},"only the original author can archive a post");
  const archived=await socialRequest(new Request(`https://oldtime.test/api/posts/${source.id}/archive`,{method:"PUT"}),f.db,owner,`/posts/${source.id}/archive`);
  assert.equal(archived.status,200);
  const hiddenPost=socialRequest(new Request(`https://oldtime.test/api/posts/${source.id}`),f.db,viewer,`/posts/${source.id}`);
  await assert.rejects(hiddenPost,{status:404},"archived posts are hidden from other accounts");
  const archiveList=await socialRequest(new Request("https://oldtime.test/api/posts/archived?limit=20&offset=0"),f.db,owner,"/posts/archived");
  const archivePayload=await archiveList.json() as any;
  assert.ok(archivePayload.posts.some((post:any)=>post.id===source.id&&Number.isSafeInteger(post.archivedAt)),
    "the owner can find their archived post with its timestamp");
  assert.ok((await (await savedSounds(viewer)).json() as any).sounds.some((sound:any)=>sound.sourcePostId===source.id),
    "the private saved reference remains available in the owner’s saved list when the source post is archived");
  const archivedDiscovery=await sounds(viewer);
  assert.ok(!(await archivedDiscovery.json() as any).sounds.some((sound:any)=>sound.id===source.id),
    "archived posts no longer appear in public sound suggestions");
  const restored=await socialRequest(new Request(`https://oldtime.test/api/posts/${source.id}/archive`,{method:"DELETE"}),f.db,owner,`/posts/${source.id}/archive`);
  assert.equal(restored.status,200,"the owner can restore an archived post");
  const restoredPost=await socialRequest(new Request(`https://oldtime.test/api/posts/${source.id}`),f.db,viewer,`/posts/${source.id}`);
  assert.equal(restoredPost.status,200,"restored public posts return to normal visibility");

  const unapproved=await f.post(owner,"Audio not cleared",{mediaIds:[addVideo(owner)]});
  await assert.rejects(
    create(viewer,{text:"Attempted use",mediaIds:[addVideo(viewer)],audioSourcePostId:unapproved.id}),
    {status:403},
  );

  const privateOwner=f.user("private-sound-owner",1);
  await assert.rejects(create(privateOwner,{
    text:"Private original",mediaIds:[addVideo(privateOwner)],audioReuseAllowed:true,audioRightsConfirmed:true,
  }),{status:400});
});

test("archived sound audio and creator credit survive creator account removal",async t=>{
  const f=fixture(t),oldtime=f.user("oldtime"),owner=f.user("retiring-sound-owner"),viewer=f.user("sound-archiver");
  const videoId=randomUUID(),audioId=randomUUID(),sourceId=randomUUID(),soundId=randomUUID();
  f.sqlite.prepare(`INSERT INTO user_media_assets(id,user_id,object_key,content_type,size,sha256,ready)
    VALUES(?,?,?,?,?,?,1)`).run(videoId,owner,`test/${videoId}`,"video/mp4",1024,"video-digest");
  f.sqlite.prepare(`INSERT INTO user_media_assets(id,user_id,object_key,content_type,size,sha256,ready)
    VALUES(?,?,?,?,?,?,1)`).run(audioId,owner,`test/${audioId}`,"audio/webm",512,"audio-digest");
  f.sqlite.prepare(`INSERT INTO posts(id,author_id,text,visibility,created_at,text_fingerprint,meaningful,audio_reuse_allowed,audio_rights_confirmed_at)
    VALUES(?,?,?,'public',?,'test',1,1,?)`).run(sourceId,owner,"Original",Date.now(),Date.now());
  f.sqlite.prepare("INSERT INTO post_media_assets(post_id,media_id,position) VALUES(?,?,0)").run(sourceId,videoId);
  f.sqlite.prepare(`INSERT INTO sound_library
    (id,owner_id,creator_id,creator_username,creator_display_name,media_id,source_post_id,title,rights_confirmed_at,reuse_allowed,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,1,?)`)
    .run(soundId,owner,owner,"retiring-sound-owner","Original Creator",audioId,sourceId,"Funny sound",Date.now(),Date.now());
  f.sqlite.prepare("INSERT INTO media_references(user_id,target_type,target_id,media_id) VALUES(?,'sound',?,?)")
    .run(owner,soundId,audioId);
  f.sqlite.prepare("DELETE FROM posts WHERE id=?").run(sourceId);
  f.sqlite.prepare("DELETE FROM users WHERE id=?").run(owner);
  const sound=f.sqlite.prepare("SELECT owner_id,creator_username,creator_display_name,source_post_id FROM sound_library WHERE id=?").get(soundId);
  assert.equal(sound.owner_id,null);
  assert.equal(sound.creator_username,"retiring-sound-owner");
  assert.equal(sound.creator_display_name,"Original Creator");
  assert.equal(sound.source_post_id,null);
  assert.equal(f.sqlite.prepare("SELECT user_id FROM user_media_assets WHERE id=?").get(audioId).user_id,oldtime);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS count FROM media_references WHERE target_type='sound' AND target_id=?").get(soundId).count,1);
  const retained=f.sqlite.prepare("SELECT * FROM user_media_assets WHERE id=?").get(audioId) as any;
  assert.equal(await canReadMedia(f.db,viewer,retained),true,"authorized public sound audio remains readable after account removal");
  assert.equal(f.sqlite.prepare("SELECT count(*) AS count FROM users WHERE id=?").get(viewer).count,1);
});
