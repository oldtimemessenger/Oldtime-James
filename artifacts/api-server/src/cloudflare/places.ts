import { createHash } from "node:crypto";
import { SearchPlacesQueryParams } from "@workspace/api-zod";
import { ApiError, bytes, json, object, attribution, type Database } from "./runtime";
import { photonMetadata, rememberPlaces } from "./place-metadata";

export async function searchPlaces(request:Request,db:Database):Promise<Response>{
  if(request.method!=="GET")throw new ApiError(405,"Method not allowed.");
  const parsed=SearchPlacesQueryParams.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!parsed.success || parsed.data.q.trim().length<3)throw new ApiError(400,"Enter at least three letters to search for a place.");
  const {q,lat,lon}=parsed.data,query=q.trim(),now=Date.now();
  // Cache only a hash of the search/broad bias, never an account ID or precise
  // device position. All returned entries are public named places.
  const bias=Number.isFinite(lat)&&Number.isFinite(lon)?[Math.round(lat!*10)/10,Math.round(lon!*10)/10]:null;
  const key=createHash("sha256").update(JSON.stringify(["metadata-v2",query.toLowerCase(),bias])).digest("hex");
  const cached=await db.prepare("SELECT results FROM place_search_cache WHERE cache_key=? AND expires_at>?").bind(key,now).first<{results:string}>();
  if(cached){const result=object(cached.results);await rememberPlaces(db,Array.isArray(result.places)?result.places:[]);return json(result);}
  const day=new Date(now).toISOString().slice(0,10),limitId=`photon:${day}`;
  const budget=await db.prepare(`INSERT INTO external_lookup_limits(id,requests,last_request_at,expires_at) VALUES(?,1,?,?)
    ON CONFLICT(id) DO UPDATE SET requests=requests+1,last_request_at=excluded.last_request_at
    WHERE external_lookup_limits.requests<500 AND external_lookup_limits.last_request_at<=? RETURNING requests`)
    .bind(limitId,now,now+172800000,now-2000).first();
  if(!budget){
    const response=json({error:"Place search is busy. Wait a moment and try again."},429);
    response.headers.set("Retry-After","2");return response;
  }
  const url=new URL("https://photon.komoot.io/api");
  url.searchParams.set("q",query);url.searchParams.set("limit","20");
  if(bias){url.searchParams.set("lat",String(bias[0]));url.searchParams.set("lon",String(bias[1]));}
  let data:Record<string,unknown>;
  try{
    const response=await fetch(url,{headers:{accept:"application/json","user-agent":"Oldtime places search"},signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error("Place provider unavailable.");
    data=object(JSON.parse(new TextDecoder().decode(await bytes(response,250000))));
  }catch{throw new ApiError(503,"Place search is temporarily unavailable. Try again shortly.");}
  const places=[],seen=new Set<string>();
  for(const feature of Array.isArray(data.features)?data.features:[]){
    const f=object(feature),p=object(f.properties),geometry=object(f.geometry),coords=geometry.coordinates;
    if(typeof p.name!=="string"||!p.name.trim()||!["place","amenity","leisure","tourism","shop"].includes(String(p.osm_key))||
      !Array.isArray(coords)||coords.length<2||!Number.isFinite(coords[0])||!Number.isFinite(coords[1]))continue;
    const type=({N:"node",W:"way",R:"relation",node:"node",way:"way",relation:"relation"} as Record<string,string>)[String(p.osm_type)];
    const osmId=String(p.osm_id),latitude=Number(coords[1]),longitude=Number(coords[0]);
    if(!type||!/^\d{1,18}$/.test(osmId)||Math.abs(latitude)>90||Math.abs(longitude)>180)continue;
    const id=`osm:${type}:${osmId}`;
    if(seen.has(id))continue;seen.add(id);
    const name=p.name.trim(),city=typeof p.city==="string"?p.city.trim():"";
    places.push({id,label:(city&&city.toLowerCase()!==name.toLowerCase()?`${name} · ${city}`:name).slice(0,140),source:"osm",lat:latitude,lon:longitude,...photonMetadata(p)});
    if(places.length===12)break;
  }
  const result={places,attribution};
  await rememberPlaces(db,places);
  await db.prepare(`INSERT INTO place_search_cache(cache_key,results,expires_at) VALUES(?,?,?)
    ON CONFLICT(cache_key) DO UPDATE SET results=excluded.results,expires_at=excluded.expires_at`).bind(key,JSON.stringify(result),now+86400000).run();
  return json(result);
}
