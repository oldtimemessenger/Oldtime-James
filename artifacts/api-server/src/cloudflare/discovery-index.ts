import { TOPICS, makeDiscoveryDocument } from "../../../../lib/discovery-engine/index.js";
import { AUTOMATIC_TOPIC_VERSION } from "../../../../lib/discovery-engine/automatic-topics.js";
import { topicRegistryStatements } from "./topic-registry";
import { object, rows, type Database, type Statement } from "./runtime";

export const DISCOVERY_VERSION=AUTOMATIC_TOPIC_VERSION;
export { TOPICS };
export async function excludedDiscoveryTopics(db:Database,postId:string) {
  const row=await db.prepare("SELECT excluded_topics FROM discovery_topic_overrides WHERE post_id=?").bind(postId).first<{excluded_topics:string}>();
  try { const value=JSON.parse(row?.excluded_topics??"[]");return Array.isArray(value)?value.filter((v):v is string=>typeof v==="string"):[]; }
  catch { return []; }
}
export function discoveryIndexStatements(db:Database,post:{id:string;text:string;place?:string|null;visibility:string},excluded:string[]=[]):Statement[] {
  if(post.visibility!=="public")return [];
  const doc=makeDiscoveryDocument({text:post.text,place:post.place?object(post.place):null},excluded);
  return [
    db.prepare(`UPDATE discovery_documents SET body=?,topic_text=?,tags=?,pipeline_version=?,updated_at=? WHERE post_id=?`)
      .bind(doc.body,doc.topicText,JSON.stringify(doc.tags),DISCOVERY_VERSION,Date.now(),post.id),
    ...topicRegistryStatements(db,post,excluded),
  ];
}
export async function ensureDiscoveryIndex(db:Database) {
  // Migration backfill is incremental and bounded. Ordinary publishes/edits index
  // atomically in their existing transaction; searches never process media.
  const pending=await rows<{id:string;text:string;place:string|null;visibility:string;excluded_topics:string|null}>(db,`
    SELECT p.id,p.text,p.place,p.visibility,o.excluded_topics FROM discovery_documents d
    JOIN posts p ON p.id=d.post_id LEFT JOIN discovery_topic_overrides o ON o.post_id=p.id
    WHERE d.pipeline_version<>'topic-registry-1' LIMIT 8`);
  if(!pending.length)return;
  await db.batch(pending.flatMap(post=>{
    let excluded:string[]=[];
    try { const parsed=JSON.parse(post.excluded_topics??"[]");if(Array.isArray(parsed))excluded=parsed; }catch{}
    return discoveryIndexStatements(db,post,excluded);
  }));
}
