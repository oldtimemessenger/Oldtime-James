import { rows, type Database, type MediaBucket } from "./runtime";

// All checks are in the deletion statement, not a read followed by an
// unconditional delete. Concurrent publication either protects the asset or
// fails its FK check; it must never silently lose a published attachment.
export const unusedMedia=`NOT EXISTS(SELECT 1 FROM post_media_assets pm WHERE pm.media_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM chat_message_media cm WHERE cm.media_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM user_media_assets parent WHERE parent.thumbnail_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM stories s WHERE s.media_path=m.object_key)
  AND NOT EXISTS(SELECT 1 FROM media_references r WHERE r.media_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM account_state a WHERE
    json_extract(a.data,'$.profile.avatar')='oldtime-media:'||m.id OR
    json_extract(a.data,'$.profile.cover')='oldtime-media:'||m.id)`;

const errorName=(error:unknown)=>error instanceof Error?error.name:"UnknownError";

export interface MediaDeletionBatch {
  queued:number;
  deletedObjects:number;
  deletedBytes:number;
  failedObjects:number;
}

export async function drainMediaDeletions(db:Database,bucket:MediaBucket,keys?:string[],now=Date.now()):Promise<MediaDeletionBatch>{
  const entries=await rows<{object_key:string;upload_id:string|null;size_bytes:number;attempt_count:number}>(db,
    `SELECT object_key,upload_id,size_bytes,attempt_count FROM r2_deletion_queue
      ${keys?"WHERE object_key IN (SELECT value FROM json_each(?))":"WHERE next_attempt_at<=?"}
      ORDER BY queued_at LIMIT 100`,...(keys?[JSON.stringify(keys)]:[now]));
  if(!entries.length)return {queued:0,deletedObjects:0,deletedBytes:0,failedObjects:0};
  for(const entry of entries)if(entry.upload_id){
    try{await bucket.resumeMultipartUpload(entry.object_key,entry.upload_id).abort();}
    catch(error){
      // R2 lifecycle rules remain a second safety net if an upload handle is
      // already gone or cannot be aborted during this run.
      console.warn("[Oldtime R2 cleanup] multipart abort deferred",{error:errorName(error)});
    }
  }
  try{
    await bucket.delete(entries.map(e=>e.object_key));
  }catch(error){
    const updates=entries.map(entry=>{
      const attempts=Math.max(0,Number(entry.attempt_count)||0);
      const delay=Math.min(24*3600000,60000*2**Math.min(attempts,10));
      return db.prepare(`UPDATE r2_deletion_queue SET attempt_count=attempt_count+1,next_attempt_at=?,last_error=?
        WHERE object_key=?`).bind(now+delay,errorName(error).slice(0,80),entry.object_key);
    });
    await db.batch(updates);
    console.error("[Oldtime R2 cleanup] deletion batch failed; queued for retry",{
      count:entries.length,error:errorName(error),
    });
    return {queued:entries.length,deletedObjects:0,deletedBytes:0,failedObjects:entries.length};
  }
  await db.prepare("DELETE FROM r2_deletion_queue WHERE object_key IN (SELECT value FROM json_each(?))")
    .bind(JSON.stringify(entries.map(e=>e.object_key))).run();
  return {
    queued:entries.length,deletedObjects:entries.length,
    deletedBytes:entries.reduce((sum,entry)=>sum+Math.max(0,Number(entry.size_bytes)||0),0),
    failedObjects:0,
  };
}

export async function cleanupMedia(db:Database,bucket:MediaBucket,scheduledAt=Date.now()){
  const now=Date.now(),cutoff=now-72*3600000,runAt=Math.floor(Number(scheduledAt)||now);
  const expired=`m.ready=0 AND EXISTS(SELECT 1 FROM media_upload_sessions s
    WHERE s.media_id=m.id AND s.expires_at<? AND s.lease_until<?)`;
  const aged=`m.created_at<? AND NOT EXISTS(SELECT 1 FROM media_upload_sessions active
    WHERE active.media_id=m.id AND (active.expires_at>? OR active.lease_until>?))`;
  const cleanup=await db.batch([
    db.prepare("DELETE FROM stories WHERE id IN (SELECT id FROM stories WHERE saved_to_profile=0 AND expires_at<? LIMIT 100)").bind(now),
    db.prepare(`INSERT INTO r2_deletion_queue(object_key,upload_id,size_bytes,queued_at)
      SELECT m.object_key,(SELECT upload_id FROM media_upload_sessions s WHERE s.media_id=m.id),m.size,?
      FROM user_media_assets m WHERE ${expired} AND ${unusedMedia} LIMIT 100
      ON CONFLICT(object_key) DO UPDATE SET size_bytes=max(r2_deletion_queue.size_bytes,excluded.size_bytes)`).bind(now,now,now),
    db.prepare(`DELETE FROM user_media_assets WHERE id IN (SELECT m.id FROM user_media_assets m
      WHERE ${expired} AND ${unusedMedia} LIMIT 100)`).bind(now,now),
    db.prepare(`INSERT INTO r2_deletion_queue(object_key,size_bytes,queued_at)
      SELECT m.object_key,m.size,? FROM user_media_assets m WHERE ${aged} AND ${unusedMedia}
      LIMIT 100 ON CONFLICT(object_key) DO UPDATE SET size_bytes=max(r2_deletion_queue.size_bytes,excluded.size_bytes)`).bind(now,cutoff,now,now),
    db.prepare(`DELETE FROM user_media_assets WHERE id IN (SELECT m.id FROM user_media_assets m
      WHERE ${aged} AND ${unusedMedia} LIMIT 100)`).bind(cutoff,now,now),
    db.prepare("DELETE FROM place_search_cache WHERE expires_at<?").bind(now),
    db.prepare("DELETE FROM external_lookup_limits WHERE expires_at<?").bind(now),
    db.prepare("DELETE FROM analytics_events WHERE created_at<?").bind(now-120*86400000),
    db.prepare("DELETE FROM analytics_sessions WHERE started_at<?").bind(now-120*86400000),
    db.prepare("DELETE FROM analytics_daily WHERE day<?").bind(new Date(now-730*86400000).toISOString().slice(0,10)),
  ]);
  const deletions={queued:0,deletedObjects:0,deletedBytes:0,failedObjects:0};
  // Bound both D1 work and R2 request volume while letting a modest backlog
  // clear in one scheduled run instead of waiting one day per 100 objects.
  for(let batchIndex=0;batchIndex<3;batchIndex++){
    const result=await drainMediaDeletions(db,bucket,undefined,now);
    deletions.queued+=result.queued;
    deletions.deletedObjects+=result.deletedObjects;
    deletions.deletedBytes+=result.deletedBytes;
    deletions.failedObjects+=result.failedObjects;
    if(!result.queued)break;
  }
  const volume=await db.prepare(`SELECT
    sum(CASE WHEN ready=1 THEN 1 ELSE 0 END) AS tracked_assets,
    sum(CASE WHEN ready=1 THEN size ELSE 0 END) AS tracked_bytes,
    sum(CASE WHEN ready=0 THEN 1 ELSE 0 END) AS pending_uploads,
    sum(CASE WHEN created_at>=? THEN 1 ELSE 0 END) AS new_assets_24h
    FROM user_media_assets`).bind(now-86400000).first<{
      tracked_assets:number|null;tracked_bytes:number|null;pending_uploads:number|null;new_assets_24h:number|null;
    }>();
  const queued=await db.prepare("SELECT count(*) AS total FROM r2_deletion_queue").first<{total:number}>();
  const expiredStories=cleanup[0]?.meta?.changes??0;
  const expiredAssets=(cleanup[2]?.meta?.changes??0)+(cleanup[4]?.meta?.changes??0);
  await db.batch([
    db.prepare(`INSERT INTO media_cleanup_runs(
      scheduled_at,expired_stories,expired_media_assets,deleted_objects,deleted_bytes,failed_deletions,
      tracked_assets,tracked_bytes,new_assets_24h,pending_uploads,queued_deletions)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(scheduled_at) DO UPDATE SET
      expired_stories=excluded.expired_stories,expired_media_assets=excluded.expired_media_assets,
      deleted_objects=excluded.deleted_objects,deleted_bytes=excluded.deleted_bytes,
      failed_deletions=excluded.failed_deletions,tracked_assets=excluded.tracked_assets,
      tracked_bytes=excluded.tracked_bytes,new_assets_24h=excluded.new_assets_24h,
      pending_uploads=excluded.pending_uploads,queued_deletions=excluded.queued_deletions`)
      .bind(runAt,expiredStories,expiredAssets,deletions.deletedObjects,deletions.deletedBytes,deletions.failedObjects,
        volume?.tracked_assets??0,volume?.tracked_bytes??0,volume?.new_assets_24h??0,volume?.pending_uploads??0,queued?.total??0),
    db.prepare("DELETE FROM media_cleanup_runs WHERE scheduled_at<?").bind(now-90*86400000),
  ]);
  return {expiredStories,expiredAssets,...deletions,trackedAssets:volume?.tracked_assets??0,
    trackedBytes:volume?.tracked_bytes??0,newAssets24h:volume?.new_assets_24h??0,
    pendingUploads:volume?.pending_uploads??0,queuedDeletions:queued?.total??0};
}
