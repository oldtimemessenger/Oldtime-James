import "./saved-sheets.css";
import "./share-sheet.css";
import { api } from "./store.js";
import { recordActivity } from "./activity-tracking.js";
import {
  listSavedCollections, setPostSaved, createSavedCollection,
  renameSavedCollection, deleteSavedCollection, toggleSavedCollection
} from "./saved-collections.js";
import { createBlastPost } from "./blast-store.js";
import { listBlastShareFriends } from "./blast-shared-post.js";
import { renderSavedSheet, renderShareSheet } from "./saved-sheets.js";
import { findSharedComment, listRegularShareFriends, sendPostToFriends } from "./shared-content.js";

export function openSocialSheet({ id, mode = "saved", commentId = "", audience = "friends", sheet, esc, icons, toast, onClose, onBlast, onExternal, onStory, onShared }) {
  const ownerId = api.me()?.id;
  const returnFocus = document.activeElement;
  let editingCollection = null;
  let draft = "";
  const selections = { friends: new Set(), blast: new Set() };
  let query = "";
  const post = () => {
    const item = api.post(id);
    if (api.me()?.id !== ownerId || !item || !api.canSeePost(item)) throw new Error("Post unavailable.");
    if (commentId && !findSharedComment(item, commentId)) throw new Error("Comment unavailable.");
    return item;
  };
  const error = value => {
    const target = sheet.querySelector("[data-sheet-error]");
    if (target) target.textContent = value.message || String(value);
  };
  const close = (refresh = true) => {
    sheet.classList.remove("on");
    sheet.innerHTML = "";
    sheet.onclick = null;
    document.removeEventListener("keydown", keyboard);
    if (refresh) onClose?.();
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  const keyboard = event => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key !== "Tab") return;
    const buttons = [...sheet.querySelectorAll("button:not(:disabled), input, textarea")]
      .filter(element => !element.closest("[hidden]"));
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const run = action => {
    try { post(); action(); draw(); }
    catch (failure) { error(failure); }
  };
  const edit = collection => {
    editingCollection = collection?.id || null;
    const form = sheet.querySelector("[data-collection-form]");
    form.hidden = false;
    form.elements.name.value = collection?.name || "";
    form.elements.name.focus();
  };
  const draw = () => {
    const item = post();
    const author = api.user(item.author) || {};
    const preview = { ...item, thumbnail: item.kind === "video" ? item.poster || author.avatar : item.media?.[0] };
    const comment = findSharedComment(item, commentId);
    const friends = audience === "blast"
      ? listBlastShareFriends().map(friend => ({ ...friend, unavailable: !api.canSeePost(item, friend.id), reason: "Cannot view this post" }))
      : listRegularShareFriends(id);
    sheet.innerHTML = mode === "saved"
      ? renderSavedSheet({ post: preview, author, collections: listSavedCollections(id), saved: item.saves?.includes(ownerId), esc, icons })
      : renderShareSheet({ post: preview, author, friends, audience, selectedIds: [...selections[audience]], query, draft,
        comment: comment ? { ...comment, authorName: "@" + (api.user(comment.author)?.username || "member") } : null, esc, icons });
    sheet.querySelector("[data-social-sheet-close]").onclick = () => close();
    if (mode === "saved") {
      sheet.querySelector("[data-saved-toggle]").onclick = () => run(() => setPostSaved(id, !post().saves?.includes(ownerId)));
      sheet.querySelector("[data-collection-new]").onclick = () => edit(null);
      sheet.querySelector("[data-collection-cancel]").onclick = () => {
        editingCollection = null;
        sheet.querySelector("[data-collection-form]").hidden = true;
        sheet.querySelector("[data-collection-new]").focus();
      };
      sheet.querySelector("[data-collection-form]").onsubmit = event => {
        event.preventDefault();
        const name = event.currentTarget.elements.name.value;
        run(() => editingCollection ? renameSavedCollection(editingCollection, name) : createSavedCollection(name, id));
      };
      sheet.querySelectorAll("[data-saved-collection]").forEach(button => {
        button.onclick = () => run(() => toggleSavedCollection(button.dataset.savedCollection, id));
      });
      sheet.querySelectorAll("[data-collection-rename]").forEach(button => {
        button.onclick = () => edit(listSavedCollections(id).find(value => value.id === button.dataset.collectionRename));
      });
      sheet.querySelectorAll("[data-collection-delete]").forEach(button => {
        button.onclick = () => {
          if (confirm("Delete this collection? Saved posts will be kept.")) {
            run(() => deleteSavedCollection(button.dataset.collectionDelete));
          }
        };
      });
      sheet.querySelector("[data-saved-send-blast]").onclick = () => { mode = "share"; audience = "blast"; draw(); };
    } else {
      const form = sheet.querySelector("[data-blast-share-form]");
      const updateSubmit = () => {
        const button = form.querySelector("[data-share-submit]");
        const count = selections[audience].size;
        button.disabled = audience === "friends" && count === 0;
        button.textContent = `${audience === "blast" ? "Send to Blast" : "Send"}${count ? ` (${count})` : ""}`;
      };
      form.querySelectorAll('input[name="recipient"]').forEach(input => input.onchange = () => {
        if (input.checked) selections[audience].add(input.value);
        else selections[audience].delete(input.value);
        updateSubmit();
      });
      form.elements.comment.oninput = event => { draft = event.target.value; };
      sheet.querySelectorAll("[data-share-audience]").forEach(button => button.onclick = () => {
        audience = button.dataset.shareAudience;
        query = "";
        draw();
      });
      const search = sheet.querySelector("[data-share-search]");
      const filter = () => {
        query = search.value;
        const value = query.trim().toLowerCase();
        const rows = [...sheet.querySelectorAll("[data-share-friend]")];
        rows.forEach(row => { row.hidden = !row.dataset.searchName.includes(value); });
        const empty = sheet.querySelector("[data-share-no-results]");
        if (empty) empty.hidden = rows.some(row => !row.hidden);
      };
      search.oninput = filter;
      filter();
      sheet.querySelector("[data-share-external]").onclick = async () => {
        try { post(); const result=await onExternal?.(id, commentId); if(result?.completed){close();onShared?.(id,result.kind);} }
        catch (failure) { error(failure); }
      };
      for (const action of ["copylink", "whatsapp"]) {
        sheet.querySelector(`[data-share-${action}]`).onclick = async () => {
          try { post(); const result=await onExternal?.(id, commentId, action); if(result?.completed){close();onShared?.(id,result.kind);} }
          catch (failure) { error(failure); }
        };
      }
      sheet.querySelector("[data-share-story]").onclick = () => {
        try {
          post();
          if (onStory?.(id, commentId)) close();
        } catch (failure) { error(failure); }
      };
      form.onsubmit = event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
          post();
          if (audience === "friends") {
            sendPostToFriends(id, data.getAll("recipient"), { commentId, message: String(data.get("comment") || "") });
            recordActivity("share",post());
            close();
            toast(commentId ? "Comment sent to Friends" : "Post sent to Friends");
            onShared?.(id,"shared");
            return;
          }
          const shared = createBlastPost({
            sharedPostId: id, sharedCommentId: commentId, audience: "friends",
            recipientIds: data.getAll("recipient"),
            initialComment: String(data.get("comment") || "").trim()
          });
          recordActivity("share",post(),"blast");
          close(false);
          toast(commentId ? "Comment shared to Blast" : "Added to Blast");
          onBlast?.(shared.id);
        } catch (failure) { error(failure); }
      };
    }
  };
  try {
    if (mode === "saved" && !post().saves?.includes(ownerId)) setPostSaved(id, true);
    draw();
    sheet.classList.add("on");
    sheet.onclick = event => { if (event.target === sheet) close(); };
    document.addEventListener("keydown", keyboard);
    sheet.querySelector("[data-social-sheet-close]")?.focus();
  } catch (failure) {
    close(false);
    toast(failure.message);
  }
}
