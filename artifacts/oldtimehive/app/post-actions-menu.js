const fallbackEsc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

export function renderPostActionsMenu({ postId, archived = false, className = "", esc = fallbackEsc, icons = {} } = {}) {
  const e = esc || fallbackEsc;
  const id = e(String(postId ?? ""));
  return `<details class="post-actions-menu${className ? ` ${e(className)}` : ""}" data-post-actions-menu>
    <summary aria-label="Post actions" title="Post actions">${icons.more || ""}</summary>
    <div class="post-actions-menu-items" role="menu" aria-label="Post actions">
      <div class="post-actions-menu-group" role="group" aria-label="Manage post">
        <button type="button" role="menuitem" data-post-edit="${id}" data-testid="button-edit-post-${id}">${icons.edit || ""}<span>Edit post</span></button>
        <button type="button" role="menuitem" data-post-archive="${id}">${icons.archive || ""}<span>${archived ? "Restore from archive" : "Archive post"}</span></button>
      </div>
      <div class="post-actions-menu-divider" role="separator"></div>
      <div class="post-actions-menu-group" role="group" aria-label="Destructive actions">
        <button type="button" class="is-destructive" role="menuitem" data-delete-post="${id}">${icons.trash || ""}<span>Delete post</span></button>
      </div>
    </div>
  </details>`;
}
