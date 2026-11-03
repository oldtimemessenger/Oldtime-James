import "./community-feeds.css";

const FEEDS = [
  ["following", "Following"], ["discover", "Discover"], ["popular", "Popular"],
  ["friends", "Mutuals / Friends"], ["media", "Photos & Video"],
];
const DEFAULT_PINS = ["following", "discover", "popular", "friends"];
const DEFAULTS = { hideReplies:false, hideReposts:false, hideQuotes:false, onlyFollowing:false, language:"all", includeUnlabelled:true };
const LANGUAGES = [["all","All languages"],["und","Unlabelled"],["en","English"],["es","Spanish"],["fr","French"],["ht","Haitian Creole"],["pt","Portuguese"],["ar","Arabic"],["hi","Hindi"],["zh","Chinese"],["ja","Japanese"]];
let owner="", active="discover", generation=0, dependencies, dialog=null;
let preferences, lists=[], mutedAccounts=[], settingsError="", settingsLoading=false;
let feed={posts:[],loading:false,error:"",hasMore:false,nextOffset:0,loadedAt:0,reason:null,caughtUpAt:null};
let relationshipKey="";
let deferredPaint=false;
let suggestions={people:[],loading:false,error:"",loadedAt:0};
const freshPreferences=()=>({pinned:[...DEFAULT_PINS],filters:{},mutedWords:[],mutedAccounts:[],caughtUp:{}});
const label=id=>FEEDS.find(([key])=>key===id)?.[1] || lists.find(list=>`list:${list.id}`===id)?.name || "Curated list";
const e=value=>dependencies.esc(String(value??""));
const ic=name=>dependencies.icon(name);
async function request(path,options) {
  const account=owner,result=await dependencies.requestCloudApi(`/api/community/${path}`,options);
  if(account!==owner)throw new Error("Your account changed. Open Community again.");
  return result;
}
const editable=source=>({pinned:source.pinned,filters:source.filters,mutedWords:source.mutedWords,mutedAccounts:source.mutedAccounts});
const repaint=()=>{
  if(!dependencies.isActive())return;
  if(dialog?.open){deferredPaint=true;return;}
  deferredPaint=false;dependencies.refresh();
};
const errorMessage=error=>error?.message || "This action couldn’t be completed. Try again.";
const feedCache=new Map();
function invalidateFeeds(){
  generation++;feedCache.clear();
  feed={...feed,posts:[],loading:false,error:"",loadedAt:0,hasMore:false};
}
let restoreScroll=0;

function reset(next) {
  closeDialog();owner=next;active="discover";generation++;preferences=freshPreferences();lists=[];mutedAccounts=[];
  feed={posts:[],loading:false,error:"",hasMore:false,nextOffset:0,loadedAt:0,reason:null,caughtUpAt:null};
  settingsError="";settingsLoading=false;relationshipKey="";feedCache.clear();restoreScroll=0;
  suggestions={people:[],loading:false,error:"",loadedAt:0};
}
async function loadSuggestions(){
  if(suggestions.loading)return;
  const account=owner;suggestions.loading=true;
  try{
    const result=await dependencies.requestCloudApi("/api/discovery/people?limit=12");
    if(account!==owner)return;
    if(!Array.isArray(result.suggestions))throw new Error("Account suggestions returned an incomplete response.");
    suggestions.people=result.suggestions; suggestions.error=""; suggestions.loadedAt=Date.now();
  }catch(error){if(account===owner){suggestions.error=errorMessage(error);suggestions.loadedAt=Date.now();}}
  finally{if(account===owner){suggestions.loading=false;repaint();}}
}
const sharesInterests=suggestion=>[suggestion.sharedInterests,suggestion.matchingInterests].some(value=>Array.isArray(value)&&value.length>0);
function suggestedPeopleMarkup(items,title="People you may like"){
  if(!items.length)return "";
  return `<section class="cf-suggestions" aria-label="${e(title)}"><header><h2>${e(title)}</h2><button data-cf-search>Find more</button></header><div class="cf-people-rail">${items.map(suggestion=>{
    const person=suggestion.profile||suggestion.person||suggestion;
    const name=person.displayName||person.name||person.username||"Member";
    const reason=sharesInterests(suggestion)?"Shared interests":suggestion.reason==="mutual-followers"?"Connected through people you follow":"Suggested public account";
    const avatar=person.avatar||person.avatarReference||person.avatarUrl||"";
    const source=String(avatar).startsWith("oldtime-media:")?`data-local-media="${e(avatar)}"`:`src="${e(avatar)}"`;
    return `<article><button class="cf-person" data-cf-profile="${e(person.id)}"><span class="cf-person-avatar">${avatar?`<img ${source} alt="${e(name)}" width="56" height="56" loading="lazy" decoding="async">`:ic("user")}</span><b>${e(name)}</b><small>@${e(person.username)}</small></button><p>${e(reason)}</p><div class="cf-person-actions"><button class="cf-view-profile" data-cf-profile="${e(person.id)}">View profile</button><button class="cf-follow" data-cf-follow="${e(person.id)}">Follow</button></div></article>`;
  }).join("")}</div></section>`;
}
async function loadSettings() {
  if(settingsLoading)return;
  settingsLoading=true;const account=owner;
  try{
    const [settings,catalog]=await Promise.all([request("preferences"),request("lists")]);
    if(owner!==account)return;
    preferences=settings.preferences;mutedAccounts=settings.mutedAccounts||[];lists=catalog.lists||[];settingsError="";
    invalidateFeeds();
  }catch(error){
    if(owner===account){
      settingsError="Couldn't load your feed controls. Try again.";
    }
  }
  finally{if(owner===account){settingsLoading=false;repaint();}}
}
async function loadFeed(append=false) {
  if(feed.loading)return;
  const account=owner,selected=active,sequence=++generation;
  feed.loading=true;feed.error="";
  try{
    const result=await request(`feed?feed=${encodeURIComponent(selected)}&limit=20&offset=${append?feed.nextOffset:0}`);
    if(account!==owner||selected!==active||sequence!==generation)return;
    if(!Array.isArray(result.posts)||!Number.isSafeInteger(result.nextOffset))throw new Error("The server returned an incomplete feed.");
    const posts=dependencies.api.cacheCloudExplorePosts(result.posts),seen=new Set(append?feed.posts.map(p=>p.id):[]);
    feed.posts=(append?feed.posts:[]).concat(posts.filter(p=>!seen.has(p.id)&&seen.add(p.id)));
    feed.hasMore=result.hasMore===true;feed.nextOffset=result.nextOffset;feed.loadedAt=Date.now();
    feed.reason=result.reason;feed.reasons={...(append?feed.reasons:{}),...(result.reasons||{})};feed.caughtUpAt=result.caughtUpAt;
   }catch(error){if(sequence===generation)feed.error="Couldn't load posts.";}
  finally{if(sequence===generation){feed.loading=false;repaint();}}
}
function selectFeed(id) {
  const scroller=dependencies.app.querySelector(".stories-feed-scroll");
  feedCache.set(active,{...feed,loading:false,scrollTop:scroller?.scrollTop||0});
  active=id;generation++;
  const cached=feedCache.get(id);
  feed=cached?{...cached,loading:false}:{posts:[],loading:false,error:"",hasMore:false,nextOffset:0,loadedAt:0,reason:null,caughtUpAt:null};
  restoreScroll=cached?.scrollTop||0;
  repaint();
  requestAnimationFrame(()=>{const target=dependencies.app.querySelector(".stories-feed-scroll");if(target)target.scrollTop=restoreScroll;});
}
async function save(next) {
  const account=owner,result=await request("preferences",{method:"PUT",body:editable(next)});
  if(account!==owner)throw new Error("Your account changed. Open these controls again.");
  preferences=result.preferences;generation++;feedCache.clear();
  feed={posts:[],loading:false,error:"",hasMore:false,nextOffset:0,loadedAt:0,reason:null,caughtUpAt:preferences.caughtUp?.[active]||null};
}
function closeDialog() {
  if(dialog){
    const old=dialog;dialog=null;old.close();old.remove();
    if(deferredPaint)queueMicrotask(repaint);
  }
}
function openDialog(title,body,bind) {
  closeDialog();const returnTo=document.activeElement;
  dialog=document.createElement("dialog");dialog.className="cf-dialog";
  dialog.innerHTML=`<header><h2>${e(title)}</h2><button type="button" data-cf-close aria-label="Close">${ic("close")}</button></header><div class="cf-dialog-body">${body}</div><p class="cf-form-error" role="alert"></p>`;
  document.body.append(dialog);dialog.querySelector("[data-cf-close]").onclick=closeDialog;
  const current=dialog;
  current.addEventListener("close",()=>{
    if(dialog===current)dialog=null;
    current.remove();
    if(!dialog?.open&&returnTo?.isConnected)returnTo.focus({preventScroll:true});
    if(deferredPaint)repaint();
  });
  dialog.showModal();bind?.(dialog);
}
function failInDialog(error) { if(dialog)dialog.querySelector(".cf-form-error").textContent=errorMessage(error); }
function pending(button,action) {
  button.disabled=true;
  return Promise.resolve().then(action).catch(failInDialog).finally(()=>{if(button.isConnected)button.disabled=false;});
}
function settingsMenu() {
  openDialog("Community controls",`<p>Your settings are private and saved to your account. They change Community only.</p>
    <div class="cf-menu">
      <button data-cf-menu="pins">${ic("menu")}<span>Pinned feeds<small>Choose and reorder your feeds</small></span></button>
      <button data-cf-menu="filter">${ic("settings")}<span>${e(label(active))} preferences<small>Replies, reposts, languages and following</small></span></button>
      <button data-cf-menu="mutes">${ic("mute")}<span>Muted words and accounts<small>Hide content without notifying anyone</small></span></button>
      <button data-cf-menu="lists">${ic("users")}<span>Curated lists<small>Create, follow, edit and pin a list feed</small></span></button>
      <button data-cf-menu="language">${ic("document")}<span>Label your post language<small>Help other people use language filters</small></span></button>
    </div>`,root=>{
      root.querySelectorAll("[data-cf-menu]").forEach(button=>button.onclick=()=>({
        pins:pinSettings,filter:filterSettings,mutes:muteSettings,lists:listSettings,language:languageSettings,
      })[button.dataset.cfMenu]());
    });
}
function pinSettings() {
  let order=[...preferences.pinned];
  const options=[...FEEDS.map(([id,name])=>({id,name})),...lists.filter(l=>l.owned||l.followed).map(l=>({id:`list:${l.id}`,name:l.name}))];
  function paint(){
    const markup=`<p>Use the arrows to reorder. At least one feed must stay pinned.</p>
      <div class="cf-pin-list">${order.map((id,index)=>`<div><b>${e(label(id))}</b>
        <button data-cf-up="${index}" ${index===0?"disabled":""} aria-label="Move ${e(label(id))} earlier">${ic("up")}</button>
        <button data-cf-down="${index}" ${index===order.length-1?"disabled":""} aria-label="Move ${e(label(id))} later">${ic("down")}</button>
        <button data-cf-unpin="${index}" ${order.length===1?"disabled":""} aria-label="Unpin ${e(label(id))}">${ic("close")}</button></div>`).join("")}</div>
      <div class="cf-menu">${options.filter(item=>!order.includes(item.id)).map(item=>`<button data-cf-pin="${e(item.id)}">${ic("plus")}<span>${e(item.name)}</span></button>`).join("")}</div>
      <button class="cf-primary" data-cf-save-pins>Save pinned feeds</button>`;
    const bind=root=>{
      root.querySelectorAll("[data-cf-up]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.cfUp);[order[i-1],order[i]]=[order[i],order[i-1]];paint();root.querySelector(`[data-cf-down="${i-1}"]`)?.focus({preventScroll:true});});
      root.querySelectorAll("[data-cf-down]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.cfDown);[order[i],order[i+1]]=[order[i+1],order[i]];paint();root.querySelector(`[data-cf-up="${i+1}"]`)?.focus({preventScroll:true});});
      root.querySelectorAll("[data-cf-unpin]").forEach(b=>b.onclick=()=>{order.splice(Number(b.dataset.cfUnpin),1);paint();});
      root.querySelectorAll("[data-cf-pin]").forEach(b=>b.onclick=()=>{order.push(b.dataset.cfPin);paint();});
      root.querySelector("[data-cf-save-pins]").onclick=event=>pending(event.currentTarget,async()=>{
        await save({...preferences,pinned:order});closeDialog();if(!order.includes(active))selectFeed(order[0]);else repaint();
      });
    };
    if(dialog?.dataset.cfPins==="true"){
      const scroll=dialog.scrollTop;dialog.querySelector(".cf-dialog-body").innerHTML=markup;bind(dialog);dialog.scrollTop=scroll;
    }else{
      openDialog("Pinned Community feeds",markup,bind);dialog.dataset.cfPins="true";
    }
  }paint();
}
function filterSettings() {
  const selected=active,filter={...DEFAULTS,...preferences.filters[selected]};
  openDialog(`${label(selected)} preferences`,`<form id="cf-filter-form">
    <p>Only this feed changes. Following is always chronological, with no recommended posts.</p>
    ${[["hideReplies","Hide replies"],["hideReposts","Hide reposts"],["hideQuotes","Hide quote posts"],["onlyFollowing","Only people I follow"]].map(([key,text])=>
      `<label class="cf-toggle"><span>${text}</span><input type="checkbox" name="${key}" ${filter[key]?"checked":""}></label>`).join("")}
    <p class="cf-note">Replies remain inside conversations. Quote-post filtering applies to posts labelled as quotes.</p>
    <label class="cf-field">Language<select name="language">${LANGUAGES.map(([id,name])=>`<option value="${id}" ${filter.language===id?"selected":""}>${name}</option>`).join("")}</select></label>
    <label class="cf-toggle"><span>Include unlabelled posts</span><input type="checkbox" name="includeUnlabelled" ${filter.includeUnlabelled?"checked":""}></label>
    <p class="cf-note">Language labels come from creators. We do not guess language from images or audio.</p>
    <button type="submit" class="cf-primary">Save preferences</button></form>`,root=>{
    root.querySelector("form").onsubmit=event=>{
      event.preventDefault();const form=event.currentTarget;
      void pending(form.querySelector("button[type=submit]"),async()=>{
        const value={language:form.elements.language.value};
        for(const key of ["hideReplies","hideReposts","hideQuotes","onlyFollowing","includeUnlabelled"])value[key]=form.elements[key].checked;
        await save({...preferences,filters:{...preferences.filters,[selected]:value}});
        closeDialog();generation++;feed.loading=false;void loadFeed();repaint();
      });
    };
  });
}
function accountPicker(root,selected,onChange) {
  const input=root.querySelector("[data-cf-account-query]"),results=root.querySelector("[data-cf-account-results]");
  let timer,sequence=0;
  input.oninput=()=>{
    clearTimeout(timer);const query=input.value.trim(),id=++sequence;
    if(query.length<2){results.replaceChildren();return;}
    timer=setTimeout(async()=>{
      try{
        const result=await dependencies.requestCloudApi(`/api/users/search?q=${encodeURIComponent(query)}`);
        if(!root.isConnected||id!==sequence)return;
        const users=(result.users||[]).filter(user=>user.id!==owner&&!selected.some(item=>item.id===user.id));
        results.innerHTML=users.slice(0,8).map(user=>`<button type="button" data-cf-pick="${e(user.id)}"><span>${e(user.displayName||user.username)}<small>@${e(user.username)}</small></span>${ic("plus")}</button>`).join("")||"<p>No matching accounts.</p>";
        results.querySelectorAll("[data-cf-pick]").forEach(button=>button.onclick=()=>{
          const user=users.find(item=>item.id===button.dataset.cfPick);selected.push(user);input.value="";results.replaceChildren();onChange();
        });
      }catch(error){if(id===sequence&&root.isConnected)results.textContent=errorMessage(error);}
    },250);
  };
}
const pickerMarkup=`<label class="cf-field">Find an account<input type="search" data-cf-account-query placeholder="Search name or username" autocomplete="off"></label><div class="cf-menu" data-cf-account-results></div>`;
function muteSettings() {
  const selected=preferences.mutedAccounts.map(id=>mutedAccounts.find(a=>a.id===id)||dependencies.api.user(id)||{id,username:"Muted account"});
  openDialog("Muted words and accounts",`<form id="cf-mutes">
    <label class="cf-field">Muted words or phrases<textarea name="words" rows="4" placeholder="One word or phrase per line">${e(preferences.mutedWords.join("\n"))}</textarea></label>
    <p class="cf-note">Matches hide Community posts containing the phrase. Muting is private, and does not unfollow or block an account.</p>
    ${pickerMarkup}<div class="cf-selected" data-cf-selected></div>
    <button type="submit" class="cf-primary">Save mutes</button></form>`,root=>{
    const paint=()=>{
      root.querySelector("[data-cf-selected]").innerHTML=selected.map(user=>`<button type="button" data-cf-remove="${e(user.id)}">@${e(user.username)} ${ic("close")}</button>`).join("");
      root.querySelectorAll("[data-cf-remove]").forEach(b=>b.onclick=()=>{selected.splice(selected.findIndex(u=>u.id===b.dataset.cfRemove),1);paint();});
    };paint();accountPicker(root,selected,paint);
    root.querySelector("form").onsubmit=event=>{
      event.preventDefault();const form=event.currentTarget;
      void pending(form.querySelector("button[type=submit]"),async()=>{
        const words=[...new Set(form.elements.words.value.split("\n").map(s=>s.trim()).filter(Boolean))];
        await save({...preferences,mutedWords:words,mutedAccounts:selected.map(u=>u.id)});
        mutedAccounts=selected;closeDialog();generation++;feed.loading=false;void loadFeed();repaint();
      });
    };
  });
}
function listSettings() {
  openDialog("Curated lists",`<p>Follow a public list without following every member. Lists never change anyone’s post visibility.</p>
    <form class="cf-search" data-cf-list-search><input type="search" name="q" placeholder="Find public lists" aria-label="Find public lists"><button>${ic("search")}</button></form>
    <button class="cf-primary" data-cf-create-list>Create a list</button><div data-cf-list-results></div>`,root=>{
    root.querySelector("[data-cf-create-list]").onclick=()=>editList(null);
    const paint=items=>{
      root.querySelector("[data-cf-list-results]").innerHTML=items.map(list=>`<article class="cf-list-card">
        <h3>${e(list.name)}</h3><p>${e(list.description)}</p><small>${list.isPublic?"Public":"Private"} · ${list.members.length} visible members</small>
        <div>${list.owned?`<button data-cf-edit-list="${e(list.id)}">Edit</button>`:
          `<button data-cf-follow-list="${e(list.id)}">${list.followed?"Unfollow list":"Follow list"}</button>`}
        <button data-cf-pin-list="${e(list.id)}">${preferences.pinned.includes(`list:${list.id}`)?"Open feed":"Pin as feed"}</button></div></article>`).join("")||"<p>No lists yet. Create one or search for a public list.</p>";
      root.querySelectorAll("[data-cf-edit-list]").forEach(b=>b.onclick=()=>editList(items.find(l=>l.id===b.dataset.cfEditList)));
      root.querySelectorAll("[data-cf-follow-list]").forEach(b=>b.onclick=()=>pending(b,async()=>{
        const list=items.find(l=>l.id===b.dataset.cfFollowList);
        await request(`lists/${list.id}/follow`,{method:list.followed?"DELETE":"PUT"});
        list.followed=!list.followed;lists=Array.from(new Map([...lists,...items].map(l=>[l.id,l])).values());paint(items);
      }));
      root.querySelectorAll("[data-cf-pin-list]").forEach(b=>b.onclick=()=>pending(b,async()=>{
        const list=items.find(l=>l.id===b.dataset.cfPinList),id=`list:${list.id}`;
        if(!preferences.pinned.includes(id))await save({...preferences,pinned:[...preferences.pinned,id]});
        lists=Array.from(new Map([...lists,list].map(l=>[l.id,l])).values());closeDialog();selectFeed(id);
      }));
    };paint(lists);
    root.querySelector("form").onsubmit=event=>{
      event.preventDefault();const form=event.currentTarget;
      void pending(form.querySelector("button"),async()=>{const result=await request(`lists?q=${encodeURIComponent(form.elements.q.value.trim())}`);if(root.isConnected)paint(result.lists||[]);});
    };
  });
}
function editList(list) {
  const selected=[...(list?.members||[])];
  openDialog(list?"Edit list":"Create a list",`<form id="cf-list-editor">
    <label class="cf-field">Name<input name="name" maxlength="60" value="${e(list?.name)}" required></label>
    <label class="cf-field">Description<textarea name="description" maxlength="400">${e(list?.description)}</textarea></label>
    <label class="cf-toggle"><span>Public list</span><input type="checkbox" name="public" ${list?.isPublic?"checked":""}></label>
    <p class="cf-note">Public lists can be found and followed. Private lists are only available to you.</p>
    ${pickerMarkup}<div class="cf-selected" data-cf-selected></div><button type="submit" class="cf-primary">Save list</button>
    ${list?'<button type="button" class="cf-danger" data-cf-delete-list>Delete list</button>':""}</form>`,root=>{
    const paint=()=>{
      root.querySelector("[data-cf-selected]").innerHTML=selected.map(user=>`<button type="button" data-cf-remove="${e(user.id)}">@${e(user.username)} ${ic("close")}</button>`).join("");
      root.querySelectorAll("[data-cf-remove]").forEach(b=>b.onclick=()=>{selected.splice(selected.findIndex(u=>u.id===b.dataset.cfRemove),1);paint();});
    };paint();accountPicker(root,selected,paint);
    root.querySelector("form").onsubmit=event=>{
      event.preventDefault();const form=event.currentTarget;
      void pending(form.querySelector("button[type=submit]"),async()=>{
        const result=await request(list?`lists/${list.id}`:"lists",{method:list?"PUT":"POST",body:{
          name:form.elements.name.value.trim(),description:form.elements.description.value.trim(),
          isPublic:form.elements.public.checked,members:selected.map(u=>u.id),
        }});
        lists=[result.list,...lists.filter(l=>l.id!==result.list.id)];feed.loadedAt=0;listSettings();
      });
    };
    root.querySelector("[data-cf-delete-list]")?.addEventListener("click",event=>{
      if(!window.confirm("Delete this list? The members’ accounts and posts will not be deleted."))return;
      void pending(event.currentTarget,async()=>{
        await request(`lists/${list.id}`,{method:"DELETE"});lists=lists.filter(l=>l.id!==list.id);
        const pinned=preferences.pinned.filter(id=>id!==`list:${list.id}`);
        await save({...preferences,pinned:pinned.length?pinned:["following"]});
        if(active===`list:${list.id}`)selectFeed("following");listSettings();
      });
    });
  });
}
function languageSettings() {
  const own=feed.posts.filter(post=>(typeof post.author==="string"?post.author:post.author?.id)===dependencies.api.me()?.id);
  openDialog("Label your post language",`<p>Labels are optional and change filtering only, not the published content. Choose one of your posts on this page.</p>
    ${own.length?`<form><label class="cf-field">Your post<select name="post">${own.map(post=>`<option value="${e(post.id)}">${e((post.text||"Photo or video post").slice(0,70))}</option>`).join("")}</select></label>
    <label class="cf-field">Language<select name="language">${LANGUAGES.filter(([id])=>id!=="all").map(([id,name])=>`<option value="${id}">${name}</option>`).join("")}</select></label>
    <button class="cf-primary" type="submit">Save language label</button></form>`:"<p>Open a feed containing your Community posts, then return here.</p>"}`,root=>{
    root.querySelector("form")?.addEventListener("submit",event=>{
      event.preventDefault();const form=event.currentTarget;
      void pending(form.querySelector("button"),async()=>{
        await request(`posts/${encodeURIComponent(form.elements.post.value)}/language`,{method:"PUT",body:{language:form.elements.language.value}});
        feed.loadedAt=0;closeDialog();void loadFeed();repaint();
      });
    });
  });
}
export function renderCommunityFeeds(deps) {
  dependencies=deps;
  const id=deps.api.cloudAccountId()||"";
  if(owner!==id){reset(id);if(id)void loadSettings();}
  if(!id)return;
  const me=deps.api.me(),relationships=JSON.stringify([me?.following,me?.friends,deps.api.db()?.blocks]);
  if(relationshipKey!==relationships){relationshipKey=relationships;invalidateFeeds();}
  if(!settingsLoading&&!feed.loading&&!feed.error&&Date.now()-feed.loadedAt>30000)void loadFeed();
  const recommended=["discover","popular","media"].includes(active)&&!settingsLoading&&!settingsError&&!preferences.filters?.[active]?.onlyFollowing;
  if(recommended&&!suggestions.loading&&Date.now()-suggestions.loadedAt>60000)void loadSuggestions();
  const people=recommended?suggestions.people.filter(suggestion=>{
    const person=suggestion.profile||suggestion.person||suggestion,id=person.id;
    return id&&id!==owner&&id!==me?.id&&!me?.following?.includes(id)&&!preferences.mutedAccounts.includes(id)&&!deps.api.blocked(me.id,id);
  }):[];
  const sharedInterestPeople=people.filter(sharesInterests);
  const otherPeople=people.filter(person=>!sharesInterests(person));
  const description=active==="following"?"Chronological posts and optional reposts from people you follow. No recommendations.":
    active==="discover"?"Public Community posts from people you don’t follow, ranked by your interests, engagement and recency. Your filters always apply.":
    active==="popular"?"Community posts from the past 7 days, ordered by likes, comments and reposts.":
    active==="friends"?"Posts from your mutual follows and accepted friends, newest first.":
    active==="media"?"Community photo and video posts, newest first.":"Posts from this list’s members, newest first.";
  const posts=feed.posts.map(post=>deps.api.cloudPost(post.id)).filter(Boolean);
  const stamp=feed.caughtUpAt, newer=stamp?posts.filter(post=>Number(post.createdAt)>stamp).length:0;
  deps.shell(`<section class="screen on community-screen cf-screen" aria-label="Community" data-scroll-context="community:${e(active)}">
    <div class="stories-feed-scroll" data-scroll-preserve="community-feed">
      <header class="community-header"><h1>Community</h1><div class="community-header-actions">
        <button class="community-search-button" data-cf-search aria-label="Search">${ic("search")}</button>
        <button type="button" class="community-new-post compose-trigger" data-cf-compose aria-label="New post">${ic("plus")}</button></div></header>
      <div class="cf-feed-header"><nav class="cf-feed-tabs" aria-label="Pinned Community feeds">${preferences.pinned.map(id=>`<button type="button" data-cf-feed="${e(id)}" aria-current="${active===id?"page":"false"}">${e(label(id))}</button>`).join("")}</nav>
      <button class="cf-controls" data-cf-controls aria-label="Community feed controls">${ic("settings")}</button></div>
      ${stamp?`<div class="cf-caught-up">${ic("check")}<span>${newer?`${newer} newer ${newer===1?"post":"posts"} on this page`:"You’re caught up on this page"}</span></div>`:""}
      ${suggestedPeopleMarkup(otherPeople.slice(0,6))}
      ${recommended&&suggestions.error?`<div class="cf-suggestion-error" role="status">People suggestions couldn’t load. <button data-cf-people-retry>Retry</button></div>`:""}
      ${feed.error?`<div class="cf-error" role="alert">${e(feed.error)} <button data-cf-reload>Try again</button></div>`:""}
      <div class="community-content-grid">${posts.map((post,index)=>`${feed.reason?`<details class="cf-why"><summary>Why am I seeing this?</summary><p>${e(feed.reasons?.[post.id]||feed.reason)}</p></details>`:""}${deps.renderPost(post)}${index===5?suggestedPeopleMarkup(otherPeople.slice(6),"More people to discover"):""}`).join("")}</div>
      ${feed.loading&&!posts.length?`<div class="cf-skeletons" role="status" aria-label="Loading Community posts">${[1,2,3].map(()=>'<div><i></i><span></span><span></span></div>').join("")}</div>`:""}
      ${!feed.loading&&!posts.length&&!feed.error?`<section class="cf-empty">${ic("users")}<h2>${active==="friends"?"No posts from mutuals yet":"No posts in this feed yet"}</h2><p>${active==="friends"?"Follow people who follow you back to see them here.":active==="discover"&&preferences.filters[active]?.onlyFollowing?"Discover excludes followed accounts. Turn off “Only people I follow” to see recommendations.":"Try another feed, follow more people, or adjust this feed’s preferences."}</p><button data-cf-controls>Adjust preferences</button><button data-cf-search>Find people and posts</button></section>`:""}
      <div class="cf-footer">${feed.hasMore?`<button data-cf-more ${feed.loading?"disabled":""}>${feed.loading?"Loading…":"Load more"}</button>`:""}
      ${posts.length?`<button data-cf-catch-up>${ic("check")}Mark caught up</button>`:""}</div>
      ${suggestedPeopleMarkup(sharedInterestPeople,"People who share your interests")}
    </div></section>`,"light");
  deps.bindPosts();
  const pull=deps.app.querySelector(".stories-feed-scroll");
  let pullStart=null;
  pull?.addEventListener("touchstart",event=>{
    const touch=event.touches[0];
    pullStart=pull.scrollTop<=0&&touch&&!feed.loading?{x:touch.clientX,y:touch.clientY}:null;
  },{passive:true});
  pull?.addEventListener("touchend",event=>{
    const touch=event.changedTouches[0],start=pullStart;pullStart=null;
    if(start&&touch&&touch.clientY-start.y>75&&Math.abs(touch.clientX-start.x)<40&&!feed.loading)void loadFeed();
  },{passive:true});
  deps.app.querySelectorAll("[data-cf-feed]").forEach(b=>b.onclick=()=>selectFeed(b.dataset.cfFeed));
  deps.app.querySelectorAll("[data-cf-search]").forEach(b=>b.onclick=deps.onSearch);
  deps.app.querySelectorAll("[data-cf-profile]").forEach(b=>b.onclick=()=>deps.onProfile(b.dataset.cfProfile));
  deps.app.querySelectorAll("[data-cf-follow]").forEach(b=>b.onclick=async()=>{
    b.disabled=true;const account=owner;
    try{await deps.onFollow(b.dataset.cfFollow);if(account===owner){feed.loadedAt=0;suggestions.loadedAt=0;repaint();}}
    catch(error){deps.toast(errorMessage(error));}
    finally{if(b.isConnected)b.disabled=false;}
  });
  deps.app.querySelector("[data-cf-people-retry]")?.addEventListener("click",()=>{void loadSuggestions();repaint();});
  deps.app.querySelector("[data-cf-compose]").onclick=()=>{invalidateCommunityFeeds();deps.onCompose();};
  deps.app.querySelectorAll("[data-cf-controls]").forEach(b=>b.onclick=()=>{
    if(settingsLoading)return deps.toast("Your feed controls are loading.");
    if(settingsError){void loadSettings();return deps.toast("Retrying your feed controls.");}
    settingsMenu();
  });
  deps.app.querySelectorAll("[data-cf-reload]").forEach(b=>b.onclick=()=>{feed.loadedAt=0;feed.error="";void loadFeed();repaint();});
  deps.app.querySelector("[data-cf-settings-retry]")?.addEventListener("click",()=>{void loadSettings();});
  deps.app.querySelector("[data-cf-more]")?.addEventListener("click",()=>{void loadFeed(true);repaint();});
  deps.app.querySelector("[data-cf-catch-up]")?.addEventListener("click",async event=>{
    const button=event.currentTarget,account=owner,selected=active;button.disabled=true;
    try{const result=await request("catch-up",{method:"POST",body:{feed:selected}});if(owner===account&&active===selected){feed.caughtUpAt=result.caughtUpAt;repaint();}}
    catch(error){deps.toast(errorMessage(error));}finally{if(button.isConnected)button.disabled=false;}
  });
}
export function invalidateCommunityFeeds() { feed.loadedAt=0;feed.error=""; }
export function retryCommunityFeeds() { reset(""); }
if(typeof window!=="undefined")window.addEventListener("oldtime-cloud-session-changed",()=>reset(""));
if(typeof window!=="undefined")window.addEventListener("oldtime-data",()=>invalidateCommunityFeeds());
