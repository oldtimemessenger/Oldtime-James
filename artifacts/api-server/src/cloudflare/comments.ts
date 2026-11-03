import { z } from "zod/v4";
import { ApiError, body, json, rows, publicDetails, blocked, type Database } from "./runtime";
import { getPost } from "./post-repository";
import { mentionRecipients } from "./social";
import { meaningful } from "./content-fingerprint";

export async function commentsRequest(request:Request,db:Database,userId:string,path:string):Promise<Response>{
  const match=/^\/posts\/([a-f0-9-]{36})\/comments(?:\/([a-f0-9-]{36})(\/reaction)?)?$/.exec(path);
  if(!match)throw new ApiError(404,"Comment not found.");
  const [,postId,commentId,reaction]=match,post=await getPost(db,userId,postId);
  if(!post)throw new ApiError(404,"Post not found.");
  if(!commentId&&request.method==="GET"){
    const comments=await rows<{id:string;parent_id:string|null;body:string;created_at:number;user_id:string;username:string;display_name:string;data:string|null}>(db,`
      SELECT c.*,u.username,u.display_name,s.data FROM post_comments c JOIN users u ON u.id=c.user_id
      LEFT JOIN account_state s ON s.user_id=u.id WHERE c.post_id=?
      AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.owner_id=? AND b.blocked_id=c.user_id) OR (b.owner_id=c.user_id AND b.blocked_id=?))
      AND u.is_virtual=0
      ORDER BY c.created_at DESC,c.id LIMIT 100`,postId,userId,userId);
    const counts=await db.prepare(`SELECT count(*) AS total
      FROM post_comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=?
        AND NOT EXISTS(SELECT 1 FROM account_blocks b
          WHERE (b.owner_id=? AND b.blocked_id=c.user_id) OR (b.owner_id=c.user_id AND b.blocked_id=?))
        AND u.is_virtual=0`)
      .bind(postId,userId,userId).first<{total:number}>();
    const reactions=await rows<{comment_id:string;user_id:string;reaction:string}>(db,`SELECT r.* FROM post_comment_reactions r
      JOIN post_comments c ON c.id=r.comment_id JOIN users u ON u.id=r.user_id
      WHERE c.post_id=? AND u.is_virtual=0`,postId);
    return json({total:counts?.total??0,comments:comments.map(c=>{
      return {
        id:c.id,parentId:c.parent_id,body:c.body,createdAt:c.created_at,
        author:{id:c.user_id,username:c.username,displayName:c.display_name,...publicDetails(c.data)},
        likes:reactions.filter(r=>r.comment_id===c.id&&r.reaction==="like").map(r=>r.user_id),
        dislikes:reactions.filter(r=>r.comment_id===c.id&&r.reaction==="dislike").map(r=>r.user_id),
      };
    })});
  }
  if(!commentId&&request.method==="POST"){
    const parsed=z.object({body:z.string().trim().min(1).max(1000),parentId:z.string().uuid().nullable().optional()}).strict().safeParse(await body(request));
    if(!parsed.success)throw new ApiError(400,"Write a comment of 1–1,000 characters.");
    if(parsed.data.parentId&&!await db.prepare("SELECT 1 FROM post_comments WHERE id=? AND post_id=?").bind(parsed.data.parentId,postId).first())throw new ApiError(404,"Reply target not found.");
    const recipients=await mentionRecipients(db,userId,parsed.data.body,post.visibility,post.author_id);
    const id=crypto.randomUUID(),now=Date.now();
    await db.batch([
      db.prepare("INSERT INTO post_comments(id,post_id,user_id,parent_id,body,created_at,meaningful) VALUES(?,?,?,?,?,?,?)")
        .bind(id,postId,userId,parsed.data.parentId??null,parsed.data.body,now,Number(meaningful(parsed.data.body))),
      ...recipients.map(r=>db.prepare("INSERT INTO content_mentions(id,recipient_id,actor_id,kind,post_id,post_comment_id,created_at) VALUES(?,?,?,'post-comment',?,?,?)")
        .bind(crypto.randomUUID(),r.id,userId,postId,id,now)),
    ]);
    const author=await db.prepare("SELECT id,username,display_name AS displayName FROM users WHERE id=?").bind(userId).first();
    return json({id,parentId:parsed.data.parentId??null,body:parsed.data.body,createdAt:now,author,likes:[],dislikes:[]});
  }
  const comment=await db.prepare("SELECT user_id FROM post_comments WHERE id=? AND post_id=?").bind(commentId,postId).first<{user_id:string}>();
  if(!comment||await blocked(db,userId,comment.user_id))throw new ApiError(404,"Comment not found.");
  if(reaction&&request.method==="PUT"){
    const parsed=z.object({reaction:z.enum(["like","dislike"]).nullable()}).strict().safeParse(await body(request));
    if(!parsed.success)throw new ApiError(400,"Choose a valid reaction.");
    const previous=await db.prepare("SELECT reaction FROM post_comment_reactions WHERE comment_id=? AND user_id=?").bind(commentId,userId).first<{reaction:string}>();
    const next=parsed.data.reaction===previous?.reaction?null:parsed.data.reaction;
    if(next)await db.prepare(`INSERT INTO post_comment_reactions(comment_id,user_id,reaction,created_at) VALUES(?,?,?,?)
      ON CONFLICT(comment_id,user_id) DO UPDATE SET reaction=excluded.reaction,created_at=excluded.created_at`).bind(commentId,userId,next,Date.now()).run();
    else await db.prepare("DELETE FROM post_comment_reactions WHERE comment_id=? AND user_id=?").bind(commentId,userId).run();
    const list=await rows<{user_id:string;reaction:string}>(db,"SELECT user_id,reaction FROM post_comment_reactions WHERE comment_id=?",commentId);
    return json({likes:list.filter(r=>r.reaction==="like").map(r=>r.user_id),dislikes:list.filter(r=>r.reaction==="dislike").map(r=>r.user_id),reaction:next});
  }
  if(!reaction&&request.method==="DELETE"&&comment.user_id===userId){
    await db.prepare("DELETE FROM post_comments WHERE id=? AND post_id=? AND user_id=?").bind(commentId,postId,userId).run();
    return json({deleted:true});
  }
  throw new ApiError(403,"Only your own comment can be removed.");
}
