// Public mapped places only. Debounce at the UI; the server retains its daily cap.
const cache = new Map();
export async function mappedPlaceSuggestions(query, request) {
  const q=String(query||"").trim();
  if(q.length<3||q.startsWith("#"))return [];
  const key=q.toLowerCase(),hit=cache.get(key);
  if(hit&&hit.expires>Date.now())return hit.places;
  const result=await request(`/api/places/search?q=${encodeURIComponent(q)}`);
  const places=Array.isArray(result?.places)?result.places:[];
  if(cache.size>=100)cache.delete(cache.keys().next().value);
  cache.set(key,{places,expires:Date.now()+86400000});
  return places;
}
export function mergePlaceResults(tagged=[],mapped=[]) {
  const seen=new Set();
  return [...tagged,...mapped.map(place=>({place,postCount:0,creatorCount:0,previewReference:null,previewType:null}))]
    .filter(item=>item?.place?.id&&!seen.has(item.place.id)&&seen.add(item.place.id));
}
