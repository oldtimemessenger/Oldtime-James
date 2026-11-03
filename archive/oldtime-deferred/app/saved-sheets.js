const fallbackEsc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function safeUrl(url) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (/^(https?:|blob:)/i.test(u)) return u;
  if (/^data:image\//i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("//")) return "";
  return u;
}

function postImage(post) {
  const p = post || {};
  const m = Array.isArray(p.media) ? p.media[0] : null;
  return safeUrl(p.thumbnail || p.poster || p.image || p.cover || p.url || (m && (m.poster || m.thumbnail || m.url || m.src)) || (typeof m === "string" ? m : ""));
}

function thumb(url, e, cls = "") {
  const s = safeUrl(url);
  return s ? `<img class="ss-thumb ${cls}" src="${e(s)}" alt="" loading="lazy">` : `<span class="ss-thumb ${cls}" aria-hidden="true"></span>`;
}

export function renderSavedSheet({ post = {}, author = {}, collections = [], saved = false, esc = fallbackEsc, icons = {} } = {}) {
  const e = esc || fallbackEsc;
  const id = e(post.id ?? "");
  const rows = (collections || []).map(c => {
    const cid = e(c.id), name = e(c.name);
    const on = !!c.selected;
    return `<li class="ss-row">
      <button type="button" class="ss-row-main" data-saved-collection="${cid}" aria-pressed="${on}">
        ${thumb(c.cover, e)}
        <span class="ss-text"><b>${name}</b><small>Private</small></span>
        <span class="ss-check${on ? " on" : ""}" aria-hidden="true">${on ? (icons.check || "") : (icons.plus || "")}</span>
      </button>
      <button type="button" class="ss-mini" data-collection-rename="${cid}" aria-label="Rename ${name}">${icons.edit || "Edit"}</button>
      <button type="button" class="ss-mini" data-collection-delete="${cid}" aria-label="Delete ${name}">${icons.close || "Delete"}</button>
    </li>`;
  }).join("");
  return `<section class="panel saved-social-panel" role="dialog" aria-modal="true" aria-labelledby="saved-sheet-title" data-post-id="${id}">
    <div class="ss-grab" aria-hidden="true"></div>
    <header class="ss-head">
      ${thumb(postImage(post), e)}
      <span class="ss-text"><b id="saved-sheet-title">Saved</b><small>Private</small></span>
      <button type="button" class="ss-save${saved ? " on" : ""}" data-saved-toggle aria-pressed="${!!saved}" aria-label="${saved ? "Remove from saved" : "Save"}">${saved ? (icons.bookmarkOn || "") : (icons.bookmark || "")}</button>
      <button type="button" class="ss-close" data-social-sheet-close aria-label="Close">${icons.close || ""}</button>
    </header>
    <div class="ss-body">
      <div class="ss-sec"><h2>Collections</h2><button type="button" class="ss-link" data-collection-new>New collection</button></div>
      <form class="ss-form" data-collection-form hidden>
        <label class="ss-sr" for="ss-collection-name">Collection name</label>
        <input id="ss-collection-name" name="name" type="text" required maxlength="60" placeholder="Collection name" autocomplete="off">
        <div class="ss-form-actions"><button type="button" class="ss-ghost" data-collection-cancel>Cancel</button><button type="submit" class="ss-primary ss-compact">Save</button></div>
      </form>
      <ul class="ss-list">${rows}</ul>
      <p class="ss-error" data-sheet-error role="alert"></p>
    </div>
    <footer class="ss-foot"><button type="button" class="ss-primary" data-saved-send-blast>Send to Blast</button></footer>
  </section>`;
}

export function renderShareSheet({ post = {}, author = {}, friends = [], audience = "friends", selectedIds = [], query = "", comment = null, draft = "", esc = fallbackEsc, icons = {} } = {}) {
  const e = esc || fallbackEsc;
  const id = e(post.id ?? "");
  const mode = audience === "blast" ? "blast" : "friends";
  const list = Array.isArray(friends) ? friends : [];
  const sel = new Set((Array.isArray(selectedIds) ? selectedIds : []).map(String));
  const q = String(query ?? "").trim().toLowerCase();
  const count = list.filter(f => !f.unavailable && sel.has(String(f.id))).length;
  const who = author.username || author.name || "";
  const caption = post.caption || post.text || "";
  const cells = list.map(f => {
    const fid = String(f.id);
    const label = String(f.name || f.username || "");
    const off = !!f.unavailable;
    const hay = `${f.name || ""} ${f.username || ""}`.toLowerCase();
    const hidden = q && !hay.includes(q) ? " hidden" : "";
    const av = safeUrl(f.avatar);
    const face = av ? `<img class="srp-avatar" src="${e(av)}" alt="" loading="lazy">` : `<span class="srp-avatar srp-initial" aria-hidden="true">${e((label.trim().charAt(0) || "?").toUpperCase())}</span>`;
    return `<li class="srp-cell${off ? " srp-off" : ""}"${hidden} data-share-friend data-search-name="${e(hay)}"><label class="srp-friend">
      <input type="checkbox" name="recipient" value="${e(fid)}"${sel.has(fid) && !off ? " checked" : ""}${off ? " disabled" : ""}>
      <span class="srp-face">${face}<span class="srp-badge" aria-hidden="true">${icons.check || ""}</span></span>
      <span class="srp-name">${e(label)}</span>${off ? `<span class="srp-reason">${e(f.reason || "Cannot view this post")}</span>` : ""}
    </label></li>`;
  }).join("");
  const empty = list.length
    ? `<p class="srp-empty" data-share-no-results hidden>No friends match your search.</p>`
    : `<p class="srp-empty" data-share-empty><b>No friends to show yet</b><span>Add friends and they will appear here.</span></p>`;
  const c = comment && typeof comment === "object" ? comment : null;
  const preview = c
    ? `<div class="srp-preview srp-quote"><b>${e(c.authorName)}</b><span>${e(c.body || "Photo comment")}</span>${c.attachment?.url ? thumb(c.attachment.url, e, "srp-thumb") : ""}</div>`
    : `<div class="srp-preview">${thumb(postImage(post), e, "srp-thumb")}<span class="srp-ptext"><b>${e(who)}</b><small>${e(caption)}</small></span></div>`;
  const label = mode === "blast" ? "Send to Blast" : "Send";
  const disabled = mode === "friends" && count === 0 ? " disabled" : "";
  const act = (attr, text, icon, cls = "") => `<button type="button" class="srp-act ${cls}" ${attr}><span class="srp-actic">${icon || ""}</span><span class="srp-actlbl">${text}</span></button>`;
  return `<section class="panel share-recipient-panel" role="dialog" aria-modal="true" aria-labelledby="share-sheet-title" data-post-id="${id}">
    <div class="srp-grab" aria-hidden="true"></div>
    <h2 class="srp-sr" id="share-sheet-title">Share</h2>
    <form class="srp-form" data-blast-share-form data-audience="${mode}">
      <div class="srp-top">
        <label class="srp-search"><span class="srp-searchic" aria-hidden="true">${icons.search || ""}</span>
          <span class="srp-sr">Search friends</span>
          <input type="search" data-share-search value="${e(query)}" placeholder="Search" autocomplete="off"></label>
        <button type="button" class="srp-close" data-social-sheet-close aria-label="Close">${icons.close || ""}</button>
      </div>
      <div class="srp-aud" role="group" aria-label="Audience">
        <button type="button" data-share-audience="friends" aria-pressed="${mode === "friends"}">Friends</button>
        <button type="button" data-share-audience="blast" aria-pressed="${mode === "blast"}">Blast</button>
      </div>
      <div class="srp-scroll">
        <ul class="srp-grid">${cells}</ul>
        ${empty}
        ${mode === "blast" ? `<p class="srp-hint">Pick friends, or leave everyone unselected to send to all Blast Friends.</p>` : ""}
      </div>
      <div class="srp-compose">
        ${preview}
        <label class="srp-sr" for="srp-comment">Message</label>
        <textarea id="srp-comment" name="comment" maxlength="500" rows="1" placeholder="Write a message...">${e(draft)}</textarea>
        <p class="srp-error" data-sheet-error role="alert"></p>
        <button type="submit" class="srp-send" data-share-submit${disabled}>${label}${count ? ` (${count})` : ""}</button>
      </div>
      <div class="srp-actions">
        ${act("data-share-story", "Add to story", icons.plus)}
        ${act("data-share-copylink", "Copy link", icons.link || '<svg class="navic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/></svg>')}
        ${act("data-share-whatsapp", "WhatsApp", icons.whatsapp || '<svg class="navic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.5-5.1A8.5 8.5 0 1 1 20.5 12Z"/><path d="m8 7 2 3-1 1a9 9 0 0 0 4 4l1-1 3 2c-1 3-7 1-10-4-1-2-1-4 1-5Z"/></svg>', "srp-green")}
        ${act("data-share-external", "Share to...", icons.share)}
      </div>
    </form>
  </section>`;
}
