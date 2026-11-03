import "./guide-library.css";
import {tipIllustration} from "./tip-illustrations.js";
import {INTERESTS,readInterests,saveInterests,resetInterests} from "./interests.js";
import {HELP_GUIDES,readHelpState,setHelpPaused} from "./help-prompts.js";
import {requestCloudApi} from "./store.js";

export function renderGuideLibrary(accountId,esc) {
  const state=readHelpState(accountId);
  return `<div class="guide-library">
    <p class="guide-intro">Quick guides for creating, connecting and keeping control.</p>
    ${["Get started","Connect","Privacy & control","Preferences"].map(section=>`<section class="guide-section"><h2>${esc(section)}</h2><div class="guide-grid">${HELP_GUIDES.filter(guide=>guide.section===section).map(guide=>`<button type="button" class="guide-item" data-open-guide="${guide.id}"><span class="guide-artwork" aria-hidden="true">${tipIllustration(guide.image)}</span><span class="guide-label">${esc(guide.title)}</span><span class="guide-chevron" aria-hidden="true">›</span></button>`).join("")}</div></section>`).join("")}
    <section class="guide-section guide-official-updates"><h2>Official updates</h2><p class="guide-intro">Announcements and feature notes published by Oldtime.</p><div id="guide-official-updates" role="status" aria-live="polite">Loading official updates…</div></section>
    <label class="guide-preferences"><span><b>Occasional tips</b><small>${state?"Your choices sync with your account.":"Tip preferences are loading or unavailable online."}</small></span><input type="checkbox" id="guide-tips-enabled" aria-label="Show occasional feature tips" ${state&&!state.paused?"checked":""} ${state?"":"disabled"} /></label>
     <div class="guide-preview-row"><span><b>Want to see a tip now?</b><small>This preview won't change your tip history or cooldown.</small></span><button type="button" class="cta-secondary" data-preview-tip="help-welcome">Preview a tip</button></div>
    ${interestSection(accountId,esc)}
  </div>`;
}
function interestSection(accountId,esc){
  const v=readInterests(accountId);
  if(!v)return `<section class="guide-section"><h2>Your interests</h2><p class="guide-intro">Interests couldn't be loaded from your account.</p></section>`;
  return `<section class="guide-section" aria-labelledby="gi-h"><h2 id="gi-h">Your interests</h2>
    <p class="guide-intro">Optional. Your choices sync with your account and shape which tips you see. Oldtime does not guess interests or use paid AI.</p>
    <label class="guide-preferences"><span><b>Use my interests</b><small>Turn off to ignore them.</small></span><input type="checkbox" id="guide-interests-enabled" aria-label="Use my interests for tips" ${v.enabled?"checked":""}></label>
    <div class="guide-chips" role="group" aria-label="Interests">${INTERESTS.map(i=>`<button type="button" class="guide-chip" data-interest="${esc(i)}" aria-pressed="${v.selected.includes(i)}">${esc(i)}</button>`).join("")}</div>
    <button type="button" class="cta-secondary guide-reset" id="guide-interests-reset">Reset interests</button></section>`;
}
export function bindGuideLibrary(app,{accountId,open,preview,toast,esc,openRoute}) {
  app.querySelectorAll("[data-open-guide]").forEach(button=>button.onclick=()=>open(button.dataset.openGuide));
  app.querySelector("[data-preview-tip]")?.addEventListener("click",event=>preview?.(event.currentTarget.dataset.previewTip));
  const updates=app.querySelector("#guide-official-updates");
  if(updates)void requestCloudApi("/api/announcements").then(result=>{
    if(!updates.isConnected)return;
    const items=(Array.isArray(result?.announcements)?result.announcements:[])
      .filter(item=>item&&item.title&&!["membership","returning","promo"].includes(item.category))
      .slice(0,8);
    updates.innerHTML=items.length?items.map(item=>`<article class="guide-update">
      <span>${esc(item.category||"Update")}</span><b>${esc(item.title)}</b>
      ${item.description?`<p>${esc(item.description)}</p>`:""}
      ${item.primaryRoute?`<button type="button" data-official-route="${esc(item.primaryRoute)}">${esc(item.primaryLabel||"Learn more")}</button>`:""}
    </article>`).join(""):`<p class="guide-intro">No current official updates.</p>`;
    updates.querySelectorAll("[data-official-route]").forEach(button=>
      button.addEventListener("click",()=>openRoute?.(button.dataset.officialRoute)));
  }).catch(()=>{
    if(updates.isConnected)updates.innerHTML='<p class="guide-intro">Official updates could not be loaded. Try again when you are back online.</p>';
  });
  const chips=[...app.querySelectorAll("[data-interest]")],en=app.querySelector("#guide-interests-enabled");
  const persist=async()=>{
    try{await saveInterests(accountId,{enabled:en.checked,selected:chips.filter(c=>c.getAttribute("aria-pressed")==="true").map(c=>c.dataset.interest)});return true;}
    catch(error){toast(error.message);return false;}
  };
  chips.forEach(c=>c.onclick=async()=>{const on=c.getAttribute("aria-pressed")!=="true";c.setAttribute("aria-pressed",String(on));if(!await persist())c.setAttribute("aria-pressed",String(!on));});
  if(en)en.onchange=async()=>{if(!await persist())en.checked=!en.checked;};
  const reset=app.querySelector("#guide-interests-reset");
  if(reset)reset.onclick=async()=>{try{await resetInterests(accountId);chips.forEach(c=>c.setAttribute("aria-pressed","false"));en.checked=true;toast("Interests reset");}catch(error){toast(error.message);}};
  const toggle=app.querySelector("#guide-tips-enabled");
  if(toggle)toggle.onchange=async()=>{
    try{await setHelpPaused(accountId,!toggle.checked);toast(toggle.checked?"Occasional tips enabled":"Occasional tips paused");}
    catch(error){toggle.checked=!toggle.checked;toast(error.message);}
  };
}
