import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("creator tools coexist with the four destinations and central Create action", () => {
  const source = read("app.js");
  for (const view of ["updates", "blast", "chat", "profile"]) {
    assert.ok(source.includes(`data-tab="${view}"`));
  }
  assert.match(source, /class="nav-create-button" data-drawer-action="post"/);
  for (const view of ["creator-center", "blue-badge", "announcements"]) {
    assert.ok(source.includes(`data-creator-open="${view}"`));
  }
  assert.ok(!source.includes('data-drawer-route="creator-center"'));
  assert.ok(!source.includes('data-drawer-route="blue-badge"'));
  assert.ok(source.includes('data-creator-open="account-type"'));
});
test("membership is server-verified, billing status is honest, and client flags never grant badges", () => {
  const source = read("creator-center.js");
  assert.doesNotMatch(source, /\.verified|localStorage.*active|stripe/i);
  assert.match(source, /\/api\/creator\/badges/);
  assert.match(source, /b\.active === true/);
  assert.match(source, /Apple and Google subscription billing is not connected yet/);
  assert.match(source, /No payment will be taken here/);
  assert.match(source, /Membership gifting and the planned 50% discount/);
  assert.match(source, /Purchase restoration will be available after Apple and Google billing is configured/);
  assert.match(source, /account\/subscriptions/);
  assert.match(source, /currentTarget; b.disabled = true/);
});
test("announcements are safe during calls and composition, and have account-scoped limits", () => {
  assert.match(read("app.js"), /!currentCall\(\)/);
  assert.match(read("app.js"), /!document.activeElement\?\.isContentEditable/);
  const popup = read("creator-announcement.js");
  assert.match(popup, /sessionStorage/);
  assert.match(read("help-prompt-view.js"), /"region".*"dialog"|"dialog".*"region"/);
  assert.match(read("help-prompt-view.js"), /aria-modal="true"/);
  assert.match(popup, /not-now/);
  assert.match(popup, /setInterval/);
  assert.match(popup, /!isSafe\(\)/);
});
