import { automaticTopicCandidates, topicLookupKeys, topicFingerprint, normalizeTopicName, TOPIC_SYNONYMS,
  TOPIC_POLICY, topicQualifies, topicTrendScore, type TopicPolicy } from "../../../../lib/discovery-engine/automatic-topics.js";
import { object, rows, type Database, type Statement } from "./runtime";

export interface TopicRow {
  id:string;label:string;normalized_name:string;status:string;curated:number;sensitive:number;merged_into:string|null;
  created_at:number;last_seen_at:number;checked_at:number;public_posts:number;public_creators:number;count_capped:number;trend_score:number;
  recent_posts:number;previous_posts:number;recent_creators:number;recent_engagement:number;
}
const eligible = `EXISTS(SELECT 1 FROM posts p JOIN users u ON u.id=p.author_id
  WHERE p.id=? AND p.visibility='public' AND p.archived_at IS NULL AND u.is_private=0 AND u.is_virtual=0)`;
const synonyms = JSON.stringify(TOPIC_SYNONYMS.map(([label,id])=>({id,label,key:normalizeTopicName(label)})));
const relations = JSON.stringify([{parent:"nba",child:"nba-league"},{parent:"nba-league",child:"lakers"}]);

export function topicRegistryStatements(db:Database,post:{id:string;text:string;place?:string|null},excluded:string[]=[]):Statement[] {
  const input={text:post.text,place:post.place?object(post.place):null};
  const candidates=automaticTopicCandidates(input,excluded), data=JSON.stringify(candidates), now=Date.now();
  // A registered single-word alias is not enough evidence for an unfamiliar
  // ordinary noun. Explicit hashtags and reliable rules remain eligible.
  const keys=JSON.stringify(topicLookupKeys(post.text).filter(key=>key.includes(" ")));
  return [
    db.prepare(`INSERT INTO discovery_topics(id,label,normalized_name,status,curated,sensitive,created_at,last_seen_at,registered_by)
      SELECT json_extract(value,'$.id'),json_extract(value,'$.label'),json_extract(value,'$.normalized'),
        CASE WHEN json_extract(value,'$.curated') THEN 'qualified' ELSE 'candidate' END,
        json_extract(value,'$.curated'),json_extract(value,'$.sensitive'),?,?,
        (SELECT author_id FROM posts WHERE id=?)
      FROM json_each(?) j WHERE ${eligible}
        AND NOT EXISTS(SELECT 1 FROM discovery_topic_aliases a WHERE a.normalized_name=json_extract(j.value,'$.normalized'))
        AND (json_extract(j.value,'$.curated') OR (SELECT count(*) FROM discovery_topics
          WHERE registered_by=(SELECT author_id FROM posts WHERE id=?) AND created_at>=?)<24)
      ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at,checked_at=0`)
      .bind(now,now,post.id,data,post.id,post.id,Math.floor(now/86400000)*86400000),
    db.prepare(`INSERT OR IGNORE INTO discovery_topic_aliases(normalized_name,topic_id,label,created_at)
      SELECT json_extract(value,'$.normalized'),json_extract(value,'$.id'),json_extract(value,'$.label'),?
      FROM json_each(?) j WHERE EXISTS(SELECT 1 FROM discovery_topics t WHERE t.id=json_extract(j.value,'$.id'))
        AND ${eligible}`).bind(now,data,post.id),
    db.prepare(`INSERT OR IGNORE INTO discovery_topic_aliases(normalized_name,topic_id,label,created_at)
      SELECT json_extract(value,'$.key'),json_extract(value,'$.id'),json_extract(value,'$.label'),?
      FROM json_each(?) j WHERE EXISTS(SELECT 1 FROM discovery_topics t WHERE t.id=json_extract(j.value,'$.id'))`).bind(now,synonyms),
    db.prepare(`INSERT OR IGNORE INTO discovery_topic_relations(parent_id,child_id)
      SELECT json_extract(value,'$.parent'),json_extract(value,'$.child') FROM json_each(?) j
      WHERE EXISTS(SELECT 1 FROM discovery_topics t WHERE t.id=json_extract(j.value,'$.parent'))
        AND EXISTS(SELECT 1 FROM discovery_topics t WHERE t.id=json_extract(j.value,'$.child'))`).bind(relations),
    db.prepare("DELETE FROM discovery_post_topics WHERE post_id=?").bind(post.id),
    db.prepare(`INSERT OR REPLACE INTO discovery_post_topics(post_id,topic_id,confidence)
      SELECT ?,a.topic_id,MAX(json_extract(j.value,'$.confidence'))
      FROM json_each(?) j JOIN discovery_topic_aliases a ON a.normalized_name=json_extract(j.value,'$.normalized')
      JOIN discovery_topics t ON t.id=a.topic_id
      WHERE t.status NOT IN ('suppressed','merged') AND ${eligible}
        AND a.topic_id NOT IN (SELECT value FROM json_each(?))
      GROUP BY a.topic_id`).bind(post.id,data,post.id,JSON.stringify(excluded)),
    db.prepare(`INSERT OR IGNORE INTO discovery_post_topics(post_id,topic_id,confidence)
      SELECT ?,a.topic_id,0.72 FROM json_each(?) j JOIN discovery_topic_aliases a ON a.normalized_name=j.value
      JOIN discovery_topics t ON t.id=a.topic_id
      WHERE t.status NOT IN ('suppressed','merged') AND ${eligible}
        AND a.topic_id NOT IN (SELECT value FROM json_each(?)) LIMIT 6`).bind(post.id,keys,post.id,JSON.stringify(excluded)),
    db.prepare(`UPDATE discovery_documents SET topic_fingerprint=coalesce(nullif((
      SELECT group_concat(sha256,'|') FROM (SELECT DISTINCT m.sha256 FROM post_media_assets pm
        JOIN user_media_assets m ON m.id=pm.media_id WHERE pm.post_id=? AND m.ready=1 AND length(m.sha256)=64 ORDER BY m.sha256)
      ),''),?),topic_text=coalesce((
      SELECT group_concat(t.label,' ') FROM discovery_post_topics pt JOIN discovery_topics t ON t.id=pt.topic_id WHERE pt.post_id=?
    ),'') WHERE post_id=?`).bind(post.id,topicFingerprint(post.text),post.id,post.id),
    db.prepare(`UPDATE discovery_topics SET checked_at=0,last_seen_at=?
      WHERE id IN(SELECT topic_id FROM discovery_post_topics WHERE post_id=?)`).bind(now,post.id),
  ];
}
export async function resolveRegisteredTopic(db:Database,value:string):Promise<TopicRow|null> {
  const key=normalizeTopicName(value);
  const topic=await db.prepare(`SELECT t.* FROM discovery_topics t WHERE t.id=? OR t.id IN(
    SELECT topic_id FROM discovery_topic_aliases WHERE normalized_name=?) ORDER BY CASE WHEN t.id=? THEN 0 ELSE 1 END LIMIT 1`)
    .bind(value,key,value).first<TopicRow>();
  if(!topic)return null;
  if(topic.status==="merged"&&topic.merged_into)return db.prepare("SELECT * FROM discovery_topics WHERE id=? AND status='qualified'").bind(topic.merged_into).first<TopicRow>();
  return topic.status==="suppressed"?null:topic;
}
export async function topicPolicy(db:Database):Promise<TopicPolicy> {
  const saved=await db.prepare("SELECT * FROM discovery_topic_policy WHERE id='main'").first<{
    min_posts:number;min_creators:number;min_unique_content:number;min_confidence:number}>();
  return {...TOPIC_POLICY,...(saved?{minPosts:saved.min_posts,minCreators:saved.min_creators,
    minUniqueContent:saved.min_unique_content,minConfidence:saved.min_confidence}:{})};
}
export async function refreshTopicRegistry(db:Database,limit=4,now=Date.now(),topicId?:string) {
  const stale=await rows<TopicRow>(db,`SELECT * FROM discovery_topics
    WHERE status IN ('candidate','qualified') AND checked_at<? AND (?='' OR id=?) ORDER BY checked_at,last_seen_at DESC LIMIT ?`,
    now-TOPIC_POLICY.snapshotMs,topicId||"",topicId||"",Math.max(1,Math.min(100,limit)));
  if(!stale.length)return;
  const policy=await topicPolicy(db), day=Math.floor(now/86400000);
  for(const topic of stale){
    const stats=await db.prepare(`WITH limited AS (
      SELECT p.id,p.author_id,p.created_at,max(pt.confidence) AS confidence,d.topic_fingerprint FROM discovery_post_topics pt
      JOIN posts p ON p.id=pt.post_id JOIN users u ON u.id=p.author_id JOIN discovery_documents d ON d.post_id=p.id
      WHERE (pt.topic_id=? OR pt.topic_id IN(SELECT id FROM discovery_topics WHERE merged_into=?))
        AND p.visibility='public' AND p.archived_at IS NULL AND u.is_private=0 AND u.is_virtual=0
      GROUP BY p.id ORDER BY p.created_at DESC,p.id DESC LIMIT 600)
      SELECT count(*) AS posts,count(DISTINCT author_id) AS creators,
        count(DISTINCT CASE WHEN topic_fingerprint<>'' THEN topic_fingerprint ELSE id END) AS uniqueContent,
        coalesce(avg(confidence),0) AS confidence,coalesce(max(created_at),0) AS lastSeen,
        coalesce(sum(created_at>?),0) AS recent,coalesce(sum(created_at>? AND created_at<=?),0) AS previous,
        count(DISTINCT CASE WHEN created_at>? THEN author_id END) AS recentCreators,
        count(DISTINCT CASE WHEN created_at>? THEN CASE WHEN topic_fingerprint<>'' THEN topic_fingerprint ELSE id END END) AS recentUnique,
        (SELECT count(DISTINCT l.user_id) FROM organic_post_likes l JOIN limited p ON p.id=l.post_id
          WHERE l.user_id<>p.author_id AND p.created_at>?) AS engagement
      FROM limited`).bind(topic.id,topic.id,now-86400000,now-172800000,now-86400000,now-86400000,now-86400000,now-172800000).first<{
        posts:number;creators:number;uniqueContent:number;confidence:number;lastSeen:number;recent:number;previous:number;
        recentCreators:number;recentUnique:number;engagement:number}>();
    if(!stats)continue;
    const demand=await db.prepare(`SELECT count(DISTINCT user_id) AS n FROM discovery_topic_signal_days
      WHERE topic_id=? AND day>=? AND kind='search'`).bind(topic.id,day-1).first<{n:number}>();
    const qualified=topic.curated||topic.status==="qualified"||topicQualifies(stats,policy);
    const effectivePosts=Math.min(stats.recentUnique,stats.recentCreators*3);
    const score=topicTrendScore({posts:effectivePosts,previous:stats.previous,creators:stats.recentCreators,
      engagement:stats.engagement,searches:demand?.n||0,ageHours:stats.lastSeen?(now-stats.lastSeen)/3600000:168});
    await db.batch([
      db.prepare(`UPDATE discovery_topics SET public_posts=?,public_creators=?,count_capped=?,last_seen_at=?,checked_at=?,trend_score=?,
        status=?,qualified_at=CASE WHEN ? AND qualified_at IS NULL THEN ? ELSE qualified_at END,
        recent_posts=?,previous_posts=?,recent_creators=?,recent_engagement=? WHERE id=?`)
        .bind(stats.posts,stats.creators,Number(stats.posts>=600),stats.lastSeen,now,score,qualified?"qualified":"candidate",Number(!!qualified),now,
          effectivePosts,stats.previous,stats.recentCreators,Math.min(stats.engagement,stats.recentCreators*8),topic.id),
      db.prepare(`INSERT INTO discovery_topic_metrics(topic_id,day,posts,creators,engagement,searches) VALUES(?,?,?,?,?,?)
        ON CONFLICT(topic_id,day) DO UPDATE SET posts=excluded.posts,creators=excluded.creators,engagement=excluded.engagement,searches=excluded.searches`)
        .bind(topic.id,day,stats.recent,stats.creators,Math.min(stats.engagement,stats.creators*8),demand?.n||0),
    ]);
  }
}
