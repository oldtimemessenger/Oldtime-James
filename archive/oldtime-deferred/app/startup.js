// The progress bar is indeterminate until the first usable screen is rendered.
// A brief minimum display makes the supplied artwork visible even on a warm load.
export async function finishStartup() {
  const opening = document.getElementById("oldtime-startup");
  if (!opening || opening.dataset.ready === "true") return;
  opening.dataset.ready = "true";
  const started = Number(opening.dataset.started) || 0;
  const remaining = Math.max(0, 850 - (performance.now() - started));
  await new Promise(resolve => setTimeout(resolve, remaining));
  const app = document.getElementById("app");
  app?.removeAttribute("inert");
  app?.removeAttribute("aria-hidden");
  opening.classList.add("is-complete");
  opening.querySelector('[role="progressbar"]')?.setAttribute("aria-valuenow", "100");
  opening.querySelector('[role="progressbar"]')?.setAttribute("aria-valuemin", "0");
  opening.querySelector('[role="progressbar"]')?.setAttribute("aria-valuemax", "100");
  opening.querySelector("#oldtime-startup-label").textContent = "Ready";
  requestAnimationFrame(() => {
    opening.classList.add("is-dismissed");
    setTimeout(() => opening.remove(), 240);
  });
}
