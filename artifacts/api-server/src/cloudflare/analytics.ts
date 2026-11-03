import { RegisterOwnAnalyticsContentBody, StartAnalyticsViewBody, UpdateAnalyticsPlaybackBody, RecordAnalyticsActivityBody } from "@workspace/api-zod";
import { ApiError, body, json, uuid, type Database } from "./runtime";
import { analyticsReportRequest } from "./analytics-reports";
import { recordPostTopicSignals } from "./topic-signals";
interface Resource {id:string;owner_id:string;source_id:string;kind:string;is_public:number;duration_ms:number|null;published_at:number;deleted_at:number|null}
const sqlUuid=`lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-a'||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))`;
export async function mirrorPostResources(db:Database,owner:string,sourceId?:string){
  await db.prepare(`INSERT INTO analytics_resources(id,owner_id,source_id,kind,title,is_public,published_at)
    SELECT ${sqlUuid},p.author_id,p.id,
      CASE WHEN EXISTS(SELECT 1 FROM post_media_assets pm JOIN user_media_assets m ON m.id=pm.media_id WHERE pm.post_id=p.id AND m.content_type LIKE 'video/%') THEN 'video'
        WHEN EXISTS(SELECT 1 FROM post_media_assets pm WHERE pm.post_id=p.id) THEN 'photo' ELSE 'text' END,
      substr(p.text,1,100),p.visibility='public' AND u.is_private=0,p.created_at
    FROM posts p JOIN users u ON u.id=p.author_id WHERE p.author_id=? ${sourceId?"AND p.id=?":""}
    ON CONFLICT(owner_id,source_id) DO NOTHING`).bind(owner,...(sourceId?[sourceId]:[])).run();
}
async function resource(db:Database,owner:string,sourceId:string,actor:string){
  await mirrorPostResources(db,owner,sourceId);
  return db.prepare(`SELECT r.* FROM analytics_resources r JOIN users u ON u.id=r.owner_id
    WHERE r.owner_id=? AND r.source_id=? AND r.deleted_at IS NULL AND r.is_public=1 AND u.is_private=0
      AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=? AND b.blocked_id=u.id) OR (b.owner_id=u.id AND b.blocked_id=?))
      AND NOT EXISTS(SELECT 1 FROM posts p WHERE p.id=r.source_id AND (p.author_id<>r.owner_id OR p.visibility<>'public'))
      AND NOT EXISTS(SELECT 1 FROM stories s WHERE s.id=r.source_id AND (s.author_id<>r.owner_id OR s.visibility<>'public' OR s.expires_at<=? OR s.media_ready=0))
      AND (r.kind<>'story' OR r.published_at>?)`).bind(owner,sourceId,actor,actor,Date.now(),Date.now()-86400000).first<Resource>();
}
function eventStatements(db:Database,input:{owner:string;actor:string;resource?:string|null;kind:string;source:string;dedup:string;condition?:string;params?:unknown[]}){
  const id=crypto.randomUUID(),now=Date.now(),day=new Date(now).toISOString().slice(0,10);
  return {id,statements:[
    db.prepare(`INSERT INTO analytics_events(id,owner_id,actor_id,resource_id,kind,source,dedup_key,value,created_at)
      SELECT ?,?,?,?,?,?,?,1,? WHERE ?<>?
      AND NOT EXISTS(SELECT 1 FROM users virtual_actor WHERE virtual_actor.id=? AND virtual_actor.is_virtual=1)
      ${input.condition?`AND (${input.condition})`:""} ON CONFLICT DO NOTHING RETURNING id`)
      .bind(id,input.owner,input.actor,input.resource??null,input.kind,input.source,input.dedup,now,input.owner,input.actor,input.actor,...(input.params??[])),
    db.prepare(`INSERT INTO analytics_daily(owner_id,day,kind,value)
      SELECT ?,?,?,1 WHERE EXISTS(SELECT 1 FROM analytics_events WHERE id=?)
      ON CONFLICT(owner_id,day,kind) DO UPDATE SET value=analytics_daily.value+1`).bind(input.owner,day,input.kind,id),
  ]};
}
export async function analyticsRequest(request:Request,db:Database,actor:string,path:string):Promise<Response>{
  if(path==="/analytics/me"||path.startsWith("/analytics/content/"))return analyticsReportRequest(request,db,actor,path);
  if(path==="/analytics/resources"&&request.method==="POST"){
    const parsed=RegisterOwnAnalyticsContentBody.strict().safeParse(await body(request));
    if(!parsed.success||parsed.data.publishedAt<0||parsed.data.publishedAt>Date.now()+300000)throw new ApiError(400,"Invalid content registration.");
    const i=parsed.data,id=crypto.randomUUID();
    const result=await db.prepare(`INSERT INTO analytics_resources(id,owner_id,source_id,kind,title,is_public,duration_ms,published_at)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,source_id) DO UPDATE SET title=excluded.title,is_public=excluded.is_public,duration_ms=excluded.duration_ms
      WHERE analytics_resources.deleted_at IS NULL RETURNING id`)
      .bind(id,actor,i.sourceId,i.kind,i.title,Number(i.isPublic),i.durationMs,i.publishedAt).first<{id:string}>();
    return json({id:result?.id??null});
  }
  if(path.startsWith("/analytics/resources/")&&request.method==="DELETE"){
    const sourceId=decodeURIComponent(path.slice("/analytics/resources/".length));
    if(!sourceId||sourceId.length>256)throw new ApiError(400,"Invalid content ID.");
    await db.prepare("UPDATE analytics_resources SET deleted_at=?,is_public=0 WHERE owner_id=? AND source_id=?").bind(Date.now(),actor,sourceId).run();
    return json({deleted:true});
  }
  if(path==="/analytics/sessions"&&request.method==="POST"){
    const parsed=StartAnalyticsViewBody.strict().safeParse(await body(request));
    if(!parsed.success)throw new ApiError(400,"Invalid playback request.");
    const i=parsed.data;
    if(actor===i.ownerId)return json({id:null});
    const r=await resource(db,i.ownerId,i.sourceId,actor);
    if(!r)throw new ApiError(404,"Content is not available for shared analytics.");
    const session=await db.prepare(`INSERT INTO analytics_sessions(id,resource_id,actor_id,nonce,source) VALUES(?,?,?,?,?)
      ON CONFLICT(actor_id,nonce) DO UPDATE SET nonce=excluded.nonce WHERE analytics_sessions.resource_id=excluded.resource_id RETURNING id`)
      .bind(crypto.randomUUID(),r.id,actor,i.nonce,i.source).first<{id:string}>();
    if(!session)throw new ApiError(409,"This view nonce belongs to another item.");
    return json({id:session.id});
  }
  if(path.startsWith("/analytics/sessions/")&&request.method==="PUT"){
    const id=path.slice("/analytics/sessions/".length),parsed=UpdateAnalyticsPlaybackBody.strict().safeParse(await body(request));
    if(!uuid.test(id)||!parsed.success)throw new ApiError(400,"Invalid playback progress.");
    const s=await db.prepare(`SELECT s.*,r.owner_id,r.source_id,r.kind,r.duration_ms,r.published_at
      FROM analytics_sessions s JOIN analytics_resources r ON r.id=s.resource_id WHERE s.id=? AND s.actor_id=?`)
      .bind(id,actor).first<{resource_id:string;owner_id:string;source_id:string;kind:string;duration_ms:number|null;published_at:number;started_at:number;visible_ms:number;watched_ms:number;qualified:number;completed:number;source:string}>();
    if(!s||!await resource(db,s.owner_id,s.source_id,actor))throw new ApiError(404,"Playback session is not available.");
    const elapsed=Math.max(0,Math.min(600000,Date.now()-s.started_at+300));
    const visible=Math.max(s.visible_ms,Math.min(parsed.data.visibleMs,elapsed)),watched=Math.max(s.watched_ms,Math.min(parsed.data.watchedMs,visible));
    const video=s.kind==="video"||s.duration_ms!==null||watched>0,threshold=video?Math.min(3000,s.duration_ms||3000):2000;
    const complete=video&&Number(s.duration_ms)>0&&parsed.data.ended&&watched>=Number(s.duration_ms)*.95;
    const qualified=video?(watched>=threshold||Number(s.duration_ms)<=3000&&complete):visible>=threshold;
    const event=eventStatements(db,{owner:s.owner_id,actor,resource:s.resource_id,kind:"view",source:s.source,
      dedup:`view:${s.resource_id}:${s.kind==="story"?"story":Math.floor(s.started_at/1800000)}`});
    await db.batch([
      ...(qualified?event.statements:[]),
      db.prepare(`UPDATE analytics_sessions SET visible_ms=max(visible_ms,?),watched_ms=max(watched_ms,?),progress=max(progress,?),
        qualified=max(qualified,?),completed=max(completed,?) WHERE id=? AND actor_id=?`)
        .bind(visible,watched,video&&s.duration_ms?Math.min(1,watched/s.duration_ms):0,Number(qualified),Number(complete),id,actor),
    ]);
    if(qualified&&!s.qualified&&s.kind!=="story")await recordPostTopicSignals(db,actor,s.source_id,video?"watch":"visit")
      .catch(error=>console.warn("Topic activity could not be updated",error));
    const result=await db.prepare("SELECT qualified FROM analytics_sessions WHERE id=? AND actor_id=?").bind(id,actor).first<{qualified:number}>();
    return json({qualified:!!result?.qualified});
  }
  if(path==="/analytics/events"&&request.method==="POST"){
    const parsed=RecordAnalyticsActivityBody.strict().safeParse(await body(request));
    if(!parsed.success)throw new ApiError(400,"Unsupported activity. Clients cannot submit financial events.");
    const i=parsed.data;
    if(actor===i.ownerId)return json({recorded:false});
    const owner=await db.prepare(`SELECT id FROM users u WHERE id=? AND NOT EXISTS(SELECT 1 FROM account_blocks b
      WHERE (b.owner_id=u.id AND b.blocked_id=?) OR (b.owner_id=? AND b.blocked_id=u.id))`).bind(i.ownerId,actor,actor).first();
    if(!owner)throw new ApiError(404,"Account not found.");
    const r=i.sourceId?await resource(db,i.ownerId,i.sourceId,actor):null;
    if(!["profile_visit","follow","unfollow"].includes(i.kind)&&!r)throw new ApiError(404,"Content is not available for shared analytics.");
    const follow=i.kind==="follow",unfollow=i.kind==="unfollow";
    let proof:string|undefined,proofParams:unknown[]=[];
    if(i.kind==="like"||i.kind==="save"){
      const table=i.kind==="like"?"post_likes":"post_saves";
      proof=`EXISTS(SELECT 1 FROM ${table} a JOIN posts p ON p.id=a.post_id WHERE a.user_id=? AND p.id=? AND p.author_id=?)`;
      proofParams=[actor,r?.source_id??"",i.ownerId];
    }else if(i.kind==="comment"){
      proof="EXISTS(SELECT 1 FROM post_comments c JOIN posts p ON p.id=c.post_id WHERE c.user_id=? AND p.id=? AND p.author_id=? AND c.created_at>=?)";
      proofParams=[actor,r?.source_id??"",i.ownerId,Date.parse(new Date().toISOString().slice(0,10))];
    }
    const bucket=i.kind==="profile_visit"?Math.floor(Date.now()/1800000):new Date().toISOString().slice(0,10);
    const event=eventStatements(db,{owner:i.ownerId,actor,resource:r?.id,kind:i.kind,source:i.source,
      dedup:follow||unfollow?`event:${i.nonce}`:`${i.kind}:${r?.id??"profile"}:${bucket}`,
      condition:follow?`NOT EXISTS(SELECT 1 FROM analytics_follows WHERE owner_id=? AND actor_id=?) AND EXISTS(SELECT 1 FROM user_follows WHERE followed_id=? AND follower_id=?)`:
        unfollow?`EXISTS(SELECT 1 FROM analytics_follows WHERE owner_id=? AND actor_id=?) AND NOT EXISTS(SELECT 1 FROM user_follows WHERE followed_id=? AND follower_id=?)`:proof,
      params:follow||unfollow?[i.ownerId,actor,i.ownerId,actor]:proofParams,
    });
    const results=await db.batch([
      ...event.statements,
      ...(follow?[db.prepare(`INSERT INTO analytics_follows(owner_id,actor_id)
        SELECT ?,? WHERE EXISTS(SELECT 1 FROM analytics_events WHERE id=?) ON CONFLICT DO NOTHING`).bind(i.ownerId,actor,event.id)]:
        unfollow?[db.prepare("DELETE FROM analytics_follows WHERE owner_id=? AND actor_id=? AND EXISTS(SELECT 1 FROM analytics_events WHERE id=?)").bind(i.ownerId,actor,event.id)]:[]),
    ]);
    const recorded=!!results[0].results?.length;
    if(recorded&&r&&["like","save","share"].includes(i.kind))await recordPostTopicSignals(db,actor,r.source_id,i.kind as "like"|"save"|"share")
      .catch(error=>console.warn("Topic activity could not be updated",error));
    return json({recorded});
  }
  throw new ApiError(404,"Analytics endpoint not found.");
}
