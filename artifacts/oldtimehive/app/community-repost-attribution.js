export function compactRepostSummary(friends = [], count = friends.length) {
  if (!Array.isArray(friends) || !friends[0]) return null;
  const first = friends[0];
  const username = String(first.username || first.displayName || "friend").replace(/^@/, "");
  const total = Number.isSafeInteger(count) && count >= 0 ? count : friends.length;
  const more = Math.max(0, total - 1);
  const extraLabel = more ? `and ${more} ${more === 1 ? "other" : "others"}` : "";
  return {
    firstName: `@${username}`,
    extraLabel,
    label: `Reposted by @${username}${extraLabel ? ` ${extraLabel}` : ""}`,
  };
}
