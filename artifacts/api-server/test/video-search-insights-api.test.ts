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


// The Worker maps ApiError to a response; mirror that so tests assert on status codes.
async function call(f:ReturnType<typeof fixture>,user:string,method:string,path:string,data?:unknown){
  try{
    return await socialRequest(new Request(`https://oldtime.test/api${path}`,{method,headers:{"Content-Type":"application/json"},
      ...(data===undefined?{}:{body:JSON.stringify(data)})}),f.db,user,path);
  }catch(error:any){
    if(typeof error?.status!=="number")throw error;
    return new Response(JSON.stringify({error:error.message}),{status:error.status});
  }
}

async function video(f:ReturnType<typeof fixture>,owner:string,text="Sunset skate clip",extra:Record<string,unknown>={}){
  const post=await f.post(owner,text,extra);
  f.sqlite.prepare("INSERT INTO videos(id,creator_id,caption,tags,created_at,updated_at) VALUES(?,?,?,?,?,?)")
    .run(post.id,owner,text,"[]",Date.now(),Date.now());
  return post.id as string;
}

test("search-click rejects fractional durations that would floor to five or less",async t=>{
  const f=fixture(t),owner=f.user("sc_owner"),viewer=f.user("sc_viewer"),id=await video(f,owner);
  for(const watchTimeSeconds of [5,5.5,5.999,"6",null,3601]){
    const response=await call(f,viewer,"POST",`/videos/${id}/search-click`,{queryText:"skate",watchTimeSeconds});
    assert.equal(response.status,400,String(watchTimeSeconds));
  }
  assert.equal((f.sqlite.prepare("SELECT count(*) AS n FROM search_clicks").get() as any).n,0);
  const ok=await call(f,viewer,"POST",`/videos/${id}/search-click`,{queryText:"skate",watchTimeSeconds:6.4});
  assert.equal(ok.status,200);
  assert.deepEqual(await ok.json(),{ok:true,learned:true});
  assert.equal((f.sqlite.prepare("SELECT watch_time FROM search_clicks").get() as any).watch_time,6);
});

test("search-click is deduplicated per user, phrase, video and day",async t=>{
  const f=fixture(t),owner=f.user("dd_owner"),viewer=f.user("dd_viewer"),id=await video(f,owner);
  const send=()=>call(f,viewer,"POST",`/videos/${id}/search-click`,{queryText:"Skate!",watchTimeSeconds:9});
  assert.deepEqual(await (await send()).json(),{ok:true,learned:true});
  assert.deepEqual(await (await send()).json(),{ok:true,learned:false});
  assert.equal((f.sqlite.prepare("SELECT count(*) AS n FROM search_clicks").get() as any).n,1);
});

test("search endpoints refuse private-account, non-public and unindexed videos",async t=>{
  const f=fixture(t),owner=f.user("auth_owner"),privateOwner=f.user("auth_private",1),viewer=f.user("auth_viewer");
  const publicId=await video(f,owner);
  const privateId=await video(f,privateOwner,"Private skate");
  const friendsId=await video(f,owner,"Connections skate",{visibility:"connections"});
  const textOnly=(await f.post(owner,"Plain post")).id as string;
  for(const id of [privateId,friendsId,textOnly,randomUUID()]){
    assert.equal((await call(f,viewer,"POST",`/videos/${id}/search-click`,{queryText:"skate",watchTimeSeconds:9})).status,404,id);
    assert.equal((await call(f,viewer,"GET",`/videos/${id}/search-insight`)).status,404,id);
  }
  assert.equal((await call(f,viewer,"GET",`/videos/${publicId}/search-insight`)).status,200);
  assert.equal((f.sqlite.prepare("SELECT count(*) AS n FROM search_clicks").get() as any).n,0);
});

test("insights never invent a phrase and need two contributing accounts",async t=>{
  const f=fixture(t),owner=f.user("in_owner"),a=f.user("in_a"),b=f.user("in_b"),id=await video(f,owner,"Sunset skate clip");
  const insight=async()=>(await (await call(f,a,"GET",`/videos/${id}/search-insight`)).json() as any).insight;
  assert.equal(await insight(),null,"caption terms alone are not learned insights");
  await call(f,a,"POST",`/videos/${id}/search-click`,{queryText:"night skate spots",watchTimeSeconds:8});
  assert.equal(await insight(),null,"a single account's search is not exposed");
  await call(f,b,"POST",`/videos/${id}/search-click`,{queryText:"night skate spots",watchTimeSeconds:8});
  assert.equal((await insight()).keyword,"night skate spots");
  const raw=JSON.stringify(await (await call(f,a,"GET",`/videos/${id}/search-insight`)).json());
  assert.ok(!raw.includes(a)&&!raw.includes(b),"responses carry no account identifiers");
});
