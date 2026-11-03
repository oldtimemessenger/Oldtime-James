import "./creator-announcement.css";
import { requestCloudApi } from "./store.js";
import { readHelpState, canShowHelp, pickHelpPrompt, recordHelpChoice, helpGuide, hasSeenHelp } from "./help-prompts.js";
import { renderPromptCard } from "./help-prompt-view.js";
import { hasCommunityAnnouncementCard } from "./feed-announcement-cards.js";
import { createHelpDeliveryGuard } from "./help-delivery.js";

const DELAY = 15000;
const IDLE_WINDOW = 5000;
const RETRY_DELAY = 5000;
let token = 0;
let timer = null;
let open = null;
let openAccountId = null;
let lastInteraction = 0;
const fallbackDelivery = createHelpDeliveryGuard();
if(typeof document!=="undefined"){
  for(const event of ["pointerdown","keydown","wheel"])document.addEventListener(event,()=>{lastInteraction=Date.now();},{passive:true});
}

export function pickAnnouncement(list, state, accountId) {
  const items = (Array.isArray(list) ? list : []).filter(a => a && a.optional === true && !["safety", "service"].includes(a.category) && typeof a.id === "string" && a.title && !hasSeenHelp(state,a.id) && !hasCommunityAnnouncementCard(accountId, a.id));
  const rank = a => /welcome/i.test(a.id) || /^(welcome|creator)/i.test(String(a.category)) ? 0 : /promo/i.test(String(a.category)) ? 1 : 2;
  const ranked = items.map((a, i) => ({ a, i })).sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i);
  return ranked.length ? ranked[0].a : null;
}

function closeModal() {
  if (!open) return;
  open.cleanup();
  open = null;
  openAccountId = null;
}

export function resetCreatorAnnouncements() {
  token++;
  clearTimeout(timer);
  timer = null;
  closeModal();
}

export function scheduleCreatorAnnouncement({ app, esc, navigate, isSafe, accountId, toast=()=>{}, getContext=()=>({}) } = {}) {
  if (!app || typeof esc !== "function" || typeof isSafe !== "function") return;
  if (typeof accountId !== "string" || !accountId.trim()) return;
  if (openAccountId && openAccountId !== accountId) resetCreatorAnnouncements();
  if (open || timer || fallbackDelivery.isSuppressed(accountId) || !canShowHelp(readHelpState(accountId))) return;
  const my = token;
  const stale = () => my !== token || !app.isConnected || open;
  const retry = () => {
    if (stale() || open || timer || fallbackDelivery.isSuppressed(accountId)) return;
    timer = setTimeout(run, RETRY_DELAY);
  };
  const run = async () => {
    timer = null;
    if (stale() || fallbackDelivery.isSuppressed(accountId)) return;
    if (!isSafe() || Date.now()-lastInteraction<IDLE_WINDOW) { retry(); return; }
    const [announcementsResult,preferencesResult] = await Promise.allSettled([
      requestCloudApi("/api/announcements"),
      requestCloudApi("/api/announcement-preferences"),
    ]);
    const res = announcementsResult.status === "fulfilled" ? announcementsResult.value : null;
    const preferences = preferencesResult.status === "fulfilled"
      ? preferencesResult.value
      : { features: true, communities: true };
    if (stale() || fallbackDelivery.isSuppressed(accountId)) return;
    if (!isSafe() || Date.now()-lastInteraction<IDLE_WINDOW) { retry(); return; }
    const state=readHelpState(accountId);
    if(!canShowHelp(state))return;
    const tipsEnabled = !state.paused;
    const a = (tipsEnabled ? pickHelpPrompt(getContext(),state,preferences) : null) || pickAnnouncement(res?.announcements,state,accountId);
    if (!a) return;
    let presented = false;
    const show = () => {
      if (presented || stale()) return;
      present(a,{app,esc,navigate,accountId,my,isSafe,toast});
      presented = true;
    };
    const claim = async () => {
      const latest=readHelpState(accountId);
      if(stale() || !isSafe() || fallbackDelivery.isSuppressed(accountId) || !canShowHelp(latest) || hasSeenHelp(latest,a.id))return false;
      // Claim locally before the async write so slow or failed client requests
      // cannot keep a tip from appearing. localStorage also coordinates tabs.
      fallbackDelivery.suppress(accountId);
      const save = recordHelpChoice(accountId,a.id,"shown");
      show();
      try {
        await save;
      } catch { /* The visible tip remains actionable if account sync is down. */ }
      return true;
    };
    let claimed=false;
    try {
      claimed = typeof navigator!=="undefined" && navigator.locks?.request
        ? await navigator.locks.request(`oldtime-tip:${accountId}`,{ifAvailable:true},lock=>lock?claim():false)
        : await claim();
    } catch {
      // If browser lock support fails, fall back to the account cooldown.
      try { claimed = await claim(); } catch { claimed = false; }
    }
    if(claimed)show();
  };
  timer = setTimeout(run, DELAY);
}

export function showHelpfulWalkthrough({id,app,esc,navigate,accountId,isSafe=()=>true,toast=()=>{},preview=false}) {
  const a=helpGuide(id);
  if(!a || !app || !accountId || !isSafe())return;
  resetCreatorAnnouncements();
  if(!preview){
    fallbackDelivery.suppress(accountId);
    void recordHelpChoice(accountId,id,"viewed").catch(()=>toast("This guide can be viewed, but tip preferences couldn't be saved online."));
  }
  present({...a,manual:true,preview},{app,esc,navigate,accountId,isSafe,toast,my:token});
}

function present(a,{app,esc,navigate,accountId,isSafe,toast,my}) {
    const prior = document.activeElement;
    const id = `cta-${Math.random().toString(36).slice(2, 8)}`;
    const wrap = document.createElement("div");
    wrap.className = `cta-backdrop${a.local&&(!a.manual||a.preview)?" cta-help":""}`;
    wrap.hidden = !!a.local && !isSafe();
    wrap.innerHTML = renderPromptCard(a,{esc,id,baseUrl:import.meta.env.BASE_URL});
    const modal = wrap.firstElementChild;
    const err = wrap.querySelector(".cta-err");
    let busy = false;
    const onKey = e => {
      if (e.key === "Escape") { e.preventDefault(); dismiss("not-now"); return; }
      if (e.key !== "Tab" || (a.local&&!a.manual)) return;
      const f = [...modal.querySelectorAll("button:not([disabled])")];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const cleanup = () => {
      const restoreFocus=modal.contains(document.activeElement);
      clearInterval(safetyTimer);
      document.removeEventListener("keydown", onKey, true);
      wrap.remove();
      if (restoreFocus&&prior?.isConnected) try { prior.focus(); } catch { /* ignore */ }
    };
    open = { cleanup };
    openAccountId = accountId;
    const safetyTimer = setInterval(() => {
      if (open?.cleanup !== cleanup) return;
      if (a.local) wrap.hidden = !isSafe();
      else if (!isSafe()) closeModal();
    }, 500);
    async function dismiss(choice) {
      if (busy) return;
      busy = true; err.textContent = "";
      if(!a.preview)void recordHelpChoice(accountId,a.id,choice)
        .catch(()=>toast("Your tip choice couldn't be saved online."));
      if (open?.cleanup === cleanup) closeModal();
      if(!a.local&&!a.preview)requestCloudApi(`/api/announcements/${encodeURIComponent(a.id)}/dismiss`, { method:"POST",body:{choice} })
        .catch(()=>toast("Closed on this device. Online announcement preferences couldn't be updated."));
    }
    wrap.addEventListener("click", e => { if (e.target === wrap) dismiss("not-now"); });
    wrap.querySelectorAll("[data-cta]").forEach(b => b.addEventListener("click", async () => {
      const c = b.dataset.cta;
      if (c !== "action" && c !== "secondary-action") return dismiss(c);
      if (busy) return;
      busy = true;
      if(!a.preview)void recordHelpChoice(accountId,a.id,"action")
        .catch(()=>toast("Your tip choice couldn't be saved online."));
      if(!a.local&&!a.preview)void requestCloudApi(`/api/announcements/${encodeURIComponent(a.id)}/event`, { method: "POST", body: { event: "action" } })
        .catch(()=>{});
      if (open?.cleanup !== cleanup) return;
      closeModal();
      if (my === token) navigate?.(c==="secondary-action"?a.secondaryRoute:a.primaryRoute);
    }));
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(wrap);
    if(!a.local||a.manual)modal.querySelector(".cta-primary, .cta-secondary")?.focus();
    if(!a.local)requestCloudApi(`/api/announcements/${encodeURIComponent(a.id)}/event`, { method: "POST", body: { event: "shown" } }).catch(() => {});
}
