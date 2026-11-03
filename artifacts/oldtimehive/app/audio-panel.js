import "./audio-remix.css";
import { api } from "./store.js";
import { audioSource, audioTitle, audioSaved, audioUses, savedAudio, saveAudio, removeSavedAudio, canReuseAudio, loadAudioSource } from "./audio-library.js";
import { mediaUrl } from "./local-media.js";
import { renderAudioPanel } from "./audio-remix-view.js";
import { openRemixStudio } from "./remix-studio.js";

export function openAudioPanel({ postId, initialMode = "", sheet, esc, icons, toast, onPosted, onClose, onUseSound }) {
  const owner = api.me()?.id;
  let id = postId;
  let initialAction = initialMode;
  const originalFocus = document.activeElement;
  const close = (refresh = true) => {
    sheet.querySelector("audio")?.pause();
    sheet.classList.remove("on"); sheet.innerHTML = ""; sheet.onclick = null;
    document.removeEventListener("keydown", keyboard);
    if (refresh) onClose?.();
    if (originalFocus?.isConnected) originalFocus.focus();
  };
  const keyboard = event => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key === "Tab") {
      const controls = [...sheet.querySelectorAll("button:not(:disabled), audio, [tabindex='0']")];
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }
  };
  const error = failure => { const target = sheet.querySelector("[data-audio-error]"); if (target) target.textContent = failure.message; };
  const current = () => {
    const post = api.post(id);
    if (api.me()?.id !== owner || !post || !api.canSeePost(post)) throw new Error("This post is unavailable.");
    return post;
  };
  const launch = async mode => {
    try {
      const post = current();
      const source = await loadAudioSource(post);
      if (!source || !canReuseAudio(post)) throw new Error("The creator hasn’t enabled reuse for this sound.");
      if ((mode === "use" || mode === "reuse") && !onUseSound) throw new Error("Sound creation is unavailable right now.");
      close(false);
      if (mode === "use" || mode === "reuse") onUseSound({ post, source, title: audioTitle(source) });
      else void openRemixStudio({ postId: post.id, mode: "remix", esc, icons, toast, onPosted });
    } catch (failure) { error(failure); }
  };
  const draw = async () => {
    try {
      const post = current(), source = await loadAudioSource(post), reusable = canReuseAudio(post);
      sheet.querySelector("audio")?.pause();
      sheet.innerHTML = renderAudioPanel({
        post: { ...post, soundTitle: source ? audioTitle(source) : post.sound || "Original audio" },
        author: api.user(source?.author || post.author), saved: audioSaved(post), library: savedAudio(), uses: audioUses(source || post), esc, icons
      });
      sheet.classList.add("on");
      sheet.querySelector("[data-audio-close]").onclick = () => close();
      sheet.querySelector("[data-audio-reuse]").disabled = !reusable;
      sheet.querySelector("[data-audio-remix]").disabled = !reusable || post.kind !== "video";
      sheet.querySelector("[data-audio-save]").disabled = !reusable;
      sheet.querySelector("[data-audio-reuse]").onclick = () => void launch("use");
      sheet.querySelector("[data-audio-remix]").onclick = () => void launch("remix");
      sheet.querySelector("[data-audio-save]").onclick = () => {
        try { saveAudio(current(), !audioSaved(current())); void draw(); }
        catch (failure) { error(failure); }
      };
      sheet.querySelectorAll("[data-audio-library]").forEach(row => {
        const open = async () => {
          id = row.dataset.audioLibrary;
          try {
            if (!api.post(id) && api.authMode() === "cloud") await api.loadCloudPost(id);
            await draw();
          } catch (failure) { error(failure); }
        };
        row.onclick = open;
        row.onkeydown = event => { if (event.target === row && ["Enter", " "].includes(event.key)) { event.preventDefault(); void open(); } };
      });
      sheet.querySelectorAll("[data-audio-remove]").forEach(button => {
        button.onclick = event => {
          event.stopPropagation();
          try { removeSavedAudio(button.dataset.audioRemove); void draw(); }
          catch (failure) { error(failure); }
        };
      });
      sheet.querySelector("[data-audio-close]").focus();
      if (initialAction) {
        const mode = initialAction;
        initialAction = "";
        void launch(mode === "reuse" ? "use" : mode);
        return;
      }
      if (source) {
        const audio = sheet.querySelector("#ap-preview"), sourceId = id;
        try { const url = await mediaUrl(source.media[0]); if (audio.isConnected && sourceId === id && canReuseAudio(current())) audio.src = url; }
        catch (failure) { if (audio.isConnected) error(failure); }
      } else error(new Error("This post doesn’t have reusable audio. Your saved sounds are private to you."));
      if (source && !reusable) error(new Error("The creator hasn’t enabled reuse for this sound."));
    } catch (failure) { close(false); toast(failure.message); }
  };
  document.querySelectorAll(".clip video").forEach(video => video.pause());
  sheet.onclick = event => { if (event.target === sheet) close(); };
  document.addEventListener("keydown", keyboard);
  void draw();
}
