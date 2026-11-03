import { ApiError, object, type Database } from "./runtime";
export function referenceWrites(db:Database,userId:string,type:string,target:string,ids:string[],nonce?:string){
  const condition=nonce?" AND EXISTS(SELECT 1 FROM blast_account_state WHERE user_id=? AND scope=? AND write_nonce=?)":"";
  const parameters=nonce?[userId,target,nonce]:[];
  return [
    db.prepare(`DELETE FROM media_references WHERE user_id=? AND target_type=? AND target_id=?${condition}`).bind(userId,type,target,...parameters),
    db.prepare(`INSERT INTO media_references(user_id,target_type,target_id,media_id)
      SELECT ?,?,?,value FROM json_each(?) WHERE 1${condition} ON CONFLICT DO NOTHING`)
      .bind(userId,type,target,JSON.stringify([...new Set(ids)]),...parameters),
  ];
}
export async function profileMedia(db:Database,userId:string,profile:unknown){
  const p=object(profile),ids=[...new Set([p.avatar,p.cover].flatMap(value=>typeof value==="string"&&value.startsWith("oldtime-media:")?[value.slice(14)]:[]))];
  if(ids.length){
    const found=await db.prepare(`SELECT count(*) AS total FROM user_media_assets a JOIN json_each(?) ids ON ids.value=a.id
      WHERE a.user_id=? AND a.ready=1 AND a.storage_scope='public' AND a.media_role='media' AND a.content_type LIKE 'image/%'`)
      .bind(JSON.stringify(ids),userId).first<{total:number}>();
    if(found?.total!==ids.length)throw new ApiError(409,"Use confirmed photos from your account for your profile.");
  }
  return ids;
}
