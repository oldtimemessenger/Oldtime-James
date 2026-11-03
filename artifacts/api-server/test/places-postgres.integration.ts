// Run only against the disposable loopback cluster created for this test.
import {createRequire} from "node:module";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {placeProfileRequest} from "../src/cloudflare/place-profiles";
import {placesPostgres} from "../src/lib/place-postgres";
import {placeTagSchema} from "../src/lib/place-tag";
import {moderationRequest} from "../src/cloudflare/moderation";
import {publicShareData} from "../src/cloudflare/public-share";
const require=createRequire(new URL("../../../lib/db/package.json",import.meta.url));
const {Pool}=require("pg");
const pool=new Pool({host:"127.0.0.1",port:55432,user:"oldtime",database:"postgres"});
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
try{
 await pool.query(`CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY,username text,display_name text,is_private boolean DEFAULT false);
 CREATE TABLE IF NOT EXISTS account_state(user_id uuid PRIMARY KEY,data jsonb);
 CREATE TABLE IF NOT EXISTS posts(id uuid PRIMARY KEY,author_id uuid,place jsonb,visibility text,destination text,created_at timestamptz DEFAULT now());
 CREATE TABLE IF NOT EXISTS account_blocks(owner_id uuid,blocked_id uuid);
 INSERT INTO users(id,username,display_name) VALUES('${a}','first','First'),('${b}','second','Second') ON CONFLICT DO NOTHING;`);
 await pool.query(await readFile(new URL("../../../lib/db/migrations/0026_place_profiles_reviews.sql",import.meta.url),"utf8"));
 await pool.query(await readFile(new URL("../../../lib/db/migrations/0027_saved_places.sql",import.meta.url),"utf8"));
 await pool.query(await readFile(new URL("../../../lib/db/migrations/0028_moderation_queue.sql",import.meta.url),"utf8"));
 await pool.query(`CREATE TABLE IF NOT EXISTS content_reports(id uuid PRIMARY KEY,kind text,category text,reason text,created_at timestamptz DEFAULT now(),post_id text,comment_id text);
 ALTER TABLE posts ADD COLUMN IF NOT EXISTS text text NOT NULL DEFAULT '';`);
 await pool.query(`CREATE TABLE IF NOT EXISTS post_likes(post_id uuid,user_id uuid);
 CREATE TABLE IF NOT EXISTS post_media_assets(post_id uuid,media_id uuid,position integer);
 CREATE TABLE IF NOT EXISTS user_media_assets(id uuid PRIMARY KEY,thumbnail_id uuid,content_type text,ready boolean);`);
 await pool.query(`INSERT INTO places(id,label,category,address,lat,lon,updated_at) VALUES
 ('osm:node:123','Athens Cafe','cafe','Athens, Greece',37.98,23.72,1),
 ('osm:relation:192307','Greece','country','Greece',39,22,1) ON CONFLICT DO NOTHING`);
 const db=placesPostgres(pool);
 async function call(path:string,user:string,method="GET",body?:unknown){
  const req=new Request(`http://local/api${path}`,{method,...(body?{headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{})});
  const response=path.startsWith("/moderation/")?await moderationRequest(req,db,user,path.split("?")[0])
   :path.startsWith("/public/share")?await publicShareData(req,db,false)
   :await placeProfileRequest(req,db,user,path.split("?")[0]);
  assert.equal(response.status,200);return await response.json() as any;
 }
 assert.equal((await call("/places/profile?placeId=osm:relation:192307",a)).place.label,"Greece");
 assert.equal((await call("/places/profile?placeId=osm:relation:192307",a)).canRate,false);
 await call("/places/reviews",a,"PUT",{placeId:"osm:node:123",rating:4,tip:"A lovely cafe",tags:["Food"]});
 const other=await call("/places/profile?placeId=osm:node:123",b);
 assert.equal(other.averageRating,4);assert.equal(other.ratingCount,1);assert.equal(other.reviews[0].author.id,a);
 assert.equal(other.ownReview,null);
 assert.equal(placeTagSchema.safeParse(other.place).success,true,JSON.stringify(placeTagSchema.safeParse(other.place)));
 await call("/places/saved",b,"PUT",{place:other.place});
 assert.equal((await call("/places/profile?placeId=osm:node:123",b)).saved,true);
 assert.equal((await call("/places/saved",b)).places.length,1);
 await call(`/places/reviews/${other.reviews[0].id}/report`,b,"POST",{reason:"Test report"});
 assert.equal(Number((await pool.query("SELECT count(*) FROM place_review_reports")).rows[0].count),1);
 assert.equal((await call("/moderation/access",b)).allowed,false);
 await assert.rejects(call("/moderation/reports",b),{status:403});
 await pool.query("INSERT INTO moderation_staff(user_id) VALUES($1) ON CONFLICT DO NOTHING",[a]);
 const queue=await call("/moderation/reports?status=all",a),report=queue.reports.find((r:any)=>r.kind==="place-review");
 assert.ok(report);
 await call("/moderation/reports",a,"PUT",{key:report.report_key,status:"reviewed",note:"Verified fixture"});
 assert.ok((await call("/moderation/reports?status=reviewed",a)).reports.some((r:any)=>r.report_key===report.report_key&&r.reason===report.reason));
 assert.equal((await call("/public/share?place=osm:relation:192307",a)).title,"Greece");
 console.log("PASS PostgreSQL: additive migration, Greece profile, account A rating read by B, report persistence.");
} finally{await pool.end();}
