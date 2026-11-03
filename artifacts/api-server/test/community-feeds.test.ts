import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readdirSync,readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { communityFeedRequest } from "../src/cloudflare/community-feeds";
import { socialRequest } from "../src/cloudflare/social";
import { accountDataRequest } from "../src/cloudflare/account-data";
import { signupPreferences, initialSignupState, officialSignupFollow } from "../src/cloudflare/signup-preferences";
import { ApiError,type Database,type Statement } from "../src/cloudflare/runtime";
import { reviewMediaBucket, safeReviewAi } from "./content-moderation-fixtures";

function fixture(t:{after:(fn:()=>void)=>void}) {
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
  const directory=new URL("../migrations/",import.meta.url);
  for(const file of readdirSync(directory).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(new URL(file,directory),"utf8"));
  t.after(()=>sqlite.close());
  function prepare(sql:string):Statement {
    let values:unknown[]=[];
    return {
      bind(...input:unknown[]){values=input;return this;},
      async all<T>(){return {success:true,results:sqlite.prepare(sql).all(...values as any[]) as T[]};},
      async first<T>(){return (sqlite.prepare(sql).get(...values as any[])??null) as T|null;},
      async run(){const result=sqlite.prepare(sql).run(...values as any[]);return {success:true,meta:{changes:Number(result.changes)}};},
    };
  }
  const db:Database={prepare,async batch(statements){
    sqlite.exec("BEGIN");try{const result=await Promise.all(statements.map(s=>s.run()));sqlite.exec("COMMIT");return result;}
    catch(error){sqlite.exec("ROLLBACK");throw error;}
  }};
  function user(name:string,privateAccount=0){
    const id=randomUUID();sqlite.prepare(`INSERT INTO users(id,email,username,display_name,password_salt,password_hash,created_at,is_private)
      VALUES(?,?,?,?,?,?,?,?)`).run(id,`${name}@example.test`,name,name,"salt","hash",Date.now(),privateAccount);return id;
  }
  async function call(userId:string,path:string,method="GET",input?:unknown):Promise<any> {
    const request=new Request(`https://oldtime.test/api${path}`,{method,headers:{"Content-Type":"application/json"},...(input===undefined?{}:{body:JSON.stringify(input)})});
    const result=await communityFeedRequest(request,db,userId,new URL(request.url).pathname.replace(/^\/api/,""));
    return result.status===204?null:result.json();
  }
  let timestamp=Date.now()-100000;
  async function post(author:string,text:string,extra:Record<string,unknown>={}){
    const response=await socialRequest(new Request("https://oldtime.test/api/posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,destination:"community",...extra})}),db,author,"/posts",safeReviewAi,reviewMediaBucket);
    assert.equal(response.status,201);const {post}=await response.json() as any;
    sqlite.prepare("UPDATE posts SET created_at=? WHERE id=?").run(timestamp+=1000,post.id);return post;
  }
  const follow=(a:string,b:string)=>sqlite.prepare("INSERT INTO user_follows(follower_id,followed_id,created_at) VALUES(?,?,?)").run(a,b,Date.now());
  const prefs={pinned:["following","discover","popular","friends","media"],filters:{},mutedWords:[],mutedAccounts:[]};
  return {sqlite,db,user,call,post,follow,prefs};
}
const rejected=(status:number)=>(error:unknown)=>error instanceof ApiError&&error.status===status;

test("Community preference reads never create data; saved controls and caught-up markers survive reload",async t=>{
  const f=fixture(t),viewer=f.user("preferences");
  assert.deepEqual((await f.call(viewer,"/community/preferences")).preferences.pinned,["following","discover","popular","friends"]);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM community_feed_preferences").get()?.n,0);
  await f.call(viewer,"/community/preferences","PUT",{...f.prefs,pinned:["popular","following"],filters:{following:{hideReposts:true}}});
  const marker=await f.call(viewer,"/community/catch-up","POST",{feed:"following"});
  await f.call(viewer,"/community/preferences","PUT",{...f.prefs,pinned:["following","popular"],mutedWords:["spoiler"]});
  const saved=(await f.call(viewer,"/community/preferences")).preferences;
  assert.equal(saved.caughtUp.following,marker.caughtUpAt);
  assert.deepEqual(saved.mutedWords,["spoiler"]);
  assert.deepEqual(saved.pinned,["following","popular"]);
  await assert.rejects(f.call(viewer,"/community/preferences","PUT",{...f.prefs,pinned:[]}),rejected(400));
});

test("Following is chronological with no suggestions; Discover excludes followed accounts; Friends uses real relationships",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),followed=f.user("followed"),stranger=f.user("stranger"),friend=f.user("friend");
  f.follow(viewer,followed);
  f.sqlite.prepare("INSERT INTO friendships(member_low_id,member_high_id,created_at) VALUES(?,?,?)")
    .run(...[viewer,friend].sort(),Date.now());
  const a=await f.post(followed,"old"),b=await f.post(stranger,"recommended"),c=await f.post(friend,"friend");
  const d=await f.post(followed,"new");await f.post(followed,"main only",{destination:"main"});
  assert.deepEqual((await f.call(viewer,"/community/feed?feed=following")).posts.map((p:any)=>p.id),[d.id,a.id]);
  assert.deepEqual(new Set((await f.call(viewer,"/community/feed?feed=discover")).posts.map((p:any)=>p.id)),new Set([b.id,c.id]));
  assert.deepEqual((await f.call(viewer,"/community/feed?feed=friends")).posts,[]);
  f.follow(followed,viewer);
  assert.deepEqual((await f.call(viewer,"/community/feed?feed=friends")).posts.map((p:any)=>p.id),[d.id,a.id]);
});

test("Blocking, visibility, account mutes and phrase filters apply before paging",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),kept=f.user("kept"),muted=f.user("muted"),blocked=f.user("blocked"),privateUser=f.user("private",1);
  const keep=await f.post(kept,"keep this");
  await f.post(kept,"a spoiler phrase");await f.post(muted,"muted content");await f.post(blocked,"blocked content");await f.post(privateUser,"private content");
  f.sqlite.prepare("INSERT INTO account_blocks(owner_id,blocked_id,created_at) VALUES(?,?,?)").run(blocked,viewer,Date.now());
  await f.call(viewer,"/community/preferences","PUT",{...f.prefs,mutedWords:["SPOILER"],mutedAccounts:[muted]});
  const page=await f.call(viewer,"/community/feed?feed=discover&limit=1");
  assert.deepEqual(page.posts.map((p:any)=>p.id),[keep.id]);assert.equal(page.hasMore,false);assert.equal(page.nextOffset,1);
});

test("Repost inclusion can be turned off without hiding followed originals",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),followed=f.user("followed"),stranger=f.user("stranger");
  f.follow(viewer,followed);const own=await f.post(followed,"followed original"),shared=await f.post(stranger,"reposted original");
  f.sqlite.prepare("INSERT INTO post_reposts(post_id,user_id,updated_at) VALUES(?,?,?)").run(shared.id,followed,Date.now());
  assert.deepEqual((await f.call(viewer,"/community/feed?feed=following")).posts.map((p:any)=>p.id),[shared.id,own.id]);
  await f.call(viewer,"/community/preferences","PUT",{...f.prefs,filters:{following:{hideReposts:true}}});
  assert.deepEqual((await f.call(viewer,"/community/feed?feed=following")).posts.map((p:any)=>p.id),[own.id]);
  await f.call(viewer,"/community/preferences","PUT",{...f.prefs,mutedAccounts:[followed]});
  assert.deepEqual((await f.call(viewer,"/community/feed?feed=following")).posts,[]);
});

test("Popular ranks genuine engagement within the recent window and preserves deterministic paging",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),author=f.user("author");
  const liked=await f.post(author,"engaged"),newer=await f.post(author,"newer"),old=await f.post(author,"old");
  f.sqlite.prepare("UPDATE posts SET created_at=? WHERE id=?").run(Date.now()-8*86400000,old.id);
  f.sqlite.prepare("INSERT INTO post_likes(post_id,user_id,created_at) VALUES(?,?,?)").run(liked.id,viewer,Date.now());
  const first=await f.call(viewer,"/community/feed?feed=popular&limit=1");
  assert.equal(first.posts[0].id,liked.id);assert.equal(first.hasMore,true);
  assert.equal((await f.call(viewer,"/community/feed?feed=popular&limit=1&offset=1")).posts[0].id,newer.id);
});

test("Creator-declared language and reply/quote controls work without guessing or modifying posts",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),author=f.user("author");f.follow(viewer,author);
  const en=await f.post(author,"English"),fr=await f.post(author,"Français"),unknown=await f.post(author,"unlabelled"),quote=await f.post(author,"quote");
  await f.call(author,`/community/posts/${en.id}/language`,"PUT",{language:"en"});
  await f.call(author,`/community/posts/${fr.id}/language`,"PUT",{language:"fr"});
  f.sqlite.prepare("INSERT INTO community_post_labels(post_id,language,kind) VALUES(?,'en','quote')").run(quote.id);
  await assert.rejects(f.call(viewer,`/community/posts/${en.id}/language`,"PUT",{language:"es"}),rejected(404));
  await f.call(viewer,"/community/preferences","PUT",{...f.prefs,filters:{following:{language:"en",includeUnlabelled:false,hideQuotes:true}}});
  assert.deepEqual((await f.call(viewer,"/community/feed?feed=following")).posts.map((p:any)=>p.id),[en.id]);
  await f.call(viewer,"/community/preferences","PUT",{...f.prefs,filters:{following:{language:"en",includeUnlabelled:true,hideQuotes:true}}});
  assert.deepEqual((await f.call(viewer,"/community/feed?feed=following")).posts.map((p:any)=>p.id),[unknown.id,en.id]);
  assert.equal(f.sqlite.prepare("SELECT text FROM posts WHERE id=?").get(fr.id)?.text,"Français");
});

test("Private and public curated lists enforce ownership, follows and post privacy",async t=>{
  const f=fixture(t),owner=f.user("owner"),viewer=f.user("viewer"),member=f.user("member"),secret=f.user("secret",1);
  const visible=await f.post(member,"member post");await f.post(secret,"private post");
  const {list}=await f.call(owner,"/community/lists","POST",{name:"My list",description:"A curated feed",isPublic:false,members:[member,secret]});
  await assert.rejects(f.call(viewer,`/community/lists/${list.id}`),rejected(404));
  await assert.rejects(f.call(viewer,"/community/preferences","PUT",{...f.prefs,pinned:[`list:${list.id}`]}),rejected(404));
  await f.call(owner,`/community/lists/${list.id}`,"PUT",{name:"Public list",description:"A curated feed",isPublic:true,members:[member,secret]});
  await f.call(viewer,`/community/lists/${list.id}/follow`,"PUT");
  assert.equal((await f.call(viewer,"/community/lists")).lists[0].followed,true);
  await assert.rejects(f.call(viewer,`/community/lists/${list.id}`,"PUT",{name:"stolen",members:[]}),rejected(403));
  assert.deepEqual((await f.call(viewer,`/community/feed?feed=list:${list.id}`)).posts.map((p:any)=>p.id),[visible.id]);
  await f.call(owner,`/community/lists/${list.id}`,"DELETE");
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM posts").get()?.n,2);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM community_list_follows").get()?.n,0);
});

test("Profile Community tab only returns visible posts from the requested author, never main-only media",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),author=f.user("author"),stranger=f.user("stranger");
  const post=await f.post(author,"profile Community");await f.post(author,"main",{destination:"main"});await f.post(stranger,"other");
  assert.deepEqual((await f.call(viewer,`/community/profile/${author}?limit=1`)).posts.map((p:any)=>p.id),[post.id]);
  f.sqlite.prepare("INSERT INTO account_blocks(owner_id,blocked_id,created_at) VALUES(?,?,?)").run(author,viewer,Date.now());
  await assert.rejects(f.call(viewer,`/community/profile/${author}`),rejected(404));
});

test("Media feed includes only ready photos and videos, not text or audio posts",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),author=f.user("author"),photo=await f.post(author,"photo"),video=await f.post(author,"video"),audio=await f.post(author,"audio");
  await f.post(author,"text only");
  for(const [post,type] of [[photo,"image/jpeg"],[video,"video/mp4"],[audio,"audio/mpeg"]] as const){
    const id=randomUUID();
    f.sqlite.prepare("INSERT INTO user_media_assets(id,user_id,object_key,content_type,size,sha256,ready) VALUES(?,?,?,?,1,?,1)")
      .run(id,author,id,type,"a".repeat(64));
    f.sqlite.prepare("INSERT INTO post_media_assets(post_id,media_id,position) VALUES(?,?,0)").run(post.id,id);
  }
  assert.deepEqual((await f.call(viewer,"/community/feed?feed=media")).posts.map((p:any)=>p.id),[video.id,photo.id]);
});

test("Discover explains deterministic selected-interest ranking without changing Following order",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),author=f.user("author");
  f.sqlite.prepare("INSERT INTO account_state(user_id,data,updated_at) VALUES(?,?,?)")
    .run(viewer,JSON.stringify({profile:{interests:["Basketball"]}}),Date.now());
  const relevant=await f.post(author,"Basketball NBA game playoffs tonight");
  await f.post(author,"Fashion outfit makeup style");
  const page=await f.call(viewer,"/community/feed?feed=discover");
  assert.equal(page.posts[0].id,relevant.id);
  assert.match(page.reasons[relevant.id],/chosen interests/);
});

test("Message reports require conversation membership and preserve verified message references",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),sender=f.user("sender"),outsider=f.user("outsider"),chat=randomUUID(),message=randomUUID();
  f.sqlite.prepare("INSERT INTO chat_conversations(id,created_by) VALUES(?,?)").run(chat,sender);
  for(const id of [viewer,sender])f.sqlite.prepare("INSERT INTO chat_members(conversation_id,user_id) VALUES(?,?)").run(chat,id);
  f.sqlite.prepare("INSERT INTO chat_messages(id,conversation_id,author_id,body) VALUES(?,?,?,?)").run(message,chat,sender,"Example reported text");
  const send=(id:string)=>accountDataRequest(new Request("https://oldtime.test/api/account/reports",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({kind:"message",messageId:message,category:"Harassment",reason:"A test report about this particular message."}),
  }),f.db,id,"/account/reports");
  await assert.rejects(send(outsider),rejected(404));
  const response=await send(viewer);assert.equal(response.status,201);
  const report=f.sqlite.prepare("SELECT kind,target_user_id,reason FROM content_reports WHERE reporter_id=?").get(viewer);
  assert.equal(report?.kind,"message");assert.equal(report?.target_user_id,sender);assert.match(String(report?.reason),new RegExp(message));
});

test("Signup requires three distinct supported interests and keeps recommendation choices private",()=>{
  assert.throws(()=>signupPreferences({interests:["music","music","music"]}),rejected(400));
  assert.throws(()=>signupPreferences({interests:["music","art"]}),rejected(400));
  assert.deepEqual(signupPreferences({interests:["music","art","invented"]}).interests,["music","art","invented"]);
  const selected=signupPreferences({interests:["music","art","food","music"]});
  assert.deepEqual(selected.interests,["music","art","food"]);
  assert.equal(selected.followOldtime,false,"omitted consent never silently follows");
  assert.deepEqual(initialSignupState("2000-01-01",selected.interests),{
    profile:{birthday:"2000-01-01"},interestPreferences:{enabled:true,selected:["music","art","food"]},
  });
});

test("The visible signup opt-in follows only the existing official account and opt-out stays untouched",async t=>{
  const f=fixture(t),official=f.user("oldtime"),optedIn=f.user("opted_in"),optedOut=f.user("opted_out");
  const statement=await officialSignupFollow(f.db,optedIn,true,Date.now());
  assert.ok(statement);await statement.run();
  assert.equal(await officialSignupFollow(f.db,optedOut,false,Date.now()),null);
  assert.deepEqual(f.sqlite.prepare("SELECT follower_id,followed_id FROM user_follows").all().map(row=>({...row})),[{follower_id:optedIn,followed_id:official}]);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM users").get()?.n,3);
});

test("Signup never fabricates an official follow target if @oldtime is unavailable",async t=>{
  const f=fixture(t),id=f.user("new_member");
  await assert.rejects(officialSignupFollow(f.db,id,true,Date.now()),rejected(503));
  assert.equal(await officialSignupFollow(f.db,id,false,Date.now()),null);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM user_follows").get()?.n,0);
});

test("Discover adds creator variety without injecting recommendations into Following",async t=>{
  const f=fixture(t),viewer=f.user("viewer"),first=f.user("first"),second=f.user("second");
  for(let i=0;i<4;i++)await f.post(second,`public topic ${i}`);
  for(let i=0;i<4;i++)await f.post(first,`public topic ${i}`);
  const page=await f.call(viewer,"/community/feed?feed=discover&limit=4");
  const authors=page.posts.map((post:any)=>post.author.id);
  assert.equal(authors[0],first);assert.equal(authors[1],first);assert.equal(authors[2],second);
  assert.deepEqual((await f.call(viewer,"/community/feed?feed=following")).posts,[]);
});
