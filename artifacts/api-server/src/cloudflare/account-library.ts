import { ListLibrarySavedQueryParams } from "@workspace/api-zod";
import { ApiError, json, V, type Database } from "./runtime";
import { hydratePosts, loadPostRows } from "./post-repository";

export async function librarySaved(request: Request, db: Database, userId: string) {
  const parsed = ListLibrarySavedQueryParams.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new ApiError(400, "Choose a valid Saved filter and page.");
  const { filter, limit, offset } = parsed.data;
  const video = `EXISTS(SELECT 1 FROM post_media_assets pm JOIN user_media_assets m ON m.id=pm.media_id
    WHERE pm.post_id=p.id AND m.ready=1 AND m.content_type LIKE 'video/%')`;
  const saved = `p.destination='main' AND (
    EXISTS(SELECT 1 FROM post_saves s WHERE s.post_id=p.id AND s.user_id=${V})
    OR p.id IN (SELECT value FROM account_state a,json_each(a.data,'$.savedPostIds') WHERE a.user_id=${V}))`;
  const where = `${saved}${filter === "reels" ? ` AND ${video}` : filter === "posts" ? ` AND NOT ${video}` : ""}`;
  const records = await loadPostRows(db, userId, where, [], limit + 1, offset);
  return json({ posts: await hydratePosts(db, userId, records.slice(0, limit)),
    hasMore: records.length > limit, nextOffset: offset + Math.min(limit, records.length) });
}
