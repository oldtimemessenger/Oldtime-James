import test from "node:test";
import assert from "node:assert/strict";
import {postPublicLink,placePublicLink} from "./public-links.js";
import {sharePage,shareMetadata,onRequest} from "../functions/_middleware.js";
test("post and place links use the existing public website and preserve identifiers",()=>{
 assert.equal(postPublicLink("a","comment").href,"https://heyoldtime.com/p/a?comment=comment");
 assert.equal(new URL(placePublicLink({id:"osm:relation:192307",label:"Greece"})).searchParams.get("label"),"Greece");
});
test("public web pages contain escaped previews and an app link without a redirect loop",()=>{
 const data={title:'Cafe <script>alert(1)</script>',description:'<b>Good</b>',placeId:"osm:node:1",imagePath:"/api/public/share-image?post=one"};
 const html=sharePage(data,new URL("https://heyoldtime.com/place/osm%3Anode%3A1"));
 assert.ok(html.includes('property="og:image"'));assert.ok(html.includes("twitter:card"));
 assert.ok(!html.includes("<script>"));assert.ok(html.includes("/?place=osm%3Anode%3A1"));
 assert.ok(html.includes("OpenStreetMap contributors"));
 assert.ok(shareMetadata(data,new URL("https://heyoldtime.com")).includes("&lt;b&gt;Good"));
});
test("existing pages and API routes remain unchanged by share middleware",async()=>{
 let calls=0;
 await onRequest({request:new Request("https://heyoldtime.com/api/auth/me"),next:()=>{calls++;return new Response("ok");}});
 assert.equal(calls,1);
});
