export interface D1Result<T> {
  results?: T[];
  success: boolean;
  meta?: { changes?: number };
}
export interface Statement {
  bind(...values: unknown[]): Statement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch<T = unknown>(statements: Statement[]): Promise<D1Result<T>[]>;
}
export interface R2Object {
  key: string; size: number; etag: string; httpEtag: string;
  uploaded?: Date;
  httpMetadata?: { contentType?: string };
}
export interface R2ObjectBody extends R2Object { body: ReadableStream<Uint8Array> }
export interface R2ListResult {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}
export interface R2ListOptions { prefix?: string; cursor?: string; limit?: number }
export interface MultipartUpload {
  uploadId: string;
  uploadPart(partNumber: number, value: ArrayBuffer | Uint8Array): Promise<{partNumber:number;etag:string}>;
  complete(parts: {partNumber:number;etag:string}[]): Promise<R2Object>;
  abort(): Promise<void>;
}
export interface MediaBucket {
  head(key: string): Promise<R2Object | null>;
  get(key: string, options?: {range?: {offset:number;length:number}}): Promise<R2ObjectBody | null>;
  list(options?: R2ListOptions): Promise<R2ListResult>;
  put(key: string, value: Uint8Array | ReadableStream, options?: {httpMetadata?:{contentType:string}}): Promise<R2Object | null>;
  delete(key: string | string[]): Promise<void>;
  createMultipartUpload(key:string,options?:{httpMetadata?:{contentType:string}}):Promise<MultipartUpload>;
  resumeMultipartUpload(key:string,uploadId:string):MultipartUpload;
}
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: {
    "cache-control": "no-store", "x-content-type-options": "nosniff",
  } });
}
export async function bytes(request: Pick<Request,"headers"|"body">, maximum: number): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > maximum) throw new ApiError(413,"This file is too large.");
  if (!request.body) throw new ApiError(400,"Upload body is missing.");
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[]; let size=0;
  try {
    for (;;) {
      const c=await reader.read(); if(c.done) break;
      size+=c.value.byteLength;
      if(size>maximum){await reader.cancel();throw new ApiError(413,"This file is too large.");}
      chunks.push(c.value);
    }
    const result=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
    return result;
  } finally {reader.releaseLock();}
}
export async function body(request: Request, maximum = 256 * 1024): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maximum) throw new ApiError(413, "Request too large.");
  if (!request.body) throw new ApiError(400, "A JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new ApiError(413, "Request too large.");
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Invalid JSON.");
  } finally { reader.releaseLock(); }
}
export function object(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try { return object(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
export async function rows<T>(db: Database, sql: string, ...values: unknown[]): Promise<T[]> {
  return (await db.prepare(sql).bind(...values).all<T>()).results ?? [];
}
export const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const attribution = { text: "© OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright" };
export const V = "(SELECT id FROM viewer)";
export const viewerCte = "WITH viewer AS (SELECT ? AS id)";
export const notBlocked = `NOT EXISTS (SELECT 1 FROM account_blocks b
  WHERE (b.owner_id=${V} AND b.blocked_id=p.author_id)
     OR (b.blocked_id=${V} AND b.owner_id=p.author_id))`;
export const visiblePost = `p.archived_at IS NULL AND (${notBlocked}) AND u.is_virtual=0 AND
  (p.visibility='public' OR p.author_id=${V} OR
    (p.visibility='connections' AND (
      EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=${V} AND f.followed_id=p.author_id) OR
      EXISTS(SELECT 1 FROM friendships f WHERE
        (f.member_low_id=${V} AND f.member_high_id=p.author_id) OR (f.member_high_id=${V} AND f.member_low_id=p.author_id)))) OR
    (p.visibility='close-friends' AND EXISTS (
      SELECT 1 FROM close_friend_members c WHERE c.owner_id=p.author_id AND c.member_id=${V})))
  AND (u.is_private=0 OR p.author_id=${V} OR EXISTS (
    SELECT 1 FROM user_follows f WHERE f.follower_id=${V} AND f.followed_id=p.author_id) OR
    (p.visibility='connections' AND EXISTS(SELECT 1 FROM friendships f WHERE
      (f.member_low_id=${V} AND f.member_high_id=p.author_id) OR (f.member_high_id=${V} AND f.member_low_id=p.author_id))))`;
export const visibleStory = `s.media_ready=1 AND NOT EXISTS(SELECT 1 FROM account_blocks b
  WHERE (b.owner_id=${V} AND b.blocked_id=s.author_id) OR (b.blocked_id=${V} AND b.owner_id=s.author_id))
  AND (s.author_id=${V} OR (s.visibility='public' AND u.is_private=0)
    OR (s.visibility='followers' AND EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=${V} AND f.followed_id=s.author_id))
    OR (s.visibility='friends' AND EXISTS(SELECT 1 FROM friendships f WHERE
      (f.member_low_id=${V} AND f.member_high_id=s.author_id) OR (f.member_high_id=${V} AND f.member_low_id=s.author_id)))
    OR (s.visibility='close-friends' AND EXISTS(SELECT 1 FROM close_friend_members c WHERE c.owner_id=s.author_id AND c.member_id=${V})))`;
export async function blocked(db: Database, left: string, right: string): Promise<boolean> {
  return !!await db.prepare(`SELECT 1 FROM account_blocks
    WHERE (owner_id=? AND blocked_id=?) OR (owner_id=? AND blocked_id=?) LIMIT 1`)
    .bind(left, right, right, left).first();
}
export function publicDetails(data: unknown) {
  const profile = object(object(data).profile);
  const visibility = object(profile.profileVisibility);
  return {
    ...(typeof profile.avatar === "string" ? { avatar: profile.avatar } : {}),
    ...(typeof profile.cover === "string" || profile.cover === null ? { cover: profile.cover } : {}),
    ...(typeof profile.bio === "string" ? { bio: profile.bio } : {}),
    ...(typeof profile.category === "string" ? { category: profile.category } : {}),
    ...(visibility.city !== false && typeof profile.city === "string" ? { city: profile.city } : {}),
    ...(visibility.interests !== false && Array.isArray(profile.interests)
      ? { interests: profile.interests.filter((x): x is string => typeof x === "string") } : {}),
  };
}
