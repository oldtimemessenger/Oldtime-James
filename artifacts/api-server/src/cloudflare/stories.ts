import { createHash } from "node:crypto";
import { z } from "zod/v4";
import { CreateStoryCommentBody, UpsertStoryReactionBody } from "@workspace/api-zod";
import { ApiError, body, bytes, json, rows, object, publicDetails, viewerCte, V, visibleStory, type Database, type MediaBucket } from "./runtime";
import { mediaRequest } from "./media";
import { mentionRecipients } from "./social";
import { referenceWrites } from "./media-references";
import { moderatePublication, type ModerationAsset, type WorkersAiBinding } from "./content-moderation";
import { storyStickerInput, prepareStoryStickers, stickersForStories, storyStickerRequest } from "./story-stickers";

interface Story{
  id:string;author_id:string;text:string;visibility:string;media_path:string|null;media_type:string|null;media_ready:number;
  saved_to_profile:number;comments_enabled:number;created_at:number;expires_at:number;username:string;display_name:string;joined_at:number;data:string|null;viewer_reaction:string|null;
}
const select=`SELECT s.*,u.username,u.display_name,u.created_at AS joined_at,st.data,
  (SELECT emoji FROM story_reactions r WHERE r.story_id=s.id AND r.actor_id=${V}) AS viewer_reaction
  FROM stories s JOIN users u ON u.id=s.author_id LEFT JOIN account_state st ON st.user_id=u.id`;
const dto=(s:Story)=>({id:s.id,text:s.text,visibility:s.visibility,createdAt:s.created_at,expiresAt:s.expires_at,
  savedToProfile:!!s.saved_to_profile,commentsEnabled:!!s.comments_enabled,...(s.media_type?{mediaType:s.media_type}:{}),
  hasMedia:!!s.media_path&&!!s.media_ready,author:{id:s.author_id,username:s.username,displayName:s.display_name,joinedAt:s.joined_at,...publicDetails(s.data)},viewerReaction:s.viewer_reaction});
async function getStory(db:Database,userId:string,id:string,owned=false){
  return db.prepare(`${viewerCte} ${select} WHERE s.id=? AND ${owned?`s.author_id=${V}`:`${visibleStory} AND (s.media_type IS NULL OR s.media_ready=1) AND (s.author_id=${V} OR s.saved_to_profile=1 OR s.expires_at>?)`}`)
    .bind(userId,id,...(owned?[]:[Date.now()])).first<Story>();
}
async function create(request:Request,db:Database,bucket:MediaBucket,userId:string,ai?:WorkersAiBinding){
  const parsed=z.object({text:z.string().max(2000),visibility:z.enum(["public","followers","friends","close-friends"]),
    mediaType:z.enum(["photo","video"]).optional(),mediaId:z.string().uuid().optional(),commentsEnabled:z.boolean().optional(),
    stickers:z.array(storyStickerInput).max(4).default([]),answerQuestionId:z.string().uuid().optional()}).strict().safeParse(await body(request));
  if(!parsed.success||!parsed.data.text.trim()&&!parsed.data.mediaType)throw new ApiError(400,"Add text or media to your Story.");
  const input=parsed.data,author=await db.prepare("SELECT is_private,privacy_initialized FROM users WHERE id=?").bind(userId).first<{is_private:number;privacy_initialized:number}>();
  if(!author?.privacy_initialized)throw new ApiError(409,"Choose your account privacy setting before sharing a Story.");
  if(input.visibility==="public"&&author.is_private)throw new ApiError(409,"Private accounts can share Stories with followers, Friends or Close Friends.");
  if(input.visibility==="close-friends"&&!await db.prepare("SELECT 1 FROM close_friend_members WHERE owner_id=? LIMIT 1").bind(userId).first())throw new ApiError(409,"Add people to Close Friends before sharing privately.");
  const asset=input.mediaId?await db.prepare(`SELECT m.id,m.object_key,m.content_type,m.size,m.sha256,m.thumbnail_id,
    t.object_key AS thumbnail_object_key,t.content_type AS thumbnail_content_type,
    t.size AS thumbnail_size,t.sha256 AS thumbnail_sha256
    FROM user_media_assets m LEFT JOIN user_media_assets t ON t.id=m.thumbnail_id AND t.user_id=m.user_id
      AND t.ready=1 AND t.storage_scope=m.storage_scope AND t.media_role='thumbnail'
    WHERE m.id=? AND m.user_id=? AND m.ready=1 AND m.storage_scope='public' AND m.media_role='media'`)
    .bind(input.mediaId,userId).first<ModerationAsset>():null;
  if(input.mediaId&&(!asset||!input.mediaType||!(input.mediaType==="video"?asset.content_type.startsWith("video/"):asset.content_type.startsWith("image/"))))throw new ApiError(409,"The Story media is not confirmed in your account.");
  const pendingMediaUpload=Boolean(input.mediaType&&!asset);
  const recipients=pendingMediaUpload?[]:await mentionRecipients(db,userId,input.text,input.visibility);
  const id=crypto.randomUUID(),now=Date.now();
  const stickerWrites=await prepareStoryStickers(db,userId,id,input.stickers,input.answerQuestionId,(id,owned=false)=>getStory(db,userId,id,owned),Boolean(asset));
  await moderatePublication(ai,bucket,JSON.stringify({caption:input.text,stickers:input.stickers}),asset?[asset]:[]);
  await db.batch([db.prepare(`INSERT INTO stories(id,author_id,text,visibility,media_path,media_type,media_ready,comments_enabled,created_at,expires_at,archive_enabled)
    VALUES(?,?,?,?,?,?,?,?,?,?,COALESCE((SELECT json_extract(data,'$.archivePreferences.autoArchiveStories') FROM account_state WHERE user_id=?),1))`)
      .bind(id,userId,input.text.trim(),input.visibility,asset?.object_key??null,input.mediaType??null,
      Number(!!asset||!input.mediaType),Number(input.commentsEnabled??true),now,now+86400000,userId),
    ...referenceWrites(db,userId,"story",id,input.mediaId?[input.mediaId]:[]),
    ...stickerWrites,
    ...recipients.map(account=>db.prepare("INSERT INTO story_mentions(id,recipient_id,actor_id,story_id,created_at) VALUES(?,?,?,?,?)")
      .bind(crypto.randomUUID(),account.id,userId,id,now)),
  ]);
  const stickerMap=await stickersForStories(db,[id]);
  return json({story:{...dto((await getStory(db,userId,id,true))!),stickers:stickerMap.get(id)||[]}},201);
}
async function upload(request:Request,db:Database,bucket:MediaBucket,userId:string,s:Story,ai?:WorkersAiBinding){
  if(s.author_id!==userId||!s.media_type||s.media_ready)throw new ApiError(404,"Story upload not found.");
  if(s.media_type==="video")throw new ApiError(415,"Upload video Stories through the optimized media flow.");
  const type=(request.headers.get("content-type")??"").split(";")[0],data=await bytes(request,50*1024*1024);
  const valid=type==="image/jpeg"&&data[0]===255&&data[1]===216||type==="image/png"&&data[0]===137&&data[1]===80&&data[2]===78&&data[3]===71||
    type==="image/webp"&&String.fromCharCode(...data.subarray(0,4))==="RIFF"&&String.fromCharCode(...data.subarray(8,12))==="WEBP";
  if(!valid)throw new ApiError(400,"Choose a supported image.");
  const id=crypto.randomUUID(),key=`stories/${userId}/${id}`;
  const digest=createHash("sha256").update(data).digest("hex");
  try{
    await bucket.put(key,data,{httpMetadata:{contentType:type}});
    await moderatePublication(ai,bucket,s.text,[{
      id,object_key:key,content_type:type,size:data.byteLength,sha256:digest,thumbnail_id:null,
    }]);
    const result=await db.batch([
      db.prepare(`INSERT INTO user_media_assets(id,user_id,object_key,content_type,size,sha256,storage_scope,media_role,ready,created_at)
        VALUES(?,?,?,?,?,?,'public','media',1,?)`).bind(id,userId,key,type,data.length,digest,Date.now()),
      db.prepare("UPDATE stories SET media_path=?,media_ready=1 WHERE id=? AND author_id=? AND media_ready=0").bind(key,s.id,userId),
      db.prepare(`INSERT INTO media_references(user_id,target_type,target_id,media_id)
        SELECT ?,'story',?,? WHERE EXISTS(SELECT 1 FROM stories WHERE id=? AND media_path=?)`).bind(userId,s.id,id,s.id,key),
      ...await mentionRecipients(db,userId,s.text,s.visibility).then(recipients=>recipients.map(account=>
        db.prepare("INSERT INTO story_mentions(id,recipient_id,actor_id,story_id,created_at) VALUES(?,?,?,?,?)")
          .bind(crypto.randomUUID(),account.id,userId,s.id,Date.now()))),
    ]);
    if(!result[1].meta?.changes){
      await db.prepare("DELETE FROM user_media_assets WHERE id=?").bind(id).run();
      throw new ApiError(409,"This Story already has media.");
    }
  }catch(error){await bucket.delete(key).catch(()=>{});throw error;}
  return new Response(null,{status:204});
}
export async function storyRequest(
  request:Request,
  db:Database,
  bucket:MediaBucket,
  userId:string,
  path:string,
  ai?:WorkersAiBinding,
):Promise<Response>{
  const stickerResponse=await storyStickerRequest(request,db,userId,path,(id,owned=false)=>getStory(db,userId,id,owned));
  if(stickerResponse)return stickerResponse;
  if(path==="/stories/archived"&&request.method==="GET"){
    const q=new URL(request.url).searchParams,limit=Number(q.get("limit")??18),offset=Number(q.get("offset")??0);
    if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isInteger(offset)||offset<0)throw new ApiError(400,"Choose a valid archive page.");
    const records=await rows<Story>(db,`${viewerCte} ${select}
      WHERE s.author_id=${V} AND s.archive_enabled=1 AND (s.media_type IS NULL OR s.media_ready=1) AND s.expires_at<=?
      ORDER BY s.created_at DESC,s.id DESC LIMIT ? OFFSET ?`,userId,Date.now(),limit+1,offset);
    const stickerMap=await stickersForStories(db,records.slice(0,limit).map(s=>s.id));
    return json({stories:records.slice(0,limit).map(s=>({...dto(s),stickers:stickerMap.get(s.id)||[]})),hasMore:records.length>limit,nextOffset:offset+Math.min(limit,records.length)});
  }
  if(path==="/stories/capabilities"&&request.method==="GET"){
    const schema=await db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('story_stickers','story_questions','story_mentions','story_question_answers')").first<{n:number}>();
    if(schema?.n!==4)throw new ApiError(503,"Interactive Status is waiting for the server update.");
    return json({stickers:true,privateQuestions:true,mentions:true});
  }
  if(path==="/stories"&&request.method==="POST")return create(request,db,bucket,userId,ai);
  if(path==="/stories"&&request.method==="GET"){
    const records=await rows<Story>(db,`${viewerCte} ${select} WHERE ${visibleStory} AND (s.media_type IS NULL OR s.media_ready=1)
      AND (s.saved_to_profile=1 OR s.expires_at>?) ORDER BY s.created_at DESC LIMIT 200`,userId,Date.now());
    const stickerMap=await stickersForStories(db,records.map(s=>s.id));
    return json({stories:records.map(s=>({...dto(s),stickers:stickerMap.get(s.id)||[]}))});
  }
  if(path==="/stories/import")throw new ApiError(410,"Oldtime is starting fresh. Story imports are disabled.");
  const match=/^\/stories\/([a-f0-9-]{36})(?:\/(media|media-url|views|reactions|activity|comments)(?:\/([a-f0-9-]{36}))?)?$/.exec(path);
  if(!match)throw new ApiError(404,"Story not found.");
  const [,id,action,commentId]=match;
  const s=await getStory(db,userId,id,(!action&&["PATCH","DELETE"].includes(request.method))||action==="media"&&request.method==="POST");
  if(!s)throw new ApiError(404,"Story not found or not visible.");
  if(!action&&request.method==="GET"){
    const stickerMap=await stickersForStories(db,[s.id]);
    return json({story:{...dto(s),stickers:stickerMap.get(s.id)||[]}});
  }
  if(action==="media"&&request.method==="POST")return upload(request,db,bucket,userId,s,ai);
  if((action==="media"||action==="media-url")&&request.method==="GET"){
    const asset=await db.prepare("SELECT id,thumbnail_id FROM user_media_assets WHERE object_key=? AND ready=1").bind(s.media_path).first<{id:string;thumbnail_id:string|null}>();
    if(!asset)throw new ApiError(404,"Story media not found.");
    if(action==="media")return mediaRequest(request,db,bucket,userId,`/media/${asset.id}`);
    const response=await mediaRequest(request,db,bucket,userId,`/media/${asset.id}/url`),link=object(await response.json());
    let thumbnailUrl=null;
    if(asset.thumbnail_id){const r=await mediaRequest(request,db,bucket,userId,`/media/${asset.thumbnail_id}/url`);thumbnailUrl=object(await r.json()).url??null;}
    return json({url:link.url,thumbnailUrl});
  }
  if(action==="views"&&request.method==="POST"){
    if(s.author_id!==userId)await db.prepare("INSERT INTO story_views(story_id,viewer_id,viewed_at) VALUES(?,?,?) ON CONFLICT DO NOTHING").bind(id,userId,Date.now()).run();
    return json({recorded:s.author_id!==userId});
  }
  if(action==="reactions"){
    if(request.method==="DELETE"){await db.prepare("DELETE FROM story_reactions WHERE story_id=? AND actor_id=?").bind(id,userId).run();return new Response(null,{status:204});}
    if(request.method==="PUT"){
      const parsed=UpsertStoryReactionBody.safeParse(await body(request));
      if(!parsed.success)throw new ApiError(400,"Choose a supported Story reaction.");
      const now=Date.now();
      await db.prepare(`INSERT INTO story_reactions(story_id,actor_id,emoji,created_at,updated_at) VALUES(?,?,?,?,?)
        ON CONFLICT(story_id,actor_id) DO UPDATE SET emoji=excluded.emoji,updated_at=excluded.updated_at`).bind(id,userId,parsed.data.emoji,now,now).run();
      return json({reaction:{emoji:parsed.data.emoji,createdAt:now}});
    }
  }
  if(action==="activity"&&request.method==="GET"){
    if(s.author_id!==userId)throw new ApiError(404,"Story activity not found.");
    const counts=await db.prepare(`SELECT (SELECT count(*) FROM story_views WHERE story_id=?) AS viewCount,
      (SELECT count(*) FROM story_reactions WHERE story_id=?) AS reactionCount`).bind(id,id).first<{viewCount:number;reactionCount:number}>();
    const viewers=await rows(db,`SELECT u.id,u.username,u.display_name AS displayName,v.viewed_at AS viewedAt,r.emoji AS reaction
      FROM story_views v JOIN users u ON u.id=v.viewer_id LEFT JOIN story_reactions r ON r.story_id=v.story_id AND r.actor_id=v.viewer_id
      WHERE v.story_id=? ORDER BY v.viewed_at DESC LIMIT 500`,id);
    return json({...counts,viewers});
  }
  if(action==="comments"){
    if(!commentId&&request.method==="GET"){
      const comments=await rows<{id:string;body:string;created_at:number;author_id:string;username:string;display_name:string}>(db,`
        SELECT c.*,u.username,u.display_name FROM story_comments c JOIN users u ON u.id=c.author_id WHERE c.story_id=?
        AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=? AND b.blocked_id=c.author_id) OR (b.blocked_id=? AND b.owner_id=c.author_id))
        ORDER BY c.created_at LIMIT 200`,id,userId,userId);
      return json({comments:comments.map(c=>({id:c.id,body:c.body,createdAt:c.created_at,author:{id:c.author_id,username:c.username,displayName:c.display_name}}))});
    }
    if(!commentId&&request.method==="POST"){
      const parsed=CreateStoryCommentBody.safeParse(await body(request));
      if(!parsed.success||!parsed.data.body.trim())throw new ApiError(400,"Write a reply of up to 300 characters.");
      if(!s.comments_enabled||!s.saved_to_profile&&s.expires_at<=Date.now())throw new ApiError(409,"Replies are off or this Story has expired.");
      const text=parsed.data.body.trim(),recipients=await mentionRecipients(db,userId,text,s.visibility,s.author_id,true);
      for(const r of recipients)if(!await getStory(db,r.id,id))throw new ApiError(403,`@${r.username} cannot view this Story.`);
      const comment=crypto.randomUUID(),now=Date.now();
      await db.batch([
        db.prepare("INSERT INTO story_comments(id,story_id,author_id,body,created_at) VALUES(?,?,?,?,?)").bind(comment,id,userId,text,now),
        ...recipients.map(r=>db.prepare("INSERT INTO content_mentions(id,recipient_id,actor_id,kind,story_id,story_comment_id,created_at) VALUES(?,?,?,'story-comment',?,?,?)")
          .bind(crypto.randomUUID(),r.id,userId,id,comment,now)),
      ]);
      const author=await db.prepare("SELECT id,username,display_name AS displayName FROM users WHERE id=?").bind(userId).first();
      return json({comment:{id:comment,body:text,createdAt:now,author}},201);
    }
    if(commentId&&request.method==="DELETE"){
      const deleted=await db.prepare("DELETE FROM story_comments WHERE id=? AND story_id=? AND (author_id=? OR ?=?) RETURNING id")
        .bind(commentId,id,userId,userId,s.author_id).first();
      if(!deleted)throw new ApiError(404,"Reply not found.");
      return new Response(null,{status:204});
    }
  }
  if(!action&&s.author_id===userId){
    if(request.method==="DELETE"){await db.prepare("DELETE FROM stories WHERE id=? AND author_id=?").bind(id,userId).run();return new Response(null,{status:204});}
    if(request.method==="PATCH"){
      const parsed=z.object({savedToProfile:z.boolean().optional(),commentsEnabled:z.boolean().optional()}).strict().refine(x=>Object.keys(x).length>0).safeParse(await body(request));
      if(!parsed.success)throw new ApiError(400,"Choose valid Story settings.");
      await db.prepare("UPDATE stories SET saved_to_profile=?,comments_enabled=? WHERE id=? AND author_id=?")
        .bind(Number(parsed.data.savedToProfile??!!s.saved_to_profile),Number(parsed.data.commentsEnabled??!!s.comments_enabled),id,userId).run();
      const stickerMap=await stickersForStories(db,[id]);
      return json({story:{...dto((await getStory(db,userId,id,true))!),stickers:stickerMap.get(id)||[]}});
    }
  }
  throw new ApiError(405,"Method not allowed.");
}
