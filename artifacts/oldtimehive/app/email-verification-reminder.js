// Optional email verification reminder: a subtle, dismissible feed card. Never a modal, never automatic sending.
// Preferences live in the existing cloud helpPreferences under items["verify-email"].
export const EMAIL_REMINDER_ID = "verify-email";
export const EMAIL_REMINDER_GRACE_MS = 24 * 60 * 60 * 1000;
export const EMAIL_REMINDER_GAP_MS = 7 * 24 * 60 * 60 * 1000;
export const EMAIL_STATUS_PATH = "/api/account/email-verification/status";
export const EMAIL_REQUEST_PATH = "/api/account/email-verification/request";

/** Stable per-account offset (0..6 days) so reminders are spread out but never random per render. */
export function accountReminderOffset(accountId = "") {
  let hash = 2166136261;
  for (const char of String(accountId)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return (hash % 7) * 24 * 60 * 60 * 1000;
}

/**
 * Pure policy. state: helpPreferences ({ paused, items }). accountJoinedAt is the native Account.joinedAt (integer ms).
 * Unknown/invalid joinedAt never shows and never records anything.
 */
export function shouldShowEmailReminder({ accountId, verified, accountJoinedAt, state, now = Date.now(), busy = false } = {}) {
  if (!accountId || verified !== false || busy || !state || state.paused) return false;
  const item = state.items?.[EMAIL_REMINDER_ID] || {};
  if (item.never) return false;
  const joinedAt = Number(accountJoinedAt);
  if (!Number.isSafeInteger(joinedAt) || joinedAt <= 0 || joinedAt > now) return false;
  if (now - joinedAt < EMAIL_REMINDER_GRACE_MS + accountReminderOffset(accountId)) return false;
  if (Number(item.snoozedUntil) > now) return false;
  if (item.lastShownAt && now - item.lastShownAt < EMAIL_REMINDER_GAP_MS) return false;
  return true;
}

/** Applies a reminder event to a copy of helpPreferences. events: shown | snooze | never | verified */
export function applyEmailReminderEvent(state, event, now = Date.now()) {
  const next = { lastShownAt: 0, paused: false, ...(state || {}), items: { ...(state?.items || {}) } };
  const item = { ...(next.items[EMAIL_REMINDER_ID] || {}) };
  if (event === "shown") item.lastShownAt = now;
  if (event === "snooze") item.snoozedUntil = now + EMAIL_REMINDER_GAP_MS;
  if (event === "never") item.never = true;
  if (event === "verified") item.verifiedAt = now;
  next.items[EMAIL_REMINDER_ID] = item;
  return next;
}
