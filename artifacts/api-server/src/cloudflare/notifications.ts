import { ReadNotificationsBody, GetNotificationsResponse } from "@workspace/api-zod";
import { ApiError, body, json, type Database, V, viewerCte, visibleStory } from "./runtime";
export async function notificationsRequest(request:Request,db:Database,userId:string,path:string):Promise<Response>{
  if(path==="/notifications/read"&&request.method==="POST"){
    const parsed=ReadNotificationsBody.strict().safeParse(await body(request));
    if(!parsed.success||!Number.isSafeInteger(parsed.data.through)||parsed.data.through>Date.now()+1000)throw new ApiError(400,"Choose a valid read time.");
    const row=await db.prepare(`INSERT INTO account_state(user_id,data,updated_at)
      VALUES(?,json_object('notificationReadAt',?),?)
      ON CONFLICT(user_id) DO UPDATE SET data=json_set(account_state.data,'$.notificationReadAt',
      max(coalesce(json_extract(account_state.data,'$.notificationReadAt'),0),?)),updated_at=excluded.updated_at
      RETURNING json_extract(data,'$.notificationReadAt') AS readAt`)
      .bind(userId,parsed.data.through,Date.now(),parsed.data.through).first();
    return json(row);
  }
  if(path!=="/notifications"||request.method!=="GET")throw new ApiError(405,"Method not allowed.");
  const value=new URL(request.url).searchParams.get("before"),before=value?Number(value):Date.now()+1;
  if(!Number.isSafeInteger(before)||before<=0)throw new ApiError(400,"Choose a valid notification page.");
  type Activity={id:string;kind:string;body:string;postId:string|null;storyId:string|null;commentId:string|null;createdAt:number;actorId:string;username:string;displayName:string;avatar:string|null;conversationId?:string|null;messageId?:string|null};
  // D1 has a much smaller compound-SELECT limit than PostgreSQL. Fetch bounded,
  // indexed sources in one batch, then merge them instead of one UNION tree.
  const sources=`
      SELECT 'like:'||l.user_id||':'||l.post_id AS id,'like' AS kind,'liked your post' AS body,l.user_id AS actor_id,
      l.post_id,NULL AS story_id,NULL AS comment_id,l.created_at AS at FROM post_likes l JOIN posts p ON p.id=l.post_id WHERE p.author_id=${V} AND p.archived_at IS NULL
      UNION ALL SELECT 'repost:'||r.user_id||':'||r.post_id,'share','reposted your post',r.user_id,r.post_id,NULL,NULL,r.created_at
        FROM post_reposts r JOIN posts p ON p.id=r.post_id WHERE p.author_id=${V} AND p.archived_at IS NULL
      UNION ALL SELECT 'comment:'||c.id,'comment','commented on your post',c.user_id,c.post_id,NULL,c.id,c.created_at
        FROM post_comments c JOIN posts p ON p.id=c.post_id WHERE p.author_id=${V} AND p.archived_at IS NULL
      UNION ALL SELECT 'reply:'||c.id,'reply','replied to your comment',c.user_id,c.post_id,NULL,c.id,c.created_at
        FROM post_comments c JOIN post_comments parent ON parent.id=c.parent_id JOIN posts p ON p.id=c.post_id
         WHERE parent.user_id=${V} AND p.author_id<>${V} AND p.archived_at IS NULL
      UNION ALL SELECT 'follow:'||f.follower_id,'follow','started following you',f.follower_id,NULL,NULL,NULL,f.created_at FROM user_follows f WHERE f.followed_id=${V}
      UNION ALL SELECT 'friend:'||member_low_id||':'||member_high_id,'friend-accepted','is now your Friend',
        CASE WHEN member_low_id=${V} THEN member_high_id ELSE member_low_id END,NULL,NULL,NULL,created_at FROM friendships
        WHERE member_low_id=${V} OR member_high_id=${V}
      UNION ALL SELECT 'story-reaction:'||r.actor_id||':'||r.story_id,'story-reaction','reacted to your story',r.actor_id,NULL,r.story_id,NULL,r.updated_at
        FROM story_reactions r JOIN stories s ON s.id=r.story_id WHERE s.author_id=${V} AND s.expires_at>?
      UNION ALL SELECT 'story-comment:'||c.id,'story-comment','commented on your story',c.author_id,NULL,c.story_id,c.id,c.created_at
        FROM story_comments c JOIN stories s ON s.id=c.story_id WHERE s.author_id=${V} AND s.expires_at>?
      UNION ALL SELECT 'status-mention:'||m.id,'mention','mentioned you in a Status',m.actor_id,NULL,m.story_id,NULL,m.created_at
        FROM story_mentions m JOIN stories s ON s.id=m.story_id JOIN users u ON u.id=s.author_id
        WHERE m.recipient_id=${V} AND ${visibleStory} AND (s.saved_to_profile=1 OR s.expires_at>?)
      UNION ALL SELECT 'story-question:'||q.id,'story-question','sent you a private question',q.asker_id,NULL,q.story_id,q.id,q.created_at
        FROM story_questions q JOIN stories s ON s.id=q.story_id WHERE s.author_id=${V}
      UNION ALL SELECT 'story-answer:'||q.id||':'||s.id,'story-answer','answered your question in Status',s.author_id,NULL,
        CASE WHEN ${visibleStory} AND (s.saved_to_profile=1 OR s.expires_at>?) THEN s.id ELSE NULL END,q.id,s.created_at
        FROM story_questions q JOIN story_question_answers a ON a.question_id=q.id JOIN stories s ON s.id=a.story_id
        JOIN users u ON u.id=s.author_id WHERE q.asker_id=${V} AND s.media_ready=1
      UNION ALL SELECT 'mention:'||m.id,'mention',CASE m.kind WHEN 'post' THEN 'mentioned you in a post'
        WHEN 'post-comment' THEN 'mentioned you in a comment' WHEN 'story' THEN 'mentioned you in a Status' ELSE 'mentioned you in a Story reply' END,
         m.actor_id,m.post_id,m.story_id,coalesce(m.post_comment_id,m.story_comment_id),m.created_at FROM content_mentions m WHERE m.recipient_id=${V}
           AND (m.post_id IS NULL OR EXISTS(SELECT 1 FROM posts p WHERE p.id=m.post_id AND p.archived_at IS NULL))
           AND (m.story_id IS NULL OR EXISTS(SELECT 1 FROM stories s JOIN users u ON u.id=s.author_id WHERE s.id=m.story_id AND ${visibleStory} AND (s.saved_to_profile=1 OR s.expires_at>?)))
  `.split("UNION ALL").map(s=>s.trim());
  // Give each SELECT the same column aliases; UNION normally supplies these
  // from its first SELECT, but the independent statements must name them.
  const names=["id","kind","body","actor_id","post_id","story_id","comment_id","at"];
  const statements=sources.map((source,index)=>{
    // SQLite does not support a column-name list on a subquery alias. A tiny
    // per-source CTE supplies those names without a compound SELECT.
    const activity=index===0?`activity AS (${source})`:`activity(${names.join(",")}) AS (${source})`;
    return db.prepare(`${viewerCte}, ${activity} SELECT a.id,a.kind,a.body,a.post_id AS postId,a.story_id AS storyId,a.comment_id AS commentId,a.at AS createdAt,
      u.id AS actorId,u.username,u.display_name AS displayName,json_extract(s.data,'$.profile.avatar') AS avatar
      FROM activity a JOIN users u ON u.id=a.actor_id LEFT JOIN account_state s ON s.user_id=u.id
      WHERE a.actor_id<>${V} AND a.at<? AND NOT EXISTS(SELECT 1 FROM account_blocks b
        WHERE (b.owner_id=${V} AND b.blocked_id=a.actor_id) OR (b.blocked_id=${V} AND b.owner_id=a.actor_id))
      ORDER BY a.at DESC,a.id DESC LIMIT 101`).bind(userId,...(source.includes("s.expires_at>?")?[Date.now()]:[]),Math.min(before,Date.now()+1));
  });
  const [results,chatMentions]=await Promise.all([
    db.batch<Activity>(statements),
    db.prepare(`${viewerCte} SELECT 'chat-mention:'||m.id AS id,'chat-mention' AS kind,
      'mentioned you in a group chat' AS body,NULL AS postId,NULL AS storyId,NULL AS commentId,
      m.created_at AS createdAt,u.id AS actorId,u.username,u.display_name AS displayName,
      json_extract(s.data,'$.profile.avatar') AS avatar,m.conversation_id AS conversationId,m.message_id AS messageId
      FROM chat_mentions m JOIN chat_members cm ON cm.conversation_id=m.conversation_id AND cm.user_id=${V}
      JOIN chat_messages msg ON msg.id=m.message_id AND msg.conversation_id=m.conversation_id
      JOIN users u ON u.id=m.actor_id LEFT JOIN account_state s ON s.user_id=u.id
      WHERE m.recipient_id=${V} AND m.created_at<? AND NOT EXISTS(SELECT 1 FROM account_blocks b
        WHERE (b.owner_id=${V} AND b.blocked_id=m.actor_id) OR (b.blocked_id=${V} AND b.owner_id=m.actor_id))
      ORDER BY m.created_at DESC,m.id DESC LIMIT 101`).bind(userId,userId,Math.min(before,Date.now()+1),userId,userId)
      .all<Activity>(),
  ]);
  const list=[...results.flatMap(r=>r.results??[]),...(chatMentions.results??[])]
    .sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).slice(0,101);
  const cursor=await db.prepare("SELECT json_extract(data,'$.notificationReadAt') AS readAt FROM account_state WHERE user_id=?").bind(userId).first<{readAt:number}>();
  const readAt=Number(cursor?.readAt)||0,page=list.slice(0,100);
  return json(GetNotificationsResponse.parse({readAt,nextBefore:list.length>100?page.at(-1)!.createdAt:null,
    notifications:page.map(r=>({id:r.id,kind:r.kind,body:r.body,postId:r.postId,storyId:r.storyId,
      commentId:["story-question","story-answer"].includes(r.kind)?null:r.commentId,
      ...(["story-question","story-answer"].includes(r.kind)?{questionId:r.commentId}:{}),
      ...(r.conversationId?{conversationId:r.conversationId,messageId:r.messageId}:{}),
      createdAt:r.createdAt,read:r.createdAt<=readAt,actor:{id:r.actorId,username:r.username,displayName:r.displayName,avatar:r.avatar??null}}))}));
}
