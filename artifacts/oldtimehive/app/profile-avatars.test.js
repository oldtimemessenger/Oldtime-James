import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {AVATAR_CHOICES,automaticAvatarChoice,automaticAvatar,avatarImage,resolveProfileAvatar} from "./profile-avatars.js";
const appSource = readFileSync(new URL("./app.js", import.meta.url), "utf8");

test("automatic assignments stay stable and vary between accounts",()=>{
  assert.equal(automaticAvatar("account-12"),automaticAvatar("account-12"));
  const assigned=new Set(Array.from({length:100},(_,i)=>automaticAvatarChoice(`account-${i}`)));
  assert.equal(assigned.size,AVATAR_CHOICES.length);
});
test("every choice uses stable bundled artwork instead of an uploadable data URL",()=>{
  for(const choice of AVATAR_CHOICES) {
    assert.equal(avatarImage(choice.id), `/brand/avatars/${choice.id}.svg`);
    const svg=readFileSync(new URL(`../public/brand/avatars/${choice.id}.svg`, import.meta.url), "utf8").trim();
    assert.match(svg,/<svg/);assert.match(svg,/<clipPath/);
    assert.doesNotMatch(svg,/<script|<image|<foreignObject|href=/);
    const legacy = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    assert.equal(resolveProfileAvatar({id:"x",avatar:legacy},"legacy.svg"),"");
  }
  assert.throws(()=>avatarImage("unknown"),/Unknown avatar/);
});
test("missing and legacy placeholder pictures receive a stable avatar",()=>{
  assert.equal(resolveProfileAvatar({id:"x",avatar:""},"legacy.svg"),automaticAvatar("x"));
  assert.equal(resolveProfileAvatar({id:"local",cloudAccountId:"remote",avatar:"legacy.svg"},"legacy.svg"),automaticAvatar("remote"));
  assert.match(appSource, /avatar: profile\.avatar \|\| profile\.avatarReference \|\| automaticAvatar\(profile\.id \|\| profile\.username \|\| "oldtime"\)/);
});
test("uploaded pictures are preserved, while generated identities are not displayed",()=>{
  for(const image of ["data:image/png;base64,photo","https://example.test/photos/avatar.svg"]) {
    assert.equal(resolveProfileAvatar({id:"x",avatar:image},"legacy.svg"),image);
  }
  assert.equal(resolveProfileAvatar({id:"x",avatar:avatarImage("green")},"legacy.svg"),"");
  assert.equal(automaticAvatar("any-account"),"");
  assert.doesNotMatch(appSource,/>Choose avatar<|>Use automatic avatar<|>Use automatic cover</);
});
