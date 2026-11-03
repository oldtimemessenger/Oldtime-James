import { ApiError,json,rows,publicDetails,type Database } from "./runtime";
import { getPost } from "./post-repository";
export async function postLikes(request:Request,db:Database,viewer:string,postId:string) {
  if(!await getPost(db,viewer,postId))throw new ApiError(404,"Post not found.");
  const params=new URL(request.url).searchParams,limit=Number(params.get("limit")??20),offset=Number(params.get("offset")??0);
  if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isInteger(offset)||offset<0||offset>1000)
    throw new ApiError(400,"Use a page size of 1–50 and an offset of 0–1,000.");
  const where=`l.post_id=? AND NOT EXISTS(SELECT 1 FROM account_blocks b
    WHERE (b.owner_id=? AND b.blocked_id=u.id) OR (b.owner_id=u.id AND b.blocked_id=?))
    AND u.is_virtual=0`;
  const args=[postId,viewer,viewer];
  const count=await db.prepare(`SELECT count(*) total
    FROM post_likes l JOIN users u ON u.id=l.user_id WHERE ${where}`)
    .bind(...args).first<{total:number}>();
  const likes=await rows<{id:string;username:string;display_name:string;created_at:number;data:string|null}>(db,
    `SELECT u.id,u.username,u.display_name,u.created_at,s.data FROM post_likes l JOIN users u ON u.id=l.user_id
    LEFT JOIN account_state s ON s.user_id=u.id WHERE ${where}
    ORDER BY l.created_at DESC,u.id LIMIT ? OFFSET ?`,...args,Math.min(limit,1000-offset),offset);
  const nextOffset=offset+likes.length,total=count?.total??0;
  return json({likes:likes.map(u=>{
    return {id:u.id,username:u.username,
      displayName:u.display_name,
      joinedAt:u.created_at,...publicDetails(u.data)};
  }),total,
    nextOffset,hasMore:nextOffset<Math.min(total,1000)});
}
