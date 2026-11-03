import test from "node:test";
import assert from "node:assert/strict";
import { renderPostActionsMenu } from "./post-actions-menu.js";

test("post action menu exposes edit, archive, and delete actions", () => {
  const html = renderPostActionsMenu({ postId: "post-1" });
  assert.match(html, /data-post-edit="post-1"/);
  assert.match(html, /data-post-archive="post-1"/);
  assert.match(html, /data-delete-post="post-1"/);
  assert.match(html, />Archive post<\/span>/);
});

test("post action menu escapes identifiers and labels archived posts for restore", () => {
  const html = renderPostActionsMenu({
    postId: '"<post&',
    archived: true,
    esc: value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"),
    icons: { more: "<svg></svg>", edit: "<svg></svg>", archive: "<svg></svg>", trash: "<svg></svg>" },
  });
  assert.match(html, /data-post-edit="&quot;&lt;post&amp;"/);
  assert.match(html, />Restore from archive<\/span>/);
  assert.match(html, /<summary aria-label="Post actions" title="Post actions"><svg><\/svg><\/summary>/);
});

test("post actions are grouped and destructive actions are visually separated", () => {
  const html = renderPostActionsMenu({ postId: "post-2" });
  assert.match(html, /role="group" aria-label="Manage post"/);
  assert.match(html, /role="separator"/);
  assert.match(html, /role="group" aria-label="Destructive actions"/);
  assert.match(html, /class="is-destructive" role="menuitem" data-delete-post/);
});
