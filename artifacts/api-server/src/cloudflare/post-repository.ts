import type { SocialPost } from "@workspace/api-zod";
import { canRatePlace } from "../lib/place-policy";
import { rows, object, publicDetails, V, viewerCte, visiblePost, type Database } from "./runtime";

export interface PostRow {
  id: string; source_id: string | null; remix_source_post_id: string | null; audio_source_post_id: string | null;
  author_id: string; text: string; visibility: SocialPost["visibility"];
  archived_at: number | null;
  audio_reuse_allowed: number;
  destination: SocialPost["destination"]; place: string | null; created_at: number;
  username: string; display_name: string; joined_at: number; profile_data: string | null; author_is_private: number;
  like_count: number; comment_count: number; human_like_count:number; human_commenter_count:number;
  repost_count: number; remix_count: number; view_count: number;
  save_count: number; liked: number; repost_note: string | null; followed: number;
  audio_reuse_allowed_effective: number; audio_use_count: number;
}
export const postSelect = `SELECT p.*, u.username,u.display_name,u.created_at AS joined_at,
  u.is_private AS author_is_private,
  s.data AS profile_data,
  (SELECT count(*) FROM analytics_events e JOIN analytics_resources ar ON ar.id=e.resource_id
    WHERE ar.owner_id=p.author_id AND ar.source_id=p.id AND e.kind='view') AS view_count,
  (SELECT count(*) FROM post_likes l JOIN users lu ON lu.id=l.user_id
    WHERE l.post_id=p.id AND lu.is_virtual=0) AS like_count,
  (SELECT count(*) FROM post_comments c JOIN users cu ON cu.id=c.user_id
    WHERE c.post_id=p.id AND cu.is_virtual=0) AS comment_count,
  (SELECT count(*) FROM post_likes l JOIN users lu ON lu.id=l.user_id
    WHERE l.post_id=p.id AND lu.is_virtual=0) AS human_like_count,
  (SELECT count(DISTINCT c.user_id) FROM post_comments c JOIN users cu ON cu.id=c.user_id
    WHERE c.post_id=p.id AND cu.is_virtual=0) AS human_commenter_count,
  (SELECT count(*) FROM post_reposts r WHERE r.post_id=p.id) AS repost_count,
  (SELECT count(*) FROM post_saves s WHERE s.post_id=p.id) AS save_count,
  (SELECT count(*) FROM posts rp JOIN users ru ON ru.id=rp.author_id
    WHERE rp.remix_source_post_id=p.id AND ${visiblePost.replaceAll("p.", "rp.").replaceAll("u.", "ru.")}) AS remix_count,
   CASE WHEN p.audio_source_sound_id IS NOT NULL OR p.audio_sound_id IS NOT NULL THEN
      CASE WHEN EXISTS(SELECT 1 FROM sound_library sound LEFT JOIN users sound_user ON sound_user.id=sound.owner_id
       LEFT JOIN account_state sound_state ON sound_state.user_id=sound.owner_id
      WHERE sound.id=COALESCE(p.audio_source_sound_id,p.audio_sound_id)
          AND sound.reuse_allowed=1 AND COALESCE(sound_user.is_private,0)=0
          AND COALESCE(json_extract(sound_state.data,'$.soundReuseEnabled'),1)=1) THEN 1 ELSE 0 END
  WHEN p.audio_source_post_id IS NULL THEN
     CASE WHEN p.visibility='public' AND u.is_private=0
       AND COALESCE(json_extract(s.data,'$.soundReuseEnabled'),1)=1 THEN p.audio_reuse_allowed ELSE 0 END
  ELSE COALESCE((SELECT source.audio_reuse_allowed FROM posts source
    JOIN users source_user ON source_user.id=source.author_id
     LEFT JOIN account_state source_state ON source_state.user_id=source.author_id
     WHERE source.id=p.audio_source_post_id AND source.visibility='public' AND source_user.is_private=0
       AND COALESCE(json_extract(source_state.data,'$.soundReuseEnabled'),1)=1),0)
  END AS audio_reuse_allowed_effective,
  CASE WHEN COALESCE(p.audio_source_sound_id,p.audio_sound_id) IS NOT NULL THEN
    (SELECT count(*) FROM posts ap JOIN users au ON au.id=ap.author_id
       WHERE ap.archived_at IS NULL AND ap.audio_source_sound_id=COALESCE(p.audio_source_sound_id,p.audio_sound_id)
        AND ap.visibility='public' AND au.is_private=0)
  ELSE (SELECT count(*) FROM posts ap JOIN users au ON au.id=ap.author_id
     WHERE ap.archived_at IS NULL AND ap.audio_source_post_id=COALESCE(p.audio_source_post_id,p.id)
      AND ap.visibility='public' AND au.is_private=0
      AND EXISTS(SELECT 1 FROM posts sound JOIN users sound_user ON sound_user.id=sound.author_id
        WHERE sound.id=COALESCE(p.audio_source_post_id,p.id) AND sound.visibility='public'
          AND sound_user.is_private=0 AND sound.audio_reuse_allowed=1))
  END AS audio_use_count,
  EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=${V}) AS liked,
  (SELECT r.note FROM post_reposts r WHERE r.post_id=p.id AND r.user_id=${V}) AS repost_note,
  EXISTS(SELECT 1 FROM user_follows f WHERE f.followed_id=p.author_id AND f.follower_id=${V}) AS followed
  FROM posts p JOIN users u ON u.id=p.author_id LEFT JOIN account_state s ON s.user_id=u.id`;

export async function loadPostRows(
  db: Database,
  userId: string,
  condition: string,
  params: unknown[] = [],
  limit = 31,
  offset = 0,
  archivedOnly = false,
  order: "recent" | "top" = "recent",
) {
  const access = archivedOnly ? "p.author_id=? AND p.archived_at IS NOT NULL" : visiblePost;
  const accessParams = archivedOnly ? [userId] : [];
  return rows<PostRow>(db, `${viewerCte} ${postSelect} WHERE ${access} AND (${condition})
    ORDER BY ${order === "top" ? "(SELECT count(*) FROM post_likes pl WHERE pl.post_id=p.id) DESC," : ""} p.created_at DESC,p.id DESC LIMIT ? OFFSET ?`, userId, ...accessParams, ...params, limit, offset);
}
export async function getPost(db: Database, userId: string, id: string) {
  return (await loadPostRows(db, userId, "p.id=?", [id], 1))[0] ?? null;
}
export async function hydratePosts(db: Database, userId: string, records: PostRow[]): Promise<SocialPost[]> {
  if (!records.length) return [];
  const placeIds = [...new Set(records.map(p => object(p.place).id).filter((id): id is string =>
    typeof id === "string" && id.startsWith("osm:")))];
  const ratings = placeIds.length ? await rows<{place_id:string;averageRating:number;ratingCount:number}>(db,
    `SELECT r.place_id,avg(r.rating) AS averageRating,count(*) AS ratingCount
     FROM place_reviews r JOIN users u ON u.id=r.user_id WHERE r.place_id IN (${placeIds.map(()=>"?").join(",")})
     AND u.is_virtual=0 AND NOT EXISTS (SELECT 1 FROM account_blocks b
       WHERE (b.owner_id=? AND b.blocked_id=r.user_id) OR (b.blocked_id=? AND b.owner_id=r.user_id))
     GROUP BY r.place_id`,...placeIds,userId,userId) : [];
  const ratingsByPlace = new Map(ratings.map(r => [r.place_id,{averageRating:r.averageRating,ratingCount:r.ratingCount}]));
  const ids = records.map(p => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const [media, likes, comments, friends, sounds] = await Promise.all([
    rows<{post_id:string;id:string;content_type:string;thumbnail_id:string|null}>(db, `
      SELECT pm.post_id,m.id,m.content_type,m.thumbnail_id FROM post_media_assets pm
      JOIN user_media_assets m ON m.id=pm.media_id
      WHERE pm.post_id IN (${placeholders}) AND m.ready=1 ORDER BY pm.position`, ...ids),
    rows<{post_id:string;id:string;username:string;display_name:string;created_at:number;data:string|null}>(db, `
      SELECT * FROM (SELECT l.post_id,u.id,u.username,u.display_name,u.created_at,s.data,
        row_number() OVER(PARTITION BY l.post_id ORDER BY l.created_at DESC,l.user_id) AS rank
        FROM post_likes l JOIN users u ON u.id=l.user_id LEFT JOIN account_state s ON s.user_id=u.id
        WHERE l.post_id IN (${placeholders})
        AND u.is_virtual=0)
      WHERE rank<=3`, ...ids),
    rows<{post_id:string;id:string;body:string;created_at:number;user_id:string;username:string;display_name:string;joined_at:number;likes:number}>(db, `
      ${viewerCte}, ranked AS (
        SELECT c.*,u.username,u.display_name,u.created_at AS joined_at,
          (SELECT count(*) FROM post_comment_reactions r WHERE r.comment_id=c.id AND r.reaction='like') AS likes,
          row_number() OVER(PARTITION BY c.post_id ORDER BY
            (SELECT count(*) FROM post_comment_reactions r WHERE r.comment_id=c.id AND r.reaction='like') DESC,c.created_at DESC,c.id) AS rank
        FROM post_comments c JOIN users u ON u.id=c.user_id
        WHERE c.post_id IN (${placeholders}) AND c.parent_id IS NULL AND u.is_private=0 AND u.is_virtual=0
        AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
          (b.owner_id=${V} AND b.blocked_id=c.user_id) OR (b.blocked_id=${V} AND b.owner_id=c.user_id)))
      SELECT * FROM ranked WHERE rank=1`, userId, ...ids),
    rows<{post_id:string;id:string;username:string;display_name:string;created_at:number;data:string|null;is_followed:number;is_friend:number}>(db, `
      ${viewerCte} SELECT r.post_id,u.id,u.username,u.display_name,u.created_at,s.data,
        EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=${V} AND f.followed_id=u.id) AS is_followed,
        EXISTS(SELECT 1 FROM friendships f WHERE
          (f.member_low_id=${V} AND f.member_high_id=u.id) OR (f.member_high_id=${V} AND f.member_low_id=u.id)) AS is_friend
      FROM post_reposts r JOIN users u ON u.id=r.user_id
      LEFT JOIN account_state s ON s.user_id=u.id
      WHERE r.post_id IN (${placeholders}) AND (
        EXISTS(SELECT 1 FROM friendships f WHERE
          (f.member_low_id=${V} AND f.member_high_id=u.id) OR
          (f.member_high_id=${V} AND f.member_low_id=u.id))
        OR EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=${V} AND f.followed_id=u.id))
      AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
        (b.owner_id=${V} AND b.blocked_id=u.id) OR (b.blocked_id=${V} AND b.owner_id=u.id))
      ORDER BY r.updated_at DESC`, userId, ...ids),
     rows<{post_id:string;id:string;title:string;owner_id:string|null;creator_id:string;creator_username:string;creator_display_name:string;username:string|null;display_name:string|null;data:string|null}>(db, `
       SELECT p.id AS post_id,s.id,s.title,s.owner_id,s.creator_id,s.creator_username,s.creator_display_name,u.username,u.display_name,state.data
      FROM posts p JOIN sound_library s ON s.id=COALESCE(p.audio_source_sound_id,p.audio_sound_id)
       LEFT JOIN users u ON u.id=s.owner_id LEFT JOIN account_state state ON state.user_id=u.id
      WHERE p.id IN (${placeholders})`, ...ids),
  ]);
  return records.map(p => {
    const top = comments.find(c => c.post_id===p.id);
    const friendRows = friends.filter(f => f.post_id===p.id);
    const confirmedFriendRows=friendRows.filter(f=>Boolean(f.is_friend));
    return {
      id:p.id, sourceId:p.source_id, remixSourcePostId:p.remix_source_post_id,
      audioSourcePostId:p.audio_source_post_id,
      audioSound:(sounds.find(sound=>sound.post_id===p.id) ? (() => {
        const sound=sounds.find(item=>item.post_id===p.id)!;
        return {id:sound.id,title:sound.title,author:{
          id:sound.creator_id,username:sound.username||sound.creator_username,
          displayName:sound.display_name||sound.creator_display_name,
          avatar:publicDetails(sound.data).avatar ?? "",
        }};
      })() : null),
      audioReuseAllowed:Boolean(p.audio_reuse_allowed_effective),
      audioUseCount:Number.isSafeInteger(p.audio_use_count)?p.audio_use_count:0,
      text:p.text,
      visibility:p.visibility, destination:p.destination, place:p.place ? object(p.place) as unknown as SocialPost["place"] : null,
      placeRating:canRatePlace(object(p.place)) ? ratingsByPlace.get(String(object(p.place).id)) || null : null,
      createdAt:p.created_at, author:{
        id:p.author_id,username:p.username,displayName:p.display_name,joinedAt:p.joined_at,...publicDetails(p.profile_data),
      },
      media:media.filter(m=>m.post_id===p.id).map(m=>({
        id:m.id,contentType:m.content_type as SocialPost["media"][number]["contentType"],
        reference:`oldtime-media:${m.id}`,thumbnailReference:m.thumbnail_id ? `oldtime-media:${m.thumbnail_id}` : null,
      })),
      likeCount:p.like_count,likedByMe:!!p.liked,commentCount:p.comment_count,measuredViews:Number(p.view_count)||0,
      saveCount:p.save_count,repostCount:p.repost_count,remixCount:p.remix_count,
      repostedByMe:p.repost_note!==null,repostNote:p.repost_note,
      topComment:top ? {
        id:top.id,body:top.body,createdAt:top.created_at,likeCount:top.likes,
        author:{id:top.user_id,username:top.username,displayName:top.display_name,joinedAt:top.joined_at},
      } : null,
      likedBy:likes.filter(l=>l.post_id===p.id).map(l=>({
        id:l.id,username:l.username,displayName:l.display_name,joinedAt:l.created_at,
        ...publicDetails(l.data),
      })),
      friendRepostCount:confirmedFriendRows.length,
      repostedByFollowing:friendRows.some(f=>Boolean(f.is_followed)),
      repostedByFriends:confirmedFriendRows.slice(0,3).map(f=>({
        id:f.id,username:f.username,displayName:f.display_name,joinedAt:f.created_at,...publicDetails(f.data),
      })),
    };
  });
}
