export function shouldScrollChatToBottom({
  requested = false,
  sameThreadVisible = false,
  wasAtBottom = false,
  scrollRestored = false,
} = {}) {
  if (requested) return true;
  if (sameThreadVisible) return wasAtBottom;
  return !scrollRestored;
}
