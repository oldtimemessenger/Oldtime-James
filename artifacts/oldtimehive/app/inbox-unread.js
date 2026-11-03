export function conversationUnreadCount(conversation, me, now = Date.now()) {
  if (!me?.id || conversation.legacyArchive || conversation.locked ||
    !conversation.members?.includes(me.id)) return 0;
  const count = (conversation.messages || []).filter(message =>
    message.author !== me.id && !message.hiddenFor?.includes(me.id) &&
    !(message.expiresAt && message.expiresAt <= now) &&
    message.created > Number(conversation.cloudState?.readThrough || 0) &&
    message.status !== "read" && !message.read).length;
  return conversation.cloudState?.markedUnread ? Math.max(1, count) : count;
}
export function unreadInboxCount(conversations, me) {
  return (conversations || []).reduce((total, conversation) => total + conversationUnreadCount(conversation, me), 0);
}
