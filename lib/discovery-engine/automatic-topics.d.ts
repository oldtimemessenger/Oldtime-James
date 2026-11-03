import type { DiscoveryInput } from "./index.js";
export interface TopicCandidate {id:string;label:string;normalized:string;confidence:number;source:string;curated:boolean;sensitive:boolean}
export interface TopicPolicy {minPosts:number;minCreators:number;minConfidence:number;minUniqueContent:number;snapshotMs:number;maxTopicsPerPost:number}
export const AUTOMATIC_TOPIC_VERSION:string;
export const TOPIC_POLICY:Readonly<TopicPolicy>;
export const TOPIC_SEEDS:{id:string;label:string;normalized:string;curated:boolean}[];
export const TOPIC_SYNONYMS:string[][];
export function normalizeTopicName(value:unknown):string;
export function topicFingerprint(value:unknown):string;
export function safeTopicName(value:unknown):boolean;
export function sensitiveTopic(value:unknown):boolean;
export function automaticTopicCandidates(post:DiscoveryInput,excluded?:string[]):TopicCandidate[];
export function topicLookupKeys(text:string):string[];
export function topicQualifies(stats:{posts:number;creators:number;uniqueContent:number;confidence:number},policy?:TopicPolicy):boolean;
export function topicTrendScore(stats:{posts?:number;previous?:number;creators?:number;engagement?:number;searches?:number;ageHours?:number}):number;
