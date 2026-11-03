import { z } from "zod/v4";
import { recordAuthorTopicSignals } from "./topic-signals";
import { ApiError, body, json, object, rows, blocked, publicDetails, uuid, type Database } from "./runtime";

const empty=()=>new Response(null,{status:204});
export function isRelationshipPath(path:string){
  return path.startsWith("/relationships")||["/account/privacy","/account/blocks","/close-friends"].includes(path);
}
async function profiles(db:Database,ids:string[]){
  if(!ids.length)return [];
  const records=await rows<{id:string;username:string;display_name:string;created_at:number;data:string|null}>(db,`
    SELECT u.id,u.username,u.display_name,u.created_at,s.data FROM users u
    JOIN json_each(?) chosen ON chosen.value=u.id LEFT JOIN account_state s ON s.user_id=u.id
    WHERE u.is_virtual=0`,JSON.stringify([...new Set(ids)]));
  const byId=new Map(records.map(u=>[u.id,{id:u.id,username:u.username,displayName:u.display_name,joinedAt:u.created_at,...publicDetails(u.data)}]));
  return ids.flatMap(id=>byId.get(id)?[byId.get(id)]:[]);
}
async function list(db:Database,userId:string){
  const following=await rows<{id:string}>(db,"SELECT f.followed_id AS id FROM user_follows f JOIN users u ON u.id=f.followed_id WHERE f.follower_id=? AND u.is_virtual=0 ORDER BY f.created_at DESC LIMIT 5000",userId);
  const followers=await rows<{id:string}>(db,`SELECT f.follower_id id FROM user_follows f JOIN users u ON u.id=f.follower_id
    WHERE f.followed_id=? AND u.is_virtual=0 ORDER BY f.created_at DESC,f.follower_id LIMIT 5000`,userId);
  const friends=await rows<{id:string}>(db,"SELECT CASE WHEN member_low_id=? THEN member_high_id ELSE member_low_id END AS id FROM friendships WHERE member_low_id=? OR member_high_id=? ORDER BY created_at DESC LIMIT 5000",userId,userId,userId);
  const requests=await rows<{id:string;kind:string}>(db,`SELECT requester_id AS id,'incomingFriendRequests' AS kind FROM friend_requests WHERE recipient_id=?
    UNION ALL SELECT recipient_id,'outgoingFriendRequests' FROM friend_requests WHERE requester_id=?
    UNION ALL SELECT requester_id,'incomingFollowRequests' FROM follow_requests WHERE recipient_id=?
    UNION ALL SELECT recipient_id,'outgoingFollowRequests' FROM follow_requests WHERE requester_id=? LIMIT 2000`,userId,userId,userId,userId);
  const result:Record<string,unknown>={following:await profiles(db,following.map(x=>x.id)),followers:await profiles(db,followers.map(x=>x.id)),friends:await profiles(db,friends.map(x=>x.id))};
  for(const kind of ["incomingFriendRequests","outgoingFriendRequests","incomingFollowRequests","outgoingFollowRequests"])result[kind]=await profiles(db,requests.filter(r=>r.kind===kind).map(r=>r.id));
  return json(result);
}
async function lists(request:Request,db:Database,userId:string,path:string){
  const blocks=path==="/account/blocks",table=blocks?"account_blocks":"close_friend_members",column=blocks?"blocked_id":"member_id";
  if(request.method==="PUT"){
    const parsed=z.object(blocks?{userIds:z.array(z.string().uuid()).max(500)}:{memberIds:z.array(z.string().uuid()).max(500)}).safeParse(await body(request));
    if(!parsed.success)throw new ApiError(400,"Choose a valid list of accounts.");
    const ids=[...new Set((object(parsed.data)[blocks?"userIds":"memberIds"]) as string[])];
    if(ids.includes(userId))throw new ApiError(400,"You cannot add your own account to this list.");
    const found=await db.prepare(`SELECT count(*) AS total FROM users u JOIN json_each(?) chosen ON chosen.value=u.id`).bind(JSON.stringify(ids)).first<{total:number}>();
    if(found?.total!==ids.length)throw new ApiError(400,"One or more accounts no longer exist.");
    if(!blocks){
      for(const id of ids){
        const [low,high]=[userId,id].sort();
        if(await blocked(db,userId,id)||!await db.prepare("SELECT 1 FROM friendships WHERE member_low_id=? AND member_high_id=?").bind(low,high).first())throw new ApiError(400,"Only confirmed Friends can be added to Close Friends.");
      }
    }
    const statements=[
      db.prepare(`DELETE FROM ${table} WHERE owner_id=?`).bind(userId),
      db.prepare(`INSERT INTO ${table}(owner_id,${column},created_at) SELECT ?,value,? FROM json_each(?)`).bind(userId,Date.now(),JSON.stringify(ids)),
    ];
    if(blocks&&ids.length){
      for(const [t,left,right] of [
        ["close_friend_members","owner_id","member_id"],["user_follows","follower_id","followed_id"],
        ["follow_requests","requester_id","recipient_id"],["friend_requests","requester_id","recipient_id"],
        ["friendships","member_low_id","member_high_id"],
      ]){
        statements.push(db.prepare(`DELETE FROM ${t} WHERE (${left}=? AND ${right} IN (SELECT value FROM json_each(?)))
          OR (${right}=? AND ${left} IN (SELECT value FROM json_each(?)))`).bind(userId,JSON.stringify(ids),userId,JSON.stringify(ids)));
      }
    }
    await db.batch(statements);
  }else if(request.method!=="GET")throw new ApiError(405,"Method not allowed.");
  const records=await rows<{id:string}>(db,`SELECT ${column} AS id FROM ${table} WHERE owner_id=? ORDER BY created_at`,userId);
  return json({profiles:await profiles(db,records.map(x=>x.id))});
}
export async function relationshipRequest(request:Request,db:Database,userId:string,path:string):Promise<Response>{
  if(path==="/relationships"&&request.method==="GET")return list(db,userId);
  if(path==="/account/privacy"){
    if(request.method==="PUT"){
      const parsed=z.object({isPrivate:z.boolean()}).strict().safeParse(await body(request));
      if(!parsed.success)throw new ApiError(400,"Choose a valid privacy setting.");
      await db.prepare("UPDATE users SET is_private=?,privacy_initialized=1 WHERE id=?").bind(Number(parsed.data.isPrivate),userId).run();
    }else if(request.method!=="GET")throw new ApiError(405,"Method not allowed.");
    const record=await db.prepare("SELECT is_private,privacy_initialized FROM users WHERE id=?").bind(userId).first<{is_private:number;privacy_initialized:number}>();
    return json({isPrivate:!!record?.is_private,initialized:!!record?.privacy_initialized});
  }
  if(path==="/close-friends"||path==="/account/blocks")return lists(request,db,userId,path);
  if(path==="/relationships/import-legacy")throw new ApiError(410,"Oldtime is starting fresh. Legacy imports are disabled.");
  const match=/^\/relationships\/(follow|follow-requests|friend-requests|friends)\/([^/]+)(\/accept)?$/.exec(path);
  if(!match)throw new ApiError(404,"Relationship action not found.");
  const [,kind,targetId,accept]=match;
  if(!uuid.test(targetId)||targetId===userId)throw new ApiError(400,"Choose another valid account.");
  const [low,high]=[userId,targetId].sort(),now=Date.now();
  if(request.method==="DELETE"){
    if(kind==="follow")await db.batch([
      db.prepare("DELETE FROM user_follows WHERE follower_id=? AND followed_id=?").bind(userId,targetId),
      db.prepare("DELETE FROM follow_requests WHERE requester_id=? AND recipient_id=?").bind(userId,targetId),
    ]);
    else if(kind==="friends")await db.batch([
      db.prepare("DELETE FROM friendships WHERE member_low_id=? AND member_high_id=?").bind(low,high),
      db.prepare("DELETE FROM close_friend_members WHERE (owner_id=? AND member_id=?) OR (owner_id=? AND member_id=?)").bind(userId,targetId,targetId,userId),
    ]);
    else await db.prepare(`DELETE FROM ${kind==="follow-requests"?"follow_requests":"friend_requests"}
      WHERE (requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)`).bind(userId,targetId,targetId,userId).run();
    return empty();
  }
  if(request.method!=="POST")throw new ApiError(405,"Method not allowed.");
  const target=await db.prepare("SELECT is_private FROM users WHERE id=?").bind(targetId).first<{is_private:number}>();
  if(!target)throw new ApiError(404,"Account not found.");
  if(await blocked(db,userId,targetId))throw new ApiError(403,"This relationship is not available.");
  if(kind==="follow"){
    const already=await db.prepare("SELECT 1 FROM user_follows WHERE follower_id=? AND followed_id=?").bind(userId,targetId).first();
    if(already)return json({following:true,requested:false});
    if(target.is_private){
      await db.prepare("INSERT INTO follow_requests(requester_id,recipient_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING").bind(userId,targetId,now).run();
      return json({following:false,requested:true});
    }
    await db.batch([
      db.prepare("DELETE FROM follow_requests WHERE requester_id=? AND recipient_id=?").bind(userId,targetId),
      db.prepare("INSERT INTO user_follows(follower_id,followed_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING").bind(userId,targetId,now),
    ]);
    await recordAuthorTopicSignals(db,userId,targetId).catch(error=>console.warn("Topic activity could not be updated",error));
    return json({following:true,requested:false});
  }
  if(kind==="follow-requests"&&accept){
    await db.batch([
      db.prepare(`INSERT INTO user_follows(follower_id,followed_id,created_at)
        SELECT requester_id,recipient_id,? FROM follow_requests WHERE requester_id=? AND recipient_id=? ON CONFLICT DO NOTHING`).bind(now,targetId,userId),
      db.prepare("DELETE FROM follow_requests WHERE requester_id=? AND recipient_id=?").bind(targetId,userId),
    ]);
    return empty();
  }
  if(kind==="friend-requests"){
    const existing=await db.prepare("SELECT 1 FROM friendships WHERE member_low_id=? AND member_high_id=?").bind(low,high).first();
    if(existing)return accept?empty():json({status:"friends"});
    const incoming=await db.prepare("SELECT 1 FROM friend_requests WHERE requester_id=? AND recipient_id=?").bind(targetId,userId).first();
    if(accept&&!incoming)throw new ApiError(404,"Friend request not found.");
    if(incoming){
      await db.batch([
        db.prepare("INSERT INTO friendships(member_low_id,member_high_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING").bind(low,high,now),
        db.prepare("DELETE FROM friend_requests WHERE (requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)").bind(userId,targetId,targetId,userId),
      ]);
      return accept?empty():json({status:"friends"});
    }
    await db.prepare("INSERT INTO friend_requests(requester_id,recipient_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING").bind(userId,targetId,now).run();
    return json({status:"requested"});
  }
  throw new ApiError(404,"Relationship action not found.");
}
