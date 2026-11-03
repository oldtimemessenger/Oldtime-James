import { z } from "zod/v4";
import { ApiError, body, json, rows, blocked, publicDetails, type Database } from "./runtime";

export function profileListVisibility(user: { followers_visible?: number; following_visible?: number }) {
  return { followers:user.followers_visible === 1, following:user.following_visible !== 0 };
}
export async function ownProfileListVisibility(request: Request, db: Database, userId: string) {
  if (request.method === "PUT") {
    const parsed = z.object({followers:z.boolean(),following:z.boolean()}).strict().safeParse(await body(request,4096));
    if (!parsed.success) throw new ApiError(400,"Choose who can view each profile list.");
    await db.prepare("UPDATE users SET followers_visible=?,following_visible=? WHERE id=?")
      .bind(Number(parsed.data.followers),Number(parsed.data.following),userId).run();
    return json(parsed.data);
  }
  const user = await db.prepare("SELECT followers_visible,following_visible FROM users WHERE id=?")
    .bind(userId).first<{followers_visible:number;following_visible:number}>();
  if (!user) throw new ApiError(401,"Your session has expired. Sign in again.");
  return json(profileListVisibility(user));
}
export async function publicProfileList(request: Request, db: Database, viewer: string, username: string, kind: "followers" | "following") {
  const target = await db.prepare("SELECT id,is_private,followers_visible,following_visible FROM users WHERE lower(username)=? AND is_virtual=0")
    .bind(username.toLowerCase()).first<{id:string;is_private:number;followers_visible:number;following_visible:number}>();
  if (!target || await blocked(db,viewer,target.id)) throw new ApiError(404,"Profile not found.");
  if (viewer !== target.id) {
    if (!profileListVisibility(target)[kind]) throw new ApiError(403,"This profile list is private.");
    if (target.is_private && !await db.prepare("SELECT 1 FROM user_follows WHERE follower_id=? AND followed_id=?").bind(viewer,target.id).first()) {
      throw new ApiError(403,"Follow this private account to view its profile lists.");
    }
  }
  const search = new URL(request.url).searchParams;
  const parsed = z.object({limit:z.coerce.number().int().min(1).max(50),offset:z.coerce.number().int().min(0).max(5000)})
    .safeParse({limit:search.get("limit") ?? 30,offset:search.get("offset") ?? 0});
  if (!parsed.success) throw new ApiError(400,"The profile list request is invalid.");
  const {limit,offset} = parsed.data;
  const member = kind === "followers" ? "f.follower_id" : "f.followed_id";
  const subject = kind === "followers" ? "f.followed_id" : "f.follower_id";
  const members = await rows<{id:string;username:string;display_name:string;created_at:number;data:string|null}>(db,`
    SELECT u.id,u.username,u.display_name,u.created_at,s.data FROM user_follows f JOIN users u ON u.id=${member}
    LEFT JOIN account_state s ON s.user_id=u.id WHERE ${subject}=? AND u.is_virtual=0
    AND (u.is_private=0 OR ?=? OR u.id=? OR EXISTS(SELECT 1 FROM user_follows vf WHERE vf.follower_id=? AND vf.followed_id=u.id))
    AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=? AND b.blocked_id=u.id) OR (b.owner_id=u.id AND b.blocked_id=?))
    ORDER BY f.created_at DESC,u.id LIMIT ? OFFSET ?`,target.id,viewer,target.id,viewer,viewer,viewer,viewer,limit+1,offset);
  return json({users:members.slice(0,limit).map(u=>({
    id:u.id,username:u.username,displayName:u.display_name,joinedAt:u.created_at,...publicDetails(u.data),
  })),hasMore:members.length>limit,nextOffset:offset+Math.min(limit,members.length)});
}
