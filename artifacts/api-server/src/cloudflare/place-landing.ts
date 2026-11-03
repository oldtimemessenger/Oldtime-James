import {json,object,rows,type Database} from "./runtime";
import {placeRatings} from "./place-rating-summary";
import {canRatePlace} from "../lib/place-policy";

const attribution={text:"© OpenStreetMap contributors",url:"https://www.openstreetmap.org/copyright"};
const interests:Record<string,string[]>={
 food:["restaurant","cafe","bakery","food"],travel:["city","country","attraction","hotel"],
 nature:["park","garden","nature","beach"],fitness:["park","gym","fitness"],
 art:["museum","gallery","art"],music:["music","concert","theatre"],
};
export async function placeLanding(request:Request,db:Database,userId:string){
 const params=new URL(request.url).searchParams;
 const lat=params.has("lat")?Number(params.get("lat")):NaN,lon=params.has("lon")?Number(params.get("lon")):NaN;
 const located=Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lon)&&Math.abs(lon)<=180;
 const week=Date.now()-7*86400000;
 const records=await rows<Record<string,unknown>>(db,`
 WITH eligible AS (
  SELECT p.id,p.place,p.author_id,p.created_at AS created_at,
   ROW_NUMBER() OVER(PARTITION BY json_extract(p.place,'$.id')
    ORDER BY (SELECT count(*) FROM post_likes l WHERE l.post_id=p.id) DESC,p.created_at DESC,p.id) AS rank,
   CASE WHEN EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=? AND f.followed_id=p.author_id) THEN 1 ELSE 0 END AS followed,
   (SELECT count(*) FROM post_comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=p.id AND u.is_virtual=0
    AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=? AND b.blocked_id=c.user_id) OR (b.owner_id=c.user_id AND b.blocked_id=?))) AS comment_count
  FROM posts p JOIN users u ON u.id=p.author_id
  WHERE p.place IS NOT NULL AND p.archived_at IS NULL AND p.visibility='public' AND p.destination='main'
   AND u.is_private=0 AND u.is_virtual=0
   AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=? AND b.blocked_id=p.author_id) OR (b.owner_id=p.author_id AND b.blocked_id=?))
 ), stats AS (
  SELECT json_extract(e.place,'$.id') AS place_id,count(*) AS post_count,count(DISTINCT e.author_id) AS people_count,
   sum(CASE WHEN e.created_at>=? THEN 1 ELSE 0 END) AS week_posts,sum(e.followed) AS followed_posts,max(e.created_at) AS latest_at
  FROM eligible e GROUP BY json_extract(e.place,'$.id')
 )
 SELECT s.*,e.place,e.id AS featured_post_id,e.comment_count,
  CASE WHEN m.content_type LIKE 'video/%' THEN COALESCE(m.thumbnail_id,m.id) ELSE m.id END AS preview_id,
  m.content_type FROM stats s JOIN eligible e ON json_extract(e.place,'$.id')=s.place_id AND e.rank=1
 LEFT JOIN post_media_assets pm ON pm.post_id=e.id AND pm.position=0
 LEFT JOIN user_media_assets m ON m.id=pm.media_id AND m.ready=1
 ORDER BY s.post_count DESC,s.latest_at DESC LIMIT 48`,
 userId,userId,userId,userId,userId,week);
 const ids=records.map(r=>String(r.place_id));
 const [ratings,saves,state]=await Promise.all([
  placeRatings(db,userId,ids),
  ids.length?rows<{place_id:string;total:number;mine:number}>(db,`SELECT place_id,count(*) AS total,
   max(CASE WHEN user_id=? THEN 1 ELSE 0 END) AS mine FROM saved_places
   WHERE place_id IN (${ids.map(()=>"?").join(",")}) GROUP BY place_id`,userId,...ids):[],
  db.prepare("SELECT data FROM account_state WHERE user_id=?").bind(userId).first<{data:unknown}>(),
 ]);
 const saved=new Map(saves.map(r=>[r.place_id,{total:Number(r.total),mine:Number(r.mine)}]));
 const preferences=object(state?.data),me=object(preferences.me);
 const selected=Array.isArray(preferences.interests)?preferences.interests:Array.isArray(me.interests)?me.interests:[];
 const wanted=selected.flatMap(value=>interests[String(value)]||[String(value).toLowerCase()]);
 const places=records.map(r=>{
  const place=object(r.place),id=String(place.id||"");
  return{place,postCount:Number(r.post_count),creatorCount:Number(r.people_count),latestAt:Number(r.latest_at),
   featuredPostId:String(r.featured_post_id),commentCount:Number(r.comment_count),
   previewReference:r.preview_id?`oldtime-media:${r.preview_id}`:null,
   previewType:r.content_type?String(r.content_type).startsWith("video/")?"video":"image":null,
   placeRating:canRatePlace(place as never)?ratings.get(id)||null:null,
   _week:Number(r.week_posts),_followed:Number(r.followed_posts),_saved:saved.get(id)||{total:0,mine:0}};
 });
 const categories=new Set(places.filter(p=>p._saved.mine).map(p=>String(p.place.category||"").toLowerCase()).filter(Boolean));
 const score=(p:typeof places[number])=>p._followed*3+p._saved.mine*4
  +(categories.has(String(p.place.category||"").toLowerCase())?2:0)
  +wanted.filter(term=>`${p.place.label} ${p.place.category} ${p.place.city}`.toLowerCase().includes(term)).length*2;
 const distance=(p:typeof places[number])=>{
  if(p.place.lat==null||p.place.lon==null)return Infinity;
  const a=Number(p.place.lat),b=Number(p.place.lon),rad=Math.PI/180;
  if(!Number.isFinite(a)||!Number.isFinite(b))return Infinity;
  const h=Math.sin((a-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(a*rad)*Math.sin((b-lon)*rad/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
 };
 const clean=(p:typeof places[number])=>{const{_week,_followed,_saved,...item}=p;return item};
 const loved=[...places].sort((a,b)=>(b.placeRating?.averageRating||0)*Math.log2((b.placeRating?.ratingCount||0)+1)
  +Math.log2(b._saved.total+1)*2-(a.placeRating?.averageRating||0)*Math.log2((a.placeRating?.ratingCount||0)+1)
  -Math.log2(a._saved.total+1)*2||b.postCount-a.postCount);
 return json({places:places.map(clean),landing:{
  loved:loved.slice(0,12).map(clean),
  nearby:located?[...places].filter(p=>distance(p)<=100).sort((a,b)=>distance(a)-distance(b)).slice(0,12).map(clean):[],
  suggested:[...places].sort((a,b)=>score(b)-score(a)||b.postCount-a.postCount).slice(0,12).map(clean),
  trending:[...places].filter(p=>p._week>0).sort((a,b)=>b._week-a._week||b.postCount-a.postCount).slice(0,12).map(clean),
 },attribution});
}
