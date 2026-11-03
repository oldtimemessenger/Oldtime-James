import "./creator-center.css";
import { tipIllustration } from "./tip-illustrations.js";
import { api, requestCloudApi } from "./store.js";
import { icon } from "./icons.js";
import { syncCreatorOriginals } from "./creator-content-sync.js";
import { hasPermanentBlueBadge } from "../../../lib/api-zod/src/account-policy";

const TITLES = {
  "creator-center": "Overview",
  "creator-content": "Content",
  "creator-analytics": "Analytics",
  "creator-tools": "Tools",
  "blue-badge": "Blue Badge",
  announcements: "Announcements",
  "creator-admin": "Creator admin",
};
const MAIN_SECTIONS = ["creator-center", "creator-content", "creator-analytics", "creator-tools"];
export const CREATOR_TOOL_ROUTES = Object.freeze(Object.keys(TITLES));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BADGE_TTL = 60000;
let token = 0;
let shownSet = new Set();
let badgeCache = new Map();
let evalBusy = false;

export function resetCreatorScreenState() {
  token++; shownSet = new Set(); badgeCache = new Map(); evalBusy = false;
}

export function blueBadgeMarkup(cloudId, esc = String) {
  if (!UUID.test(String(cloudId || ""))) return "";
  const accountId = String(cloudId).toLowerCase();
  const hidden = hasPermanentBlueBadge(accountId) ? "" : " hidden";
  return `<span class="ct-bb" role="img" aria-label="Blue Badge" data-ct-badge="${esc(accountId)}"${hidden}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`;
}

export async function hydrateBlueBadges(root) {
  if (!root?.querySelectorAll || typeof navigator !== "undefined" && navigator.onLine === false) return;
  const requestToken = token;
  const nodes = [...root.querySelectorAll("[data-ct-badge]")];
  const paidNodes = nodes.filter(n => !hasPermanentBlueBadge(n.dataset.ctBadge));
  const now = Date.now();
  const paint = () => paidNodes.forEach(n => {
    const hit = badgeCache.get(n.dataset.ctBadge);
    n.hidden = !(hit && hit.at + BADGE_TTL > Date.now() && hit.active === true);
  });
  paint();
  const need = [...new Set(paidNodes.map(n => n.dataset.ctBadge))].filter(id => UUID.test(id) && !(badgeCache.get(id)?.at + BADGE_TTL > now));
  for (let i = 0; i < need.length; i += 50) {
    const ids = need.slice(i, i + 50);
    try {
      const res = await requestCloudApi(`/api/creator/badges?userIds=${ids.join(",")}`);
      if (requestToken !== token) return;
      const seen = new Set();
      for (const b of Array.isArray(res?.badges) ? res.badges : []) {
        const id = String(b.userId || "").toLowerCase();
        if (ids.includes(id)) { seen.add(id); badgeCache.set(id, { active: b.active === true, at: Date.now() }); }
      }
      ids.filter(id => !seen.has(id)).forEach(id => badgeCache.set(id, { active: false, at: Date.now() }));
    } catch { /* stay hidden */ }
  }
  paint();
}

const money = c => `$${(Number(c) / 100).toFixed(2)}`;
const fmtDate = v => {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [year, month, day] = v.split("-");
    return `${month}/${day}/${year}`;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
};
const STATUS = {
  rising: "Building momentum", emerging: "Emerging", eligible: "Eligible, awaiting approval",
  approved: "Approved", "membership-required": "Activity met, Blue Badge membership needed", restricted: "Restricted"
};

export function renderCreatorScreen(view, ctx) {
  if (!TITLES[view]) view = "creator-center";
  const { shell, app, esc, navigate, back } = ctx;
  const my = ++token;
  const live = () => my === token && app.isConnected && app.querySelector(`[data-ct-view="${view}"]`);
  const toast = m => ctx.toast?.(m);
  let syncMessage = "";
  let archiveLimit = 20;
  let contentPage = 1;
  let contentEntries = [];
  let contentHasMore = false;
  let contentSort = "recent";
  let analyticsDays = 28;
  const body = html => shell(`<main class="ct-wrap" data-ct-view="${view}">
    <header class="ct-head"><button type="button" class="ct-icon" data-ct-back aria-label="Back">${icon("back")}</button><h1>Creator Center</h1><span></span></header>
     <nav class="ct-tabs" aria-label="Creator sections">${MAIN_SECTIONS.map(k => {
       const active = view === "creator-admin" ? false : (MAIN_SECTIONS.includes(view) ? view : "creator-tools") === k;
       return `<button type="button" data-ct-go="${k}" class="${active ? "on" : ""}" ${active ? 'aria-current="page"' : ""}>${esc(TITLES[k])}</button>`;
     }).join("")}${view === "creator-admin" ? `<button type="button" data-ct-go="creator-admin" class="on" aria-current="page">${esc(TITLES["creator-admin"])}</button>` : ""}</nav>
    <div id="ct-body">${html}</div></main>`, "light");
  const bind = () => {
    app.querySelector("[data-ct-back]")?.addEventListener("click", () => back());
    app.querySelectorAll("[data-ct-go]").forEach(b => b.onclick = () => navigate(b.dataset.ctGo));
  };
  const addAdminShortcut = dashboard => {
    if (dashboard?.isAdmin && !app.querySelector('[data-ct-go="creator-admin"]')) {
      app.querySelector(".ct-tabs")?.insertAdjacentHTML("beforeend", `<button type="button" data-ct-go="creator-admin">${esc(TITLES["creator-admin"])}</button>`);
      bind();
    }
  };
  const mount = html => { if (!live()) return false; app.querySelector("#ct-body").innerHTML = html; return true; };
  const fail = (e, retry) => {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const local = /sign in to an online/i.test(e?.message || "");
    const forbidden = e?.status === 403;
    if (forbidden && ["creator-center", "creator-content", "creator-analytics", "creator-tools"].includes(view)) {
      if (!mount(`<section class="ct-card ct-access-card" role="status" aria-labelledby="ct-access-title">
        <span class="ct-eyebrow">Creator tools</span>
        <h2 id="ct-access-title">Creator tools are not enabled for this account</h2>
        <p>Your profile, posts, follows, messages, and privacy settings stay the same if you change your account type.</p>
        <button type="button" class="ct-btn" data-ct-account-type>Review account type</button>
      </section>`)) return;
      app.querySelector("[data-ct-account-type]")?.addEventListener("click", () => navigate("account-type"));
      return;
    }
    const heading = local ? "Sign in to continue" : offline ? "You’re offline" : forbidden ? "Creator administrator access required" : "This section could not load";
    const text = local ? "Sign in to an online account to use creator features."
      : offline ? "Reconnect to the internet, then try again."
      : e?.message || "Please try again.";
    const showRetry = !local && !offline && !forbidden;
    if (!mount(`<section class="ct-card ct-error-card" role="alert"><span class="ct-eyebrow">${esc(TITLES[view])}</span><h2>${esc(heading)}</h2><p>${esc(text)}</p>
      <div class="ct-row">${showRetry ? '<button type="button" class="ct-btn" data-ct-retry>Try again</button>' : view !== "creator-center" ? '<button type="button" class="ct-btn ghost" data-ct-go="creator-center">Creator Center</button>' : ""}</div>
      </section>`)) return;
    app.querySelector("[data-ct-retry]")?.addEventListener("click", retry);
    bind();
  };
  body(`<div class="ct-skel"></div><div class="ct-skel"></div><div class="ct-skel"></div>`);
  bind();
  const load = () => {
    if (view === "creator-center") return center();
    if (view === "creator-content") return content();
    if (view === "creator-analytics") return analytics();
    if (view === "creator-tools") return tools();
    if (view === "blue-badge") return badge();
    if (view === "announcements") return announce();
    return admin();
  };

  async function center() {
    let d;
    try { d = await requestCloudApi("/api/creator/center"); } catch (e) { return fail(e, center); }
    if (!live()) return;
    addAdminShortcut(d);
    const reqs = Array.isArray(d.requirements) ? d.requirements : [];
    const s = d.stats || {};
    const pct = r => Math.max(0, Math.min(100, r.target ? (r.current / r.target) * 100 : r.met ? 100 : 0));
    const hist = Array.isArray(d.history) ? d.history : [];
    const miles = Array.isArray(d.milestones) ? d.milestones : [];
    const progress = Math.max(0, Math.min(100, Number(d.score) || 0));
    mount(`<section class="ct-card ct-overview">
      <div class="ct-overview-top"><div><span class="ct-eyebrow">Creator status</span><h2>${esc(d.level || "Creator")}</h2><p>${esc(STATUS[d.status] || "Status unavailable")}${d.approvedAt ? ` · since ${esc(fmtDate(d.approvedAt))}` : ""}</p></div>
        <span class="ct-status-chip">${esc(d.status === "approved" ? "Approved" : d.status === "restricted" ? "Restricted" : "In progress")}</span></div>
      <div class="ct-bar"><i style="width:${progress}%" role="progressbar" aria-label="Creator progress" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></i></div>
      <div class="ct-row"><span class="ct-note">Progress score</span><b>${esc(d.score)} / 100</b><button type="button" class="ct-btn" data-ct-eval>Refresh</button></div><div id="ct-evmsg" role="status"></div>
    </section>
    <section class="ct-card"><div class="ct-section-head"><h2>At a glance</h2><button type="button" class="ct-link" data-ct-go="creator-analytics">View analytics</button></div>
      <div class="ct-stats">${[["Original posts", s.originalPosts], ["Active days", s.activeDays], ["Engagement received", s.engagementReceived], ["Creators you engaged with", s.communityInteractions]].map(([label, value]) => `<div><b>${esc(value ?? "—")}</b><span>${esc(label)}</span></div>`).join("")}</div>
      <p class="ct-note">Counts use activity recorded by Oldtime. Historical device-only totals are not included.</p></section>
    <section class="ct-card"><div class="ct-section-head"><h2>Creator progress</h2><button type="button" class="ct-link" data-ct-go="creator-content">Your content</button></div>
      ${reqs.length ? reqs.map(r => `<div class="ct-req"><div><span>${esc(r.label)}</span><b>${esc(r.current)} / ${esc(r.target)}</b></div><div class="ct-bar"><i style="width:${pct(r)}%" role="progressbar" aria-label="${esc(r.label)}" aria-valuenow="${Math.round(pct(r))}" aria-valuemin="0" aria-valuemax="100"></i></div><small>${r.met ? "Complete" : "In progress"}</small></div>`).join("") : '<p class="ct-empty">Progress requirements are not available right now.</p>'}
      <p class="ct-note">Content and interactions are reviewed using the published program rules. Meeting a target does not guarantee approval.</p></section>
    <section class="ct-card"><h2>Milestones</h2>${miles.length ? `<ul class="ct-milestones">${miles.map(m => `<li><span class="${m.reached ? "reached" : ""}" aria-hidden="true">${m.reached ? "✓" : "·"}</span><span>${esc(m.title)}</span><b>${m.reached ? "Reached" : "In progress"}</b></li>`).join("")}</ul>` : '<p class="ct-empty">Milestones will appear as your account progresses.</p>'}</section>
    ${hist.length ? `<details class="ct-card ct-history"><summary>Recent status history</summary><ul>${hist.slice(0,5).map(h => `<li>${esc(fmtDate(h.at))}: ${esc(STATUS[h.status] || h.status)}${h.reason ? ` — ${esc(h.reason)}` : ""}</li>`).join("")}</ul></details>` : ""}`);
    bind();
    app.querySelector("[data-ct-eval]")?.addEventListener("click", async e => {
      if (evalBusy) return;
      const button = e.currentTarget;
      evalBusy = true; button.disabled = true;
      const msg = txt => { const n = app.querySelector("#ct-evmsg"); if (n && live()) n.innerHTML = `<div class="ct-msg">${esc(txt)}</div>`; };
      try { await requestCloudApi("/api/creator/evaluate", { method: "POST", body: {} }); evalBusy = false; if (live()) { toast("Evaluation refreshed"); center(); } }
      catch (err) { evalBusy = false; if (live()) { button.disabled = false; msg(err.status === 429 ? "Evaluation was refreshed recently. Try again later." : err.message); } }
    });
  }

  function analyticsUrl(days, page = 1, sort = contentSort) {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    return `/api/analytics/me?mode=creator&from=${start}&to=${end}&page=${page}&type=all&sort=${encodeURIComponent(sort)}`;
  }

  async function content(append = false) {
    if (!append) { contentPage = 1; contentEntries = []; }
    body(`<div class="ct-skel"></div><div class="ct-skel"></div>`);
    bind();
    let d, report, archive;
    try {
      [d, report, archive] = await Promise.all([
        requestCloudApi("/api/creator/center"),
        requestCloudApi(analyticsUrl(28, contentPage)),
        requestCloudApi("/api/creator/content"),
      ]);
    } catch (e) { return fail(e, () => content(append)); }
    if (!live()) return;
    addAdminShortcut(d);
    const newEntries = Array.isArray(report.content) ? report.content : [];
    contentEntries = append ? [...contentEntries, ...newEntries] : newEntries;
    contentHasMore = report.hasMore === true;
    const listed = contentEntries.map(item => {
      const engagement = [item.likes, item.comments, item.shares, item.saves].reduce((total, value) => total + (Number(value) || 0), 0);
      return `<article class="ct-content-item"><div class="ct-content-main"><span class="ct-kind">${esc(item.kind || "Post")}</span><h3>${esc(item.title || "Untitled content")}</h3><time>${esc(fmtDate(item.createdAt))}</time></div>
        <div class="ct-content-metrics"><span><b>${esc(item.views ?? 0)}</b> Views</span><span><b>${engagement}</b> interactions</span></div></article>`;
    }).join("");
    const breakdown = d.contentBreakdown || {};
    const synced = Array.isArray(archive.content) ? archive.content : [];
    mount(`<section class="ct-card"><div class="ct-section-head"><div><span class="ct-eyebrow">Content library</span><h2>Measured posts</h2></div><select class="ct-select" data-ct-content-sort aria-label="Sort content"><option value="recent" ${contentSort === "recent" ? "selected" : ""}>Recent</option><option value="views" ${contentSort === "views" ? "selected" : ""}>Most viewed</option><option value="engagement" ${contentSort === "engagement" ? "selected" : ""}>Most interactions</option></select></div>
      <p class="ct-note">Posts with online analytics tracking appear here. A zero means no qualifying activity was recorded for the selected period.</p>
      ${listed || '<p class="ct-empty">No posts are available to measure yet. Your content will appear when it has an online analytics record.</p>'}
      ${contentHasMore ? '<button type="button" class="ct-btn ghost ct-more-btn" data-ct-more>Show more</button>' : ""}</section>
      <section class="ct-card"><div class="ct-section-head"><div><span class="ct-eyebrow">Creator credit</span><h2>Originals archive</h2></div><button type="button" class="ct-btn" data-ct-sync>Sync originals</button></div>
       <p class="ct-note">This private archive records verified original posts for creator progress. It does not replace or publish your originals.</p>
       <div class="ct-stats ct-stats-compact">${[["Text", breakdown.text], ["Photos", breakdown.photos], ["Videos", breakdown.videos], ["Stories", breakdown.stories], ["Community", breakdown.communityPosts]].map(([label, value]) => `<div><b>${esc(value ?? 0)}</b><span>${esc(label)}</span></div>`).join("")}</div>
       <div id="ct-syncmsg" role="status">${esc(syncMessage)}</div>
       ${synced.length ? `<ul class="ct-original-list">${synced.slice(0,archiveLimit).map(c => {
         const original = api.post(c.sourceId) || api.db().stories.find(s => s.id === c.sourceId);
         return `<li><span>${esc((original?.caption || original?.text || original?.kind || "Original content").slice(0,90))}<small>${c.original ? "Original recorded" : "Known duplicate"}</small></span><button type="button" class="ct-link ct-danger" data-ct-remove="${esc(c.id)}">Remove</button></li>`;
       }).join("")}</ul>${synced.length > archiveLimit ? '<button type="button" class="ct-link" data-ct-archive-more>Show more originals</button>' : ""}` : '<p class="ct-empty">No originals have been synced yet.</p>'}
      </section>`);
    bind();
    app.querySelector("[data-ct-content-sort]")?.addEventListener("change", e => { contentSort = e.currentTarget.value; void content(); });
    app.querySelector("[data-ct-more]")?.addEventListener("click", () => { contentPage += 1; void content(true); });
    app.querySelector("[data-ct-archive-more]")?.addEventListener("click", () => { archiveLimit += 20; void content(); });
    app.querySelectorAll("[data-ct-remove]").forEach(button => button.onclick = async () => {
      button.disabled = true;
      try {
        const result = await requestCloudApi(`/api/creator/content/${encodeURIComponent(button.dataset.ctRemove)}`, { method: "DELETE" });
        syncMessage = result.cleanupPending ? "Credit removed. Private media deletion is queued for retry." : "Synced original and private media copies removed. Your original is unchanged.";
        if (live()) await content();
      } catch (error) { if (live()) { button.disabled = false; toast(error.message); } }
    });
    app.querySelector("[data-ct-sync]")?.addEventListener("click", async e => {
      const button = e.currentTarget; button.disabled = true;
      const say = message => { syncMessage = message; const node = app.querySelector("#ct-syncmsg"); if (node && live()) node.textContent = message; };
      try {
        const result = await syncCreatorOriginals(say);
        say(`${result.confirmed} synced; ${result.skipped} skipped; ${result.failed} not synced.${result.lastError ? ` ${result.lastError}` : ""}${result.remaining ? ` ${result.remaining} remaining for the next batch.` : ""}`);
        if (live()) await content();
      } catch (error) { say(error.message); }
      finally { if (live()) button.disabled = false; }
    });
  }

  async function analytics() {
    let dashboard, report;
    try {
      dashboard = await requestCloudApi("/api/creator/center");
      report = await requestCloudApi(analyticsUrl(analyticsDays));
    } catch (e) { return fail(e, analytics); }
    if (!live()) return;
    addAdminShortcut(dashboard);
    const o = report.overview || {};
    const number = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat().format(Number(value)) : "—";
    const percent = value => value === null || value === undefined ? "Not enough data" : `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(1)}%`;
    const interactions = (Number(o.likes) || 0) + (Number(o.comments) || 0) + (Number(o.shares) || 0) + (Number(o.saves) || 0);
    const trackedSince = report.trackingSince ? fmtDate(report.trackingSince) : "";
    mount(`<section class="ct-card"><div class="ct-section-head"><div><span class="ct-eyebrow">Online activity</span><h2>Performance</h2></div><select class="ct-select" data-ct-analytics-range aria-label="Analytics date range"><option value="7" ${analyticsDays === 7 ? "selected" : ""}>7 days</option><option value="28" ${analyticsDays === 28 ? "selected" : ""}>28 days</option><option value="90" ${analyticsDays === 90 ? "selected" : ""}>90 days</option></select></div>
      <div class="ct-stats ct-analytics-stats">${[
        ["Views", o.views, report.comparison?.views],
        ["Unique viewers", o.uniqueViewers, null],
        ["Profile visits", o.profileVisits, report.comparison?.profileVisits],
        ["New followers", o.newFollowers, report.comparison?.newFollowers],
        ["Interactions", interactions, report.comparison?.engagement],
        ["Total followers", o.totalFollowers, null],
      ].map(([label, value, change]) => `<div><b>${number(value)}</b><span>${esc(label)}</span>${change === null ? "" : `<small>${esc(percent(change))} vs previous period</small>`}</div>`).join("")}</div>
      <p class="ct-note">Activity recorded online${trackedSince ? ` since ${esc(trackedSince)}` : ""}. Device-only history is not included; visitor identities are private.</p></section>
      <section class="ct-card"><h2>Daily activity</h2>
       ${Array.isArray(report.series) && report.series.some(day => Number(day.views) + Number(day.engagement) + Number(day.follows) > 0)
         ? `<ul class="ct-daily-list">${report.series.slice(-7).reverse().map(day => `<li><time>${esc(fmtDate(day.day))}</time><span>${number(day.views)} views</span><span>${number(day.engagement)} interactions</span><span>${number(day.follows)} follows</span></li>`).join("")}</ul>`
         : '<p class="ct-empty">No tracked activity in this period yet.</p>'}</section>
      ${Array.isArray(report.growth) && report.growth.length ? `<section class="ct-card"><h2>What changed</h2>${report.growth.map(item => `<p>${esc(item.text)} <span class="ct-note">${esc(item.reason)}</span></p>`).join("")}</section>` : ""}
      <details class="ct-card ct-history"><summary>How these numbers are counted</summary><ul>${(report.unavailable || []).slice(0,3).map(item => `<li>${esc(item)}</li>`).join("")}</ul></details>`);
    bind();
    app.querySelector("[data-ct-analytics-range]")?.addEventListener("change", e => {
      analyticsDays = Number(e.currentTarget.value);
      void analytics();
    });
  }

  async function tools() {
    let dashboard;
    try { dashboard = await requestCloudApi("/api/creator/center"); } catch (e) { return fail(e, tools); }
    if (!live()) return;
    addAdminShortcut(dashboard);
    mount(`<section class="ct-card"><span class="ct-eyebrow">Account resources</span><h2>Creator tools</h2><p>Manage your creator activity and account resources from one place.</p>
      <button type="button" class="ct-tool-row" data-ct-go="creator-content"><span><b>Originals archive</b><small>Sync work for creator progress</small></span><span aria-hidden="true">›</span></button>
      <button type="button" class="ct-tool-row" data-ct-go="creator-analytics"><span><b>Analytics</b><small>View measured account activity</small></span><span aria-hidden="true">›</span></button>
      <button type="button" class="ct-tool-row" data-ct-go="announcements"><span><b>Announcements</b><small>Official Oldtime updates and preferences</small></span><span aria-hidden="true">›</span></button>
      <button type="button" class="ct-tool-row" data-ct-go="blue-badge"><span><b>Blue Badge</b><small>Check your badge status</small></span><span aria-hidden="true">›</span></button>
      ${dashboard.isAdmin ? '<button type="button" class="ct-tool-row" data-ct-go="creator-admin"><span><b>Program administration</b><small>Restricted account tools</small></span><span aria-hidden="true">›</span></button>' : ""}
    </section>`);
    bind();
  }

  async function badge() {
    const accountId = api.cloudAccountId() || api.me()?.cloudAccountId || api.me()?.id;
    if (hasPermanentBlueBadge(accountId)) {
      if (!live()) return;
      mount(`<section class="ct-card ct-badge-summary"><div><h2>Permanent Blue Badge</h2><p>This account’s badge is assigned directly by Oldtime. It does not require a subscription, payment, or renewal.</p></div></section>
        <section class="ct-card"><h2>Permanent access</h2><p>This badge is permanently active for this account. Other accounts use the regular Blue Badge membership rules.</p></section>`);
      bind();
      return;
    }
    let m;
    try { m = await requestCloudApi("/api/badge/membership"); } catch (e) { return fail(e, badge); }
    if (!live()) return;
    const st = ["none", "pending", "active", "canceled", "expired", "revoked", "billing-issue"].includes(m.status) ? m.status : (m.active ? "active" : "none");
    const on = m.active === true && (st === "active" || st === "canceled" || st === "billing-issue");
    const until = m.expiresAt ? fmtDate(m.expiresAt) : "";
    const store = m.store ? ` through ${esc(m.store)}` : "";
    const STATE = {
      none: ["Not a member", "You do not have a Blue Badge membership."],
      pending: ["Pending", "Awaiting store verification. No paid benefits are active until the store confirms your membership."],
      active: ["Active", `Verified${store}.${until ? ` Current period ends ${esc(until)}.` : ""}${m.autoRenews === true ? " Renews automatically." : m.autoRenews === false ? " Will not renew automatically." : ""}`],
      canceled: on ? ["Canceled, still active", `Your access continues until the verified expiration${until ? `, ${esc(until)}` : ""}. It will not renew.`] : ["Canceled", "Your membership was canceled and is no longer active."],
      expired: ["Expired", "Your membership has expired and is not active."],
      revoked: ["Revoked", "Your membership was revoked and is not active."],
      "billing-issue": on ? ["Billing issue", `The store reported a billing problem${until ? `. Access is verified until ${esc(until)}` : ""}. Update your payment method in your store account settings.`] : ["Billing issue", "The store reported a billing problem and your membership is not active. Update your payment method in your store account settings."]
    }[st];
    const d = m.distribution || {};
    const https = u => typeof u === "string" && /^https:\/\//i.test(u) ? u : null;
    const ios = https(d.iphoneUrl), and = https(d.androidUrl), opn = https(d.openUrl);
    const act = (url, label) => url ? `<a class="ct-btn ct-linkbtn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : `<button type="button" class="ct-btn" disabled>${esc(label)}</button>`;
    const terms = [`Planned standard price: ${money(m.standardPriceCents)} per month, billed monthly if subscriptions open.`];
    const ben = Array.isArray(m.benefits) ? m.benefits : [];
    mount(`<section class="ct-card ct-hero"><span class="ct-badge-art" aria-hidden="true">${tipIllustration("membership")}</span><div><h2>Blue Badge membership</h2><p>${on ? "Your membership is based on a verified store purchase." : "A membership badge and benefits for Oldtime members."}</p></div></section>
      <section class="ct-card"><h2>${esc(STATE[0])}</h2><span class="ct-eyebrow">Your membership</span><p>${STATE[1]}</p>
      ${m.creatorMembershipRequired ? "<p>Approved creators must maintain a valid Blue Badge membership.</p>" : ""}</section>
      <section class="ct-card"><h2>Subscription availability</h2>
      <p>Apple and Google subscription billing is not connected yet. You cannot start or restore a subscription from this page.</p>
      <p class="ct-note">No payment will be taken here. Before subscriptions open, Oldtime will show the final store price, renewal terms and cancellation steps.</p>
      ${(!ios || !and || !opn) ? '<p class="ct-note">One or more mobile app links are not published yet.</p>' : `<div class="ct-row">${act(ios, "Download for iPhone")}${act(and, "Get it on Android")}${act(opn, "Open Oldtime")}</div>`}
      <div class="ct-row"><button type="button" class="ct-btn ghost" data-ct-notify ${m.interested ? "disabled" : ""}>${m.interested ? "You will be notified" : "Notify me"}</button></div><div id="ct-nmsg" role="status"></div></section>
      <section class="ct-card"><h2>Pricing</h2><ul>${terms.map(t => `<li>${t}</li>`).join("")}</ul></section>
      <section class="ct-card"><h2>Gifts and offers</h2><p>Membership gifting and the planned 50% discount on the next two eligible monthly charges after a gift are not available yet. No gift or discount will be created until purchases can be verified.</p></section>
      <section class="ct-card"><h2>Restore purchases</h2><p>Purchase restoration will be available after Apple and Google billing is configured. Existing membership status is shown only when a purchase has been verified by the server.</p></section>
      <section class="ct-card"><h2>Benefits</h2>${ben.length ? `${ben.map(b => `<details class="ct-more"><summary><span>${esc(b)}</span><i aria-hidden="true">&rsaquo;</i></summary><p>${on ? "Listed as part of your membership. Some benefits are planned and may not be operating yet." : "Listed as a planned membership benefit. It is not available to you until a membership is verified by the store, and some benefits may not be operating yet."}</p></details>`).join("")}<p class="ct-note">Some benefits are planned and not all are operating yet.</p>` : "<p>Benefits will be listed here once confirmed.</p>"}</section>
      <section class="ct-card"><h2>Questions</h2>${[["How do I get a Blue Badge?", "Subscriptions are not open yet. When available, app-store purchases will be verified by Oldtime before a badge is activated."], ["What does it cost?", "The planned standard price is " + money(m.standardPriceCents) + " per month. The store will show the final price and renewal terms before purchase."], ["Can I restore a purchase?", "Restoration is not available until Apple and Google billing are configured."], ["How do I cancel?", 'Cancel an active subscription in your app store account settings. Access continues until its verified expiration. Manage subscriptions on <a href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noopener noreferrer">Apple</a> or <a href="https://play.google.com/store/account/subscriptions" target="_blank" rel="noopener noreferrer">Google Play</a>. These links open the store and do not start a purchase.']].map(([q, a]) => `<details class="ct-more"><summary><span>${q}</span><i aria-hidden="true">&rsaquo;</i></summary><p>${a}</p></details>`).join("")}</section>`);
    bind();
    app.querySelector("[data-ct-notify]")?.addEventListener("click", async e => {
      const b = e.currentTarget; b.disabled = true;
      try { await requestCloudApi("/api/badge/interest", { method: "POST", body: {} }); if (live()) { b.textContent = "You will be notified"; toast("We will let you know"); } }
      catch (err) { if (live()) { b.disabled = false; app.querySelector("#ct-nmsg").innerHTML = `<div class="ct-msg err">${esc(err.message)}</div>`; } }
    });
  }

  async function announce() {
    let a, p;
    try { [a, p] = await Promise.all([requestCloudApi("/api/announcements"), requestCloudApi("/api/announcement-preferences")]); } catch (e) { return fail(e, announce); }
    if (!live()) return;
    const list = Array.isArray(a.announcements) ? a.announcements : [];
    const labels = { features: "New features", promotions: "Offers and promotions", creators: "Creator updates", communities: "Community updates" };
    mount(`<section class="ct-card"><h2>Inbox</h2>${list.length ? `<p>${esc(a.unreadCount)} new announcement${a.unreadCount === 1 ? "" : "s"}.</p>` : '<p class="ct-empty">Nothing new right now. Announcements stay rare and are never shown while you are posting or on a call.</p>'}</section>
      ${list.map(x => `<article class="ct-card" data-ct-ann="${esc(x.id)}"><span class="ct-eyebrow">${esc(x.category)}</span><h2>${esc(x.title)}</h2><p>${esc(x.description)}</p>
      <div class="ct-row">${x.primaryRoute ? `<button type="button" class="ct-btn" data-ct-act="${esc(x.id)}">${esc(x.primaryLabel || "Open")}</button>` : ""}
      ${x.optional ? `<span><button type="button" class="ct-btn ghost" data-ct-dis="not-now" data-id="${esc(x.id)}">Not now</button> <button type="button" class="ct-btn ghost" data-ct-dis="never" data-id="${esc(x.id)}">Never show</button></span>` : ""}</div></article>`).join("")}
      <section class="ct-card"><h2>What you hear about</h2>${Object.keys(labels).map(k => `<label class="ct-toggle"><span>${labels[k]}</span><input type="checkbox" data-ct-pref="${k}" ${p[k] ? "checked" : ""}></label>`).join("")}
      <p class="ct-note">Choosing Not now pauses an announcement for a cooldown. Never show removes it permanently.</p>
      <button type="button" class="ct-btn ghost" data-ct-reset>Reset dismissed announcements</button><div id="ct-amsg" role="status"></div></section>`);
    bind();
    const say = (t, err) => { const n = app.querySelector("#ct-amsg"); if (n && live()) n.innerHTML = `<div class="ct-msg ${err ? "err" : ""}">${esc(t)}</div>`; };
    list.forEach(x => { if (!shownSet.has(x.id)) { shownSet.add(x.id); requestCloudApi(`/api/announcements/${encodeURIComponent(x.id)}/event`, { method: "POST", body: { event: "shown" } }).catch(() => shownSet.delete(x.id)); } });
    app.querySelectorAll("[data-ct-act]").forEach(b => b.onclick = async () => {
      const x = list.find(i => i.id === b.dataset.ctAct);
      try { await requestCloudApi(`/api/announcements/${encodeURIComponent(x.id)}/event`, { method: "POST", body: { event: "action" } }); } catch { /* navigation still proceeds */ }
      if (live()) navigate(x.primaryRoute);
    });
    app.querySelectorAll("[data-ct-dis]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await requestCloudApi(`/api/announcements/${encodeURIComponent(b.dataset.id)}/dismiss`, { method: "POST", body: { choice: b.dataset.ctDis } }); if (live()) { app.querySelector(`[data-ct-ann="${CSS.escape(b.dataset.id)}"]`)?.remove(); toast("Preference saved"); } }
      catch (e) { b.disabled = false; say(e.message, true); }
    });
    app.querySelectorAll("[data-ct-pref]").forEach(c => c.onchange = async () => {
      const controls = [...app.querySelectorAll("[data-ct-pref]")];
      controls.forEach(control => control.disabled = true);
      p = { ...p, [c.dataset.ctPref]: c.checked };
      try { p = await requestCloudApi("/api/announcement-preferences", { method: "PUT", body: { features: !!p.features, promotions: !!p.promotions, creators: !!p.creators, communities: !!p.communities } }); say("Preferences saved"); if (live()) await announce(); }
      catch (e) { c.checked = !c.checked; p = { ...p, [c.dataset.ctPref]: c.checked }; say(e.message, true); }
      finally { controls.forEach(control => control.disabled = false); }
    });
    app.querySelector("[data-ct-reset]").onclick = async () => {
      try { await requestCloudApi("/api/announcements/reset", { method: "POST", body: {} }); shownSet = new Set(); if (live()) announce(); }
      catch (e) { say(e.message, true); }
    };
  }

  async function admin() {
    let c, analytics;
    try { [c, analytics] = await Promise.all([requestCloudApi("/api/creator/admin/config"), requestCloudApi("/api/creator/admin/analytics")]); } catch (e) { return fail(e, admin); }
    if (!live()) return;
    mount(`<section class="ct-card"><h2>Program activity</h2><div class="ct-stats">${[["Evaluated accounts", analytics.evaluatedAccounts], ["Approved creators", analytics.approvedCreators], ["Badge interest", analytics.interestedAccounts], ["Active memberships", analytics.activeMemberships], ["Announcement views", analytics.announcementViews], ["Announcement actions", analytics.announcementActions]].map(([label, value]) => `<div><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join("")}</div><p class="ct-note">Views and actions are deduplicated per account, announcement and day. These totals do not include contact information.</p></section><section class="ct-card"><h2>Configuration</h2><p>Edit flags, thresholds, proposed prices, offer eligibility, published app links and campaigns as JSON. Set an openUrl only after native association files and device verification are complete. Changes are validated by the server. Billing and payouts cannot be enabled here.</p>
      <textarea class="ct-json" data-ct-json spellcheck="false" aria-label="Creator configuration JSON">${esc(JSON.stringify(c, null, 2))}</textarea>
      <div class="ct-row"><button type="button" class="ct-btn" data-ct-save>Save configuration</button><button type="button" class="ct-btn ghost" data-ct-reload>Discard changes</button></div><div id="ct-cmsg" role="status"></div></section>`);
    bind();
    const say = (t, err) => { const n = app.querySelector("#ct-cmsg"); if (n && live()) n.innerHTML = `<div class="ct-msg ${err ? "err" : ""}">${esc(t)}</div>`; };
    app.querySelector("[data-ct-reload]").onclick = admin;
    app.querySelector("[data-ct-save]").onclick = async e => {
      let parsed;
      try { parsed = JSON.parse(app.querySelector("[data-ct-json]").value); } catch (x) { return say(`Invalid JSON: ${x.message}`, true); }
      if (!parsed || typeof parsed !== "object" || !parsed.flags || !parsed.thresholds || !Array.isArray(parsed.campaigns)) return say("Config needs flags, thresholds and campaigns.", true);
      if ("billing" in parsed.flags || "payouts" in parsed.flags) return say("Billing and payout flags are not allowed.", true);
      const b = e.currentTarget; b.disabled = true;
      try { await requestCloudApi("/api/creator/admin/config", { method: "PUT", body: parsed }); if (live()) { say("Configuration saved."); toast("Configuration saved"); } }
      catch (x) { say(x.status === 403 ? "Admin access required." : x.message, true); }
      finally { b.disabled = false; }
    };
  }

  load();
}

export default renderCreatorScreen;
