import { createHash,randomBytes } from "node:crypto";
import { ApiError,json,rows,type Database } from "./runtime";
import { mentionRecipients } from "./social";
export interface RealtimeNamespace {
  idFromName(name:string):unknown;
  get(id:unknown):{fetch(request:Request):Promise<Response>};
}
interface RealtimeEnv {DB:Database;REALTIME:RealtimeNamespace}
interface Socket extends WebSocket {serializeAttachment(value:unknown):void;deserializeAttachment():unknown}
interface ObjectState {
  acceptWebSocket(socket:Socket,tags?:string[]):void;
  getWebSockets():Socket[];
  setWebSocketAutoResponse(pair:unknown):void;
}
declare const WebSocketPair:{new():{0:Socket;1:Socket}};
declare const WebSocketRequestResponsePair:{new(request:string,response:string):unknown};
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const sessionHash=(request:Request)=>digest((request.headers.get("authorization")??"").replace(/^Bearer\s+/i,"").trim());
export async function realtimeTicket(request:Request,env:RealtimeEnv,userId:string){
  const ticket=randomBytes(24).toString("base64url"),hash=sessionHash(request),now=Date.now(),expiresAt=now+60000;
  const result=await env.DB.batch([
    env.DB.prepare("DELETE FROM realtime_tickets WHERE user_id=? AND expires_at<=?").bind(userId,now),
    env.DB.prepare(`INSERT INTO realtime_tickets(token_hash,user_id,session_hash,expires_at)
      SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions WHERE token_hash=? AND user_id=? AND expires_at>?)`)
      .bind(digest(ticket),userId,hash,expiresAt,hash,userId,now),
  ]);
  if(result[1].meta?.changes!==1)throw new ApiError(401,"Your session has expired. Sign in again.");
  return json({ticket,expiresAt});
}
export async function realtimeUpgrade(request:Request,env:RealtimeEnv){
  if(request.headers.get("upgrade")?.toLowerCase()!=="websocket")throw new ApiError(400,"We couldn’t connect to live updates. Please reconnect.");
  const ticket=new URL(request.url).searchParams.get("ticket")??"";
  if(!/^[A-Za-z0-9_-]{32}$/.test(ticket))throw new ApiError(401,"A fresh connection ticket is required.");
  const row=await env.DB.prepare(`DELETE FROM realtime_tickets WHERE token_hash=? AND expires_at>?
    AND EXISTS(SELECT 1 FROM sessions s WHERE s.token_hash=realtime_tickets.session_hash AND s.user_id=realtime_tickets.user_id AND s.expires_at>?)
    RETURNING user_id,session_hash`).bind(digest(ticket),Date.now(),Date.now()).first<{user_id:string;session_hash:string}>();
  if(!row)throw new ApiError(401,"This connection ticket expired or was already used.");
  const headers=new Headers(request.headers);
  headers.set("X-Oldtime-User",row.user_id);headers.set("X-Oldtime-Session",row.session_hash);
  return env.REALTIME.get(env.REALTIME.idFromName(row.user_id)).fetch(new Request("https://oldtime-realtime.internal/connect",{headers}));
}
export async function dispatchRealtime(env:RealtimeEnv,userId:string,chatId?:string|null){
  const response=await env.REALTIME.get(env.REALTIME.idFromName(userId)).fetch(new Request("https://oldtime-realtime.internal/update",{
    method:"POST",body:JSON.stringify({userId,chatId}),
  }));
  if(!response.ok)throw new Error("A real-time update could not be delivered.");
}
// One object per account, no media, calling, permanent messages, or polling loop.
// Hibernation and automatic heartbeats keep idle connections from consuming CPU.
export class OldtimeRealtime {
  constructor(private state:ObjectState,private env:RealtimeEnv){
    state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping","pong"));
  }
  async fetch(request:Request){
    if(request.method==="GET"&&request.headers.get("upgrade")?.toLowerCase()==="websocket"){
      const userId=request.headers.get("X-Oldtime-User"),hash=request.headers.get("X-Oldtime-Session");
      if(!userId||!hash||!/^[a-f0-9]{64}$/.test(hash))return json({error:"Unauthorized connection."},401);
      const active=await this.env.DB.prepare("SELECT id FROM sessions WHERE user_id=? AND token_hash=? AND expires_at>?").bind(userId,hash,Date.now()).first();
      if(!active)return json({error:"Your session expired."},401);
      if(this.state.getWebSockets().filter(s=>s.readyState===1).length>=12)return json({error:"Too many open connections. Close an unused Oldtime tab."},429);
      const pair=new WebSocketPair();this.state.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({sessionHash:hash});
      return new Response(null,{status:101,webSocket:pair[0]} as ResponseInit&{webSocket:Socket});
    }
    if(request.method!=="POST")return json({error:"Method not allowed."},405);
    const sockets=this.state.getWebSockets();if(!sockets.length)return new Response(null,{status:204});
    const input=await request.json() as {userId:string;chatId?:string|null};
    const active=new Set((await rows<{token_hash:string}>(this.env.DB,"SELECT token_hash FROM sessions WHERE user_id=? AND expires_at>?",input.userId,Date.now())).map(s=>s.token_hash));
    for(const socket of sockets){
      if(socket.readyState!==1)continue;
      const attachment=socket.deserializeAttachment() as {sessionHash?:string}|null;
      try{
        if(!attachment?.sessionHash||!active.has(attachment.sessionHash)){
          socket.send(JSON.stringify({event:"session:expired"}));
          socket.close(1008,"Your session expired.");continue;
        }
        if(input.chatId!==undefined)socket.send(JSON.stringify({event:"chat:changed",data:{conversationId:input.chatId}}));
        socket.send(JSON.stringify({event:"notifications:changed"}));
      }catch{try{socket.close(1011,"Reconnect to receive updates.");}catch{}}
    }
    return new Response(null,{status:204});
  }
  webSocketMessage(socket:Socket,_message:string|ArrayBuffer){socket.close(1008,"This connection only receives updates.");}
  // Acknowledge peer close frames explicitly so the hibernating socket finishes
  // its close handshake instead of leaving the client stuck in CLOSING.
  webSocketClose(socket:Socket,code:number,reason:string){socket.close(code===1005?1000:code,reason.slice(0,100));}
  webSocketError(socket:Socket){socket.close(1011,"Reconnect to receive updates.");}
}
export async function notifyRealtime(request:Request,response:Response,env:RealtimeEnv){
  const path=new URL(request.url).pathname.replace(/^\/api(?=\/|$)/,"");
  if(!/^\/(chats(?:\/|$)|posts(?:\/|$)|relationships\/|stories(?:\/|$)|notifications(?:\/|$)|creator\/content(?:\/|$))/.test(path))return;
  // Clone only bodies needed for recipient selection, before the first await.
  // Consume that branch immediately; never tee large account/media responses.
  const details=(path==="/chats"||path==="/posts"||/\/comments$/.test(path)&&request.method==="POST")
    ?response.clone().json().catch(()=>({})):Promise.resolve({});
  const user=await env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?").bind(sessionHash(request),Date.now()).first<{user_id:string}>();
  if(!user)return;
  const recipients=new Map<string,string|null|undefined>([[user.user_id,undefined]]);
  const chat=/^\/chats\/([^/]+)/.exec(path),post=/^\/posts\/([^/]+)/.exec(path),story=/^\/stories\/([^/]+)/.exec(path);
  if(path==="/chats"||chat){
    const input=path==="/chats"?await details as {chat?:{id?:string}}:null,id=chat?.[1]??input?.chat?.id;
    if(id){
      const peers=await rows<{user_id:string}>(env.DB,"SELECT user_id FROM chat_members WHERE conversation_id=? LIMIT 200",id);
      for(const peer of peers)if(!path.endsWith("/state")||peer.user_id===user.user_id)recipients.set(peer.user_id,id);
    }
  }else if(post){
    const owner=await env.DB.prepare("SELECT author_id,visibility FROM posts WHERE id=?").bind(post[1]).first<{author_id:string;visibility:string}>();
    if(owner)recipients.set(owner.author_id,undefined);
    if(/\/comments$/.test(path)&&request.method==="POST"){
      const comment=await details as {body?:string;parentId?:string};
      if(owner&&comment.body)for(const recipient of await mentionRecipients(env.DB,user.user_id,comment.body,owner.visibility,owner.author_id))recipients.set(recipient.id,undefined);
      if(comment.parentId){
        const parent=await env.DB.prepare("SELECT user_id FROM post_comments WHERE id=? AND post_id=?").bind(comment.parentId,post[1]).first<{user_id:string}>();
        if(parent)recipients.set(parent.user_id,undefined);
      }
    }
  }else if(story){
    const owner=await env.DB.prepare("SELECT author_id FROM stories WHERE id=?").bind(story[1]).first<{author_id:string}>();
    if(owner)recipients.set(owner.author_id,undefined);
  }else if(path==="/posts"&&request.method==="POST"){
    const input=await details as {post?:{text?:string;visibility?:string}};
    if(input.post?.text)for(const recipient of await mentionRecipients(env.DB,user.user_id,input.post.text,input.post.visibility??"close-friends"))recipients.set(recipient.id,undefined);
  }else{
    const relationship=/^\/relationships\/(?:follow|follow-requests|friend-requests|friends)\/([^/]+)/.exec(path);
    if(relationship)recipients.set(relationship[1],undefined);
  }
  await Promise.all([...recipients].slice(0,200).map(([id,chatId])=>dispatchRealtime(env,id,chatId)));
}
