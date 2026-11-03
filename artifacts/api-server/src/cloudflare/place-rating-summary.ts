import { rows, type Database } from "./runtime";
export async function placeRatings(db:Database,viewer:string,ids:string[]) {
  if(!ids.length)return new Map<string,{averageRating:number;ratingCount:number}>();
  const records=await rows<{place_id:string;averageRating:number;ratingCount:number}>(db,
    `SELECT r.place_id,avg(r.rating) AS "averageRating",count(*) AS "ratingCount"
     FROM place_reviews r JOIN users u ON u.id=r.user_id
     WHERE r.place_id IN (${ids.map(()=>"?").join(",")}) AND u.is_virtual=0
     AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE
       (b.owner_id=? AND b.blocked_id=r.user_id) OR (b.blocked_id=? AND b.owner_id=r.user_id))
     GROUP BY r.place_id`,...ids,viewer,viewer);
  return new Map(records.map(r=>[r.place_id,{averageRating:Number(r.averageRating),ratingCount:Number(r.ratingCount)}]));
}
