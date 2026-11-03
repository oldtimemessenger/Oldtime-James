import { api, mutate, notify } from "./store.js";

export function findSharedComment(post, id) {
  if (!id) return null;
  for (const comment of post?.comments || []) {
    if (comment.id === id) return comment;
    const reply = comment.replies?.find(item => item.id === id);
    if (reply) return reply;
  }
  return null;
}

export function listRegularShareFriends(postId) {
  const me = api.me();
  const post = api.post(postId);
  return (me?.friends || []).map(id => api.user(id))
    .filter(friend => friend && api.areFriends(me.id, friend.id) && !api.blocked(me.id, friend.id))
    .map(friend => ({ ...friend, unavailable: !api.canSeePost(post, friend.id), reason: "Cannot view this post" }));
}

export function sendPostToFriends(postId, recipientIds, { commentId = "", message = "" } = {}) {
  const me = api.me();
  const post = api.post(postId);
  if (!me || !post || !api.canSeePost(post)) throw new Error("Post unavailable.");
  if (commentId && !findSharedComment(post, commentId)) throw new Error("Comment unavailable.");
  const recipients = [...new Set(recipientIds.map(String))];
  if (!recipients.length) throw new Error("Choose at least one Friend.");
  if (recipients.some(id => id === me.id || !api.areFriends(me.id, id) || api.blocked(me.id, id))) {
    throw new Error("Choose confirmed Friends.");
  }
  if (recipients.some(id => !api.canSeePost(post, id))) throw new Error("One of these Friends cannot view this post.");
  const body = String(message).trim();
  if (body.length > 500) throw new Error("Messages must be 500 characters or fewer.");
  const conversationIds = [];
  // Commit all recipients together: storage failure must not leave a partial send.
  mutate(db => {
    for (const recipient of recipients) {
      let chat = db.convos.find(c => c.members.length === 2 && c.members.includes(me.id) && c.members.includes(recipient));
      if (!chat) {
        chat = { id: "cv" + crypto.randomUUID(), members: [me.id, recipient], title: "", messages: [], draft: "", pinnedIds: [], disappear: "off", mutedUntil: 0, wallpaper: "", locked: false, group: null };
        db.convos.unshift(chat);
      }
      const created = Date.now();
      const duration = chat.disappear === "10 seconds" ? 10000 : chat.disappear === "24 hours" ? 86400000 : 0;
      chat.messages.push({
        id: "m" + crypto.randomUUID(), author: me.id, created, kind: "shared-post",
        sharedPostId: post.id, sharedCommentId: commentId || null, body,
        status: "sent", reactions: {}, editHistory: [], kept: false,
        ...(duration ? { expiresAt: created + duration } : {})
      });
      conversationIds.push(chat.id);
      notify(db, { id: "n" + crypto.randomUUID(), user: recipient, actor: me.id, kind: "message",
        body: commentId ? "shared a comment with you" : "shared a post with you", created, read: false });
    }
  });
  return conversationIds;
}

function safeImage(value) {
  const url = String(value || "");
  return /^(https?:|blob:|data:image\/)/i.test(url) || (url && !url.startsWith("//") && !/^[a-z][a-z0-9+.-]*:/i.test(url)) ? url : "";
}

export function renderSharedMessage(message, esc) {
  const post = api.post(message.sharedPostId);
  // Resolve live sources under the viewer's permissions; never cache private text/media.
  if (!post || !api.canSeePost(post)) return `<div class="shared-post-unavailable">Post unavailable</div>`;
  const comment = findSharedComment(post, message.sharedCommentId);
  if (message.sharedCommentId && !comment) return `<div class="shared-post-unavailable">Comment unavailable</div>`;
  const author = api.user(post.author);
  const image = safeImage(post.kind === "video" ? post.poster || author?.avatar : post.media?.[0]);
  const photo = safeImage(comment?.attachment?.url);
  return `<button type="button" class="message-shared-post" data-chat-shared-post="${esc(post.id)}" ${comment ? `data-chat-shared-comment="${esc(comment.id)}"` : ""} aria-label="Open shared ${comment ? "comment" : "post"}">
    ${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : ""}
    <span class="message-shared-author">@${esc(author?.username || "member")}</span>
    ${post.caption ? `<span class="message-shared-caption">${esc(post.caption)}</span>` : ""}
    ${comment ? `<span class="message-shared-comment"><b>@${esc(api.user(comment.author)?.username || "member")}</b><span>${esc(comment.body || "Photo comment")}</span>${photo ? `<img src="${esc(photo)}" alt="Shared comment photo">` : ""}</span>` : ""}
    <span class="message-shared-open">${comment ? "View comment" : "View post"}</span>
  </button>${message.body ? `<div>${esc(message.body)}</div>` : ""}`;
}
