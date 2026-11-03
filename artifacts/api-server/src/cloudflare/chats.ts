import { z } from "zod/v4";
import { CreateChatBody, CreateChatMessageBody } from "@workspace/api-zod";
import { ApiError, body, json, rows, object, blocked, publicDetails, type Database } from "./runtime";
import { chatPreferences, chatPreferencesRequest, enforceNewChatPermissions } from "./chat-preferences";

const stateSchema=z.object({
  draft:z.string().max(5000).optional(),pinnedIds:z.array(z.string().min(3).max(80)).max(3).optional(),
  savedMessageIds:z.array(z.string().min(3).max(80)).max(1000).optional(),hiddenMessageIds:z.array(z.string().min(3).max(80)).max(2000).optional(),
  keptMessageIds:z.array(z.string().min(3).max(80)).max(1000).optional(),disappear:z.enum(["off","10 seconds","24 hours","after view"]).optional(),
  mutedUntil:z.number().int().min(0).optional(),wallpaper:z.enum(["","#e7f6e9"]).optional(),locked:z.boolean().optional(),shareReceipts:z.boolean().optional(),markedUnread:z.boolean().optional(),
  reactions:z.record(z.string(),z.array(z.string().min(1).max(16)).max(7)).optional(),pollVotes:z.record(z.string(),z.number().int().min(0).max(9)).optional(),
}).strict();
const metadataSchema=z.object({
  replyTo:z.string().min(3).max(80).optional(),caption:z.string().max(2000).optional(),fileName:z.string().max(200).optional(),
  fileSize:z.string().max(40).optional(),viewOnce:z.boolean().optional(),forwarded:z.boolean().optional(),
  poll:z.object({question:z.string().min(1).max(500),options:z.array(z.string().min(1).max(200)).min(2).max(10)}).strict().optional(),
  postId:z.string().max(100).optional(),sharedPostId:z.string().max(100).optional(),sharedCommentId:z.string().max(100).optional(),
  commentId:z.string().max(100).optional(),duration:z.string().max(10).optional(),peaks:z.array(z.number().min(0).max(1)).max(100).optional(),
}).strip();
interface Member{user_id:string;state:string;last_read_at:number|null;username:string;display_name:string;created_at:number;data:string|null}
async function members(db:Database,id:string){return rows<Member>(db,`SELECT m.*,u.username,u.display_name,u.created_at,s.data
  FROM chat_members m JOIN users u ON u.id=m.user_id LEFT JOIN account_state s ON s.user_id=u.id WHERE conversation_id=?`,id);}
async function authorize(db:Database,id:string,userId:string){
  const list=await members(db,id);
  if(!list.some(m=>m.user_id===userId))throw new ApiError(404,"Conversation not found.");
  for(const m of list)if(m.user_id!==userId&&await blocked(db,userId,m.user_id))throw new ApiError(404,"Conversation not found.");
  return list;
}
async function chat(db:Database,id:string,userId:string){
  const record=await db.prepare("SELECT * FROM chat_conversations WHERE id=?").bind(id).first<{id:string;title:string;created_at:number;created_by:string}>();
  if(!record)return null;
  const list=await members(db,id),own=list.find(m=>m.user_id===userId);
  if(!own)return null;
  return {id:record.id,title:record.title,createdBy:record.created_by,createdAt:record.created_at,state:object(own.state),
    members:list.map(m=>({id:m.user_id,username:m.username,displayName:m.display_name,joinedAt:m.created_at,...publicDetails(m.data),
      lastReadAt:object(m.state).shareReceipts===false || !chatPreferences(m.data).readReceipts?null:m.last_read_at}))};
}
interface Message{id:string;conversation_id:string;author_id:string;kind:string;body:string;metadata:string;created_at:number;edited_at:number|null;username:string;display_name:string;data:string|null}
async function messageDtos(db:Database,id:string,list:Member[],messageId?:string){
  const messages=await rows<Message>(db,`SELECT m.*,u.username,u.display_name,s.data FROM chat_messages m
    JOIN users u ON u.id=m.author_id LEFT JOIN account_state s ON s.user_id=u.id
    WHERE m.conversation_id=? ${messageId?"AND m.id=?":""} ORDER BY m.created_at DESC,m.id DESC LIMIT 100`,id,...(messageId?[messageId]:[]));
  const attachments=await rows<{message_id:string;media_id:string;content_type:string;size:number}>(db,`SELECT cm.message_id,cm.media_id,a.content_type,a.size
    FROM chat_message_media cm JOIN user_media_assets a ON a.id=cm.media_id
    JOIN json_each(?) ids ON ids.value=cm.message_id WHERE a.ready=1 ORDER BY cm.position`,JSON.stringify(messages.map(m=>m.id)));
  return messages.reverse().map(m=>{
    const parsed=metadataSchema.safeParse(object(m.metadata)),metadata=parsed.success?parsed.data:{};
    const reactions:Record<string,string[]>={},votes:Record<number,string[]>={},peers=list.filter(x=>x.user_id!==m.author_id);
    for(const member of list){
      const state=object(member.state),react=object(state.reactions)[m.id],vote=object(state.pollVotes)[m.id];
      if(Array.isArray(react))for(const emoji of react)if(typeof emoji==="string")(reactions[emoji]??=[]).push(member.user_id);
      if(Number.isInteger(vote))(votes[Number(vote)]??=[]).push(member.user_id);
    }
    const readBy=peers.filter(p=>object(p.state).shareReceipts!==false&&chatPreferences(p.data).readReceipts&&p.last_read_at!==null&&p.last_read_at>=m.created_at).map(p=>p.user_id);
    return {id:m.id,conversationId:m.conversation_id,author:{id:m.author_id,username:m.username,displayName:m.display_name,...publicDetails(m.data)},
      kind:m.kind,body:m.body,createdAt:m.created_at,...metadata,
      ...(metadata.poll?{poll:{...metadata.poll,votes}}:{}),
      editedAt:m.edited_at??undefined,edited:!!m.edited_at,editHistory:Array.isArray(object(m.metadata).editHistory)?object(m.metadata).editHistory:[],
      media:attachments.filter(a=>a.message_id===m.id).map(a=>({reference:`oldtime-media:${a.media_id}`,contentType:a.content_type,size:a.size})),
      reactions,readBy,status:peers.length>0&&readBy.length===peers.length?"read":
        peers.length>0&&peers.every(peer=>Number(object(peer.state).deliveredThrough||0)>=m.created_at)?"delivered":"sent"};
  });
}
async function chatMentionRecipients(db:Database,userId:string,conversationId:string,list:Member[],text:string){
  const own=list.find(member=>member.user_id===userId);
  const handles=[...new Set([...text.matchAll(/(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])/g)].map(match=>match[1].toLowerCase()))]
    .filter(handle=>handle!==own?.username.toLowerCase()).slice(0,25);
  if(!handles.length)return [];
  const recipients=await rows<{id:string;username:string;data:string|null;follows:number}>(db,
    `SELECT u.id,u.username,s.data,
      EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_id=u.id AND f.followed_id=?) AS follows
     FROM chat_members cm JOIN users u ON u.id=cm.user_id LEFT JOIN account_state s ON s.user_id=u.id
     WHERE cm.conversation_id=? AND u.is_virtual=0 AND lower(u.username) IN (${handles.map(()=>"?").join(",")})`,
    userId,conversationId,...handles);
  const found=new Map(recipients.map(recipient=>[recipient.username.toLowerCase(),recipient]));
  for(const handle of handles){
    const recipient=found.get(handle);
    if(!recipient)throw new ApiError(400,"Only people in this conversation can be mentioned.");
    const preference=object(object(recipient.data).taggingPreferences).whoCanTag;
    if(preference==="nobody"||preference==="following"&&!recipient.follows)
      throw new ApiError(403,"You can’t tag @"+recipient.username+" because of their tagging settings.");
  }
  return [...found.values()];
}
async function send(request:Request,db:Database,id:string,userId:string,list:Member[]){
  const parsed=CreateChatMessageBody.safeParse(await body(request));
  if(!parsed.success)throw new ApiError(400,"Choose a valid message.");
  const input=parsed.data,caption=input.body.trim(),metadata=metadataSchema.safeParse(input.metadata??{});
  const mentionRecipients=input.kind==="text"?await chatMentionRecipients(db,userId,id,list,caption):[];
  if(input.kind==="call")throw new ApiError(410,"Calling is disabled.");
  if(!metadata.success)throw new ApiError(400,"Message details are invalid.");
  if(input.kind==="text"&&!caption)throw new ApiError(400,"Write a message before sending.");
  if(input.kind==="poll"&&!metadata.data.poll)throw new ApiError(400,"A poll needs a question and options.");
  if(metadata.data.replyTo&&!await db.prepare("SELECT 1 FROM chat_messages WHERE id=? AND conversation_id=?").bind(metadata.data.replyTo,id).first())throw new ApiError(404,"Reply target not found.");
  const ids=[...new Set(input.mediaIds??[])],mediaKind=["photo","video","gif","voice","file"].includes(input.kind);
  if(mediaKind!==!!ids.length)throw new ApiError(400,"Upload the attachment before sending this message.");
  const assets=ids.length?await rows<{id:string;user_id:string;ready:number;media_role:string;content_type:string}>(db,
    "SELECT a.* FROM user_media_assets a JOIN json_each(?) ids ON ids.value=a.id",JSON.stringify(ids)):[];
  const matches=(type:string)=>input.kind==="photo"?type.startsWith("image/")&&type!=="image/gif":input.kind==="video"?type.startsWith("video/"):
    input.kind==="gif"?type==="image/gif":input.kind==="voice"?type.startsWith("audio/"):input.kind==="file";
  if(assets.length!==ids.length||assets.some(a=>a.user_id!==userId||!a.ready||a.media_role!=="media"||!matches(a.content_type)))throw new ApiError(400,"Attachments are not confirmed for this account or message type.");
  const existing=await db.prepare("SELECT author_id,conversation_id,body,kind FROM chat_messages WHERE id=?").bind(input.clientId).first<{author_id:string;conversation_id:string;body:string;kind:string}>();
  if(existing){
    if(existing.author_id!==userId||existing.conversation_id!==id||existing.body!==caption||existing.kind!==input.kind)throw new ApiError(409,"This message ID is already used for different content.");
    return json({message:(await messageDtos(db,id,list,input.clientId))[0]},201);
  }
  const now=Date.now();
  await db.batch([
    db.prepare("INSERT INTO chat_messages(id,conversation_id,author_id,kind,body,metadata,created_at) VALUES(?,?,?,?,?,?,?)").bind(input.clientId,id,userId,input.kind,caption,JSON.stringify(metadata.data),now),
    ...ids.map((mediaId,position)=>db.prepare("INSERT INTO chat_message_media(message_id,media_id,position) VALUES(?,?,?)").bind(input.clientId,mediaId,position)),
    ...mentionRecipients.map(recipient=>db.prepare("INSERT INTO chat_mentions(id,conversation_id,message_id,recipient_id,actor_id,created_at) VALUES(?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),id,input.clientId,recipient.id,userId,now)),
    db.prepare("UPDATE chat_conversations SET updated_at=? WHERE id=?").bind(now,id),
  ]);
  return json({message:(await messageDtos(db,id,list,input.clientId))[0]},201);
}
export async function chatRequest(request:Request,db:Database,userId:string,path:string):Promise<Response>{
  if(path==="/chats/preferences")return chatPreferencesRequest(request,db,userId);
  if(path.startsWith("/chats/legacy-archives")){
    if(request.method==="GET")return json({archives:[]});
    throw new ApiError(410,"Oldtime is starting fresh. Legacy imports are disabled.");
  }
  if(path==="/chats"&&request.method==="GET"){
    const rooms=await rows<{id:string}>(db,`SELECT c.id FROM chat_conversations c JOIN chat_members m ON m.conversation_id=c.id
      WHERE m.user_id=? AND NOT EXISTS(SELECT 1 FROM chat_members peer JOIN account_blocks b
        ON (b.owner_id=? AND b.blocked_id=peer.user_id) OR (b.blocked_id=? AND b.owner_id=peer.user_id)
        WHERE peer.conversation_id=c.id) ORDER BY c.updated_at DESC LIMIT 200`,userId,userId,userId);
    const chats=[];for(const room of rooms){const c=await chat(db,room.id,userId);if(c)chats.push(c);}return json({chats});
  }
  if(path==="/chats"&&request.method==="POST"){
    const parsed=CreateChatBody.safeParse(await body(request));
    if(!parsed.success)throw new ApiError(400,"Choose valid chat members.");
    const input=parsed.data,ids=[...new Set([...input.members,userId])];
    if(ids.length<2||ids.length>16)throw new ApiError(400,"A chat needs 2–16 members.");
    const existing=await chat(db,input.id,userId);
    if(existing)return json({chat:existing},201);
    if(await db.prepare("SELECT 1 FROM chat_conversations WHERE id=?").bind(input.id).first())throw new ApiError(409,"That conversation ID is already in use.");
    const found=await db.prepare("SELECT count(*) AS total FROM users u JOIN json_each(?) ids ON ids.value=u.id").bind(JSON.stringify(ids)).first<{total:number}>();
    if(found?.total!==ids.length)throw new ApiError(400,"One or more chat members no longer exist.");
    for(const peer of ids)if(peer!==userId&&await blocked(db,userId,peer))throw new ApiError(403,"Blocked accounts cannot be added to a chat.");
    await enforceNewChatPermissions(db,userId,ids);
    const now=Date.now();
    await db.batch([
      db.prepare("INSERT INTO chat_conversations(id,created_by,title,created_at,updated_at) VALUES(?,?,?,?,?)").bind(input.id,userId,input.title?.trim()??"",now,now),
      ...ids.map(peer=>db.prepare("INSERT INTO chat_members(conversation_id,user_id,joined_at,state) VALUES(?,?,?,'{}')").bind(input.id,peer,now)),
    ]);
    return json({chat:await chat(db,input.id,userId)},201);
  }
  const groupMatch=/^\/chats\/([^/]{3,80})$/.exec(path);
  if(groupMatch&&request.method==="PATCH"){
    const id=groupMatch[1],list=await authorize(db,id,userId);
    const owner=await db.prepare("SELECT created_by FROM chat_conversations WHERE id=?").bind(id).first<{created_by:string}>();
    if(owner?.created_by!==userId)throw new ApiError(403,"Only the group creator can change the group.");
    if(list.length<3)throw new ApiError(400,"This conversation is not a group.");
    const parsed=z.object({title:z.string().trim().min(1).max(100).optional(),addMemberIds:z.array(z.uuid()).max(15).optional()}).strict().safeParse(await body(request));
    if(!parsed.success||(!parsed.data.title&&!parsed.data.addMemberIds?.length))throw new ApiError(400,"Choose a group name or people to add.");
    const additions=[...new Set(parsed.data.addMemberIds||[])].filter(peer=>!list.some(member=>member.user_id===peer));
    if(list.length+additions.length>16)throw new ApiError(400,"Groups can have up to 16 people.");
    for(const peer of additions){
      if(!await db.prepare("SELECT id FROM users WHERE id=?").bind(peer).first())throw new ApiError(400,"An account is no longer available.");
      if(await blocked(db,userId,peer))throw new ApiError(403,"Blocked accounts cannot be added to a group.");
    }
    if(additions.length)await enforceNewChatPermissions(db,userId,[userId,userId,...additions]);
    const now=Date.now();
    await db.batch([
      db.prepare("UPDATE chat_conversations SET title=COALESCE(?,title),updated_at=? WHERE id=? AND created_by=?").bind(parsed.data.title??null,now,id,userId),
      ...additions.map(peer=>db.prepare("INSERT INTO chat_members(conversation_id,user_id,joined_at,state) VALUES(?,?,?,'{}') ON CONFLICT DO NOTHING").bind(id,peer,now))
    ]);
    return json({chat:await chat(db,id,userId)});
  }
  const match=/^\/chats\/([^/]{3,80})\/(messages|state|read|delivered)(?:\/([^/]{3,80}))?$/.exec(path);
  if(!match)throw new ApiError(404,"Conversation not found.");
  const [,id,action,messageId]=match,list=await authorize(db,id,userId);
  if(action==="messages"&&!messageId&&request.method==="GET")return json({messages:await messageDtos(db,id,list)});
  if(action==="messages"&&!messageId&&request.method==="POST")return send(request,db,id,userId,list);
  if(action==="delivered"&&request.method==="POST"){
    const latest=await db.prepare("SELECT MAX(created_at) AS through FROM chat_messages WHERE conversation_id=? AND author_id<>?").bind(id,userId).first<{through:number|null}>();
    const through=Number(latest?.through||0),own=list.find(member=>member.user_id===userId)!;
    if(through>Number(object(own.state).deliveredThrough||0))await db.prepare("UPDATE chat_members SET state=json_set(state,'$.deliveredThrough',?) WHERE conversation_id=? AND user_id=?").bind(through,id,userId).run();
    return json({ok:true,deliveredThrough:through});
  }
  if(action==="messages"&&messageId){
    if(request.method==="DELETE"){
      const deleted=await db.prepare("DELETE FROM chat_messages WHERE id=? AND conversation_id=? AND author_id=? RETURNING id").bind(messageId,id,userId).first();
      if(!deleted)throw new ApiError(404,"Only your messages can be removed.");
      return new Response(null,{status:204});
    }
    if(request.method==="PATCH"){
      const parsed=z.object({body:z.string().trim().min(1).max(5000)}).strict().safeParse(await body(request));
      if(!parsed.success)throw new ApiError(400,"Write a message of 1–5000 characters.");
      const previous=await db.prepare("SELECT body,metadata,edited_at,created_at FROM chat_messages WHERE id=? AND conversation_id=? AND author_id=? AND kind='text'")
        .bind(messageId,id,userId).first<{body:string;metadata:string;edited_at:number|null;created_at:number}>();
      if(!previous)throw new ApiError(404,"Only your text messages can be edited.");
      const editedRecipients=await chatMentionRecipients(db,userId,id,list,parsed.data.body);
      const metadata=object(previous.metadata),history=Array.isArray(metadata.editHistory)?metadata.editHistory:[];
      const now=Date.now();
      await db.batch([
        db.prepare("UPDATE chat_messages SET body=?,metadata=?,edited_at=? WHERE id=? AND author_id=?")
          .bind(parsed.data.body,JSON.stringify({...metadata,editHistory:[...history,{body:previous.body,createdAt:previous.edited_at??previous.created_at}].slice(-10)}),now,messageId,userId),
        db.prepare("DELETE FROM chat_mentions WHERE message_id=?").bind(messageId),
        ...editedRecipients.map(recipient=>db.prepare("INSERT INTO chat_mentions(id,conversation_id,message_id,recipient_id,actor_id,created_at) VALUES(?,?,?,?,?,?)")
          .bind(crypto.randomUUID(),id,messageId,recipient.id,userId,now)),
      ]);
      return json({message:(await messageDtos(db,id,list,messageId))[0]});
    }
  }
  if(action==="read"&&request.method==="POST"){
    const parsed=z.object({shareReceipts:z.boolean().optional()}).strict().safeParse(await body(request));
    if(!parsed.success)throw new ApiError(400,"Choose valid read receipt settings.");
    const own=list.find(m=>m.user_id===userId)!;
    const share=chatPreferences(own.data).readReceipts &&
      (parsed.data.shareReceipts??object(own.state).shareReceipts!==false);
    const readThrough=Date.now();
    await db.prepare("UPDATE chat_members SET last_read_at=?,state=json_set(state,'$.shareReceipts',json(?),'$.markedUnread',json('false'),'$.readThrough',?) WHERE conversation_id=? AND user_id=?")
      .bind(share?readThrough:null,JSON.stringify(share),readThrough,id,userId).run();
    return json({ok:true,readThrough});
  }
  if(action==="state"&&request.method==="PUT"){
    const parsed=z.object({state:stateSchema}).strict().safeParse(await body(request));
    if(!parsed.success)throw new ApiError(400,"Conversation settings are invalid.");
    const state=parsed.data.state;
    if(Object.keys(state.reactions??{}).length>2000||Object.keys(state.pollVotes??{}).length>2000)throw new ApiError(400,"Too many message settings.");
    const references=[...new Set([...(state.pinnedIds??[]),...(state.savedMessageIds??[]),...(state.hiddenMessageIds??[]),...(state.keptMessageIds??[]),...Object.keys(state.reactions??{}),...Object.keys(state.pollVotes??{})])];
    const found=references.length?await rows<{id:string;kind:string;metadata:string}>(db,"SELECT m.id,m.kind,m.metadata FROM chat_messages m JOIN json_each(?) ids ON ids.value=m.id WHERE conversation_id=?",JSON.stringify(references),id):[];
    const allowed=new Set(found.map(m=>m.id));
    for(const key of ["pinnedIds","savedMessageIds","hiddenMessageIds","keptMessageIds"] as const)if(state[key])state[key]=state[key]!.filter(x=>allowed.has(x));
    if(state.reactions)state.reactions=Object.fromEntries(Object.entries(state.reactions).filter(([key])=>allowed.has(key)));
    if(state.pollVotes)state.pollVotes=Object.fromEntries(Object.entries(state.pollVotes).filter(([key,vote])=>{
      const m=found.find(x=>x.id===key),poll=object(object(m?.metadata).poll);
      return m?.kind==="poll"&&Array.isArray(poll.options)&&vote<poll.options.length;
    }));
    const entries=Object.entries(state);
    const updated=entries.length?await db.prepare(`UPDATE chat_members SET state=json_set(state,${entries.map(()=> "?,json(?)").join(",")})
      ${state.shareReceipts===false?",last_read_at=NULL":""} WHERE conversation_id=? AND user_id=? RETURNING state`)
      .bind(...entries.flatMap(([key,value])=>[`$.${key}`,JSON.stringify(value)]),id,userId).first<{state:string}>():null;
    return json({state:updated?object(updated.state):object(list.find(m=>m.user_id===userId)!.state)});
  }
  throw new ApiError(405,"Method not allowed.");
}
