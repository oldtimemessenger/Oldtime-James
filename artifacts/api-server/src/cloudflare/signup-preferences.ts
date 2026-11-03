import { z } from "zod/v4";
import { ApiError, type Database } from "./runtime";

export const SIGNUP_INTEREST_IDS = ["fitness","running","basketball","yoga","college","nursing","cybersecurity","study-groups","gaming","cars","music","photography","fashion","food","tech","travel","art","pets","beauty"] as const;
const preferences=z.object({
  interests:z.array(z.string().transform(value=>value.normalize("NFKC").trim().replace(/\s+/g," "))
    .pipe(z.string().min(1).max(40).refine(value=>!/[\u0000-\u001f\u007f<>]/u.test(value))))
    .min(3).max(24).refine(values=>new Set(values.map(value=>value.toLowerCase())).size>=3),
  // A default-selected UI checkbox must still send an explicit affirmative.
  followOldtime:z.boolean().optional().default(false),
});
export function signupPreferences(input:unknown){
  const result=preferences.safeParse(input);
  if(!result.success)throw new ApiError(400,"Choose at least 3 different interests to create your account.");
  const interests=[...new Map(result.data.interests.map(value=>[value.toLowerCase(),value])).values()];
  return {...result.data,interests};
}
export function initialSignupState(birthday:string,interests:string[]){
  // Feed interests are private preferences, not an automatic public-profile edit.
  return {profile:{birthday},interestPreferences:{enabled:true,selected:interests}};
}
export async function officialSignupFollow(db:Database,userId:string,requested:boolean,now:number){
  if(!requested)return null;
  const official=await db.prepare("SELECT id FROM users WHERE username='oldtime' AND is_virtual=0 LIMIT 1").first<{id:string}>();
  if(!official)throw new ApiError(503,"@oldtime is unavailable right now. Turn off the optional follow to continue signing up.");
  if(official.id===userId)return null;
  return db.prepare("INSERT OR IGNORE INTO user_follows(follower_id,followed_id,created_at) VALUES(?,?,?)").bind(userId,official.id,now);
}
