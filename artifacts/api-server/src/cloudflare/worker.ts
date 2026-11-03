import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { emailVerificationStatus, requestSignupEmailVerification, signupEmailConfirmation } from "./signup-email-verification";
import { ownProfileListVisibility, profileListVisibility } from "./profile-list-privacy";
import { deleteOwnAccount } from "./account-deletion";
import {
  accountStateSchema,
  ChangeAccountPasswordBody,
  PermanentlyDeleteOwnAccountBody,
  RESERVED_PROFILE_IMAGE_ERROR,
  LoginAccountBody,
  profileUpdateSchema,
  RegisterAccountBody,
} from "@workspace/api-zod";
import {
  isReservedAccountUsername,
  OFFICIAL_OLDTIME_USERNAME,
} from "@workspace/api-zod/account-policy";
import { signupAgeError } from "@workspace/api-zod/signup-age";
import { ApiError, body as readBody, type MediaBucket } from "./runtime";
import type { WorkersAiBinding } from "./content-moderation";
import { isSocialPath, socialRequest } from "./social";
import { isCommunityFeedPath, communityFeedRequest } from "./community-feeds";
import { signupPreferences, initialSignupState, officialSignupFollow, SIGNUP_INTEREST_IDS } from "./signup-preferences";
import { mediaRequest, tokenRead, tusRequest } from "./media";
import { isRelationshipPath, relationshipRequest } from "./relationships";
import { commentsRequest } from "./comments";
import { notificationsRequest } from "./notifications";
import { chatRequest } from "./chats";
import { storyRequest } from "./stories";
import { isAccountDataPath, accountDataRequest } from "./account-data";
import { librarySaved } from "./account-library";
import { profileMedia, referenceWrites } from "./media-references";
import { discoveryRequest } from "./discovery";
import { ensureDiscoveryIndex } from "./discovery-index";
import { refreshTopicRegistry } from "./topic-registry";
import { soundRequest } from "./sounds";
import { cleanupMedia } from "./media-lifecycle";
import { searchPlaces } from "./places";
import { placeProfileRequest } from "./place-profiles";
import { placeLanding } from "./place-landing";
import { moderationRequest } from "./moderation";
import {publicShareData,publicShareImage} from "./public-share";
import { publicErrorMessage } from "../../../../lib/public-copy/index.js";
import { analyticsRequest } from "./analytics";
import { normalizeClientPerformanceEvent } from "./performance-telemetry";
import { isCreatorPath, creatorRequest } from "./creators";
import { realtimeTicket,realtimeUpgrade,notifyRealtime,dispatchRealtime,type RealtimeNamespace } from "./realtime";
import { confirmEmailChange, requestEmailChange, showEmailChangeConfirmation } from "./email-verification";
import {
  confirmOfficialAccountClaim,
  requestOfficialAccountClaim,
  showOfficialAccountClaimConfirmation,
} from "./official-account-claim";
export { OldtimeRealtime } from "./realtime";

interface D1Result<T> {
  results?: T[];
  success: boolean;
  meta?: { changes?: number };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface CloudflareEnv {
  REALTIME: RealtimeNamespace;
  DB: D1Database;
  MEDIA: MediaBucket;
  AI?: WorkersAiBinding;
  RESEND_API_KEY?: string;
  OFFICIAL_ACCOUNT_CLAIM_EMAIL?: string;
}

interface StoredUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  password_salt: string;
  password_hash: string;
  created_at: number;
  email_verified_at?: number | null;
  email_verification_known?: number;
  followers_visible?: number;
  following_visible?: number;
}

interface AuthenticatedUser extends StoredUser {
  session_id: string;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_KEY_LENGTH = 64;
const RATE_WINDOW_MS = 60_000;
const MAX_JSON_BYTES = 256 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function readJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await readBody(request,MAX_JSON_BYTES) };
  } catch {
    return { ok: false };
  }
}

function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, PASSWORD_KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

async function makePasswordCredentials(password: string): Promise<{
  passwordSalt: string;
  passwordHash: string;
}> {
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = (await derivePassword(password, passwordSalt)).toString("hex");
  return { passwordSalt, passwordHash };
}

async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const expected = Buffer.from(storedHash, "hex");
  if (expected.length !== PASSWORD_KEY_LENGTH) return false;
  const actual = await derivePassword(password, salt);
  return timingSafeEqual(actual, expected);
}

function createAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function bearerToken(request: Request): string | null {
  return /^Bearer\s+([A-Za-z0-9_-]{32,128})$/i.exec(
    request.headers.get("authorization") || "",
  )?.[1] ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint failed/i.test(message);
}

function accountResponse(user: StoredUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    emailVerified: user.email_verified_at ? true : user.email_verification_known === 1 ? false : null,
    profileListVisibility: profileListVisibility(user),
    joinedAt: user.created_at,
  };
}

async function limitAttempts(
  request: Request,
  db: D1Database,
  scope: string,
  maximum: number,
): Promise<boolean> {
  const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
  const clientKey = hash(clientIp).slice(0, 32);
  const now = Date.now();
  const windowStartedAt = Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  const row = await db.prepare(`
    INSERT INTO auth_rate_limits (scope, client_key, window_started_at, attempts)
    VALUES (?, ?, ?, 1)
    ON CONFLICT (scope, client_key) DO UPDATE SET
      attempts = CASE
        WHEN auth_rate_limits.window_started_at = excluded.window_started_at
          THEN auth_rate_limits.attempts + 1
        ELSE 1
      END,
      window_started_at = excluded.window_started_at
    RETURNING attempts
  `).bind(scope, clientKey, windowStartedAt).first<{ attempts: number }>();

  return (row?.attempts ?? maximum + 1) <= maximum;
}

async function authenticate(request: Request, db: D1Database): Promise<AuthenticatedUser | null> {
  const token = bearerToken(request);
  if (!token) return null;

  return db.prepare(`
    SELECT
      users.id,
      users.email,
      users.username,
      users.display_name,
      users.password_salt,
      users.password_hash,
      users.created_at,
      users.email_verified_at,
      users.email_verification_known,
      users.followers_visible,
      users.following_visible,
      sessions.id AS session_id
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.is_virtual=0
    LIMIT 1
  `).bind(hash(token), Date.now()).first<AuthenticatedUser>();
}

async function register(request: Request, env: CloudflareEnv): Promise<Response> {
  if (!(await limitAttempts(request, env.DB, "register", 5))) {
    return json({ error: "Too many attempts. Try again in a minute." }, 429);
  }
  const body = await readJson(request);
  const parsed = body.ok ? RegisterAccountBody.safeParse(body.value) : null;
  if (!parsed?.success) {
    return json({ error: "Check your details and choose at least 3 interests. Refresh Oldtime if the interest picker is missing." }, 400);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const username = parsed.data.username.trim().toLowerCase();
  const displayName = parsed.data.displayName.trim();
  if (!email || !username || !displayName) {
    return json({ error: "Email, username, and name are required." }, 400);
  }
  const ageError = signupAgeError(parsed.data.birthday);
  if (ageError) return json({ error: ageError }, 400);
  if (username === OFFICIAL_OLDTIME_USERNAME) {
    const claimEmail = env.OFFICIAL_ACCOUNT_CLAIM_EMAIL?.trim().toLowerCase();
    if (!claimEmail) {
      return json({ error: "Official account verification is unavailable right now." }, 503);
    }
    if (email !== claimEmail) {
      return json({ error: "That username is reserved for the official Oldtime account." }, 409);
    }
    if (!(await limitAttempts(request, env.DB, "official-account-claim", 3))) {
      return json({ error: "Too many claim attempts. Try again in a minute." }, 429);
    }
    const credentials = await makePasswordCredentials(parsed.data.password);
    return requestOfficialAccountClaim(env, email, {
      passwordSalt: credentials.passwordSalt,
      passwordHash: credentials.passwordHash,
    });
  }
  if (isReservedAccountUsername(username)) {
    return json({ error: "That username is reserved for the official Oldtime account." }, 409);
  }
  const preferences = signupPreferences(parsed.data);

  const credentials = await makePasswordCredentials(parsed.data.password);
  const accessToken = createAccessToken();
  const now = Date.now();
  const user: StoredUser = {
    id: randomUUID(),
    email,
    username,
    display_name: displayName,
    password_salt: credentials.passwordSalt,
    password_hash: credentials.passwordHash,
    created_at: now,
    email_verification_known: 1,
  };
  const expiresAt = now + SESSION_TTL_MS;
  const officialFollow = await officialSignupFollow(env.DB,user.id,preferences.followOldtime,now);

  try {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
      env.DB.prepare(`
        INSERT INTO users (
          id, email, username, display_name, password_salt, password_hash, created_at, email_verification_known
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(
        user.id,
        user.email,
        user.username,
        user.display_name,
        user.password_salt,
        user.password_hash,
        user.created_at,
      ),
      env.DB.prepare(`
        INSERT INTO account_state (user_id, data, updated_at)
        VALUES (?, json(?), ?)
      `).bind(
        user.id,
        JSON.stringify(initialSignupState(parsed.data.birthday,preferences.interests)),
        now,
      ),
      env.DB.prepare(`
        INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(randomUUID(), user.id, hash(accessToken), now, expiresAt),
      ...(officialFollow ? [officialFollow] : []),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return json({ error: "That email or username is already in use." }, 409);
    }
    throw error;
  }

  return json({
    accessToken,
    tokenType: "Bearer",
    expiresAt,
    account: accountResponse(user),
  }, 201);
}

async function login(request: Request, env: CloudflareEnv): Promise<Response> {
  if (!(await limitAttempts(request, env.DB, "login", 10))) {
    return json({ error: "Too many attempts. Try again in a minute." }, 429);
  }
  const body = await readJson(request);
  const parsed = body.ok ? LoginAccountBody.safeParse(body.value) : null;
  if (!parsed?.success) {
    return json({ error: "Enter your email or username and password." }, 400);
  }

  const identifier = parsed.data.identifier.trim().toLowerCase();
  const user = await env.DB.prepare(`
    SELECT id, email, username, display_name, password_salt, password_hash, created_at,
      email_verified_at, email_verification_known, followers_visible, following_visible
    FROM users
    WHERE is_virtual=0 AND (email = ? OR username = ?)
    LIMIT 1
  `).bind(identifier, identifier).first<StoredUser>();

  if (!user || !(await verifyPassword(parsed.data.password, user.password_salt, user.password_hash))) {
    return json({ error: "Email, username, or password is incorrect." }, 401);
  }

  const accessToken = createAccessToken();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(randomUUID(), user.id, hash(accessToken), now, expiresAt),
  ]);

  return json({
    accessToken,
    tokenType: "Bearer",
    expiresAt,
    account: accountResponse(user),
  });
}

async function changePassword(request: Request, env: CloudflareEnv): Promise<Response> {
  if (!(await limitAttempts(request, env.DB, "password-change", 5))) {
    return json({ error: "Too many attempts. Try again in a minute." }, 429);
  }
  const user = await authenticate(request, env.DB);
  if (!user) return json({ error: "Your session has expired. Sign in again." }, 401);

  const body = await readJson(request);
  const parsed = body.ok ? ChangeAccountPasswordBody.safeParse(body.value) : null;
  if (!parsed?.success) {
    return json({ error: "Passwords must be between 8 and 128 characters." }, 400);
  }
  if (!(await verifyPassword(parsed.data.currentPassword, user.password_salt, user.password_hash))) {
    return json({ error: "The current password is incorrect." }, 401);
  }
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return json({ error: "Choose a different new password." }, 400);
  }

  const credentials = await makePasswordCredentials(parsed.data.newPassword);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?")
      .bind(credentials.passwordSalt, credentials.passwordHash, user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?")
      .bind(user.id, user.session_id),
  ]);
  return json({ ok: true });
}

function storedObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function getAccountState(request: Request, env: CloudflareEnv): Promise<Response> {
  const user = await authenticate(request, env.DB);
  if (!user) return json({ error: "Your session has expired. Sign in again." }, 401);
  if (!(await limitAttempts(request, env.DB, "account-state", 60))) {
    return json({ error: "Too many attempts. Try again in a minute." }, 429);
  }

  const record = await env.DB.prepare("SELECT data FROM account_state WHERE user_id = ?")
    .bind(user.id)
    .first<{ data: unknown }>();
  const state = record ? { ...storedObject(record.data) } : null;
  if (state) delete state.pendingEmail;
  return json({ state });
}

async function updateAccountState(request: Request, env: CloudflareEnv): Promise<Response> {
  const user = await authenticate(request, env.DB);
  if (!user) return json({ error: "Your session has expired. Sign in again." }, 401);
  if (!(await limitAttempts(request, env.DB, "account-state", 60))) {
    return json({ error: "Too many attempts. Try again in a minute." }, 429);
  }

  const body = await readJson(request);
  const parsed = body.ok && body.value && typeof body.value === "object"
    ? accountStateSchema.safeParse((body.value as { state?: unknown }).state)
    : null;
  const serialized = parsed?.success ? JSON.stringify(parsed.data) : "{}";
  if (!parsed?.success || new TextEncoder().encode(serialized).byteLength > 256 * 1024) {
    const reservedAvatar = !!parsed && !parsed.success && parsed.error.issues.some(issue => issue.message === RESERVED_PROFILE_IMAGE_ERROR);
    return json(
      { error: reservedAvatar ? RESERVED_PROFILE_IMAGE_ERROR : "Account settings or saved items are invalid or too large." },
      reservedAvatar ? 409 : 400,
    );
  }

  const entries = Object.entries(parsed.data);
  const updateExpression = entries.length
    ? `json_set(COALESCE(account_state.data, '{}'), ${entries.map(() => "?, json(?)").join(", ")})`
    : "COALESCE(account_state.data, excluded.data)";
  const updateValues = entries.flatMap(([key, value]) => [
    `$."${key.replaceAll('"', '\\"')}"`,
    JSON.stringify(value),
  ]);
  const now = Date.now();
  const stateWrite = env.DB.prepare(`
    INSERT INTO account_state (user_id, data, updated_at)
    VALUES (?, json(?), ?)
    ON CONFLICT(user_id) DO UPDATE SET
      data = ${updateExpression},
      updated_at = excluded.updated_at
  `).bind(
    user.id,
    JSON.stringify({ ...parsed.data, notificationReadAt: 0 }),
    now,
    ...updateValues,
  );
  const stateWrites = [stateWrite];
  if (parsed.data.savedPostIds !== undefined) {
    stateWrites.push(
      env.DB.prepare("DELETE FROM post_saves WHERE user_id=?").bind(user.id),
      env.DB.prepare(`INSERT INTO post_saves(user_id,post_id)
        SELECT ?,p.id FROM posts p JOIN json_each(?) saved ON saved.value=p.id
        WHERE 1 ON CONFLICT DO NOTHING`).bind(user.id,JSON.stringify(parsed.data.savedPostIds)),
    );
  }
  if (parsed.data.profile !== undefined) {
    stateWrites.push(...referenceWrites(env.DB,user.id,"profile","profile",await profileMedia(env.DB,user.id,parsed.data.profile)));
  }
  await env.DB.batch(stateWrites);

  return json({ ok: true, updatedAt: now });
}

async function updateProfile(request: Request, env: CloudflareEnv): Promise<Response> {
  const user = await authenticate(request, env.DB);
  if (!user) return json({ error: "Your session has expired. Sign in again." }, 401);
  if (!(await limitAttempts(request, env.DB, "account-profile", 30))) {
    return json({ error: "Too many attempts. Try again in a minute." }, 429);
  }

  const body = await readJson(request);
  const parsed = body.ok ? profileUpdateSchema.safeParse(body.value) : null;
  if (!parsed?.success) {
    const reservedAvatar = !!parsed && parsed.error.issues.some(issue => issue.message === RESERVED_PROFILE_IMAGE_ERROR);
    return json({ error: reservedAvatar ? RESERVED_PROFILE_IMAGE_ERROR : "Profile details are invalid." }, reservedAvatar ? 409 : 400);
  }
  const userId = user.id;
  if (isReservedAccountUsername(parsed.data.username, userId)) {
    return json({ error: "That username is reserved for the official Oldtime account." }, 409);
  }

  const profileMediaIds = [...new Set(
    [parsed.data.profile.avatar, parsed.data.profile.cover]
      .filter((value): value is string => typeof value === "string" && value.startsWith("oldtime-media:"))
      .map(value => value.slice("oldtime-media:".length)),
  )];
  if (profileMediaIds.some(id => !/^[0-9a-f-]{36}$/i.test(id))) {
    return json({ error: "Upload profile photos to your account before saving." }, 400);
  }
  if (profileMediaIds.length) {
    const placeholders = profileMediaIds.map(() => "?").join(", ");
    const assets = await env.DB.prepare(`
      SELECT id, content_type, storage_scope, media_role
      FROM user_media_assets
      WHERE id IN (${placeholders}) AND user_id = ? AND ready = 1
    `).bind(...profileMediaIds, userId).all<{
      id: string;
      content_type: string;
      storage_scope: string;
      media_role: string;
    }>();
    const validAssets = new Map((assets.results ?? []).map(asset => [asset.id, asset]));
    if (
      profileMediaIds.some(id => !validAssets.has(id)) ||
      [...validAssets.values()].some(asset =>
        asset.storage_scope !== "public" ||
        asset.media_role !== "media" ||
        !asset.content_type.startsWith("image/"))
    ) {
      return json({ error: "Use a confirmed public photo for your profile picture or cover." }, 409);
    }
  }

  const current = await env.DB.prepare(
    "SELECT id, username, display_name, email FROM users WHERE id = ? LIMIT 1",
  ).bind(userId).first<{
    id: string;
    username: string;
    display_name: string;
    email: string;
  }>();
  if (!current) return json({ error: "Account not found." }, 404);

  const usernameConflict = await env.DB.prepare(
    "SELECT id FROM users WHERE lower(username) = ? LIMIT 1",
  ).bind(parsed.data.username).first<{ id: string }>();
  if (usernameConflict && usernameConflict.id !== userId) {
    return json({ error: "That username is already in use." }, 409);
  }

  const profile = {
    ...parsed.data.profile,
    displayName: parsed.data.displayName,
    username: parsed.data.username,
    profileVisibility: parsed.data.profile.profileVisibility || { city: true, interests: true },
  };
  const now = Date.now();
  try {
    await env.DB.batch([
      ...referenceWrites(env.DB,userId,"profile","profile",profileMediaIds),
      env.DB.prepare("UPDATE users SET username = ?, display_name = ? WHERE id = ?")
        .bind(parsed.data.username, parsed.data.displayName, userId),
      env.DB.prepare(`
        INSERT INTO account_state (user_id, data, updated_at)
        VALUES (?, json(?), ?)
        ON CONFLICT(user_id) DO UPDATE SET
          data = json_set(json_remove(COALESCE(account_state.data, '{}'), '$.pendingEmail'), '$.profile', json(?)),
          updated_at = excluded.updated_at
      `).bind(
        userId,
        JSON.stringify({ profile, notificationReadAt: 0 }),
        now,
        JSON.stringify(profile),
      ),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return json({ error: "That username is already in use." }, 409);
    }
    throw error;
  }

  return json({
    account: {
      id: current.id,
      username: parsed.data.username,
      displayName: parsed.data.displayName,
      email: current.email,
    },
    profile,
    signInEmail: current.email,
    emailChangeNeedsVerification: parsed.data.email.trim().toLowerCase() !== current.email.toLowerCase(),
  });
}

async function handleRequest(
  request: Request, env: CloudflareEnv, context?: { waitUntil(task:Promise<unknown>):void },
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  if(path==="/public/share"&&request.method==="GET")return publicShareData(request,env.DB);
  if(path==="/public/share-image"&&request.method==="GET")return publicShareImage(request,env.DB,env.MEDIA);

  if ((path === "/health" || path === "/healthz") && request.method === "GET") {
    try {
      await env.DB.prepare("SELECT 1 AS ready").first<{ ready: number }>();
      return json({ status: "ok", database: "ready", provider: "cloudflare", freshStart: "oldtime-cloudflare-v1" });
    } catch {
      return json({ status: "unavailable", database: "unavailable" }, 503);
    }
  }
  if (path === "/account/email-verification/verify" && ["GET","POST"].includes(request.method)) {
    if (!(await limitAttempts(request, env.DB, "email-verification-confirm", 15))) return json({error:"Too many attempts. Try again in a minute."},429);
    return signupEmailConfirmation(request,env);
  }
  if (path === "/account/email-verification/status" && request.method === "GET" ||
      path === "/account/email-verification/request" && request.method === "POST" ||
      path === "/account/profile-list-visibility" && ["GET","PUT"].includes(request.method)) {
    const user = await authenticate(request,env.DB);
    if (!user) return json({error:"Your session has expired. Sign in again."},401);
    if (path === "/account/profile-list-visibility") return ownProfileListVisibility(request,env.DB,user.id);
    if (request.method === "GET") return emailVerificationStatus(env.DB,user.id);
    if (!(await limitAttempts(request,env.DB,`email-verification-request:${user.id}`,3))) return json({error:"Too many attempts. Try again in a minute."},429);
    return requestSignupEmailVerification(env,user.id);
  }
  if (path === "/account/email-change/verify" && request.method === "GET") {
    return showEmailChangeConfirmation(request, env.DB);
  }
  if (path === "/account/email-change/verify" && request.method === "POST") {
    if (!(await limitAttempts(request, env.DB, "email-change-verify", 15))) {
      return new Response("Too many attempts. Wait a minute and open the email link again.", {
        status: 429,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
          "x-content-type-options": "nosniff",
        },
      });
    }
    return confirmEmailChange(request, env);
  }
  if (path === "/auth/official-claim/verify" && request.method === "GET") {
    return showOfficialAccountClaimConfirmation(request, env);
  }
  if (path === "/auth/official-claim/verify" && request.method === "POST") {
    if (!(await limitAttempts(request, env.DB, "official-account-claim-verify", 15))) {
      return new Response("Too many attempts. Wait a minute and open the email link again.", {
        status: 429,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
          "x-content-type-options": "nosniff",
        },
      });
    }
    return confirmOfficialAccountClaim(request, env);
  }
  if (path === "/account/email-change/request" && request.method === "POST") {
    const user = await authenticate(request, env.DB);
    if (!user) return json({ error: "Your session has expired. Sign in again." }, 401);
    if (!(await limitAttempts(request, env.DB, `email-change-request:${user.id}`, 3))) {
      return json({ error: "Too many attempts. Try again in a minute." }, 429);
    }
    return requestEmailChange(request, env, user);
  }
  // The fresh launch uses Cloudflare's email/password accounts, not legacy federation.
  if (path === "/auth/cognito/config" && request.method === "GET") return json({ enabled: false });
  if (path === "/auth/signup-policy" && request.method === "GET") return json({
    minimumInterests:3,maximumInterests:24,optionalOfficialFollow:true,interestIds:SIGNUP_INTEREST_IDS,
  });
  if (path === "/auth/register" && request.method === "POST") return register(request, env);
  if (path === "/auth/login" && request.method === "POST") return login(request, env);

  if (path === "/auth/me" && request.method === "GET") {
    const user = await authenticate(request, env.DB);
    return user
      ? json({ account: accountResponse(user) })
      : json({ error: "Your session has expired. Sign in again." }, 401);
  }

  if (path === "/auth/logout" && request.method === "POST") {
    const token = bearerToken(request);
    if (!token) return json({ error: "Sign in required" }, 401);
    const ended=await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ? RETURNING user_id").bind(hash(token)).first<{user_id:string}>();
    if(ended)await dispatchRealtime(env,ended.user_id).catch(()=>console.error("A session refresh could not be delivered."));
    return json({ ok: true });
  }

  if (path === "/auth/password" && request.method === "POST") {
    return changePassword(request, env);
  }
  if (path === "/account" && request.method === "DELETE") {
    const user = await authenticate(request, env.DB);
    if (!user) return json({ error: "Your session has expired. Sign in again." }, 401);
    if (!(await limitAttempts(request, env.DB, `account-deletion:${user.id}`, 5))) {
      return json({ error: "Too many attempts. Try again in a minute." }, 429);
    }
    const parsed = PermanentlyDeleteOwnAccountBody.safeParse(await readBody(request, 2048));
    if (!parsed.success) return json({ error: "Confirm deletion and enter your current password." }, 400);
    if (!(await verifyPassword(parsed.data.currentPassword, user.password_salt, user.password_hash))) {
      return json({ error: "The current password is incorrect." }, 403);
    }
    await deleteOwnAccount(env.DB, user.id);
    await dispatchRealtime(env, user.id).catch(() => console.error("An account session refresh could not be delivered."));
    return json({ ok: true });
  }
  if (path === "/performance/client" && request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") {
      return json({ error: "Timing samples must come from this app." }, 403);
    }
    const user = await authenticate(request, env.DB);
    if (!user) return json({ error: "Your session has expired. Sign in again." }, 401);
    const sample = normalizeClientPerformanceEvent(await readBody(request, 2048));
    if (!sample) return json({ error: "The timing sample is invalid." }, 400);
    console.info("oldtime_performance_client", sample);
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
  if (path === "/account/state" && request.method === "GET") return getAccountState(request, env);
  if (path === "/account/state" && request.method === "PUT") return updateAccountState(request, env);
  if (path === "/account/profile" && request.method === "PUT") return updateProfile(request, env);
  if (path.startsWith("/media/")) {
    if (path.startsWith("/media/uploads/")) return tusRequest(request,env.DB,env.MEDIA,path);
    if (/^\/media\/[a-f0-9-]{36}\/content$/.test(path) && ["GET","HEAD"].includes(request.method)) {
      return tokenRead(request,env.DB,env.MEDIA,path,context);
    }
    const user = await authenticate(request,env.DB);
    if (!user) return json({error:"Your session has expired. Sign in again."},401);
    if (!(await limitAttempts(request,env.DB,`media:${user.id}`,180))) return json({error:"Too many media requests. Try again in a minute."},429);
    return mediaRequest(request,env.DB,env.MEDIA,user.id,path);
  }
  if(path==="/realtime"&&request.method==="GET")return realtimeUpgrade(request,env);
  if(path==="/realtime/ticket"&&request.method==="POST"){
    const user=await authenticate(request,env.DB);
    if(!user)return json({error:"Your session has expired. Sign in again."},401);
    if(!(await limitAttempts(request,env.DB,`realtime:${user.id}`,20)))return json({error:"Too many connection attempts. Try again in a minute."},429);
    return realtimeTicket(request,env,user.id);
  }
  if(path.startsWith("/analytics/")){
    const user=await authenticate(request,env.DB);
    if(!user)return json({error:"Your session has expired. Sign in again."},401);
    if(request.method!=="GET"&&!(await limitAttempts(request,env.DB,`analytics:${user.id}`,path.startsWith("/analytics/sessions/")?240:120)))
      return json({error:"Too many analytics updates. Try again in a minute."},429);
    return analyticsRequest(request,env.DB,user.id,path);
  }
  if(isCreatorPath(path)){
    const user=await authenticate(request,env.DB);
    if(!user)return json({error:"Your session has expired. Sign in again."},401);
    if(request.method!=="GET"&&!(await limitAttempts(request,env.DB,`creator:${user.id}`,path==="/creator/evaluate"?8:60)))
      return json({error:"Too many creator actions. Try again in a minute."},429);
    return creatorRequest(request,env.DB,user.id,path);
  }
  if (path === "/account/library/saved" || isCommunityFeedPath(path) || isSocialPath(path) || isRelationshipPath(path) || isAccountDataPath(path) || path.startsWith("/places/") || path.startsWith("/moderation/") || path.startsWith("/discovery/") || path.startsWith("/sounds/") || path.startsWith("/notifications") || path==="/chats" || path.startsWith("/chats/") || path==="/stories" || path.startsWith("/stories/")) {
    const user = await authenticate(request, env.DB);
    if (!user) return json({ error: "Your session has expired. Sign in again." }, 401);
    if (request.method !== "GET" && !(await limitAttempts(request,env.DB,`social:${user.id}`,90))) {
      return json({ error: "Too many actions. Try again in a minute." },429);
    }
    if (isCommunityFeedPath(path)) return communityFeedRequest(request,env.DB,user.id,path);
    if (isRelationshipPath(path)) return relationshipRequest(request,env.DB,user.id,path);
    if(path==="/places/landing"&&request.method==="GET")return placeLanding(request,env.DB,user.id);
    if(path.startsWith("/moderation/"))return moderationRequest(request,env.DB,user.id,path);
    if (path==="/places/profile" || path==="/places/saved" || path==="/places/reviews" || path.startsWith("/places/reviews/")) {
      return placeProfileRequest(request,env.DB,user.id,path);
    }
    if (path==="/places/search") {
      if(!(await limitAttempts(request,env.DB,`places:${user.id}`,40))) return json({error:"Too many place searches. Try again in a minute."},429);
      return searchPlaces(request,env.DB);
    }
    if (path.startsWith("/discovery/")) {
      if(!(await limitAttempts(request,env.DB,`discovery:${user.id}`,90)))return json({error:"Too many searches. Try again in a minute."},429);
      return discoveryRequest(request,env.DB,user.id,path);
    }
    if (path.startsWith("/sounds/")) return soundRequest(request,env.DB,user.id,path);
    if (path === "/account/library/saved" && request.method === "GET") return librarySaved(request,env.DB,user.id);
    if (isAccountDataPath(path)) return accountDataRequest(request,env.DB,user.id,path);
    if (path==="/chats" || path.startsWith("/chats/")) return chatRequest(request,env.DB,user.id,path);
    if (path==="/stories" || path.startsWith("/stories/")) return storyRequest(request,env.DB,env.MEDIA,user.id,path,env.AI);
    if (path.startsWith("/notifications")) return notificationsRequest(request,env.DB,user.id,path);
    if (/^\/posts\/[^/]+\/comments(?:\/|$)/.test(path)) return commentsRequest(request,env.DB,user.id,path);
    return socialRequest(request,env.DB,user.id,path,env.AI,env.MEDIA);
  }

  return json({ error: "Not found" }, 404);
}

function isPublishFlowRequest(request: Request, path: string) {
  return /\/media(?:\/|$)/.test(path) || (request.method === "POST" && /\/posts\/?$/.test(path));
}

function safeDiagnosticPath(path: string) {
  return path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");
}

async function logPublishFlowFailure(request: Request, response: Response, error?: unknown) {
  const rawPath = new URL(request.url).pathname;
  if (!isPublishFlowRequest(request, rawPath)) return;
  let responseBody = "";
  try { responseBody = (await response.clone().text()).slice(0, 1200); } catch {}
  const failure = error instanceof Error ? error : null;
  console.error("[Oldtime publish request failed]", {
    requestId: request.headers.get("cf-ray") || response.headers.get("cf-ray") || null,
    method: request.method,
    path: safeDiagnosticPath(rawPath),
    status: response.status,
    responseBody,
    ...(failure ? {
      errorName: failure.name || "Error",
      message: failure.message,
      stack: failure.stack || "",
    } : {}),
  });
}

export default {
  async fetch(request: Request, env: CloudflareEnv,ctx?:{waitUntil(task:Promise<unknown>):void}): Promise<Response> {
    try {
      const requestPath = new URL(request.url).pathname.replace(/^\/api(?=\/|$)/, "") || "/";
      const isFeedRequest = request.method === "GET" && requestPath === "/feed";
      const startedAt = isFeedRequest ? performance.now() : 0;
      let response=await handleRequest(request, env,ctx);
      if (isFeedRequest && response.ok) {
        const durationMs = performance.now() - startedAt;
        const headers = new Headers(response.headers);
        const previous = headers.get("server-timing");
        headers.set("server-timing", `${previous ? `${previous}, ` : ""}worker;dur=${durationMs.toFixed(1)}`);
        response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
        if (Math.random() < 0.25) {
          console.info("oldtime_performance_worker", { durationMs: Math.round(durationMs / 10) * 10 });
        }
      }
      if (!response.ok) await logPublishFlowFailure(request, response);
      if(response.ok&&!["GET","HEAD","OPTIONS"].includes(request.method)&&requestPath!=="/performance/client"){
        const update=notifyRealtime(request,response,env).catch(()=>console.error("A real-time refresh could not be delivered."));
        if(ctx)ctx.waitUntil(update);else await update;
      }
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        const response = json({error:publicErrorMessage(error.message)},error.status);
        await logPublishFlowFailure(request, response, error);
        return response;
      }
      console.error("Oldtime Worker request failed", {
        method: request.method,
        path: safeDiagnosticPath(new URL(request.url).pathname),
        requestId: request.headers.get("cf-ray") || null,
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : "Unknown failure",
        stack: error instanceof Error ? error.stack : "",
      });
      const response = json({ error: "The request could not be completed." }, 500);
      await logPublishFlowFailure(request, response, error);
      return response;
    }
  },

  async scheduled(
    controller: { scheduledTime: number;cron?:string },
    env: CloudflareEnv,
  ): Promise<void> {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
      env.DB.prepare("DELETE FROM auth_rate_limits WHERE window_started_at < ?")
        .bind(now - 5 * RATE_WINDOW_MS),
      env.DB.prepare("DELETE FROM media_read_tokens WHERE expires_at<=?").bind(now),
      env.DB.prepare("DELETE FROM realtime_tickets WHERE expires_at<=?").bind(now),
      env.DB.prepare("DELETE FROM official_account_claim_requests WHERE expires_at <= ?").bind(now),
    ]);
    await cleanupMedia(env.DB,env.MEDIA,controller.scheduledTime);
    for(let i=0;i<20;i++)await ensureDiscoveryIndex(env.DB);
    await refreshTopicRegistry(env.DB,100);
    const topicDay=Math.floor(now/86400000);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM discovery_topic_signal_days WHERE day<?").bind(topicDay-30),
      env.DB.prepare("DELETE FROM discovery_topic_metrics WHERE day<?").bind(topicDay-90),
    ]);
  },
};
