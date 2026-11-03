import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("./app.js",import.meta.url),"utf8");
const load=(name,api)=>{
  const definition=source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0];
  assert.ok(definition,`${name} exists`);
  return Function("api",`return (${definition})`)(api);
};
test("place cards use the supported user lookup and preserve the creator's display name",()=>{
  const person=load("placeCardPerson",{user(id){assert.equal(id,"cloud:creator");return{id,name:"Casey",username:"casey",avatar:"photo"}}});
  assert.equal(person({author:"cloud:creator",authorId:"remote-id"}).displayName,"Casey");
});
test("place cards read confirmed current counts instead of an older feed snapshot",()=>{
  const original={id:"post",likeCount:0,commentCount:0,placeRating:{averageRating:4}};
  const current=load("placeCardPost",{
    cloudPost:()=>({id:"post",likeCount:2,commentCount:1,likes:["owner"]}),me:()=>({id:"owner"}),
  })(original);
  assert.equal(current.likeCount,2);assert.equal(current.commentCount,1);assert.equal(current.liked,true);
  assert.equal(current.placeRating.averageRating,4);assert.equal(original.commentCount,0);
});
