import { z } from "zod/v4";
import { GetExploreDiscoveryResponse, UpdateDiscoveryPreferencesResponse, CorrectDiscoveryPostTopicsResponse } from "@workspace/api-zod";
import {
  normalizeDiscovery, discoveryFtsQuery, discoveryQueryTokens, emergingDiscoveryTopics,
  correctDiscoveryQuery, rankDiscovery, type DiscoveryTopic,
} from "../../../../lib/discovery-engine/index.js";
import { DISCOVERY_VERSION, TOPICS, ensureDiscoveryIndex, discoveryIndexStatements } from "./discovery-index";
import { ApiError, body, json, rows, object, publicDetails, viewerCte, notBlocked, V, type Database } from "./runtime";
import { loadPostRows, hydratePosts, getPost } from "./post-repository";
import { placeTagSchema } from "../lib/place-tag";
import { interestFtsQuery, interestTopicIds, selectedInterests } from "./recommendation-interests";
import { automaticTopics, automaticTopicProfile, automaticTopicRequest, resolveTopicQuery, discoveryControlsSql, canSeeTopic } from "./topic-surfaces";
import { refreshTopicRegistry, resolveRegisteredTopic } from "./topic-registry";
import { learnedTopicInterests } from "./topic-signals";

const topicIds=new Set(TOPICS.map(t=>t.id));
const topicList=z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/,"Choose an existing topic.")).max(24)
  .transform(v=>[...new Set(v)]);
const preferenceSchema=z.object({hiddenTopics:topicList,personalize:z.boolean()}).strict();
const correctionSchema=z.object({excludedTopics:topicList}).strict();
const querySchema=z.object({
  q:z.string().trim().max(120).default(""), topic:z.string().max(64).default(""),
  sort:z.enum(["top","recent","engagement","shuffle"]).default("top"),
  shuffleSeed:z.string().max(48).regex(/^[a-z0-9-]+$/).optional(),
  type:z.enum(["all","videos","photos","posts","people","hashtags","community","places"]).default("all"),
  recommendations:z.enum(["true","false"]).default("false").transform(value=>value==="true"),
  limit:z.coerce.number().int().min(1).max(30).default(24),
  offset:z.coerce.number().int().min(0).max(10000).default(0),
});
type Preference={hiddenTopics:string[];personalize:boolean};
type Candidate={id:string;author_id:string;text:string;body:string;place:string|null;created_at:number;search_rank:number;tags:string};
const WINDOW=72;
function shuffleRank(viewerId:string,seed:string,id:string){
  let hash=2166136261;
  for(const character of `${viewerId}:${seed}:${id}`){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}
function strings(value:string|undefined|null) {
  try {const data=JSON.parse(value??"[]");return Array.isArray(data)?data.filter((v):v is string=>typeof v==="string"):[];}
  catch{return [];}
}
export async function discoveryPreferences(db:Database,userId:string):Promise<Preference> {
  const saved=await db.prepare("SELECT hidden_topics,personalize FROM discovery_preferences WHERE user_id=?")
    .bind(userId).first<{hidden_topics:string;personalize:number}>();
  const ids=strings(saved?.hidden_topics).filter(t=>/^[a-z0-9][a-z0-9-]{0,63}$/.test(t)).slice(0,24);
  const redirects=ids.length?await rows<{id:string;merged_into:string|null}>(db,"SELECT id,merged_into FROM discovery_topics WHERE id IN (SELECT value FROM json_each(?))",JSON.stringify(ids)):[];
  return {hiddenTopics:[...new Set(ids.map(id=>redirects.find(t=>t.id===id)?.merged_into||id))],personalize:saved?!!saved.personalize:true};
}
async function savePreferences(request:Request,db:Database,userId:string) {
  const input=preferenceSchema.safeParse(await body(request));
  if(!input.success)throw new ApiError(400,"Choose valid Explore preferences.");
  await validateTopicIds(db,input.data.hiddenTopics);
  await db.prepare(`INSERT INTO discovery_preferences(user_id,hidden_topics,personalize) VALUES(?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET hidden_topics=excluded.hidden_topics,personalize=excluded.personalize`)
    .bind(userId,JSON.stringify(input.data.hiddenTopics),Number(input.data.personalize)).run();
  return json(UpdateDiscoveryPreferencesResponse.parse({preferences:input.data}));
}
async function validateTopicIds(db:Database,ids:string[]){
  const dynamic=ids.filter(id=>!topicIds.has(id));
  if(!dynamic.length)return;
  const available=await rows<{id:string}>(db,"SELECT id FROM discovery_topics WHERE id IN(SELECT value FROM json_each(?))",JSON.stringify(dynamic));
  if(dynamic.some(id=>!available.some(t=>t.id===id)))throw new ApiError(400,"Choose an available topic.");
}
async function correctTopics(request:Request,db:Database,userId:string,postId:string) {
  const post=await getPost(db,userId,postId);
  if(!post)throw new ApiError(404,"Post not found.");
  if(post.author_id!==userId)throw new ApiError(403,"You can only adjust topics on your own posts.");
  const parsed=correctionSchema.safeParse(await body(request));
  if(!parsed.success)throw new ApiError(400,"Choose valid topic corrections.");
  await validateTopicIds(db,parsed.data.excludedTopics);
  const excluded=parsed.data.excludedTopics;
  await db.batch([
    db.prepare(`INSERT INTO discovery_topic_overrides(post_id,excluded_topics) VALUES(?,?)
      ON CONFLICT(post_id) DO UPDATE SET excluded_topics=excluded.excluded_topics`).bind(postId,JSON.stringify(excluded)),
    ...discoveryIndexStatements(db,post,excluded),
  ]);
  const assigned=await rows<{topic_id:string;label:string;confidence:number}>(db,`SELECT t.id AS topic_id,t.label,pt.confidence
    FROM discovery_post_topics pt JOIN discovery_topics t ON t.id=pt.topic_id WHERE pt.post_id=? AND t.status NOT IN ('merged','suppressed')`,postId);
  return json(CorrectDiscoveryPostTopicsResponse.parse({postId,topics:assigned.map(t=>({id:t.topic_id,label:t.label,confidence:t.confidence})),excludedTopics:excluded}));
}
async function candidates(db:Database,userId:string,options:{
  match:string;topic:string;type:string;hiddenTopics:string[];start:number;
  recommendations?:boolean;
}) {
  const {match,topic,type,hiddenTopics,start,recommendations=false}=options;
  const ftsNeeded=Boolean(match);
  let condition=`p.archived_at IS NULL AND p.visibility='public' AND u.is_private=0 AND ${notBlocked}
    AND u.is_virtual=0 AND ${discoveryControlsSql}
    AND (p.destination='main' OR NOT EXISTS(
      SELECT 1 FROM post_media_assets community_media
      JOIN user_media_assets community_asset ON community_asset.id=community_media.media_id
      WHERE community_media.post_id=p.id AND community_asset.ready=1
        AND (community_asset.content_type LIKE 'image/%' OR community_asset.content_type LIKE 'video/%')))`;
  const values:unknown[]=[userId];
  if(match){condition+=" AND discovery_fts MATCH ?";values.push(match);}
  if(topic){condition+=` AND EXISTS(SELECT 1 FROM discovery_post_topics t WHERE t.post_id=p.id
    AND (t.topic_id=? OR t.topic_id IN(SELECT id FROM discovery_topics WHERE merged_into=?)))`;values.push(topic,topic);}
  if(recommendations){
    condition+=`
      AND p.author_id<>${V}
      AND NOT EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=${V} AND f.followed_id=p.author_id)
      AND NOT EXISTS(SELECT 1 FROM friendships f WHERE
        (f.member_low_id=${V} AND f.member_high_id=p.author_id) OR
        (f.member_high_id=${V} AND f.member_low_id=p.author_id))`;
  }
  if(hiddenTopics.length){
    condition+=` AND NOT EXISTS(SELECT 1 FROM discovery_post_topics t WHERE t.post_id=p.id
      AND (t.topic_id IN(SELECT value FROM json_each(?)) OR t.topic_id IN(
        SELECT id FROM discovery_topics WHERE merged_into IN(SELECT value FROM json_each(?)))))`;
    values.push(JSON.stringify(hiddenTopics),JSON.stringify(hiddenTopics));
  }
  if(type==="community")condition+=" AND p.destination IN ('community','both')";
  if(type==="videos"||type==="photos"){
    condition+=` AND EXISTS(SELECT 1 FROM post_media_assets pm JOIN user_media_assets m ON m.id=pm.media_id
      WHERE pm.post_id=p.id AND m.ready=1 AND m.content_type LIKE ?)`;
    values.push(type==="videos"?"video/%":"image/%");
    if(type==="photos")condition+=` AND NOT EXISTS(SELECT 1 FROM post_media_assets pm JOIN user_media_assets m ON m.id=pm.media_id
      WHERE pm.post_id=p.id AND m.ready=1 AND m.content_type LIKE 'video/%')`;
  }
  if(type==="posts")condition+=" AND NOT EXISTS(SELECT 1 FROM post_media_assets pm WHERE pm.post_id=p.id)";
  if(type==="places")condition+=" AND p.place IS NOT NULL";
  return rows<Candidate>(db,`${viewerCte} SELECT p.id,p.author_id,p.text,p.place,p.created_at,d.body,d.tags,
    ${match?"bm25(discovery_fts,1.0,0.35)":"0"} AS search_rank
    FROM ${ftsNeeded?"discovery_fts JOIN discovery_documents d ON d.rowid=discovery_fts.rowid":"discovery_documents d"}
    JOIN posts p ON p.id=d.post_id JOIN users u ON u.id=p.author_id
    WHERE ${condition} ORDER BY ${match?"search_rank,":""}p.created_at DESC,p.id DESC LIMIT ? OFFSET ?`,
    ...values,WINDOW+1,start);
}
async function discoverPeople(db:Database,userId:string,q:string,authorIds:string[],limit:number,offset:number,topic="") {
  const tokens=discoveryQueryTokens(q);
  const match=tokens.map(t=>`"${t}"*`).join(" AND ");
  let condition=`u.is_private=0 AND u.is_virtual=0 AND NOT EXISTS(SELECT 1 FROM account_blocks b
    WHERE (b.owner_id=${V} AND b.blocked_id=u.id) OR (b.blocked_id=${V} AND b.owner_id=u.id))`;
  const params:unknown[]=[userId];
  if(topic){
    condition+=` AND EXISTS(SELECT 1 FROM posts p JOIN discovery_post_topics pt ON pt.post_id=p.id
      WHERE p.author_id=u.id AND p.visibility='public' AND p.archived_at IS NULL AND ${discoveryControlsSql}
      AND (pt.topic_id=? OR pt.topic_id IN(SELECT id FROM discovery_topics WHERE merged_into=?)))`;
    params.push(topic,topic);
  }
  if(q){
    if(!match&&!authorIds.length)return [];
    condition+=` AND (${match?"u.rowid IN(SELECT rowid FROM discovery_people_fts WHERE discovery_people_fts MATCH ?)":"0"}
      ${authorIds.length?`OR u.id IN (${authorIds.map(()=>"?").join(",")})`:""})`;
    if(match)params.push(match);
    params.push(...authorIds);
  }
  const result=await rows<{id:string;username:string;display_name:string;created_at:number;data:string|null}>(db,`${viewerCte}
    SELECT u.id,u.username,u.display_name,u.created_at,s.data FROM users u LEFT JOIN account_state s ON s.user_id=u.id
    WHERE ${condition} ORDER BY CASE WHEN lower(u.username)=? THEN 0 WHEN lower(u.username) LIKE ? THEN 1 ELSE 2 END,
    u.created_at DESC,u.id DESC LIMIT ? OFFSET ?`,...params,normalizeDiscovery(q),`${normalizeDiscovery(q)}%`,limit+1,offset);
  return result.map(u=>({id:u.id,username:u.username,displayName:u.display_name,joinedAt:u.created_at,...publicDetails(u.data)}));
}
async function explore(request:Request,db:Database,userId:string) {
  const parsed=querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!parsed.success)throw new ApiError(400,"Choose valid Explore filters.");
  const {q,type,limit,offset,recommendations,sort,shuffleSeed}=parsed.data;
  let topic=parsed.data.topic;
  await ensureDiscoveryIndex(db);
  await refreshTopicRegistry(db);
  if(topic){
    const registered=await resolveRegisteredTopic(db,topic);
    if(!registered||registered.status!=="qualified")throw new ApiError(404,"This topic is not available right now. Try another topic.");
    topic=registered.id;
  }
  if(q&&!discoveryFtsQuery(q))throw new ApiError(400,"Use at least two searchable letters or numbers.");
  const preferences=await discoveryPreferences(db,userId);
  const explicit=await selectedInterests(db,userId,preferences.personalize);
  const learned=await learnedTopicInterests(db,userId,preferences.personalize);
  const interests=[...new Set([...explicit,...learned.filter(t=>t.followed||t.score>0).map(t=>t.label)])].slice(0,64);
  const rankingInterests=[...new Set([...interests,...interestTopicIds(interests,preferences.hiddenTopics)])];
  const alias=q&&!topic?await resolveTopicQuery(db,q):null;
  if(alias?.status==="qualified"&&await canSeeTopic(db,userId,alias.id))topic=alias.id;
  const userQuery=alias?.id===topic?"":discoveryFtsQuery(q), recommendationMatch=recommendations?interestFtsQuery(interests):"";
  const match=recommendations&&recommendationMatch
    ? [userQuery,recommendationMatch].filter(Boolean).map(value=>`(${value})`).join(" AND ")
    : userQuery;
  const start=Math.floor(offset/WINDOW)*WINDOW;
  let correctedQuery:string|null=null;
  let found=recommendations&&!preferences.personalize?[]:await candidates(db,userId,{
      match,topic,type,hiddenTopics:preferences.hiddenTopics,start,recommendations,
    });
  if(q&&!found.length&&offset===0&&type!=="people"&&!/^[@#]/.test(q)){
    // Vocabulary is drawn only from this viewer's eligible public posts, never a
    // global FTS vocabulary that could reveal a private/deleted/blocked word.
    const corpus=await candidates(db,userId,{match:"",topic:"",type:"all",hiddenTopics:preferences.hiddenTopics,start:0});
    correctedQuery=correctDiscoveryQuery(q,corpus);
    if(correctedQuery)found=await candidates(db,userId,{match:discoveryFtsQuery(correctedQuery),topic,type,hiddenTopics:preferences.hiddenTopics,start});
    if(!found.length)correctedQuery=null;
  }
  const hasWindowMore=found.length>WINDOW, pool=found.slice(0,WINDOW),ids=pool.map(p=>p.id);
  const assignments=ids.length?await rows<{post_id:string;topic_id:string;label:string;confidence:number}>(db,
    `SELECT pt.post_id,coalesce(t.merged_into,t.id) AS topic_id,coalesce(c.label,t.label) AS label,max(pt.confidence) AS confidence
      FROM discovery_post_topics pt JOIN discovery_topics t ON t.id=pt.topic_id LEFT JOIN discovery_topics c ON c.id=t.merged_into
      WHERE pt.post_id IN (SELECT value FROM json_each(?)) AND t.status<>'suppressed'
      GROUP BY pt.post_id,coalesce(t.merged_into,t.id)`,JSON.stringify(ids)):[];
  const topicFor=(id:string):DiscoveryTopic[]=>assignments.filter(t=>t.post_id===id).map(t=>({
    id:t.topic_id,label:t.label,confidence:t.confidence,
  }));
  const topicCounts=new Map<string,number>();
  for(const t of assignments)topicCounts.set(t.topic_id,(topicCounts.get(t.topic_id)||0)+1);
  const tags=new Map<string,number>(),placeMap=new Map<string,{place:ReturnType<typeof placeTagSchema.parse>;postCount:number}>();
  for(const p of pool){
    for(const tag of new Set(strings(p.tags)))tags.set(tag,(tags.get(tag)||0)+1);
    const place=placeTagSchema.safeParse(object(p.place));
    if(place.success){
      const key=place.data.id||normalizeDiscovery(place.data.label),current=placeMap.get(key);
      placeMap.set(key,{place:place.data,postCount:(current?.postCount||0)+1});
    }
  }
  // Rank within fixed bounded windows so paging does not repeatedly reorder a
  // sliding pool. Engagement is capped/log-scaled and cannot overwhelm relevance.
  const raw=ids.length?await loadPostRows(db,userId,`p.id IN (${ids.map(()=>"?").join(",")}) AND p.visibility='public' AND u.is_private=0`,ids,WINDOW):[];
  const byId=new Map(raw.map(p=>[p.id,p]));
  const rankingInput=pool.map(p=>({
    id:p.id,authorId:p.author_id,text:p.body,createdAt:p.created_at,topics:topicFor(p.id),searchRank:p.search_rank,
    likes:byId.get(p.id)?.like_count||0,reposts:byId.get(p.id)?.repost_count||0,comments:byId.get(p.id)?.comment_count||0,
  }));
  const activeShuffleSeed=shuffleSeed||String(Math.floor(Date.now()/86400000));
  const ranked=sort==="recent"
    ?rankingInput
    :sort==="engagement"
      ?[...rankingInput].sort((a,b)=>(b.likes+2*b.reposts+1.4*b.comments)-(a.likes+2*a.reposts+1.4*a.comments)
        ||b.createdAt-a.createdAt||a.id.localeCompare(b.id))
      :sort==="shuffle"
        ?[...rankingInput].sort((a,b)=>shuffleRank(userId,activeShuffleSeed,a.id)
          -shuffleRank(userId,activeShuffleSeed,b.id)||a.id.localeCompare(b.id))
        :rankDiscovery(rankingInput,{query:correctedQuery||alias?.label||q,interests:rankingInterests,now:Math.floor(Date.now()/3600000)*3600000});
  const localOffset=offset-start,pageIds=ranked.slice(localOffset,localOffset+limit).map(p=>p.id);
  const showPosts=!["people","hashtags","places"].includes(type);
  const posts=showPosts?await hydratePosts(db,userId,pageIds.flatMap(id=>byId.has(id)?[byId.get(id)!]:[])):[];
  const peopleLimit=type==="people"?limit:6;
  const people=!recommendations&&(type==="all"||type==="people")?await discoverPeople(db,userId,topic?"":q,[...new Set(pool.map(p=>p.author_id))].slice(0,72),peopleLimit,type==="people"?offset:0,topic):[];
  const emerging=emergingDiscoveryTopics(pool.map(p=>({id:p.id,authorId:p.author_id,text:p.body})));
  const overrides=pageIds.length?await rows<{post_id:string;excluded_topics:string}>(db,`SELECT o.post_id,o.excluded_topics
    FROM discovery_topic_overrides o JOIN posts p ON p.id=o.post_id WHERE p.author_id=? AND o.post_id IN (${pageIds.map(()=>"?").join(",")})`,userId,...pageIds):[];
  const nextOffset=type==="people"?offset+Math.min(people.length,limit):start+localOffset+pageIds.length;
  return json(GetExploreDiscoveryResponse.parse({
    posts,people:people.slice(0,peopleLimit),
    places:(type==="all"||type==="places")?[...placeMap.values()].sort((a,b)=>b.postCount-a.postCount).slice(0,24):[],
    hashtags:(type==="all"||type==="hashtags")?[...tags].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,24).map(([tag,postCount])=>({tag,postCount})):[],
    topics:await automaticTopics(db,userId,{q,limit:20}),
    topicOptions:await automaticTopics(db,userId,{limit:32}),
    emergingTopics:emerging,
    relatedSearches:q?emerging.filter(t=>!normalizeDiscovery(q).includes(t.label)).map(t=>t.label).slice(0,6):[],
    postTopics:posts.map(p=>({postId:p.id,topics:topicFor(p.id),excludedTopics:strings(overrides.find(o=>o.post_id===p.id)?.excluded_topics)})),
    preferences,correctedQuery,algorithmVersion:DISCOVERY_VERSION,
    hasMore:type==="people"?people.length>limit:showPosts&&(hasWindowMore||localOffset+pageIds.length<pool.length),
    nextOffset,...(topic?{selectedTopic:await automaticTopicProfile(db,userId,topic)}:{}),
  }));
}
export async function exploreRequest(request:Request,db:Database,userId:string,path:string):Promise<Response|null> {
  if(path.startsWith("/discovery/topics")||path==="/discovery/topic-events"){
    if(request.method==="GET"){await ensureDiscoveryIndex(db);await refreshTopicRegistry(db);}
    const response=await automaticTopicRequest(request,db,userId,path);
    if(response)return response;
  }
  if(path==="/discovery/explore"&&request.method==="GET")return explore(request,db,userId);
  if(path==="/discovery/preferences"&&request.method==="PUT")return savePreferences(request,db,userId);
  const match=/^\/discovery\/posts\/([a-f0-9-]{36})\/topics$/.exec(path);
  if(match&&request.method==="PUT")return correctTopics(request,db,userId,match[1]);
  return null;
}
