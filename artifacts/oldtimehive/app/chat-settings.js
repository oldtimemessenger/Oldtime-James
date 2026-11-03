import { api } from "./store.js";
import { icons } from "./icons.js";
import "./chat-settings.css";

const audiences = [["everyone", "Everyone"], ["following", "People I follow"], ["none", "No one"]];
const filters = [["all", "Every chat"], ["unread", "Unread"], ["unanswered", "Unanswered"],
  ["verified", "Verified profiles"], ["followers-10k", "10K+ followers"],
  ["groups", "Groups"]];
const folders = [["all", "All inboxes"], ["primary", "Primary"], ["requests", "Requests"], ["general", "General"]];

export function openChatSettings(ctx, { onBack, onSaved, onNewMessage, onNewGroup, selection, onSelection }) {
  const scrollTop = ctx.$(".chat-settings-content")?.scrollTop || 0;
  ctx.shell(`<section class="screen on light chat-settings-screen" data-chat-view="settings">
    <header class="chat-settings-titlebar"><button type="button" class="chat-settings-back" id="chat-settings-back" aria-label="Back to messages">${icons.back}</button><h1 class="chat-settings-title">Chat Settings</h1><span></span></header>
    <div class="chat-settings-content"><p class="chat-settings-status" role="status">Loading chat settings…</p></div>
  </section>`, "light");
  const root = ctx.$(".chat-settings-screen"), content = root.querySelector(".chat-settings-content");
  root.querySelector("#chat-settings-back").onclick = onBack;
  let preferences = null, saving = false;
  const choices = (name, options, value) => `<div class="chat-settings-options" role="radiogroup" aria-label="${name === "directMessages" ? "Allow direct messages from" : name === "groupInvites" ? "Allow group chat invites from" : name === "filter" ? "Filter conversations" : "Inbox folder"}">${options.map(([id, label]) =>
    `<button type="button" class="chat-settings-choice" role="radio" aria-checked="${id === value}" data-chat-choice="${name}" data-value="${id}" ${saving ? "disabled" : ""}><span class="chat-settings-radio" aria-hidden="true"></span><span>${label}</span></button>`).join("")}</div>`;
  const description = `<p class="chat-settings-description">You can continue ongoing conversations regardless of which setting you choose.</p>`;
  function paint(message = "") {
    if (!root.isConnected) return;
    const position = content.scrollTop || scrollTop;
    content.innerHTML = `
      ${onNewMessage || onNewGroup ? `<section class="chat-settings-section"><h2>Start a conversation</h2>
        ${onNewMessage ? `<button type="button" class="chat-settings-row" data-chat-new="message"><span>New message</span><span aria-hidden="true">›</span></button>` : ""}
        ${onNewGroup ? `<button type="button" class="chat-settings-row" data-chat-new="group"><span>New group</span><span aria-hidden="true">›</span></button>` : ""}</section>` : ""}
      <section class="chat-settings-section"><h2>Allow direct messages from</h2>${description}${choices("directMessages", audiences, preferences.directMessages)}</section>
      <section class="chat-settings-section"><h2>Allow group chat invites from</h2>${description}${choices("groupInvites", audiences, preferences.groupInvites)}</section>
      <section class="chat-settings-section"><h2>Inbox</h2>${choices("filter", filters.slice(0, 3), selection.filter)}
        <details><summary>More filters</summary>${choices("filter", filters.slice(3), selection.filter)}</details>
        <h3>Folders</h3>${choices("folder", folders, selection.folder)}
        <button type="button" class="chat-settings-row" data-chat-saved><span>Saved messages</span><span aria-hidden="true">›</span></button></section>
      <section class="chat-settings-section"><div class="chat-settings-row"><span>Read receipts</span>
        <button type="button" class="chat-settings-toggle" role="switch" aria-label="Read receipts" aria-checked="${preferences.readReceipts}" ${saving ? "disabled" : ""}><i></i></button></div>
        <p class="chat-settings-description">Let people see when you have read their messages. Marking a chat as unread is private.</p></section>
      <p class="chat-settings-status" role="status">${message}</p>`;
    content.scrollTop = position;
    content.querySelectorAll("[data-chat-choice]").forEach(button => button.onclick = () => {
      const key = button.dataset.chatChoice, value = button.dataset.value;
      if (key === "filter" || key === "folder") {
        selection[key] = value; onSelection({ ...selection }); paint(); return;
      }
      void save({ ...preferences, [key]: value });
    });
    content.querySelector(".chat-settings-toggle").onclick = () => void save({ ...preferences, readReceipts: !preferences.readReceipts });
    content.querySelector("[data-chat-saved]").onclick = onSaved;
    content.querySelector('[data-chat-new="message"]')?.addEventListener("click", () => onNewMessage());
    content.querySelector('[data-chat-new="group"]')?.addEventListener("click", () => onNewGroup());
  }
  async function save(next) {
    if (saving) return;
    saving = true; paint("Saving…");
    try {
      preferences = await api.saveCloudChatPreferences(next);
      saving = false; paint("Saved");
    } catch (error) {
      saving = false; paint("Your previous settings are unchanged.");
      if (root.isConnected) content.querySelector('[role="status"]').textContent = error.message || "Chat settings could not be saved. Try again.";
    }
  }
  void api.loadCloudChatPreferences().then(result => {
    preferences = result; paint();
  }).catch(error => {
    if (!root.isConnected) return;
    const status = content.querySelector('[role="status"]');
    status.textContent = error.message || "Chat settings could not be loaded.";
    const retry = document.createElement("button");
    retry.type = "button"; retry.className = "chat-settings-row"; retry.textContent = "Retry";
    retry.onclick = () => openChatSettings(ctx, { onBack, onSaved, onNewMessage, onNewGroup, selection, onSelection });
    content.append(retry);
  });
}
