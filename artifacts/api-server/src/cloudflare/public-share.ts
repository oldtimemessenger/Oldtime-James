import {ApiError,json,object,type Database,type MediaBucket} from "./runtime";
const visible="p.visibility='public' AND p.archived_at IS NULL AND u.is_private=0 AND u.is_virtual=0";
async function imageForPost(db:Database,id:string) {
 return db.prepare(`SELECT m.id,m.object_key,m.content_type FROM posts p JOIN users u ON u.id=p.author_id
 JOIN post_media_assets pm ON pm.post_id=p.id JOIN user_media_assets original ON original.id=pm.media_id
 JOIN user_media_assets m ON m.id=COALESCE(original.thumbnail_id,original.id)
 WHERE p.id=? AND ${visible} AND pm.position=0 AND m.ready=1 AND m.content_type LIKE 'image/%' LIMIT 1`)
 .bind(id).first<{id:string;object_key:string;content_type:string}>();
}
export async function publicShareData(request:Request,db:Database,images=true) {
 const params=new URL(request.url).searchParams,post=params.get("post"),place=params.get("place");
 if(post&&/^[\da-f-]{36}$/i.test(post)){
  const row=await db.prepare(`SELECT p.id,p.text AS caption,u.display_name,u.username FROM posts p JOIN users u ON u.id=p.author_id
   WHERE p.id=? AND ${visible}`).bind(post).first<{id:string;caption:string;display_name:string;username:string}>();
  if(!row)throw new ApiError(404,"This post isn’t available.");
  const image=images?await imageForPost(db,post):null;
  return json({title:`${row.display_name||row.username} on Oldtime`,description:String(row.caption||"View this post on Oldtime.").slice(0,240),
   imagePath:image?`/api/public/share-image?post=${encodeURIComponent(post)}`:"/app-icon-512.png",postId:post});
 }
 if(place&&/^(osm:(node|way|relation):\d{1,18}|custom:[a-z0-9][a-z0-9-]{0,119})$/.test(place)){
  const label=String(params.get("label")||"").slice(0,140);
  const details=await db.prepare("SELECT label,category,address FROM places WHERE id=?").bind(place)
   .first<{label:string;category:string;address:string}>();
  const match="(json_extract(p.place,'$.id')=? OR (? LIKE 'custom:%' AND lower(json_extract(p.place,'$.label'))=lower(?)))";
  const first=await db.prepare(`SELECT p.id,p.place,'' AS location FROM posts p JOIN users u ON u.id=p.author_id
   WHERE ${visible} AND p.destination='main' AND ${match}
   ORDER BY (SELECT count(*) FROM post_likes l WHERE l.post_id=p.id) DESC,p.created_at DESC LIMIT 1`)
   .bind(place,place,label).first<{id:string;place:unknown;location:string}>();
  if(!details&&!first)throw new ApiError(404,"This place isn’t available.");
  const counts=await db.prepare(`SELECT count(*) AS posts,count(DISTINCT p.author_id) AS people FROM posts p JOIN users u ON u.id=p.author_id
   WHERE ${visible} AND p.destination='main' AND ${match}`).bind(place,place,label).first<{posts:number;people:number}>();
  const image=images&&first?await imageForPost(db,first.id):null;
  const legacy=object(first?.place);
  return json({title:details?.label||String(legacy.label||first?.location||label),description:[
   details?.category,details?.address,`${counts?.posts||0} posts · ${counts?.people||0} people`,
  ].filter(Boolean).join(" · ").slice(0,300),placeId:place,
   imagePath:image?`/api/public/share-image?post=${encodeURIComponent(first!.id)}`:"/app-icon-512.png"});
 }
 throw new ApiError(400,"Choose a post or place to share.");
}
export async function publicShareImage(request:Request,db:Database,bucket:MediaBucket){
 const id=new URL(request.url).searchParams.get("post")||"";
 if(!/^[\da-f-]{36}$/i.test(id))throw new ApiError(404,"This image isn’t available.");
 const image=await imageForPost(db,id);
 if(!image)throw new ApiError(404,"This image isn’t available.");
 const stored=await bucket.get(image.object_key);
 if(!stored)throw new ApiError(404,"This image isn’t available.");
 return new Response(stored.body,{headers:{"content-type":image.content_type,"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
