export async function finishStartup() {
  const opening = document.getElementById("oldtime-startup");
  if (!opening || opening.dataset.ready === "true") return;
  opening.dataset.ready = "true";
  // The app is ready: release it immediately instead of holding the user
  // behind an artificial minimum splash-screen duration.
  const app = document.getElementById("app");
  app?.removeAttribute("inert");
  app?.removeAttribute("aria-hidden");
  app?.classList.add("is-ready");
  requestAnimationFrame(() => {
    opening.classList.add("is-dismissed");
    setTimeout(() => opening.remove(), 460);
  });
}
