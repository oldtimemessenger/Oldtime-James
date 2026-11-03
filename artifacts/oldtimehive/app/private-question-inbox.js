import { api, requestCloudApi } from "./store.js";
import { questionAnswerSeed } from "./status-sticker-editor.js";
import "./story-sticker-interactions.css";

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);

// Can open an owner's real inbox even after the original Status has expired.
export function openPrivateQuestionInbox(storyId, { questionId = null, onAnswer, toast = () => {} } = {}) {
  const owner = api.cloudAccountId(), previousFocus = document.activeElement;
  const host = document.createElement("div");
  host.className = "ss-dialog";
  host.innerHTML = `<section class="ss-panel" role="dialog" aria-modal="true" aria-label="Your questions">
    <header><h2>Your questions</h2><button type="button" data-close aria-label="Close">×</button></header>
    <div class="ss-content"><p class="ss-note">Only you can read these questions. Sharing an answer does not reveal who asked.</p>
    <div class="ss-inbox"></div><p class="ss-message" role="status"></p>
    <button type="button" class="ss-more" data-more hidden>More questions</button>
    <button type="button" class="ss-more" data-all ${questionId ? "" : "hidden"}>All questions</button></div></section>`;
  let closed = false, loading = false, offset = 0;
  const list = host.querySelector(".ss-inbox"), message = host.querySelector("[role=status]"), more = host.querySelector("[data-more]");
  const sameOwner = () => owner && owner === api.cloudAccountId();
  const close = (restore = true) => {
    if (closed) return;
    closed = true; host.remove();
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("storage", checkOwner);
    window.removeEventListener("focus", checkOwner);
    if (restore && previousFocus?.isConnected) previousFocus.focus({ preventScroll:true });
  };
  const checkOwner = () => { if (!sameOwner()) close(false); };
  const onKey = event => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); } };
  const load = async () => {
    if (loading || closed || !sameOwner()) return;
    loading = true; more.disabled = true; message.textContent = "Loading questions…";
    try {
      const query = new URLSearchParams({ offset: String(offset) });
      if (questionId) query.set("questionId", questionId);
      const response = await requestCloudApi(`/api/stories/${storyId}/questions?${query}`);
      if (closed || !sameOwner()) return close(false);
      for (const question of response.questions || []) {
        const row = document.createElement("article");
        row.innerHTML = `<small>${esc(question.asker?.displayName || question.asker?.username || "Member")}</small><p>${esc(question.body)}</p>
          <button type="button">${question.answerStoryId ? "Share another answer in Status" : "Share and answer in Status"}</button>`;
        row.querySelector("button").onclick = () => {
          if (!sameOwner()) return close(false);
          const seed = questionAnswerSeed(question);
          close(false);
          Promise.resolve(onAnswer?.(seed)).catch(error => toast(error.message || "Couldn't open your answer."));
        };
        list.append(row);
      }
      offset = response.nextOffset; more.hidden = !response.hasMore;
      message.textContent = list.children.length ? "" : "No questions found.";
    } catch (error) { if (!closed) { message.textContent = error.message || "Questions couldn't load."; more.hidden = false; more.textContent = "Retry"; } }
    finally { loading = false; more.disabled = false; }
  };
  host.onclick = event => { if (event.target === host || event.target.closest("[data-close]")) close(); };
  more.onclick = load;
  host.querySelector("[data-all]").onclick = event => { questionId = null; offset = 0; list.replaceChildren(); event.target.hidden = true; void load(); };
  document.body.append(host);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("storage", checkOwner); window.addEventListener("focus", checkOwner);
  host.querySelector("[data-close]").focus();
  void load();
  return close;
}
