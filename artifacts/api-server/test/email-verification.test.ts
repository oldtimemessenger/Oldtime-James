import assert from "node:assert/strict";
import { test } from "node:test";
import type { Database, D1Result, Statement } from "../src/cloudflare/runtime";
import {
  confirmEmailChange,
  requestEmailChange,
  showEmailChangeConfirmation,
  type VerificationEmailPayload,
} from "../src/cloudflare/email-verification";

interface PendingRow {
  user_id: string;
  new_email: string;
  token_hash: string;
  created_at: number;
  expires_at: number;
}

class EmailChangeDatabase implements Database {
  currentEmail = "original@example.com";
  pending: PendingRow | null = null;
  conflictEmail: string | null = null;

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
        if (sql.includes("SELECT id FROM users WHERE lower(email) = ? LIMIT 1")) {
          const email = String(values[0]).toLowerCase();
          if (email === database.currentEmail.toLowerCase()) return { id: "user-1" } as T;
          if (email === database.conflictEmail?.toLowerCase()) return { id: "user-2" } as T;
          return null;
        }
        if (sql.includes("SELECT created_at FROM email_change_requests")) {
          return database.pending ? { created_at: database.pending.created_at } as T : null;
        }
        if (sql.includes("SELECT user_id, new_email, expires_at")) {
          if (!database.pending || database.pending.token_hash !== values[0]) return null;
          return {
            user_id: database.pending.user_id,
            new_email: database.pending.new_email,
            expires_at: database.pending.expires_at,
          } as T;
        }
        if (sql.includes("SELECT r.user_id, r.new_email, r.expires_at")) {
          if (!database.pending || database.pending.token_hash !== values[0]) return null;
          return {
            user_id: database.pending.user_id,
            new_email: database.pending.new_email,
            expires_at: database.pending.expires_at,
            old_email: database.currentEmail,
          } as T;
        }
        if (sql.includes("SELECT id FROM users WHERE lower(email) = ? AND id <> ?")) {
          return database.conflictEmail?.toLowerCase() === String(values[0]).toLowerCase()
            ? { id: "user-2" } as T
            : null;
        }
        return null;
      },
      async run<T = unknown>(): Promise<D1Result<T>> {
        if (sql.includes("INSERT INTO email_change_requests")) {
          database.pending = {
            user_id: String(values[0]),
            new_email: String(values[1]),
            token_hash: String(values[2]),
            created_at: Number(values[3]),
            expires_at: Number(values[4]),
          };
        } else if (sql.includes("DELETE FROM email_change_requests")) {
          if (database.pending?.user_id === values[0] && database.pending.token_hash === values[1]) {
            database.pending = null;
          }
        }
        return { success: true, meta: { changes: 1 } };
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
      if (sql.includes("UPDATE users SET email = ?")) {
        const canUpdate = this.pending !== null &&
          this.pending.user_id === values[2] &&
          this.pending.token_hash === values[4] &&
          this.pending.expires_at > Number(values[5]) &&
          this.conflictEmail?.toLowerCase() !== String(values[0]).toLowerCase();
        if (canUpdate) this.currentEmail = String(values[0]);
        results.push({ success: true, meta: { changes: canUpdate ? 1 : 0 } });
      } else if (sql.includes("DELETE FROM email_change_requests")) {
        if (
          this.pending?.user_id === values[0] &&
          this.pending.token_hash === values[1] &&
          this.currentEmail === values[3]
        ) this.pending = null;
        results.push({ success: true, meta: { changes: this.pending ? 0 : 1 } });
      } else {
        results.push({ success: true, meta: { changes: 0 } });
      }
    }
    return results;
  }
}

function emailChangeRequest(email: string): Request {
  return new Request("https://api.heyoldtime.com/api/account/email-change/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

test("email change is pending until the recipient explicitly confirms the single-use link", async () => {
  const db = new EmailChangeDatabase();
  const sent: VerificationEmailPayload[] = [];
  const env = { DB: db, RESEND_API_KEY: "test-resend-key" };
  const send = async (_key: string, payload: VerificationEmailPayload) => {
    sent.push(payload);
    return true;
  };

  const requested = await requestEmailChange(
    emailChangeRequest("NewAddress@example.com"),
    env,
    { id: "user-1", email: db.currentEmail },
    send,
  );
  assert.equal(requested.status, 200);
  assert.equal(db.currentEmail, "original@example.com");
  assert.equal(db.pending?.new_email, "newaddress@example.com");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ["newaddress@example.com"]);

  const link = sent[0].text.match(/https:\/\/heyoldtime\.com\/api\/account\/email-change\/verify\?token=[A-Za-z0-9_-]{43}/)?.[0];
  assert.ok(link, "email should contain a confirmation link");
  const token = new URL(link).searchParams.get("token");
  assert.ok(token);

  const preview = await showEmailChangeConfirmation(
    new Request(link),
    db,
  );
  const page = await preview.text();
  assert.equal(preview.status, 200);
  assert.match(page, /Confirm email change/);
  assert.doesNotMatch(page, /<script/i);
  assert.equal(db.currentEmail, "original@example.com");

  const confirmation = await confirmEmailChange(
    new Request("https://api.heyoldtime.com/api/account/email-change/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }),
    env,
    send,
  );
  assert.equal(confirmation.status, 200);
  assert.match(await confirmation.text(), /Email confirmed/);
  assert.equal(db.currentEmail, "newaddress@example.com");
  assert.equal(db.pending, null);
  assert.deepEqual(sent[1].to, ["original@example.com"]);

  const reused = await confirmEmailChange(
    new Request("https://api.heyoldtime.com/api/account/email-change/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }),
    env,
    send,
  );
  assert.equal(reused.status, 410);
});

test("email change fails closed when the Cloudflare Worker has no Resend secret", async () => {
  const db = new EmailChangeDatabase();
  const response = await requestEmailChange(
    emailChangeRequest("new@example.com"),
    { DB: db },
    { id: "user-1", email: db.currentEmail },
  );
  assert.equal(response.status, 503);
  assert.equal(db.pending, null);
});

test("failed Resend delivery removes the pending token and keeps the current address", async () => {
  const db = new EmailChangeDatabase();
  const response = await requestEmailChange(
    emailChangeRequest("new@example.com"),
    { DB: db, RESEND_API_KEY: "test-resend-key" },
    { id: "user-1", email: db.currentEmail },
    async () => false,
  );
  assert.equal(response.status, 503);
  assert.equal(db.pending, null);
  assert.equal(db.currentEmail, "original@example.com");
});

test("Resend provider request uses the configured sender and bearer authorization", async () => {
  const { sendResendEmail } = await import("../src/cloudflare/email-verification");
  let sentRequest: Request | null = null;
  const success = await sendResendEmail(
    "test-resend-key",
    {
      from: "Oldtime <verify@heyoldtime.com>",
      to: ["person@example.com"],
      subject: "Confirm your Oldtime email change",
      text: "Confirm",
      html: "<p>Confirm</p>",
    },
    async (input, init) => {
      sentRequest = new Request(input, init);
      return new Response(null, { status: 200 });
    },
  );
  assert.equal(success, true);
  assert.ok(sentRequest);
  assert.equal(new URL(sentRequest.url).origin, "https://api.resend.com");
  assert.equal(sentRequest.headers.get("authorization"), "Bearer test-resend-key");
  assert.match(await sentRequest.text(), /verify@heyoldtime\.com/);
});
