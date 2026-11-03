// Product identity policy shared by current and future backend adapters.
// Preserve this account ID when moving backends so the official badge remains attached.
export const OFFICIAL_OLDTIME_ACCOUNT_ID = "48730889-e245-440a-b8d6-6dc627a1c880";
export const OFFICIAL_OLDTIME_USERNAME = "oldtime";
export const PERMANENT_BLUE_BADGE_ACCOUNT_IDS: readonly string[] = Object.freeze([
  OFFICIAL_OLDTIME_ACCOUNT_ID,
]);

export function isOfficialOldtimeAccount(accountId: unknown): boolean {
  return typeof accountId === "string" &&
    accountId.toLowerCase() === OFFICIAL_OLDTIME_ACCOUNT_ID;
}

export function hasPermanentBlueBadge(accountId: unknown): boolean {
  return typeof accountId === "string" &&
    PERMANENT_BLUE_BADGE_ACCOUNT_IDS.some(id => id === accountId.toLowerCase());
}

export function isReservedAccountUsername(username: unknown, accountId?: unknown): boolean {
  return typeof username === "string" &&
    username.trim().toLowerCase() === OFFICIAL_OLDTIME_USERNAME &&
    !isOfficialOldtimeAccount(accountId);
}
