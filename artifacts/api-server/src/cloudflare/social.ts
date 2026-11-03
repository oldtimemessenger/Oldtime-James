import { z } from "zod/v4";
import { profileListVisibility, publicProfileList } from "./profile-list-privacy";
import { learnedTopicInterests, recordPostTopicSignals } from "./topic-signals";
import { postLikes } from "./post-participants";
import { meaningful, textFingerprint } from "./content-fingerprint";
import {
  CreatePostBody, ListFeedQueryParams, ListPlaceFeedQueryParams,
  GetPlacesDiscoveryQueryParams, GetPlacesDiscoveryResponse,
} from "@workspace/api-zod";
import { placeTagSchema } from "../lib/place-tag";
import { feedInterests, rankFeedCandidates, type FeedSurface } from "../lib/feed-ranking";
import { classifyDiscovery } from "../../../../lib/discovery-engine/index.js";
import { interestTopicIds } from "./recommendation-interests";
import {
  ApiError, body, json, rows, object, blocked, publicDetails, attribution,
  V, viewerCte, notBlocked, visiblePost, type Database,
} from "./runtime";
import { MAX_PUBLIC_FEED_VIDEO_BYTES } from "./media";
import { moderatePublication, type ModerationAsset, type WorkersAiBinding } from "./content-moderation";
import type { MediaBucket } from "./runtime";
import { getPost, hydratePosts, loadPostRows } from "./post-repository";
import { discoveryIndexStatements, excludedDiscoveryTopics } from "./discovery-index";
import { downrankNotInterestedCreators } from "./feed-feedback-ranking";
import { placeRatings } from "./place-rating-summary";

export function isSocialPath(path: string) {
  return path==="/feed" || path==="/feed/feedback" || path==="/posts" || path.startsWith("/posts/") ||
    path.startsWith("/places/") && path!=="/places/search" ||
    path.startsWith("/profiles/") || path==="/users/search" || path==="/users/mention-search";
}
const query = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);
function jsonStringArray(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
const followedAuthor = `EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=${V} AND f.followed_id=p.author_id)`;
const repostedByFollowed = `EXISTS(SELECT 1 FROM post_reposts r JOIN users repost_user ON repost_user.id=r.user_id
  WHERE r.post_id=p.id AND repost_user.is_virtual=0
    AND EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=${V} AND f.followed_id=r.user_id)
    AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
      (b.owner_id=${V} AND b.blocked_id=r.user_id) OR (b.blocked_id=${V} AND b.owner_id=r.user_id)))`;
const followed = `(${followedAuthor} OR ${repostedByFollowed})`;
const friends = `EXISTS(SELECT 1 FROM friendships f WHERE
  (f.member_low_id=${V} AND f.member_high_id=p.author_id) OR
  (f.member_high_id=${V} AND f.member_low_id=p.author_id))`;
const connected = `(p.author_id=${V} OR ${followedAuthor} OR ${friends})`;
const publicPlace = `p.archived_at IS NULL AND p.place IS NOT NULL AND p.visibility='public' AND u.is_private=0 AND p.destination='main'`;
function validate<T>(parsed: {success:true;data:T} | {success:false}, message: string): T {
  if (!parsed.success) throw new ApiError(400, message);
  return parsed.data;
}

export async function mentionRecipients(db: Database, userId: string, text: string, visibility: string, contentOwner=userId, skipVisibility=false) {
  const names = [...new Set([...text.matchAll(/(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])/g)]
    .map(m=>m[1].toLowerCase()))].slice(0,25);
  if (!names.length) return [];
  const records = await rows<{id:string;username:string;data:string|null;follows:number;close_friend:number;content_friend:number;connection:number;can_view_account:number}>(db, `
    ${viewerCte}, content_owner AS (SELECT ? AS id) SELECT u.id,u.username,s.data,
      EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=u.id AND f.followed_id=${V}) AS follows,
      EXISTS(SELECT 1 FROM close_friend_members c WHERE c.owner_id=(SELECT id FROM content_owner) AND c.member_id=u.id) AS close_friend,
      EXISTS(SELECT 1 FROM friendships f WHERE
        (f.member_low_id=u.id AND f.member_high_id=(SELECT id FROM content_owner)) OR
        (f.member_high_id=u.id AND f.member_low_id=(SELECT id FROM content_owner))) AS content_friend,
      (EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=u.id AND f.followed_id=(SELECT id FROM content_owner)) OR
       EXISTS(SELECT 1 FROM friendships f WHERE
         (f.member_low_id=u.id AND f.member_high_id=(SELECT id FROM content_owner)) OR
         (f.member_high_id=u.id AND f.member_low_id=(SELECT id FROM content_owner)))) AS connection,
      ((SELECT is_private FROM users WHERE id=(SELECT id FROM content_owner))=0 OR u.id=(SELECT id FROM content_owner) OR
       EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=u.id AND f.followed_id=(SELECT id FROM content_owner))) AS can_view_account
    FROM users u LEFT JOIN account_state s ON s.user_id=u.id
    WHERE lower(u.username) IN (${names.map(()=>"?").join(",")}) AND u.id<>${V} AND u.is_virtual=0`, userId,contentOwner,...names);
  for (const account of records) {
    const permission = object(object(account.data).taggingPreferences).whoCanTag;
    if (await blocked(db,userId,account.id) || permission==="nobody" || permission==="following" && !account.follows) {
      throw new ApiError(403, `You can’t tag @${account.username} because of their tagging settings or your account relationship.`);
    }
    const accountVisible=account.can_view_account || ["connections","friends"].includes(visibility) && account.content_friend;
    if (!skipVisibility && (!accountVisible || visibility==="close-friends" && !account.close_friend ||
        visibility==="connections" && !account.connection ||
        visibility==="followers" && !account.follows || visibility==="friends" && !account.content_friend)) {
      throw new ApiError(403, `You can’t tag @${account.username} because they cannot view this content.`);
    }
  }
  return records;
}

async function postPayloadHash(input: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function createPostIdempotencyKey(request: Request) {
  const header = request.headers.get("Idempotency-Key");
  if (header === null) return null;
  const key = header.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key)) {
    throw new ApiError(400, "The publication retry key is invalid.");
  }
  return key;
}
async function replayIdempotentPost(db: Database, userId: string, key: string, payloadHash: string) {
  const stored = await db.prepare(`SELECT payload_hash,post_id FROM post_idempotency_keys
    WHERE user_id=? AND idempotency_key=?`).bind(userId,key)
    .first<{payload_hash:string;post_id:string}>();
  if (!stored) return null;
  if (stored.payload_hash !== payloadHash) {
    throw new ApiError(409, "This publication was already sent with different content. Your original post was not duplicated.");
  }
  const post = await getPost(db,userId,stored.post_id);
  if (!post) throw new ApiError(409, "This publication was already completed, but the post is no longer available.");
  const response = json({post:(await hydratePosts(db,userId,[post]))[0]},200);
  response.headers.set("Idempotency-Replayed","true");
  return response;
}

async function createPost(
  request: Request,
  db: Database,
  userId: string,
  ai?: WorkersAiBinding,
  bucket?: MediaBucket,
) {
  const input = validate(CreatePostBody.safeParse(await body(request)), "Add text or up to 10 media files to your post.");
  if (input.workoutId || input.sportsCardId) throw new ApiError(410, "Sports publishing is currently disabled.");
  const idempotencyKey=createPostIdempotencyKey(request);
  const payloadHash=idempotencyKey ? await postPayloadHash(input) : null;
  if (idempotencyKey && payloadHash) {
    const replay=await replayIdempotentPost(db,userId,idempotencyKey,payloadHash);
    if (replay) return replay;
  }
  const text = input.text.trim();
  const media = [...new Set(input.mediaIds ?? [])];
  if (!text && !media.length) throw new ApiError(400,"Add text or up to 10 media files to your post.");
  const visibility = input.visibility ?? "public";
  const audioSourcePostId = input.audioSourcePostId ?? null;
  const audioSourceSoundId = input.audioSourceSoundId ?? null;
  let audioReuseAllowed = input.audioReuseAllowed === true;
  const audioRightsConfirmed = input.audioRightsConfirmed === true;
  let audioOwner: { is_private: number; username: string; display_name: string; sound_reuse_enabled: number } | null = null;
  let librarySoundId = audioSourceSoundId;
  if (audioReuseAllowed) {
    audioOwner = await db.prepare(`SELECT u.is_private,u.username,u.display_name,
        COALESCE(json_extract(state.data,'$.soundReuseEnabled'),1) AS sound_reuse_enabled
      FROM users u LEFT JOIN account_state state ON state.user_id=u.id WHERE u.id=?`)
      .bind(userId).first<{is_private:number;username:string;display_name:string;sound_reuse_enabled:number}>();
    audioReuseAllowed = audioOwner?.sound_reuse_enabled !== 0;
  }
  if (visibility==="close-friends" && !await db.prepare("SELECT 1 FROM close_friend_members WHERE owner_id=? LIMIT 1").bind(userId).first()) {
    throw new ApiError(400,"Add at least one person to Close Friends first.");
  }
  if (input.remixSourcePostId && !await getPost(db,userId,input.remixSourcePostId)) {
    throw new ApiError(404,"The original post is unavailable or no longer visible.");
  }
  let assets: ModerationAsset[] = [];
  if (media.length) {
    assets = await rows<ModerationAsset>(db, `SELECT m.id,m.object_key,m.content_type,m.size,m.sha256,m.thumbnail_id,
      t.object_key AS thumbnail_object_key,t.content_type AS thumbnail_content_type,
      t.size AS thumbnail_size,t.sha256 AS thumbnail_sha256
      FROM user_media_assets m LEFT JOIN user_media_assets t ON t.id=m.thumbnail_id AND t.user_id=m.user_id
        AND t.ready=1 AND t.storage_scope=m.storage_scope AND t.media_role='thumbnail'
      WHERE m.id IN (${media.map(()=>"?").join(",")}) AND m.user_id=? AND m.ready=1 AND m.media_role='media'
      AND m.storage_scope='public' AND (m.content_type LIKE 'image/%' OR m.content_type LIKE 'video/%')`,...media,userId);
    if (assets.length!==media.length) throw new ApiError(400,"Every post attachment must be confirmed in your account first.");
  }
  if (audioReuseAllowed && !audioRightsConfirmed) {
    throw new ApiError(400,"Confirm that you own or are authorized to share this audio.");
  }
  if (audioReuseAllowed && (audioSourcePostId || audioSourceSoundId)) {
    throw new ApiError(400,"Only the original audio creator can grant reuse permission.");
  }
  if (audioSourcePostId && audioSourceSoundId) throw new ApiError(400,"Choose one original sound source.");
  if (audioReuseAllowed && !assets.some(asset=>asset.content_type.startsWith("video/"))) {
    throw new ApiError(400,"Only a video with original audio can grant reuse permission.");
  }
  if (audioReuseAllowed) {
    if (visibility!=="public" || audioOwner?.is_private!==0) {
      throw new ApiError(400,"Sound reuse is available only on public posts from public accounts.");
    }
  }
  if (audioSourcePostId) {
    const source=await getPost(db,userId,audioSourcePostId);
    if (!source || source.visibility!=="public" || source.author_is_private!==0 || source.audio_reuse_allowed_effective!==1) {
      throw new ApiError(403,"The original creator no longer allows this sound to be reused.");
    }
    const sourceVideo=await db.prepare(`SELECT 1 FROM post_media_assets pm
      JOIN user_media_assets m ON m.id=pm.media_id
      WHERE pm.post_id=? AND m.ready=1 AND m.content_type LIKE 'video/%' LIMIT 1`).bind(source.id).first();
    if (!sourceVideo) throw new ApiError(400,"The original sound is unavailable.");
  }
  if (librarySoundId) {
    const source=await db.prepare(`SELECT s.id FROM sound_library s
      LEFT JOIN users owner ON owner.id=s.owner_id
      LEFT JOIN account_state owner_state ON owner_state.user_id=owner.id
      JOIN user_media_assets m ON m.id=s.media_id
      WHERE s.id=? AND s.reuse_allowed=1 AND COALESCE(owner.is_private,0)=0
        AND COALESCE(json_extract(owner_state.data,'$.soundReuseEnabled'),1)=1
        AND m.ready=1 AND m.storage_scope='public' AND m.content_type LIKE 'audio/%'
        AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
          (b.owner_id=? AND b.blocked_id=s.owner_id) OR (b.blocked_id=? AND b.owner_id=s.owner_id))`)
      .bind(librarySoundId,userId,userId).first();
    if (!source) throw new ApiError(403,"The original creator no longer allows this sound to be reused.");
  }
  const place = validate(placeTagSchema.nullable().optional().safeParse(input.place),"Choose a valid named place.");
  const recipients = await mentionRecipients(db,userId,text,visibility);
  const postDestination=input.destination??"main";
  if(visibility==="public"&&["main","both"].includes(postDestination)&&media.length){
    const uploadedVideos=await rows<{size:number}>(db,
      `SELECT size FROM user_media_assets WHERE user_id=? AND ready=1 AND id IN (${media.map(()=>"?").join(",")})
       AND content_type LIKE 'video/%'`,userId,...media);
    if(uploadedVideos.some(asset=>asset.size>MAX_PUBLIC_FEED_VIDEO_BYTES)){
      throw new ApiError(400,"Public feed videos must be 16 MB or smaller after compression.");
    }
  }
  if (!bucket) throw new ApiError(503,"Content review is not available yet. Nothing was published.");
  await moderatePublication(ai,bucket,text,assets);
  const id = crypto.randomUUID(), now=Date.now();
  const statements = [
    ...(idempotencyKey && payloadHash ? [db.prepare(`INSERT INTO post_idempotency_keys
      (user_id,idempotency_key,payload_hash,post_id,created_at) VALUES(?,?,?,?,?)`)
      .bind(userId,idempotencyKey,payloadHash,id,now)] : []),
    db.prepare(`INSERT INTO posts (id,author_id,text,visibility,destination,place,remix_source_post_id,audio_source_post_id,
      audio_source_sound_id,audio_reuse_allowed,audio_rights_confirmed_at,created_at,text_fingerprint,meaningful)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,userId,text,visibility,postDestination,
        place ? JSON.stringify(place) : null,input.remixSourcePostId ?? null,
        librarySoundId ? null : audioSourcePostId,librarySoundId,
        Number(audioReuseAllowed),audioReuseAllowed?now:null,now,textFingerprint(text),Number(meaningful(text))),
    ...media.map((mediaId,position)=>db.prepare("INSERT INTO post_media_assets(post_id,media_id,position) VALUES(?,?,?)").bind(id,mediaId,position)),
    ...recipients.map(account=>db.prepare(`INSERT INTO content_mentions
      (id,recipient_id,actor_id,kind,post_id,created_at) VALUES(?,?,?,'post',?,?)`).bind(crypto.randomUUID(),account.id,userId,id,now)),
    ...discoveryIndexStatements(db,{id,text,visibility,place:place?JSON.stringify(place):null}),
  ];
  try {
    await db.batch(statements);
  } catch (failure) {
    if (idempotencyKey && payloadHash) {
      // Concurrent identical requests can race the unique key. D1 rolls back
      // the losing batch atomically, so return the winning confirmed post.
      const replay=await replayIdempotentPost(db,userId,idempotencyKey,payloadHash);
      if (replay) return replay;
    }
    throw failure;
  }
  const post = await getPost(db,userId,id);
  if (!post) throw new Error("Created post could not be loaded.");
  return json({post:(await hydratePosts(db,userId,[post]))[0]},201);
}

async function feed(request: Request, db: Database, userId: string) {
  const startedAt = performance.now();
  const params = validate(ListFeedQueryParams.safeParse(query(request)),"The feed request is invalid.");
  const {surface,limit,offset} = params;
  const community = surface==="community" || surface==="community-following";
  const communitySource = surface==="community-following"
    ? `(p.destination IN ('community','both') AND ${followedAuthor})`
    : `(p.destination IN ('community','both') AND ${connected}) OR ${repostedByFollowed}`;
  const condition = community ? `(${communitySource})`
    : surface==="following" ? `p.destination='main' AND ${followedAuthor}`
      : `p.destination='main'`;
  const windowSize = surface==="main" ? 72 : limit;
  const windowStart = surface==="main" ? Math.floor(offset/windowSize)*windowSize : offset;
  const rowsStartedAt = performance.now();
  const records = await loadPostRows(db,userId,condition,[],windowSize+1,windowStart);
  const rowsMs = performance.now() - rowsStartedAt;
  const rankRecords = records.slice(0,windowSize);
  const hasWindowMore = surface==="main" && records.length>windowSize;
  const rankStartedAt = performance.now();
  const rankAuthors = [...new Set(rankRecords.map(post=>post.author_id))];
  const authorFollowers = surface==="main" && rankAuthors.length
    ? await rows<{followed_id:string;followers:number}>(db,
      `SELECT followed_id,count(*) AS followers FROM user_follows WHERE followed_id IN (${rankAuthors.map(()=>"?").join(",")}) GROUP BY followed_id`,
      ...rankAuthors)
    : [];
  const followersByAuthor = new Map(authorFollowers.map(row=>[row.followed_id,row.followers]));
  const saved = rankRecords.length
    ? await db.prepare("SELECT data FROM account_state WHERE user_id=?").bind(userId).first<{data:string}>()
    : null;
  const state=object(saved?.data), interests=feedInterests(object(state.profile).interests,object(state.interestPreferences));
  const interestTopics = new Set(interestTopicIds([...interests]));
  const discoveryPreferences = surface==="main" && rankRecords.length
    ? await db.prepare("SELECT hidden_topics,personalize FROM discovery_preferences WHERE user_id=?")
      .bind(userId).first<{hidden_topics:string;personalize:number}>()
    : null;
  const learnedInterests = surface==="main" && discoveryPreferences?.personalize!==0
    ? await learnedTopicInterests(db,userId)
    : [];
  const topicFeedback = new Map<string,number>();
  for(const interest of learnedInterests) {
    topicFeedback.set(interest.topic_id,Math.max(-4,Math.min(4,
      interest.followed?Math.max(1.5,interest.score):interest.score)));
  }
  const hiddenIds=jsonStringArray(discoveryPreferences?.hidden_topics);
  if(hiddenIds.length) {
    const redirects=await rows<{id:string;merged_into:string|null}>(db,
      "SELECT id,merged_into FROM discovery_topics WHERE id IN (SELECT value FROM json_each(?))",
      JSON.stringify(hiddenIds));
    for(const id of hiddenIds) {
      const canonical=redirects.find(topic=>topic.id===id)?.merged_into||id;
      topicFeedback.set(canonical,Math.min(topicFeedback.get(canonical)??0,-4));
    }
  }
  const postTopicRows=surface==="main" && rankRecords.length
    ? await rows<{post_id:string;topic_id:string}>(db,
      `SELECT pt.post_id,coalesce(t.merged_into,t.id) AS topic_id
       FROM discovery_post_topics pt JOIN discovery_topics t ON t.id=pt.topic_id
       WHERE pt.post_id IN (${rankRecords.map(()=>"?").join(",")}) AND t.status<>'suppressed'`,
      ...rankRecords.map(post=>post.id))
    : [];
  const topicsByPost=new Map<string,Set<string>>();
  for(const row of postTopicRows) {
    const topics=topicsByPost.get(row.post_id)||new Set<string>();
    topics.add(row.topic_id);
    topicsByPost.set(row.post_id,topics);
  }
  const now=Date.now();
  let ranks=rankFeedCandidates(rankRecords.map(p=>{
    const topics=classifyDiscovery({text:p.text}).map(topic=>topic.id);
    const indexedTopics=topicsByPost.get(p.id)||new Set<string>();
    return {
      id:p.id,authorId:p.author_id,createdAt:p.created_at,text:p.text,likeCount:p.human_like_count,
      repostCount:p.repost_count,distinctCommenters:p.human_commenter_count,followedAuthor:!!p.followed,
      likedByMe:!!p.liked,repostedByMe:p.repost_note!==null,watchProgress:0,qualifiedViewRecently:false,
      interestMatches:topics.filter(topic=>interestTopics.has(topic)).length+
        [...indexedTopics].reduce((score,topic)=>score+(topicFeedback.get(topic)||0),0),
      newCreator: now-p.joined_at<30*24*60*60*1000,
      authorFollowerCount:followersByAuthor.get(p.author_id)??0,
    };
  }),surface as FeedSurface,now);
  if(surface==="main"&&ranks.length){
    const signals=await rows<{post_id:string;author_id:string}>(db,
      "SELECT post_id,author_id FROM feed_recommendation_feedback WHERE owner_id=? ORDER BY created_at DESC LIMIT 500",userId);
    ranks=downrankNotInterestedCreators(ranks,signals.map(signal=>({postId:signal.post_id,authorId:signal.author_id})));
  }
  const rankMs=performance.now()-rankStartedAt;
  const localOffset=surface==="main"?offset-windowStart:0;
  const pageIds=ranks.slice(localOffset,localOffset+limit).map(post=>post.id);
  const page=pageIds.flatMap(id=>rankRecords.find(post=>post.id===id)?[rankRecords.find(post=>post.id===id)!]:[]);
  const hydrateStartedAt = performance.now();
  const posts = await hydratePosts(db,userId,page);
  const hydrateMs = performance.now() - hydrateStartedAt;
  let response: Response;
  const hasMore=surface==="main"
    ? hasWindowMore || localOffset+page.length<rankRecords.length
    : records.length>limit;
  const nextOffset=surface==="main"
    ? windowStart+localOffset+page.length
    : offset+page.length;
  response = json({posts,hasMore,nextOffset});
  const timing = {
    rowsMs: Math.round(rowsMs * 10) / 10,
    hydrateMs: Math.round(hydrateMs * 10) / 10,
    rankMs: Math.round(rankMs * 10) / 10,
    totalMs: Math.round((performance.now() - startedAt) * 10) / 10,
  };
  response.headers.set("server-timing",
    `feed_rows;dur=${timing.rowsMs}, feed_hydrate;dur=${timing.hydrateMs}, feed_rank;dur=${timing.rankMs}, feed_total;dur=${timing.totalMs}`);
  if (Math.random() < 0.25) console.info("oldtime_performance_feed", timing);
  return response;
}

async function placeFeed(request: Request, db: Database, userId: string) {
  const p=validate(ListPlaceFeedQueryParams.safeParse(query(request)),"The place feed query is invalid.");
  if ((!p.placeId && p.label) || p.placeId?.startsWith("custom:") && !p.label) throw new ApiError(400,"Choose a valid place.");
  let condition=publicPlace;
  const values:unknown[]=[];
  if (p.placeId) {
    condition+=p.placeId.startsWith("custom:")
      ? " AND json_extract(p.place,'$.source')='custom' AND lower(trim(json_extract(p.place,'$.label')))=?"
      : " AND json_extract(p.place,'$.id')=?";
    values.push(p.placeId.startsWith("custom:") ? p.label!.trim().toLowerCase() : p.placeId);
  }
  if (p.q) {
    condition+=" AND (instr(lower(json_extract(p.place,'$.label')),?)>0 OR instr(lower(p.text),?)>0)";
    values.push(p.q.trim().toLowerCase(),p.q.trim().toLowerCase());
  }
  const records=await loadPostRows(db,userId,condition,values,p.limit+1,p.offset,false,p.sort);
  const page=records.slice(0,p.limit);
  return json({posts:await hydratePosts(db,userId,page),hasMore:records.length>p.limit,nextOffset:p.offset+page.length,attribution});
}
async function placeDiscovery(request: Request, db: Database, userId: string) {
  const p=validate(GetPlacesDiscoveryQueryParams.safeParse(query(request)),"The place discovery query is invalid.");
  const records=await rows<{place:string;post_count:number;creator_count:number;latest_at:number;latest_post_id:string}>(db, `
    ${viewerCte} SELECT p.place,count(*) AS post_count,count(DISTINCT p.author_id) AS creator_count,
      max(p.created_at) AS latest_at,
       (SELECT pp.id FROM posts pp WHERE pp.archived_at IS NULL AND pp.place=p.place ORDER BY pp.created_at DESC,pp.id DESC LIMIT 1) AS latest_post_id
    FROM posts p JOIN users u ON u.id=p.author_id WHERE ${publicPlace} AND ${notBlocked}
    AND instr(lower(json_extract(p.place,'$.label')),?)>0
    GROUP BY p.place ORDER BY post_count DESC,latest_at DESC LIMIT 24`,userId,p.q?.trim().toLowerCase() ?? "");
  const places=[];
  for (const record of records) {
    const place=placeTagSchema.safeParse(object(record.place));
    if (!place.success) continue;
    const preview=await db.prepare(`SELECT m.id,m.thumbnail_id,m.content_type FROM post_media_assets pm
      JOIN user_media_assets m ON m.id=pm.media_id WHERE pm.post_id=? AND m.ready=1 ORDER BY pm.position LIMIT 1`)
      .bind(record.latest_post_id).first<{id:string;thumbnail_id:string|null;content_type:string}>();
    const video=preview?.content_type.startsWith("video/"), previewId=video ? preview?.thumbnail_id : preview?.id;
    places.push({place:place.data,postCount:record.post_count,creatorCount:record.creator_count,latestAt:record.latest_at,
      previewReference:previewId ? `oldtime-media:${previewId}` : null,previewType:preview ? video ? "video" : "image" : null});
  }
  const ratings=await placeRatings(db,userId,places.map(item=>item.place.id));
  return json(GetPlacesDiscoveryResponse.parse({places:places.map(item=>({...item,placeRating:ratings.get(item.place.id)||null})),attribution}));
}
async function profiles(request: Request, db: Database, userId: string, path: string) {
  const match=/^\/profiles\/([a-zA-Z0-9_]{3,24})(\/reposts)?$/.exec(path);
  if (!match) throw new ApiError(404,"Profile not found.");
  const account=await db.prepare(`SELECT u.id,u.username,u.display_name,u.created_at,u.is_private,u.followers_visible,u.following_visible,s.data
    FROM users u LEFT JOIN account_state s ON s.user_id=u.id WHERE lower(u.username)=? AND u.is_virtual=0`)
    .bind(match[1].toLowerCase()).first<{id:string;username:string;display_name:string;created_at:number;is_private:number;followers_visible:number;following_visible:number;data:string|null}>();
  if (!account || await blocked(db,userId,account.id)) throw new ApiError(404,"Profile not found.");
  if (match[2]) {
    const p=validate(ListFeedQueryParams.safeParse(query(request)),"The repost list request is invalid.");
    if (account.is_private && account.id!==userId && !await db.prepare("SELECT 1 FROM user_follows WHERE follower_id=? AND followed_id=?").bind(userId,account.id).first()) {
      throw new ApiError(404,"Profile not found.");
    }
    const records=await loadPostRows(db,userId,`EXISTS(SELECT 1 FROM post_reposts r WHERE r.post_id=p.id AND r.user_id=?)`,[account.id],p.limit+1,p.offset);
    return json({posts:await hydratePosts(db,userId,records.slice(0,p.limit)),hasMore:records.length>p.limit,nextOffset:p.offset+Math.min(records.length,p.limit)});
  }
  const showRelations=!account.is_private||account.id===userId||!!await db.prepare(
    "SELECT 1 FROM user_follows WHERE follower_id=? AND followed_id=?").bind(userId,account.id).first();
  const relationshipPreview=async(followers:boolean)=>{
    if(!showRelations || account.id!==userId && !profileListVisibility(account)[followers?"followers":"following"])return [];
    const member=followers?"f.follower_id":"f.followed_id",target=followers?"f.followed_id":"f.follower_id";
    const people=await rows<{id:string;username:string;display_name:string;created_at:number;data:string|null}>(db,`${viewerCte}
      SELECT u.id,u.username,u.display_name,u.created_at,s.data FROM user_follows f JOIN users u ON u.id=${member}
      LEFT JOIN account_state s ON s.user_id=u.id WHERE ${target}=? AND u.is_virtual=0
      AND (u.is_private=0 OR ?=?) AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
        (b.owner_id=${V} AND b.blocked_id=u.id) OR (b.owner_id=u.id AND b.blocked_id=${V}))
      ORDER BY f.created_at DESC,u.id LIMIT 3`,userId,account.id,userId,account.id);
    return people.map(person=>({id:person.id,username:person.username,displayName:person.display_name,
      joinedAt:person.created_at,...publicDetails(person.data)}));
  };
  const [followerPreviews,followingPreviews]=await Promise.all([relationshipPreview(true),relationshipPreview(false)]);
  const records=await loadPostRows(db,userId,"p.author_id=? AND p.destination='main'",[account.id],50);
  const count=await db.prepare(`${viewerCte} SELECT count(*) AS total,
    coalesce(sum((SELECT count(*) FROM analytics_events e JOIN analytics_resources ar ON ar.id=e.resource_id
      WHERE ar.owner_id=p.author_id AND ar.source_id=p.id AND e.kind='view')),0) AS viewCount,
    (SELECT count(*) FROM user_follows f JOIN users fu ON fu.id=f.follower_id
      WHERE f.followed_id=? AND fu.is_virtual=0) AS followerCount,
    (SELECT count(*) FROM user_follows f JOIN users fu ON fu.id=f.followed_id
      WHERE f.follower_id=? AND fu.is_virtual=0) AS followingCount
    FROM posts p JOIN users u ON u.id=p.author_id WHERE ${visiblePost} AND p.author_id=?`)
    .bind(userId,account.id,account.id,account.id)
    .first<{total:number;viewCount:number;followerCount:number;followingCount:number}>();
  return json({profile:{id:account.id,username:account.username,displayName:account.display_name,joinedAt:account.created_at,...publicDetails(account.data),profileListVisibility:profileListVisibility(account)},
    posts:await hydratePosts(db,userId,records),postCount:count?.total ?? 0,
    stats:{viewCount:Number(count?.viewCount)||0,followerCount:Number(count?.followerCount)||0,followingCount:Number(count?.followingCount)||0,
      followerPreviews,followingPreviews}});
}
async function searchUsers(request: Request, db: Database, userId: string, mentions: boolean) {
  const q=new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length<2 || q.length>80) throw new ApiError(400,"Enter a username or name to search.");
  const accounts=await rows<{id:string;username:string;display_name:string;created_at:number;data:string|null}>(db,`
    ${viewerCte} SELECT u.id,u.username,u.display_name,u.created_at,s.data FROM users u
    LEFT JOIN account_state s ON s.user_id=u.id WHERE u.is_virtual=0 AND (instr(lower(u.username),?)>0 OR instr(lower(u.display_name),?)>0)
    AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
      (b.owner_id=${V} AND b.blocked_id=u.id) OR (b.blocked_id=${V} AND b.owner_id=u.id))
    ${mentions ? `AND (u.id=${V} OR (coalesce(json_extract(s.data,'$.taggingPreferences.whoCanTag'),'everyone')<>'nobody'
      AND (coalesce(json_extract(s.data,'$.taggingPreferences.whoCanTag'),'everyone')<>'following'
      OR EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=u.id AND f.followed_id=${V}))))` : ""}
    ORDER BY u.username LIMIT 30`,userId,q,q);
  return json({users:accounts.map(u=>({id:u.id,username:u.username,displayName:u.display_name,joinedAt:u.created_at,...publicDetails(u.data)}))});
}

async function communityPostThread(request: Request, db: Database, userId: string, postId: string) {
  const selected = await getPost(db,userId,postId);
  if (!selected || selected.archived_at) throw new ApiError(404,"Post not found.");
  const selectedThread = await db.prepare("SELECT thread_id FROM posts WHERE id=?").bind(postId).first<{thread_id:string|null}>();
  const rootId = selectedThread?.thread_id || postId;
  const root = await getPost(db,userId,rootId);
  if (!root || root.archived_at || root.author_id !== selected.author_id) throw new ApiError(404,"Conversation not found.");
  if (!["community","both"].includes(root.destination)) throw new ApiError(404,"Community conversation not found.");
  if (request.method === "GET") {
    const records = await loadPostRows(db,userId,"p.thread_id=?",[rootId],11);
    const posts = records.length ? await hydratePosts(db,userId,records) : await hydratePosts(db,userId,[root]);
    return json({threadId:rootId,posts,position:Math.max(0,records.findIndex(item=>item.id===postId))});
  }
  if (request.method !== "POST") throw new ApiError(405,"Method not allowed.");
  if (root.author_id !== userId) throw new ApiError(403,"Only the author can add posts to this conversation.");
  const parsed = z.object({postIds:z.array(z.string().uuid()).min(1).max(9)}).strict().safeParse(await body(request));
  if (!parsed.success) throw new ApiError(400,"Add between 1 and 9 posts to your conversation.");
  const childIds = [...new Set(parsed.data.postIds)];
  if (childIds.length !== parsed.data.postIds.length || childIds.includes(rootId)) {
    throw new ApiError(400,"Each conversation post must be unique.");
  }
  const existing = await rows<{id:string;thread_position:number|null}>(db,
    "SELECT id,thread_position FROM posts WHERE thread_id=? ORDER BY thread_position",rootId);
  const already = new Map(existing.map(item=>[item.id,item.thread_position]));
  const pending = childIds.filter(id=>!already.has(id));
  const rootAlreadyLinked = existing.some(item=>item.id===rootId);
  const existingChildren = existing.filter(item=>item.id!==rootId).length;
  if (existingChildren + pending.length + 1 > 10) throw new ApiError(400,"A conversation can contain up to 10 posts.");
  const nextPosition = Math.max(0,...existing.map(item=>Number(item.thread_position)||0)) + 1;
  const children = await Promise.all(pending.map(id=>getPost(db,userId,id)));
  if (children.some(post=>!post || post.archived_at || post.author_id!==userId ||
      post.visibility!==root.visibility || post.destination!==root.destination)) {
    throw new ApiError(400,"Every part must be your own Community post with the same audience.");
  }
  const otherThreads = await rows<{id:string;thread_id:string|null}>(db,
    `SELECT id,thread_id FROM posts WHERE id IN (${pending.map(()=>"?").join(",")})`,...pending);
  if (otherThreads.some(item=>item.thread_id && item.thread_id!==rootId)) {
    throw new ApiError(409,"A post can belong to only one conversation.");
  }
  const statements = [
    db.prepare("UPDATE posts SET thread_id=?,thread_position=0 WHERE id=? AND thread_id IS NULL").bind(rootId,rootId),
    ...pending.map((id,index)=>db.prepare("UPDATE posts SET thread_id=?,thread_position=? WHERE id=? AND author_id=? AND thread_id IS NULL")
      .bind(rootId,nextPosition+index,id,userId)),
  ];
  if (statements.length) await db.batch(statements);
  const verified = await rows<{id:string;thread_position:number|null}>(db,
    "SELECT id,thread_position FROM posts WHERE thread_id=? ORDER BY thread_position",rootId);
  if (verified.length !== existing.length + pending.length + (rootAlreadyLinked ? 0 : 1)) {
    throw new ApiError(409,"The conversation changed while it was being saved. Refresh and try again.");
  }
  const records = await loadPostRows(db,userId,"p.thread_id=?",[rootId],11);
  return json({threadId:rootId,posts:await hydratePosts(db,userId,records),position:0});
}

export async function socialRequest(
  request: Request,
  db: Database,
  userId: string,
  path: string,
  ai?: WorkersAiBinding,
  bucket?: MediaBucket,
): Promise<Response> {
  const liked=/^\/posts\/([a-f0-9-]{36})\/likes$/.exec(path);
  if(liked&&request.method==="GET")return postLikes(request,db,userId,liked[1]);
  if (path==="/feed" && request.method==="GET") return feed(request,db,userId);
  if(path==="/feed/feedback"&&request.method==="GET"){
    const signals=await rows<{post_id:string;author_id:string}>(db,
      "SELECT post_id,author_id FROM feed_recommendation_feedback WHERE owner_id=? ORDER BY created_at DESC LIMIT 500",userId);
    return json({postIds:signals.map(signal=>signal.post_id),authorIds:[...new Set(signals.map(signal=>signal.author_id))]});
  }
  if(path==="/feed/feedback"&&request.method==="POST"){
    const input=object(await body(request));
    const postId=typeof input.postId==="string"?input.postId:"";
    if(Object.keys(input).some(key=>key!=="postId")||!/^[a-f0-9-]{36}$/i.test(postId)){
      throw new ApiError(400,"Choose a valid post.");
    }
    const post=await getPost(db,userId,postId);
    if(!post||post.author_id===userId||post.visibility!=="public"||
      !["main","both"].includes(post.destination)||post.author_is_private!==0){
      throw new ApiError(404,"That post is no longer available to your recommendations.");
    }
    await db.prepare(`INSERT INTO feed_recommendation_feedback(owner_id,post_id,author_id,created_at) VALUES(?,?,?,?)
      ON CONFLICT(owner_id,post_id) DO UPDATE SET author_id=excluded.author_id,created_at=excluded.created_at`)
      .bind(userId,post.id,post.author_id,Date.now()).run();
    return json({ok:true});
  }
  if (path==="/posts/archived" && request.method==="GET") {
    const params=validate(ListFeedQueryParams.safeParse(query(request)),"The archive query is invalid.");
    const records=await loadPostRows(db,userId,"1=1",[],params.limit+1,params.offset,true);
    const page=records.slice(0,params.limit);
    const posts=await hydratePosts(db,userId,page);
    return json({
      posts:posts.map((post,index)=>({...post,archivedAt:page[index].archived_at})),
      hasMore:records.length>params.limit,
      nextOffset:params.offset+page.length,
    });
  }
  const archiveMatch=/^\/posts\/([a-f0-9-]{36})\/archive$/.exec(path);
  if (archiveMatch && ["PUT","DELETE"].includes(request.method)) {
    const [,id]=archiveMatch;
    const record=await db.prepare("SELECT author_id FROM posts WHERE id=?").bind(id).first<{author_id:string}>();
    if (!record) throw new ApiError(404,"Post not found.");
    if (record.author_id!==userId) throw new ApiError(403,"You can only archive your own posts.");
    const archived=request.method==="PUT";
    const archivedAt=archived ? Date.now() : null;
    await db.prepare("UPDATE posts SET archived_at=? WHERE id=? AND author_id=?")
      .bind(archivedAt,id,userId).run();
    if (archived) {
      // A retained sound is independent of its original post. Keep its media and
      // creator snapshot, but clear the optional link to this archived source.
      await db.prepare("UPDATE sound_library SET source_post_id=NULL WHERE source_post_id=?").bind(id).run();
    }
    return json({ok:true,archived,archivedAt});
  }
  if (path==="/posts" && request.method==="POST") return createPost(request,db,userId,ai,bucket);
  if (path==="/places/feed" && request.method==="GET") return placeFeed(request,db,userId);
  if (path==="/places/discovery" && request.method==="GET") return placeDiscovery(request,db,userId);
  const profileListMatch=/^\/profiles\/([a-zA-Z0-9_]{3,24})\/(followers|following)$/.exec(path);
  if (profileListMatch && request.method==="GET") return publicProfileList(request,db,userId,profileListMatch[1],profileListMatch[2] as "followers"|"following");
  if (path.startsWith("/profiles/") && request.method==="GET") return profiles(request,db,userId,path);
  if ((path==="/users/search" || path==="/users/mention-search") && request.method==="GET") return searchUsers(request,db,userId,path.includes("mention"));
  const threadMatch=/^\/posts\/([a-f0-9-]{36})\/thread$/.exec(path);
  if(threadMatch) return communityPostThread(request,db,userId,threadMatch[1]);
  const match=/^\/posts\/([a-f0-9-]{36})(?:\/(like|repost))?$/.exec(path);
  if (!match) throw new ApiError(404,"Post not found.");
  const [,id,action]=match;
  if (!action && request.method==="DELETE") {
    const record=await db.prepare("SELECT author_id FROM posts WHERE id=?").bind(id).first<{author_id:string}>();
    if (!record) throw new ApiError(404,"Post not found.");
    if (record.author_id!==userId) throw new ApiError(403,"You can only delete your own posts.");
    await db.prepare("DELETE FROM posts WHERE id=? AND author_id=?").bind(id,userId).run();
    return json({ok:true});
  }
  const record=await getPost(db,userId,id);
  if (!record) throw new ApiError(404,"Post not found.");
  if (!action && request.method==="GET") return json({post:(await hydratePosts(db,userId,[record]))[0]});
  if (action && ["PUT","DELETE"].includes(request.method)) {
    const table=action==="like" ? "post_likes" : "post_reposts";
    if (request.method==="DELETE") await db.prepare(`DELETE FROM ${table} WHERE post_id=? AND user_id=?`).bind(id,userId).run();
    else if (action==="like") await db.prepare("INSERT INTO post_likes(user_id,post_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING").bind(userId,id,Date.now()).run();
    else {
      const parsed=validate(z.object({note:z.string().max(140).optional()}).safeParse(await body(request)),"Keep repost notes under 140 characters.");
      await db.prepare(`INSERT INTO post_reposts(post_id,user_id,note,created_at,updated_at) VALUES(?,?,?,?,?)
        ON CONFLICT(post_id,user_id) DO UPDATE SET note=excluded.note,updated_at=excluded.updated_at`).bind(id,userId,parsed.note ?? "",Date.now(),Date.now()).run();
    }
    const count=action==="like"
      ? await db.prepare(`SELECT count(*) AS total FROM post_likes l JOIN users u ON u.id=l.user_id
          WHERE l.post_id=? AND u.is_virtual=0`).bind(id).first<{total:number}>()
      : await db.prepare(`SELECT count(*) AS total FROM ${table} WHERE post_id=?`).bind(id).first<{total:number}>();
    if(request.method==="PUT")await recordPostTopicSignals(db,userId,id,action==="like"?"like":"share")
      .catch(error=>console.warn("Topic activity could not be updated",error));
    return action==="like"
      ? json({liked:request.method==="PUT",likeCount:count?.total ?? 0})
      : json({reposted:request.method==="PUT",repostCount:count?.total ?? 0});
  }
  if (record.author_id!==userId) throw new ApiError(403,"You can only edit your own posts.");
  if (!action && request.method==="PATCH") {
    const input=validate(z.object({text:z.string().trim().max(1000),visibility:z.enum(["public","connections","close-friends"]).optional(),place:placeTagSchema.nullable().optional()})
      .safeParse(await body(request)),"The post details are invalid.");
    const attachments=await rows<ModerationAsset>(db,`SELECT m.id,m.object_key,m.content_type,m.size,m.sha256,m.thumbnail_id,
      t.object_key AS thumbnail_object_key,t.content_type AS thumbnail_content_type,
      t.size AS thumbnail_size,t.sha256 AS thumbnail_sha256
      FROM post_media_assets pm JOIN user_media_assets m ON m.id=pm.media_id
      LEFT JOIN user_media_assets t ON t.id=m.thumbnail_id AND t.user_id=m.user_id
        AND t.ready=1 AND t.storage_scope=m.storage_scope AND t.media_role='thumbnail'
      WHERE pm.post_id=? AND m.ready=1 ORDER BY pm.position`,id);
    if (!input.text && !attachments.length) throw new ApiError(400,"A post without media needs a caption.");
    const visibility=input.visibility ?? record.visibility;
    if (visibility==="close-friends" && record.visibility!=="close-friends" &&
        !await db.prepare("SELECT 1 FROM close_friend_members WHERE owner_id=? LIMIT 1").bind(userId).first()) {
      throw new ApiError(400,"Add at least one person to Close Friends first.");
    }
    if (!bucket) throw new ApiError(503,"Content review is not available yet. Nothing was published.");
    const effectivePlace=input.place===undefined?record.place:input.place;
    await moderatePublication(ai,bucket,JSON.stringify({caption:input.text,place:effectivePlace}),attachments);
    const recipients=await mentionRecipients(db,userId,input.text,visibility);
    const discoveryExcluded=await excludedDiscoveryTopics(db,id);
    await db.batch([
      db.prepare("UPDATE posts SET text=?,visibility=?,place=?,text_fingerprint=?,meaningful=? WHERE id=? AND author_id=?")
        .bind(input.text,visibility,input.place===undefined ? record.place : input.place ? JSON.stringify(input.place) : null,textFingerprint(input.text),Number(meaningful(input.text)),id,userId),
      db.prepare("DELETE FROM content_mentions WHERE kind='post' AND post_id=?").bind(id),
      ...discoveryIndexStatements(db,{id,text:input.text,visibility,place:input.place===undefined?record.place:input.place?JSON.stringify(input.place):null},discoveryExcluded),
      ...recipients.map(a=>db.prepare("INSERT INTO content_mentions(id,recipient_id,actor_id,kind,post_id,created_at) VALUES(?,?,?,'post',?,?)").bind(crypto.randomUUID(),a.id,userId,id,Date.now())),
    ]);
    return json({post:(await hydratePosts(db,userId,[(await getPost(db,userId,id))!]))[0]});
  }
  throw new ApiError(405,"Method not allowed.");
}
