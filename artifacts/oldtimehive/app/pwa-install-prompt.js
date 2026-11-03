const DISMISS_KEY = "oldtime.pwa-install-dismissed-until";
const DISMISS_DAYS = 30;
let availableInstallEvent = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    availableInstallEvent = event;
  });
  window.addEventListener("appinstalled", () => { availableInstallEvent = null; });
}

export function isStandaloneInstalled({ navigatorObject = globalThis.navigator, windowObject = globalThis.window } = {}) {
  return navigatorObject?.standalone === true ||
    windowObject?.matchMedia?.("(display-mode: standalone)")?.matches === true;
}

export function isIOSDevice({ navigatorObject = globalThis.navigator } = {}) {
  const agent = String(navigatorObject?.userAgent || "");
  return /iPhone|iPad|iPod/i.test(agent) ||
    (navigatorObject?.platform === "MacIntel" && Number(navigatorObject?.maxTouchPoints) > 1);
}

export function shouldShowInstallPrompt({ now = Date.now(), dismissedUntil = 0, standalone = false } = {}) {
  return !standalone && !(Number(dismissedUntil) > now);
}

export function bindPwaInstallPrompt({ root, windowObject = globalThis.window, navigatorObject = globalThis.navigator, storage, now = Date.now }) {
  const button = root?.querySelector?.("#home-install");
  const dismiss = root?.querySelector?.("#home-install-dismiss");
  const hint = root?.querySelector?.("#home-install-prompt");
  const dialog = root?.querySelector?.("#home-install-dialog");
  if (!button || !hint || !dialog) return () => {};
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  const isStandalone = () => isStandaloneInstalled({ navigatorObject, windowObject });
  const dismissedUntil = () => {
    try { return Number(storage?.getItem(DISMISS_KEY) || 0); } catch { return 0; }
  };
  const update = () => {
    hint.hidden = !shouldShowInstallPrompt({ now: now(), dismissedUntil: dismissedUntil(), standalone: isStandalone() });
  };
  const onInstalled = () => {
    availableInstallEvent = null;
    hint.hidden = true;
    dialog.close?.();
  };
  const onClick = async () => {
    if (availableInstallEvent?.prompt) {
      const pending = availableInstallEvent;
      availableInstallEvent = null;
      try {
        await pending.prompt();
        const choice = await pending.userChoice;
        if (choice?.outcome === "accepted") hint.hidden = true;
      } catch {
        button.textContent = "Install instructions";
      }
      return;
    }
    const ios = isIOSDevice({ navigatorObject });
    dialog.innerHTML = `<form method="dialog" class="home-install-dialog-content">
      <h2>Add Oldtime to your Home Screen</h2>
      <ol>
        <li>${ios ? "In Safari, tap the Share button." : "Open your browser’s menu or Share options."}</li>
        <li>Choose “Add to Home Screen”.</li>
        <li>Confirm by tapping “Add”.</li>
      </ol>
      <button type="submit" class="primary">Done</button>
    </form>`;
    dialog.showModal?.();
  };
  const onDismiss = () => {
    try { storage?.setItem(DISMISS_KEY, String(now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)); } catch { /* Storage is optional. */ }
    update();
  };
  button.addEventListener("click", onClick);
  dismiss?.addEventListener("click", onDismiss);
  windowObject?.addEventListener?.("appinstalled", onInstalled);
  update();
  return () => {
    button.removeEventListener("click", onClick);
    dismiss?.removeEventListener("click", onDismiss);
    windowObject?.removeEventListener?.("appinstalled", onInstalled);
    if (dialog.open) dialog.close?.();
  };
}
