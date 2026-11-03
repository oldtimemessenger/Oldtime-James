// Retain the real navigation nodes across screen renders. A repaint should not
// reload portraits, restart focus/press state, or reinstall listeners on the bar.
export function retainNavigation(previous, next) {
  if (!previous || !next) return;
  previous.className = next.className;
  for (const button of previous.querySelectorAll("button")) {
    const key = button.dataset.tab;
    const replacement = key ? next.querySelector(`[data-tab="${key}"]`) : next.querySelector("#create-open");
    if (!replacement) continue;
    button.className = replacement.className;
    if (replacement.classList.contains("on")) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
    const photo = button.querySelector(".nav-profile-frame");
    const newPhoto = replacement.querySelector(".nav-profile-frame");
    if (photo && newPhoto && photo.dataset.source !== newPhoto.dataset.source) photo.replaceWith(newPhoto);
    const badge = button.querySelector(".nav-unread");
    const nextBadge = replacement.querySelector(".nav-unread");
    if (badge && nextBadge) {
      badge.hidden = nextBadge.hidden;
      badge.textContent = nextBadge.textContent;
      badge.setAttribute("aria-label", nextBadge.getAttribute("aria-label") || "");
    }
  }
  next.replaceWith(previous);
}

// Data updates are coalesced; never replace an input while Safari owns its
// keyboard or a finger is pressing a control. Flush when that interaction ends.
export function installStableDataRefresh({ render, document: doc = document, window: win = window, shouldDefer = () => false }) {
  let pending = false, frame = 0, pressed = false, disposed = false;
  const blocked = () => pressed || doc.hidden || shouldDefer() ||
    doc.activeElement?.matches?.("input,textarea,select,[contenteditable=true]");
  function flush() {
    frame = 0;
    if (disposed || !pending || blocked()) return;
    pending = false;
    render();
  }
  const schedule = () => {
    if (pending && !frame && !disposed) frame = win.requestAnimationFrame(flush);
  };
  const request = () => { pending = true; schedule(); };
  const down = () => { pressed = true; };
  const up = () => { pressed = false; schedule(); };
  win.addEventListener("oldtime-data", request);
  doc.addEventListener("pointerdown", down, { passive: true });
  doc.addEventListener("pointerup", up, { passive: true });
  doc.addEventListener("pointercancel", up, { passive: true });
  doc.addEventListener("focusout", schedule);
  doc.addEventListener("visibilitychange", schedule);
  const observer = new win.MutationObserver(schedule);
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
  return () => {
    disposed = true;
    win.cancelAnimationFrame(frame);
    observer.disconnect();
    win.removeEventListener("oldtime-data", request);
    doc.removeEventListener("pointerdown", down);
    doc.removeEventListener("pointerup", up);
    doc.removeEventListener("pointercancel", up);
    doc.removeEventListener("focusout", schedule);
    doc.removeEventListener("visibilitychange", schedule);
  };
}
