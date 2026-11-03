import { createHash, randomBytes } from "node:crypto";
import {
  ApiError, body, bytes, json, rows, object, blocked, uuid, V, viewerCte, visiblePost,
  type Database, type MediaBucket, visibleStory,
} from "./runtime";
import { unusedMedia, drainMediaDeletions } from "./media-lifecycle";

const CHUNK=8*1024*1024, MAX_BYTES=200*1024*1024;
export const MAX_PUBLIC_FEED_VIDEO_BYTES=16*1024*1024;
const SHA256_PLACEHOLDER="0".repeat(64);
const types=new Set([
  "image/jpeg","image/png","image/webp","image/gif","image/avif",
  "video/mp4","video/webm","video/quicktime","audio/mp4","audio/webm","audio/ogg","audio/mpeg",
  "application/pdf","text/plain","text/csv","application/rtf","application/zip",
  "application/msword","application/vnd.ms-excel","application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
export interface MediaAsset {
  id:string;user_id:string;object_key:string;content_type:string;size:number;sha256:string;
  storage_scope:string;media_role:string;thumbnail_id:string|null;ready:number;created_at:number;
}
export interface MediaWaitUntilContext { waitUntil(task:Promise<unknown>):void }
interface MediaEdgeCache {
  match(request:Request):Promise<Response|null>;
  put(request:Request,response:Response):Promise<void>;
}
interface UploadSession {
  media_id:string;token_hash:string;upload_id:string;offset:number;parts:string;lease_until:number;expires_at:number;
}
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
const token=()=>randomBytes(32).toString("base64url");
const tusHeaders={"Tus-Resumable":"1.0.0","Tus-Version":"1.0.0","Tus-Extension":"creation,termination","Cache-Control":"no-store"};

export function mediaContentPath(id:string,readToken:string):string{
  const query=new URLSearchParams({access:readToken});
  return `/api/media/${encodeURIComponent(id)}/content?${query}`;
}

async function asset(db:Database,id:string){return db.prepare("SELECT * FROM user_media_assets WHERE id=?").bind(id).first<MediaAsset>();}

export async function canReadMedia(db:Database,userId:string,m:MediaAsset,depth=0):Promise<boolean>{
  if(m.user_id===userId)return true;
  if(!m.ready)return false;
  if(m.media_role==="thumbnail"){
    if(await blocked(db,userId,m.user_id))return false;
    if(depth>0)return false;
    const parent=await db.prepare("SELECT * FROM user_media_assets WHERE thumbnail_id=? AND ready=1 LIMIT 1").bind(m.id).first<MediaAsset>();
    return !!parent && canReadMedia(db,userId,parent,depth+1);
  }
  const reusableSound=await db.prepare(`${viewerCte} SELECT sound.owner_id FROM sound_library sound
    LEFT JOIN users owner ON owner.id=sound.owner_id
    WHERE sound.media_id=? AND sound.reuse_allowed=1 AND COALESCE(owner.is_private,0)=0
      AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
        (b.owner_id=${V} AND b.blocked_id=sound.owner_id) OR (b.blocked_id=${V} AND b.owner_id=sound.owner_id))
    LIMIT 1`).bind(userId,m.id).first<{owner_id:string|null}>();
  if(reusableSound && m.storage_scope==="public")return true;
  if(await blocked(db,userId,m.user_id))return false;
  const account=await db.prepare("SELECT data FROM account_state WHERE user_id=?").bind(m.user_id).first<{data:string}>();
  const profile=object(object(account?.data).profile), ref=`oldtime-media:${m.id}`;
  if(m.storage_scope==="public" && (profile.avatar===ref || profile.cover===ref))return true;
  const published=await db.prepare(`${viewerCte} SELECT 1 FROM post_media_assets pm
    JOIN posts p ON p.id=pm.post_id JOIN users u ON u.id=p.author_id
    WHERE pm.media_id=? AND ${visiblePost} LIMIT 1`).bind(userId,m.id).first();
  if(published && m.storage_scope==="public")return true;
  if(m.storage_scope==="public" && await db.prepare(`${viewerCte} SELECT 1 FROM stories s JOIN users u ON u.id=s.author_id
    WHERE s.media_path=? AND ${visibleStory} AND (s.saved_to_profile=1 OR s.expires_at>?) LIMIT 1`)
    .bind(userId,m.object_key,Date.now()).first())return true;
  const conversations=await rows<{conversation_id:string}>(db,`SELECT DISTINCT c.conversation_id FROM chat_message_media cm
    JOIN chat_messages c ON c.id=cm.message_id JOIN chat_members member ON member.conversation_id=c.conversation_id
    WHERE cm.media_id=? AND member.user_id=?`,m.id,userId);
  for(const c of conversations){
    const peers=await rows<{user_id:string}>(db,"SELECT user_id FROM chat_members WHERE conversation_id=? AND user_id<>?",c.conversation_id,userId);
    let denied=false;
    for(const peer of peers)if(await blocked(db,userId,peer.user_id)){denied=true;break;}
    if(!denied)return true;
  }
  return false;
}
async function reserve(request:Request,db:Database,bucket:MediaBucket,userId:string,id:string){
  const input=object(await body(request));
  const contentType=String(input.contentType ?? "").split(";")[0].toLowerCase(),size=Number(input.size),sha256=String(input.sha256 ?? "").toLowerCase();
  const scope=input.scope ?? "public",role=input.role ?? "media";
  if(!uuid.test(id)||!types.has(contentType)||!Number.isSafeInteger(size)||size<5||size>MAX_BYTES||
    !/^[a-f0-9]{64}$/.test(sha256)||!["public","message"].includes(String(scope))||
    !["media","thumbnail"].includes(String(role))||role==="thumbnail"&&!contentType.startsWith("image/")){
    throw new ApiError(400,"Choose a supported file up to 200 MB and try again.");
  }
  let existing=await asset(db,id);
  if(existing && (existing.user_id!==userId||existing.size!==size||existing.content_type!==contentType||
    existing.storage_scope!==scope||existing.media_role!==role)){
    throw new ApiError(409,"This media ID belongs to another file or account.");
  }
  if(existing && existing.sha256!==sha256){
    if(existing.ready||existing.sha256!==SHA256_PLACEHOLDER||sha256===SHA256_PLACEHOLDER){
      throw new ApiError(409,"This media ID belongs to another file or account.");
    }
    const previous=await db.prepare("SELECT * FROM media_upload_sessions WHERE media_id=?").bind(id).first<UploadSession>();
    if(previous&&Number(previous.lease_until)>Date.now())throw new ApiError(409,"An upload is already in progress. Please retry.");
    if(previous){
      await bucket.resumeMultipartUpload(existing.object_key,previous.upload_id).abort().catch(()=>{});
      await db.prepare("DELETE FROM media_upload_sessions WHERE media_id=?").bind(id).run();
    }
    await bucket.delete(existing.object_key);
    const updated=await db.prepare("UPDATE user_media_assets SET sha256=? WHERE id=? AND user_id=? AND ready=0 AND sha256=?")
      .bind(sha256,id,userId,SHA256_PLACEHOLDER).run();
    if(!updated.meta?.changes)throw new ApiError(409,"This media ID changed while the upload was restarting. Please try again.");
    existing.sha256=sha256;
  }
  if(existing?.ready)return json({id,contentType,size,ready:true,thumbnailId:existing.thumbnail_id});
  // A retired media ID must never reuse an object key: delayed cleanup of an
  // earlier upload must not remove a newer upload with the same client ID.
  const key=existing?.object_key ?? `${scope==="message"?"private-messages":"public-media"}/${userId}/${id}/${crypto.randomUUID()}`;
  if(!existing){
    await db.prepare(`INSERT INTO user_media_assets
      (id,user_id,object_key,content_type,size,sha256,storage_scope,media_role,ready,created_at)
      VALUES(?,?,?,?,?,?,?,?,0,?) ON CONFLICT DO NOTHING`).bind(id,userId,key,contentType,size,sha256,scope,role,Date.now()).run();
    existing=await asset(db,id);
    if(!existing||existing.user_id!==userId||existing.sha256!==sha256)throw new ApiError(409,"This media ID is in use.");
  }
  const uploaded=await bucket.head(key);
  if(uploaded){
    if(uploaded.size!==size || uploaded.httpMetadata?.contentType!==contentType)throw new ApiError(409,"The uploaded object does not match this file.");
    return json({id,contentType,size,ready:false,uploaded:true,thumbnailId:existing.thumbnail_id});
  }
  let session=await db.prepare("SELECT * FROM media_upload_sessions WHERE media_id=?").bind(id).first<UploadSession>();
  if(session && session.expires_at<=Date.now()){
    await bucket.resumeMultipartUpload(key,session.upload_id).abort().catch(()=>{});
    await db.prepare("DELETE FROM media_upload_sessions WHERE media_id=?").bind(id).run();
    session=null;
  }
  const uploadToken=token();
  if(!session){
    const upload=await bucket.createMultipartUpload(key,{httpMetadata:{contentType}});
    try{
      await db.prepare(`INSERT INTO media_upload_sessions(media_id,token_hash,upload_id,expires_at)
        VALUES(?,?,?,?)`).bind(id,hash(uploadToken),upload.uploadId,Date.now()+86400000).run();
    }catch(error){await upload.abort().catch(()=>{});throw error;}
  }else{
    if(session.lease_until>Date.now())throw new ApiError(409,"An upload is already in progress. Please retry.");
    await db.prepare("UPDATE media_upload_sessions SET token_hash=?,expires_at=? WHERE media_id=? AND lease_until<=?")
      .bind(hash(uploadToken),Date.now()+86400000,id,Date.now()).run();
  }
  return json({id,contentType,size,ready:false,uploaded:false,thumbnailId:existing.thumbnail_id,
    endpoint:`/api/media/uploads/${id}`,token:uploadToken,bucketName:"oldtime-media",objectName:key},201);
}
export async function tusRequest(request:Request,db:Database,bucket:MediaBucket,path:string):Promise<Response>{
  const match=/^\/media\/uploads\/([a-f0-9-]{36})(\/data)?$/.exec(path);
  if(!match)throw new ApiError(404,"Upload not found.");
  const id=match[1];
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:tusHeaders});
  const signature=request.headers.get("x-signature") ?? "";
  const session=await db.prepare(`SELECT * FROM media_upload_sessions WHERE media_id=? AND token_hash=? AND expires_at>?`)
    .bind(id,hash(signature),Date.now()).first<UploadSession>();
  const m=await asset(db,id);
  if(!session||!m)throw new ApiError(401,"Upload authorization expired. Start the upload again.");
  if(request.method==="POST" && !match[2]){
    const length=Number(request.headers.get("upload-length"));
    if(length!==m.size)throw new ApiError(409,"Upload size does not match the reserved file.");
    return new Response(null,{status:201,headers:{...tusHeaders,Location:`/api/media/uploads/${id}/data`,"Upload-Offset":String(session.offset)}});
  }
  if(request.method==="HEAD"){
    const complete=session.offset<m.size ? await bucket.head(m.object_key) : null;
    const offset=complete?.size===m.size ? m.size : session.offset;
    if(offset!==session.offset)await db.prepare("UPDATE media_upload_sessions SET offset=?,lease_until=0 WHERE media_id=? AND token_hash=?")
      .bind(offset,id,hash(signature)).run();
    return new Response(null,{status:200,headers:{...tusHeaders,"Upload-Offset":String(offset),"Upload-Length":String(m.size)}});
  }
  if(request.method==="DELETE"){
    if(session.lease_until>Date.now())throw new ApiError(409,"Upload is busy. Try again.");
    await bucket.resumeMultipartUpload(m.object_key,session.upload_id).abort();
    await db.prepare("DELETE FROM media_upload_sessions WHERE media_id=?").bind(id).run();
    return new Response(null,{status:204,headers:tusHeaders});
  }
  if(request.method!=="PATCH"||!match[2])throw new ApiError(405,"Method not allowed.");
  const offset=Number(request.headers.get("upload-offset"));
  if(!Number.isSafeInteger(offset)||offset!==session.offset)throw new ApiError(409,"Upload offset changed. Resume the upload.");
  const now=Date.now();
  const lock=await db.prepare(`UPDATE media_upload_sessions SET lease_until=? WHERE media_id=? AND token_hash=? AND offset=? AND lease_until<=? RETURNING media_id`)
    .bind(now+120000,id,hash(signature),offset,now).first();
  if(!lock)throw new ApiError(409,"Upload is busy. Retry this chunk.");
  try{
    const chunk=await bytes(request,CHUNK);
    if(!chunk.length||offset+chunk.length>m.size||offset+chunk.length<m.size&&chunk.length<5*1024*1024)throw new ApiError(400,"Invalid upload chunk size.");
    const parts=JSON.parse(session.parts) as {partNumber:number;etag:string}[];
    const upload=bucket.resumeMultipartUpload(m.object_key,session.upload_id);
    const part=await upload.uploadPart(parts.length+1,chunk);
    parts.push(part);
    if(offset+chunk.length===m.size)await upload.complete(parts);
    await db.prepare(`UPDATE media_upload_sessions SET offset=?,parts=?,lease_until=0 WHERE media_id=? AND token_hash=? AND offset=?`)
      .bind(offset+chunk.length,JSON.stringify(parts),id,hash(signature),offset).run();
    return new Response(null,{status:204,headers:{...tusHeaders,"Upload-Offset":String(offset+chunk.length)}});
  }catch(error){
    await db.prepare("UPDATE media_upload_sessions SET lease_until=0 WHERE media_id=? AND token_hash=?").bind(id,hash(signature)).run();
    throw error;
  }
}
async function confirm(request:Request,db:Database,bucket:MediaBucket,userId:string,id:string){
  const input=object(await body(request)),m=await asset(db,id);
  if(!m||m.user_id!==userId)throw new ApiError(404,"Upload not found.");
  const expectedSha=String(input.sha256??"").toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(expectedSha))throw new ApiError(400,"The media checksum is invalid.");
  if(m.ready){
    if(expectedSha!==m.sha256)throw new ApiError(409,"The uploaded media did not match the original file.");
    return json({id,contentType:m.content_type,size:m.size,ready:true});
  }
  if(m.sha256!==SHA256_PLACEHOLDER&&expectedSha!==m.sha256){
    throw new ApiError(409,"The uploaded media did not match the original file.");
  }
  const now=Date.now(),lease=now+120000;
  const locked=await db.prepare(`INSERT INTO media_upload_sessions(media_id,token_hash,upload_id,offset,parts,lease_until,expires_at)
    SELECT ?,?,'',?,'[]',?,? WHERE EXISTS(SELECT 1 FROM user_media_assets WHERE id=? AND user_id=? AND ready=0)
    ON CONFLICT(media_id) DO UPDATE SET lease_until=excluded.lease_until
    WHERE media_upload_sessions.lease_until<=? RETURNING media_id`)
    .bind(id,hash(crypto.randomUUID()),m.size,lease,lease,id,userId,now).first();
  if(!locked)throw new ApiError(409,"This upload is busy or expired. Try again.");
  try{
    const stored=await bucket.get(m.object_key);
    if(!stored||stored.size!==m.size||stored.httpMetadata?.contentType!==m.content_type){
      await stored?.body.cancel();
      throw new ApiError(409,"Cloudflare has not confirmed the complete upload yet.");
    }
    const digest=createHash("sha256"),reader=stored.body.getReader();
    let length=0;
    try{for(;;){const c=await reader.read();if(c.done)break;length+=c.value.length;digest.update(c.value);}}finally{reader.releaseLock();}
    if(length!==m.size||digest.digest("hex")!==expectedSha)throw new ApiError(409,"The uploaded media did not match the original file. Please retry.");
    const finalized=await db.batch([
      db.prepare("UPDATE user_media_assets SET ready=1,sha256=? WHERE id=? AND user_id=? AND ready=0 AND sha256=?")
        .bind(expectedSha,id,userId,m.sha256),
      db.prepare("DELETE FROM media_upload_sessions WHERE media_id=?").bind(id),
    ]);
    if(!finalized[0].meta?.changes)throw new ApiError(409,"This upload expired. Start the upload again.");
    return json({id,contentType:m.content_type,size:m.size,ready:true});
  }finally{
    await db.prepare("UPDATE media_upload_sessions SET lease_until=0 WHERE media_id=? AND lease_until=?").bind(id,lease).run();
  }
}
async function serve(request:Request,db:Database,bucket:MediaBucket,m:MediaAsset,expiry:number){
  const headers:Record<string,string>={
    "Content-Type":m.content_type,"Accept-Ranges":"bytes","X-Content-Type-Options":"nosniff",
    "Cache-Control":"private, no-store",
    "Content-Disposition":m.content_type.startsWith("image/")||m.content_type.startsWith("video/")||m.content_type.startsWith("audio/")?"inline":`attachment; filename="${m.id}"`,
    "Referrer-Policy":"no-referrer",
  };
  let start=0,end=m.size-1,status=200;
  const requested=request.headers.get("range");
  if(requested){
    const r=/^bytes=(\d*)-(\d*)$/.exec(requested);
    if(!r||(!r[1]&&!r[2]))return new Response(null,{status:416,headers:{"Content-Range":`bytes */${m.size}`}});
    start=r[1]?Number(r[1]):Math.max(0,m.size-Number(r[2]));
    end=r[1]&&r[2]?Math.min(Number(r[2]),m.size-1):m.size-1;
    if(start>end||start>=m.size||!Number.isSafeInteger(start)||!Number.isSafeInteger(end))return new Response(null,{status:416,headers:{"Content-Range":`bytes */${m.size}`}});
    status=206;headers["Content-Range"]=`bytes ${start}-${end}/${m.size}`;
  }
  headers["Content-Length"]=String(end-start+1);
  if(request.method==="HEAD")return new Response(null,{status,headers});
  const data=await bucket.get(m.object_key,status===206?{range:{offset:start,length:end-start+1}}:undefined);
  if(!data)throw new ApiError(404,"Media object not found.");
  headers.ETag=data.httpEtag;
  return new Response(data.body,{status,headers});
}
export function isPublicFeedVideoCacheEligible(
  media:Pick<MediaAsset,"storage_scope"|"media_role"|"content_type"|"size">,
  method:string,
  hasRange:boolean,
  hasPublicFeedPost:boolean,
){
  return method==="GET"&&!hasRange&&hasPublicFeedPost&&media.storage_scope==="public"&&
    media.media_role==="media"&&media.content_type.startsWith("video/")&&
    Number.isSafeInteger(media.size)&&media.size>0&&media.size<=MAX_PUBLIC_FEED_VIDEO_BYTES;
}
async function hasPublicFeedPost(db:Database,mediaId:string){
  return !!await db.prepare(`SELECT 1 FROM post_media_assets pm
    JOIN posts p ON p.id=pm.post_id JOIN users u ON u.id=p.author_id
    WHERE pm.media_id=? AND p.archived_at IS NULL AND p.destination IN ('main','both')
      AND p.visibility='public' AND u.is_private=0 AND u.is_virtual=0 LIMIT 1`)
    .bind(mediaId).first();
}
export async function tokenRead(
  request:Request,db:Database,bucket:MediaBucket,path:string,context?:MediaWaitUntilContext,
):Promise<Response>{
  const id=path.split("/")[2],access=new URL(request.url).searchParams.get("access") ?? "";
  const grant=await db.prepare("SELECT viewer_id,expires_at FROM media_read_tokens WHERE token_hash=? AND media_id=? AND expires_at>?")
    .bind(hash(access),id,Date.now()).first<{viewer_id:string;expires_at:number}>();
  const m=await asset(db,id);
  if(!grant||!m||!await canReadMedia(db,grant.viewer_id,m))throw new ApiError(404,"This media is not accessible to this account.");
  const cacheCandidate=isPublicFeedVideoCacheEligible(m,request.method,!!request.headers.get("range"),true);
  const publicPost=cacheCandidate&&await hasPublicFeedPost(db,m.id);
  const edgeCache=(globalThis as typeof globalThis&{caches?:{default:MediaEdgeCache}}).caches?.default;
  const cacheKey=new Request(`${new URL(request.url).origin}/__oldtime-public-media/${encodeURIComponent(m.id)}-${encodeURIComponent(m.sha256)}`);
  if(publicPost&&edgeCache){
    let cached:Response|null=null;
    try{cached=await edgeCache.match(cacheKey);}catch{}
    if(cached){
      const headers=new Headers(cached.headers);
      headers.set("Cache-Control","private, no-store");
      headers.set("Referrer-Policy","no-referrer");
      return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers});
    }
  }
  const response=await serve(request,db,bucket,m,grant.expires_at);
  if(publicPost&&edgeCache&&context&&response.status===200){
    const headers=new Headers(response.headers);
    headers.set("Cache-Control","public, max-age=86400, immutable");
    const fill=edgeCache.put(cacheKey,new Response(response.clone().body,{status:200,headers}));
    try{context.waitUntil(fill.catch(()=>undefined));}catch{void fill.catch(()=>undefined);}
  }
  return response;
}
export async function mediaRequest(request:Request,db:Database,bucket:MediaBucket,userId:string,path:string):Promise<Response>{
  if(path==="/media/admin/usage"&&request.method==="GET"){
    await requireMediaAdmin(db,userId);
    const [usage,queue,failedJobs,largeAssets,recentRuns]=await Promise.all([
      db.prepare(`SELECT
        sum(CASE WHEN ready=1 THEN 1 ELSE 0 END) AS tracked_assets,
        sum(CASE WHEN ready=1 THEN size ELSE 0 END) AS tracked_bytes,
        sum(CASE WHEN ready=0 THEN 1 ELSE 0 END) AS pending_uploads,
        sum(CASE WHEN created_at>=? THEN 1 ELSE 0 END) AS new_assets_24h
        FROM user_media_assets`).bind(Date.now()-86400000).first<{
          tracked_assets:number|null;tracked_bytes:number|null;pending_uploads:number|null;new_assets_24h:number|null;
        }>(),
      db.prepare(`SELECT count(*) AS queued_deletions,coalesce(sum(size_bytes),0) AS queued_bytes,
        sum(CASE WHEN attempt_count>0 THEN 1 ELSE 0 END) AS failed_deletions,
        min(queued_at) AS oldest_queued_at,min(next_attempt_at) AS next_retry_at
        FROM r2_deletion_queue`).first<{
          queued_deletions:number;queued_bytes:number;failed_deletions:number|null;oldest_queued_at:number|null;next_retry_at:number|null;
        }>(),
      rows<{object_key:string;size_bytes:number;attempt_count:number;queued_at:number;next_attempt_at:number;last_error:string|null}>(db,
        `SELECT object_key,size_bytes,attempt_count,queued_at,next_attempt_at,last_error FROM r2_deletion_queue
          WHERE attempt_count>0 ORDER BY next_attempt_at LIMIT 20`),
      rows<{id:string;size:number;content_type:string;ready:number;created_at:number}>(db,`SELECT id,size,content_type,ready,created_at
        FROM user_media_assets WHERE size>=? ORDER BY size DESC LIMIT 20`,50*1024*1024),
      rows(db,`SELECT scheduled_at,expired_stories,expired_media_assets,deleted_objects,deleted_bytes,failed_deletions,
        tracked_assets,tracked_bytes,new_assets_24h,pending_uploads,queued_deletions
        FROM media_cleanup_runs ORDER BY scheduled_at DESC LIMIT 30`),
    ]);
    return json({
      scope:"D1-tracked media only; R2 objects without metadata require the separate paginated scan.",
      trackedAssets:usage?.tracked_assets??0,trackedBytes:usage?.tracked_bytes??0,
      pendingUploads:usage?.pending_uploads??0,newAssets24h:usage?.new_assets_24h??0,
      deletionQueue:queue,failedJobs,largeAssets:largeAssets.map(asset=>({...asset,large:true})),recentCleanupRuns:recentRuns,
    });
  }
  if(path==="/media/admin/orphans"&&request.method==="GET"){
    await requireMediaAdmin(db,userId);
    const params=new URL(request.url).searchParams;
    const cursor=params.get("cursor")||undefined,prefix=params.get("prefix")||undefined;
    if(cursor&&cursor.length>1024)throw new ApiError(400,"R2 scan cursor is invalid.");
    if(prefix&&prefix.length>512)throw new ApiError(400,"R2 scan prefix is invalid.");
    const page=await bucket.list({limit:100,...(cursor?{cursor}:{}),...(prefix?{prefix}:{})});
    const keys=page.objects.map(item=>item.key);
    const known=keys.length?await rows<{object_key:string}>(db,`SELECT object_key FROM user_media_assets
      WHERE object_key IN (SELECT value FROM json_each(?))
      UNION SELECT object_key FROM r2_deletion_queue
      WHERE object_key IN (SELECT value FROM json_each(?))
      UNION SELECT media_path AS object_key FROM stories
      WHERE media_path IN (SELECT value FROM json_each(?))
      UNION SELECT object_path AS object_key FROM creator_media_assets
      WHERE object_path IN (SELECT value FROM json_each(?))`,
        JSON.stringify(keys),JSON.stringify(keys),JSON.stringify(keys),JSON.stringify(keys)): [];
    const knownKeys=new Set(known.map(row=>row.object_key));
    return json({
      limit:100,truncated:page.truncated,cursor:page.truncated?page.cursor??null:null,
      scanned:page.objects.length,
      unreferencedCandidates:page.objects.filter(item=>!knownKeys.has(item.key)).map(item=>({
        key:item.key,size:item.size,uploaded:item.uploaded instanceof Date?item.uploaded.toISOString():item.uploaded??null,
      })),
      note:"Read-only scan. Candidate objects are never deleted automatically.",
    });
  }
  const match=/^\/media\/([a-f0-9-]{36})(?:\/(upload|confirm|thumbnail|url))?$/.exec(path);
  if(!match)throw new ApiError(404,"Media not found.");
  const [,id,action]=match;
  if(action==="upload"&&request.method==="POST")return reserve(request,db,bucket,userId,id);
  if(action==="confirm"&&request.method==="POST")return confirm(request,db,bucket,userId,id);
  const m=await asset(db,id);
  if(!m)throw new ApiError(404,"Media not found.");
  if(action==="thumbnail"&&request.method==="PUT"){
    const input=object(await body(request)),thumb=typeof input.thumbnailId==="string"?await asset(db,input.thumbnailId):null;
    if(m.user_id!==userId||!m.ready||!m.content_type.startsWith("video/")||!thumb||thumb.user_id!==userId||
      !thumb.ready||!thumb.content_type.startsWith("image/")||thumb.media_role!=="thumbnail"||thumb.storage_scope!==m.storage_scope)throw new ApiError(400,"Choose a confirmed video thumbnail from your account.");
    await db.prepare("UPDATE user_media_assets SET thumbnail_id=? WHERE id=? AND user_id=?").bind(thumb.id,id,userId).run();
    return json({id,thumbnailId:thumb.id});
  }
  if(action==="url"&&request.method==="GET"){
    if(!m.ready||!await canReadMedia(db,userId,m))throw new ApiError(404,"This media is not accessible to this account.");
    const readToken=token(),expires=Date.now()+300000;
    await db.prepare("INSERT INTO media_read_tokens(token_hash,media_id,viewer_id,expires_at) VALUES(?,?,?,?)").bind(hash(readToken),id,userId,expires).run();
    return json({url:mediaContentPath(id,readToken),contentType:m.content_type,size:m.size,thumbnailId:m.thumbnail_id});
  }
  if(!action && (request.method==="GET"||request.method==="HEAD")){
    if(!m.ready||!await canReadMedia(db,userId,m))throw new ApiError(404,"This media is not accessible to this account.");
    return serve(request,db,bucket,m,Date.now()+300000);
  }
  if(!action&&request.method==="DELETE"){
    if(m.user_id!==userId)throw new ApiError(404,"Media not found.");
    const result=await db.batch([
      db.prepare(`INSERT INTO r2_deletion_queue(object_key,upload_id,size_bytes,queued_at)
        SELECT m.object_key,(SELECT upload_id FROM media_upload_sessions s WHERE s.media_id=m.id),m.size,?
        FROM user_media_assets m WHERE m.id=? AND m.user_id=? AND ${unusedMedia}
        ON CONFLICT(object_key) DO UPDATE SET size_bytes=max(r2_deletion_queue.size_bytes,excluded.size_bytes)`).bind(Date.now(),id,userId),
      db.prepare(`DELETE FROM user_media_assets WHERE id IN (
        SELECT m.id FROM user_media_assets m WHERE m.id=? AND m.user_id=? AND ${unusedMedia}) RETURNING id`).bind(id,userId),
    ]);
    if(!result[1].results?.length)throw new ApiError(409,"Remove this media from its published content or drafts before deleting it.");
    // The metadata/grants are already gone. An R2 outage must leave a retryable
    // cleanup job, not an inaccessible object that is stored forever.
    await drainMediaDeletions(db,bucket,[m.object_key]).catch(()=>{});
    return json({ok:true});
  }
  throw new ApiError(405,"Method not allowed.");
}

async function requireMediaAdmin(db:Database,userId:string){
  const user=await db.prepare("SELECT is_admin FROM creator_program_accounts WHERE user_id=?").bind(userId).first<{is_admin:number}>();
  if(!user?.is_admin)throw new ApiError(403,"Administrator access is required.");
}
