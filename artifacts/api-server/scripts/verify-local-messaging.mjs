// Only the isolated local Wrangler instance. Never run this against production.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
const origin = "http://127.0.0.1:8686";
const accounts = [];
async function request(path, account, method = "GET", body) {
  const response = await fetch(`${origin}/api${path}`, {
    method, headers: {
      ...(account ? {Authorization:`Bearer ${account.accessToken}`} : {}),
      ...(body === undefined ? {} : {"Content-Type":"application/json"}),
    }, ...(body === undefined ? {} : {body:JSON.stringify(body)}),
  });
  const data = await response.json().catch(() => ({}));
  return {response, data};
}
async function ok(path, account, method, body) {
  const result = await request(path, account, method, body);
  assert.ok(result.response.ok, `${method || "GET"} ${path}: ${result.response.status} ${result.data.error || result.data.message || ""}`);
  return result.data;
}
for (const name of ["Alice", "Blair", "Casey", "Drew"]) {
  const username = `release_${name.toLowerCase()}_${randomUUID().slice(0,8)}`;
  const password = `Local-${randomUUID()}!`;
  const auth = await ok("/auth/register", null, "POST", {username,email:`${username}@example.test`,displayName:`Release ${name}`,birthday:"2000-01-01",password,interests:["music","fashion","tech"],followOldtime:false});
  assert.ok(auth.accessToken && auth.account?.id, "Local registration must return an authenticated account");
  accounts.push({...auth, username, password});
}
const [alice, blair, casey, drew] = accounts;
const id = "cv" + randomUUID();
await ok("/chats", alice, "POST", {id,members:[alice.account.id,blair.account.id],title:""});
for (const text of ["Hello from Alice", "🙂", "A second message"]) {
  await ok(`/chats/${id}/messages`, alice, "POST", {clientId:"m"+randomUUID(),kind:"text",body:text});
}
let received = await ok(`/chats/${id}/messages`, blair);
assert.equal(received.messages.length, 3);
assert.equal(received.messages[1].body, "🙂");
await ok(`/chats/${id}/delivered`, blair, "POST", {});
let sent = await ok(`/chats/${id}/messages`, alice);
assert.ok(sent.messages.every(message => message.status === "delivered"));
await ok(`/chats/${id}/read`, blair, "POST", {shareReceipts:true});
sent = await ok(`/chats/${id}/messages`, alice);
assert.ok(sent.messages.every(message => message.status === "read"));
await ok(`/chats/${id}/state`, alice, "PUT", {state:{mutedUntil:Date.now()+3600000}});
assert.ok((await ok("/chats", alice)).chats.find(chat => chat.id === id).state.mutedUntil > Date.now());
assert.equal((await request(`/chats/${id}/messages`, casey)).response.status, 404);
const group = "cv" + randomUUID();
await ok("/chats", alice, "POST", {id:group,members:[alice.account.id,blair.account.id,casey.account.id],title:"Release group"});
await ok(`/chats/${group}`, alice, "PATCH", {title:"Renamed group",addMemberIds:[drew.account.id]});
const room = (await ok("/chats", drew)).chats.find(chat => chat.id === group);
assert.equal(room.title, "Renamed group");
assert.equal(room.members.length, 4);
assert.equal((await request(`/chats/${group}`, blair, "PATCH", {title:"Unauthorized"})).response.status, 403);
await ok(`/chats/${group}/messages`, drew, "POST", {clientId:"m"+randomUUID(),kind:"text",body:"Joined"});
assert.equal((await ok(`/chats/${group}/messages`, alice)).messages.at(-1).body, "Joined");
// Short-lived test credentials are kept out of the workspace, Git and output.
await writeFile("/tmp/oldtime-release-accounts.json", JSON.stringify(accounts), {mode:0o600});
console.log("PASS: isolated local Worker: four accounts, text/emoji persistence, delivery/read receipts, mute persistence, membership authorization, group rename/add, and non-owner denial.");
