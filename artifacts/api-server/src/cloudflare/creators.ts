import {
  GetCreatorCenterResponse,GetBlueBadgeMembershipResponse,UpdateCreatorProgramConfigBody,UpdateAnnouncementPreferencesBody,
  DismissAccountAnnouncementBody,RecordAnnouncementEventBody,
} from "@workspace/api-zod";
import { hasPermanentBlueBadge } from "@workspace/api-zod/account-policy";
import { validDistribution } from "../lib/badge-readiness";
import { creatorConfig,creatorDashboard,programAccount,membership,eligibleAnnouncements } from "./creator-service";
import { creatorOriginalRequest, requireCreator } from "./creator-originals";
import { ApiError,body,json,object,rows,uuid,type Database } from "./runtime";
export const isCreatorPath=(path:string)=>path.startsWith("/creator/")||path.startsWith("/badge/")||path==="/announcements"||path.startsWith("/announcements/")||path==="/announcement-preferences";
export async function creatorRequest(request:Request,db:Database,userId:string,path:string):Promise<Response>{
  if(path.startsWith("/creator/content"))return creatorOriginalRequest(request,db,userId,path);
  const config=await creatorConfig(db);
  if(path==="/creator/center"&&request.method==="GET"||path==="/creator/evaluate"&&request.method==="POST"){
    await requireCreator(db,userId);
    if(!config.flags.creatorCenter)throw new ApiError(503,"Creator Center is currently paused.");
    return json(GetCreatorCenterResponse.parse(await creatorDashboard(db,userId)));
  }
  if(path==="/badge/membership"&&request.method==="GET"||path==="/badge/membership/refresh"&&request.method==="POST"){
    const permanent=hasPermanentBlueBadge(userId);
    if(!permanent&&!config.flags.blueBadge)throw new ApiError(503,"Blue Badge is currently paused.");
    if(path.endsWith("/refresh")&&!permanent)throw new ApiError(503,"Membership purchases and restoration are not enabled.");
    const [member,account]=await Promise.all([membership(db,userId),programAccount(db,userId)]);
    return json(GetBlueBadgeMembershipResponse.parse({...member,purchaseSupported:false,restorationSupported:false,distribution:config.distribution,
      promotionConfig:config.promotions,interested:!!account.interested,billingEnabled:false,...config.pricing,
      benefits:["A membership badge beside your profile and interactions","Creator Center guidance and resources remain available to everyone",
        "Planned early access and selected beta invitations","Planned profile customization and member support"],
      offer:{eligible:false,kind:"standard",available:false},creatorMembershipRequired:!permanent}));
  }
  if(path==="/badge/interest"&&request.method==="POST"){
    if(!config.flags.blueBadge)throw new ApiError(503,"Blue Badge is currently paused.");
    await programAccount(db,userId);
    await db.prepare("UPDATE creator_program_accounts SET interested=1 WHERE user_id=?").bind(userId).run();
    return json({interested:true});
  }
  if(path==="/creator/badges"&&request.method==="GET"){
    const ids=[...new Set((new URL(request.url).searchParams.get("userIds")??"").split(","))];
    if(!ids.length||ids.length>50||ids.some(id=>!uuid.test(id)))throw new ApiError(400,"Provide between 1 and 50 valid account IDs.");
    const badges=await Promise.all(ids.map(async id=>({userId:id,active:hasPermanentBlueBadge(id)||config.flags.blueBadge&&(await membership(db,id)).active})));
    return json({badges});
  }
  if(path==="/announcements"&&request.method==="GET"){
    const announcements=await eligibleAnnouncements(db,userId),seen=new Set((await rows<{campaign_id:string}>(db,
      "SELECT DISTINCT campaign_id FROM announcement_events WHERE user_id=? AND event='shown'",userId)).map(r=>r.campaign_id));
    return json({announcements,unreadCount:announcements.filter(a=>!seen.has(a.id)).length,optionalTipsEnabled:config.flags.announcements});
  }
  if(path==="/announcement-preferences"){
    const account=await programAccount(db,userId);
    if(request.method==="GET")return json(UpdateAnnouncementPreferencesBody.parse(object(account.preferences)));
    if(request.method==="PUT"){
      const parsed=UpdateAnnouncementPreferencesBody.strict().safeParse(await body(request));
      if(!parsed.success)throw new ApiError(400,"All four announcement preferences must be true or false.");
      await db.prepare("UPDATE creator_program_accounts SET preferences=? WHERE user_id=?").bind(JSON.stringify(parsed.data),userId).run();
      return json(parsed.data);
    }
  }
  if(path==="/announcements/reset"&&request.method==="POST"){
    await db.prepare("DELETE FROM announcement_dismissals WHERE user_id=?").bind(userId).run();return json({reset:true});
  }
  const campaignPath=/^\/announcements\/([^/]+)\/(dismiss|event)$/.exec(path);
  if(campaignPath&&request.method==="POST"){
    const campaign=config.campaigns.find(c=>c.id===decodeURIComponent(campaignPath[1]));
    if(!campaign)throw new ApiError(404,"Announcement not found.");
    if(campaignPath[2]==="dismiss"){
      const parsed=DismissAccountAnnouncementBody.strict().safeParse(await body(request));
      if(!parsed.success||!campaign.optional||["safety","service"].includes(campaign.category))throw new ApiError(400,"Essential account notices cannot be suppressed. Choose Not now or Never show for optional tips.");
      await db.prepare(`INSERT INTO announcement_dismissals(user_id,campaign_id,choice,dismiss_until) VALUES(?,?,?,?)
        ON CONFLICT(user_id,campaign_id) DO UPDATE SET choice=excluded.choice,dismiss_until=excluded.dismiss_until`)
        .bind(userId,campaign.id,parsed.data.choice,parsed.data.choice==="not-now"?Date.now()+campaign.cooldownHours*3600000:null).run();
      return json({dismissed:true});
    }
    const parsed=RecordAnnouncementEventBody.strict().safeParse(await body(request));
    if(!parsed.success||!campaign.enabled)throw new ApiError(400,"Unsupported announcement event.");
    await db.prepare(`INSERT INTO announcement_events(id,user_id,campaign_id,event,day) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING`)
      .bind(crypto.randomUUID(),userId,campaign.id,parsed.data.event,new Date().toISOString().slice(0,10)).run();
    return json({recorded:true});
  }
  if(path.startsWith("/creator/admin/")){
    if(!(await programAccount(db,userId)).is_admin)throw new ApiError(403,"Creator administrator access is required.");
    if(path==="/creator/admin/config"){
      if(request.method==="GET")return json(config);
      if(request.method==="PUT"){
        const parsed=UpdateCreatorProgramConfigBody.strict().safeParse(await body(request));
        if(!parsed.success||!validDistribution(parsed.data.distribution)||new Set(parsed.data.campaigns.map(c=>c.id)).size!==parsed.data.campaigns.length||
          parsed.data.campaigns.some(c=>c.startAt!==null&&c.endAt!==null&&c.endAt<=c.startAt||["safety","service"].includes(c.category)&&c.optional))
          throw new ApiError(400,"Check campaign IDs, dates, required notices and official app links. Billing and payouts are not supported.");
        await db.prepare(`INSERT INTO creator_program_config(key,value,updated_at) VALUES('program',?,?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(JSON.stringify(parsed.data),Date.now()).run();
        return json(parsed.data);
      }
    }
    if(path==="/creator/admin/analytics"&&request.method==="GET"){
      const now=Date.now(),stats=await db.prepare(`WITH active AS(SELECT user_id FROM blue_badge_entitlements WHERE store IN('apple','google')
        AND state IN('active','canceled','billing-issue') AND verified_at<=? AND expires_at>? AND revoked_at IS NULL)
        SELECT (SELECT count(*) FROM creator_program_accounts) AS evaluatedAccounts,
          (SELECT count(*) FROM creator_program_accounts c JOIN active a ON c.user_id=a.user_id WHERE c.status='approved' AND c.restricted=0) AS approvedCreators,
          (SELECT count(*) FROM creator_program_accounts WHERE interested=1) AS interestedAccounts,(SELECT count(*) FROM active) AS activeMemberships,
          (SELECT count(*) FROM announcement_events WHERE event='shown') AS announcementViews,(SELECT count(*) FROM announcement_events WHERE event='action') AS announcementActions`).bind(now,now).first();
      return json(stats);
    }
  }
  throw new ApiError(404,"Creator endpoint not found.");
}
