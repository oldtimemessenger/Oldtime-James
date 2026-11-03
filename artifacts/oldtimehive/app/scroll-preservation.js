function nodeKeyIndex(root) {
  if (!root?.querySelectorAll) return new Map();
  const elements = [root, ...root.querySelectorAll("*")];
  const occurrences = new Map();
  const index = new Map();

  elements.forEach(element => {
    const classes = [...(element.classList || [])]
      .filter(name => !["on", "active", "selected", "hidden", "open"].includes(name))
      .sort();
    const signature = `${String(element.tagName || "node").toLowerCase()}${classes.length ? `.${classes.join(".")}` : ""}`;
    const occurrence = occurrences.get(signature) || 0;
    occurrences.set(signature, occurrence + 1);
    const key = element.dataset?.scrollPreserve
      || (element.id ? `id:${element.id}` : `auto:${signature}:${occurrence}`);
    index.set(key, element);
  });

  return index;
}

export function capturePreservedScroll(root) {
  const nodes = nodeKeyIndex(root);
  const snapshot = [];
  nodes.forEach((element, key) => {
    const top = Number(element.scrollTop) || 0;
    const left = Number(element.scrollLeft) || 0;
    if (!element.dataset?.scrollPreserve && top === 0 && left === 0) return;
    snapshot.push({ key, top, left });
  });
  return snapshot;
}

export function restorePreservedScroll(root, snapshot) {
  if (!Array.isArray(snapshot)) return;
  const nodes = nodeKeyIndex(root);
  snapshot.forEach(position => {
    const element = nodes.get(position.key);
    if (!element) return;
    element.scrollTop = position.top;
    element.scrollLeft = position.left;
  });
}
