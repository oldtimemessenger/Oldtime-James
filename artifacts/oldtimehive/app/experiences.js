import { helpScreen } from "./help-center.js";
import { tipIllustration } from "./tip-illustrations.js";
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const when = value => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const helpArticles = [
  { id: "privacy", title: "Choose who sees your posts", group: "Privacy", body: "Choose a public or private account. Private accounts limit posts to approved followers. Close Friends is a separate audience for stories.", link: "privacy", label: "Open privacy settings" },
  { id: "messages", title: "Set your chat privacy", group: "Messages", body: "Manage read receipts and last seen.", link: "chat", label: "Open chat privacy" },
  { id: "profile", title: "Make your profile yours", group: "Your account", body: "Update your birthday, city, profile cover, and interests. Choose whether your city and interests appear on your profile.", link: "edit-profile", label: "Edit your profile" },
  { id: "status", title: "About Account Status", group: "Your account", body: "Account Status lists facts Oldtime holds on this device, like your audience setting and blocked accounts, and marks checks that are not available. It does not say your account passed a review.", link: "help-account-status", label: "Open Account Status" },
  { id: "security", title: "Password and sign-in", group: "Your account", body: "Online accounts can change their password in Settings. Use a password you do not use elsewhere.", link: "password", label: "Change password" },
  { id: "data", title: "Your information", group: "Your account", body: "Review your profile, privacy controls, and data in Settings.", link: "privacy-center", label: "Privacy Center" }
];

const privacyArticles = [
  { id: "information", title: "Review your information", text: "Edit your details and profile visibility in Settings." },
  { id: "messaging", title: "Messages and privacy", text: "Messages are not end-to-end encrypted." },
  { id: "audience", title: "Choose your audience", text: "Public or private account settings control who can see your posts. Close Friends is a separate audience for stories. Review your audience before sharing personal details." },
  { id: "location", title: "Location and Nearby", text: "Nearby uses your location only when you choose to request it. Your exact location is not saved or shared. Browse by area without granting location access." }
];

export function extraScreen(view, env) {
  if (view.startsWith("campaign")) return extraScreen("help", env);
  const { api, me, db, navigate, toast, mutate: saveLocal } = env;
  const delegated = helpScreen(view, env);
  if (delegated) return delegated;
  const nav = (route, label, desc = "") => `<button type="button" class="listbtn exp-nav" data-exp-nav="${esc(route)}"><span><b>${label}</b>${desc ? `<small>${desc}</small>` : ""}</span><span aria-hidden="true">›</span></button>`;
  const article = (title, body, actions = "", artwork = title) => `<article class="exp-article"><div class="exp-illo" aria-hidden="true">${tipIllustration(artwork)}</div><h2>${esc(title)}</h2><p>${esc(body)}</p>${actions}</article>`;
  let title = "", content = "", bind = () => {};
  if (view === "campaigns") {
    const items = [...(db.campaigns || [])].sort((a, b) => b.updated - a.updated);
    title = "Campaigns";
    content = `<div class="exp-hero campaign-hero"><h2>Community Campaigns</h2><button class="btn exp-primary" id="campaign-new">Start a Campaign</button><p class="local-note">Donations unavailable.</p></div>
      <label class="exp-search"><span aria-hidden="true">⌕</span><input id="campaign-search" type="search" placeholder="Search campaigns" aria-label="Search campaigns"></label>
      <div id="campaign-list" class="campaign-list">${items.length ? items.map(c => campaignCard(c, me)).join("") : `<div class="exp-empty"><b>The first story starts here.</b><p>No campaigns yet. Share a cause and the kind of support that would make a difference.</p></div>`}</div>`;
    bind = () => {
      const list = $("#campaign-list");
      const draw = query => {
        const q = query.trim().toLowerCase();
        const filtered = [...(api.db().campaigns || [])].sort((a, b) => b.updated - a.updated).filter(c => !q || `${c.title} ${c.cause} ${c.needs}`.toLowerCase().includes(q));
        list.innerHTML = filtered.length ? filtered.map(c => campaignCard(c, api.me())).join("") : `<div class="exp-empty"><b>No matching campaigns</b><p>Try a different search.</p></div>`;
        list.querySelectorAll("[data-campaign-open]").forEach(button => button.onclick = () => navigate(`campaign:${button.dataset.campaignOpen}`));
      };
      $("#campaign-search").oninput = event => draw(event.currentTarget.value);
      $("#campaign-new").onclick = () => navigate("campaign-create");
      draw("");
    };
  } else if (view === "campaign-create" || view === "campaign-edit") {
    const editId = view === "campaign-edit" ? env.campaignId : null;
    const campaign = editId && (db.campaigns || []).find(item => item.id === editId);
    if (view === "campaign-edit" && (!campaign || campaign.owner !== me.id)) return extraScreen("campaigns", env);
    title = campaign ? "Edit Campaign" : "New Campaign";
    content = `<form class="exp-form" id="campaign-form">
      <label>Campaign name<input class="field" id="campaign-title" maxlength="90" required value="${esc(campaign?.title || "")}" placeholder="A clear, human title"></label>
      <label>About the cause<textarea class="field" id="campaign-cause" maxlength="700" required placeholder="What is happening, and why does it matter?">${esc(campaign?.cause || "")}</textarea></label>
      <label>What support is needed?<textarea class="field" id="campaign-needs" maxlength="500" required placeholder="Time, supplies, introductions, sharing a post…">${esc(campaign?.needs || "")}</textarea></label>
      ${!campaign ? `<label>First update<textarea class="field" id="campaign-update" maxlength="400" placeholder="A short note for your neighbors (optional)"></textarea></label>` : ""}
      <button class="btn exp-primary" type="submit">${campaign ? "Save changes" : "Publish Campaign"}</button></form>`;
    bind = () => $("#campaign-form").onsubmit = event => {
      event.preventDefault();
      const titleValue = $("#campaign-title").value.trim(), cause = $("#campaign-cause").value.trim(), needs = $("#campaign-needs").value.trim();
      if (!titleValue || !cause || !needs) return toast("Complete the name, cause, and support needed.");
      const now = Date.now();
      try {
        saveLocal(db2 => {
          db2.campaigns ||= [];
          if (campaign) {
            const target = db2.campaigns.find(item => item.id === campaign.id && item.owner === me.id);
            if (!target) throw new Error("This Campaign is no longer available.");
            Object.assign(target, { title: titleValue, cause, needs, updated: now });
          } else {
            const initial = $("#campaign-update").value.trim();
            db2.campaigns.unshift({ id: `cam-${now}`, owner: me.id, title: titleValue, cause, needs, created: now, updated: now, updates: initial ? [{ id: `up-${now}`, text: initial, created: now }] : [] });
          }
        });
        toast(campaign ? "Campaign updated" : "Campaign published"); navigate(campaign ? `campaign:${campaign.id}` : "campaigns");
      } catch (error) { toast(error.message || "Could not save Campaign"); }
    };
  } else if (view.startsWith("campaign:")) {
    const campaign = (db.campaigns || []).find(item => item.id === view.slice(9));
    if (!campaign) return extraScreen("campaigns", env);
    const owner = api.user(campaign.owner);
    title = "Campaign";
    const updates = [...(campaign.updates || [])].sort((a, b) => b.created - a.created);
    content = `<article class="campaign-detail"><div class="campaign-detail-top"><span class="eyebrow">Community Campaign</span></div><h2>${esc(campaign.title)}</h2><p class="campaign-byline">Started by ${esc(owner?.name || "Oldtime member")} · ${when(campaign.created)}</p><h3>About the cause</h3><p>${esc(campaign.cause)}</p><h3>What would help</h3><p>${esc(campaign.needs)}</p><aside class="local-note">Donations unavailable.</aside>
      ${campaign.owner === me.id ? `<div class="exp-actions"><button type="button" class="btn ghost" id="campaign-edit">Edit Campaign</button><button type="button" class="btn ghost exp-danger" id="campaign-delete">Delete</button></div><form id="campaign-update-form" class="exp-form compact"><label>Share an update<textarea class="field" id="campaign-update-text" maxlength="500" required placeholder="What has changed?"></textarea></label><button class="btn exp-primary" type="submit">Post update</button></form>` : ""}
      <section class="campaign-updates"><h3>Updates <span>${updates.length}</span></h3>${updates.length ? updates.map(update => `<div class="campaign-update"><time>${when(update.created)}</time><p>${esc(update.text)}</p></div>`).join("") : `<p class="sub">No updates yet. Check back for a note from the organizer.</p>`}</section></article>`;
    bind = () => {
      $("#campaign-edit") && ($("#campaign-edit").onclick = () => navigate("campaign-edit"));
      $("#campaign-delete") && ($("#campaign-delete").onclick = () => {
        if (!confirm("Delete this Campaign and its updates from this device?")) return;
        try { saveLocal(db2 => { db2.campaigns = db2.campaigns.filter(item => item.id !== campaign.id || item.owner !== me.id); }); }
        catch (error) { toast(error.message || "Could not delete Campaign"); return; }
        toast("Campaign deleted"); navigate("campaigns");
      });
      $("#campaign-update-form") && ($("#campaign-update-form").onsubmit = event => {
        event.preventDefault(); const text = $("#campaign-update-text").value.trim(); if (!text) return;
        try { saveLocal(db2 => { const target = db2.campaigns.find(item => item.id === campaign.id && item.owner === me.id); if (!target) throw new Error("This Campaign is no longer available."); target.updates ||= []; target.updates.unshift({ id: `up-${Date.now()}`, text, created: Date.now() }); target.updated = Date.now(); }); }
        catch (error) { toast(error.message || "Could not save update"); return; }
        navigate(`campaign:${campaign.id}`); toast("Update added");
      });
    };
  } else if (view === "help") {
    title = "Help & Support";
    content = `<div class="exp-hero help-hero"><div class="exp-illo" aria-hidden="true">${tipIllustration("welcome")}</div></div><label class="exp-search"><span aria-hidden="true">⌕</span><input type="search" id="help-search" placeholder="Search help articles" aria-label="Search help articles"></label><div id="help-results" class="help-results"></div><div class="exp-support-links">${nav("help-guide","Support guide","Find answers")}${nav("help-account-status","Account Status","Review your account")}${nav("help-report","Report a problem","Describe a problem")}${nav("help-reports","Saved reports","Review your reports")}${nav("privacy-center","Privacy Center","Manage your privacy and data.")}</div>`;
    bind = () => {
      const results = $("#help-results");
      results.addEventListener("click", event => {
        const button = event.target.closest("[data-exp-nav]");
        if (button) navigate(button.dataset.expNav);
      });
      const draw = query => {
        const q = query.trim().toLowerCase(), matches = helpArticles.filter(item => !q || `${item.title} ${item.group} ${item.body}`.toLowerCase().includes(q));
        results.innerHTML = matches.map(item => `<button type="button" class="help-result exp-nav" data-exp-nav="help-article-${esc(item.id)}"><span class="help-result-copy"><span class="eyebrow">${esc(item.group)}</span><b>${esc(item.title)}</b><small>${esc(item.body)}</small></span></button>`).join("") || `<div class="exp-empty"><b>No article found</b></div>`;
      };
      $("#help-search").oninput = event => draw(event.currentTarget.value); draw("");
    };
  } else if (view.startsWith("help-article-")) {
    const item = helpArticles.find(value => value.id === view.slice(13));
    if (!item) return extraScreen("help", env);
    title = "Help article";
    content = article(item.title, item.body, `<button class="btn exp-primary exp-nav" data-exp-nav="${esc(item.link)}">${esc(item.label)}</button>`);
  } else if (view === "privacy-center") {
    title = "Privacy Center";
    content = `<div class="exp-hero privacy-hero"><div class="exp-illo">${tipIllustration("privacy")}</div><h2>Privacy Center</h2></div><section class="exp-section"><h3>Privacy controls</h3>${nav("privacy","Account privacy")}${nav("close-friends","Close Friends")}${nav("chat","Chat privacy")}</section><section class="exp-section"><h3>Privacy topics</h3>${privacyArticles.map(item => `<button class="privacy-topic exp-nav" data-exp-nav="privacy-topic-${item.id}"><span class="privacy-topic-illo">${tipIllustration(`${item.id} ${item.title}`)}</span><span><b>${item.title}</b></span><span aria-hidden="true">›</span></button>`).join("")}</section>`;
  } else if (view === "sound-reuse") {
    title = "Sound reuse";
    let enabled = api.cloudAccountState()?.soundReuseEnabled !== false;
    const canSave = api.authMode() === "cloud";
    content = `<section class="exp-section sound-reuse-settings">
      <h3>Reuse your sounds</h3>
      <p>When on, people can reuse original audio and sounds you upload on eligible public video posts. Only share audio you own or have permission to share. Trending suggestions link to eligible creator posts and keep creator credit and permission settings; Oldtime does not offer a public music catalog.</p>
      <button type="button" class="listbtn" id="sound-reuse-toggle" role="switch" aria-checked="${enabled}" ${canSave ? "" : "disabled"}>
        <span><b>Allow reuse by default</b><small>Applies to eligible public video posts.</small></span>
        <strong id="sound-reuse-value">${enabled ? "On" : "Off"}</strong>
      </button>
      <p class="sub" id="sound-reuse-status" role="status">${canSave ? "Eligible public videos can be suggested with your profile credited. We do not store separate sound copies." : "Sign in to manage sound reuse."}</p>
    </section>`;
    bind = () => {
      const toggle = $("#sound-reuse-toggle");
      const value = $("#sound-reuse-value");
      const status = $("#sound-reuse-status");
      if (!toggle || !canSave) return;
      toggle.onclick = async () => {
        if (toggle.disabled) return;
        const next = !enabled;
        toggle.disabled = true;
        status.textContent = "Saving…";
        try {
          await api.updateCloudAccountState({ soundReuseEnabled: next });
          enabled = next;
          toggle.setAttribute("aria-checked", String(enabled));
          value.textContent = enabled ? "On" : "Off";
          status.textContent = enabled
            ? "Eligible public videos can be suggested with your profile credited. We do not store separate sound copies."
            : "People can no longer reuse your original sounds.";
          toast("Sound reuse settings saved.");
        } catch (failure) {
          status.textContent = failure.message || "Sound reuse settings could not be saved.";
          toast(status.textContent);
        } finally {
          toggle.disabled = false;
        }
      };
    };
  } else if (view.startsWith("privacy-topic-")) {
    const item = privacyArticles.find(value => value.id === view.slice(14));
    if (!item) return extraScreen("privacy-center", env);
    title = "Privacy topic";
    const actions = item.id === "messaging" ? `<button class="btn exp-primary exp-nav" data-exp-nav="chat">Review chat privacy</button>` : item.id === "audience" ? `<button class="btn exp-primary exp-nav" data-exp-nav="privacy">Review account privacy</button><button class="btn ghost exp-nav" data-exp-nav="close-friends">Manage Close Friends</button>` : item.id === "information" ? `<button class="btn exp-primary exp-nav" data-exp-nav="edit-profile">Review profile information</button>` : "";
    content = article(item.title, item.text, actions, item.id);
  }
  return { title, content, bind };
}

function campaignCard(campaign, me) {
  return `<button type="button" class="campaign-card" data-campaign-open="${esc(campaign.id)}"><span class="campaign-card-stamp">OT</span><span class="eyebrow">Community Campaign</span><b>${esc(campaign.title)}</b><span class="campaign-card-cause">${esc(campaign.cause)}</span><span class="campaign-card-footer"><span>${esc(apiName(campaign.owner, me))}</span><span>${(campaign.updates || []).length} ${(campaign.updates || []).length === 1 ? "update" : "updates"} · Details ›</span></span></button>`;
}
function apiName(id, me) { return id === me.id ? "Started by you" : "An Oldtime neighbor"; }
function $(selector) { return document.querySelector(selector); }
export const settingGroups = [
  { title: "Your experience", items: [
    ["Notifications", "Choose which updates reach you.", "notifications"]
  ]},
  { title: "Your audience", items: [
    ["Account privacy", "Choose public or private.", "privacy"],
    ["Sound reuse", "Choose whether others can reuse your sounds.", "sound-reuse"],
    ["Close Friends", "Choose who sees your stories.", "close-friends"],
    ["Blocked accounts", "Review people you have blocked.", "blocked"],
    ["Profile visibility", "Choose which details appear on your profile.", "profile-visibility"]
  ]},
  { title: "Messages and replies", items: [
    ["Chat privacy", "Set read receipts and last seen.", "chat"]
  ]}
];
