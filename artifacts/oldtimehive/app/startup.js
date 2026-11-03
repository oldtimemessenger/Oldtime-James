export async function finishStartup() {
  const opening = document.getElementById("oldtime-startup");
  if (!opening || opening.dataset.ready === "true") return;
  opening.dataset.ready = "true";
  const started=Number(opening.dataset.started);
  const reduced=typeof window!=="undefined"&&window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const remaining=Number.isFinite(started)?Math.max(0,850-(performance.now()-started)):0;
  if(remaining&&!reduced)await new Promise(resolve=>setTimeout(resolve,remaining));
  const app = document.getElementById("app");
  app?.removeAttribute("inert");
  app?.removeAttribute("aria-hidden");
  app?.classList.add("is-ready");
  requestAnimationFrame(() => {
    opening.classList.add("is-dismissed");
    setTimeout(() => opening.remove(), 460);
  });
}
