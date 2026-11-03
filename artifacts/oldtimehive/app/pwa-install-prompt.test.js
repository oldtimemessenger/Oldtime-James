import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isIOSDevice, isStandaloneInstalled, shouldShowInstallPrompt } from "./pwa-install-prompt.js";

test("the app does not mount or bind Home Screen installation pop-ups", () => {
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /home-install-prompt|home-install-dialog|bindPwaInstallPrompt/);
});

test("PWA install prompt does not appear for an installed or recently-dismissed app", () => {
  assert.equal(shouldShowInstallPrompt({ standalone: true }), false);
  assert.equal(shouldShowInstallPrompt({ now: 100, dismissedUntil: 101 }), false);
  assert.equal(shouldShowInstallPrompt({ now: 100, dismissedUntil: 99 }), true);
});

test("install detection supports iOS devices and standalone display mode", () => {
  assert.equal(isIOSDevice({ navigatorObject: { userAgent: "Mozilla/5.0 (iPhone)" } }), true);
  assert.equal(isIOSDevice({ navigatorObject: { platform: "MacIntel", maxTouchPoints: 5 } }), true);
  assert.equal(isIOSDevice({ navigatorObject: { userAgent: "Android", platform: "Linux" } }), false);
  assert.equal(isStandaloneInstalled({ navigatorObject: { standalone: true } }), true);
  assert.equal(isStandaloneInstalled({
    navigatorObject: {}, windowObject: { matchMedia: () => ({ matches: true }) },
  }), true);
});
