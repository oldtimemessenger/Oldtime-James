import { createHash } from "node:crypto";
import { SyncCreatorOriginalBody } from "@workspace/api-zod";
import { ApiError, body, json, rows, uuid, type Database } from "./runtime";
import { meaningful, textFingerprint } from "./content-fingerprint";
interface Original {id:string;original:number;deleted_at:number|null}
export async function requireCreator(db:Database,userId:string){
  const user=await db.prepare("SELECT account_type FROM users WHERE id=?").bind(userId).first<{account_type:string}>();
  if(user?.account_type!=="creator")throw new ApiError(403,"Creator tools require a Creator account. Switch account type in Settings; switching is free and preserves your account.");
}
export async function creatorOriginalRequest(request:Request,db:Database,userId:string,path:string):Promise<Response>{
  if(path==="/creator/content"&&request.method==="GET"){
    const content=await rows<{id:string;sourceId:string;original:number}>(db,`SELECT id,source_id AS sourceId,original
      FROM creator_original_content WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10000`,userId);
    return json({content:content.map(c=>({...c,original:!!c.original}))});
  }
  if(path==="/creator/content/upload"){
    await requireCreator(db,userId);
    throw new ApiError(410,"Refresh Oldtime to use its updated secure media uploader.");
  }
  if(path==="/creator/content"&&request.method==="POST"){
    await requireCreator(db,userId);
    const parsed=SyncCreatorOriginalBody.strict().safeParse(await body(request));
    if(!parsed.success||new Set(parsed.data.mediaIds).size!==parsed.data.mediaIds.length)throw new ApiError(400,"Choose a valid original and unique media attachments.");
    const i=parsed.data;
    if(!i.mediaIds.length&&!meaningful(i.body))throw new ApiError(400,"Original text needs at least 20 characters and three words.");
    const existing=await db.prepare("SELECT id,original,deleted_at FROM creator_original_content WHERE user_id=? AND source_id=?").bind(userId,i.sourceId).first<Original>();
    if(existing){if(existing.deleted_at)throw new ApiError(409,"A removed original cannot be restored by replaying its source ID.");return json({id:existing.id,original:!!existing.original});}
    const media=await rows<{id:string;object_key:string;sha256:string;content_type:string;size:number}>(db,`SELECT id,object_key,sha256,content_type,size
      FROM user_media_assets WHERE id IN (SELECT value FROM json_each(?)) AND user_id=? AND ready=1 AND storage_scope='public' AND media_role='media'
      AND (content_type LIKE 'image/%' OR content_type LIKE 'video/%')`,JSON.stringify(i.mediaIds),userId);
    if(media.length!==i.mediaIds.length||media.some(m=>!/^[a-f0-9]{64}$/.test(m.sha256)))throw new ApiError(400,"Upload and confirm every original attachment first.");
    const fingerprint=media.length?createHash("sha256").update(media.map(m=>m.sha256).sort().join(":")).digest("hex"):textFingerprint(i.body);
    const id=crypto.randomUUID(),now=Date.now(),kind=media.some(m=>m.content_type.startsWith("video/"))?"video":media.length?"photo":"text";
    const assets=media.map(m=>({...m,creditId:crypto.randomUUID()}));
    const result=await db.batch([
      db.prepare(`INSERT INTO creator_original_content(id,user_id,source_id,surface,kind,body,fingerprint,original,created_at)
        SELECT ?,?,?,?,?,?,?,NOT EXISTS(SELECT 1 FROM creator_original_content WHERE fingerprint=? AND user_id<>?),?
        WHERE (SELECT count(*) FROM user_media_assets WHERE user_id=? AND ready=1 AND id IN (SELECT value FROM json_each(?)))=?
        ON CONFLICT(user_id,source_id) DO NOTHING RETURNING id,original`)
        .bind(id,userId,i.sourceId,i.surface,kind,i.body.trim(),fingerprint,fingerprint,userId,now,userId,JSON.stringify(i.mediaIds),i.mediaIds.length),
      db.prepare(`INSERT INTO creator_media_assets(id,user_id,object_path,content_type,size,fingerprint,confirmed_at,content_id,created_at)
        SELECT json_extract(value,'$.creditId'),?,json_extract(value,'$.object_key'),json_extract(value,'$.content_type'),
          json_extract(value,'$.size'),json_extract(value,'$.sha256'),?,?,? FROM json_each(?)
        WHERE EXISTS(SELECT 1 FROM creator_original_content WHERE id=?)`).bind(userId,now,id,now,JSON.stringify(assets),id),
      db.prepare(`INSERT INTO media_references(user_id,target_type,target_id,media_id)
        SELECT ?,'creator',?,value FROM json_each(?) WHERE EXISTS(SELECT 1 FROM creator_original_content WHERE id=?)`)
        .bind(userId,id,JSON.stringify(i.mediaIds),id),
    ]);
    const created=result[0].results?.[0] as {id:string;original:number}|undefined;
    if(created)return json({id:created.id,original:!!created.original});
    const concurrent=await db.prepare("SELECT id,original,deleted_at FROM creator_original_content WHERE user_id=? AND source_id=?").bind(userId,i.sourceId).first<Original>();
    if(!concurrent||concurrent.deleted_at)throw new ApiError(409,"This original changed while saving. Retry with confirmed media.");
    return json({id:concurrent.id,original:!!concurrent.original});
  }
  const match=/^\/creator\/content\/([^/]+)$/.exec(path);
  if(match&&request.method==="DELETE"){
    if(!uuid.test(match[1]))throw new ApiError(400,"Invalid content ID.");
    const result=await db.batch([
      db.prepare("UPDATE creator_original_content SET deleted_at=? WHERE id=? AND user_id=? RETURNING id").bind(Date.now(),match[1],userId),
      db.prepare("DELETE FROM media_references WHERE user_id=? AND target_type='creator' AND target_id=?").bind(userId,match[1]),
      db.prepare("DELETE FROM creator_media_assets WHERE content_id=? AND user_id=?").bind(match[1],userId),
    ]);
    if(!result[0].results?.length)throw new ApiError(404,"Original not found.");
    // The original and a normal post can reference the same immutable R2 file.
    // Removing credit must not remove a post/draft; normal reference-aware GC
    // handles files that really become unused, without creating another copy.
    return json({deleted:true,cleanupPending:false});
  }
  throw new ApiError(405,"Method not allowed.");
}
