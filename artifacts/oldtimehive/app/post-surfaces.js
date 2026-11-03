export function isFeedHomePost(post) {
  return !isCommunitySurfacePost(post)
    && Boolean(post?.media?.length || post?.creativeProject?.background?.media);
}

export function isCommunitySurfacePost(post) {
  return post?.destination === "community" || post?.destination === "both"
    || ["text", "quote", "note"].includes(post?.kind);
}

export function isProfileSurfacePost(post) {
  return !isCommunitySurfacePost(post);
}
