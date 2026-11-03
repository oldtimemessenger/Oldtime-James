import { z } from "zod/v4";
import { normalizeTopicName } from "../../../../lib/discovery-engine/automatic-topics.js";
import { ApiError, body, json, rows, viewerCte, notBlocked, V, type Database } from "./runtime";
import { selectedInterests } from "./recommendation-interests";
import { canModerate } from "./moderation";
import { learnedTopicInterests, recordTopicSignal, setTopicFollow } from "./topic-signals";
import { refreshTopicRegistry, resolveRegisteredTopic, type TopicRow } from "./topic-registry";
function validate<T>(result:{success:true;data:T}|{success:false;error:unknown},message:string):T{
  if(!result.success)throw new ApiError(400,message);
  return result.data;
}

// Reuse the same account controls in discovery; they never change Following.
export const discoveryControlsSql=`p.author_id NOT IN(
  SELECT muted.value FROM community_feed_preferences pref,json_each(pref.data,'$.mutedAccounts') muted WHERE pref.user_id=${V})
  AND NOT EXISTS(SELECT 1 FROM community_feed_preferences pref,json_each(pref.data,'$.mutedWords') word
    WHERE pref.user_id=${V} AND instr(lower(p.text),lower(word.value))>0)`;
export const topicAssociationSql=`(pt.topic_id=t.id OR pt.topic_id IN(SELECT id FROM discovery_topics WHERE merged_into=t.id))`;
export const topicVisibleSql=`EXISTS(SELECT 1 FROM discovery_post_topics pt JOIN posts p ON p.id=pt.post_id
  JOIN users u ON u.id=p.author_id WHERE ${topicAssociationSql}
  AND p.visibility='public' AND p.archived_at IS NULL AND u.is_private=0 AND u.is_virtual=0 AND ${notBlocked} AND ${discoveryControlsSql})`;
export async function canSeeTopic(db:Database,user:string,topicId:string) {
  return !!(await db.prepare(`${viewerCte} SELECT 1 FROM discovery_topics t WHERE t.id=? AND t.status='qualified' AND ${topicVisibleSql}`)
    .bind(user,topicId).first());
}
export async function automaticTopics(db:Database,user:string,{q="",limit=20,personalize=true}:{q?:string;limit?:number;personalize?:boolean}={}) {
  const query=normalizeTopicName(q).slice(0,120);
  const prefs=await db.prepare("SELECT hidden_topics,personalize FROM discovery_preferences WHERE user_id=?").bind(user).first<{hidden_topics:string;personalize:number}>();
  const enabled=personalize&&prefs?.personalize!==0;
  const learned=await learnedTopicInterests(db,user,enabled), explicit=enabled?await selectedInterests(db,user):[];
  const byId=new Map(learned.map(i=>[i.topic_id,i]));
  const interests=explicit.map(normalizeTopicName);
  const pool=await rows<TopicRow&{aliases:string}>(db,`${viewerCte}
    SELECT t.*,coalesce((SELECT group_concat(a.normalized_name,'|') FROM discovery_topic_aliases a WHERE a.topic_id=t.id),'') AS aliases
    FROM discovery_topics t WHERE t.status='qualified'
      AND t.id NOT IN(SELECT coalesce(h.merged_into,h.id) FROM discovery_topics h JOIN json_each(?) v ON v.value=h.id)
      AND (?='' OR instr(t.normalized_name,?)>0 OR EXISTS(SELECT 1 FROM discovery_topic_aliases a WHERE a.topic_id=t.id AND instr(a.normalized_name,?)>0))
      AND ${topicVisibleSql}
    ORDER BY CASE WHEN t.normalized_name=? THEN 0 WHEN substr(t.normalized_name,1,length(?))=? THEN 1 ELSE 2 END,
      t.trend_score DESC,t.last_seen_at DESC,t.id LIMIT 120`,
    user,prefs?.hidden_topics||"[]",query,query,query,query,query,query);
  return pool.map(topic=>{
    const aliases=topic.aliases.split("|"), canonical=normalizeTopicName(topic.label), interest=byId.get(topic.id);
    const explicitMatch=interests.some(i=>canonical===i||aliases.includes(i));
    const relevance=!query?0:canonical===query||aliases.includes(query)?100:canonical.startsWith(query)||aliases.some(a=>a.startsWith(query))?60:30;
    const boost=enabled?(interest?.followed?8:0)+Math.max(-8,Math.min(6,(interest?.score||0)*.4))+(explicitMatch?3:0):0;
    return {topic,relevance,boost,permitted:!!query||((!topic.sensitive||explicitMatch||!!interest?.followed)&&
      ((interest?.score||0)>-4||!!interest?.followed))};
  }).filter(item=>item.permitted)
    .sort((a,b)=>b.relevance-a.relevance||b.boost-a.boost||b.topic.trend_score-a.topic.trend_score||a.topic.id.localeCompare(b.topic.id))
    .slice(0,Math.max(1,Math.min(40,limit))).map(({topic})=>({
      id:topic.id,label:topic.label,postCount:Math.max(1,topic.public_posts),postCountIsLowerBound:!!topic.count_capped||!topic.public_posts,
    }));
}
export async function automaticTopicProfile(db:Database,user:string,id:string) {
  const topic=await resolveRegisteredTopic(db,id);
  if(!topic)throw new ApiError(404,"This topic is not available right now. Try another topic.");
  const visible=await canSeeTopic(db,user,topic.id);
  if(!visible){
    if(!topic.curated)throw new ApiError(404,"This topic is not available right now. Try another topic.");
    return {id:topic.id,label:topic.label,postCount:0,creatorCount:0,followed:false,relatedTopics:[],postCountIsLowerBound:false};
  }
  await refreshTopicRegistry(db,1,Date.now(),topic.id);
  const updated=await resolveRegisteredTopic(db,topic.id)||topic;
  const relationIds=await rows<{id:string}>(db,`SELECT CASE WHEN parent_id=? THEN child_id ELSE parent_id END AS id
    FROM discovery_topic_relations WHERE parent_id=? OR child_id=? LIMIT 12`,topic.id,topic.id,topic.id);
  const available=await automaticTopics(db,user,{limit:40});
  const related=available.filter(t=>relationIds.some(r=>r.id===t.id)).map(({id,label})=>({id,label}));
  const follow=await db.prepare("SELECT followed FROM discovery_topic_user_interests WHERE user_id=? AND topic_id=?").bind(user,topic.id).first<{followed:number}>();
  return {id:topic.id,label:topic.label,postCount:updated.public_posts,postCountIsLowerBound:!!updated.count_capped,
    creatorCount:updated.public_creators,followed:!!follow?.followed,relatedTopics:related};
}
export async function resolveTopicQuery(db:Database,query:string) {
  const alias=await db.prepare("SELECT topic_id FROM discovery_topic_aliases WHERE normalized_name=?").bind(normalizeTopicName(query)).first<{topic_id:string}>();
  return resolveRegisteredTopic(db,alias?.topic_id||query);
}
export async function mergeAutomaticTopic(db:Database,user:string,sourceId:string,targetId:string,reason:string) {
  if(!await canModerate(db,user))throw new ApiError(403,"You don't have access to this action.");
  const source=await resolveRegisteredTopic(db,sourceId),target=await resolveRegisteredTopic(db,targetId);
  if(!source||!target||source.id!==sourceId||source.id===target.id||source.curated||source.status==="merged"||target.status!=="qualified")
    throw new ApiError(400,"Choose two different available topics. Built-in topics cannot be merged.");
  // Original associations and user preferences are retained. Reads resolve
  // redirects, so this merge never rewrites posts or drops historical evidence.
  await db.batch([
    db.prepare("UPDATE discovery_topic_aliases SET topic_id=? WHERE topic_id=?").bind(target.id,source.id),
    db.prepare("UPDATE discovery_topics SET status='merged',merged_into=?,checked_at=? WHERE id=?").bind(target.id,Date.now(),source.id),
    db.prepare("UPDATE discovery_topics SET merged_into=? WHERE merged_into=?").bind(target.id,source.id),
    db.prepare("UPDATE discovery_topics SET checked_at=0 WHERE id=?").bind(target.id),
    db.prepare(`INSERT INTO discovery_topic_user_interests(user_id,topic_id,score,followed,decay_day,updated_at)
      SELECT user_id,?,score,followed,decay_day,updated_at FROM discovery_topic_user_interests WHERE topic_id=?
      ON CONFLICT(user_id,topic_id) DO UPDATE SET followed=max(discovery_topic_user_interests.followed,excluded.followed),
      score=max(discovery_topic_user_interests.score,excluded.score)`).bind(target.id,source.id),
    db.prepare("INSERT INTO discovery_topic_moderation_log(id,actor_id,topic_id,target_id,action,reason,created_at) VALUES(?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),user,source.id,target.id,"merge",reason,Date.now()),
  ]);
  return {topicId:source.id,targetTopicId:target.id};
}
const eventSchema=z.object({topicId:z.string().min(1).max(64),kind:z.enum(["search","visit","watch","like","save","share","dismiss"]),
  postId:z.uuid().optional(),watchMs:z.number().int().min(0).max(3600000).optional()}).strict();
export async function automaticTopicRequest(request:Request,db:Database,user:string,path:string):Promise<Response|null> {
  if(path==="/discovery/topics"&&request.method==="GET"){
    const input=validate(z.object({q:z.string().trim().max(120).default(""),limit:z.coerce.number().int().min(1).max(40).default(20)})
      .safeParse(Object.fromEntries(new URL(request.url).searchParams)),"Choose valid search options.");
    return json({topics:await automaticTopics(db,user,input)});
  }
  const match=path.match(/^\/discovery\/topics\/([^/]+)(?:\/(follow|merge))?$/);
  if(match){
    const id=validate(z.string().min(1).max(64).safeParse(decodeURIComponent(match[1])),"Choose an available topic.");
    if(!match[2]&&request.method==="GET")return json(await automaticTopicProfile(db,user,id));
    if(match[2]==="follow"&&request.method==="PUT"){
      const input=validate(z.object({followed:z.boolean()}).strict().safeParse(await body(request)),"Choose whether to follow this topic.");
      const topic=await resolveRegisteredTopic(db,id);
      if(!topic||!await canSeeTopic(db,user,topic.id))throw new ApiError(404,"This topic is not available right now.");
      return json(await setTopicFollow(db,user,topic.id,input.followed));
    }
    if(match[2]==="merge"&&request.method==="POST"){
      const input=validate(z.object({targetTopicId:z.string().min(1).max(64),reason:z.string().trim().min(3).max(300)}).strict().safeParse(await body(request)),"Choose valid topics and a short reason.");
      return json(await mergeAutomaticTopic(db,user,id,input.targetTopicId,input.reason));
    }
  }
  if(path==="/discovery/topic-events"&&request.method==="POST"){
    const input=validate(eventSchema.safeParse(await body(request)),"Check your selection and try again."),topic=await resolveRegisteredTopic(db,input.topicId);
    if(!topic||!await canSeeTopic(db,user,topic.id))return json({accepted:false});
    if(["watch","like","save","share"].includes(input.kind)&&!input.postId)return json({accepted:false});
    if(input.kind==="watch"&&(input.watchMs||0)<3000)return json({accepted:false});
    if(input.postId){
      const visible=await db.prepare(`${viewerCte} SELECT 1 FROM discovery_post_topics pt JOIN posts p ON p.id=pt.post_id
        JOIN users u ON u.id=p.author_id JOIN discovery_topics t ON t.id=?
        WHERE p.id=? AND ${topicAssociationSql} AND p.visibility='public' AND p.archived_at IS NULL
          AND u.is_private=0 AND u.is_virtual=0 AND ${notBlocked} AND ${discoveryControlsSql}`).bind(user,topic.id,input.postId).first();
      if(!visible)return json({accepted:false});
    }
    return json({accepted:await recordTopicSignal(db,user,topic.id,input.kind)});
  }
  return null;
}
