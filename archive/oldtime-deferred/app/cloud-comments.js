import { api, requestCloudApi } from "./store.js";
import { recordActivity } from "./activity-tracking.js";

// Persisted public-post discussion; does not replace private/device-local
// comment creation, linked-comment sharing or the universal creative editor.
export function openCloudComments(postId, { sheet, esc, icons, toast, onClose }) {
  const post = api.cloudPost(postId);
  if (!post) return;
  const owner = api.cloudAccountId();
  let live = true, sending = false;
  const close = () => { live = false; sheet.classList.remove("on"); sheet.innerHTML = ""; sheet.onclick = sheet.onkeydown = null; onClose?.(); };
  const current = () => live && api.cloudAccountId() === owner && sheet.querySelector("[data-online-comments]");
  const normalize = c => ({ id: c.id, author: api.cloudAuthorId(c.author), body: c.body, created: c.createdAt, cloud: true, likes: [], dislikes: [], replies: [] });
  sheet.classList.add("on");
  sheet.innerHTML = `<section class="panel comment-panel" data-online-comments role="dialog" aria-modal="true" aria-label="Online comments">
    <div class="grab" aria-hidden="true"></div><header class="comment-header"><h2>Comments</h2><button type="button" data-online-close aria-label="Close comments">${icons.close}</button></header>
    <div data-online-status role="status">Loading comments…</div><button type="button" data-online-retry hidden>Retry</button><div class="comments-list" data-online-list></div>
    <form class="comment-form" data-online-form><input maxlength="1000" placeholder="Add a comment..." aria-label="Add a comment" required disabled><button type="submit" class="comment-send" aria-label="Send comment" disabled>${icons.send}</button></form></section>`;
  sheet.querySelector("[data-online-close]").onclick = close;
  sheet.onclick = e => { if (e.target === sheet) close(); };
  sheet.onkeydown = e => { if (e.key === "Escape") close(); };
  const say = text => { if (current()) sheet.querySelector("[data-online-status]").textContent = text; };
  const draw = () => {
    if (!current()) return;
    const list = sheet.querySelector("[data-online-list]");
    list.innerHTML = post.comments.map(c => `<article class="comment-row"><div class="comment-body"><b>@${esc(api.user(c.author)?.username || "member")}</b><span>${esc(c.body)}</span></div>
      ${c.author === api.me()?.id ? `<button type="button" data-online-delete="${esc(c.id)}" aria-label="Delete your comment">Delete</button>` : ""}</article>`).join("") || "<p>No comments yet.</p>";
    list.querySelectorAll("[data-online-delete]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        await requestCloudApi(`/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(b.dataset.onlineDelete)}`, { method: "DELETE" });
        if (!current()) return;
        post.comments = post.comments.filter(c => c.id !== b.dataset.onlineDelete); draw(); say("Comment removed.");
      } catch (e) { say(e.message); if (current()) b.disabled = false; }
    });
  };
  sheet.querySelector("[data-online-form]").onsubmit = async e => {
    e.preventDefault();
    if (sending || !current()) return;
    const input = e.currentTarget.querySelector("input"), button = e.currentTarget.querySelector("button"), body = input.value.trim();
    if (!body) return;
    sending = true; button.disabled = true; say("Saving comment…");
    try {
      const comment = await requestCloudApi(`/api/posts/${encodeURIComponent(postId)}/comments`, { method: "POST", body: { body } });
      if (!current()) return;
      post.comments.push(normalize(comment)); input.value = ""; draw(); say("Comment saved."); toast?.("Comment saved");
      recordActivity("comment",post);
    } catch (error) { say(error.message); }
    finally { sending = false; if (current()) button.disabled = false; }
  };
  const load = () => requestCloudApi(`/api/posts/${encodeURIComponent(postId)}/comments`).then(result => {
    if (!current()) return;
    post.comments = result.comments.map(normalize); draw(); say("");
    sheet.querySelectorAll("[data-online-form] input,[data-online-form] button").forEach(el => el.disabled = false);
    sheet.querySelector("[data-online-retry]").hidden = true;
  }).catch(error => { say(error.message); if (current()) sheet.querySelector("[data-online-retry]").hidden = false; });
  sheet.querySelector("[data-online-retry]").onclick = () => { say("Loading comments…"); void load(); };
  void load();
}
