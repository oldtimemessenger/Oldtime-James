import {
  GetSoundParams, GetSoundResponse, ListDiscoverableSoundsQueryParams,
  ListDiscoverableSoundsResponse, ListMySoundsResponse,
  SaveSoundResponse, UnsaveSoundResponse,
  UpdateSoundBody, UpdateSoundParams, UpdateSoundResponse,
} from "@workspace/api-zod";
import { ApiError, body, json, publicDetails, rows, type Database } from "./runtime";

type SoundRow = {
  id: string;
  source_post_id?: string | null;
  title: string;
  owner_id: string | null;
  creator_id: string;
  creator_username: string;
  creator_display_name: string;
  media_id: string;
  reuse_allowed: number;
  created_at: number;
  username: string;
  display_name: string;
  profile_data: string | null;
  is_private: number;
  sound_reuse_enabled: number;
  saved: number;
  owned: number;
  use_count: number;
  recent_creator_count: number;
};

function validate<T>(parsed: { success: true; data: T } | { success: false }, message: string): T {
  if (!parsed.success) throw new ApiError(400, message);
  return parsed.data;
}

function soundDto(row: SoundRow, viewerId: string) {
  const owned = row.owner_id === viewerId;
  const reusable = row.reuse_allowed === 1 && row.is_private === 0 && row.sound_reuse_enabled === 1;
  const available = owned || reusable;
  const profile = publicDetails(row.profile_data);
  return {
    id: row.id,
    title: row.title,
    author: {
      id: row.creator_id,
      username: row.username || row.creator_username,
      displayName: row.display_name || row.creator_display_name,
      avatar: profile.avatar ?? "",
    },
    mediaReference: available ? `oldtime-media:${row.media_id}` : "",
    reuseAllowed: reusable,
    available,
    owned,
    saved: Boolean(row.saved),
    useCount: Math.max(0, Number(row.use_count) || 0),
    trending: Number(row.recent_creator_count) >= 3,
    createdAt: row.created_at,
    sourcePostId: row.source_post_id ?? null,
  };
}

const soundColumns = `s.id,s.source_post_id,s.title,s.owner_id,s.media_id,s.reuse_allowed,s.created_at,
  COALESCE(u.username,s.creator_username) AS username,
  COALESCE(u.display_name,s.creator_display_name) AS display_name,
  state.data AS profile_data,COALESCE(u.is_private,0) AS is_private,
  COALESCE(json_extract(state.data,'$.soundReuseEnabled'),1) AS sound_reuse_enabled,
  s.creator_id,s.creator_username,s.creator_display_name,
  EXISTS(SELECT 1 FROM sound_saves ss WHERE ss.sound_id=s.id AND ss.user_id=?) AS saved,
  (s.owner_id=?) AS owned,
  (SELECT count(*) FROM posts use_post JOIN users use_owner ON use_owner.id=use_post.author_id
    WHERE use_post.archived_at IS NULL AND use_post.audio_source_sound_id=s.id AND use_post.visibility='public' AND use_owner.is_private=0
      AND use_post.author_id<>s.creator_id) AS use_count,
  (SELECT count(DISTINCT recent.author_id) FROM posts recent JOIN users recent_owner ON recent_owner.id=recent.author_id
    WHERE recent.archived_at IS NULL AND recent.audio_source_sound_id=s.id AND recent.visibility='public' AND recent_owner.is_private=0
      AND recent.author_id<>s.creator_id AND recent.created_at>=?) AS recent_creator_count`;

const availableToViewer = `NOT EXISTS(
  SELECT 1 FROM account_blocks b WHERE
    (b.owner_id=? AND b.blocked_id=s.owner_id) OR (b.blocked_id=? AND b.owner_id=s.owner_id))`;

async function listDiscoverableSounds(request: Request, db: Database, userId: string) {
  const { query = "", limit, offset } = validate(
    ListDiscoverableSoundsQueryParams.safeParse(Object.fromEntries(new URL(request.url).searchParams)),
    "The sound search is invalid.",
  );
  const search = query.trim().slice(0, 80);
  const filter = search ? "AND (instr(lower(p.text),lower(?))>0 OR instr(lower(u.username),lower(?))>0)" : "";
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const found = await rows<SoundRow>(db, `SELECT
      p.id AS id,p.id AS source_post_id,'Original audio' AS title,p.author_id AS owner_id,p.author_id AS creator_id,
      u.username AS creator_username,u.display_name AS creator_display_name,m.id AS media_id,
      p.audio_reuse_allowed AS reuse_allowed,p.created_at,u.username,u.display_name,state.data AS profile_data,
      u.is_private,COALESCE(json_extract(state.data,'$.soundReuseEnabled'),1) AS sound_reuse_enabled,
      EXISTS(SELECT 1 FROM sound_post_saves saved_source
        WHERE saved_source.user_id=? AND saved_source.source_post_id=p.id) AS saved,
      (p.author_id=?) AS owned,
      (SELECT count(*) FROM posts used JOIN users used_owner ON used_owner.id=used.author_id
        WHERE used.archived_at IS NULL AND used.visibility='public' AND used_owner.is_private=0
          AND (used.audio_source_post_id=p.id OR used.audio_source_sound_id IN
            (SELECT legacy.id FROM sound_library legacy WHERE legacy.source_post_id=p.id) OR used.audio_sound_id IN
            (SELECT legacy.id FROM sound_library legacy WHERE legacy.source_post_id=p.id))) AS use_count,
      (SELECT count(DISTINCT used.author_id) FROM posts used JOIN users used_owner ON used_owner.id=used.author_id
        WHERE used.archived_at IS NULL AND used.visibility='public' AND used_owner.is_private=0
          AND used.created_at>=? AND (used.audio_source_post_id=p.id OR used.audio_source_sound_id IN
            (SELECT legacy.id FROM sound_library legacy WHERE legacy.source_post_id=p.id) OR used.audio_sound_id IN
            (SELECT legacy.id FROM sound_library legacy WHERE legacy.source_post_id=p.id))) AS recent_creator_count
    FROM posts p
    JOIN users u ON u.id=p.author_id
    LEFT JOIN account_state state ON state.user_id=u.id
    JOIN post_media_assets pm ON pm.post_id=p.id AND pm.position=(
      SELECT min(video_pm.position) FROM post_media_assets video_pm
      JOIN user_media_assets video ON video.id=video_pm.media_id
      WHERE video_pm.post_id=p.id AND video.ready=1 AND video.media_role='media'
        AND video.storage_scope='public' AND video.content_type LIKE 'video/%')
    JOIN user_media_assets m ON m.id=pm.media_id
    WHERE p.visibility='public' AND p.archived_at IS NULL AND p.audio_source_post_id IS NULL
      AND p.audio_source_sound_id IS NULL AND p.audio_reuse_allowed=1
      AND COALESCE(u.is_private,0)=0
      AND COALESCE(json_extract(state.data,'$.soundReuseEnabled'),1)=1
      AND m.ready=1 AND m.media_role='media' AND m.storage_scope='public' AND m.content_type LIKE 'video/%'
      AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
        (b.owner_id=? AND b.blocked_id=p.author_id) OR (b.blocked_id=? AND b.owner_id=p.author_id))
      ${filter}
    ORDER BY (recent_creator_count>=3) DESC,recent_creator_count DESC,use_count DESC,p.created_at DESC,p.id DESC
    LIMIT ? OFFSET ?`,
  userId, userId, sevenDaysAgo, userId, userId, ...(search ? [search, search] : []), limit + 1, offset);
  const hasMore = found.length > limit;
  const sounds = found.slice(0, limit).map(row => soundDto(row, userId));
  return json(ListDiscoverableSoundsResponse.parse({
    sounds, hasMore, nextOffset: offset + sounds.length,
  }));
}

async function listMySounds(db: Database, userId: string) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const found = await rows<SoundRow>(db, `SELECT ${soundColumns}
    FROM sound_library s LEFT JOIN users u ON u.id=s.owner_id
    LEFT JOIN account_state state ON state.user_id=u.id
    JOIN user_media_assets m ON m.id=s.media_id
    WHERE (s.owner_id=? OR EXISTS(
      SELECT 1 FROM sound_saves saved WHERE saved.sound_id=s.id AND saved.user_id=?))
      AND ${availableToViewer}
    ORDER BY (s.owner_id=?) DESC,s.created_at DESC,s.id DESC LIMIT 40`,
  userId, userId, sevenDaysAgo, userId, userId, userId, userId, userId);
  const savedSources = await rows<SoundRow>(db, `SELECT
      p.id,p.id AS source_post_id,'Original audio' AS title,p.author_id AS owner_id,
      p.author_id AS creator_id,u.username AS creator_username,u.display_name AS creator_display_name,
      m.id AS media_id,p.audio_reuse_allowed AS reuse_allowed,p.created_at,u.username,u.display_name,
      state.data AS profile_data,u.is_private,
      COALESCE(json_extract(state.data,'$.soundReuseEnabled'),1) AS sound_reuse_enabled,
      1 AS saved,(p.author_id=?) AS owned,
      (SELECT count(*) FROM posts used JOIN users used_owner ON used_owner.id=used.author_id
        WHERE used.archived_at IS NULL AND used.visibility='public' AND used_owner.is_private=0
          AND (used.audio_source_post_id=p.id OR used.audio_source_sound_id IN
            (SELECT legacy.id FROM sound_library legacy WHERE legacy.source_post_id=p.id) OR used.audio_sound_id IN
            (SELECT legacy.id FROM sound_library legacy WHERE legacy.source_post_id=p.id))) AS use_count,
      (SELECT count(DISTINCT used.author_id) FROM posts used JOIN users used_owner ON used_owner.id=used.author_id
        WHERE used.archived_at IS NULL AND used.visibility='public' AND used_owner.is_private=0
          AND used.created_at>=? AND (used.audio_source_post_id=p.id OR used.audio_source_sound_id IN
            (SELECT legacy.id FROM sound_library legacy WHERE legacy.source_post_id=p.id) OR used.audio_sound_id IN
            (SELECT legacy.id FROM sound_library legacy WHERE legacy.source_post_id=p.id))) AS recent_creator_count
    FROM sound_post_saves saved
    JOIN posts p ON p.id=saved.source_post_id
    JOIN users u ON u.id=p.author_id
    LEFT JOIN account_state state ON state.user_id=u.id
    JOIN post_media_assets pm ON pm.post_id=p.id AND pm.position=(
      SELECT min(video_pm.position) FROM post_media_assets video_pm
      JOIN user_media_assets video ON video.id=video_pm.media_id
      WHERE video_pm.post_id=p.id AND video.ready=1 AND video.media_role='media'
        AND video.storage_scope='public' AND video.content_type LIKE 'video/%')
    JOIN user_media_assets m ON m.id=pm.media_id
    WHERE saved.user_id=? AND m.ready=1 AND m.media_role='media'
      AND m.storage_scope='public' AND m.content_type LIKE 'video/%'
    ORDER BY saved.created_at DESC LIMIT 40`,
  userId, sevenDaysAgo, userId);
  const savedSourceIds=new Set(savedSources.map(row=>row.source_post_id).filter(Boolean));
  const privateSounds=[...savedSources,...found.filter(row=>!row.source_post_id||!savedSourceIds.has(row.source_post_id))]
    .sort((a,b)=>b.created_at-a.created_at||a.id.localeCompare(b.id))
    .slice(0,40);
  return json(ListMySoundsResponse.parse({
    sounds: privateSounds.map(row => soundDto(row, userId)),
    hasMore: false,
    nextOffset: privateSounds.length,
  }));
}

async function getSound(db: Database, userId: string, id: string) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const found = await rows<SoundRow>(db, `SELECT ${soundColumns}
    FROM sound_library s LEFT JOIN users u ON u.id=s.owner_id
    LEFT JOIN account_state state ON state.user_id=u.id
    JOIN user_media_assets m ON m.id=s.media_id
    WHERE s.id=? AND (s.owner_id=? OR (s.reuse_allowed=1 AND COALESCE(u.is_private,0)=0
      AND COALESCE(json_extract(state.data,'$.soundReuseEnabled'),1)=1
      AND m.ready=1 AND m.storage_scope='public' AND m.content_type LIKE 'audio/%')
      AND ${availableToViewer}) LIMIT 1`,
  userId, userId, sevenDaysAgo, id, userId, userId, userId);
  if (!found[0]) throw new ApiError(404, "This sound is unavailable.");
  return soundDto(found[0], userId);
}

export async function soundRequest(request: Request, db: Database, userId: string, path: string) {
  if (path === "/sounds/discovery" && request.method === "GET") return listDiscoverableSounds(request, db, userId);
  if (path === "/sounds/library" && request.method === "GET") return listMySounds(db, userId);
  const saved = /^\/sounds\/([a-f0-9-]{36})\/save$/.exec(path);
  if (saved) {
    const { id } = validate(GetSoundParams.safeParse({ id: saved[1] }), "Choose a valid sound.");
    if (request.method === "DELETE") {
      await db.prepare("DELETE FROM sound_saves WHERE user_id=? AND sound_id=?").bind(userId, id).run();
      await db.prepare("DELETE FROM sound_post_saves WHERE user_id=? AND source_post_id=?").bind(userId, id).run();
      const response = UnsaveSoundResponse.parse({ saved: false });
      return json(response);
    }
    if (request.method === "PUT") {
      const sourcePost=await db.prepare(`SELECT p.id FROM posts p JOIN users u ON u.id=p.author_id
        LEFT JOIN account_state state ON state.user_id=u.id
        WHERE p.id=? AND p.visibility='public' AND p.archived_at IS NULL
          AND p.audio_source_post_id IS NULL AND p.audio_source_sound_id IS NULL
          AND p.audio_reuse_allowed=1 AND u.is_private=0
          AND COALESCE(json_extract(state.data,'$.soundReuseEnabled'),1)=1
          AND EXISTS(SELECT 1 FROM post_media_assets pm JOIN user_media_assets m ON m.id=pm.media_id
            WHERE pm.post_id=p.id AND m.ready=1 AND m.media_role='media'
              AND m.storage_scope='public' AND m.content_type LIKE 'video/%')
          AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
            (b.owner_id=? AND b.blocked_id=p.author_id) OR (b.blocked_id=? AND b.owner_id=p.author_id))
        LIMIT 1`).bind(id,userId,userId).first();
      if(sourcePost){
        await db.prepare("INSERT INTO sound_post_saves(user_id,source_post_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING")
          .bind(userId,id,Date.now()).run();
        return json(SaveSoundResponse.parse({ saved: true }));
      }
      const sound = await getSound(db, userId, id);
      if (!sound.owned && !sound.reuseAllowed) throw new ApiError(404, "This sound is unavailable.");
      await db.prepare("INSERT INTO sound_saves(user_id,sound_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING")
        .bind(userId, id, Date.now()).run();
      return json(SaveSoundResponse.parse({ saved: true }));
    }
    throw new ApiError(405, "Method not allowed.");
  }
  const match = /^\/sounds\/([a-f0-9-]{36})$/.exec(path);
  if (!match) throw new ApiError(404, "Sound not found.");
  const { id } = validate(GetSoundParams.safeParse({ id: match[1] }), "Choose a valid sound.");
  if (request.method === "GET") {
    return json(GetSoundResponse.parse({ sound: await getSound(db, userId, id) }));
  }
  if (request.method === "PATCH") {
    const input = validate(UpdateSoundBody.safeParse(await body(request)), "Choose a valid sound permission.");
    const current = await db.prepare("SELECT owner_id,reuse_allowed FROM sound_library WHERE id=?")
      .bind(id).first<{ owner_id: string; reuse_allowed: number }>();
    if (!current) throw new ApiError(404, "Sound not found.");
    if (current.owner_id !== userId) throw new ApiError(403, "Only the sound owner can change this permission.");
    if (input.reuseAllowed && input.rightsConfirmed !== true) {
      throw new ApiError(400, "Confirm that you still own or are authorized to share this audio.");
    }
    await db.prepare(`UPDATE sound_library SET reuse_allowed=?,
      rights_confirmed_at=CASE WHEN ?=1 THEN ? ELSE rights_confirmed_at END
      WHERE id=? AND owner_id=?`)
      .bind(Number(input.reuseAllowed), Number(input.reuseAllowed), Date.now(), id, userId).run();
    return json(UpdateSoundResponse.parse({ sound: await getSound(db, userId, id) }));
  }
  throw new ApiError(405, "Method not allowed.");
}
