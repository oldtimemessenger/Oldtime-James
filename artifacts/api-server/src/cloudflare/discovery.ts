import {
  ListSuggestedPeopleQueryParams, ListTrendingTopicsResponse, ListTrendingVideosResponse,
  ListSuggestedPeopleResponse, ListTrendingTopicPostsParams, ListTrendingTopicPostsQueryParams,
} from "@workspace/api-zod";
import { ApiError, json, rows, object, publicDetails, viewerCte, notBlocked, V, type Database } from "./runtime";
import { loadPostRows, hydratePosts } from "./post-repository";
import { TOPICS, classifyDiscovery } from "../../../../lib/discovery-engine/index.js";
import { exploreRequest, discoveryPreferences } from "./explore";
import { selectedInterests, topicMatchesInterests } from "./recommendation-interests";
import { normalizeDiscovery } from "../../../../lib/discovery-engine/index.js";
import { automaticTopics } from "./topic-surfaces";
import { ensureDiscoveryIndex } from "./discovery-index";
import { refreshTopicRegistry, resolveRegisteredTopic, type TopicRow } from "./topic-registry";

// Deterministic words only. No AI requests, external classification or inferred
// private profile interests. Hashtags remain optional.
const topics:Record<string,string[]>=Object.fromEntries(TOPICS.map(t=>[t.id,[t.id,...t.terms]]));
function topicNames(text:string){
  const result=new Set((text.match(/#[\p{L}\p{N}_]+/gu)??[]).map(t=>t.toLowerCase()));
  for(const topic of classifyDiscovery({text}))result.add(`#${topic.id}`);
  return result;
}
async function trending(request:Request,db:Database,userId:string){
  const personalized=new URL(request.url).searchParams.get("personalized")==="true",now=Date.now();
  await ensureDiscoveryIndex(db);await refreshTopicRegistry(db,8,now);
  const available=await automaticTopics(db,userId,{limit:40,personalize:personalized});
  const snapshots=await rows<TopicRow>(db,"SELECT * FROM discovery_topics WHERE id IN(SELECT value FROM json_each(?))",JSON.stringify(available.map(t=>t.id)));
  const ranked=available.flatMap(option=>{
    const t=snapshots.find(s=>s.id===option.id);
    if(!t||t.recent_creators<2||t.recent_posts<2)return [];
    const count=t.recent_posts,previous=t.previous_posts,change=previous?Math.max(0,Math.round((count-previous)/previous*100)):0;
    return [{topic:`#${TOPICS.some(s=>s.id===t.id)?t.id:t.label}`,postCount:count,creatorCount:t.recent_creators,
      engagementCount:t.recent_engagement,changePercent:change,
      direction:previous===0?"new":count>previous*1.2?"rising":count<previous*.8?"cooling":"steady"}];
  }).slice(0,20);
  return json(ListTrendingTopicsResponse.parse({topics:ranked,window:"24h",generatedAt:now}));
}
async function people(request:Request,db:Database,userId:string){
  const params=ListSuggestedPeopleQueryParams.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!params.success)throw new ApiError(400,"Choose valid discovery filters.");
  const {limit,offset,category}=params.data;
  const own=await db.prepare("SELECT data FROM account_state WHERE user_id=?").bind(userId).first<{data:string}>();
  const profile=object(object(own?.data).profile),preferences=await discoveryPreferences(db,userId);
  const interests=new Set((await selectedInterests(db,userId,preferences.personalize)).map(i=>normalizeDiscovery(i)));
  const candidates=await rows<{id:string;username:string;display_name:string;created_at:number;data:string|null;mutual:number;followers:number}>(db,`
    ${viewerCte} SELECT u.id,u.username,u.display_name,u.created_at,s.data,
      (SELECT count(*) FROM user_follows theirs JOIN user_follows own ON own.followed_id=theirs.followed_id
        WHERE theirs.follower_id=u.id AND own.follower_id=${V}) AS mutual,
      (SELECT count(*) FROM user_follows followers WHERE followers.followed_id=u.id) AS followers
    FROM users u LEFT JOIN account_state s ON s.user_id=u.id WHERE u.id<>${V} AND u.is_virtual=0 AND u.is_private=0
      AND NOT EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=${V} AND f.followed_id=u.id)
      AND NOT EXISTS(SELECT 1 FROM friendships f WHERE
        (f.member_low_id=${V} AND f.member_high_id=u.id) OR (f.member_high_id=${V} AND f.member_low_id=u.id))
      AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=${V} AND b.blocked_id=u.id) OR (b.blocked_id=${V} AND b.owner_id=u.id))
    ORDER BY u.created_at DESC LIMIT 200`,userId);
  const suggestions=candidates.flatMap(c=>{
    const details=publicDetails(c.data),candidateInterests=Array.isArray(details.interests)?details.interests.map(i=>normalizeDiscovery(String(i))):[];
    if(category&&!candidateInterests.some(i=>(topics[category]??[category]).some(needle=>i.includes(needle))))return [];
    const sharedInterests=[...interests].filter(i=>candidateInterests.includes(i)).slice(0,3);
    const sameCity=typeof profile.city==="string"&&typeof details.city==="string"&&profile.city.trim().toLowerCase()===details.city.trim().toLowerCase();
    const reason=c.mutual>0?"mutual-followers":sharedInterests.length?"shared-interests":sameCity?"same-city":"new-to-oldtime";
    return [{profile:{id:c.id,username:c.username,displayName:c.display_name,joinedAt:c.created_at,...details},mutualFollowCount:c.mutual,sharedInterests,sameCity,reason,
      score:c.mutual*3+sharedInterests.length*2+Number(sameCity)+Number(c.created_at>Date.now()-1209600000)*.5+
        Math.max(0,1-Math.log1p(c.followers)/Math.log1p(10000))*.35}];
  }).sort((a,b)=>b.score-a.score||b.profile.joinedAt-a.profile.joinedAt);
  const page=suggestions.slice(offset,offset+limit);
  return json(ListSuggestedPeopleResponse.parse({suggestions:page.map(({score:_,...s})=>s),hasMore:offset+page.length<suggestions.length,nextOffset:offset+page.length}));
}
export async function discoveryRequest(request:Request,db:Database,userId:string,path:string):Promise<Response>{
  const ecosystem=await exploreRequest(request,db,userId,path);
  if(ecosystem)return ecosystem;
  if(request.method!=="GET")throw new ApiError(405,"Method not allowed.");
  if(path==="/discovery/trending")return trending(request,db,userId);
  if(path==="/discovery/people")return people(request,db,userId);
  if(path==="/discovery/trending-videos"){
    const candidates=await loadPostRows(db,userId,`p.visibility='public' AND u.is_private=0 AND u.is_virtual=0 AND p.destination='main' AND p.created_at>?
      AND EXISTS(SELECT 1 FROM post_media_assets pm JOIN user_media_assets m ON m.id=pm.media_id WHERE pm.post_id=p.id AND m.ready=1 AND m.content_type LIKE 'video/%')`,[Date.now()-604800000],48);
    const posts=await hydratePosts(db,userId,candidates);
    const ranked=posts.map(p=>({post:p,score:(p.likeCount+2*p.repostCount+1.4*p.commentCount+1)/Math.pow(Math.max(1,(Date.now()-p.createdAt)/3600000)+2,.72)}))
      .sort((a,b)=>b.score-a.score);
    const counts=new Map<string,number>(),videos=[];
    for(const {post} of ranked){const n=counts.get(post.author.id)??0;if(n>=2)continue;counts.set(post.author.id,n+1);videos.push(post);if(videos.length===12)break;}
    return json(ListTrendingVideosResponse.parse({videos,window:"7d",generatedAt:Date.now()}));
  }
  const match=/^\/discovery\/trending\/([^/]+)\/posts$/.exec(path);
  const parsed=match?ListTrendingTopicPostsParams.safeParse({topic:decodeURIComponent(match[1])}):null;
  const params=ListTrendingTopicPostsQueryParams.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!parsed?.success||!params.success)throw new ApiError(400,"The topic request is invalid.");
  const name=parsed.data.topic.replace(/^#/,"").toLowerCase(),terms=topics[name]??[name],{limit,offset}=params.data;
  const registered=await resolveRegisteredTopic(db,parsed.data.topic.replace(/^#/,""));
  if(registered&&!registered.curated&&registered.status!=="qualified")throw new ApiError(404,"This topic is not available yet.");
  const topicCondition=registered
    ?"EXISTS(SELECT 1 FROM discovery_post_topics dpt WHERE dpt.post_id=p.id AND dpt.topic_id=?)"
    :`(${terms.map(()=>"instr(lower(p.text),?)>0").join(" OR ")})`;
  const records=await loadPostRows(db,userId,`p.visibility='public' AND u.is_private=0 AND u.is_virtual=0
    AND p.destination='main'
    AND ${topicCondition}`,registered?[registered.id]:terms,limit+1,offset);
  return json({posts:await hydratePosts(db,userId,records.slice(0,limit)),hasMore:records.length>limit,nextOffset:offset+Math.min(limit,records.length)});
}
