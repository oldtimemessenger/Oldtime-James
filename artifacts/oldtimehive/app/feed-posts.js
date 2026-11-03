// Cloud records replace their imported source, never the other way around.
export function mergeFeedPosts(localPosts, cloudPosts) {
  const cloudIds = new Set(cloudPosts.map(post => String(post.id)));
  const sources = new Set(cloudPosts.map(post => post.sourceId).filter(Boolean).map(String));
  return [...localPosts.filter(post => !cloudIds.has(String(post.id)) && !sources.has(String(post.id))), ...cloudPosts];
}

export function followingPosts(posts, me) {
  if (!me?.id) return [];
  const following = new Set(me.following || []);
  return posts.filter(post =>
    following.has(authorId(post)) || post.repostedByFollowing === true ||
    (Array.isArray(post.repostedByFriends) && post.repostedByFriends.some(person =>
      following.has(typeof person === "string" ? person : person?.id))),
  );
}

export function relationshipPosts(posts, me) {
  if (!me?.id) return [];
  const connected = new Set([...(me.following || []), ...(me.friends || [])]);
  return posts.filter(post => {
    const author = authorId(post);
    return author === me.id || connected.has(author) || post.repostedByFollowing === true ||
      (Array.isArray(post.repostedByFriends) && post.repostedByFriends.some(person =>
        connected.has(typeof person === "string" ? person : person?.id)));
  });
}

function authorId(post) {
  return typeof post?.author === "string" ? post.author : post?.author?.id || post?.authorId;
}

// Home's Status strip is not a public recommendation surface. Public
// visibility, repost flags and cached Discovery records do not imply a follow.
export function homeStatusStories(stories, me) {
  if (!me?.id) return [];
  const own = new Set([me.id, me.cloudAccountId].filter(Boolean).map(String));
  const followed = new Set((me.following || []).map(String));
  return stories.filter(story => {
    const author = authorId(story);
    return author != null && (own.has(String(author)) || followed.has(String(author)));
  });
}

// Home "Following" tab: only posts authored by accounts the viewer confirmably follows.
// Reposts by followed people and Discovery cache entries never qualify on their own.
export function followedAuthorPosts(posts, me) {
  if (!me?.id || !Array.isArray(me.following)) return [];
  const following = new Set(me.following.map(String));
  return posts.filter(post => {
    const author = authorId(post);
    return author != null && author !== me.id && following.has(String(author));
  });
}
