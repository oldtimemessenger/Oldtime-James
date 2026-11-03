import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { finishStartup } from "./startup.js";
import { icons } from "./icons.js";

function openingFixture(t) {
  const classes = new Set();
  const progress = new Map();
  const appAttributes = new Set(["inert", "aria-hidden"]);
  const label = { textContent: "Loading Oldtime…" };
  const opening = {
    dataset: { started: String(performance.now() - 1000) },
    classList: { add: name => classes.add(name) },
    querySelector: selector => selector === '[role="progressbar"]'
      ? { setAttribute: (name, value) => progress.set(name, value) }
      : label,
    remove() { this.removed = true; }
  };
  t.mock.method(globalThis, "requestAnimationFrame", callback => callback(), { times: Infinity });
  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: id => id === "oldtime-startup" ? opening : {
      removeAttribute: name => appAttributes.delete(name)
    }
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  return { opening, classes, progress, appAttributes, label };
}

// Node has no requestAnimationFrame; expose it for scoped test mocking.
globalThis.requestAnimationFrame ??= callback => callback();

test("opening completes only when the app signals readiness and releases the app", async t => {
  const fixture = openingFixture(t);
  await finishStartup();
  assert.equal(fixture.opening.dataset.ready, "true");
  assert.ok(fixture.classes.has("is-complete"));
  assert.ok(fixture.classes.has("is-dismissed"));
  assert.equal(fixture.appAttributes.size, 0);
  assert.equal(fixture.progress.get("aria-valuenow"), "100");
  assert.equal(fixture.label.textContent, "Ready");
  await new Promise(resolve => setTimeout(resolve, 260));
  assert.equal(fixture.opening.removed, true);
});

test("opening HTML uses the original supplied artwork and an indeterminate bar", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /src="%BASE_URL%brand\/oldtime-login-red\.png"/);
  assert.match(html,/oldtime-startup-art\s*\{[^}]*left:50%; top:50%; width:min\(176px,42vw,32vh\)/);
  assert.match(html,/oldtime-startup-art\s*\{[^}]*object-fit:contain/);
  assert.doesNotMatch(html,/mask-image|mask-composite/);
  assert.match(html,/oldtime-startup-status\s*\{[^}]*bottom:max\(64px/);
  assert.match(html, /role="progressbar" aria-label="Loading Oldtime"/);
  assert.doesNotMatch(html, /aria-valuenow=/);
  assert.match(html, /oldtime-startup-retry/);
  assert.match(html, /prefers-reduced-motion:reduce/);
});

test("Community navigation uses the community icon without replacing reaction stars", () => {
  assert.notEqual(icons.timeCircle, icons.star);
  assert.match(icons.timeCircle, /<rect/);
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  assert.match(app, /aria-label="Community">\$\{ic\.users\}/);
});

test("brand red applies to primary buttons, not text or navigation selections", () => {
  const css = readFileSync(new URL("./brand-selection.css", import.meta.url), "utf8");
  assert.match(css, /background:var\(--brand-red\)/);
  assert.match(css, /color:#fff !important/);
  assert.doesNotMatch(css, /::selection|--selected-text|\.nav button\.on|\.seg button\.on|\.home-view-tab\.on/);
});

test("bottom navigation keeps visible names, accessible names, and destinations", () => {
  const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const nav = app.match(/<nav class="nav \$[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav);
  for (const name of ["Home", "Community", "Messages", "Profile"]) {
    assert.ok(nav.includes(`aria-label="${name}"`));
    assert.ok(nav.includes(`<span>${name}</span>`));
  }
});

test("auth artwork redesign preserves password forms without adding reference-only providers", () => {
  const markup = readFileSync(new URL("./auth-design.js", import.meta.url), "utf8");
  for (const id of ["login-form", "email", "pass", "err", "login", "signup", "signup-form", "su-email", "su-user", "su-name", "su-pass", "su-bday", "su-bio", "go", "back"]) {
    assert.ok(markup.includes(`id="${id}"`), `Preserve the existing ${id} control`);
  }
  assert.match(markup, /autocomplete="current-password"/);
  assert.match(markup, /minlength="8"/);
  assert.doesNotMatch(markup, /Send me a code|Continue with Apple|Continue with Google/);
});
