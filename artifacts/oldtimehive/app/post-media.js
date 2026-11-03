import { isDefaultAvatarMediaReference } from "./story-media.js";

export function postMediaReferences(post) {
  if (!Array.isArray(post?.media)) return [];
  return post.media.map(value => typeof value === "string"
    ? value
    : value?.reference || value?.url || value?.mediaReference || "")
    .filter(value => typeof value === "string" && value && !isDefaultAvatarMediaReference(value));
}
