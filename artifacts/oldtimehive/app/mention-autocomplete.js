const HANDLE = /^[a-z0-9_]{3,24}$/i;
const bindings = new WeakMap();
let popupSequence = 0;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export function renderMentionText(value, { tag = "button" } = {}) {
  const text = String(value ?? "");
  const pattern = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])/g;
  let html = "", cursor = 0, match;
  while ((match = pattern.exec(text))) {
    const handleStart = match.index + match[1].length;
    html += escapeHtml(text.slice(cursor, handleStart));
    html += tag === "span"
      ? `<span class="mention-link" data-mention-handle="${escapeHtml(match[2])}">@${escapeHtml(match[2])}</span>`
      : `<button type="button" class="mention-link" data-mention-handle="${escapeHtml(match[2])}">@${escapeHtml(match[2])}</button>`;
    cursor = handleStart + match[0].length - match[1].length;
  }
  return html + escapeHtml(text.slice(cursor));
}

export function bindMentionAutocomplete(input, { api, maxResults = 6 } = {}) {
  if (!input || typeof api?.searchCloudMentionUsers !== "function") return () => {};
  if (bindings.has(input)) return () => {};
  bindings.set(input, true);
  const doc = input.ownerDocument;
  const popup = doc.createElement("div");
  popup.className = "mention-suggestions";
  popup.id = `mention-suggestions-${++popupSequence}`;
  popup.setAttribute("role", "listbox");
  const previousAria = {
    autocomplete: input.getAttribute("aria-autocomplete"),
    controls: input.getAttribute("aria-controls"),
    expanded: input.getAttribute("aria-expanded"),
    haspopup: input.getAttribute("aria-haspopup"),
  };
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", popup.id);
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-haspopup", "listbox");
  popup.hidden = true;
  doc.body.append(popup);
  let timer = null, requestId = 0, candidates = [], activeIndex = 0, disposed = false;

  const close = () => {
    requestId += 1;
    clearTimeout(timer);
    popup.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    candidates = [];
  };
  const place = () => {
    if (popup.hidden || !input.isConnected) return;
    const rect = input.getBoundingClientRect();
    popup.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 288))}px`;
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop || 0, bottom = top + (viewport?.height || window.innerHeight);
    const available = Math.max(rect.top - top - 16, bottom - rect.bottom - 16);
    const height = Math.min(popup.scrollHeight || 250, 250, Math.max(80, available));
    popup.style.maxHeight = `${height}px`;
    popup.style.top = `${rect.bottom + height + 14 <= bottom ? rect.bottom + 6 : Math.max(top + 8, rect.top - height - 6)}px`;
  };
  const choose = profile => {
    const cursor = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, cursor);
    const match = before.match(/(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{2,24})$/);
    if (!match) return close();
    const tokenStart = cursor - match[1].length - 1;
    const insertion = `@${profile.username} `;
    input.setRangeText(insertion, tokenStart, cursor, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus({ preventScroll: true });
    close();
  };
  const draw = (profiles, query) => {
    candidates = profiles.slice(0, maxResults);
    activeIndex = 0;
    popup.innerHTML = candidates.length
      ? candidates.map((profile, index) => `<button type="button" id="${popup.id}-option-${index}" role="option" aria-selected="${index === 0}" data-mention-index="${index}">
          <img src="${escapeHtml(profile.avatar || "")}" alt="" /><span><b>${escapeHtml(profile.displayName || profile.name || profile.username)}</b><small>@${escapeHtml(profile.username)}</small></span>
        </button>`).join("")
      : `<p>${query.length < 2 ? "Type at least 2 characters." : "No accounts can be tagged with that search."}</p>`;
    popup.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (candidates.length) input.setAttribute("aria-activedescendant", `${popup.id}-option-0`);
    popup.querySelectorAll("[data-mention-index]").forEach(button => {
      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        const profile = candidates[Number(button.dataset.mentionIndex)];
        if (profile) choose(profile);
      });
    });
    place();
  };
  const update = () => {
    const cursor = input.selectionStart ?? input.value.length;
    const match = input.value.slice(0, cursor).match(/(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{2,24})$/);
    if (!match || api.authMode?.() !== "cloud") return close();
    const query = match[1];
    const currentRequest = ++requestId;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const profiles = await api.searchCloudMentionUsers(query);
        if (disposed || currentRequest !== requestId || !input.isConnected) return;
        draw(profiles, query);
      } catch {
        if (currentRequest === requestId) close();
      }
    }, 180);
  };
  const onKeyDown = event => {
    if (popup.hidden || !candidates.length) {
      if (event.key === "Escape") close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + candidates.length) % candidates.length;
      popup.querySelectorAll("[data-mention-index]").forEach((button, index) =>
        button.setAttribute("aria-selected", String(index === activeIndex)));
      input.setAttribute("aria-activedescendant", `${popup.id}-option-${activeIndex}`);
    } else if (event.key === "Enter" && candidates[activeIndex]) {
      event.preventDefault();
      choose(candidates[activeIndex]);
    } else if (event.key === "Escape") close();
  };
  const onOutside = event => {
    if (event.target !== input && !popup.contains(event.target)) close();
  };
  const onKeyUp = event => {
    if (popup.hidden || !["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) update();
  };
  input.addEventListener("input", update);
  input.addEventListener("keyup", onKeyUp);
  input.addEventListener("keydown", onKeyDown);
  doc.addEventListener("pointerdown", onOutside);
  doc.defaultView?.addEventListener("resize", place);
  doc.defaultView?.addEventListener("scroll", place, true);
  return () => {
    bindings.delete(input);
    disposed = true;
    close();
    input.removeEventListener("input", update);
    input.removeEventListener("keyup", onKeyUp);
    input.removeEventListener("keydown", onKeyDown);
    doc.removeEventListener("pointerdown", onOutside);
    doc.defaultView?.removeEventListener("resize", place);
    doc.defaultView?.removeEventListener("scroll", place, true);
    popup.remove();
    for (const [name, value] of Object.entries({ "aria-autocomplete": previousAria.autocomplete, "aria-controls": previousAria.controls, "aria-expanded": previousAria.expanded, "aria-haspopup": previousAria.haspopup })) {
      if (value === null) input.removeAttribute(name); else input.setAttribute(name, value);
    }
  };
}
