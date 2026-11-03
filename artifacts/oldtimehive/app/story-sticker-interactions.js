import { api, requestCloudApi } from "./store.js";
import "./story-sticker-interactions.css";
import { ART_HOLES } from "./status-sticker-art.js";
import { ART_SIZE, questionAnswerSeed } from "./status-sticker-editor.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const label = s => s.title || ({ questions: "Questions", trendsetters: "Trendsetters", "hey-world": "Hey World", answer: "Answer" }[s.kind]);
const safePosition = (n, fallback, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : fallback));

export function mountStoryStickerInteractions(view, story, { onCreate, onOpenStory, toast = () => {} } = {}) {
  const stage = view.querySelector(".story-stage");
  if (!stage || !Array.isArray(story.stickers) || !story.stickers.length) return () => {};
  let disposed = false, dialog = null, pausedMedia = null;
  const owned = story.author === api.cloudAccountId() || story.author === api.me()?.id;
  const layer = document.createElement("div");
  layer.className = "ss-hitboxes";
  stage.append(layer);
  const closeDialog = () => {
    dialog?.remove(); dialog = null; delete view.dataset.stickerOpen;
    document.removeEventListener("keydown", onKey, true);
    if (pausedMedia) {
      const { element, resume, hold } = pausedMedia;
      element.removeEventListener("play", hold);
      pausedMedia = null;
      if (resume && !disposed && view.isConnected) element.play().catch(() => {});
    }
  };
  const onKey = e => { if (e.key === "Escape" && dialog) { e.preventDefault(); e.stopImmediatePropagation(); closeDialog(); } };
  function openDialog(title) {
    closeDialog();
    const host = dialog = document.createElement("div");
    host.className = "ss-dialog";
    host.innerHTML = `<section class="ss-panel" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button type="button" data-ss-close aria-label="Close">×</button></header><div class="ss-content"></div></section>`;
    host.onclick = e => { if (e.target === host || e.target.closest("[data-ss-close]")) closeDialog(); };
    document.body.append(host); view.dataset.stickerOpen = "true";
    const video = stage.querySelector("video");
    if (video) {
      const hold = () => video.pause();
      pausedMedia = { element: video, resume: !video.paused, hold };
      video.addEventListener("play", hold);
      video.pause();
    }
    document.addEventListener("keydown", onKey, true);
    host.querySelector("[data-ss-close]").focus();
    return host.querySelector(".ss-content");
  }
  async function ask(sticker) {
    const content = openDialog(sticker.title || "Ask a question");
    content.innerHTML = `<p class="ss-prompt">${esc(sticker.prompt || "Ask me anything")}</p>
      <form><label>Your question<textarea maxlength="300" required rows="3" aria-label="Your question"></textarea></label>
      <p class="ss-note">Only the Status owner can see this question. They can choose to share it in an answer, without your name.</p>
      <p class="ss-message" role="status"></p><button class="ss-primary" type="submit">Send question</button></form>`;
    const form = content.querySelector("form"), text = content.querySelector("textarea"), message = content.querySelector("[role=status]");
    let requestId = "", lastBody = "";
    text.focus();
    form.onsubmit = async e => {
      e.preventDefault();
      const body = text.value.trim();
      if (!body) return text.focus();
      const send = form.querySelector("button");
      if (send.disabled) return;
      if (lastBody !== body) { requestId = crypto.randomUUID(); lastBody = body; }
      send.disabled = true; message.textContent = "Sending…";
      try {
        await requestCloudApi(`/api/stories/${story.id}/stickers/${sticker.id}/questions`, { method: "POST", body: { clientId: requestId, body } });
        if (disposed || !content.isConnected) return;
        text.value = ""; message.textContent = "Question sent privately.";
        send.textContent = "Sent";
        text.disabled = true;
      } catch (error) {
        if (!content.isConnected) return;
        message.textContent = error.message || "Couldn't send. Your question is still here.";
        send.disabled = false;
      }
    };
  }
  async function inbox(sticker) {
    const content = openDialog(sticker.title || "Your questions");
    content.innerHTML = `<p class="ss-note">Only you can see this inbox. An answer shares the question and your response, not the sender's name.</p><div class="ss-inbox"></div><button class="ss-more" hidden>More questions</button><p class="ss-message" role="status"></p>`;
    const list = content.querySelector(".ss-inbox"), more = content.querySelector(".ss-more"), message = content.querySelector("[role=status]");
    let offset = 0, loading = false;
    const load = async () => {
      if (loading) return; loading = true; more.disabled = true; message.textContent = "Loading questions…";
      try {
        const response = await requestCloudApi(`/api/stories/${story.id}/questions?offset=${offset}`);
        if (disposed || !content.isConnected) return;
        for (const q of response.questions || []) {
          const row = document.createElement("article");
          row.innerHTML = `<small>${esc(q.asker?.displayName || q.asker?.username || "Member")}</small><p>${esc(q.body)}</p>
            <button type="button">${q.answerStoryId ? "Answer again in Status" : "Answer in Status"}</button>`;
          row.querySelector("button").onclick = () => {
            closeDialog();
            onCreate?.(questionAnswerSeed(q, sticker.title || ""));
          };
          list.append(row);
        }
        offset = response.nextOffset;
        more.hidden = !response.hasMore;
        message.textContent = list.children.length ? "" : "No questions yet.";
      } catch (error) { if (content.isConnected) { message.textContent = error.message || "Couldn't load questions."; more.hidden = false; more.textContent = "Retry"; } }
      finally { loading = false; more.disabled = false; }
    };
    more.onclick = load; await load();
  }
  function startJoin(sticker) {
    closeDialog();
    onCreate?.({ initialStickers: [{ id: crypto.randomUUID(), kind: sticker.kind, title: sticker.title || "", prompt: sticker.prompt,
      sourceStickerId: sticker.id, x: .5, y: .6, width: sticker.width || .7, height: sticker.height || .35, rotation: 0 }] });
  }
  function isJoinTap(event, button, sticker) {
    if (event.detail === 0) return true; // keyboard activation takes the primary action
    const hole = ART_HOLES[sticker.kind]?.join, size = ART_SIZE[sticker.kind];
    if (!hole || !size || !button.offsetWidth || !button.offsetHeight) return false;
    const frameAspect = button.offsetWidth / button.offsetHeight, artAspect = size[0] / size[1];
    const width = Math.min(1, artAspect / frameAspect), height = Math.min(1, frameAspect / artAspect);
    const x = (event.offsetX / button.offsetWidth - (1 - width) / 2) / width;
    const y = (event.offsetY / button.offsetHeight - (1 - height) / 2) / height;
    return x >= hole[0] && x <= hole[2] && y >= hole[1] && y <= hole[3];
  }
  async function trend(sticker) {
    const content = openDialog(label(sticker));
    content.innerHTML = `<p class="ss-prompt">${esc(sticker.prompt)}</p><button class="ss-primary" data-ss-join>Join</button>
      <div class="ss-participants" aria-label="Swipe through participants"></div><button class="ss-more" hidden>More</button><p class="ss-message" role="status"></p>`;
    content.querySelector("[data-ss-join]").onclick = () => startJoin(sticker);
    const list = content.querySelector(".ss-participants"), more = content.querySelector(".ss-more"), message = content.querySelector("[role=status]");
    let offset = 0, loading = false; const seen = new Set();
    const load = async () => {
      if (loading) return; loading = true; more.disabled = true; message.textContent = "Loading participants…";
      try {
        const response = await requestCloudApi(`/api/stories/${story.id}/stickers/${sticker.id}/participants?offset=${offset}`);
        if (disposed || !content.isConnected) return;
        for (const p of response.participants || []) {
          if (seen.has(p.storyId)) continue; seen.add(p.storyId);
          const card = document.createElement("button"); card.type = "button"; card.className = "ss-person";
          card.innerHTML = `<span class="ss-person-photo">${p.author?.avatar ? `<img src="${esc(p.author.avatar)}" alt="" loading="lazy">` : `<span aria-hidden="true">${esc((p.author?.displayName || p.author?.username || "M").slice(0, 1))}</span>`}</span>
            <b>${esc(p.author?.displayName || p.author?.username || "Member")}</b><small>View Status</small>`;
          card.onclick = async () => {
            card.disabled = true;
            try { await api.fetchCloudStoryById(p.storyId); closeDialog(); onOpenStory?.(p.author.id, p.storyId); }
            catch (e) { toast(e.message || "Status is no longer available."); card.disabled = false; }
          };
          list.append(card);
        }
        offset = response.nextOffset; more.hidden = !response.hasMore;
        message.textContent = list.children.length ? "" : "No visible participants yet.";
      } catch (error) { if (content.isConnected) { message.textContent = error.message || "Couldn't load participants."; more.hidden = false; more.textContent = "Retry"; } }
      finally { loading = false; more.disabled = false; }
    };
    more.onclick = load; await load();
  }
  for (const sticker of story.stickers) {
    if (!["questions", "trendsetters", "hey-world"].includes(sticker.kind)) continue;
    const button = document.createElement("button");
    button.type = "button"; button.className = "ss-hit";
    button.setAttribute("aria-label", sticker.kind === "questions" ? (owned ? "Open your private questions" : sticker.prompt || "Ask a question") : `${label(sticker)} — Join`);
    button.style.cssText = `left:${safePosition(sticker.x, .5) * 100}%;top:${safePosition(sticker.y, .55) * 100}%;width:${safePosition(sticker.width, .7, .15) * 100}%;height:${safePosition(sticker.height, .24, .08, .8) * 100}%;transform:translate(-50%,-50%) rotate(${safePosition(sticker.rotation, 0, -180, 180)}deg)`;
    if (!story.hasMedia) { button.classList.add("ss-hit-visible"); button.textContent = `${sticker.title || label(sticker)} · ${sticker.prompt || "Ask me anything"}`; }
    button.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      if (sticker.kind === "questions") void (owned ? inbox(sticker) : ask(sticker));
      else if (isJoinTap(e, button, sticker)) startJoin(sticker);
      else void trend(sticker);
    };
    layer.append(button);
  }
  const media = stage.querySelector("img.story-stage-media,video.story-stage-media");
  const resize = () => {
    const width = stage.clientWidth, height = stage.clientHeight;
    const nativeW = media?.naturalWidth || media?.videoWidth || 1080, nativeH = media?.naturalHeight || media?.videoHeight || 1920;
    const fit = media ? getComputedStyle(media).objectFit : "contain";
    const scale = fit === "cover" ? Math.max(width / nativeW, height / nativeH) : Math.min(width / nativeW, height / nativeH);
    const w = nativeW * scale, h = nativeH * scale;
    layer.style.cssText = `width:${w}px;height:${h}px;left:${(width - w) / 2}px;top:${(height - h) / 2}px`;
  };
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  observer?.observe(stage); media?.addEventListener("load", resize); media?.addEventListener("loadedmetadata", resize); resize();
  return () => { disposed = true; closeDialog(); observer?.disconnect(); media?.removeEventListener("load", resize); media?.removeEventListener("loadedmetadata", resize); layer.remove(); };
}
