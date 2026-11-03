// Optional email verification. Feed card is inline in the Home feed (a slot after several real posts).
// Explicit actions only: Verify opens a sheet, and only "Send verification email" POSTs a request.
import { api, requestCloudApi } from "./store.js";
import { readHelpState } from "./help-prompts.js";
import { shouldShowEmailReminder, applyEmailReminderEvent, EMAIL_STATUS_PATH, EMAIL_REQUEST_PATH, EMAIL_REMINDER_ID } from "./email-verification-reminder.js";

let sessionShownFor = "";
let verifiedFor = "";
let statusListener = null;

function persist(owner, event) {
  const state = readHelpState(owner);
  if (!state || api.cloudAccountId() !== owner) return Promise.resolve();
  return api.updateCloudAccountState({ helpPreferences: applyEmailReminderEvent(state, event) }).catch(() => {});
}

/** True only when the server-confirmed account says the email is not yet verified. */
export function emailNeedsVerification() {
  const owner = api.cloudAccountId();
  return Boolean(owner) && api.authMode() === "cloud" && verifiedFor !== owner && api.cloudSessionAccount?.()?.emailVerified === false;
}

/** Manual Confirm-email action (Settings / Edit profile / shared sheet): available unless the server says verified.
 * Accepts false and unknown/null (older accounts); the Home reminder card stays strict (=== false). */
export function emailManualActionAvailable() {
  const owner = api.cloudAccountId();
  const verified = api.cloudSessionAccount?.()?.emailVerified;
  return Boolean(owner) && api.authMode() === "cloud" && verifiedFor !== owner && (verified === false || verified === null);
}

export async function refreshEmailVerificationStatus() {
  const owner = api.cloudAccountId();
  if (!owner) return null;
  try {
    const status = await requestCloudApi(EMAIL_STATUS_PATH, { timeoutMs: 15_000 });
    if (api.cloudAccountId() !== owner) return null;
    if (status?.verified === true) {
      document.querySelectorAll("[data-ev-editor-open]").forEach(node => node.remove());
      verifiedFor = owner;
      document.querySelectorAll(".ev-card, [data-ev-settings]").forEach(node => node.remove());
      if (readHelpState(owner)?.items?.[EMAIL_REMINDER_ID]?.verifiedAt == null) void persist(owner, "verified");
    }
    return status;
  } catch { return null; }
}

/** Shared explicit-send sheet used by the feed card, Edit profile and Settings. Never sends on open. */
export async function openEmailVerificationSheet({ sheet, toast = () => {}, esc = String, allowReminderControls = false, onSnooze, onNever } = {}) {
  const owner = api.cloudAccountId();
  if (!sheet || !owner || !emailManualActionAvailable()) return;
  const returnFocus = document.activeElement;
  const status = await refreshEmailVerificationStatus();
  if (verifiedFor === owner) return toast("Your email is already confirmed.");
  const email = String(status?.email || api.cloudSessionAccount?.()?.email || "");
  sheet.innerHTML = `<section class="panel ev-sheet" role="dialog" aria-modal="true" aria-labelledby="ev-title">
    <h2 id="ev-title">Confirm your email</h2>
    <p>We’ll send a confirmation link to <b>${esc(email || "your account email")}</b>. Nothing changes until you open it.</p>
    <p class="ev-sheet-status" role="status" aria-live="polite"></p>
    <button type="button" class="ev-sheet-send" data-ev-send>Send verification email</button>
    <div class="ev-sheet-row"><button type="button" data-ev-later>${allowReminderControls ? "Not now" : "Close"}</button>${allowReminderControls ? `<button type="button" data-ev-never>Don’t remind me</button>` : ""}</div>
  </section>`;
  sheet.classList.add("on");
  const close = () => { sheet.classList.remove("on"); sheet.innerHTML = ""; sheet.onclick = null; sheet.onkeydown = null; if (returnFocus?.isConnected) returnFocus.focus(); };
  sheet.onkeydown = event => { if (event.key === "Escape") close(); };
  sheet.onclick = event => { if (event.target === sheet) close(); };
  sheet.querySelector("[data-ev-later]").onclick = () => { close(); if (allowReminderControls) onSnooze?.(); };
  const never = sheet.querySelector("[data-ev-never]");
  if (never) never.onclick = () => { close(); onNever?.(); };
  const send = sheet.querySelector("[data-ev-send]");
  send.onclick = async () => {
    if (send.disabled) return;
    send.disabled = true;
    const line = sheet.querySelector(".ev-sheet-status");
    line.textContent = "Sending…";
    try {
      const result = await requestCloudApi(EMAIL_REQUEST_PATH, { method: "POST", body: {}, timeoutMs: 15_000 });
      if (api.cloudAccountId() !== owner) return close();
      if (result?.alreadyVerified) {
        verifiedFor = owner;
        document.querySelectorAll(".ev-card, [data-ev-settings]").forEach(node => node.remove());
        close();
        return toast("Your email is already confirmed.");
      }
      line.textContent = "Sent. Open the link in your inbox, then come back here.";
      send.textContent = "Sent";
    } catch (failure) {
      line.textContent = failure?.message || "The email couldn’t be sent. Try again.";
      send.disabled = false;
    }
  };
  send.focus();
}

export function mountEmailVerificationReminder(screen, { isBusy = () => false, sheet = () => null, toast = () => {}, esc = String } = {}) {
  const owner = api.cloudAccountId();
  const slot = screen?.querySelector("[data-ev-slot]");
  const why = reason => { if (screen?.dataset) screen.dataset.evReminder = reason; };
  if (!slot) return why("no-slot");
  const clear = reason => { slot.replaceChildren(); statusListener?.(); return why(reason); };
  if (!owner || api.authMode() !== "cloud") return clear("not-cloud");
  if (!api.cloudAccountStateLoaded()) return clear("state-loading");
  if (!emailNeedsVerification()) return clear("not-false");
  const account = api.cloudSessionAccount();
  const state = readHelpState(owner);
  if (!state) return clear("prefs-unavailable");
  const preference = state.items?.[EMAIL_REMINDER_ID] || {};
  if (state.paused || preference.never || Number(preference.snoozedUntil) > Date.now() || isBusy()) return clear("paused");
  const alreadyThisSession = sessionShownFor === owner;
  if (!alreadyThisSession && !shouldShowEmailReminder({ accountId: owner, verified: account.emailVerified, accountJoinedAt: account.joinedAt, state, busy: isBusy() })) return clear("policy");
  // Retain the live card and its focus through background data refreshes.
  if (slot.querySelector(".ev-card")) return why("shown");

  const card = document.createElement("aside");
  card.className = "ev-card";
  card.setAttribute("aria-label", "Email confirmation reminder");
  card.innerHTML = `<div class="ev-card-copy"><b>Confirm your email</b><span>Helps you recover your account. Optional.</span></div>
    <button type="button" class="ev-card-cta" data-ev-open>Verify</button>
    <button type="button" class="ev-card-close" data-ev-snooze aria-label="Not now"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>`;
  slot.replaceChildren(card);
  if (!card.isConnected) return why("detached");
  why("shown");
  // Never consume the weekly reminder for a discarded or detached render.
  if (!alreadyThisSession) {
    sessionShownFor = owner;
    void persist(owner, "shown");
  }
  const hide = () => { slot.replaceChildren(); sessionShownFor = ""; detach(); };
  const onVisible = () => {
    if (!card.isConnected || api.cloudAccountId() !== owner) return detach();
    if (document.visibilityState === "visible") void refreshEmailVerificationStatus();
  };
  const detach = () => { document.removeEventListener("visibilitychange", onVisible); if (statusListener === detach) statusListener = null; };
  statusListener?.();
  statusListener = detach;
  document.addEventListener("visibilitychange", onVisible);
  const snooze = () => { hide(); void persist(owner, "snooze"); toast("We’ll remind you in a week. You can also confirm from Edit profile."); };
  const never = () => { hide(); void persist(owner, "never"); toast("Email reminders turned off. You can still confirm from Edit profile."); };
  card.querySelector("[data-ev-snooze]").onclick = snooze;
  card.querySelector("[data-ev-open]").onclick = () => void openEmailVerificationSheet({ sheet: sheet(), toast, esc, allowReminderControls: true, onSnooze: snooze, onNever: never });
}
