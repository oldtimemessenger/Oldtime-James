import test from "node:test";
import assert from "node:assert/strict";
import {AVATAR_CHOICES,automaticAvatarChoice,automaticAvatar,avatarImage,resolveProfileAvatar} from "./profile-avatars.js";

test("automatic assignments stay stable and vary between accounts",()=>{
  assert.equal(automaticAvatar("account-12"),automaticAvatar("account-12"));
  const assigned=new Set(Array.from({length:100},(_,i)=>automaticAvatarChoice(`account-${i}`)));
  assert.equal(assigned.size,AVATAR_CHOICES.length);
});
test("every choice is an original self-contained image with no external requests",()=>{
  for(const choice of AVATAR_CHOICES) {
    const svg=decodeURIComponent(avatarImage(choice.id).split(",")[1]);
    assert.match(svg,/<svg/);assert.match(svg,/<clipPath/);
    assert.doesNotMatch(svg,/<script|<image|<foreignObject|href=/);
  }
  assert.throws(()=>avatarImage("unknown"),/Unknown avatar/);
});
test("missing and legacy placeholder pictures receive a stable avatar",()=>{
  assert.equal(resolveProfileAvatar({id:"x",avatar:""},"legacy.svg"),automaticAvatar("x"));
  assert.equal(resolveProfileAvatar({id:"local",cloudAccountId:"remote",avatar:"legacy.svg"},"legacy.svg"),automaticAvatar("remote"));
});
test("uploaded pictures and chosen avatars are never overwritten",()=>{
  for(const image of ["data:image/png;base64,photo","https://example.test/photos/avatar.svg",avatarImage("green")]) {
    assert.equal(resolveProfileAvatar({id:"x",avatar:image},"legacy.svg"),image);
  }
});
