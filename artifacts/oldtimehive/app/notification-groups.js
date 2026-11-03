export const NOTIFICATION_GROUPS = [
  { id: "followers", title: "New followers", icon: "users", empty: "New followers will appear here." },
  { id: "likes", title: "Likes and reactions", icon: "heart", empty: "Likes and reactions to your content will appear here." },
  { id: "comments", title: "Comments, mentions and reposts", icon: "comment", empty: "Comments, mentions and reposts will appear here." },
  { id: "activity", title: "Other activity", icon: "bell", empty: "You’re caught up." },
];

const followers = new Set(["follow", "new-follower", "friend-accepted"]);
const likes = new Set(["like", "reaction", "comment-reaction", "story-reaction"]);
const comments = new Set(["comment", "reply", "comment-remix", "story-comment", "mention", "post-mention", "comment-mention", "story-mention", "share", "repost"]);
const privateSaves = new Set(["save", "post-save", "saved"]);

export function notificationGroup(note) {
  if (privateSaves.has(note?.kind)) return null;
  if (followers.has(note?.kind)) return "followers";
  if (likes.has(note?.kind)) return "likes";
  if (comments.has(note?.kind)) return "comments";
  return "activity";
}

export function filterNotificationGroup(notes, group, following = []) {
  const followed = new Set(following);
  return notes.filter(note => {
    const category = notificationGroup(note);
    if (!category) return false;
    if (group === "all" || group === "everything") return true;
    if (group === "following") return followed.has(note.actor);
    return category === group;
  });
}

export function notificationGroupCounts(notes) {
  return notes.reduce((counts, note) => {
    const category = notificationGroup(note);
    if (category) counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
}
