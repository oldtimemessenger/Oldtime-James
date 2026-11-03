import type { Database } from "./runtime";

// The existing D1 foreign-key triggers remove owned rows. Media deletion is
// durable and retriable via the existing R2 cleanup queue, not a best-effort
// request after the account has already disappeared. No schema changes.
export async function deleteOwnAccount(db: Database, userId: string): Promise<void> {
  await db.batch([
    db.prepare(`INSERT INTO r2_deletion_queue (object_key,queued_at,size_bytes)
      SELECT object_key,?,size FROM user_media_assets WHERE user_id=?
      ON CONFLICT(object_key) DO NOTHING`).bind(Date.now(), userId),
    db.prepare(`DELETE FROM media_references WHERE media_id IN
      (SELECT id FROM user_media_assets WHERE user_id=?)`).bind(userId),
    db.prepare("DELETE FROM users WHERE id=?").bind(userId),
  ]);
}
