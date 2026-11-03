import {test} from "node:test";
import assert from "node:assert/strict";
import {mappedPlaceSuggestions,mergePlaceResults} from "./place-suggestions.js";
test("mapped suggestions begin at three letters and reuse long-lived cached results",async()=>{
 let calls=0;const request=async()=>{calls++;return{places:[{id:"osm:node:1",label:"Athens"}]};};
 assert.deepEqual(await mappedPlaceSuggestions("At",request),[]);
 await mappedPlaceSuggestions("Athens",request);await mappedPlaceSuggestions("ATHENS",request);
 assert.equal(calls,1);
});
test("tagged places precede mapped suggestions without duplicates",()=>{
 const tagged=[{place:{id:"a"},postCount:2}],mapped=[{id:"a"},{id:"b"}];
 assert.deepEqual(mergePlaceResults(tagged,mapped).map(v=>v.place.id),["a","b"]);
});
