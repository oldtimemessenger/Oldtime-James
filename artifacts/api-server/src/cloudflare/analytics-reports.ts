import { ApiError, json, object, uuid, type Database } from "./runtime";
import { mirrorPostResources } from "./analytics";
export function reportRange(from:unknown,to:unknown){
  const valid=(v:unknown)=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(new Date(v).getTime())&&new Date(v).toISOString().slice(0,10)===v;
  const end=valid(to)?String(to):new Date().toISOString().slice(0,10),start=valid(from)?String(from):new Date(new Date(end).getTime()-27*86400000).toISOString().slice(0,10);
  const days=(Date.parse(end)-Date.parse(start))/86400000+1;
  return (from!==undefined&&!valid(from))||(to!==undefined&&!valid(to))||days<1||days>90||end>new Date().toISOString().slice(0,10)?null:{from:start,to:end,days};
}
const n=(v:unknown)=>Number(v||0);
const metricSql=(alias="")=>`count(*) FILTER(WHERE ${alias}kind='view') AS views,count(DISTINCT ${alias}actor_id) FILTER(WHERE ${alias}kind='view') AS unique_viewers,
  ${["profile_visit","follow","unfollow","like","comment","share","save"].map((kind,i)=>`count(*) FILTER(WHERE ${alias}kind='${kind}') AS ${["profile_visits","follows","unfollows","likes","comments","shares","saves"][i]}`).join(",")}`;
function metrics(r:Record<string,unknown>={}){
  return {views:n(r.views),uniqueViewers:n(r.unique_viewers),profileVisits:n(r.profile_visits),newFollowers:n(r.follows),unfollows:n(r.unfollows),
    netFollowers:n(r.follows)-n(r.unfollows),likes:n(r.likes),comments:n(r.comments),shares:n(r.shares),saves:n(r.saves)};
}
const playbackSql=`count(*) FILTER(WHERE s.watched_ms>0) AS starts,count(*) FILTER(WHERE s.watched_ms>0 AND r.duration_ms>0) AS known_starts,
  count(*) FILTER(WHERE s.completed=1) AS complete,coalesce(sum(s.watched_ms) FILTER(WHERE s.watched_ms>0),0) AS watch,
  count(*) FILTER(WHERE s.progress>=0.25) AS q25,count(*) FILTER(WHERE s.progress>=0.5) AS q50,count(*) FILTER(WHERE s.progress>=0.75) AS q75,
  count(*) FILTER(WHERE s.completed=1) AS q100`;
function playback(r:Record<string,unknown>={}){
  const starts=n(r.starts),known=n(r.known_starts);
  return {watchTimeMs:starts?n(r.watch):null,averageWatchTimeMs:starts?n(r.watch)/starts:null,completionRate:known?n(r.complete)/known:null,
    retention:known>=10?[{percent:0,value:1},...[25,50,75,100].map(p=>({percent:p,value:n(r[`q${p}`])/known}))]:[]};
}
async function contentReports(db:Database,owner:string,ids:string[],start:number,end:number){
  if(!ids.length)return [];
  const args=[owner,JSON.stringify(ids),start,end];
  const results=await db.batch<Record<string,unknown>>([
    db.prepare(`SELECT r.*,${metricSql("e.")} FROM analytics_resources r LEFT JOIN analytics_events e
      ON e.resource_id=r.id AND e.created_at>=?3 AND e.created_at<?4
      WHERE r.owner_id=?1 AND r.id IN (SELECT value FROM json_each(?2)) AND r.deleted_at IS NULL GROUP BY r.id`).bind(...args),
    db.prepare(`SELECT r.id,${playbackSql} FROM analytics_resources r JOIN analytics_sessions s ON s.resource_id=r.id
      WHERE r.owner_id=?1 AND r.id IN (SELECT value FROM json_each(?2)) AND s.started_at>=?3 AND s.started_at<?4 GROUP BY r.id`).bind(...args),
    db.prepare(`SELECT r.id,e.source,count(*) AS views FROM analytics_resources r JOIN analytics_events e ON e.resource_id=r.id
      WHERE r.owner_id=?1 AND r.id IN (SELECT value FROM json_each(?2)) AND e.kind='view' AND e.created_at>=?3 AND e.created_at<?4
      GROUP BY r.id,e.source ORDER BY views DESC`).bind(...args),
  ]);
  const records=new Map((results[0].results??[]).map(r=>[r.id,r])),watches=new Map((results[1].results??[]).map(r=>[r.id,r]));
  return ids.flatMap(id=>{
    const r=records.get(id);if(!r)return [];
    const m=metrics(r);
    return [{id,sourceId:r.source_id,title:r.title||"Untitled content",kind:r.kind,createdAt:n(r.published_at),...m,follows:m.newFollowers,
      ...playback(watches.get(id)),sources:(results[2].results??[]).filter(s=>s.id===id).map(({id:_,...s})=>s)}];
  });
}
export async function analyticsReportRequest(request:Request,db:Database,owner:string,path:string):Promise<Response>{
  if(request.method!=="GET")throw new ApiError(405,"Method not allowed.");
  const query=Object.fromEntries(new URL(request.url).searchParams),range=reportRange(query.from,query.to);
  if(!range)throw new ApiError(400,"Choose an actual past/current UTC date range of 1–90 days.");
  const start=Date.parse(range.from),end=Date.parse(range.to)+86400000;
  if(path.startsWith("/analytics/content/")){
    const id=path.slice("/analytics/content/".length);
    if(!uuid.test(id))throw new ApiError(400,"Invalid content ID.");
    const [report]=await contentReports(db,owner,[id],start,end);
    if(!report)throw new ApiError(404,"Content not found.");
    return json(report);
  }
  const user=await db.prepare("SELECT account_type FROM users WHERE id=?").bind(owner).first<{account_type:string}>();
  const accountType=user?.account_type??"personal",mode=query.mode??"personal";
  if(!["personal","creator","business"].includes(mode)||mode!=="personal"&&accountType!==mode)throw new ApiError(403,"This dashboard is not available for your account type.");
  await mirrorPostResources(db,owner);
  const previousStart=start-range.days*86400000,page=Math.max(1,Math.min(500,Math.floor(Number(query.page)||1))),type=query.type??"all";
  const sort=query.sort==="views"?"view_count DESC":query.sort==="engagement"?"engagement_count DESC":"r.published_at DESC";
  const result=await db.batch<Record<string,unknown>>([
    db.prepare(`SELECT ${metricSql()} FROM analytics_events WHERE owner_id=? AND created_at>=? AND created_at<?`).bind(owner,start,end),
    db.prepare(`SELECT count(*) AS total FROM user_follows f JOIN users follower ON follower.id=f.follower_id
      WHERE f.followed_id=? AND follower.is_virtual=0`).bind(owner),
    db.prepare(`SELECT day,coalesce(sum(value) FILTER(WHERE kind='view'),0) AS views,
      coalesce(sum(value) FILTER(WHERE kind='profile_visit'),0) AS profileVisits,coalesce(sum(value) FILTER(WHERE kind='follow'),0) AS follows,
      coalesce(sum(value) FILTER(WHERE kind IN ('like','comment','share','save')),0) AS engagement
      FROM analytics_daily WHERE owner_id=? AND day BETWEEN ? AND ? GROUP BY day ORDER BY day`).bind(owner,range.from,range.to),
    db.prepare("SELECT min(created_at) AS first FROM analytics_resources WHERE owner_id=?").bind(owner),
    db.prepare(`SELECT ${metricSql()} FROM analytics_events WHERE owner_id=? AND created_at>=? AND created_at<?`).bind(owner,previousStart,start),
    db.prepare(`SELECT r.id,count(e.id) FILTER(WHERE e.kind='view') AS view_count,count(e.id) FILTER(WHERE e.kind IN ('like','comment','share','save')) AS engagement_count
      FROM analytics_resources r LEFT JOIN analytics_events e ON e.resource_id=r.id AND e.created_at>=? AND e.created_at<?
      WHERE r.owner_id=? AND r.deleted_at IS NULL AND (?='all' OR r.kind=?) GROUP BY r.id ORDER BY ${sort},r.id LIMIT 21 OFFSET ?`)
      .bind(start,end,owner,type,type,(page-1)*20),
    db.prepare(`SELECT CAST(strftime('%w',created_at/1000,'unixepoch') AS INTEGER) AS day,CAST(strftime('%H',created_at/1000,'unixepoch') AS INTEGER) AS hour,count(*) AS events
      FROM analytics_events e WHERE owner_id=? AND created_at>=? AND created_at<? AND ?<>'personal'
      AND EXISTS(SELECT 1 FROM user_follows f WHERE f.followed_id=e.owner_id AND f.follower_id=e.actor_id)
      GROUP BY day,hour HAVING count(DISTINCT actor_id)>=10`).bind(owner,start,end,mode),
    db.prepare(`SELECT ${playbackSql} FROM analytics_sessions s JOIN analytics_resources r ON r.id=s.resource_id
      WHERE r.owner_id=? AND s.started_at>=? AND s.started_at<?`).bind(owner,start,end),
  ]);
  const first=(i:number)=>result[i].results?.[0]??{},m=metrics(first(0)),previous=metrics(first(4)),engagement=m.likes+m.comments+m.shares+m.saves,pe=previous.likes+previous.comments+previous.shares+previous.saves;
  const since=n(first(3).first),compare=(a:number,b:number)=>b>=10&&since&&since<=previousStart?(a-b)/b*100:null;
  const comparison={views:compare(m.views,previous.views),profileVisits:compare(m.profileVisits,previous.profileVisits),newFollowers:compare(m.newFollowers,previous.newFollowers),engagement:compare(engagement,pe)};
  const byDay=new Map((result[2].results??[]).map(r=>[r.day,r]));
  const series=Array.from({length:range.days},(_,i)=>{const day=new Date(start+i*86400000).toISOString().slice(0,10);return byDay.get(day)??{day,views:0,profileVisits:0,follows:0,engagement:0};});
  const content=await contentReports(db,owner,(result[5].results??[]).slice(0,20).map(r=>String(r.id)),start,end);
  const growth:Array<{text:string;reason:string}>=[];
  if(comparison.views!==null)growth.push({text:`Content views ${comparison.views>=0?"increased":"decreased"} ${Math.abs(comparison.views).toFixed(1)}%.`,reason:"Compared with the preceding equal-length period; previous period has at least 10 qualifying views."});
  const ranked=content.filter(c=>c.views>=10).sort((a,b)=>b.views-a.views);
  if(ranked.length>=3)growth.push({text:`“${ranked[0].title}” has the most views among the content shown.`,reason:"Ranks the current page of measured content, not all content or predicted future performance."});
  const {retention:_,...watch}=playback(first(7));
  return json({accountType,range:{from:range.from,to:range.to},overview:{...m,totalFollowers:n(first(1).total),engagementRate:m.views?engagement/m.views:null,...watch},
    comparison,series,content,hasMore:(result[5].results?.length??0)>20,audience:{activity:result[6].results??[],demographicsAvailable:false},growth:mode==="personal"?[]:growth,
    earnings:{available:false,reason:"Creator earnings, gifts, subscriptions and payouts are not operating yet. Blue Badge membership is separate and purchases will be available only in the future mobile app."},
    unavailable:["Historical device counters are not imported as real analytics. These totals cover recorded online activity only.","Private and Close Friends content stays private. Shared server playback analytics is unavailable for device-only private content.","Identifiable profile visitors and demographic reports are not enabled.","Watch-duration retention needs at least 10 measured playback starts; it is not a precise playhead retention measurement.","Follower totals count server-confirmed online follow relationships."],
    definitions:{views:"Actual, qualifying human views only. Image/text views require 2 visible seconds; video views require 3 seconds of playback, or full duration if shorter. Automated interactions do not count as views; self-views are excluded.",
      uniqueViewers:"Distinct signed-in viewers of qualifying views during the selected UTC date range. No visitor identities are exposed.",engagementRate:"Positive likes, comments, shares and saves received divided by qualifying views. Each actor/content/action is counted at most once per UTC day; removals do not erase historical interactions.",
      profileVisits:"Actual human profile navigation only; automated profile lookups do not count as visits. Self-visits are excluded."},trackingSince:since||Date.now()});
}
