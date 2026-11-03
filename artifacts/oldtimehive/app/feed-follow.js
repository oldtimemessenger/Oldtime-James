export function feedFollowButton({author, me, following = false, requests = [], className, esc}) {
  if (!author?.id || !me?.id || author.id === me.id) return "";
  if (Array.isArray(me.following)) following = me.following.includes(author.id);
  const requested = requests.some(request => request.from === me.id && request.to === author.id);
  const label = following ? "Following" : requested ? "Requested" : "Follow";
  return `<button type="button" class="${className}" data-follow="${esc(author.id)}" aria-pressed="${following}" aria-label="${label} ${esc(author.name || author.username || "")}">${label}</button>`;
}
