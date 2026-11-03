import {z} from "zod";
import {OFFICIAL_OLDTIME_ACCOUNT_ID} from "@workspace/api-zod/account-policy";
import {ApiError,body,json,rows,type Database} from "./runtime";
const source=`(
 SELECT 'content:'||CAST(c.id AS TEXT) AS report_key,c.kind,c.category,c.reason,c.created_at AS created_at,
 c.post_id,c.comment_id,NULL AS place_id FROM content_reports c
 UNION ALL
 SELECT 'place:'||CAST(r.review_id AS TEXT)||':'||CAST(r.reporter_id AS TEXT) AS report_key,
 'place-review' AS kind,'Place review' AS category,r.reason,r.created_at AS created_at,
 NULL AS post_id,NULL AS comment_id,v.place_id FROM place_review_reports r JOIN place_reviews v ON v.id=r.review_id
)`;
export async function canModerate(db:Database,user:string){
 return user===OFFICIAL_OLDTIME_ACCOUNT_ID||!!(await db.prepare("SELECT 1 FROM moderation_staff WHERE user_id=?").bind(user).first());
}
export async function moderationRequest(request:Request,db:Database,user:string,path:string){
 const allowed=await canModerate(db,user);
 if(path==="/moderation/access"&&request.method==="GET")return json({allowed});
 if(!allowed)throw new ApiError(403,"You don’t have access to the review queue.");
 if(path!=="/moderation/reports")throw new ApiError(404,"This page isn’t available.");
 if(request.method==="GET"){
  const url=new URL(request.url),status=z.enum(["open","reviewed","dismissed","all"]).catch("open").parse(url.searchParams.get("status")),
   offset=Math.max(0,Math.min(100000,Number(url.searchParams.get("offset"))||0));
  const reports=await rows(db,`SELECT q.*,COALESCE(d.status,'open') AS status,COALESCE(d.note,'') AS note
   FROM ${source} q LEFT JOIN moderation_decisions d ON d.report_key=q.report_key
   WHERE (?='all' OR COALESCE(d.status,'open')=?) ORDER BY q.created_at DESC,q.report_key LIMIT 31 OFFSET ?`,status,status,Math.trunc(offset));
  return json({reports:reports.slice(0,30),hasMore:reports.length>30,nextOffset:offset+Math.min(30,reports.length)});
 }
 if(request.method!=="PUT")throw new ApiError(405,"Method not allowed.");
 const input=z.object({key:z.string().regex(/^(content:[\da-f-]{36}|place:[\da-f-]{36}:[\da-f-]{36})$/i),
  status:z.enum(["open","reviewed","dismissed"]),note:z.string().trim().max(500).default("")}).strict().safeParse(await body(request,4096));
 if(!input.success)throw new ApiError(400,"Choose a review action and keep the note under 500 characters.");
 const v=input.data,existing=await db.prepare(`SELECT 1 FROM ${source} q WHERE q.report_key=?`).bind(v.key).first();
 if(!existing)throw new ApiError(404,"This report is no longer available.");
 await db.prepare(`INSERT INTO moderation_decisions(report_key,status,note,moderator_id,updated_at) VALUES(?,?,?,?,?)
 ON CONFLICT(report_key) DO UPDATE SET status=excluded.status,note=excluded.note,moderator_id=excluded.moderator_id,updated_at=excluded.updated_at`)
 .bind(v.key,v.status,v.note,user,Date.now()).run();
 return json({key:v.key,status:v.status,note:v.note});
}
