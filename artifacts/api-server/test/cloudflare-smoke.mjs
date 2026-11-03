import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import WebSocket from "ws";

// Explicitly local-only: never write test accounts/media to a deployed app.
const workerOrigin=`http://127.0.0.1:${process.env.CF_SMOKE_PORT||process.env.PORT||8787}`;
const base = `${workerOrigin}/api`;
const suffix=Date.now().toString(36), assets=[], posts=[], accounts=[];
const socialOnly=process.argv.includes("--social-only");
const chatsOnly=process.argv.includes("--chats-only");
const storiesOnly=process.argv.includes("--stories-only");
const accountDataOnly=process.argv.includes("--account-data-only");
const lifecycleOnly=process.argv.includes("--lifecycle-only");
const creatorAnalyticsOnly=process.argv.includes("--creator-analytics-only");
const realtimeOnly=process.argv.includes("--realtime-only"),realtimeSockets=[];
function localSql(command){
  const directory=resolve(process.cwd(),".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  const databases=readdirSync(directory).filter(name=>/^[a-f0-9]{64}\.sqlite$/.test(name));
  assert.equal(databases.length,1,"Expected exactly one local D1 database");
  const database=new DatabaseSync(resolve(directory,databases[0]));
  try{
    database.exec("PRAGMA busy_timeout=5000");
    if(/^\s*SELECT\b/i.test(command))return[{results:database.prepare(command).all()}];
    database.exec(command);return[];
  }finally{database.close();}
}
async function call(path,method="GET",data,accessToken){
  const response=await fetch(`${base}${path}`,{method,headers:{
    "content-type":"application/json","CF-Connecting-IP":"192.0.2.44",
    ...(accessToken ? {authorization:`Bearer ${accessToken}`} : {}),
  },body:data===undefined ? undefined : JSON.stringify(data)});
  const result=await response.json().catch(()=>({}));
  return {status:response.status,data:result};
}
async function createAccount(name){
  const r=await call("/auth/register","POST",{
    email:`cf-smoke-${suffix}-${name}@example.invalid`,username:`cf_${suffix}_${name}`,
    displayName:`Cloudflare ${name}`,birthday:"2000-01-01",password:"Strong-test-only!2026",
  });
  assert.equal(r.status,201,JSON.stringify(r.data));
  accounts.push(r.data);return r.data;
}
async function upload(account,content,contentType="image/png",scope="public"){
  const id=randomUUID(),sha256=createHash("sha256").update(content).digest("hex");
  const ticket=await call(`/media/${id}/upload`,"POST",{contentType,size:content.length,sha256:"0".repeat(64),scope},account.accessToken);
  assert.equal(ticket.status,201,JSON.stringify(ticket.data));
  assets.push({id,account});
  assert.equal(ticket.data.endpoint,`/api/media/uploads/${id}`);
  const endpoint=new URL(ticket.data.endpoint,workerOrigin);
  assert.equal(endpoint.origin,workerOrigin);
  const unauthorized=await fetch(endpoint,{method:"POST",headers:{"upload-length":String(content.length),"x-signature":"invalid"}});
  assert.equal(unauthorized.status,401);
  const start=await fetch(endpoint,{method:"POST",headers:{"Tus-Resumable":"1.0.0","Upload-Length":String(content.length),"x-signature":ticket.data.token}});
  assert.equal(start.status,201,await start.text());
  const location=start.headers.get("location");
  assert.equal(location,`/api/media/uploads/${id}/data`);
  const dataEndpoint=new URL(location,endpoint);
  for(let offset=0;offset<content.length;offset+=6*1024*1024){
    const chunk=content.subarray(offset,Math.min(content.length,offset+6*1024*1024));
    const patch=await fetch(dataEndpoint,{method:"PATCH",headers:{
      "Tus-Resumable":"1.0.0","Upload-Offset":String(offset),"content-type":"application/offset+octet-stream","x-signature":ticket.data.token,
    },body:chunk});
    assert.equal(patch.status,204,await patch.text());
    const head=await fetch(dataEndpoint,{method:"HEAD",headers:{"x-signature":ticket.data.token}});
    assert.equal(Number(head.headers.get("upload-offset")),offset+chunk.length);
  }
  const confirm=await call(`/media/${id}/confirm`,"POST",{sha256},account.accessToken);
  assert.equal(confirm.status,200,JSON.stringify(confirm.data));
  assert.equal(confirm.data.ready,true);
  return id;
}
async function retryPlaceholderUpload(account){
  const id=randomUUID(),content=Buffer.from("stable media retry"),sha256=createHash("sha256").update(content).digest("hex");
  const details={contentType:"image/png",size:content.length,scope:"public",role:"media"};
  const first=await call(`/media/${id}/upload`,"POST",{...details,sha256:"0".repeat(64)},account.accessToken);
  assert.equal(first.status,201,JSON.stringify(first.data));
  assets.push({id,account});
  const retried=await call(`/media/${id}/upload`,"POST",{...details,sha256},account.accessToken);
  assert.equal(retried.status,201,JSON.stringify(retried.data));
  const endpoint=new URL(retried.data.endpoint,workerOrigin);
  assert.equal(endpoint.origin,workerOrigin);
  const start=await fetch(endpoint,{method:"POST",headers:{
    "Tus-Resumable":"1.0.0","Upload-Length":String(content.length),"x-signature":retried.data.token,
  }});
  assert.equal(start.status,201,await start.text());
  const location=start.headers.get("location");
  assert.equal(location,`/api/media/uploads/${id}/data`);
  const patch=await fetch(new URL(location,endpoint),{method:"PATCH",headers:{
    "Tus-Resumable":"1.0.0","Upload-Offset":"0","content-type":"application/offset+octet-stream","x-signature":retried.data.token,
  },body:content});
  assert.equal(patch.status,204,await patch.text());
  const confirm=await call(`/media/${id}/confirm`,"POST",{sha256},account.accessToken);
  assert.equal(confirm.status,200,JSON.stringify(confirm.data));
}
try{
  const alice=await createAccount("a"),bob=await createAccount("b"),charlie=await createAccount("c");
  if(realtimeOnly){
    const waitFor=async predicate=>{const end=Date.now()+4000;while(!predicate()){if(Date.now()>end)throw new Error("Timed out waiting for a real-time update");await new Promise(r=>setTimeout(r,20));}};
    const connect=async(account,{closeOnExpiry=true}={})=>{
      const ticket=await call("/realtime/ticket","POST",{},account.accessToken);assert.equal(ticket.status,200,JSON.stringify(ticket.data));
      const realtimeUrl=new URL("/api/realtime",workerOrigin);
      realtimeUrl.protocol=realtimeUrl.protocol==="https:"?"wss:":"ws:";
      realtimeUrl.searchParams.set("ticket",ticket.data.ticket);
      const ws=new WebSocket(realtimeUrl),events=[];
      realtimeSockets.push(ws);
      ws.addEventListener("message",event=>{try{const update=JSON.parse(event.data);events.push(update);if(closeOnExpiry&&update.event==="session:expired")ws.close();}catch{events.push(event.data);}});
      await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error("Connection timed out")),4000);
        ws.addEventListener("open",()=>{clearTimeout(timeout);resolve();},{once:true});
        ws.addEventListener("error",()=>{clearTimeout(timeout);reject(new Error("Connection rejected"));},{once:true});});
      return {ws,events,ticket:ticket.data.ticket};
    };
    const rejected=async ticket=>{
      const ws=new WebSocket(`ws://127.0.0.1:8787/api/realtime?ticket=${encodeURIComponent(ticket)}`);realtimeSockets.push(ws);
      await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error("Invalid ticket was not rejected")),4000);
        ws.addEventListener("error",()=>{clearTimeout(timeout);resolve();},{once:true});
        ws.addEventListener("open",()=>{clearTimeout(timeout);reject(new Error("Invalid ticket opened a connection"));},{once:true});});
    };
    assert.equal((await call("/realtime/ticket","POST",{})).status,401);
    const a=await connect(alice),b=await connect(bob,{closeOnExpiry:false}),c=await connect(charlie);
    await rejected(b.ticket);
    a.ws.send("ping");await waitFor(()=>a.events.includes("pong"));
    const id="cv"+randomUUID();
    assert.equal((await call("/chats","POST",{id,title:"Private real-time check",members:[alice.account.id,bob.account.id]},alice.accessToken)).status,201);
    await waitFor(()=>b.events.some(e=>e.event==="chat:changed"&&e.data?.conversationId===id));
    b.events.length=0;
    const secret="This private message must never travel through the update socket.";
    assert.equal((await call(`/chats/${id}/messages`,"POST",{clientId:randomUUID(),kind:"text",body:secret},alice.accessToken)).status,201);
    await waitFor(()=>b.events.some(e=>e.event==="chat:changed"&&e.data?.conversationId===id));
    assert.ok(!JSON.stringify(b.events).includes(secret));assert.equal(c.events.length,0,"A non-member received conversation updates");
    const publicPost=await call("/posts","POST",{text:"A public post for the notification check.",mediaIds:[]},alice.accessToken);
    assert.equal(publicPost.status,201,JSON.stringify(publicPost.data));posts.push({id:publicPost.data.post.id,account:alice});
    await waitFor(()=>a.events.some(e=>e.event==="notifications:changed"));a.events.length=0;
    await call(`/posts/${publicPost.data.post.id}/like`,"PUT",{},bob.accessToken);
    await waitFor(()=>a.events.some(e=>e.event==="notifications:changed"));
    const unused=await call("/realtime/ticket","POST",{},bob.accessToken);assert.equal(unused.status,200);
    const expiredFrame=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error(
      `Logout event was not delivered (readyState=${b.ws.readyState}; events=${b.events.map(e=>typeof e==="object"?e.event:String(e)).join(",")})`
    )),1500);b.ws.addEventListener("message",event=>{try{if(JSON.parse(event.data).event==="session:expired"){clearTimeout(timeout);resolve();}}catch{};});});
    assert.equal((await call("/auth/logout","POST",{},bob.accessToken)).status,200);await expiredFrame;
    await waitFor(()=>b.ws.readyState!==WebSocket.OPEN);
    assert.equal((await call("/realtime/ticket","POST",{},bob.accessToken)).status,401);
    await rejected(unused.data.ticket);
    assert.equal((await call(`/chats/${id}/messages`,"POST",{clientId:randomUUID(),kind:"text",body:"A revoked session must not send."},bob.accessToken)).status,401);
    const beforeRevokedEventCount=b.events.length;a.events.length=0;
    assert.equal((await call(`/chats/${id}/messages`,"POST",{clientId:randomUUID(),kind:"text",body:"A current member sends another message."},alice.accessToken)).status,201);
    await waitFor(()=>a.events.some(e=>e.event==="chat:changed"&&e.data?.conversationId===id));
    await new Promise(r=>setTimeout(r,150));assert.equal(b.events.length,beforeRevokedEventCount,"A revoked socket received a later private update");
    a.ws.send(JSON.stringify({event:"chat:changed",data:{conversationId:"forged"}}));
    await waitFor(()=>a.ws.readyState!==WebSocket.OPEN);
    assert.equal(c.events.length,0,"A client event was relayed to another account");
    console.log("PASS: Cloudflare tickets, private updates, message privacy, revocation, logout denial and receive-only enforcement");
  }else if(creatorAnalyticsOnly){
    for(const account of [alice,bob]){
      await call("/account/privacy","PUT",{isPrivate:false},account.accessToken);
      const tools=await call("/account/professional","GET",undefined,account.accessToken);
      assert.equal((await call("/account/professional","PUT",{...tools.data,accountType:"creator",creatorCategory:"Creator"},account.accessToken)).status,200);
    }
    const text="A genuinely original paragraph with several thoughtful words.";
    const post=await call("/posts","POST",{text,mediaIds:[]},alice.accessToken);assert.equal(post.status,201,JSON.stringify(post.data));
    const postId=post.data.post.id;posts.push({id:postId,account:alice});
    const original=await call("/creator/content","POST",{sourceId:randomUUID(),surface:"post",body:text,mediaIds:[]},alice.accessToken);
    assert.equal(original.status,200,JSON.stringify(original.data));assert.equal(original.data.original,true);
    const photo=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfRcAAAAASUVORK5CYII=","base64");
    const mediaId=await upload(alice,photo),copyId=await upload(bob,photo);
    const mediaCredit=await call("/creator/content","POST",{sourceId:randomUUID(),surface:"post",body:"Original image",mediaIds:[mediaId]},alice.accessToken);
    assert.equal(mediaCredit.status,200,JSON.stringify(mediaCredit.data));assert.equal(mediaCredit.data.original,true);
    const copy=await call("/creator/content","POST",{sourceId:randomUUID(),surface:"post",body:"Copied image",mediaIds:[copyId]},bob.accessToken);
    assert.equal(copy.status,200,JSON.stringify(copy.data));assert.equal(copy.data.original,false,"A cross-account copy earned original credit");
    assert.equal(localSql(`SELECT count(*) AS total FROM user_media_assets WHERE user_id='${alice.account.id}'`)[0].results[0].total,1,"Creator credit stored a second media copy");
    localSql(`UPDATE users SET created_at=${Date.now()-8*86400000} WHERE id='${bob.account.id}';`);
    await call(`/posts/${postId}/like`,"PUT",{},bob.accessToken);
    const comment=await call(`/posts/${postId}/comments`,"POST",{body:"This is a genuine thoughtful comment for the test."},bob.accessToken);assert.equal(comment.status,200,JSON.stringify(comment.data));
    const center=await call("/creator/center","GET",undefined,alice.accessToken);
    assert.equal(center.status,200,JSON.stringify(center.data));assert.equal(center.data.stats.originalPosts,2,"Duplicate text received extra original credit");
    assert.equal(center.data.stats.engagementReceived,1,"Repeated engagement by one established account was inflated");
    assert.equal(center.data.creatorPayoutsEnabled,false);assert.equal(center.data.isAdmin,false);
    assert.equal((await call("/creator/admin/config","GET",undefined,alice.accessToken)).status,403);
    const badge=await call("/badge/membership","GET",undefined,alice.accessToken);assert.equal(badge.status,200,JSON.stringify(badge.data));
    assert.equal(badge.data.active,false);assert.equal(badge.data.billingEnabled,false);assert.equal(badge.data.purchaseSupported,false);
    assert.equal((await call("/badge/membership/refresh","POST",{},alice.accessToken)).status,503);
    const tips=await call("/announcements","GET",undefined,alice.accessToken);assert.equal(tips.status,200,JSON.stringify(tips.data));
    const welcome=tips.data.announcements.find(t=>t.id==="welcome-old-time");assert.ok(welcome);
    assert.equal((await call(`/announcements/${welcome.id}/dismiss`,"POST",{choice:"never"},alice.accessToken)).status,200);
    assert.ok(!(await call("/announcements","GET",undefined,alice.accessToken)).data.announcements.some(t=>t.id===welcome.id));
    const prefs={features:true,promotions:false,creators:true,communities:true};
    assert.equal((await call("/announcement-preferences","PUT",prefs,alice.accessToken)).status,200);
    assert.deepEqual((await call("/announcement-preferences","GET",undefined,alice.accessToken)).data,prefs);
    const resource=await call("/analytics/resources","POST",{sourceId:postId,kind:"text",title:"Measured test content",isPublic:true,durationMs:null,publishedAt:Date.now()},alice.accessToken);
    assert.equal(resource.status,200,JSON.stringify(resource.data));
    const view={ownerId:alice.account.id,sourceId:postId,nonce:randomUUID(),source:"profile"};
    assert.equal((await call("/analytics/sessions","POST",view,alice.accessToken)).data.id,null);
    const session=await call("/analytics/sessions","POST",view,bob.accessToken);assert.equal(session.status,200,JSON.stringify(session.data));
    localSql(`UPDATE analytics_sessions SET started_at=${Date.now()-5000} WHERE id='${session.data.id}';`);
    for(let i=0;i<2;i++){
      const progress=await call(`/analytics/sessions/${session.data.id}`,"PUT",{visibleMs:2500,watchedMs:0,progress:0,ended:false},bob.accessToken);
      assert.equal(progress.status,200,JSON.stringify(progress.data));assert.equal(progress.data.qualified,true);
    }
    const stale=await call(`/analytics/sessions/${session.data.id}`,"PUT",{visibleMs:0,watchedMs:0,progress:0,ended:false},bob.accessToken);assert.equal(stale.data.qualified,true);
    const event={ownerId:alice.account.id,sourceId:postId,nonce:randomUUID(),kind:"like",source:"profile"};
    assert.equal((await call("/analytics/events","POST",event,bob.accessToken)).data.recorded,true);
    assert.equal((await call("/analytics/events","POST",{...event,nonce:randomUUID()},bob.accessToken)).data.recorded,false);
    assert.equal((await call("/analytics/events","POST",{...event,nonce:randomUUID()},charlie.accessToken)).data.recorded,false,"An unconfirmed like inflated analytics");
    const visit={ownerId:alice.account.id,sourceId:null,kind:"profile_visit",source:"profile",nonce:randomUUID()};
    assert.equal((await call("/analytics/events","POST",visit,bob.accessToken)).data.recorded,true);
    assert.equal((await call("/analytics/events","POST",{...visit,nonce:randomUUID()},bob.accessToken)).data.recorded,false);
    assert.equal((await call("/analytics/events","POST",{...visit,kind:"payout"},bob.accessToken)).status,400);
    const report=await call("/analytics/me?mode=creator","GET",undefined,alice.accessToken);
    assert.equal(report.status,200,JSON.stringify(report.data));assert.equal(report.data.overview.views,1);assert.equal(report.data.overview.likes,1);
    assert.equal(report.data.overview.profileVisits,1);assert.equal(report.data.earnings.available,false);
    assert.ok(!JSON.stringify(report.data).includes(bob.account.id),"Owner report exposed viewer identity");
    assert.equal((await call(`/analytics/content/${resource.data.id}`,"GET",undefined,bob.accessToken)).status,404);
    const content=await call(`/analytics/content/${resource.data.id}`,"GET",undefined,alice.accessToken);assert.equal(content.status,200,JSON.stringify(content.data));assert.equal(content.data.views,1);
    assert.equal((await call("/analytics/me?mode=business","GET",undefined,alice.accessToken)).status,403);
    await call("/account/privacy","PUT",{isPrivate:true},alice.accessToken);
    assert.equal((await call("/analytics/sessions","POST",{...view,nonce:randomUUID()},bob.accessToken)).status,404);
    assert.equal((await call(`/analytics/sessions/${session.data.id}`,"PUT",{visibleMs:3000,watchedMs:0,progress:0,ended:false},bob.accessToken)).status,404);
    await call("/account/privacy","PUT",{isPrivate:false},alice.accessToken);
    const picture=await call("/posts","POST",{text:"Image",mediaIds:[mediaId]},alice.accessToken);assert.equal(picture.status,201,JSON.stringify(picture.data));posts.push({id:picture.data.post.id,account:alice});
    assert.equal((await call(`/creator/content/${mediaCredit.data.id}`,"DELETE",undefined,alice.accessToken)).status,200);
    assert.equal((await call(`/media/${mediaId}/url`,"GET",undefined,bob.accessToken)).status,200,"Removing creator credit removed a published image");
    assert.equal((await call(`/media/${mediaId}`,"DELETE",undefined,alice.accessToken)).status,409);
    console.log("PASS: D1 creator eligibility/deduplication, single-copy R2 originals, disabled billing, optional-tip preferences, private aggregate analytics, deduplicated qualified views and current-privacy enforcement");
  }else if(lifecycleOnly){
    localSql(`INSERT INTO creator_program_accounts(user_id,is_admin) VALUES('${alice.account.id}',1)
      ON CONFLICT(user_id) DO UPDATE SET is_admin=1`);
    assert.equal((await call("/media/admin/usage","GET",undefined,bob.accessToken)).status,403,"Media diagnostics must be admin-only");
    assert.equal((await call("/media/admin/orphans","GET",undefined,bob.accessToken)).status,403,"R2 scans must be admin-only");
    await call("/account/privacy","PUT",{isPrivate:false},alice.accessToken);
    await call("/account/privacy","PUT",{isPrivate:false},bob.accessToken);
    const content=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfRcAAAAASUVORK5CYII=","base64");
    const orphan=await upload(alice,content),postMedia=await upload(alice,content),storyMedia=await upload(alice,content);
    const chatMedia=await upload(alice,content,"image/png","message"),draftMedia=await upload(alice,content),avatar=await upload(alice,content),expired=await upload(alice,content);
    const made=await call("/posts","POST",{sourceId:`gc-${randomUUID()}`,text:"This funny joke is a local test",mediaIds:[postMedia],destination:"main",visibility:"public"},alice.accessToken);
    assert.equal(made.status,201,JSON.stringify(made.data));posts.push({id:made.data.post.id,account:alice});
    const second=await call("/posts","POST",{sourceId:`gc-${randomUUID()}`,text:"Another funny joke for testing",mediaIds:[],destination:"main",visibility:"public"},bob.accessToken);
    assert.equal(second.status,201,JSON.stringify(second.data));posts.push({id:second.data.post.id,account:bob});
    const story=await call("/stories","POST",{text:"Lifecycle test",visibility:"public",mediaId:storyMedia,mediaType:"photo"},alice.accessToken);
    assert.equal(story.status,201,JSON.stringify(story.data));
    const chatId=`cv${randomUUID()}`;
    const chat=await call("/chats","POST",{id:chatId,title:"Private cleanup test",members:[alice.account.id,bob.account.id]},alice.accessToken);
    assert.equal(chat.status,201,JSON.stringify(chat.data));
    const message=await call(`/chats/${chatId}/messages`,"POST",{clientId:randomUUID(),kind:"file",body:"",mediaIds:[chatMedia],metadata:{fileName:"image.png"}},alice.accessToken);
    assert.equal(message.status,201,JSON.stringify(message.data));
    const draft=await call("/creative/drafts/gc-test","PUT",{version:1,project:{image:`oldtime-media:${draftMedia}`},state:{},media:[`oldtime-media:${draftMedia}`],savedAt:Date.now()},alice.accessToken);
    assert.equal(draft.status,200,JSON.stringify(draft.data));
    const profile={username:alice.account.username,displayName:"Cloudflare a",email:alice.account.email,profile:{avatar:`oldtime-media:${avatar}`}};
    assert.equal((await call("/account/profile","PUT",profile,alice.accessToken)).status,200);
    const pending=randomUUID();assets.push({account:alice,id:pending});
    const reserved=await call(`/media/${pending}/upload`,"POST",{contentType:"image/png",size:content.length,sha256:createHash("sha256").update(content).digest("hex"),scope:"public",role:"media"},alice.accessToken);
    assert.equal(reserved.status,201,JSON.stringify(reserved.data));
    const orphanKey=localSql(`SELECT object_key FROM user_media_assets WHERE id='${orphan}'`)[0].results[0].object_key;
    const old=Date.now()-96*3600000;
    localSql(`UPDATE user_media_assets SET created_at=${old} WHERE user_id='${alice.account.id}';
      UPDATE user_media_assets SET ready=0 WHERE id='${expired}';
      INSERT INTO media_upload_sessions(media_id,token_hash,upload_id,offset,parts,lease_until,expires_at)
        VALUES('${expired}','expired-test','',${content.length},'[]',0,${old});
      UPDATE media_upload_sessions SET lease_until=${Date.now()+120000} WHERE media_id='${pending}';`);
    const scheduled=await fetch(`${workerOrigin}/cdn-cgi/handler/scheduled`);assert.equal(scheduled.status,200,await scheduled.text());
    const usage=await call("/media/admin/usage","GET",undefined,alice.accessToken);
    assert.equal(usage.status,200,JSON.stringify(usage.data));
    assert.ok(Array.isArray(usage.data.failedJobs),"Cleanup failures are not visible in the admin report");
    assert.ok(usage.data.recentCleanupRuns.length,"Scheduled media cleanup metrics were not recorded");
    assert.equal(usage.data.recentCleanupRuns[0].expired_stories,0);
    const objectCheck=await call(`/media/admin/orphans?prefix=${encodeURIComponent(orphanKey)}`,"GET",undefined,alice.accessToken);
    assert.equal(objectCheck.status,200,JSON.stringify(objectCheck.data));
    assert.equal(objectCheck.data.scanned,0,"R2 object deletion was not confirmed by the bucket listing");
    for(const id of [orphan,expired])assert.equal((await call(`/media/${id}/url`,"GET",undefined,alice.accessToken)).status,404,"Unused/expired media was retained");
    for(const id of [postMedia,storyMedia,chatMedia,draftMedia,avatar])assert.equal((await call(`/media/${id}/url`,"GET",undefined,alice.accessToken)).status,200,"Referenced media was deleted");
    assert.equal((await call(`/media/${chatMedia}/url`,"GET",undefined,bob.accessToken)).status,200);
    assert.equal((await call(`/media/${chatMedia}/url`,"GET",undefined,charlie.accessToken)).status,404);
    assert.ok(localSql(`SELECT id FROM user_media_assets WHERE id='${pending}'`)[0].results.length,"Active upload was deleted");
    assert.equal(localSql("SELECT count(*) AS total FROM r2_deletion_queue")[0].results[0].total,0,"R2 cleanup jobs did not finish");
    const trending=await call("/discovery/trending","GET",undefined,charlie.accessToken);assert.equal(trending.status,200,JSON.stringify(trending.data));
    assert.ok(trending.data.topics.some(t=>t.topic==="#humor"&&t.postCount===2),"Ordinary words were not classified without hashtags");
    const topic=await call("/discovery/trending/humor/posts","GET",undefined,charlie.accessToken);assert.equal(topic.status,200,JSON.stringify(topic.data));assert.equal(topic.data.posts.length,2);
    const people=await call("/discovery/people","GET",undefined,charlie.accessToken);assert.equal(people.status,200,JSON.stringify(people.data));
    assert.ok(people.data.suggestions.some(s=>s.profile.id===alice.account.id));
    const tools=await call("/account/professional","GET",undefined,alice.accessToken);assert.equal(tools.status,200,JSON.stringify(tools.data));
    const creator=await call("/account/professional","PUT",{...tools.data,accountType:"creator",creatorCategory:"Creator"},alice.accessToken);assert.equal(creator.status,200,JSON.stringify(creator.data));
    const forbidden=await call("/account/professional","PUT",{...creator.data,role:"admin"},alice.accessToken);assert.equal(forbidden.status,400);
    await call(`/stories/${story.data.story.id}`,"DELETE",undefined,alice.accessToken);
    await call(`/chats/${chatId}/messages/${message.data.message.id}`,"DELETE",undefined,alice.accessToken);
    await call("/creative/drafts/gc-test","DELETE",undefined,alice.accessToken);
    await call("/account/profile","PUT",{...profile,profile:{}},alice.accessToken);
    console.log("PASS: scheduled R2 garbage collection, active uploads and all published/private/editor media protected, real-word discovery and professional-account validation");
  }else if(accountDataOnly){
    const mediaId=await upload(alice,Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfRcAAAAASUVORK5CYII=","base64"));
    const reference=`oldtime-media:${mediaId}`,draft={version:1,project:{image:reference},state:{},media:[reference],savedAt:Date.now()};
    const save=await call("/creative/drafts/studio-test","PUT",draft,alice.accessToken);assert.equal(save.status,200,JSON.stringify(save.data));
    assert.equal((await call("/creative/drafts/studio-test","PUT",draft,bob.accessToken)).status,400);
    const read=await call("/creative/drafts/studio-test","GET",undefined,alice.accessToken);assert.deepEqual(read.data.draft,draft);
    const privateDraft=await call("/creative/drafts/studio-test","GET",undefined,bob.accessToken);assert.equal(privateDraft.data.draft,null);
    assert.equal((await call(`/media/${mediaId}`,"DELETE",undefined,alice.accessToken)).status,409,"A saved draft lost its media");
    const inline=await call("/creative/drafts/studio-test","PUT",{...draft,project:{image:"data:image/png;base64,AAAA"}},alice.accessToken);assert.equal(inline.status,400);
    const profile={username:alice.account.username,displayName:"Cloudflare a",email:alice.account.email,profile:{avatar:reference,bio:"Test profile"}};
    const profileSave=await call("/account/profile","PUT",profile,alice.accessToken);assert.equal(profileSave.status,200,JSON.stringify(profileSave.data));
    const data={version:1,friendships:[],friendRequests:[],posts:[{mediaId}],preferences:{},communityMemberships:[]};
    const blast=await call("/blast/state/social","PUT",{revision:0,data},alice.accessToken);
    assert.equal(blast.status,200,JSON.stringify(blast.data));assert.equal(blast.data.revision,1);
    assert.equal((await call("/blast/state/social","PUT",{revision:0,data:{...data,posts:[]}},alice.accessToken)).status,409,"A stale sync overwrote another revision");
    const current=await call("/blast/state/social","GET",undefined,alice.accessToken);assert.equal(current.data.data.posts[0].mediaId,mediaId);
    const other=await call("/blast/state/social","GET",undefined,bob.accessToken);assert.equal(other.data.data,null);
    const report=await call("/account/reports","POST",{kind:"problem",category:"Other",reason:"A test report without personal information"},alice.accessToken);
    assert.equal(report.status,201,JSON.stringify(report.data));
    const reports=await call("/account/reports","GET",undefined,bob.accessToken);assert.equal(reports.data.reports.length,0);
    assert.equal((await call("/creative/drafts/studio-test","DELETE",undefined,alice.accessToken)).status,204);
    const purgeDraft={version:1,project:{},state:{},media:[],savedAt:Date.now()};
    assert.equal((await call("/creative/drafts/purge-one","PUT",purgeDraft,alice.accessToken)).status,200);
    assert.equal((await call("/creative/drafts/purge-two","PUT",purgeDraft,alice.accessToken)).status,200);
    const purge=await call("/creative/drafts","DELETE",undefined,alice.accessToken);
    assert.equal(purge.status,200,JSON.stringify(purge.data));
    assert.equal(purge.data.deletedDrafts,2);
    assert.deepEqual(purge.data.mediaIds,[]);
    assert.equal((await call("/creative/drafts/purge-one","GET",undefined,alice.accessToken)).data.draft,null);
    const reset=await call("/account/profile","PUT",{...profile,profile:{bio:"Test profile"}},alice.accessToken);assert.equal(reset.status,200,JSON.stringify(reset.data));
    assert.equal((await call(`/media/${mediaId}`,"DELETE",undefined,alice.accessToken)).status,409,"Blast reference was not protected");
    assert.equal((await call("/blast/state/social","PUT",{revision:1,data:{...data,posts:[]}},alice.accessToken)).status,200);
    assert.equal((await call(`/media/${mediaId}`,"DELETE",undefined,alice.accessToken)).status,200);
    console.log("PASS: D1 private editor drafts, owned media, profile file protection, optimistic sync conflicts, per-account reports and reference-safe media deletion");
  }else if(storiesOnly){
    assert.equal((await call("/account/privacy","PUT",{isPrivate:false},alice.accessToken)).status,200);
    const mediaId=await upload(alice,Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfRcAAAAASUVORK5CYII=","base64"));
    const created=await call("/stories","POST",{text:"Cloudflare Story",visibility:"public",mediaType:"photo",mediaId},alice.accessToken);
    assert.equal(created.status,201,JSON.stringify(created.data));const id=created.data.story.id;
    const feed=await call("/stories","GET",undefined,bob.accessToken);assert.equal(feed.status,200,JSON.stringify(feed.data));assert(feed.data.stories.some(s=>s.id===id&&s.hasMedia));
    const media=await call(`/stories/${id}/media-url`,"GET",undefined,bob.accessToken);
    assert.equal(media.status,200,JSON.stringify(media.data));assert.equal((await fetch(media.data.url)).status,200);
    for(let n=0;n<2;n++)assert.equal((await call(`/stories/${id}/views`,"POST",{},bob.accessToken)).status,200);
    const reaction=await call(`/stories/${id}/reactions`,"PUT",{emoji:"🔥"},bob.accessToken);assert.equal(reaction.status,200,JSON.stringify(reaction.data));
    assert.equal((await call(`/stories/${id}/activity`,"GET",undefined,bob.accessToken)).status,404);
    const activity=await call(`/stories/${id}/activity`,"GET",undefined,alice.accessToken);
    assert.equal(activity.status,200,JSON.stringify(activity.data));assert.equal(activity.data.viewCount,1);assert.equal(activity.data.reactionCount,1);
    const reply=await call(`/stories/${id}/comments`,"POST",{body:"A real reply"},bob.accessToken);
    assert.equal(reply.status,201,JSON.stringify(reply.data));
    const comments=await call(`/stories/${id}/comments`,"GET",undefined,alice.accessToken);assert.equal(comments.status,200,JSON.stringify(comments.data));assert.equal(comments.data.comments.length,1);
    const settings=await call(`/stories/${id}`,"PATCH",{commentsEnabled:false,savedToProfile:true},alice.accessToken);assert.equal(settings.status,200,JSON.stringify(settings.data));
    assert.equal((await call(`/stories/${id}/comments`,"POST",{body:"Not allowed"},bob.accessToken)).status,409);
    assert.equal((await call(`/stories/${id}`,"DELETE",undefined,charlie.accessToken)).status,404);
    const block=await call("/account/blocks","PUT",{userIds:[bob.account.id]},alice.accessToken);assert.equal(block.status,200);
    assert.equal((await call(`/stories/${id}/media-url`,"GET",undefined,bob.accessToken)).status,404);
    assert.equal((await fetch(media.data.url)).status,404,"Story link remained accessible after blocking");
    assert.equal((await call(`/stories/${id}`,"DELETE",undefined,alice.accessToken)).status,204);
    console.log("PASS: D1/R2 Stories, views/reactions, owner-only insights, replies, saved Story settings and block revocation");
  }else if(chatsOnly){
    const mediaId=await upload(alice,Buffer.from("private-chat-attachment"),"text/plain","message");
    const id=`cv${randomUUID()}`,clientId=randomUUID();
    const created=await call("/chats","POST",{id,members:[alice.account.id,bob.account.id],title:"Private cloud chat"},alice.accessToken);
    assert.equal(created.status,201,JSON.stringify(created.data));assert.equal(created.data.chat.members.length,2);
    assert.equal((await call(`/chats/${id}/messages`,"GET",undefined,charlie.accessToken)).status,404);
    const input={clientId,kind:"file",body:"A private attachment",mediaIds:[mediaId],metadata:{fileName:"note.txt"}};
    for(let n=0;n<2;n++){
      const sent=await call(`/chats/${id}/messages`,"POST",input,alice.accessToken);
      assert.equal(sent.status,201,JSON.stringify(sent.data));assert.equal(sent.data.message.id,clientId);
    }
    const inbox=await call("/chats","GET",undefined,bob.accessToken);assert.equal(inbox.status,200,JSON.stringify(inbox.data));assert(inbox.data.chats.some(c=>c.id===id));
    const messages=await call(`/chats/${id}/messages`,"GET",undefined,bob.accessToken);
    assert.equal(messages.status,200,JSON.stringify(messages.data));assert.equal(messages.data.messages.length,1);
    const read=await call(`/media/${mediaId}/url`,"GET",undefined,bob.accessToken);assert.equal(read.status,200,JSON.stringify(read.data));
    assert.equal((await fetch(read.data.url)).status,200);
    assert.equal((await call(`/media/${mediaId}/url`,"GET",undefined,charlie.accessToken)).status,404);
    const state=await call(`/chats/${id}/state`,"PUT",{state:{reactions:{[clientId]:["❤️"]},shareReceipts:false}},bob.accessToken);
    assert.equal(state.status,200,JSON.stringify(state.data));
    const reacted=await call(`/chats/${id}/messages`,"GET",undefined,alice.accessToken);
    assert.deepEqual(reacted.data.messages[0].reactions["❤️"],[bob.account.id]);
    assert.equal((await call(`/chats/${id}/read`,"POST",{},bob.accessToken)).status,200);
    const receipts=await call(`/chats/${id}/messages`,"GET",undefined,alice.accessToken);
    assert.deepEqual(receipts.data.messages[0].readBy,[]);
    const textId=randomUUID(),text=await call(`/chats/${id}/messages`,"POST",{clientId:textId,kind:"text",body:"Original message"},alice.accessToken);
    assert.equal(text.status,201,JSON.stringify(text.data));
    const edit=await call(`/chats/${id}/messages/${textId}`,"PATCH",{body:"Edited message"},alice.accessToken);
    assert.equal(edit.status,200,JSON.stringify(edit.data));assert.equal(edit.data.message.body,"Edited message");assert.equal(edit.data.message.editHistory.length,1);
    assert.equal((await call(`/chats/${id}/messages/${textId}`,"PATCH",{body:"Not my message"},bob.accessToken)).status,404);
    assert.equal((await call(`/chats/${id}/messages/${clientId}`,"DELETE",undefined,alice.accessToken)).status,204);
    assert.equal((await fetch(read.data.url)).status,404,"Deleted chat attachment stayed accessible to recipient");
    console.log("PASS: D1 private chat membership, idempotent delivery, edits, reactions, private read receipts, R2 recipient-only attachments and access revocation");
  }else{
  const photo=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfRcAAAAASUVORK5CYII=","base64");
  const mediaId=socialOnly?null:await upload(alice,photo);
  if(mediaId)assert.equal((await call(`/media/${mediaId}/url`,"GET",undefined,bob.accessToken)).status,404,"Unpublished media leaked");
  const created=await call("/posts","POST",{
    text:"A sunny day in Miami",mediaIds:mediaId?[mediaId]:[],place:{id:"osm:relation:121676",label:"Miami",source:"osm",lat:25.7743,lon:-80.1937},
  },alice.accessToken);
  assert.equal(created.status,201,JSON.stringify(created.data));const id=created.data.post.id;posts.push({id,account:alice});
  if(mediaId)assert.equal(created.data.post.media[0].reference,`oldtime-media:${mediaId}`);
  const feed=await call("/feed","GET",undefined,bob.accessToken);
  assert.equal(feed.status,200,JSON.stringify(feed.data));assert(feed.data.posts.some(p=>p.id===id));
  const place=await call("/places/feed?placeId=osm%3Arelation%3A121676","GET",undefined,bob.accessToken);
  assert.equal(place.status,200,JSON.stringify(place.data));assert(place.data.posts.some(p=>p.id===id));
  const discovery=await call("/places/discovery?q=Miami","GET",undefined,bob.accessToken);
  assert.equal(discovery.status,200,JSON.stringify(discovery.data));assert(discovery.data.places.some(p=>p.place.label==="Miami"));
  for(let n=0;n<2;n++){
    const like=await call(`/posts/${id}/like`,"PUT",{},bob.accessToken);
    assert.equal(like.status,200,JSON.stringify(like.data));assert.equal(like.data.likeCount,1);
  }
  const saved=await call("/account/state","PUT",{state:{savedPostIds:[id]}},bob.accessToken);
  assert.equal(saved.status,200,JSON.stringify(saved.data));
  const updated=await call(`/posts/${id}`,"GET",undefined,bob.accessToken);
  assert.equal(updated.data.post.saveCount,1);
  let link;
  if(mediaId){
  link=await call(`/media/${mediaId}/url`,"GET",undefined,bob.accessToken);
  assert.equal(link.status,200,JSON.stringify(link.data));
  const image=await fetch(link.data.url);assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),photo);
  const range=await fetch(link.data.url,{headers:{range:"bytes=0-7"}});
  assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),photo.subarray(0,8));
  const missingToken=await fetch(link.data.url.replace(/access=[^&]+/,"access=invalid"));assert.equal(missingToken.status,404);
  }
  const profile=await call(`/profiles/${alice.account.username}`,"GET",undefined,bob.accessToken);
  assert.equal(profile.status,200,JSON.stringify(profile.data));assert(profile.data.posts.some(p=>p.id===id));
  if(!socialOnly){
  await retryPlaceholderUpload(alice);
  const privateId=await upload(alice,Buffer.from("private-message-only"),"text/plain","message");
  assert.equal((await call(`/media/${privateId}/url`,"GET",undefined,bob.accessToken)).status,404,"Private attachment leaked");
  await upload(alice,Buffer.alloc(7*1024*1024,23),"video/mp4");
  }
  const comment=await call(`/posts/${id}/comments`,"POST",{body:"A real comment"},bob.accessToken);
  assert.equal(comment.status,200,JSON.stringify(comment.data));
  const reaction=await call(`/posts/${id}/comments/${comment.data.id}/reaction`,"PUT",{reaction:"like"},alice.accessToken);
  assert.equal(reaction.status,200,JSON.stringify(reaction.data));assert(reaction.data.likes.includes(alice.account.id));
  const notifications=await call("/notifications","GET",undefined,alice.accessToken);
  assert.equal(notifications.status,200,JSON.stringify(notifications.data));assert(notifications.data.notifications.some(n=>n.kind==="comment"));
  const privacy=await call("/account/privacy","PUT",{isPrivate:true},alice.accessToken);assert.equal(privacy.status,200);
  assert.equal((await call(`/posts/${id}`,"GET",undefined,bob.accessToken)).status,404);
  const follow=await call(`/relationships/follow/${alice.account.id}`,"POST",{},bob.accessToken);
  assert.equal(follow.status,200,JSON.stringify(follow.data));assert.equal(follow.data.requested,true);
  assert.equal((await call(`/relationships/follow-requests/${bob.account.id}/accept`,"POST",{},alice.accessToken)).status,204);
  assert.equal((await call(`/posts/${id}`,"GET",undefined,bob.accessToken)).status,200);
  assert.equal((await call(`/relationships/friend-requests/${alice.account.id}`,"POST",{},bob.accessToken)).status,200);
  assert.equal((await call(`/relationships/friend-requests/${bob.account.id}/accept`,"POST",{},alice.accessToken)).status,204);
  const close=await call("/close-friends","PUT",{memberIds:[bob.account.id]},alice.accessToken);
  assert.equal(close.status,200,JSON.stringify(close.data));assert.equal(close.data.profiles.length,1);
    const audienceEdit=await call(`/posts/${id}`,"PATCH",{
      text:"A sunny day in Miami, with a changed audience.",
      visibility:"close-friends",
      place:{id:"osm:relation:121676",label:"Miami",source:"osm",lat:25.7743,lon:-80.1937},
    },alice.accessToken);
    assert.equal(audienceEdit.status,200,JSON.stringify(audienceEdit.data));
    assert.equal(audienceEdit.data.post.visibility,"close-friends");
    assert.equal((await call(`/posts/${id}`,"GET",undefined,bob.accessToken)).status,200);
    assert.equal((await call(`/posts/${id}`,"PATCH",{text:"Not the owner",place:null,visibility:"public"},bob.accessToken)).status,403);
    const audienceRestore=await call(`/posts/${id}`,"PATCH",{
      text:"A sunny day in Miami, with a changed audience.",
      visibility:"public",
      place:{id:"osm:relation:121676",label:"Miami",source:"osm",lat:25.7743,lon:-80.1937},
    },alice.accessToken);
    assert.equal(audienceRestore.status,200,JSON.stringify(audienceRestore.data));
    assert.equal(audienceRestore.data.post.visibility,"public");
  const closePost=await call("/posts","POST",{text:"Close Friends only",visibility:"close-friends"},alice.accessToken);
  assert.equal(closePost.status,201,JSON.stringify(closePost.data));posts.push({id:closePost.data.post.id,account:alice});
  assert.equal((await call(`/posts/${closePost.data.post.id}`,"GET",undefined,bob.accessToken)).status,200);
  assert.equal((await call(`/posts/${closePost.data.post.id}`,"GET",undefined,charlie.accessToken)).status,404);
  const block=await call("/account/blocks","PUT",{userIds:[bob.account.id]},alice.accessToken);
  assert.equal(block.status,200,JSON.stringify(block.data));
  assert.equal((await call(`/posts/${id}`,"GET",undefined,bob.accessToken)).status,404);
  if(link)assert.equal((await fetch(link.data.url)).status,404,"Existing media link remained accessible after a block");
  const relationships=await call("/relationships","GET",undefined,alice.accessToken);
  assert.equal(relationships.status,200,JSON.stringify(relationships.data));
  assert.equal(relationships.data.friends.length,0);assert.equal(relationships.data.followers.length,0);
  console.log(socialOnly?"PASS: D1 feeds, posts, places, profiles, likes, saves, comments, notifications, private follow requests, Friends, Close Friends and blocks"
    :"PASS: D1 feeds/posts/places/profile, likes/saves/comments/notifications, private follow requests, Friends/Close Friends, block revocation, R2 multipart/checksum/ranges/media privacy");
  }
}finally{
  for(const socket of realtimeSockets){try{socket.terminate();}catch{}}
  try{
    for(const p of posts)await call(`/posts/${p.id}`,"DELETE",undefined,p.account.accessToken).catch(()=>{});
    for(const m of assets)await call(`/media/${m.id}`,"DELETE",undefined,m.account.accessToken).catch(()=>{});
    const testClientKey=createHash("sha256").update("192.0.2.44").digest("hex").slice(0,32);
    localSql(`INSERT INTO r2_deletion_queue(object_key,upload_id,queued_at)
      SELECT m.object_key,s.upload_id,${Date.now()} FROM user_media_assets m JOIN users u ON u.id=m.user_id
      LEFT JOIN media_upload_sessions s ON s.media_id=m.id WHERE u.email LIKE 'cf-smoke-%@example.invalid' ON CONFLICT DO NOTHING;
      DELETE FROM users WHERE email LIKE 'cf-smoke-%@example.invalid';
      DELETE FROM auth_rate_limits WHERE client_key='${testClientKey}';`);
    const cleanup=await fetch(`${workerOrigin}/cdn-cgi/handler/scheduled`);
    assert.equal(cleanup.status,200,"Local fixture cleanup failed");
  }catch(error){console.error("Local fixture cleanup failed:",error.message);process.exitCode=1;}
}
