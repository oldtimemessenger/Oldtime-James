import { randomBytes } from "node:crypto";
import type { Database } from "./runtime";
import { json } from "./runtime";
import { accountVerificationEmail } from "./account-email-template";
import { tokenHash, TOKEN_PATTERN, readConfirmationToken, verificationPage, sendResendEmail, type ResendSender } from "./email-verification";

interface Env { DB: Database; RESEND_API_KEY?: string }
const PATH = "/api/account/email-verification/verify";
// Existing confirmed production domain; never derived from an untrusted Host header.
const ORIGIN = "https://heyoldtime.com";
interface Pending { user_id: string; email: string; expires_at: number }
interface VerificationUser { email:string; email_verified_at:number|null; email_verification_known:number }
const page = (title: string, message: string, options: { status?: number; email?: string; token?: string; confirm?: boolean } = {}) =>
  verificationPage(title, message, { ...options, actionPath: PATH, actionLabel: "Verify email" });

export async function emailVerificationStatus(db: Database, id: string) {
  const user = await db.prepare("SELECT email,email_verified_at,email_verification_known FROM users WHERE id=?").bind(id).first<VerificationUser>();
  if (!user) return json({error:"Your session has expired. Sign in again."},401);
  return json({verified:user.email_verified_at ? true : user.email_verification_known === 1 ? false : null,email:user.email});
}

export async function requestSignupEmailVerification(env: Env, id: string, send: ResendSender = sendResendEmail) {
  const user = await env.DB.prepare("SELECT email,email_verified_at,email_verification_known FROM users WHERE id=?").bind(id).first<VerificationUser>();
  if (!user) return json({error:"Your session has expired. Sign in again."},401);
  if (user.email_verified_at) return json({ok:true,alreadyVerified:true});
  if (!env.RESEND_API_KEY) return json({error:"Email verification is not available right now."},503);
  const now = Date.now();
  const prior = await env.DB.prepare("SELECT created_at FROM email_verification_requests WHERE user_id=?").bind(id).first<{created_at:number}>();
  if (prior && now - prior.created_at < 60_000) return json({error:"Please wait a minute before requesting another email."},429);
  const token = randomBytes(32).toString("base64url"), digest = tokenHash(token), expiresAt = now + 30*60_000;
  const reservation = await env.DB.prepare(`INSERT INTO email_verification_requests(user_id,email,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,token_hash=excluded.token_hash,created_at=excluded.created_at,expires_at=excluded.expires_at
    WHERE email_verification_requests.created_at <= excluded.created_at-60000`)
    .bind(id,user.email,digest,now,expiresAt).run();
  if (!reservation.meta?.changes) return json({error:"Please wait a minute before requesting another email."},429);
  const url = new URL(PATH,ORIGIN); url.searchParams.set("token",token);
  try {
    if (!await send(env.RESEND_API_KEY,accountVerificationEmail(user.email,url.toString()))) throw new Error("Delivery rejected");
  } catch {
    await env.DB.prepare("DELETE FROM email_verification_requests WHERE user_id=? AND token_hash=?").bind(id,digest).run();
    return json({error:"The verification email could not be sent. Try again later."},503);
  }
  await env.DB.prepare("UPDATE users SET email_verification_known=1 WHERE id=? AND email=?").bind(id,user.email).run();
  return json({ok:true,expiresAt});
}

export async function signupEmailConfirmation(request: Request, env: Env) {
  const posting = request.method === "POST";
  if (posting) {
    const origin = request.headers.get("origin");
    if (origin && origin !== "null" && origin !== ORIGIN && origin !== "https://www.heyoldtime.com") return page("Invalid request","Open the link from your email and try again.",{status:403});
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) return page("Invalid request","Open the link from your email and try again.",{status:400});
  }
  const token = posting ? await readConfirmationToken(request) || "" : new URL(request.url).searchParams.get("token") || "";
  if (!TOKEN_PATTERN.test(token)) return page("Invalid verification link","Request a fresh link from Oldtime.",{status:400});
  const digest = tokenHash(token);
  const pending = await env.DB.prepare(`SELECT r.user_id,r.email,r.expires_at FROM email_verification_requests r
    JOIN users u ON u.id=r.user_id AND lower(u.email)=lower(r.email) WHERE r.token_hash=?`)
    .bind(digest).first<Pending>();
  if (!pending) return page("Link unavailable","This link is invalid, already used, or no longer matches your sign-in email.",{status:410});
  if (pending.expires_at <= Date.now()) {
    await env.DB.prepare("DELETE FROM email_verification_requests WHERE user_id=? AND token_hash=?").bind(pending.user_id,digest).run();
    return page("Link expired","Request a fresh verification email from Oldtime.",{status:410});
  }
  if (!posting) return page("Verify your email","Confirm this address for your Oldtime account.",{email:pending.email,token,confirm:true});
  const now = Date.now();
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE users SET email_verified_at=? WHERE id=? AND lower(email)=lower(?) AND EXISTS(
      SELECT 1 FROM email_verification_requests WHERE user_id=? AND token_hash=? AND expires_at>?)`)
      .bind(now,pending.user_id,pending.email,pending.user_id,digest,now),
    env.DB.prepare("DELETE FROM email_verification_requests WHERE user_id=? AND token_hash=?").bind(pending.user_id,digest),
  ]);
  if (!(results[0]?.meta?.changes)) return page("Link unavailable","Request a fresh verification email from Oldtime.",{status:410});
  return page("Email verified","Your email is confirmed. Return to Oldtime; no new account or sign-in is required.");
}
