export function isDefaultAvatarMediaReference(value) {
  const candidate = typeof value === "string"
    ? value
    : value?.reference || value?.url || value?.mediaReference || "";
  const raw = String(candidate ?? "").trim();
  if (!raw) return false;
  try {
    return new URL(raw, "https://oldtime.invalid").pathname.toLowerCase().endsWith("/app/avatar.svg");
  } catch {
    return /(?:^|\/)app\/avatar\.svg(?:[?#]|$)/i.test(raw);
  }
}

export function resolveStoryMedia(story, getPost = () => null) {
  const current = typeof story?.media === "string"
    ? story.media.trim()
    : String(story?.media?.reference || story?.media?.url || story?.media?.mediaReference || "").trim();
  if (current && !isDefaultAvatarMediaReference(current)) return current;

  // Older shared Stories could accidentally use the author's fallback avatar
  // as the full-screen media. Resolve the source post instead of showing it.
  const source = story?.sourcePost ? getPost(story.sourcePost) : null;
  const sourceMedia = Array.isArray(source?.media) ? source.media[0] : "";
  const normalized = typeof sourceMedia === "string"
    ? sourceMedia
    : sourceMedia?.reference || sourceMedia?.url || sourceMedia?.mediaReference || "";
  return normalized && !isDefaultAvatarMediaReference(normalized) ? String(normalized) : "";
}
