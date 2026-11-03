import "./repost-affordance.css";
import { api } from "./store.js";
import { icon } from "./icons.js";

const note = (post, id) => String(post?.repostNotes?.[id] || "").trim().slice(0, 140);

function pick(post) {
  const me = api.me();
  const ids = [...new Set(Array.isArray(post?.reposts) ? post.reposts : [])];
  if (me && (post?.repostedByMe || ids.includes(me.id))) return { mine: true, user: me };
  for (const person of Array.isArray(post?.repostedByFriends) ? post.repostedByFriends : []) {
    const id = String(person?.id || "");
    const user = api.user(id) || person;
    if (id && user?.username && api.canSee(id)) return { mine: false, user };
  }
  for (const id of ids) {
    if (id === me?.id) continue;
    const u = api.user(id);
    if (u && api.canSee(id)) return { mine: false, user: u };
  }
  return null;
}

export function renderRepostAffordance(post, { esc }) {
  if (!post?.id) return "";
  const me = api.me();
  const mine = Boolean(me && (post.repostedByMe || (post.reposts || []).includes(me.id)));
  const friends = (Array.isArray(post.repostedByFriends) ? post.repostedByFriends : [])
    .filter(person => person?.id && person?.username && api.canSee(person.id));
  const profiles = [];
  if (mine && me) profiles.push({ ...me, mine: true });
  for (const person of friends) {
    if (!profiles.some(profile => profile.id === person.id)) profiles.push({ ...person, mine: false });
  }
  if (!profiles.length) {
    const found = pick(post);
    if (found?.user) profiles.push({ ...found.user, mine: found.mine });
  }
  const count = Math.max(0, Number(post.repostCount) || 0, mine ? 1 : 0, friends.length);
  if (!count) return "";
  const firstFriend = friends[0];
  const label = count > 1 ? `${new Intl.NumberFormat().format(count)} reposted`
    : mine ? "You reposted"
      : firstFriend ? `@${firstFriend.username} reposted` : "Reposted";
  const noteText = mine && me ? note(post, me.id) : "";
  let bubble = "";
  if (noteText) bubble = `<button type="button" class="rp-bubble" data-repost-note="${esc(post.id)}" aria-label="Edit your repost note: ${esc(noteText)}"><span class="rp-text">${esc(noteText)}</span></button>`;
  const faces = profiles.slice(0, 2).map(profile => {
    const username = profile.username || "member";
    const avatar = profile.avatar || profile.avatarUrl || "";
    const isMine = profile.mine === true;
    const action = isMine
      ? `data-repost-note="${esc(post.id)}" aria-label="${noteText ? "Edit your repost note" : "Add a note to your repost"}"`
      : `data-avatar-profile="${esc(profile.id)}" aria-label="@${esc(username)} reposted this post"`;
    return `<button type="button" class="rp-face rp-face-compact" ${action}><img src="${esc(avatar)}" alt=""><span class="rp-badge">${icon("repost")}</span></button>`;
  }).join("");
  const fallback = faces || `<span class="rp-face rp-face-compact rp-face-empty" aria-hidden="true">${icon("repost")}</span>`;
  return `<div class="rp-aff" data-rp-post="${esc(post.id)}" data-rp-note="${noteText ? "1" : "0"}">
    ${bubble}
    <div class="rp-summary"><span class="rp-avatars">${fallback}</span><span class="rp-count">${esc(label)}</span></div>
  </div>`;
}

export function mountRepostAffordances(root) {
  if (!root) return;
  root.querySelectorAll(".rp-aff [data-rn-read]").forEach(button => button.addEventListener("click", e => {
    const aff = button.closest(".rp-aff");
    const open = aff.classList.toggle("rp-open");
    e.currentTarget.setAttribute("aria-expanded", String(open));
    e.currentTarget.textContent = open ? "Less" : "Read";
  }));
}

export function showRepostedPulse(root, postId) {
  const card = (root || document).querySelector(`.clip[data-id="${CSS.escape(String(postId))}"]`);
  if (!card) return false;
  const summary = card.querySelector(".rp-summary");
  const label = summary?.querySelector(".rp-count");
  if (!summary || !label) return false;
  const original = label.textContent || "";
  summary.classList.remove("rp-confirmed");
  void summary.offsetWidth;
  label.textContent = "Reposted";
  summary.setAttribute("role", "status");
  summary.setAttribute("aria-live", "polite");
  summary.setAttribute("aria-atomic", "true");
  summary.classList.add("rp-confirmed");
  setTimeout(() => {
    if (!summary.isConnected) return;
    label.textContent = original;
    summary.classList.remove("rp-confirmed");
    summary.removeAttribute("role");
    summary.removeAttribute("aria-live");
    summary.removeAttribute("aria-atomic");
  }, 1700);
  return true;
}
