import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync,readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { socialRequest } from "../src/cloudflare/social";
import { discoveryRequest } from "../src/cloudflare/discovery";
import { refreshTopicRegistry,resolveRegisteredTopic } from "../src/cloudflare/topic-registry";
import { recordTopicSignal,learnedTopicInterests } from "../src/cloudflare/topic-signals";
import { mergeAutomaticTopic } from "../src/cloudflare/topic-surfaces";
import { relationshipRequest } from "../src/cloudflare/relationships";
import type {Database,Statement} from "../src/cloudflare/runtime";
import { reviewMediaBucket, safeReviewAi } from "./content-moderation-fixtures";
function fixture(t:{after:(cb:()=>void)=>void}){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
  const dir=new URL("../migrations/",import.meta.url);
  for(const file of readdirSync(dir).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(new URL(file,dir),"utf8"));
  t.after(()=>sqlite.close());
  function prepare(sql:string):Statement{
    let values:any[]=[];return {
      bind(...input:unknown[]){values=input;return this;},
      async all<T>(){return {success:true,results:sqlite.prepare(sql).all(...values) as T[]};},
      async first<T>(){return (sqlite.prepare(sql).get(...values)??null) as T|null;},
      async run<T>(){const result=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(result.changes)}};},
    };
  }
  const db:Database={prepare,async batch(statements){
    sqlite.exec("BEGIN");try{const result=await Promise.all(statements.map(s=>s.run()));sqlite.exec("COMMIT");return result;}
    catch(error){sqlite.exec("ROLLBACK");throw error;}
  }};
  function user(name:string,privateAccount=0){
    const id=randomUUID();sqlite.prepare(`INSERT INTO users(id,email,username,display_name,password_salt,password_hash,is_private,created_at)
      VALUES(?,?,?,?,?,?,?,?)`).run(id,`${name}@example.test`,name,name,"fixture","fixture",privateAccount,Date.now());return id;
  }
  async function request(userId:string,path:string,method="GET",input?:unknown){
    const response=await discoveryRequest(new Request(`https://oldtime.test/api${path}`,{
      method,headers:{"Content-Type":"application/json"},...(input?{body:JSON.stringify(input)}:{})}),db,userId,path.split("?")[0]);
    assert.equal(response.status,200);return response.json() as Promise<any>;
  }
  async function post(author:string,text:string){
    const response=await socialRequest(new Request("https://oldtime.test/api/posts",{method:"POST",
      headers:{"Content-Type":"application/json"},body:JSON.stringify({text,visibility:"public",destination:"main"})}),db,author,"/posts",safeReviewAi,reviewMediaBucket);
    assert.equal(response.status,201);return (await response.json() as any).post;
  }
  return {sqlite,db,user,request,post};
}
test("first and subsequent basketball posts reuse one canonical topic; multiple reliable topics",async t=>{
  const f=fixture(t),author=f.user("basketballauthor"),viewer=f.user("basketballviewer");
  const first=await f.post(author,"Basketball practice and passing drills");
  await f.post(author,"NBA Lakers basketball practice with teammates");
  const result=await f.request(viewer,"/discovery/explore?topic=nba");
  assert.equal(result.selectedTopic.label,"Basketball");
  assert(result.posts.some((p:any)=>p.id===first.id));
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM discovery_topics WHERE normalized_name='basketball'").get()?.n,1);
  assert.equal(result.selectedTopic.postCount,2);
  const alias=await f.request(viewer,"/discovery/explore?q=nba");
  assert.equal(alias.selectedTopic.id,"nba-league");
});
test("ordinary captions qualify automatically only after diverse unique evidence, and aliases reuse the page",async t=>{
  const f=fixture(t),a=f.user("coralauthor"),b=f.user("coralother"),v=f.user("coralviewer");
  await f.post(a,"Coral gardening with shells");await f.post(a,"Coral gardening with stones");
  await refreshTopicRegistry(f.db,100);
  const candidate=await resolveRegisteredTopic(f.db,"Coral gardening");assert(candidate);
  assert.equal(candidate.status,"candidate");
  await assert.rejects(f.request(v,`/discovery/trending/${candidate.id}/posts`));
  await f.post(b,"Coral gardening with plants");await refreshTopicRegistry(f.db,100);
  const result=await f.request(v,`/discovery/explore?topic=${candidate.id}`);
  assert.equal((await f.request(v,`/discovery/trending/${candidate.id}/posts`)).posts.length,3);
  assert.equal(result.selectedTopic.postCount,3);assert.equal(result.selectedTopic.creatorCount,2);
  const people=await f.request(v,`/discovery/explore?topic=${candidate.id}&type=people`);
  assert.deepEqual(new Set(people.people.map((p:any)=>p.id)),new Set([a,b]));
  await f.post(b,"#Coral_Gardening");
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM discovery_topics WHERE normalized_name='coral gardening'").get()?.n,1);
  const before=Number(f.sqlite.prepare("SELECT count(*) AS n FROM discovery_topics").get()?.n);
  await f.request(v,"/discovery/explore?q=nonexistentsearchword");
  assert.equal(Number(f.sqlite.prepare("SELECT count(*) AS n FROM discovery_topics").get()?.n),before);
});
test("privacy, archived posts, blocked accounts and duplicate-content qualification are respected",async t=>{
  const f=fixture(t),a=f.user("publicgardener"),b=f.user("secondgardener"),v=f.user("gardenviewer");
  await f.post(a,"Reef planting with shells");await f.post(b,"Reef planting with shells");await f.post(b,"Reef planting with shells");
  await refreshTopicRegistry(f.db,100);
  assert.equal((await resolveRegisteredTopic(f.db,"Reef planting"))?.status,"candidate");
  const p=await f.post(a,"Basketball passing practice");
  f.sqlite.prepare("UPDATE users SET is_private=1 WHERE id=?").run(a);
  let result=await f.request(v,"/discovery/explore?q=Basketball");assert.equal(result.posts.length,0);
  f.sqlite.prepare("UPDATE users SET is_private=0 WHERE id=?").run(a);
  f.sqlite.prepare("UPDATE posts SET archived_at=? WHERE id=?").run(Date.now(),p.id);
  result=await f.request(v,"/discovery/explore?q=Basketball");assert.equal(result.posts.length,0);
  f.sqlite.prepare("UPDATE posts SET archived_at=NULL WHERE id=?").run(p.id);
  f.sqlite.prepare("INSERT INTO account_blocks(owner_id,blocked_id,created_at) VALUES(?,?,?)").run(v,a,Date.now());
  result=await f.request(v,"/discovery/explore?q=Basketball");assert.equal(result.posts.length,0);
  assert.equal((await f.request(v,"/discovery/topics?q=Basketball")).topics.length,0);
});
test("private signals are deduplicated, decay, honor opt-out and cannot spoof the actor",async t=>{
  const f=fixture(t),a=f.user("signalauthor"),v=f.user("signalviewer"),other=f.user("signalother");
  const p=await f.post(a,"Basketball training drills");
  await refreshTopicRegistry(f.db,100);
  await f.request(v,"/discovery/topic-events","POST",{topicId:"nba",kind:"save",postId:p.id});
  await f.request(v,"/discovery/topic-events","POST",{topicId:"nba",kind:"save",postId:p.id});
  const saved=f.sqlite.prepare("SELECT score FROM discovery_topic_user_interests WHERE user_id=? AND topic_id='nba'").get(v);
  assert.equal(saved?.score,3);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM discovery_topic_user_interests WHERE user_id=?").get(other)?.n,0);
  f.sqlite.prepare("UPDATE discovery_topic_user_interests SET decay_day=decay_day-7 WHERE user_id=?").run(v);
  assert.equal((await learnedTopicInterests(f.db,v))[0].score,1.5);
  await assert.rejects(f.request(v,"/discovery/topic-events","POST",{topicId:"nba",kind:"save",postId:p.id,userId:other}));
  await f.request(v,"/discovery/preferences","PUT",{hiddenTopics:[],personalize:false});
  assert.equal(await recordTopicSignal(f.db,v,"nba","share"),false);
  const watch=await f.request(other,"/discovery/topic-events","POST",{topicId:"nba",kind:"watch",postId:p.id,watchMs:20});
  assert.equal(watch.accepted,false);
});
test("topic follow is private, exact query wins and pending backfill uses its partial index",async t=>{
  const f=fixture(t),a=f.user("followauthor"),v=f.user("followviewer");
  await f.post(a,"Basketball practice");await f.post(a,"Food cooking and pasta recipe");
  await f.request(v,"/discovery/explore");
  await f.request(v,"/discovery/topics/nba/follow","PUT",{followed:true});
  assert.equal((await f.request(v,"/discovery/topics/nba")).followed,true);
  const topics=await f.request(v,"/discovery/topics?q=Food");
  assert.equal(topics.topics[0].id,"food");
  const plan=f.sqlite.prepare("EXPLAIN QUERY PLAN SELECT post_id FROM discovery_documents WHERE pipeline_version<>'topic-registry-1' LIMIT 8").all();
  assert(plan.some((row:any)=>String(row.detail).includes("discovery_automatic_pending_idx")));
});
test("confirmed post likes and author follows learn topics; moderation merge retains posts and redirects",async t=>{
  const f=fixture(t),a=f.user("activityauthor"),b=f.user("activityother"),v=f.user("activityviewer");
  const post=await f.post(a,"Basketball passing practice");
  await f.request(v,"/discovery/explore");
  await socialRequest(new Request(`https://oldtime.test/api/posts/${post.id}/like`,{method:"PUT"}),f.db,v,`/posts/${post.id}/like`);
  assert.equal(f.sqlite.prepare("SELECT score FROM discovery_topic_user_interests WHERE user_id=? AND topic_id='nba'").get(v)?.score,1.5);
  const follow=await relationshipRequest(new Request(`https://oldtime.test/api/relationships/follow/${a}`,{method:"POST"}),f.db,v,`/relationships/follow/${a}`);
  assert.equal(follow.status,200);
  for(const [author,text] of [[a,"Coral gardening with shells"],[b,"Coral gardening with plants"],[a,"Coral gardening with stones"]])
    await f.post(author,text);
  await refreshTopicRegistry(f.db,100);
  const source=await resolveRegisteredTopic(f.db,"Coral gardening");assert(source);
  await assert.rejects(mergeAutomaticTopic(f.db,v,source.id,"nba","Not a duplicate"),{status:403});
  f.sqlite.prepare("INSERT INTO moderation_staff(user_id) VALUES(?)").run(v);
  const count=f.sqlite.prepare("SELECT count(*) AS n FROM posts").get()?.n;
  await mergeAutomaticTopic(f.db,v,source.id,"nba","Fixture duplicate-topic merge");
  assert.equal((await resolveRegisteredTopic(f.db,source.id))?.id,"nba");
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM posts").get()?.n,count);
  const topic=await f.request(v,"/discovery/explore?topic=nba");
  assert.equal(topic.posts.length,4);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM discovery_topic_moderation_log").get()?.n,1);
});
test("Following never admits an unfollowed author through a followed account's repost",async t=>{
  const f=fixture(t),a=f.user("strictfollowed"),b=f.user("strictstranger"),v=f.user("strictviewer");
  const own=await f.post(a,"Basketball with teammates"),stranger=await f.post(b,"Basketball from another person");
  f.sqlite.prepare("INSERT INTO user_follows(follower_id,followed_id,created_at) VALUES(?,?,?)").run(v,a,Date.now());
  f.sqlite.prepare("INSERT INTO post_reposts(post_id,user_id,created_at) VALUES(?,?,?)").run(stranger.id,a,Date.now());
  const response=await socialRequest(new Request("https://oldtime.test/api/feed?surface=following"),f.db,v,"/feed");
  assert.equal(response.status,200);
  assert.deepEqual((await response.json() as any).posts.map((p:any)=>p.id),[own.id]);
  const trends=await f.request(v,"/discovery/trending");
  assert(trends.topics.some((t:any)=>t.topic==="#nba"&&t.creatorCount===2));
});
