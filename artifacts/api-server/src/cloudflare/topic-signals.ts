import { ApiError, rows, viewerCte, notBlocked, V, type Database } from "./runtime";
import { resolveRegisteredTopic } from "./topic-registry";
export const TOPIC_SIGNAL_WEIGHTS={search:.8,visit:.35,watch:1,like:1.5,save:3,share:2,dismiss:-6,follow_author:2} as const;
export type TopicSignal=keyof typeof TOPIC_SIGNAL_WEIGHTS;
export async function recordTopicSignal(db:Database,userId:string,topicId:string,kind:TopicSignal,now=Date.now()) {
  const topic=await resolveRegisteredTopic(db,topicId);
  if(!topic||topic.status!=="qualified"||topic.sensitive)return false;
  const preference=await db.prepare("SELECT personalize FROM discovery_preferences WHERE user_id=?").bind(userId).first<{personalize:number}>();
  if(preference&&!preference.personalize)return false;
  const day=Math.floor(now/86400000),weight=TOPIC_SIGNAL_WEIGHTS[kind];
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO discovery_topic_signal_days(user_id,topic_id,day,kind) VALUES(?,?,?,?)`).bind(userId,topic.id,day,kind),
    db.prepare(`INSERT INTO discovery_topic_user_interests(user_id,topic_id,score,decay_day,updated_at)
      SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM discovery_topic_signal_days WHERE user_id=? AND topic_id=? AND day=? AND kind=? AND credited=0)
      ON CONFLICT(user_id,topic_id) DO UPDATE SET
        score=max(-20,min(30,discovery_topic_user_interests.score/
          (1+max(0,excluded.decay_day-discovery_topic_user_interests.decay_day)/7.0)+excluded.score)),
        decay_day=excluded.decay_day,
        updated_at=excluded.updated_at`)
      .bind(userId,topic.id,weight,day,now,userId,topic.id,day,kind),
    db.prepare(`UPDATE discovery_topic_signal_days SET credited=1 WHERE user_id=? AND topic_id=? AND day=? AND kind=?`).bind(userId,topic.id,day,kind),
  ]);
  return true;
}
export async function learnedTopicInterests(db:Database,userId:string,enabled=true) {
  if(!enabled)return [];
  const now=Date.now(),day=Math.floor(now/86400000);
  const interests=await rows<{topic_id:string;label:string;score:number;followed:number;decay_day:number;sensitive:number}>(db,
    `SELECT i.topic_id,t.label,i.score,i.followed,i.decay_day,t.sensitive FROM discovery_topic_user_interests i
      JOIN discovery_topics t ON t.id=i.topic_id WHERE i.user_id=? AND t.status='qualified'
      ORDER BY i.followed DESC,i.score DESC LIMIT 64`,userId);
  return interests.map(i=>({...i,score:i.score/(1+Math.max(0,day-i.decay_day)/7)}))
    .filter(i=>i.followed||!i.sensitive&&Math.abs(i.score)>=.8);
}
export async function setTopicFollow(db:Database,userId:string,topicId:string,followed:boolean) {
  const topic=await resolveRegisteredTopic(db,topicId);
  if(!topic||topic.status!=="qualified")throw new ApiError(404,"This topic is not available right now.");
  const now=Date.now();
  await db.prepare(`INSERT INTO discovery_topic_user_interests(user_id,topic_id,followed,decay_day,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id,topic_id) DO UPDATE SET followed=excluded.followed,updated_at=excluded.updated_at`)
    .bind(userId,topic.id,Number(followed),Math.floor(now/86400000),now).run();
  return {topicId:topic.id,followed};
}
export async function recordPostTopicSignals(db:Database,user:string,postId:string,kind:TopicSignal) {
  const topics=await rows<{id:string}>(db,`${viewerCte} SELECT DISTINCT coalesce(t.merged_into,t.id) AS id
    FROM discovery_post_topics pt JOIN discovery_topics t ON t.id=pt.topic_id
    JOIN posts p ON p.id=pt.post_id JOIN users u ON u.id=p.author_id
    WHERE p.id=? AND p.author_id<>${V} AND p.visibility='public' AND p.archived_at IS NULL
      AND u.is_private=0 AND u.is_virtual=0 AND ${notBlocked} LIMIT 6`,user,postId);
  for(const topic of topics)await recordTopicSignal(db,user,topic.id,kind);
}
export async function recordAuthorTopicSignals(db:Database,user:string,author:string) {
  const posts=await rows<{id:string}>(db,`${viewerCte} SELECT p.id FROM posts p JOIN users u ON u.id=p.author_id
    WHERE p.author_id=? AND p.visibility='public' AND p.archived_at IS NULL AND u.is_private=0 AND u.is_virtual=0
    AND ${notBlocked} ORDER BY p.created_at DESC LIMIT 3`,user,author);
  for(const post of posts)await recordPostTopicSignals(db,user,post.id,"follow_author");
}
