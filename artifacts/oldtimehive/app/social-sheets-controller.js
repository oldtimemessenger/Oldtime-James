import "./saved-sheets.css";
import "./share-sheet.css";
import { api } from "./store.js";
import { setPostSaved } from "./saved-collections.js";
import { renderSavedSheet, renderShareSheet, renderSharePeople } from "./saved-sheets.js";
import { findSharedComment, listRegularShareFriends, sendPostToFriends } from "./shared-content.js";
import { isDefaultAvatarMediaReference } from "./story-media.js";

export function openSocialSheet({
  id, mode = "saved", commentId = "", sheet, esc, icons, toast, onClose,
  onExternal, onShared, onStory, onRepost
}) {
  const ownerId = api.me()?.id;
  const returnFocus = document.activeElement;
  let friendsMode = false;
  let friends = [];
  let friendSearch = "";
  let friendMessage = "";
  let sendingFriends = false;
  let peopleLoading = false;
  let peopleError = false;
  let active = true;
  let panel = null;
  const isCurrent = () => active && panel?.isConnected && sheet.contains(panel);
  const selectedFriends = new Set();
  const post = () => {
    const item = api.post(id);
    if (api.me()?.id !== ownerId || !item || !api.canSeePost(item)) throw new Error("Post unavailable.");
    if (commentId && !findSharedComment(item, commentId)) throw new Error("Comment unavailable.");
    return item;
  };
  const error = value => {
    if (!isCurrent()) return;
    const target = sheet.querySelector("[data-sheet-error]");
    if (target) target.textContent = value.message || String(value);
  };
  const close = (refresh = true) => {
    const current = isCurrent();
    active = false;
    document.removeEventListener("keydown", keyboard);
    if (!current) return;
    sheet.classList.remove("on");
    sheet.innerHTML = "";
    sheet.onclick = null;
    document.removeEventListener("keydown", keyboard);
    if (refresh) onClose?.();
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  const keyboard = event => {
    if (!isCurrent()) { document.removeEventListener("keydown", keyboard); return; }
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key !== "Tab") return;
    const buttons = [...sheet.querySelectorAll("button:not(:disabled), input, textarea")]
      .filter(element => !element.closest("[hidden]"));
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const run = async action => {
    try { post(); await action(); if (isCurrent()) draw(); }
    catch (failure) { error(failure); }
  };
  const filterPeople = () => {
    const query=friendSearch.trim().toLowerCase();
    let matches=0;
    sheet.querySelectorAll("[data-share-cell]").forEach(cell=>{
      cell.hidden=Boolean(query&&!cell.dataset.search.includes(query));
      if(!cell.hidden)matches++;
    });
    const empty=sheet.querySelector("[data-share-no-matches]");
    if(empty)empty.hidden=!query||matches>0||peopleLoading||friends.length===0;
  };
  const updateSelection = () => {
    const compose=sheet.querySelector(".srp-compose"),send=sheet.querySelector("[data-share-submit]");
    if(compose)compose.hidden=selectedFriends.size===0;
    if(send){
      send.disabled=selectedFriends.size===0||sendingFriends;
      send.textContent=sendingFriends?"Sending…":selectedFriends.size?`Send (${selectedFriends.size})`:"Send";
    }
    sheet.querySelectorAll("[data-share-friend]").forEach(input=>{
      input.disabled=sendingFriends||friends.some(friend=>String(friend.id)===input.value&&friend.unavailable);
    });
  };
  const bindPeople = () => {
    sheet.querySelectorAll("[data-share-friend]").forEach(input=>{
      input.addEventListener("change",()=>{
        if(sendingFriends){input.checked=selectedFriends.has(input.value);return;}
        if(input.checked)selectedFriends.add(input.value);
        else selectedFriends.delete(input.value);
        updateSelection();
      });
    });
    sheet.querySelectorAll(".srp-face img").forEach(image=>{
      image.addEventListener("error",()=>image.remove(),{once:true});
    });
    sheet.querySelector("[data-share-refresh]")?.addEventListener("click",()=>void refreshPeople());
    filterPeople();
    updateSelection();
  };
  const refreshPeopleRegion = () => {
    if(!isCurrent())return;
    const region=sheet.querySelector("[data-share-people]");
    if(!region)return;
    region.setAttribute("aria-busy",String(peopleLoading));
    region.innerHTML=renderSharePeople({friends,selectedFriends:[...selectedFriends],loading:peopleLoading,failed:peopleError,busy:sendingFriends,esc,icons});
    bindPeople();
  };
  const refreshPeople = async () => {
    if(peopleLoading||!isCurrent())return;
    peopleLoading=true;peopleError=false;
    refreshPeopleRegion();
    try{
      const results=await Promise.allSettled([
        api.refreshCloudRelationships({force:false,importLegacy:false}),
        api.refreshCloudChats({force:false,migrateLegacy:false})
      ]);
      if(!isCurrent())return;
      if(api.me()?.id!==ownerId){close(false);return;}
      friends=listRegularShareFriends(id);
      peopleError=results.some(result=>result.status==="rejected");
      const allowed=new Set(friends.filter(friend=>!friend.unavailable).map(friend=>String(friend.id)));
      for(const friend of selectedFriends)if(!allowed.has(friend))selectedFriends.delete(friend);
    }catch{peopleError=true;}
    finally{peopleLoading=false;refreshPeopleRegion();}
  };
  const draw = () => {
    const item = post();
    const author = api.user(item.author) || {};
    const candidateThumbnail = item.kind === "video" ? item.poster || author.avatar : item.media?.[0];
    const preview = { ...item, thumbnail: isDefaultAvatarMediaReference(candidateThumbnail) ? "" : candidateThumbnail };
    const comment = findSharedComment(item, commentId);
    const saved = Boolean(item.saves?.includes(ownerId) || api.me()?.savedPostIds?.includes(id));
    sheet.innerHTML = mode === "saved"
      ? renderSavedSheet({ post: preview, author, saved, esc, icons })
      : renderShareSheet({ post: preview, author,
        comment: comment ? { ...comment, authorName: "@" + (api.user(comment.author)?.username || "member") } : null,
        friends, friendsMode, selectedFriends: [...selectedFriends], friendSearch, friendMessage, saved,
        peopleLoading,peopleError,sending:sendingFriends,
        reposted: Boolean(item.repostedByMe) || (item.reposts || []).includes(ownerId),
        canRepost: Boolean(item.cloud)&&typeof onRepost==="function",
        canStory:typeof onStory==="function",canCopy:typeof onExternal==="function",
        canExternal:typeof onExternal==="function"&&typeof navigator.share==="function",esc, icons });
    panel=sheet.querySelector(".panel");
    sheet.querySelector("[data-social-sheet-close]").onclick = () => close();
    if (mode === "saved") {
      sheet.querySelector("[data-saved-toggle]").onclick = () => run(async () => {
        const current = Boolean(post().saves?.includes(ownerId) || api.me()?.savedPostIds?.includes(id));
        await setPostSaved(id, !current);
      });
    } else {
      sheet.querySelector("[data-share-repost]")?.addEventListener("click", async () => {
        try {
          const item = post();
          if (!item.cloud) throw new Error("This post must be online before it can be reposted.");
          const completed = await onRepost?.(id);
          if (completed) close(false);
        } catch (failure) { error(failure); }
      });
      sheet.querySelector("[data-share-save]")?.addEventListener("click", async () => {
        try {
          const next = !saved;
          await setPostSaved(id, next);
          toast(next ? "Saved" : "Removed from saved");
          close();
        } catch (failure) { error(failure); }
      });
      sheet.querySelector("[data-share-story]")?.addEventListener("click", () => {
        try {
          post();
          // The callback queues the editor into this same sheet; close synchronously before that microtask runs.
          const completed = onStory?.(id, commentId);
          if (completed !== false) close(false);
        } catch (failure) { error(failure); }
      });
      sheet.querySelector("[data-share-friends]")?.addEventListener("click", () => {
        try{
        post();
        friendsMode=!friendsMode;
        if(!friendsMode)friendSearch="";
        draw();
        sheet.querySelector(friendsMode?"[data-share-search]":"[data-share-friends]")?.focus({preventScroll:true});
        }catch(failure){error(failure);}
      });
      sheet.querySelector("[data-share-search]")?.addEventListener("input", event => {
        friendSearch = event.currentTarget.value;
        filterPeople();
      });
      sheet.querySelector("[data-share-message]")?.addEventListener("input",event=>{friendMessage=event.currentTarget.value;});
      bindPeople();
      sheet.querySelector("[data-share-submit]")?.addEventListener("click", async () => {
        if (sendingFriends) return;
        try {
          post();
          const recipientIds = [...selectedFriends];
          if (!recipientIds.length) throw new Error("Choose at least one person.");
          const message = sheet.querySelector("[data-share-message]")?.value || "";
          sendingFriends = true;
          updateSelection();
          const result = await sendPostToFriends(id, recipientIds, { commentId, message });
          const sentCount = Array.isArray(result) ? result.length : Number(result?.sentCount || 0);
          const failedCount = Array.isArray(result) ? 0 : Number(result?.failedRecipientIds?.length || 0);
          if (!sentCount && failedCount) throw new Error("The post could not be sent to those Friends. Try again.");
          if (failedCount) toast(`Shared with ${sentCount} ${sentCount === 1 ? "person" : "people"}; ${failedCount} could not be reached.`);
          else toast(`Shared with ${sentCount} ${sentCount === 1 ? "person" : "people"}`);
          close();
        } catch (failure) {
          sendingFriends = false;
          error(failure);
          if(isCurrent())updateSelection();
        }
      });
      sheet.querySelector("[data-share-external]")?.addEventListener("click", async () => {
        try { post(); const result=await onExternal?.(id, commentId); if(result?.completed){close();if(result.kind==="shared")onShared?.(id,result.kind);} }
        catch (failure) { error(failure); }
      });
      sheet.querySelector("[data-share-copylink]")?.addEventListener("click", async () => {
        try {
          post();
          const result = await onExternal?.(id, commentId, "copylink");
          if (result?.completed) close();
        } catch (failure) { error(failure); }
      });
    }
  };
  try {
    if(mode==="share")friends=listRegularShareFriends(id);
    if (mode === "saved" && !post().saves?.includes(ownerId)) setPostSaved(id, true);
    draw();
    sheet.classList.add("on");
    sheet.onclick = event => { if (event.target === sheet) close(); };
    document.addEventListener("keydown", keyboard);
    sheet.querySelector("[data-social-sheet-close]")?.focus();
    if(mode==="share"&&api.authMode()==="cloud")void refreshPeople();
  } catch (failure) {
    close(false);
    toast(failure.message);
  }
}
