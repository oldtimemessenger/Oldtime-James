import { releasePostVideos } from "./media-release.js";
// Update data, not the active screen. Existing controls, media and scroll nodes
// survive refreshes, including while the iOS keyboard owns the focused field.
function key(node) {
  if (node.nodeType !== 1) return null;
  // Action attributes are not keys: a row's avatar and title can intentionally
  // share data-cv/data-id. Only use identifiers unique among sibling elements.
  for (const name of ["id", "data-message-key", "data-inbox-row", "data-console-card", "data-date-key"]) {
    if (node.hasAttribute(name)) return `${name}:${node.getAttribute(name)}`;
  }
  return null;
}
function compatible(a, b) {
  return a.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName) && key(a) === key(b);
}
function update(a, b) {
  if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  const localMedia = a.getAttribute("data-local-media") && a.getAttribute("data-local-media") === b.getAttribute("data-local-media");
  for (const attribute of [...a.attributes]) {
    if (localMedia && ["src", "poster"].includes(attribute.name)) continue;
    if (!b.hasAttribute(attribute.name)) a.removeAttribute(attribute.name);
  }
  for (const attribute of b.attributes) {
    if (a.getAttribute(attribute.name) !== attribute.value) a.setAttribute(attribute.name, attribute.value);
  }
  if (a.matches("input,textarea,select,[contenteditable=true]")) return;
  // Media playback/decoder state is not render state.
  if (a.matches("video,audio,canvas")) return;
  // Managed slots (e.g. the inline email card) own their children; only attributes are synced.
  if (a.hasAttribute("data-managed-slot")) return;
  reconcileChildren(a, b);
}
export function reconcileChildren(container, incoming) {
  const template = typeof incoming === "string" ? container.ownerDocument.createElement("template") : null;
  if (template) template.innerHTML = incoming;
  const source = template ? template.content : incoming;
  const keyed = new Map([...container.childNodes].filter(n => key(n)).map(n => [key(n), n]));
  let cursor = container.firstChild;
  for (const desired of [...source.childNodes]) {
    const found = key(desired) ? keyed.get(key(desired)) : cursor;
    if (found && compatible(found, desired)) {
      if (found !== cursor) container.insertBefore(found, cursor);
      update(found, desired);
      cursor = found.nextSibling;
    } else {
      const fresh = desired.cloneNode(true);
      container.insertBefore(fresh, cursor);
    }
  }
  while (cursor) { const next = cursor.nextSibling; if (cursor.nodeType === 1) releasePostVideos(cursor); cursor.remove(); cursor = next; }
}
export function reconcileActiveScreen(previous, markup, context) {
  if (!previous || previous.dataset.stableContext !== context) return false;
  const template = previous.ownerDocument.createElement("template");
  template.innerHTML = markup;
  const next = template.content.querySelector(".screen.on");
  if (!next || previous.dataset.chatView !== next.dataset.chatView || previous.className !== next.className) return false;
  reconcileChildren(previous, next);
  return true;
}
