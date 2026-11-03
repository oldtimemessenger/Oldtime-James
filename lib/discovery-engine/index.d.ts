export interface DiscoveryTopic { id:string; label:string; confidence:number; evidence?:string[] }
export interface DiscoveryInput { text?:string; caption?:string; sound?:string; location?:string; place?:{label?:string;name?:string}|null; tags?:string[] }
export interface DiscoveryRecord { id:string; authorId:string; text:string; createdAt:number; topics?:DiscoveryTopic[]; likes?:number; reposts?:number; comments?:number; searchRank?:number }
export const DISCOVERY_VERSION:string;
export const TOPICS:{id:string;label:string;terms:string[]}[];
export function normalizeDiscovery(value:unknown):string;
export function discoveryText(post:DiscoveryInput):string;
export function classifyDiscovery(post:DiscoveryInput,excluded?:string[]):DiscoveryTopic[];
export function extractDiscoveryTags(text:string):string[];
export function makeDiscoveryDocument(post:DiscoveryInput,excluded?:string[]):{body:string;topics:DiscoveryTopic[];tags:string[];topicText:string;version:string};
export function discoveryQueryTokens(query:string):string[];
export function discoveryFtsQuery(query:string):string;
export function discoveryPhrases(text:string):string[];
export function emergingDiscoveryTopics(records:{id:string;authorId:string;text:string}[]):{label:string;postCount:number;creatorCount:number}[];
export function correctDiscoveryQuery(query:string,visibleCorpus:{text:string}[]):string|null;
export function rankDiscovery<T extends DiscoveryRecord>(records:T[],options?:{query?:string;interests?:string[];now?:number}):T[];
