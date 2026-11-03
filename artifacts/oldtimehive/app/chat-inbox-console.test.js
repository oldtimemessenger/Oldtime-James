import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildConsolePeople, consoleMatches, rotatableNotes, createNoteRotation, renderConsole } from "./chat-inbox-console.js";

const me = { id: "me", name: "Ada", avatar: "/me.jpg", profileNote: "" };
test("console keeps cloud profile photos and resolves stored media without initials", () => {
  const cards = buildConsolePeople({ me, users: [{id:"photo",name:"Photo member",avatarUrl:"oldtime-media:portrait"}], storyByAuthor:new Map([["photo",{id:"story"}]]) });
  const html = renderConsole(cards, {esc:value=>String(value),icons:{user:"<svg></svg>"}});
  assert.match(html,/data-local-media="oldtime-media:portrait"/);
  assert.ok(!html.includes(">P</span>"));
});
test("own story includes an inset plus and notes keep their bubble text", () => {
  const html = renderConsole(buildConsolePeople({me}), {esc:value=>String(value),icons:{plus:"<svg></svg>"}});
  assert.match(html,/class="cic-add-story"/);
  assert.match(html,/class="cic-note-text">Add a note/);
  const css = readFileSync(new URL("./chat-inbox-console.css", import.meta.url),"utf8");
  assert.match(css,/\.cic-track:has\(\.cic-note\) \.cic-card \{ padding-top:40px/);
  assert.match(css,/\.cic-note::after/);
  assert.match(css,/\.cic-portrait \{[^}]*border-radius:50%/);
});
const users = [me,
  { id: "a", name: "Bea", username: "bea", avatar: "/a.jpg", profileNote: "Porch tonight" },
  { id: "b", name: "Cal", avatar: "/b.jpg" },
  { id: "x", name: "Blocked", profileNote: "hidden" },
  { id: "p", name: "Private", profileNote: "secret" },
  { id: "f", name: "Friend", avatar: "/f.jpg" },
  { id: "s", name: "Storyteller", avatar: "/s.jpg" }];
const convos = [{ id: "c1", members: ["me", "b"] }, { id: "g", members: ["me", "a", "b"], group: true }, { id: "c2", members: ["me", "a"] }, { id: "cx", members: ["me", "x"] }];
const build = () => buildConsolePeople({ me, convos, users, storyByAuthor: new Map([["s", { visibility: "close_friends" }]]),
  blocked: (a, b) => a === "me" && b === "x", canSee: id => id !== "p", areFriends: (a, b) => b === "f" });

test("console cards come only from real, eligible, deduped people", () => {
  const cards = build();
  assert.deepEqual(cards.map(c => c.id), ["me", "b", "a", "s", "f"]);
  assert.equal(cards[0].isMe, true);
  assert.equal(cards.find(c => c.id === "a").conversationId, "c2", "group chats never stand in for a direct chat");
  assert.equal(cards.find(c => c.id === "b").conversationId, "c1");
  assert.equal(cards.find(c => c.id === "f").conversationId, null);
  assert.deepEqual(cards.find(c => c.id === "s").story, { closeFriends: true });
  assert.ok(!cards.some(c => c.id === "x" || c.id === "p"), "blocked and private people are excluded");
  assert.deepEqual(buildConsolePeople({ me: null }), []);
});

test("search filters people by name, handle and real note", () => {
  const cards = build();
  assert.deepEqual(cards.filter(c => consoleMatches(c, "@BEA")).map(c => c.id), ["a"]);
  assert.deepEqual(cards.filter(c => consoleMatches(c, "porch")).map(c => c.id), ["a"]);
  assert.equal(cards.filter(c => consoleMatches(c, "")).length, cards.length);
});

test("markup: rectangular cards, own note edit, story badge, new message entry, no fabricated notes", () => {
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const html = renderConsole(build(), { esc, icons: { pause: "P", messagePlus: "M" } });
  assert.doesNotMatch(html, /id="newchat"|cic-card is-new/);
  assert.match(html, /data-chat-note="me"[^>]*aria-label="Add a note"/);
  assert.match(html, /data-chat-note="a"[^>]*><span class="cic-note-text">Porch tonight</);
  assert.doesNotMatch(html, /data-chat-note="b"/, "people without notes get no invented note");
  assert.match(html, /class="cic-card has-story is-close" data-console-card="s"/);
  assert.match(html, /data-story-author="s"/);
  assert.match(html, /data-console-person="b" data-console-convo="c1"/);
  assert.doesNotMatch(html, /<button[^>]*>[^<]*<button/, "no nested buttons");
  assert.doesNotMatch(html, /chat-active-stories|border-radius:50%/);
  const single = renderConsole([build()[0]], { esc, icons: { pause: "P", messagePlus: "M" } });
  assert.doesNotMatch(single, /cic-pause/, "rotation control only when several real notes exist");
});

test("stories and notes share one card per person, with the owner first",()=>{
  const cards=build();
  const person=cards.find(c=>c.id==="a");
  person.story={closeFriends:false};person.storyId="story-a";
  const html=renderConsole(cards,{esc:String,icons:{pause:"P",messagePlus:"M",plus:"+"}});
  assert.equal((html.match(/data-console-card="me"/g)||[]).length,1);
  assert.equal((html.match(/data-console-card="a"/g)||[]).length,1);
  assert.ok(html.indexOf('data-chat-note="a"')<html.indexOf('data-story-author="a"'));
  assert.doesNotMatch(html,/id="newchat"/);
  assert.match(html,/id="csc-own-add" aria-label="Add story"/);
  assert.doesNotMatch(html,/<div id="csc-chooser"/);
});

test("rotation only cycles real notes, holds on interaction, pauses, and cleans up", () => {
  let pending = null, clock = 0;
  const timers = { setTimer: (fn) => (pending = fn, 1), clearTimer: () => { pending = null; } };
  const ticks = [];
  assert.deepEqual(rotatableNotes([{ note: "a" }, { note: "" }, { note: "b" }]), [0, 2]);
  const r = createNoteRotation({ count: 2, onTick: i => ticks.push(i), now: () => clock, ...timers }).start();
  pending(); assert.deepEqual(ticks, [1]);
  r.hold(5000); pending(); assert.deepEqual(ticks, [1], "held while the user interacts");
  clock = 6000; pending(); assert.deepEqual(ticks, [1, 0]);
  r.setPaused(true); assert.equal(pending, null); assert.equal(r.running, false);
  r.setPaused(false); assert.ok(pending);
  r.stop(); assert.equal(pending, null);
  let hidden = true; const h = createNoteRotation({ count: 3, onTick: i => ticks.push(i), isHidden: () => hidden, ...timers }).start();
  pending(); assert.equal(h.index, 0, "hidden page never rotates"); h.stop();
  pending = null;
  createNoteRotation({ count: 3, reducedMotion: true, ...timers }).start(); assert.equal(pending, null, "reduced motion disables rotation");
  createNoteRotation({ count: 1, ...timers }).start(); assert.equal(pending, null, "one note never rotates");
});

test("inbox header has Search, new message/group and Chat Settings; the rail is people only", () => {
  const chat = readFileSync(new URL("./chat.js", import.meta.url), "utf8");
  const settings = readFileSync(new URL("./chat-settings.js", import.meta.url), "utf8");
  const header = chat.slice(chat.indexOf('<div class="chat-list-topline">'), chat.indexOf('<div class="chat-list-body">'));
  assert.match(header, /id="toggle-chat-search"/); assert.match(header, /id="chat-more"[^>]*aria-label="Chat Settings"/);
  assert.match(header, /id="newchat"[^>]*aria-label="New message or group"/);
  assert.match(chat, /ctx\.\$\("#newchat"\)\.onclick = \(\) => pick\(ctx, false\)/);
  assert.match(chat, /onNewGroup: \(\) => \{[^}]*pick\(ctx, true\)/);
  assert.match(settings, /data-chat-new="group"[^>]*><span>New group/);
  assert.match(settings, /data-chat-saved/);
  assert.match(chat, /peopleConsole\.filter\(query\)/);
  assert.match(chat, /peopleConsole\.cleanup\(\)/);
  assert.doesNotMatch(chat, /chat-active-stories/);
  const css = readFileSync(new URL("./chat-inbox-console.css", import.meta.url), "utf8");
  assert.match(css, /\.chat-inbox-avatar \{[^}]*border-radius:50%/);
  assert.match(css, /\.cic-track \{[^}]*overflow-x:auto[^}]*scroll-snap-type:x proximity/);
  assert.match(css, /\.cic \{[^}]*overflow:hidden/);
});
