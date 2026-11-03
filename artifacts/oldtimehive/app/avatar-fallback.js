export function installAvatarFallbacks(root) {
  const selector = ".chat-avatar,.chat-inbox-avatar img,.chat-compose-avatar img,.chat-empty-avatar img";
  root.addEventListener("error", event => {
    if (event.target.matches?.(selector)) event.target.hidden = true;
  }, true);
  root.addEventListener("load", event => {
    if (event.target.matches?.(selector)) event.target.hidden = false;
  }, true);
}
