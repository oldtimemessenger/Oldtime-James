import { UpdateCreatorProgramConfigBody } from "@workspace/api-zod";
import { hasPermanentBlueBadge } from "@workspace/api-zod/account-policy";
import { evaluateCreator, membershipIsActive } from "../lib/creator-eligibility";
import { badgeState } from "../lib/badge-readiness";
import { defaultCreatorConfig } from "./creator-config";
import { ApiError, object, rows, type Database } from "./runtime";
export interface ProgramAccount {user_id:string;status:string;approved_at:number|null;restricted:number;is_admin:number;interested:number;last_seen_at:number|null;returning_offer_until:number|null;preferences:string}
export async function creatorConfig(db:Database){
  const r=await db.prepare("SELECT value FROM creator_program_config WHERE key='program'").first<{value:string}>();
  return r?UpdateCreatorProgramConfigBody.parse({...defaultCreatorConfig,...object(r.value)}):structuredClone(defaultCreatorConfig);
}
export async function programAccount(db:Database,userId:string){
  await db.prepare("INSERT INTO creator_program_accounts(user_id) VALUES(?) ON CONFLICT DO NOTHING").bind(userId).run();
  const r=await db.prepare("SELECT * FROM creator_program_accounts WHERE user_id=?").bind(userId).first<ProgramAccount>();
  if(!r)throw new ApiError(404,"Account not found.");
  return r;
}
export async function membership(db:Database,userId:string){
  if(hasPermanentBlueBadge(userId))return {active:true,store:null,expiresAt:null,introUsed:false,status:"active" as const,autoRenews:false,canceledAt:null};
  const r=await db.prepare("SELECT * FROM blue_badge_entitlements WHERE user_id=?").bind(userId).first<Record<string,unknown>>();
  const entitlement=r&&Number(r.verified_at)>0&&Number(r.expires_at)>0?{store:String(r.store),state:String(r.state),verifiedAt:new Date(Number(r.verified_at)),expiresAt:new Date(Number(r.expires_at)),
    revokedAt:r.revoked_at?new Date(Number(r.revoked_at)):null,canceledAt:r.canceled_at?new Date(Number(r.canceled_at)):null,billingIssueAt:r.billing_issue_at?new Date(Number(r.billing_issue_at)):null}:undefined;
  return {active:membershipIsActive(entitlement),store:r&&["apple","google"].includes(String(r.store))?String(r.store):null,
    expiresAt:r?Number(r.expires_at):null,introUsed:!!r?.intro_used,status:badgeState(entitlement),autoRenews:r?.auto_renews==null?null:!!r.auto_renews,canceledAt:r?.canceled_at?Number(r.canceled_at):null};
}
const qualifying=`WITH owner AS(SELECT ? AS id), persisted AS(
  SELECT id,created_at,'t:'||text_fingerprint AS dedupe,'text' AS kind,'post' AS surface FROM posts
    WHERE author_id=(SELECT id FROM owner) AND meaningful=1
  UNION ALL
  SELECT c.id,c.created_at,CASE WHEN c.kind='text' THEN 't:' ELSE 'm:' END||c.fingerprint,c.kind,c.surface
    FROM creator_original_content c WHERE c.user_id=(SELECT id FROM owner) AND c.deleted_at IS NULL AND c.original=1
    AND (c.kind='text' OR EXISTS(SELECT 1 FROM creator_media_assets a WHERE a.content_id=c.id AND a.confirmed_at IS NOT NULL AND a.fingerprint IS NOT NULL))
), ranked AS(SELECT *,row_number() OVER(PARTITION BY dedupe ORDER BY created_at,id) AS position FROM persisted),
qualifying AS(SELECT * FROM ranked WHERE position=1)`;
export async function creatorDashboard(db:Database,userId:string){
  const [config,account,member]=await Promise.all([creatorConfig(db),programAccount(db,userId),membership(db,userId)]);
  const now=Date.now(),established=now-604800000,active=now-1209600000;
  const results=await db.batch<Record<string,unknown>>([
    db.prepare(`${qualifying} SELECT count(*) AS original,
      coalesce(sum(kind='text'),0) AS texts,coalesce(sum(kind='photo'),0) AS photos,coalesce(sum(kind='video'),0) AS videos,
      coalesce(sum(surface='story'),0) AS stories,coalesce(sum(surface='community'),0) AS communityPosts FROM qualifying`).bind(userId),
    db.prepare(`${qualifying}, received AS(
      SELECT l.user_id FROM organic_post_likes l JOIN qualifying p ON p.id=l.post_id JOIN users u ON u.id=l.user_id
        WHERE l.user_id<>(SELECT id FROM owner) AND u.created_at<=?
      UNION
      SELECT c.user_id FROM organic_post_comments c JOIN qualifying p ON p.id=c.post_id JOIN users u ON u.id=c.user_id
        WHERE c.user_id<>(SELECT id FROM owner) AND u.created_at<=? AND c.meaningful=1)
      SELECT count(*) AS received FROM received`).bind(userId,established,established),
    db.prepare(`${qualifying}, active_days AS(
      SELECT date(created_at/1000,'unixepoch') AS day FROM qualifying WHERE created_at>=?
      UNION SELECT date(l.created_at/1000,'unixepoch') FROM organic_post_likes l JOIN posts p ON p.id=l.post_id
        WHERE l.user_id=(SELECT id FROM owner) AND p.author_id<>(SELECT id FROM owner) AND l.created_at>=?
      UNION SELECT date(c.created_at/1000,'unixepoch') FROM organic_post_comments c JOIN posts p ON p.id=c.post_id
        WHERE c.user_id=(SELECT id FROM owner) AND p.author_id<>(SELECT id FROM owner) AND c.created_at>=? AND c.meaningful=1)
      SELECT count(*) AS days FROM active_days`).bind(userId,active,active,active),
    db.prepare(`WITH owner AS(SELECT ? AS id),peers AS(
      SELECT p.author_id FROM organic_post_likes l JOIN posts p ON p.id=l.post_id JOIN users u ON u.id=p.author_id
        WHERE l.user_id=(SELECT id FROM owner) AND p.author_id<>(SELECT id FROM owner) AND length(trim(p.text))>=20 AND u.created_at<=?
      UNION SELECT p.author_id FROM organic_post_comments c JOIN posts p ON p.id=c.post_id JOIN users u ON u.id=p.author_id
        WHERE c.user_id=(SELECT id FROM owner) AND p.author_id<>(SELECT id FROM owner) AND c.meaningful=1 AND u.created_at<=?)
      SELECT count(*) AS community FROM peers`).bind(userId,established,established),
    db.prepare("SELECT created_at,username,display_name,email FROM users WHERE id=?").bind(userId),
  ]);
  const get=(i:number)=>results[i].results?.[0]??{},r=get(0),u=get(4),count=(v:unknown)=>Number(v??0);
  const stats={accountAgeDays:Math.max(0,Math.floor((now-count(u.created_at))/86400000)),profileCompletion:u.username&&u.display_name&&u.email?100:0,
    originalPosts:count(r.original),activeDays:count(get(2).days),engagementReceived:count(get(1).received),communityInteractions:count(get(3).community)};
  const result=evaluateCreator(stats,config.thresholds,{membershipActive:member.active,restricted:!!account.restricted,
    automaticApproval:config.flags.automaticApproval&&config.flags.creatorCenter,previousStatus:account.status,wasApproved:!!account.approved_at});
  const reasons:Record<string,string>={approved:"Eligibility checks passed with a verified active membership.","membership-required":"Valid Blue Badge membership is required to hold Approved Creator status.",
    restricted:"Account standing prevents creator approval.",eligible:"Activity requirements passed. Automatic approval is currently paused.",emerging:"Progress toward the published activity requirements.",rising:"Build original content and genuine community participation."};
  await db.batch([
    db.prepare(`INSERT INTO creator_program_history(id,user_id,status,reason,created_at)
      SELECT ?,?,?,?,? FROM creator_program_accounts WHERE user_id=? AND status<>?`)
      .bind(crypto.randomUUID(),userId,result.status,reasons[result.status]??"Creator evaluation updated.",now,userId,result.status),
    db.prepare(`UPDATE creator_program_accounts SET status=?,approved_at=CASE WHEN ?='approved' THEN coalesce(approved_at,?) ELSE approved_at END WHERE user_id=?`)
      .bind(result.status,result.status,now,userId),
  ]);
  const [current,history]=await Promise.all([programAccount(db,userId),rows<{status:string;reason:string;created_at:number}>(db,
    "SELECT status,reason,created_at FROM creator_program_history WHERE user_id=? ORDER BY created_at DESC LIMIT 30",userId)]);
  return {...result,contentBreakdown:{text:count(r.texts),photos:count(r.photos),videos:count(r.videos),stories:count(r.stories),communityPosts:count(r.communityPosts)},
    approvedAt:current.approved_at,membershipRequired:!hasPermanentBlueBadge(userId),stats,membership:{active:member.active,store:member.store,expiresAt:member.expiresAt},
    history:history.map(h=>({status:h.status,reason:h.reason,at:h.created_at})),milestones:config.flags.milestones?[
      {id:"first-original",title:"First qualifying original post",reached:stats.originalPosts>=1},{id:"five-original",title:"Five original posts",reached:stats.originalPosts>=5},
      {id:"consistent",title:"Ten active days",reached:stats.activeDays>=10},{id:"eligible",title:"Creator activity requirements achieved",reached:result.eligible},
    ]:[],creatorPayoutsEnabled:false,isAdmin:!!account.is_admin};
}
export async function eligibleAnnouncements(db:Database,userId:string){
  const [config,account,member]=await Promise.all([creatorConfig(db),programAccount(db,userId),membership(db,userId)]);
  const now=Date.now(),inactive=account.last_seen_at?Math.floor((now-account.last_seen_at)/86400000):0;
  const returning=config.promotions.returningEnabled&&inactive>=config.promotions.returningInactiveDays?now+config.promotions.returningOfferDays*86400000:account.returning_offer_until;
  await db.prepare("UPDATE creator_program_accounts SET last_seen_at=?,returning_offer_until=? WHERE user_id=?").bind(now,returning,userId).run();
  if(!config.flags.announcements)return [];
  const dismissals=await rows<{campaign_id:string;choice:string;dismiss_until:number|null}>(db,"SELECT campaign_id,choice,dismiss_until FROM announcement_dismissals WHERE user_id=?",userId);
  const u=await db.prepare("SELECT created_at FROM users WHERE id=?").bind(userId).first<{created_at:number}>();
  const preferences=object(account.preferences);let promotions=0;
  return [...config.campaigns].sort((a,b)=>Number(b.category==="returning")-Number(a.category==="returning")).filter(c=>{
    if(!c.enabled||c.startAt!==null&&c.startAt>now||c.endAt!==null&&c.endAt<=now)return false;
    if(c.primaryRoute==="creator-center"&&!config.flags.creatorCenter||c.primaryRoute==="blue-badge"&&!config.flags.blueBadge)return false;
    if(c.optional&&dismissals.some(d=>d.campaign_id===c.id&&(d.choice==="never"||Number(d.dismiss_until)>now)))return false;
    if(c.optional&&(c.category==="creator"&&!preferences.creators||c.category==="community"&&!preferences.communities||["welcome","feature"].includes(c.category)&&!preferences.features))return false;
    if(c.id==="creator-approved"&&account.status!=="approved"||c.id==="creator-membership-needed"&&account.status!=="membership-required"||c.id==="creator-journey"&&account.status==="approved")return false;
    if(c.category==="welcome"&&now-Number(u?.created_at)>604800000)return false;
    const promotional=["membership","returning"].includes(c.category);
    if(promotional&&(!config.flags.promotions||!preferences.promotions||member.active))return false;
    if(c.inactiveDays>inactive&&!(c.category==="returning"&&returning&&returning>now))return false;
    return !promotional||++promotions<=1;
  });
}
