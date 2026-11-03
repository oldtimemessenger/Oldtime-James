import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
const accounts=JSON.parse(await readFile("/tmp/oldtime-places-accounts.json","utf8")),
 fixture=JSON.parse(await readFile("/tmp/oldtime-places-fixture.json","utf8")),
 [staff,member]=accounts,base="http://127.0.0.1:8686/api";
const sql=query=>execFileSync("pnpm",["--filter","@workspace/api-server","exec","wrangler","d1","execute","oldtime-app","--local","--persist-to","/tmp/oldtime-release-check","--config","wrangler.toml","--command",query],{stdio:"pipe"});
async function request(path,account=staff,method="GET",body){
 const response=await fetch(base+path,{method,headers:{"authorization":`Bearer ${account.accessToken}`,...(body?{"content-type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 return{status:response.status,body:await response.json()};
}
assert.equal((await request("/moderation/access",member)).body.allowed,false);
assert.equal((await request("/moderation/reports",member)).status,403);
assert.match(staff.account.id,/^[\da-f-]{36}$/i);
sql(`INSERT OR IGNORE INTO moderation_staff(user_id,role) VALUES('${staff.account.id}','reviewer');`);
assert.equal((await request("/moderation/access")).body.allowed,true);
const post=fixture.postIds[0];
const postReport=await request("/account/reports",member,"POST",{kind:"post",category:"spam",postId:post,reason:"Local queue verification: post"});
assert.equal(postReport.status,201);
const comment=await request(`/posts/${post}/comments`,member,"POST",{body:"Local moderation comment"});
assert.ok(comment.status>=200&&comment.status<300);
const commentId=comment.body.id||comment.body.comment?.id;
assert.ok(commentId);
const reply=await request(`/posts/${post}/comments`,member,"POST",{body:"Local reply notification check",parentId:commentId});
assert.equal(reply.status,200);
const notices=await request("/notifications",staff);
assert.equal(notices.status,200);
assert.ok(JSON.stringify(notices.body).includes(`comment:${reply.body.id}`),"A reply notifies the post owner");
const commentReport=await request("/account/reports",staff,"POST",{kind:"comment",category:"spam",postId:post,commentId,reason:"Local queue verification: comment"});
assert.equal(commentReport.status,201);
const queue=await request("/moderation/reports?status=all");
assert.equal(queue.status,200);
for(const kind of ["post","comment","place-review"])assert.ok(queue.body.reports.some(report=>report.kind===kind),`${kind} reaches the queue`);
const review=queue.body.reports.find(report=>report.kind==="place-review");
assert.equal((await request("/moderation/reports",member,"PUT",{key:review.report_key,status:"dismissed"})).status,403);
const saved=await request("/moderation/reports",staff,"PUT",{key:review.report_key,status:"reviewed",note:"Local fixture checked"});
assert.equal(saved.status,200);
const confirmed=await request("/moderation/reports?status=reviewed");
assert.ok(confirmed.body.reports.some(report=>report.report_key===review.report_key&&report.reason===review.reason));
const publicPreview=await fetch(base+`/public/share?place=${encodeURIComponent(fixture.place.id)}`).then(r=>r.json());
assert.equal(publicPreview.title,fixture.place.label);
assert.equal((await fetch(base+`/public/share?post=${post}`)).status,200);
const landing=await request("/places/landing",member);
assert.equal(landing.status,200);
assert.ok(landing.body.landing.loved.some(item=>item.place.id===fixture.place.id));
assert.ok(landing.body.landing.trending.some(item=>item.place.id===fixture.place.id));
const hidden=fixture.postIds[2];
if(hidden)assert.equal((await fetch(base+`/public/share?post=${hidden}`)).status,404);
console.log("PASS local HTTP: post/comment/review reports reach a protected queue; staff decisions persist without rewriting reasons; public post/place previews work and private posts stay hidden.");
