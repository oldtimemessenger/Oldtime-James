import { z } from "zod/v4";
import { UpdateAccountProfessionalBody } from "@workspace/api-zod";
import { ApiError, body, json, object, rows, type Database } from "./runtime";
import { referenceWrites } from "./media-references";
const mediaPattern=/^oldtime-media:([a-f0-9-]{36})$/i;
const draftSchema=z.object({
  version:z.literal(1),project:z.record(z.string(),z.unknown()),state:z.record(z.string(),z.unknown()),
  media:z.array(z.string().regex(mediaPattern)).max(100).refine(x=>new Set(x).size===x.length),savedAt:z.number().int().nonnegative(),
}).strict();
const records=z.array(z.record(z.string(),z.unknown())).max(5000);
const blastSocial=z.object({version:z.literal(1),friendships:records,friendRequests:records,posts:records,
  preferences:z.record(z.string(),z.unknown()),communityMemberships:records}).passthrough();
const blastVideo=z.object({version:z.literal(1),notes:records,chats:records,saved:z.array(z.record(z.string(),z.unknown())).max(10000)}).passthrough();
function collect(value:unknown,refs=new Set<string>(),field=false){
  if(typeof value==="string"){
    if(/^(blob:|data:(image|video|audio)\/)/i.test(value))throw new ApiError(400,"Upload media before saving.");
    const match=mediaPattern.exec(value);
    if(match)refs.add(match[1]);
    else if(field){
      const plain=/^(?:(?:oldtime-media|media)-)?([a-f0-9-]{36})$/i.exec(value);
      if(!plain)throw new ApiError(400,"An attachment has an invalid media reference.");
      refs.add(plain[1]);
    }
  }else if(Array.isArray(value))for(const item of value)collect(item,refs,field);
  else if(value&&typeof value==="object")for(const [key,item] of Object.entries(value))collect(item,refs,["mediaId","mediaIds","reference"].includes(key));
  return refs;
}
async function owned(db:Database,userId:string,ids:string[]){
  if(!ids.length)return;
  const found=await db.prepare(`SELECT count(*) AS total FROM user_media_assets a JOIN json_each(?) ids ON ids.value=a.id WHERE a.user_id=? AND a.ready=1`)
    .bind(JSON.stringify(ids),userId).first<{total:number}>();
  if(found?.total!==ids.length)throw new ApiError(400,"Upload and confirm every attachment before saving.");
}
export function isAccountDataPath(path:string){return path==="/creative/drafts"||path.startsWith("/creative/drafts/")||path.startsWith("/blast/state/")||path==="/account/reports"||path==="/account/professional";}
export async function accountDataRequest(request:Request,db:Database,userId:string,path:string):Promise<Response>{
  if(path==="/account/professional"){
    if(request.method==="PUT"){
      const parsed=UpdateAccountProfessionalBody.strict().safeParse(await body(request));
      let validUrl=true;
      if(parsed.success&&parsed.data.website)try{const u=new URL(parsed.data.website);validUrl=u.protocol==="https:"&&!u.username&&!u.password;}catch{validUrl=false;}
      if(!parsed.success||!validUrl||parsed.data.accountType==="creator"&&!parsed.data.creatorCategory||parsed.data.accountType==="business"&&!parsed.data.businessCategory)
        throw new ApiError(400,"Choose a valid account type, category and ordinary HTTPS website. Roles, privacy and verification cannot be changed here.");
      const {accountType,...metadata}=parsed.data;
      await db.prepare("UPDATE users SET account_type=?,professional_profile=? WHERE id=?").bind(accountType,JSON.stringify(metadata),userId).run();
    }else if(request.method!=="GET")throw new ApiError(405,"Method not allowed.");
    const row=await db.prepare("SELECT account_type,professional_profile FROM users WHERE id=?").bind(userId).first<{account_type:string;professional_profile:string}>();
    if(!row)throw new ApiError(404,"Account not found.");
    return json({accountType:row.account_type,creatorCategory:null,businessCategory:null,website:"",location:"",contact:"",showCategory:true,showContact:false,...object(row.professional_profile)});
  }
  if(path==="/account/reports"){
    if(request.method==="GET"){
      const reports=await rows<{id:string;kind:string;category:string;reason:string;status:string;created_at:number}>(db,
        "SELECT id,kind,category,reason,status,created_at FROM content_reports WHERE reporter_id=? ORDER BY created_at DESC LIMIT 100",userId);
      return json({reports:reports.map(r=>({...r,createdAt:new Date(r.created_at).toISOString(),created_at:undefined}))});
    }
    if(request.method==="POST"){
      const parsed=z.object({kind:z.enum(["problem","profile","post","story","comment","message"]),category:z.string().trim().min(1).max(80),
        targetUserId:z.string().uuid().optional(),postId:z.string().trim().min(1).max(128).optional(),
        messageId:z.uuid().optional(),commentId:z.string().trim().min(1).max(128).optional(),reason:z.string().trim().min(10).max(1000)}).strict().safeParse(await body(request));
      if(!parsed.success||parsed.data.kind==="profile"&&!parsed.data.targetUserId)throw new ApiError(400,"Add a valid report description and target.");
      const i=parsed.data,id=crypto.randomUUID(),now=Date.now();
      if(i.kind==="message"){
        if(!i.messageId)throw new ApiError(400,"Choose a message to report.");
        const message=await db.prepare(`SELECT m.author_id,m.conversation_id FROM chat_messages m
          JOIN chat_members cm ON cm.conversation_id=m.conversation_id AND cm.user_id=? WHERE m.id=?`)
          .bind(userId,i.messageId).first<{author_id:string;conversation_id:string}>();
        if(!message)throw new ApiError(404,"Message not found in your conversations.");
        i.targetUserId=message.author_id;
        i.reason=`Message ${i.messageId} in conversation ${message.conversation_id}\n${i.reason}`;
      }
      if(i.targetUserId&&!await db.prepare("SELECT 1 FROM users WHERE id=?").bind(i.targetUserId).first())throw new ApiError(404,"Account not found.");
      await db.prepare("INSERT INTO content_reports(id,reporter_id,target_user_id,kind,category,post_id,comment_id,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(id,userId,i.targetUserId??null,i.kind,i.category,i.postId??null,i.commentId??null,i.reason,now).run();
      return json({report:{id,status:"received",createdAt:new Date(now).toISOString()}},201);
    }
  }
  if(path==="/creative/drafts"&&request.method==="DELETE"){
    const drafts=await rows<{data:string}>(db,"SELECT data FROM creative_drafts WHERE user_id=?",userId);
    const mediaIds=new Set<string>();
    for(const draft of drafts)for(const id of collect(object(draft.data)))mediaIds.add(id);
    const references=await rows<{media_id:string}>(db,
      "SELECT media_id FROM media_references WHERE user_id=? AND target_type='draft'",userId);
    for(const reference of references)mediaIds.add(reference.media_id);
    await db.batch([
      db.prepare("DELETE FROM media_references WHERE user_id=? AND target_type='draft'").bind(userId),
      db.prepare("DELETE FROM creative_drafts WHERE user_id=?").bind(userId),
    ]);
    return json({deletedDrafts:drafts.length,mediaIds:[...mediaIds]});
  }
  if(path.startsWith("/creative/drafts/")){
    const context=decodeURIComponent(path.slice("/creative/drafts/".length));
    if(!/^[a-z0-9:_-]{1,120}$/i.test(context))throw new ApiError(400,"Draft context is invalid.");
    if(request.method==="GET"){
      const row=await db.prepare("SELECT data FROM creative_drafts WHERE user_id=? AND context=?").bind(userId,context).first<{data:string}>();
      return json({draft:row?object(row.data):null});
    }
    if(request.method==="DELETE"){
      await db.batch([
        db.prepare("DELETE FROM creative_drafts WHERE user_id=? AND context=?").bind(userId,context),
        db.prepare("DELETE FROM media_references WHERE user_id=? AND target_type='draft' AND target_id=?").bind(userId,context),
      ]);
      return new Response(null,{status:204});
    }
    if(request.method==="PUT"){
      const parsed=draftSchema.safeParse(await body(request,2*1024*1024));
      if(!parsed.success)throw new ApiError(400,"This draft is invalid or too large.");
      const draft=parsed.data,refs=collect([draft.project,draft.state]);
      const ids=draft.media.map(ref=>ref.slice(14));
      if(refs.size>100||[...refs].some(id=>!ids.includes(id)))throw new ApiError(400,"Draft media references are incomplete.");
      await owned(db,userId,ids);
      const now=Date.now();
      await db.batch([
        ...referenceWrites(db,userId,"draft",context,ids),
        db.prepare(`INSERT INTO creative_drafts(user_id,context,data,updated_at) VALUES(?,?,?,?)
          ON CONFLICT(user_id,context) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at`).bind(userId,context,JSON.stringify(draft),now),
      ]);
      return json({ok:true,updatedAt:now});
    }
  }
  if(path.startsWith("/blast/state/")){
    const scope=path.slice("/blast/state/".length);
    if(!["social","video-notes"].includes(scope))throw new ApiError(400,"Blast data scope is invalid.");
    if(request.method==="GET"){
      const row=await db.prepare("SELECT revision,data FROM blast_account_state WHERE user_id=? AND scope=?").bind(userId,scope).first<{revision:number;data:string}>();
      return json({revision:row?.revision??0,data:row?object(row.data):null});
    }
    if(request.method==="PUT"){
      const parsed=z.object({revision:z.number().int().min(0),data:z.record(z.string(),z.unknown())}).strict().safeParse(await body(request,2*1024*1024));
      if(!parsed.success||!(scope==="social"?blastSocial:blastVideo).safeParse(parsed.data.data).success)throw new ApiError(400,"Blast data is invalid.");
      const input=parsed.data,ids=[...collect(input.data)],nonce=crypto.randomUUID(),now=Date.now();
      await owned(db,userId,ids);
      const result=await db.batch<{revision:number;data:string}>([
        db.prepare(`INSERT INTO blast_account_state(user_id,scope,revision,data,updated_at,write_nonce)
          SELECT ?,?,?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM blast_account_state WHERE user_id=? AND scope=? AND revision=?)
          ON CONFLICT(user_id,scope) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated_at=excluded.updated_at,write_nonce=excluded.write_nonce
          WHERE blast_account_state.revision=? RETURNING revision,data`)
          .bind(userId,scope,input.revision+1,JSON.stringify(input.data),now,nonce,input.revision,userId,scope,input.revision,input.revision),
        ...referenceWrites(db,userId,"blast",scope,ids,nonce),
      ]);
      const updated=result[0].results?.[0];
      if(!updated)throw new ApiError(409,"Blast data changed in another session. Reload it and try again.");
      return json({revision:updated.revision,data:object(updated.data)});
    }
  }
  throw new ApiError(405,"Method not allowed.");
}
