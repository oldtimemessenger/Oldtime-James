import { createHash, randomBytes } from "node:crypto";
import { accountVerificationEmail } from "./account-email-template";
import { z } from "zod";
import type { Database } from "./runtime";
import { body, json } from "./runtime";

interface EmailVerificationEnv {
  DB: Database;
  RESEND_API_KEY?: string;
}

interface EmailVerificationUser {
  id: string;
  email: string;
}

interface PendingEmailChange {
  user_id: string;
  new_email: string;
  expires_at: number;
}

const requestBodySchema = z.object({
  email: z.string().trim().email().max(254),
});

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const VERIFICATION_PATH = "/api/account/email-change/verify";
const APP_ORIGIN = "https://heyoldtime.com";
const FROM_EMAIL = "Oldtime <verify@heyoldtime.com>";

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function readConfirmationToken(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > 4096 || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 4096) {
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

export function verificationPage(
  title: string,
  message: string,
  options: { status?: number; email?: string; token?: string; confirm?: boolean; actionPath?: string; actionLabel?: string } = {},
): Response {
  const emailLine = options.email
    ? `<p class="email">${escapeHtml(options.email)}</p>`
    : "";
  const confirmationForm = options.confirm && options.token
    ? `<form method="post" action="${escapeHtml(options.actionPath || VERIFICATION_PATH)}">
        <input type="hidden" name="token" value="${escapeHtml(options.token)}">
        <button type="submit">${escapeHtml(options.actionLabel || "Confirm email change")}</button>
      </form>`
    : "";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} · Oldtime</title>
    <style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#fff;color:#17191c;font:16px/1.5 Arial,Helvetica,sans-serif}
      main{width:min(100%,440px);padding:24px;border:1px solid #e8e9ec;border-radius:16px;background:#fff}
      h1{margin:0 0 12px;font-size:24px;line-height:1.2}p{color:#53565c;margin:0 0 18px}.email{color:#17191c;font-weight:650;overflow-wrap:anywhere}
      button{width:100%;min-height:46px;border:0;border-radius:10px;background:#1557d2;color:white;font:inherit;font-weight:700;cursor:pointer}
      a{color:#1557d2}footer{margin-top:22px;color:#62656a;font-size:13px}
    </style>
  </head>
  <body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${emailLine}${confirmationForm}<footer>Oldtime · Your people, your moments.</footer></main></body>
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

export interface VerificationEmailPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
}

export type ResendSender = (
  apiKey: string,
  payload: VerificationEmailPayload,
) => Promise<boolean>;

export async function sendResendEmail(
  apiKey: string,
  payload: VerificationEmailPayload,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const response = await fetcher(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return response.ok;
}

export async function requestEmailChange(
  request: Request,
  env: EmailVerificationEnv,
  user: EmailVerificationUser,
  sendEmail: ResendSender = sendResendEmail,
): Promise<Response> {
  if (!env.RESEND_API_KEY) {
    return json({ error: "Email verification is not available right now." }, 503);
  }

  let bodyValue: unknown;
  try {
    bodyValue = await body(request, 4096);
  } catch {
    return json({ error: "Enter a valid email address." }, 400);
  }
  const parsed = requestBodySchema.safeParse(bodyValue);
  if (!parsed.success) return json({ error: "Enter a valid email address." }, 400);

  const newEmail = parsed.data.email.toLowerCase();
  if (newEmail === user.email.toLowerCase()) {
    return json({ error: "That is already your sign-in email." }, 400);
  }

  const existingAccount = await env.DB.prepare(
    "SELECT id FROM users WHERE lower(email) = ? LIMIT 1",
  ).bind(newEmail).first<{ id: string }>();
  if (existingAccount && existingAccount.id !== user.id) {
    return json({ error: "That email address is already in use." }, 409);
  }

  const now = Date.now();
  const previous = await env.DB.prepare(
    "SELECT created_at FROM email_change_requests WHERE user_id = ? LIMIT 1",
  ).bind(user.id).first<{ created_at: number }>();
  if (previous && now - previous.created_at < 60_000) {
    return json({ error: "Please wait a minute before requesting another email." }, 429);
  }

  const token = randomBytes(32).toString("base64url");
  const digest = tokenHash(token);
  const expiresAt = now + TOKEN_TTL_MS;
  await env.DB.prepare(`
    INSERT INTO email_change_requests (user_id, new_email, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      new_email = excluded.new_email,
      token_hash = excluded.token_hash,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at
  `).bind(user.id, newEmail, digest, now, expiresAt).run();

  const verificationUrl = new URL(VERIFICATION_PATH, APP_ORIGIN);
  verificationUrl.searchParams.set("token", token);
  try {
    const sent = await sendEmail(
      env.RESEND_API_KEY,
      accountVerificationEmail(newEmail, verificationUrl.toString(), "change"),
    );
    if (!sent) throw new Error("Email provider rejected the request.");
  } catch {
    await env.DB.prepare(
      "DELETE FROM email_change_requests WHERE user_id = ? AND token_hash = ?",
    ).bind(user.id, digest).run();
    return json({ error: "The verification email could not be sent. Try again later." }, 503);
  }

  return json({ ok: true, pendingEmail: newEmail, expiresAt });
}

export async function showEmailChangeConfirmation(
  request: Request,
  db: Database,
): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!TOKEN_PATTERN.test(token)) {
    return verificationPage("Invalid confirmation link", "Request a new email change from your Oldtime profile.", { status: 400 });
  }
  const digest = tokenHash(token);
  const pending = await db.prepare(`
    SELECT user_id, new_email, expires_at
    FROM email_change_requests
    WHERE token_hash = ?
    LIMIT 1
  `).bind(digest).first<PendingEmailChange>();
  if (!pending) {
    return verificationPage("Link unavailable", "This confirmation link is invalid or has already been used.", { status: 410 });
  }
  if (pending.expires_at <= Date.now()) {
    await db.prepare("DELETE FROM email_change_requests WHERE user_id = ? AND token_hash = ?")
      .bind(pending.user_id, digest).run();
    return verificationPage("Link expired", "Request a new email change from your Oldtime profile.", { status: 410 });
  }
  return verificationPage(
    "Confirm your email",
    "Confirm this change to use the new address for your Oldtime sign-in. Your current email stays active until you confirm.",
    { email: pending.new_email, token, confirm: true },
  );
}

export async function confirmEmailChange(
  request: Request,
  env: EmailVerificationEnv,
  sendEmail: ResendSender = sendResendEmail,
): Promise<Response> {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.startsWith("application/x-www-form-urlencoded") || Number(request.headers.get("content-length")) > 4096) {
    return verificationPage("Invalid request", "Open the confirmation link from your email and try again.", { status: 400 });
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== "null" && origin !== APP_ORIGIN && origin !== "https://www.heyoldtime.com") {
    return verificationPage("Invalid request", "Open the confirmation link from your email and try again.", { status: 403 });
  }

  const token = (await readConfirmationToken(request)) || "";
  if (!TOKEN_PATTERN.test(token)) {
    return verificationPage("Invalid confirmation link", "Request a new email change from your Oldtime profile.", { status: 400 });
  }

  const digest = tokenHash(token);
  const pending = await env.DB.prepare(`
    SELECT r.user_id, r.new_email, r.expires_at, u.email AS old_email
    FROM email_change_requests r
    JOIN users u ON u.id = r.user_id
    WHERE r.token_hash = ?
    LIMIT 1
  `).bind(digest).first<PendingEmailChange & { old_email: string }>();
  if (!pending) {
    return verificationPage("Link unavailable", "This confirmation link is invalid or has already been used.", { status: 410 });
  }
  if (pending.expires_at <= Date.now()) {
    await env.DB.prepare("DELETE FROM email_change_requests WHERE user_id = ? AND token_hash = ?")
      .bind(pending.user_id, digest).run();
    return verificationPage("Link expired", "Request a new email change from your Oldtime profile.", { status: 410 });
  }

  try {
    const results = await env.DB.batch([
      env.DB.prepare(`
        UPDATE users SET email = ?, email_verified_at = ?
        WHERE id = ?
          AND EXISTS (
            SELECT 1 FROM email_change_requests
            WHERE user_id = ? AND token_hash = ? AND expires_at > ?
          )
          AND NOT EXISTS (
            SELECT 1 FROM users WHERE lower(email) = ? AND id <> ?
          )
      `).bind(pending.new_email, Date.now(), pending.user_id, pending.user_id, digest, Date.now(), pending.new_email, pending.user_id),
      env.DB.prepare(`
        DELETE FROM email_change_requests
        WHERE user_id = ? AND token_hash = ?
          AND EXISTS (SELECT 1 FROM users WHERE id = ? AND email = ?)
      `).bind(pending.user_id, digest, pending.user_id, pending.new_email),
    ]);
    if ((results[0]?.meta?.changes ?? 0) === 0) {
      const conflict = await env.DB.prepare(
        "SELECT id FROM users WHERE lower(email) = ? AND id <> ? LIMIT 1",
      ).bind(pending.new_email, pending.user_id).first<{ id: string }>();
      if (conflict) {
        return verificationPage("Email already in use", "This address is now associated with another Oldtime account. Request a new link with a different address.", { status: 409 });
      }
      return verificationPage("Link unavailable", "This confirmation link is no longer valid. Request a new one from your Oldtime profile.", { status: 410 });
    }
  } catch {
    try {
      const conflict = await env.DB.prepare(
        "SELECT id FROM users WHERE lower(email) = ? AND id <> ? LIMIT 1",
      ).bind(pending.new_email, pending.user_id).first<{ id: string }>();
      if (conflict) {
        return verificationPage("Email already in use", "This address is now associated with another Oldtime account. Request a new link with a different address.", { status: 409 });
      }
    } catch {
      // Keep database errors private and avoid exposing a potentially reusable token.
    }
    return verificationPage("Email not changed", "We could not update your email right now. Try again or request a new link.", { status: 503 });
  }

  const notice = {
    from: FROM_EMAIL,
    to: [pending.old_email],
    subject: "Your Oldtime sign-in email changed",
    text: `Your Oldtime sign-in email was changed to ${pending.new_email}. If you did not make this change, secure your account by changing your password and contact Oldtime support.`,
    html: `<p>Your Oldtime sign-in email was changed to <strong>${escapeHtml(pending.new_email)}</strong>.</p><p>If you did not make this change, secure your account by changing your password and contact Oldtime support.</p>`,
  };
  try {
    if (env.RESEND_API_KEY) await sendEmail(env.RESEND_API_KEY, notice);
  } catch {
    // The email change is already committed; a notification failure must not undo it.
  }

  return verificationPage(
    "Email confirmed",
    "Your Oldtime sign-in email has been changed. Your current session remains active; use the new email the next time you sign in.",
  );
}
