import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OFFICIAL_OLDTIME_ACCOUNT_ID,
  OFFICIAL_OLDTIME_USERNAME,
} from "@workspace/api-zod/account-policy";
import type { Database, D1Result, Statement } from "../src/cloudflare/runtime";
import {
  confirmOfficialAccountClaim,
  requestOfficialAccountClaim,
  showOfficialAccountClaimConfirmation,
  type ClaimEmailSender,
} from "../src/cloudflare/official-account-claim";
import type { VerificationEmailPayload } from "../src/cloudflare/email-verification";

interface PendingClaim {
  email_hash: string;
  password_salt: string;
  password_hash: string;
  token_hash: string;
  created_at: number;
  expires_at: number;
}

interface ClaimUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  password_salt: string;
  password_hash: string;
  created_at: number;
}

class ClaimDatabase implements Database {
  pending: PendingClaim | null = null;
  user: ClaimUser | null = null;

  prepare(sql: string): Statement {
    const database = this;
    let values: unknown[] = [];
    const statement = {
      sql,
      get values() { return values; },
      bind(...bound: unknown[]) {
        values = bound;
        return this;
      },
      async all<T>(): Promise<D1Result<T>> {
        return { success: true, results: [] };
      },
      async first<T>(): Promise<T | null> {
        if (sql.includes("SELECT id FROM users WHERE id = ? OR lower(username) = ?")) {
          return database.user &&
            (database.user.id === values[0] || database.user.username.toLowerCase() === String(values[1]).toLowerCase())
            ? { id: database.user.id } as T
            : null;
        }
        if (sql.includes("SELECT id FROM users WHERE lower(email) = ?")) {
          return database.user?.email.toLowerCase() === String(values[0]).toLowerCase()
            ? { id: database.user.id } as T
            : null;
        }
        if (sql.includes("SELECT created_at") && sql.includes("official_account_claim_requests")) {
          return database.pending ? { created_at: database.pending.created_at } as T : null;
        }
        if (sql.includes("SELECT email_hash, password_salt, password_hash, expires_at")) {
          if (!database.pending || database.pending.token_hash !== values[1]) return null;
          return {
            email_hash: database.pending.email_hash,
            password_salt: database.pending.password_salt,
            password_hash: database.pending.password_hash,
            expires_at: database.pending.expires_at,
          } as T;
        }
        return null;
      },
      async run<T = unknown>(): Promise<D1Result<T>> {
        if (sql.includes("INSERT INTO official_account_claim_requests")) {
          database.pending = {
            email_hash: String(values[1]),
            password_salt: String(values[2]),
            password_hash: String(values[3]),
            token_hash: String(values[4]),
            created_at: Number(values[5]),
            expires_at: Number(values[6]),
          };
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes("DELETE FROM official_account_claim_requests")) {
          const canDelete = database.pending !== null &&
            database.pending.token_hash === String(values[1]);
          if (canDelete) database.pending = null;
          return { success: true, meta: { changes: canDelete ? 1 : 0 } };
        }
        return { success: true, meta: { changes: 0 } };
      },
    };
    return statement as Statement & { sql: string; values: unknown[] };
  }

  async batch<T = unknown>(statements: Statement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    for (const statement of statements) {
      const query = statement as Statement & { sql?: string; values?: unknown[] };
      const sql = query.sql || "";
      const values = query.values || [];
      if (sql.includes("INSERT INTO users") && sql.includes("official_account_claim_requests AS claim")) {
        const valid = this.pending !== null &&
          this.pending.token_hash === String(values[6]) &&
          this.pending.email_hash === String(values[7]) &&
          this.pending.expires_at > Number(values[8]) &&
          !this.user &&
          String(values[0]) === OFFICIAL_OLDTIME_ACCOUNT_ID &&
          String(values[2]) === OFFICIAL_OLDTIME_USERNAME;
        if (valid) {
          this.user = {
            id: String(values[0]),
            email: String(values[1]),
            username: String(values[2]),
            display_name: String(values[3]),
            password_salt: this.pending!.password_salt,
            password_hash: this.pending!.password_hash,
            created_at: Number(values[4]),
          };
        }
        results.push({ success: true, meta: { changes: valid ? 1 : 0 } });
      } else if (sql.includes("DELETE FROM official_account_claim_requests")) {
        const canDelete = this.pending !== null &&
          this.pending.token_hash === String(values[1]) &&
          this.user?.id === String(values[2]);
        if (canDelete) this.pending = null;
        results.push({ success: true, meta: { changes: canDelete ? 1 : 0 } });
      } else {
        results.push({ success: true, meta: { changes: 0 } });
      }
    }
    return results;
  }
}

function emailClaimRequest(email: string): Request {
  return new Request("https://api.heyoldtime.com/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      username: OFFICIAL_OLDTIME_USERNAME,
      displayName: "Oldtime",
      password: "not-stored-in-plaintext",
    }),
  });
}

test("official account stays uncreated until the verified owner confirms the one-time link", async () => {
  const db = new ClaimDatabase();
  const emails: VerificationEmailPayload[] = [];
  const env = {
    DB: db,
    RESEND_API_KEY: "test-resend-key",
    OFFICIAL_ACCOUNT_CLAIM_EMAIL: "owner@example.com",
  };
  const sendEmail: ClaimEmailSender = async (_key, payload) => {
    emails.push(payload);
    return true;
  };

  const requested = await requestOfficialAccountClaim(
    env,
    " OWNER@example.com ",
    { passwordSalt: "salt", passwordHash: "scrypt-hash" },
    sendEmail,
  );
  assert.equal(requested.status, 202);
  assert.equal(db.user, null, "unverified requests must not create or reserve the account");
  assert.equal(db.pending?.password_hash, "scrypt-hash");
  assert.equal(emails.length, 1);
  assert.deepEqual(emails[0].to, ["owner@example.com"]);
  assert.match(emails[0].subject, /verify your email/i);
  assert.doesNotMatch(JSON.stringify(db.pending), /owner@example\.com/i);

  const link = emails[0].text.match(/https:\/\/heyoldtime\.com\/api\/auth\/official-claim\/verify\?token=[A-Za-z0-9_-]{43}/)?.[0];
  assert.ok(link, "the message should contain a short-lived confirmation link");
  const token = new URL(link).searchParams.get("token");
  assert.ok(token);
  const preview = await showOfficialAccountClaimConfirmation(new Request(link), env);
  assert.equal(preview.status, 200);
  assert.match(await preview.text(), /Confirm and create account/);
  assert.equal(db.user, null, "opening the link must not consume it or create the account");

  const rejectedOrigin = await confirmOfficialAccountClaim(
    new Request("https://api.heyoldtime.com/api/auth/official-claim/verify", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://untrusted.example",
      },
      body: new URLSearchParams({ token }),
    }),
    env,
  );
  assert.equal(rejectedOrigin.status, 403);
  assert.equal(db.user, null, "untrusted concrete origins cannot create the account");
  assert.ok(db.pending, "rejecting an origin must not consume the pending claim");

  const confirmation = await confirmOfficialAccountClaim(
    new Request("https://api.heyoldtime.com/api/auth/official-claim/verify", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "null",
      },
      body: new URLSearchParams({ token }),
    }),
    env,
  );
  assert.equal(confirmation.status, 200);
  assert.match(await confirmation.text(), /Official account claimed/);
  assert.equal(db.user?.id, OFFICIAL_OLDTIME_ACCOUNT_ID);
  assert.equal(db.user?.username, OFFICIAL_OLDTIME_USERNAME);
  assert.equal(db.user?.email, "owner@example.com");
  assert.equal(db.pending, null);

  const replay = await confirmOfficialAccountClaim(
    new Request("https://api.heyoldtime.com/api/auth/official-claim/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }),
    env,
  );
  assert.equal(replay.status, 410, "the one-time link cannot be reused");
});

test("the official username rejects unapproved emails and does not send them mail", async () => {
  const db = new ClaimDatabase();
  let sends = 0;
  const response = await requestOfficialAccountClaim(
    { DB: db, RESEND_API_KEY: "test-resend-key", OFFICIAL_ACCOUNT_CLAIM_EMAIL: "owner@example.com" },
    "someone-else@example.com",
    { passwordSalt: "salt", passwordHash: "hash" },
    async () => {
      sends++;
      return true;
    },
  );
  assert.equal(response.status, 409);
  assert.equal(db.pending, null);
  assert.equal(sends, 0);
});

test("official account claim fails closed when mail delivery is not configured", async () => {
  const db = new ClaimDatabase();
  const response = await requestOfficialAccountClaim(
    { DB: db, OFFICIAL_ACCOUNT_CLAIM_EMAIL: "owner@example.com" },
    "owner@example.com",
    { passwordSalt: "salt", passwordHash: "hash" },
  );
  assert.equal(response.status, 503);
  assert.equal(db.pending, null);
});

test("failed mail delivery removes the pending credentials and link hash", async () => {
  const db = new ClaimDatabase();
  const response = await requestOfficialAccountClaim(
    { DB: db, RESEND_API_KEY: "test-resend-key", OFFICIAL_ACCOUNT_CLAIM_EMAIL: "owner@example.com" },
    "owner@example.com",
    { passwordSalt: "salt", passwordHash: "hash" },
    async () => false,
  );
  assert.equal(response.status, 503);
  assert.equal(db.pending, null);
});

test("a pending link becomes unusable if the configured claim email changes", async () => {
  const db = new ClaimDatabase();
  const emails: VerificationEmailPayload[] = [];
  const env = {
    DB: db,
    RESEND_API_KEY: "test-resend-key",
    OFFICIAL_ACCOUNT_CLAIM_EMAIL: "owner@example.com",
  };
  await requestOfficialAccountClaim(
    env,
    "owner@example.com",
    { passwordSalt: "salt", passwordHash: "hash" },
    async (_key, payload) => {
      emails.push(payload);
      return true;
    },
  );
  const link = emails[0].text.match(/https:\/\/heyoldtime\.com\/api\/auth\/official-claim\/verify\?token=[A-Za-z0-9_-]{43}/)?.[0];
  assert.ok(link);
  const token = new URL(link).searchParams.get("token");
  assert.ok(token);
  const response = await confirmOfficialAccountClaim(
    new Request("https://api.heyoldtime.com/api/auth/official-claim/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }),
    { ...env, OFFICIAL_ACCOUNT_CLAIM_EMAIL: "new-owner@example.com" },
  );
  assert.equal(response.status, 410);
  assert.equal(db.user, null);
});
