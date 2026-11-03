import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { canRatePlace } from "../lib/place-policy";
import { placeTagSchema, type PlaceTag } from "../lib/place-tag";
import {
  ApiError, body, json, object, rows, publicDetails, viewerCte, notBlocked,
  type Database,
} from "./runtime";

const placeId = z.string().regex(/^(custom:[a-zA-Z0-9_-]{1,90}|osm:(node|way|relation):[0-9]{1,18})$/);
const profileQuery = z.object({
  placeId,
  label: z.string().trim().max(140).optional(),
  peopleOffset: z.coerce.number().int().min(0).max(10000).default(0),
  reviewsOffset: z.coerce.number().int().min(0).max(10000).default(0),
});
export const reviewInput = z.object({
  placeId: placeId.refine(id => id.startsWith("osm:"), "Choose a place on the map."),
  rating: z.number().int().min(1).max(5),
  tip: z.string().trim().max(200).default(""),
  tags: z.array(z.enum(["Food", "View", "Cheap", "Busy", "Hidden gem"])).max(5).default([]),
}).strict();

// The same access rules apply to counts, People, posts and legacy-place lookup.
const publicPosts = `p.archived_at IS NULL AND p.visibility='public' AND p.destination='main'
  AND u.is_private=0 AND u.is_virtual=0 AND ${notBlocked}`;
const matchPlace = (id: string) => id.startsWith("custom:")
  ? `json_extract(p.place,'$.source')='custom' AND lower(trim(json_extract(p.place,'$.label')))=?`
  : `json_extract(p.place,'$.id')=?`;
const matchValue = (id: string, label = "") => id.startsWith("custom:") ? label.toLowerCase().trim() : id;
const eligibleReview = `u.is_virtual=0 AND NOT EXISTS (SELECT 1 FROM account_blocks b
  WHERE (b.owner_id=? AND b.blocked_id=r.user_id) OR (b.blocked_id=? AND b.owner_id=r.user_id))`;
type PersonRow = {id:string;username:string;display_name:string;data:string|null};
type ReviewRow = PersonRow & {review_id:string;rating:number;tip:string;tags:string;created_at:number;updated_at:number};
function person(r: PersonRow) {
  return {id:r.id,username:r.username,displayName:r.display_name,avatar:publicDetails(r.data).avatar || ""};
}
function review(r: ReviewRow) {
  let tags: unknown = [];
  try { tags = JSON.parse(r.tags); } catch { /* Old malformed tags must not break the profile. */ }
  return {id:r.review_id,userId:r.id,rating:r.rating,tip:r.tip,tags:Array.isArray(tags)?tags:[],
    createdAt:r.created_at,updatedAt:r.updated_at,author:person(r)};
}

async function resolvePlace(db: Database, viewer: string, id: string, label?: string): Promise<PlaceTag> {
  if (id.startsWith("custom:")) {
    if (!label?.trim()) throw new ApiError(400, "Choose a named place.");
    return {id,label:label.trim(),source:"custom"};
  }
  const stored = await db.prepare("SELECT * FROM places WHERE id=?").bind(id)
    .first<{id:string;label:string;category:string;address:string;lat:number;lon:number;kind:"venue"|"area"|"unknown";city:string}>();
  if (stored) return {id:stored.id,label:stored.label,source:"osm",lat:stored.lat,lon:stored.lon,
    category:stored.category,address:stored.address,city:stored.city,kind:stored.kind};
  // Preserve older tagged places without changing any existing post records.
  const tagged = await db.prepare(`${viewerCte} SELECT p.place FROM posts p JOIN users u ON u.id=p.author_id
    WHERE ${publicPosts} AND json_extract(p.place,'$.id')=? ORDER BY p.created_at DESC LIMIT 1`)
    .bind(viewer,id).first<{place:string}>();
  const parsed = placeTagSchema.safeParse(object(tagged?.place));
  if (!parsed.success || parsed.data.source !== "osm") throw new ApiError(404, "Search for this place again to load its map location.");
  const p = parsed.data;
  await db.prepare(`INSERT INTO places(id,label,category,address,lat,lon,updated_at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(id) DO NOTHING`).bind(p.id,p.label,p.category||"",p.address||"",p.lat,p.lon,Date.now()).run();
  return p;
}

async function getProfile(request: Request, db: Database, viewer: string) {
  const parsed = profileQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new ApiError(400,"Choose a valid place.");
  const q = parsed.data, place = await resolvePlace(db,viewer,q.placeId,q.label);
  const match = matchPlace(place.id), value = matchValue(place.id,place.label);
  const counts = await db.prepare(`${viewerCte} SELECT count(*) AS posts,count(DISTINCT p.author_id) AS people
    FROM posts p JOIN users u ON u.id=p.author_id WHERE ${publicPosts} AND ${match}`)
    .bind(viewer,value).first<{posts:number;people:number}>();
  const people = await rows<PersonRow>(db,`${viewerCte} SELECT u.id,u.username,u.display_name,s.data
    FROM posts p JOIN users u ON u.id=p.author_id LEFT JOIN account_state s ON s.user_id=u.id
    WHERE ${publicPosts} AND ${match}
    GROUP BY u.id,s.data ORDER BY max(p.created_at) DESC,u.id LIMIT 25 OFFSET ?`,viewer,value,q.peopleOffset);
  const [summary, tips, own, saved, cover] = await Promise.all([
    db.prepare(`SELECT avg(r.rating) AS average,count(*) AS count FROM place_reviews r JOIN users u ON u.id=r.user_id
      WHERE r.place_id=? AND ${eligibleReview}`).bind(place.id,viewer,viewer).first<{average:number|null;count:number}>(),
    rows<ReviewRow>(db,`SELECT r.id AS review_id,r.rating,r.tip,r.tags,r.created_at,r.updated_at,
      u.id,u.username,u.display_name,s.data FROM place_reviews r JOIN users u ON u.id=r.user_id
      LEFT JOIN account_state s ON s.user_id=u.id WHERE r.place_id=? AND ${eligibleReview}
      ORDER BY r.updated_at DESC,r.id DESC LIMIT 21 OFFSET ?`,place.id,viewer,viewer,q.reviewsOffset),
    db.prepare(`SELECT r.id AS review_id,r.rating,r.tip,r.tags,r.created_at,r.updated_at,
      u.id,u.username,u.display_name,s.data FROM place_reviews r JOIN users u ON u.id=r.user_id
      LEFT JOIN account_state s ON s.user_id=u.id WHERE r.place_id=? AND r.user_id=?`)
      .bind(place.id,viewer).first<ReviewRow>(),
    db.prepare("SELECT 1 FROM saved_places WHERE user_id=? AND place_id=?").bind(viewer,place.id).first(),
    db.prepare(`${viewerCte} SELECT m.id,m.thumbnail_id,m.content_type FROM posts p JOIN users u ON u.id=p.author_id
      JOIN post_media_assets pm ON pm.post_id=p.id JOIN user_media_assets m ON m.id=pm.media_id
      WHERE ${publicPosts} AND ${match} AND pm.position=0 AND m.ready=1
      ORDER BY (SELECT count(*) FROM post_likes l WHERE l.post_id=p.id) DESC,p.created_at DESC LIMIT 1`)
      .bind(viewer,value).first<{id:string;thumbnail_id:string|null;content_type:string}>(),
  ]);
  return json({place,postCount:counts?.posts||0,peopleCount:counts?.people||0,
    averageRating:summary?.average ?? null,ratingCount:summary?.count||0,canRate:canRatePlace(place),saved:!!saved,
    coverReference:cover?`oldtime-media:${cover.id}`:null,
    coverThumbnail:cover?.thumbnail_id?`oldtime-media:${cover.thumbnail_id}`:null,
    coverType:cover?.content_type.startsWith("video/")?"video":"image",
    ownReview:own?review(own):null,people:people.slice(0,24).map(person),peopleHasMore:people.length>24,
    peopleNextOffset:q.peopleOffset+Math.min(24,people.length),
    reviews:tips.slice(0,20).map(review),reviewsHasMore:tips.length>20,
    reviewsNextOffset:q.reviewsOffset+Math.min(20,tips.length)});
}

async function putReview(request: Request, db: Database, viewer: string) {
  const parsed = reviewInput.safeParse(await body(request,4096));
  if (!parsed.success) throw new ApiError(400,"Choose 1–5 stars, a tip up to 200 characters and supported tags.");
  const v = parsed.data;
  const place=await resolvePlace(db,viewer,v.placeId);
  if(!canRatePlace(place))throw new ApiError(400,"Ratings are available for venues such as cafes, shops and parks, rather than cities or countries.");
  const now = Date.now();
  // UNIQUE(place_id,user_id) makes retries, racing requests and edits one review.
  await db.prepare(`INSERT INTO place_reviews(id,place_id,user_id,rating,tip,tags,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(place_id,user_id) DO UPDATE SET
    rating=excluded.rating,tip=excluded.tip,tags=excluded.tags,updated_at=excluded.updated_at`)
    .bind(randomUUID(),v.placeId,viewer,v.rating,v.tip,JSON.stringify([...new Set(v.tags)]),now,now).run();
  const saved = await db.prepare(`SELECT r.id AS review_id,r.rating,r.tip,r.tags,r.created_at,r.updated_at,
    u.id,u.username,u.display_name,s.data FROM place_reviews r JOIN users u ON u.id=r.user_id
    LEFT JOIN account_state s ON s.user_id=u.id WHERE r.place_id=? AND r.user_id=?`)
    .bind(v.placeId,viewer).first<ReviewRow>();
  return json(review(saved!));
}

export async function placeProfileRequest(request: Request, db: Database, viewer: string, path: string) {
  if(path==="/places/saved"){
    if(request.method==="GET")return json({places:(await rows<{place_json:string}>(db,"SELECT place_json FROM saved_places WHERE user_id=? ORDER BY created_at DESC LIMIT 200",viewer)).map(r=>object(r.place_json))});
    const input=z.object({place:placeTagSchema}).strict().safeParse(await body(request,4096));
    if(!input.success)throw new ApiError(400,"Choose a place to save.");
    const place=await resolvePlace(db,viewer,input.data.place.id,input.data.place.label);
    if(request.method==="PUT")await db.prepare(`INSERT INTO saved_places(user_id,place_id,place_json,created_at) VALUES(?,?,?,?)
      ON CONFLICT(user_id,place_id) DO UPDATE SET place_json=excluded.place_json`).bind(viewer,place.id,JSON.stringify(place),Date.now()).run();
    else if(request.method==="DELETE")await db.prepare("DELETE FROM saved_places WHERE user_id=? AND place_id=?").bind(viewer,place.id).run();
    else throw new ApiError(405,"Method not allowed.");
    return json({saved:request.method==="PUT"});
  }
  if (path==="/places/profile" && request.method==="GET") return getProfile(request,db,viewer);
  if (path==="/places/reviews" && request.method==="PUT") return putReview(request,db,viewer);
  const report = /^\/places\/reviews\/([a-f0-9-]{36})\/report$/i.exec(path);
  if (report && request.method==="POST") {
    const input = z.object({reason:z.string().trim().min(1).max(500)}).strict().safeParse(await body(request,4096));
    if (!input.success) throw new ApiError(400,"Tell us why you are reporting this review.");
    const found = await db.prepare(`SELECT r.id FROM place_reviews r JOIN users u ON u.id=r.user_id
      WHERE r.id=? AND ${eligibleReview}`).bind(report[1],viewer,viewer).first();
    if (!found) throw new ApiError(404,"Review not found.");
    await db.prepare(`INSERT INTO place_review_reports(review_id,reporter_id,reason,created_at) VALUES(?,?,?,?)
      ON CONFLICT(review_id,reporter_id) DO UPDATE SET reason=excluded.reason`)
      .bind(report[1],viewer,input.data.reason,Date.now()).run();
    return json({reported:true});
  }
  throw new ApiError(405,"Method not allowed.");
}
