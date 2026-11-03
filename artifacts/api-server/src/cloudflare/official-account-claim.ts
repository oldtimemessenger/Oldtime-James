import { createHash, randomBytes } from "node:crypto";
import { accountVerificationEmail } from "./account-email-template";
import {
  OFFICIAL_OLDTIME_ACCOUNT_ID,
  OFFICIAL_OLDTIME_USERNAME,
} from "@workspace/api-zod/account-policy";
import type { Database } from "./runtime";
import { json } from "./runtime";
import {
  sendResendEmail,
  type VerificationEmailPayload,
} from "./email-verification";

interface OfficialAccountClaimEnv {
  DB: Database;
  RESEND_API_KEY?: string;
  OFFICIAL_ACCOUNT_CLAIM_EMAIL?: string;
}

interface ClaimCredentials {
  passwordSalt: string;
  passwordHash: string;
}

interface PendingClaim {
  email_hash: string;
  password_salt: string;
  password_hash: string;
  expires_at: number;
}

export type ClaimEmailSender = (
  apiKey: string,
  payload: VerificationEmailPayload,
) => Promise<boolean>;

const CLAIM_PATH = "/api/auth/official-claim/verify";
const APP_ORIGIN = "https://heyoldtime.com";
const ALLOWED_ORIGINS = new Set([APP_ORIGIN, "https://www.heyoldtime.com"]);
const FROM_EMAIL = "Oldtime <verify@heyoldtime.com>";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const MAX_FORM_BYTES = 4096;

function normalizeEmail(email: string | undefined): string {
  return (email || "").trim().toLowerCase();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

async function readToken(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > MAX_FORM_BYTES || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_FORM_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new URLSearchParams(new TextDecoder().decode(bytes)).get("token");
}

function confirmationPage(
  title: string,
  message: string,
  options: { status?: number; token?: string; confirm?: boolean; returnLink?: boolean } = {},
): Response {
  const confirmationForm = options.confirm && options.token
    ? `<form method="post" action="${CLAIM_PATH}">
        <input type="hidden" name="token" value="${escapeHtml(options.token)}">
        <button type="submit">Confirm and create account</button>
      </form>`
    : "";
  const returnLink = options.returnLink
    ? `<p><a href="${APP_ORIGIN}">Return to Oldtime to log in</a></p>`
    : "";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} · Oldtime</title>
    <style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#101114;color:#f7f7f8;font:16px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{width:min(100%,440px);padding:30px;border:1px solid #34363b;border-radius:22px;background:#1b1c20}
      h1{margin:0 0 12px;font-size:24px;line-height:1.2}p{color:#c2c3c9;margin:0 0 18px}
      button{width:100%;min-height:48px;border:0;border-radius:999px;background:#ed263d;color:white;font:inherit;font-weight:700;cursor:pointer}
      a{color:#f7f7f8}footer{margin-top:22px;color:#8d8f98;font-size:13px}
    </style>
  </head>
  <body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${confirmationForm}${returnLink}<footer>Oldtime · Your people, your moments.</footer></main></body>
</html>`;
  return new Response(html, {
    status: options.status ?? 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

export async function requestOfficialAccountClaim(
  env: OfficialAccountClaimEnv,
  emailInput: string,
  credentials: ClaimCredentials,
  sendEmail: ClaimEmailSender = sendResendEmail,
): Promise<Response> {
  const configuredEmail = normalizeEmail(env.OFFICIAL_ACCOUNT_CLAIM_EMAIL);
  const email = normalizeEmail(emailInput);
  if (!configuredEmail || !env.RESEND_API_KEY) {
    return json({ error: "Official account verification is unavailable right now." }, 503);
  }
  if (!email || email !== configuredEmail) {
    return json({ error: "That username is reserved for the official Oldtime account." }, 409);
  }

  const existingOfficial = await env.DB.prepare(
    "SELECT id FROM users WHERE id = ? OR lower(username) = ? LIMIT 1",
  ).bind(OFFICIAL_OLDTIME_ACCOUNT_ID, OFFICIAL_OLDTIME_USERNAME).first<{ id: string }>();
  if (existingOfficial) {
    return json({ error: "The official account has already been claimed." }, 409);
  }
  const existingEmail = await env.DB.prepare(
    "SELECT id FROM users WHERE lower(email) = ? LIMIT 1",
  ).bind(email).first<{ id: string }>();
  if (existingEmail) {
    return json({ error: "That email is already in use. Log in to the existing account." }, 409);
  }

  const now = Date.now();
  const previous = await env.DB.prepare(`
    SELECT created_at
    FROM official_account_claim_requests
    WHERE claim_key = ?
    LIMIT 1
  `).bind("official").first<{ created_at: number }>();
  if (previous && now - previous.created_at < REQUEST_COOLDOWN_MS) {
    return json({ error: "A verification email was just requested. Wait a minute before trying again." }, 429);
  }

  const token = randomBytes(32).toString("base64url");
  const digest = sha256(token);
  const emailDigest = sha256(email);
  const expiresAt = now + TOKEN_TTL_MS;
  await env.DB.prepare(`
    INSERT INTO official_account_claim_requests (
      claim_key, email_hash, password_salt, password_hash, token_hash, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(claim_key) DO UPDATE SET
      email_hash = excluded.email_hash,
      password_salt = excluded.password_salt,
      password_hash = excluded.password_hash,
      token_hash = excluded.token_hash,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at
  `).bind(
    "official",
    emailDigest,
    credentials.passwordSalt,
    credentials.passwordHash,
    digest,
    now,
    expiresAt,
  ).run();

  const verificationUrl = new URL(CLAIM_PATH, APP_ORIGIN);
  verificationUrl.searchParams.set("token", token);
  const payload = accountVerificationEmail(email, verificationUrl.toString(), "official");
  try {
    const sent = await sendEmail(env.RESEND_API_KEY, payload);
    if (!sent) throw new Error("Email provider rejected the request.");
  } catch {
    await env.DB.prepare(`
      DELETE FROM official_account_claim_requests
      WHERE claim_key = ? AND token_hash = ?
    `).bind("official", digest).run();
    return json({ error: "The verification email could not be sent. Try again later." }, 503);
  }

  return json({
    verificationRequired: true,
    message: "Check your email to finish claiming the official account.",
  }, 202);
}

export async function showOfficialAccountClaimConfirmation(
  request: Request,
  env: OfficialAccountClaimEnv,
): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!TOKEN_PATTERN.test(token)) {
    return confirmationPage("Invalid confirmation link", "Request a new official account claim from the Oldtime signup page.", { status: 400 });
  }
  const configuredEmail = normalizeEmail(env.OFFICIAL_ACCOUNT_CLAIM_EMAIL);
  const pending = await env.DB.prepare(`
    SELECT email_hash, password_salt, password_hash, expires_at
    FROM official_account_claim_requests
    WHERE claim_key = ? AND token_hash = ?
    LIMIT 1
  `).bind("official", sha256(token)).first<PendingClaim>();
  if (!pending) {
    return confirmationPage("Link unavailable", "This confirmation link is invalid or has already been used.", { status: 410 });
  }
  if (pending.expires_at <= Date.now()) {
    await env.DB.prepare(`
      DELETE FROM official_account_claim_requests
      WHERE claim_key = ? AND token_hash = ?
    `).bind("official", sha256(token)).run();
    return confirmationPage("Link expired", "Request a new official account claim from the Oldtime signup page.", { status: 410 });
  }
  if (!configuredEmail || sha256(configuredEmail) !== pending.email_hash) {
    return confirmationPage("Link unavailable", "This confirmation link is no longer valid. Request a new official account claim.", { status: 410 });
  }
  return confirmationPage(
    "Confirm the official account",
    "Confirm your email to create the reserved @oldtime account. The account will be created only after you press the button below.",
    { token, confirm: true },
  );
}

export async function confirmOfficialAccountClaim(
  request: Request,
  env: OfficialAccountClaimEnv,
): Promise<Response> {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.startsWith("application/x-www-form-urlencoded") ||
      Number(request.headers.get("content-length")) > MAX_FORM_BYTES) {
    return confirmationPage("Invalid request", "Open the confirmation link from your email and try again.", { status: 400 });
  }
  const origin = request.headers.get("origin");
  // Some mobile email webviews submit the confirmation form with an opaque Origin.
  // The token is already a short-lived, single-use bearer credential; keep rejecting
  // concrete origins outside Oldtime while allowing the webview's "null" origin.
  if (origin && origin !== "null" && !ALLOWED_ORIGINS.has(origin)) {
    return confirmationPage("Invalid request", "Open the confirmation link from your email and try again.", { status: 403 });
  }

  const token = (await readToken(request)) || "";
  if (!TOKEN_PATTERN.test(token)) {
    return confirmationPage("Invalid confirmation link", "Request a new official account claim from the Oldtime signup page.", { status: 400 });
  }
  const configuredEmail = normalizeEmail(env.OFFICIAL_ACCOUNT_CLAIM_EMAIL);
  const emailDigest = configuredEmail ? sha256(configuredEmail) : "";
  const digest = sha256(token);
  const now = Date.now();
  const pending = await env.DB.prepare(`
    SELECT email_hash, password_salt, password_hash, expires_at
    FROM official_account_claim_requests
    WHERE claim_key = ? AND token_hash = ?
    LIMIT 1
  `).bind("official", digest).first<PendingClaim>();
  if (!pending) {
    return confirmationPage("Link unavailable", "This confirmation link is invalid or has already been used.", { status: 410 });
  }
  if (pending.expires_at <= now) {
    await env.DB.prepare(`
      DELETE FROM official_account_claim_requests
      WHERE claim_key = ? AND token_hash = ?
    `).bind("official", digest).run();
    return confirmationPage("Link expired", "Request a new official account claim from the Oldtime signup page.", { status: 410 });
  }
  if (!configuredEmail || pending.email_hash !== emailDigest) {
    return confirmationPage("Link unavailable", "This confirmation link is no longer valid. Request a new official account claim.", { status: 410 });
  }

  try {
    const results = await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO users (
          id, email, username, display_name, password_salt, password_hash, created_at, email_verified_at
        )
        SELECT ?, ?, ?, ?, claim.password_salt, claim.password_hash, ?, CAST(strftime('%s','now') AS INTEGER)*1000
        FROM official_account_claim_requests AS claim
        WHERE claim.claim_key = ?
          AND claim.token_hash = ?
          AND claim.email_hash = ?
          AND claim.expires_at > ?
          AND NOT EXISTS (SELECT 1 FROM users WHERE id = ?)
          AND NOT EXISTS (SELECT 1 FROM users WHERE lower(username) = ?)
          AND NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = ?)
      `).bind(
        OFFICIAL_OLDTIME_ACCOUNT_ID,
        configuredEmail,
        OFFICIAL_OLDTIME_USERNAME,
        "Oldtime",
        now,
        "official",
        digest,
        emailDigest,
        now,
        OFFICIAL_OLDTIME_ACCOUNT_ID,
        OFFICIAL_OLDTIME_USERNAME,
        configuredEmail,
      ),
      env.DB.prepare(`
        DELETE FROM official_account_claim_requests
        WHERE claim_key = ? AND token_hash = ?
          AND EXISTS (SELECT 1 FROM users WHERE id = ?)
      `).bind("official", digest, OFFICIAL_OLDTIME_ACCOUNT_ID),
    ]);
    if ((results[0]?.meta?.changes ?? 0) === 0) {
      const existingOfficial = await env.DB.prepare(
        "SELECT id FROM users WHERE id = ? OR lower(username) = ? LIMIT 1",
      ).bind(OFFICIAL_OLDTIME_ACCOUNT_ID, OFFICIAL_OLDTIME_USERNAME).first<{ id: string }>();
      if (existingOfficial) {
        return confirmationPage("Claim unavailable", "The official account has already been claimed.", { status: 409 });
      }
      return confirmationPage("Link unavailable", "This confirmation link is no longer valid. Request a new one.", { status: 410 });
    }
  } catch {
    return confirmationPage("Account not created", "We could not finish creating the official account. Open a new claim link or contact Oldtime support.", { status: 503 });
  }

  return confirmationPage(
    "Official account claimed",
    "Your @oldtime account is ready. Return to Oldtime and log in with the email and password you chose.",
    { returnLink: true },
  );
}

