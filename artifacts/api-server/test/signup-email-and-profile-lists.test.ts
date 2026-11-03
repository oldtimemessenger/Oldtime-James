import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import type { Database, Statement } from "../src/cloudflare/runtime";
import { accountVerificationEmail } from "../src/cloudflare/account-email-template";
import { requestEmailChange, confirmEmailChange } from "../src/cloudflare/email-verification";
import { emailVerificationStatus, requestSignupEmailVerification, signupEmailConfirmation } from "../src/cloudflare/signup-email-verification";
import { ownProfileListVisibility, publicProfileList } from "../src/cloudflare/profile-list-privacy";
import { socialRequest } from "../src/cloudflare/social";
import worker from "../src/cloudflare/worker";

function fixture(t: TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const dir = new URL("../migrations/",import.meta.url);
  for (const file of readdirSync(dir).filter(n=>n.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file,dir),"utf8"));
  t.after(()=>sqlite.close());
  function prepare(sql: string): Statement {
    let values: any[] = [];
    return {
      bind(...input: unknown[]) { values=input; return this; },
      async first<T>() { return (sqlite.prepare(sql).get(...values) ?? null) as T|null; },
      async all<T>() { return {success:true,results:sqlite.prepare(sql).all(...values) as T[]}; },
      async run<T>() { const r=sqlite.prepare(sql).run(...values); return {success:true,meta:{changes:Number(r.changes)}}; },
    };
  }
  const db: Database = {prepare,async batch(statements) {
    sqlite.exec("BEGIN");
    try { const result=await Promise.all(statements.map(s=>s.run())); sqlite.exec("COMMIT"); return result; }
    catch(error) { sqlite.exec("ROLLBACK"); throw error; }
  }};
  function user(name: string, isPrivate=0) {
    const id=randomUUID();
    sqlite.prepare("INSERT INTO users(id,email,username,display_name,password_salt,password_hash,created_at,is_private) VALUES(?,?,?,?,?,?,?,?)")
      .run(id,`${name}@example.test`,name,name,"fixture","fixture",Date.now(),isPrivate);
    return id;
  }
  const id=user("mail_owner"), other=user("list_viewer"), member=user("list_member");
  sqlite.prepare("UPDATE users SET email_verification_known=1 WHERE id=?").run(id);
  const messages: ReturnType<typeof accountVerificationEmail>[]=[];
  const env={DB:db,RESEND_API_KEY:"test-only"};
  const send=async (_key:string,payload:ReturnType<typeof accountVerificationEmail>)=>{messages.push(payload);return true;};
  const token=()=>new URL(messages.at(-1)!.text.match(/https:\/\/[^\s]+/)![0]).searchParams.get("token")!;
  const confirm=(value:string,method="POST",origin="https://heyoldtime.com")=>signupEmailConfirmation(new Request(
    `https://heyoldtime.com/api/account/email-verification/verify${method==="GET"?`?token=${value}`:""}`,
    {method,headers:method==="POST"?{"content-type":"application/x-www-form-urlencoded",origin}:undefined,
      body:method==="POST"?new URLSearchParams({token:value}):undefined}),env);
  const follow=(a:string,b:string)=>sqlite.prepare("INSERT INTO user_follows(follower_id,followed_id,created_at) VALUES(?,?,?)").run(a,b,Date.now());
  return {sqlite,db,id,other,member,messages,env,send,token,confirm,follow};
}

test("optional verification is private, hash-only and scanner-safe; POST consumes once",async t=>{
  const f=fixture(t);
  assert.equal((await (await emailVerificationStatus(f.db,f.id)).json()).verified,false);
  assert.equal((await requestSignupEmailVerification(f.env,f.id,f.send)).status,200);
  const token=f.token();
  const row=f.sqlite.prepare("SELECT * FROM email_verification_requests WHERE user_id=?").get(f.id)!;
  assert.notEqual(row.token_hash,token); assert.equal(String(row.token_hash).length,64);
  assert.equal((await f.confirm(token,"GET")).status,200);
  assert.equal((await f.confirm(token,"GET")).status,200);
  assert.equal((await (await emailVerificationStatus(f.db,f.id)).json()).verified,false);
  assert.equal((await f.confirm(token)).status,200);
  assert.equal((await (await emailVerificationStatus(f.db,f.id)).json()).verified,true);
  assert.equal(f.sqlite.prepare("SELECT email FROM users WHERE id=?").get(f.id)!.email,"mail_owner@example.test");
  assert.equal((await f.confirm(token)).status,410);
  assert.deepEqual(await (await requestSignupEmailVerification(f.env,f.id,f.send)).json(),{ok:true,alreadyVerified:true});
  assert.equal(f.messages.length,1);
});

test("expired, invalid, wrong-origin and changed-address tokens cannot verify",async t=>{
  const f=fixture(t);
  await requestSignupEmailVerification(f.env,f.id,f.send);
  const token=f.token();
  assert.equal((await f.confirm("bad")).status,400);
  assert.equal((await f.confirm(token,"POST","https://attacker.example")).status,403);
  f.sqlite.prepare("UPDATE email_verification_requests SET expires_at=0").run();
  assert.equal((await f.confirm(token,"GET")).status,410);
  assert.equal((await f.confirm(token)).status,410);
  await requestSignupEmailVerification(f.env,f.id,f.send);
  const replacementToken=f.token();
  f.sqlite.prepare("UPDATE users SET email='replacement@example.test' WHERE id=?").run(f.id);
  assert.equal((await f.confirm(replacementToken)).status,410);
  assert.equal((await (await emailVerificationStatus(f.db,f.id)).json()).verified,false);
});

test("an opaque email-webview origin may confirm a valid bearer link, never an invalid token",async t=>{
  const f=fixture(t);
  await requestSignupEmailVerification(f.env,f.id,f.send);
  assert.equal((await f.confirm("invalid","POST","null")).status,400);
  assert.equal((await f.confirm(f.token(),"POST","null")).status,200);
  assert.equal((await (await emailVerificationStatus(f.db,f.id)).json()).verified,true);
});

test("resend cooldown, token replacement and provider failure are explicit",async t=>{
  const f=fixture(t);
  await requestSignupEmailVerification(f.env,f.id,f.send);
  const old=f.token();
  assert.equal((await requestSignupEmailVerification(f.env,f.id,f.send)).status,429);
  assert.equal(f.messages.length,1);
  f.sqlite.prepare("UPDATE email_verification_requests SET created_at=0").run();
  await requestSignupEmailVerification(f.env,f.id,f.send);
  assert.equal((await f.confirm(old)).status,410);
  assert.equal((await f.confirm(f.token(),"GET")).status,200);
  f.sqlite.prepare("UPDATE email_verification_requests SET created_at=0").run();
  assert.equal((await requestSignupEmailVerification(f.env,f.id,async()=>false)).status,503);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM email_verification_requests").get()!.n,0);
  assert.equal((await requestSignupEmailVerification({DB:f.db},f.id,f.send)).status,503);
  assert.equal((await (await emailVerificationStatus(f.db,f.id)).json()).verified,false);
});

test("legacy verification history stays unknown until an explicit request; never marks existing users falsely",async t=>{
  const f=fixture(t);
  f.sqlite.prepare("UPDATE users SET email_verification_known=0 WHERE id=?").run(f.id);
  assert.equal((await (await emailVerificationStatus(f.db,f.id)).json()).verified,null);
  assert.equal((await requestSignupEmailVerification(f.env,f.id,f.send)).status,200);
  assert.equal((await (await emailVerificationStatus(f.db,f.id)).json()).verified,false);
  assert.equal((await f.confirm(f.token())).status,200);
  assert.equal((await (await emailVerificationStatus(f.db,f.id)).json()).verified,true);
});

test("account emails are escaped, inline Arial, plain text, white and source-branded",()=>{
  const mail=accountVerificationEmail('owner<&"@example.test',"https://heyoldtime.com/api/account/email-verification/verify?token=test&x=1","change");
  assert.match(mail.html,/background:#ffffff/); assert.match(mail.html,/Arial,Helvetica,sans-serif/);
  assert.match(mail.html,/owner&lt;&amp;&quot;/); assert.match(mail.html,/&amp;x=1/);
  assert.match(mail.text,/https:\/\/heyoldtime.com/); assert.match(mail.text,/30 minutes/);
  assert.match(mail.subject,/Confirm/); assert.doesNotMatch(mail.html,/<script|@font-face|tracking|<img/i);
  assert.equal(mail.from,"Oldtime <verify@heyoldtime.com>");
});

test("existing email-change links stay compatible and confirmation verifies only the new address",async t=>{
  const f=fixture(t);
  const request=new Request("https://heyoldtime.com/api/account/email-change/request",{method:"POST",
    headers:{"content-type":"application/json"},body:JSON.stringify({email:"confirmed_new@example.test"})});
  assert.equal((await requestEmailChange(request,f.env,{id:f.id,email:"mail_owner@example.test"},f.send)).status,200);
  const token=f.token();
  assert.equal((await (await emailVerificationStatus(f.db,f.id)).json()).email,"mail_owner@example.test");
  const confirmed=await confirmEmailChange(new Request("https://heyoldtime.com/api/account/email-change/verify",{
    method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",origin:"https://heyoldtime.com"},body:new URLSearchParams({token})}),f.env,f.send);
  assert.equal(confirmed.status,200);
  assert.deepEqual(await (await emailVerificationStatus(f.db,f.id)).json(),{verified:true,email:"confirmed_new@example.test"});
});

test("followers default hidden, following visible; owner always sees both; changes are server-backed",async t=>{
  const f=fixture(t); f.follow(f.member,f.id); f.follow(f.id,f.member);
  const req=new Request("https://oldtime.test/api/account/profile-list-visibility");
  assert.deepEqual(await (await ownProfileListVisibility(req,f.db,f.id)).json(),{followers:false,following:true});
  await assert.rejects(()=>publicProfileList(req,f.db,f.other,"mail_owner","followers"),/private/);
  assert.equal((await (await publicProfileList(req,f.db,f.other,"mail_owner","following")).json()).users.length,1);
  assert.equal((await (await publicProfileList(req,f.db,f.id,"mail_owner","followers")).json()).users.length,1);
  const put=new Request(req.url,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({followers:true,following:false})});
  assert.deepEqual(await (await ownProfileListVisibility(put,f.db,f.id)).json(),{followers:true,following:false});
  assert.equal((await (await publicProfileList(req,f.db,f.other,"mail_owner","followers")).json()).users.length,1);
  await assert.rejects(()=>publicProfileList(req,f.db,f.other,"mail_owner","following"),/private/);
  assert.equal((await (await publicProfileList(req,f.db,f.id,"mail_owner","following")).json()).users.length,1);
  assert.equal(f.sqlite.prepare("SELECT following_visible FROM users WHERE id=?").get(f.other)!.following_visible,1);
});

test("hidden follower previews do not leak through profile stats; counts remain",async t=>{
  const f=fixture(t); f.follow(f.member,f.id); f.follow(f.id,f.member);
  const req=new Request("https://oldtime.test/api/profiles/mail_owner");
  const result=await (await socialRequest(req,f.db,f.other,"/profiles/mail_owner")).json();
  assert.equal(result.stats.followerCount,1); assert.equal(result.stats.followingCount,1);
  assert.deepEqual(result.stats.followerPreviews,[]); assert.equal(result.stats.followingPreviews.length,1);
  assert.deepEqual(result.profile.profileListVisibility,{followers:false,following:true});
  const own=await (await socialRequest(req,f.db,f.id,"/profiles/mail_owner")).json();
  assert.equal(own.stats.followerPreviews.length,1);
});

test("private-account and block rules still apply to public following lists",async t=>{
  const f=fixture(t); f.follow(f.id,f.member);
  f.sqlite.prepare("UPDATE users SET is_private=1 WHERE id=?").run(f.id);
  const req=new Request("https://oldtime.test/api/profiles/mail_owner/following");
  await assert.rejects(()=>publicProfileList(req,f.db,f.other,"mail_owner","following"),/private account/);
  f.follow(f.other,f.id);
  assert.equal((await publicProfileList(req,f.db,f.other,"mail_owner","following")).status,200);
  f.sqlite.prepare("INSERT INTO account_blocks(owner_id,blocked_id,created_at) VALUES(?,?,?)").run(f.id,f.other,Date.now());
  await assert.rejects(()=>publicProfileList(req,f.db,f.other,"mail_owner","following"),/not found/);
});

test("real Worker signup succeeds without a mail provider or verified email; new routes are reachable",async t=>{
  const f=fixture(t);
  const req=new Request("https://oldtime.test/api/auth/register",{method:"POST",headers:{"content-type":"application/json","cf-connecting-ip":"192.0.2.5"},
    body:JSON.stringify({email:"new_signup@example.test",username:"new_signup",displayName:"New member",password:"ValidTestPassword-123!",birthday:"1990-01-01",interests:["music","art","Bird watching"],followOldtime:false})});
  const env={DB:f.db} as any;
  const response=await worker.fetch(req,env);
  assert.equal(response.status,201);
  const registered=await response.json();
  assert.equal(registered.account.emailVerified,false);
  const headers={authorization:`Bearer ${registered.accessToken}`};
  const status=await worker.fetch(new Request("https://oldtime.test/api/account/email-verification/status",{headers}),env);
  assert.equal(status.status,200); assert.equal((await status.json()).verified,false);
  const me=await worker.fetch(new Request("https://oldtime.test/api/auth/me",{headers}),env);
  assert.equal((await me.json()).account.emailVerified,false);
  const lists=await worker.fetch(new Request("https://oldtime.test/api/profiles/new_signup/following",{headers}),env);
  assert.equal(lists.status,200);
  const privateList=await worker.fetch(new Request("https://oldtime.test/api/account/profile-list-visibility",{headers}),env);
  assert.deepEqual(await privateList.json(),{followers:false,following:true});
  const signIn=async()=>worker.fetch(new Request("https://oldtime.test/api/auth/login",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({identifier:"new_signup",password:"ValidTestPassword-123!"}),
  }),env);
  const login=await signIn();
  assert.equal(login.status,200);
  const signedIn=await login.json();
  assert.equal(signedIn.account.emailVerified,false,"sign-in must preserve explicitly unverified status");
  assert.deepEqual(signedIn.account.profileListVisibility,{followers:false,following:true});
  f.sqlite.prepare("UPDATE users SET email_verified_at=?,followers_visible=1,following_visible=0 WHERE id=?")
    .run(Date.now(),registered.account.id);
  const verifiedLogin=await signIn();
  assert.equal(verifiedLogin.status,200);
  const verifiedAccount=(await verifiedLogin.json()).account;
  assert.equal(verifiedAccount.emailVerified,true,"confirmed proof must survive a fresh sign-in");
  assert.deepEqual(verifiedAccount.profileListVisibility,{followers:true,following:false});
  f.sqlite.prepare("UPDATE users SET email_verified_at=NULL,email_verification_known=0 WHERE id=?").run(registered.account.id);
  assert.equal((await (await signIn()).json()).account.emailVerified,null,"unknown history must remain unknown at sign-in");
});
