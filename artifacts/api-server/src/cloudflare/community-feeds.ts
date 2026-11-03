import { z } from "zod/v4";
import { ApiError, body, json, object, rows, uuid, viewerCte, V, visiblePost, type Database } from "./runtime";
import { hydratePosts, loadPostRows } from "./post-repository";
import { classifyDiscovery } from "../../../../lib/discovery-engine/index.js";
import { selectedInterests, topicMatchesInterests } from "./recommendation-interests";

export const COMMUNITY_FEEDS = ["following", "discover", "popular", "friends", "media"] as const;
const DEFAULT_PINNED_FEEDS = COMMUNITY_FEEDS.filter(feed => feed !== "media");
const feedId = z.string().regex(/^(following|discover|popular|friends|media|list:[a-f0-9-]{36})$/);
const rule = z.object({
  hideReplies: z.boolean().default(false), hideReposts: z.boolean().default(false),
  hideQuotes: z.boolean().default(false), onlyFollowing: z.boolean().default(false),
  language: z.string().regex(/^(all|und|[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/).default("all"),
  includeUnlabelled: z.boolean().default(true),
}).strict();
const preferencesSchema = z.object({
  pinned: z.array(feedId).min(1).max(30),
  filters: z.record(feedId, rule),
  mutedWords: z.array(z.string().trim().min(1).max(80)).max(100),
  mutedAccounts: z.array(z.uuid()).max(200),
}).strict();
const listSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(400).default(""),
  isPublic: z.boolean().default(false),
  members: z.array(z.uuid()).max(200).default([]),
}).strict();
type Preferences = z.infer<typeof preferencesSchema> & { caughtUp: Record<string, number> };
type ListRow = { id:string; owner_id:string; name:string; description:string; is_public:number; created_at:number; updated_at:number };
const follow = `EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=${V} AND f.followed_id=p.author_id)`;
const friend = `EXISTS(SELECT 1 FROM friendships f WHERE
  (f.member_low_id=${V} AND f.member_high_id=p.author_id) OR (f.member_high_id=${V} AND f.member_low_id=p.author_id))`;
const mutual = `(${follow} AND EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=p.author_id AND f.followed_id=${V}))`;
const repost = `EXISTS(SELECT 1 FROM post_reposts r JOIN users ru ON ru.id=r.user_id
  WHERE r.post_id=p.id AND ru.is_virtual=0 AND r.user_id NOT IN (SELECT value FROM json_each(?))
  AND EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=${V} AND f.followed_id=r.user_id)
  AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=${V} AND b.blocked_id=r.user_id) OR (b.blocked_id=${V} AND b.owner_id=r.user_id)))`;

export function isCommunityFeedPath(path:string) { return path.startsWith("/community/"); }
function parse<T>(schema:z.ZodType<T>, value:unknown):T {
  const result=schema.safeParse(value);
  if(!result.success) throw new ApiError(400,"Check these Community feed settings and try again.");
  return result.data;
}
export async function communityPreferences(db:Database,userId:string):Promise<Preferences> {
  const saved=await db.prepare("SELECT data FROM community_feed_preferences WHERE user_id=?").bind(userId).first<{data:string}>();
  const data=object(saved?.data);
  const {caughtUp: _caughtUp,...editable}=data;
  const checked=preferencesSchema.safeParse(editable);
  return { ...(checked.success?checked.data:{pinned:[...DEFAULT_PINNED_FEEDS],filters:{},mutedWords:[],mutedAccounts:[]}),
    caughtUp: Object.fromEntries(Object.entries(object(data.caughtUp)).filter(([key,value])=>feedId.safeParse(key).success&&typeof value==="number"&&Number.isFinite(value))),
  } as Preferences;
}
async function savePreferences(db:Database,userId:string,prefs:Preferences) {
  await db.prepare(`INSERT INTO community_feed_preferences(user_id,data,updated_at) VALUES(?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at`)
    .bind(userId,JSON.stringify(prefs),Date.now()).run();
}
async function accessibleList(db:Database,userId:string,id:string,ownerOnly=false) {
  if(!uuid.test(id))throw new ApiError(400,"Invalid list.");
  const result=await db.prepare(`SELECT l.* FROM community_lists l JOIN users u ON u.id=l.owner_id
    WHERE l.id=? AND u.is_virtual=0 AND (l.owner_id=? OR (l.is_public=1 AND u.is_private=0))
    AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=? AND b.blocked_id=l.owner_id) OR (b.blocked_id=? AND b.owner_id=l.owner_id))`)
    .bind(id,userId,userId,userId).first<ListRow>();
  if(!result)throw new ApiError(404,"That list is unavailable.");
  if(ownerOnly&&result.owner_id!==userId)throw new ApiError(403,"Only the list owner can edit it.");
  return result;
}
async function listDetails(db:Database,userId:string,list:ListRow) {
  const members=await rows<{id:string;username:string;displayName:string}>(db,`SELECT u.id,u.username,u.display_name AS displayName
    FROM community_list_members m JOIN users u ON u.id=m.user_id WHERE m.list_id=? AND u.is_virtual=0
    AND (u.is_private=0 OR u.id=? OR EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=? AND f.followed_id=u.id))
    AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=? AND b.blocked_id=u.id) OR (b.blocked_id=? AND b.owner_id=u.id))
    ORDER BY lower(u.username) LIMIT 200`,list.id,userId,userId,userId,userId);
  const followed=await db.prepare("SELECT 1 FROM community_list_follows WHERE list_id=? AND user_id=?").bind(list.id,userId).first();
  return {id:list.id,ownerId:list.owner_id,name:list.name,description:list.description,isPublic:!!list.is_public,
    owned:list.owner_id===userId,followed:!!followed,members};
}
async function catalog(db:Database,userId:string,search:string) {
  const lists=await rows<ListRow>(db,`SELECT l.* FROM community_lists l JOIN users u ON u.id=l.owner_id WHERE u.is_virtual=0
    AND (l.owner_id=? OR EXISTS(SELECT 1 FROM community_list_follows f WHERE f.list_id=l.id AND f.user_id=?)
      OR (?<>'' AND l.is_public=1 AND u.is_private=0 AND instr(lower(l.name),?)>0))
    AND (l.owner_id=? OR (l.is_public=1 AND u.is_private=0))
    AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=? AND b.blocked_id=l.owner_id) OR (b.blocked_id=? AND b.owner_id=l.owner_id))
    ORDER BY l.updated_at DESC,l.id DESC LIMIT 50`,userId,userId,search,search,userId,userId,userId);
  if(!lists.length)return [];
  const ids=JSON.stringify(lists.map(list=>list.id));
  const [members,follows]=await Promise.all([
    rows<{list_id:string;id:string;username:string;displayName:string}>(db,`SELECT m.list_id,u.id,u.username,u.display_name AS displayName
      FROM community_list_members m JOIN users u ON u.id=m.user_id WHERE m.list_id IN (SELECT value FROM json_each(?)) AND u.is_virtual=0
      AND (u.is_private=0 OR u.id=? OR EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=? AND f.followed_id=u.id))
      AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=? AND b.blocked_id=u.id) OR (b.blocked_id=? AND b.owner_id=u.id))
      ORDER BY lower(u.username)`,ids,userId,userId,userId,userId),
    rows<{list_id:string}>(db,"SELECT list_id FROM community_list_follows WHERE user_id=? AND list_id IN (SELECT value FROM json_each(?))",userId,ids),
  ]);
  const followed=new Set(follows.map(item=>item.list_id));
  return lists.map(list=>({id:list.id,ownerId:list.owner_id,name:list.name,description:list.description,isPublic:!!list.is_public,
    owned:list.owner_id===userId,followed:followed.has(list.id),members:members.filter(m=>m.list_id===list.id).map(({list_id,...member})=>member)}));
}
async function communityFeed(request:Request,db:Database,userId:string) {
  const url=new URL(request.url), active=parse(feedId,url.searchParams.get("feed")||"following");
  const limit=Math.min(30,Math.max(1,Number(url.searchParams.get("limit"))||20));
  const offset=Math.max(0,Number(url.searchParams.get("offset"))||0);
  if(!Number.isInteger(limit)||!Number.isInteger(offset)||offset>10000)throw new ApiError(400,"Invalid feed page.");
  const prefs=await communityPreferences(db,userId), filter=rule.parse(prefs.filters[active]||{});
  const clauses=["p.destination IN ('community','both')"], params:unknown[]=[];
  if(active==="following"){
    clauses.push(filter.hideReposts?follow:`(${follow} OR ${repost})`);
    if(!filter.hideReposts)params.push(JSON.stringify(prefs.mutedAccounts));
  }
  if(active==="discover")clauses.push(`p.visibility='public' AND u.is_private=0 AND p.author_id<>${V} AND NOT (${follow})`);
  if(active==="friends")clauses.push(mutual);
  if(active==="media")clauses.push("EXISTS(SELECT 1 FROM post_media_assets pm JOIN user_media_assets m ON m.id=pm.media_id WHERE pm.post_id=p.id AND m.ready=1 AND (m.content_type LIKE 'image/%' OR m.content_type LIKE 'video/%'))");
  if(active==="popular"){clauses.push("p.created_at>=?");params.push(Date.now()-7*86400000);}
  if(active.startsWith("list:")){
    const list=await accessibleList(db,userId,active.slice(5));
    clauses.push("EXISTS(SELECT 1 FROM community_list_members lm WHERE lm.list_id=? AND lm.user_id=p.author_id)");params.push(list.id);
  }
  if(filter.onlyFollowing)clauses.push(follow);
  if(filter.hideReplies)clauses.push("COALESCE(label.kind,'post')<>'reply'");
  if(filter.hideQuotes)clauses.push("COALESCE(label.kind,'post')<>'quote'");
  if(filter.language!=="all"){
    clauses.push(`(lower(COALESCE(label.language,'und'))=?${filter.includeUnlabelled?" OR COALESCE(label.language,'und')='und'":""})`);
    params.push(filter.language.toLowerCase());
  }
  if(prefs.mutedAccounts.length){
    clauses.push("p.author_id NOT IN (SELECT value FROM json_each(?))");params.push(JSON.stringify(prefs.mutedAccounts));
  }
  if(prefs.mutedWords.length){
    clauses.push("NOT EXISTS(SELECT 1 FROM json_each(?) word WHERE instr(lower(p.text),lower(word.value))>0)");params.push(JSON.stringify(prefs.mutedWords));
  }
  const score=`((SELECT count(*) FROM post_likes l WHERE l.post_id=p.id)
    +2*(SELECT count(*) FROM post_comments c WHERE c.post_id=p.id)
    +3*(SELECT count(*) FROM post_reposts r WHERE r.post_id=p.id)
    +2*(SELECT count(*) FROM post_saves sv WHERE sv.post_id=p.id))`;
  const popularity=`(${score}/(1.0+max(0,(${Date.now()}-p.created_at)/3600000.0)/24.0))`;
  let ids=await rows<{id:string;text:string;author_id:string;created_at:number;engagement:number}>(db,`${viewerCte} SELECT p.id,p.text,p.author_id,p.created_at,${active==="discover"?score:"0"} AS engagement FROM posts p JOIN users u ON u.id=p.author_id
    LEFT JOIN community_post_labels label ON label.post_id=p.id
    WHERE ${visiblePost} AND (${clauses.join(") AND (")})
    ORDER BY ${active==="popular"?`${popularity} DESC,`:""}p.created_at DESC,p.id DESC LIMIT ? OFFSET ?`,userId,...params,active==="discover"?300:limit+1,active==="discover"?0:offset);
  const reasons:Record<string,string>={};
  if(active==="discover"){
    const interests=await selectedInterests(db,userId,true);
    const affinity=new Map(ids.map(post=>{
      const matches=classifyDiscovery({text:post.text}).filter(topic=>topicMatchesInterests(topic.label,interests)||topicMatchesInterests(topic.id,interests));
      reasons[post.id]=matches.length
        ? `Matches your chosen interests: ${matches.map(topic=>topic.label).slice(0,3).join(", ")}. You do not follow this creator.`
        : post.engagement>0?"Public Community post with likes, comments or reposts from someone you do not follow.":"Public Community post from someone you do not follow.";
      const ageHours=Math.max(0,(Date.now()-post.created_at)/3600000);
      return [post.id,matches.length*6+Math.log1p(post.engagement)*1.3+4/(1+ageHours/18)] as const;
    }));
    ids.sort((a,b)=>(affinity.get(b.id)||0)-(affinity.get(a.id)||0)||b.created_at-a.created_at||b.id.localeCompare(a.id));
    // Prefer variety without hiding scarce real content or inventing filler.
    const varied:typeof ids=[];
    while(ids.length){
      const previous=varied.at(-1)?.author_id,twice=previous&&previous===varied.at(-2)?.author_id;
      const next=twice?ids.findIndex(post=>post.author_id!==previous):0;
      varied.push(...ids.splice(Math.max(0,next),1));
    }
    ids=varied;
    ids=ids.slice(offset,offset+limit+1);
  }
  const page=ids.slice(0,limit), records=page.length?await loadPostRows(db,userId,`p.id IN (${page.map(()=>"?").join(",")})`,page.map(p=>p.id),limit):[];
  const posts=await hydratePosts(db,userId,records), byId=new Map(posts.map(p=>[p.id,p]));
  const reason=active==="discover"?"Public Community post from someone you do not follow":
    active==="popular"?"Among the most engaged Community posts published in the last 7 days":null;
  return json({posts:page.map(p=>byId.get(p.id)).filter(Boolean),hasMore:ids.length>limit,nextOffset:offset+page.length,
    feed:active,reason,reasons:Object.fromEntries(page.map(post=>[post.id,reasons[post.id]||reason]).filter((entry):entry is [string,string]=>typeof entry[1]==="string")),
    caughtUpAt:prefs.caughtUp[active]||null,filter,
    languageNote:"Language filters use creator-declared labels. Unlabelled posts are not guessed from their content."});
}
export async function communityFeedRequest(request:Request,db:Database,userId:string,path:string):Promise<Response> {
  const profile=/^\/community\/profile\/([^/]+)$/.exec(path);
  if(profile&&request.method==="GET"){
    if(!uuid.test(profile[1]))throw new ApiError(400,"Invalid profile.");
    const profileOwner=await db.prepare(`SELECT id FROM users u WHERE id=? AND is_virtual=0
      AND (u.id=? OR u.is_private=0 OR EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=? AND f.followed_id=u.id))
      AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=? AND b.blocked_id=u.id) OR (b.blocked_id=? AND b.owner_id=u.id))`)
      .bind(profile[1],userId,userId,userId,userId).first();
    if(!profileOwner)throw new ApiError(404,"This profile is unavailable.");
    const url=new URL(request.url),limit=Math.min(30,Math.max(1,Number(url.searchParams.get("limit"))||20)),offset=Math.max(0,Number(url.searchParams.get("offset"))||0);
    if(!Number.isInteger(limit)||!Number.isInteger(offset)||offset>10000)throw new ApiError(400,"Invalid profile page.");
    const records=await loadPostRows(db,userId,"p.author_id=? AND p.destination IN ('community','both')",[profile[1]],limit+1,offset);
    return json({posts:await hydratePosts(db,userId,records.slice(0,limit)),hasMore:records.length>limit,nextOffset:offset+Math.min(records.length,limit)});
  }
  if(path==="/community/feed"&&request.method==="GET")return communityFeed(request,db,userId);
  if(path==="/community/preferences"){
    if(request.method==="GET"){
      const preferences=await communityPreferences(db,userId);
      const ids=preferences.mutedAccounts;
      const mutedAccounts=ids.length?await rows<{id:string;username:string;displayName:string}>(db,"SELECT id,username,display_name AS displayName FROM users WHERE id IN (SELECT value FROM json_each(?))",JSON.stringify(ids)):[];
      return json({preferences,mutedAccounts});
    }
    if(request.method==="PUT"){
      const input=parse(preferencesSchema,await body(request,32768)),current=await communityPreferences(db,userId);
      const preferences={...input,pinned:[...new Set(input.pinned)],mutedWords:[...new Set(input.mutedWords)],mutedAccounts:[...new Set(input.mutedAccounts)],caughtUp:current.caughtUp};
      // Never permit a stale or private list to become a feed through a forged pin.
      for(const pin of preferences.pinned)if(pin.startsWith("list:"))await accessibleList(db,userId,pin.slice(5));
      await savePreferences(db,userId,preferences);
      return json({preferences});
    }
  }
  if(path==="/community/catch-up"&&request.method==="POST"){
    const {feed}=parse(z.object({feed:feedId}).strict(),await body(request,2048));
    if(feed.startsWith("list:"))await accessibleList(db,userId,feed.slice(5));
    const prefs=await communityPreferences(db,userId),now=Date.now();
    prefs.caughtUp[feed]=now;await savePreferences(db,userId,prefs);
    return json({caughtUpAt:now});
  }
  const languagePath=/^\/community\/posts\/([^/]+)\/language$/.exec(path);
  if(languagePath&&request.method==="PUT"){
    const {language}=parse(z.object({language:z.string().regex(/^(und|[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/)}).strict(),await body(request,2048));
    const post=await db.prepare("SELECT id FROM posts WHERE id=? AND author_id=?").bind(languagePath[1],userId).first();
    if(!post)throw new ApiError(404,"Your post was not found.");
    await db.prepare(`INSERT INTO community_post_labels(post_id,language) VALUES(?,?)
      ON CONFLICT(post_id) DO UPDATE SET language=excluded.language`).bind(languagePath[1],language.toLowerCase()).run();
    return json({language});
  }
  if(path==="/community/lists"){
    if(request.method==="GET")return json({lists:await catalog(db,userId,(new URL(request.url).searchParams.get("q")||"").trim().toLowerCase().slice(0,60))});
    if(request.method==="POST"){
      const input=parse(listSchema,await body(request,32768));
      const count=await db.prepare("SELECT count(*) AS n FROM community_lists WHERE owner_id=?").bind(userId).first<{n:number}>();
      if((count?.n||0)>=30)throw new ApiError(409,"You can create up to 30 lists.");
      const id=crypto.randomUUID(),now=Date.now();
      await db.batch([db.prepare("INSERT INTO community_lists(id,owner_id,name,description,is_public,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
        .bind(id,userId,input.name,input.description,Number(input.isPublic),now,now),
        db.prepare("INSERT INTO community_list_members(list_id,user_id) SELECT ?,u.id FROM users u WHERE u.id IN (SELECT value FROM json_each(?)) AND u.is_virtual=0").bind(id,JSON.stringify(input.members))]);
      return json({list:await listDetails(db,userId,await accessibleList(db,userId,id))},201);
    }
  }
  const match=/^\/community\/lists\/([^/]+)(\/follow)?$/.exec(path);
  if(match){
    const list=await accessibleList(db,userId,match[1]);
    if(match[2]){
      if(request.method==="PUT"){
        await db.prepare("INSERT OR IGNORE INTO community_list_follows(list_id,user_id,created_at) VALUES(?,?,?)").bind(list.id,userId,Date.now()).run();
        return json({followed:true});
      }
      if(request.method==="DELETE"){
        await db.prepare("DELETE FROM community_list_follows WHERE list_id=? AND user_id=?").bind(list.id,userId).run();return json({followed:false});
      }
    }else{
      if(request.method==="GET")return json({list:await listDetails(db,userId,list)});
      if(request.method==="PUT"){
        await accessibleList(db,userId,list.id,true);const input=parse(listSchema,await body(request,32768));
        await db.batch([db.prepare("UPDATE community_lists SET name=?,description=?,is_public=?,updated_at=? WHERE id=? AND owner_id=?")
          .bind(input.name,input.description,Number(input.isPublic),Date.now(),list.id,userId),
          db.prepare("DELETE FROM community_list_members WHERE list_id=?").bind(list.id),
          db.prepare("INSERT INTO community_list_members(list_id,user_id) SELECT ?,u.id FROM users u WHERE u.id IN (SELECT value FROM json_each(?)) AND u.is_virtual=0").bind(list.id,JSON.stringify(input.members))]);
        return json({list:await listDetails(db,userId,await accessibleList(db,userId,list.id))});
      }
      if(request.method==="DELETE"){
        await accessibleList(db,userId,list.id,true);
        await db.prepare("DELETE FROM community_lists WHERE id=? AND owner_id=?").bind(list.id,userId).run();
        return new Response(null,{status:204});
      }
    }
  }
  throw new ApiError(404,"Community feed action not found.");
}
