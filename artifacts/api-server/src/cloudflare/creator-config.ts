import type { CreatorProgramConfig } from "@workspace/api-zod";
import { DEFAULT_THRESHOLDS } from "../lib/creator-eligibility";
const base={optional:true,enabled:true,inactiveDays:0,startAt:null,endAt:null,cooldownHours:168} as const;
export const defaultCreatorConfig:CreatorProgramConfig={
  flags:{creatorCenter:true,automaticApproval:true,blueBadge:true,announcements:true,promotions:true,milestones:true},
  thresholds:DEFAULT_THRESHOLDS,pricing:{standardPriceCents:299,trialMonths:2,returningPriceCents:99,currency:"USD"},
  promotions:{introductoryEnabled:true,returningEnabled:true,returningInactiveDays:14,returningOfferDays:7},
  distribution:{iphoneUrl:null,androidUrl:null,openUrl:null},
  campaigns:[
    {...base,id:"welcome-old-time",title:"Make yourself at home",description:"Share your moments and find your community. Ordinary posting stays free.",category:"welcome",primaryLabel:"Explore Oldtime",primaryRoute:"updates"},
    {...base,id:"creator-journey",title:"Your creator journey",description:"See how your original posts and community participation contribute to creator eligibility.",category:"creator",primaryLabel:"Open Creator Center",primaryRoute:"creator-center"},
    {...base,id:"creator-approved",title:"Welcome to the Creator Program",description:"Your activity and active membership qualified you for Approved Creator status. Keep a valid membership to retain your status.",category:"creator",primaryLabel:"Open Creator Center",primaryRoute:"creator-center"},
    {...base,id:"creator-membership-needed",title:"Your creator membership needs attention",description:"An active, verified Blue Badge membership is required to maintain Approved Creator status.",category:"creator",primaryLabel:"Check membership",primaryRoute:"blue-badge"},
    {...base,id:"blue-badge-preview",title:"Meet the Blue Badge",description:"Learn about Oldtime membership. Apple and Google purchases are not open yet.",category:"membership",primaryLabel:"Explore Blue Badge",primaryRoute:"blue-badge"},
    {...base,id:"welcome-back",title:"Welcome back to Oldtime",description:"Catch up with your community and see what's new.",category:"returning",inactiveDays:7,primaryLabel:"See your feed",primaryRoute:"updates"},
  ],
};
