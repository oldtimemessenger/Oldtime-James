import { TOPICS, classifyDiscovery, discoveryPhrases, discoveryText, extractDiscoveryTags, normalizeDiscovery } from "./index.js";
import { createHash } from "node:crypto";

export const AUTOMATIC_TOPIC_VERSION = "topic-registry-1";
export const TOPIC_POLICY = Object.freeze({ minPosts: 3, minCreators: 2, minConfidence: .6, minUniqueContent: 3, snapshotMs: 300000, maxTopicsPerPost: 10 });
const pluralExceptions = new Set(["news","series","species","physics","business","lakers","celtics","james","tennis","status","analysis"]);
const plurals = { cookies:"cookie", movies:"movie", selfies:"selfie" };
export function normalizeTopicName(value) {
  const words = normalizeDiscovery(value).split(" ");
  const last = words.at(-1) || "";
  if (!pluralExceptions.has(last) && last.length > 4) {
    words[words.length-1] = plurals[last] || (last.endsWith("ies") ? `${last.slice(0,-3)}y` :
      last.endsWith("s") && !/(ss|us|is)$/.test(last) ? last.slice(0,-1) : last);
  }
  return words.join(" ");
}
export function topicFingerprint(value) {
  const text=normalizeDiscovery(value).replace(/\b\d+\b/g,"").replace(/\s+/g," ").trim().slice(0,4000);
  return createHash("sha256").update(text).digest("hex").slice(0,32);
}
const unsafe = /\b(?:fuck|fucking|shit|bitch|nigger|nigga|cunt|porn|pornography|suicide methods|kill yourself)\b/i;
const generic = /\b(?:great|amazing|awesome|follow|followers|fyp|foryou|please|subscribe|hello|check|look|nice|best|love|everyone|somebody)\b/;
export function safeTopicName(value) {
  const name=normalizeTopicName(value);
  return name.length>=3&&name.length<=48&&/[a-z\p{L}]/u.test(name)&&!unsafe.test(name)&&!generic.test(name)&&!/@|https?:|[<>]/i.test(String(value));
}
export function sensitiveTopic(value) {
  return /\b(?:religion|christian|christianity|muslim|islam|jewish|judaism|hindu|politics|democrat|republican|sexuality|gay|lesbian|transgender|race|ethnicity|cancer|diabetes|depression|pregnancy|mental health|disability|criminal record)\b/.test(normalizeDiscovery(value));
}
export const TOPIC_SEEDS = [
  ...TOPICS.map(({id,label})=>({id,label,normalized:normalizeTopicName(label),curated:true})),
  {id:"nba-league",label:"NBA",normalized:"nba",curated:true},
  {id:"lakers",label:"Lakers",normalized:"lakers",curated:true},
];
export const TOPIC_SYNONYMS = [
  ["basketball","nba"],["basket ball","nba"],["nba","nba-league"],["national basketball association","nba-league"],
  ["los angeles lakers","lakers"],["lakers","lakers"],["humour","humor"],["comedy","humor"],
  ["automotive","cars"],["car","cars"],["cooking","food"],["recipe","food"],["technology","tech"],
  ["workout","fitness"],["exercise","fitness"],["animal","pets"],["pet","pets"],["outfit","fashion"],
];
const catalog = new Map(TOPIC_SEEDS.map(t=>[t.normalized,t]));
const synonyms = new Map(TOPIC_SYNONYMS.map(([name,id])=>[normalizeTopicName(name),TOPIC_SEEDS.find(t=>t.id===id)]));
const ambiguous = new Set(["trip","holiday","partner","crush","hair","nails","school","business","album","playoffs"]);
function candidate(label,confidence,source) {
  const normalized=normalizeTopicName(label), known=synonyms.get(normalized)||catalog.get(normalized);
  return known ? {...known,confidence,source,sensitive:sensitiveTopic(known.label)} : {
    id:`topic-${topicFingerprint(normalized)}`,label:normalized[0].toUpperCase()+normalized.slice(1),
    normalized,confidence,source,curated:false,sensitive:sensitiveTopic(normalized),
  };
}
export function automaticTopicCandidates(post,excluded=[]) {
  const text=discoveryText(post), normalized=` ${normalizeDiscovery(text)} `, hidden=new Set(excluded), found=new Map();
  const add=t=>{if(!hidden.has(t.id)&&safeTopicName(t.label)&&(!found.has(t.id)||found.get(t.id).confidence<t.confidence))found.set(t.id,t);};
  for(const item of classifyDiscovery(post,excluded)){
    if(item.evidence?.length===1&&ambiguous.has(item.evidence[0])&&!new RegExp(`#${item.id}\\b`,"i").test(text))continue;
    const seed=TOPIC_SEEDS.find(t=>t.id===item.id);
    if(seed)add({...seed,confidence:item.confidence,source:"rule",sensitive:sensitiveTopic(seed.label)});
  }
  if(/\b(nba|wnba|lakers|celtics)\b/.test(normalized))add(candidate("NBA",.92,"rule"));
  if(/\blakers\b/.test(normalized))add(candidate("Lakers",.94,"rule"));
  for(const tag of extractDiscoveryTags(text)) {
    const original=text.match(new RegExp(`#${tag}\\b`,"i"))?.[0]?.slice(1)||tag;
    const spaced=original.replace(/([a-z])([A-Z])/g,"$1 $2").replaceAll("_"," ");
    if(safeTopicName(spaced))add(candidate(spaced,.88,"hashtag"));
  }
  // Ordinary captions work without hashtags. Isolated ambiguous nouns do not
  // create topics; repeated multi-word evidence must later meet DB thresholds.
  for(const phrase of discoveryPhrases(text).filter(p=>p.split(" ").length===2).slice(0,8)){
    if(safeTopicName(phrase))add(candidate(phrase,.66,"phrase"));
  }
  let emerging=0;
  return [...found.values()].sort((a,b)=>Number(b.curated)-Number(a.curated)||b.confidence-a.confidence||a.id.localeCompare(b.id))
    .filter(t=>t.curated||++emerging<=3).slice(0,TOPIC_POLICY.maxTopicsPerPost);
}
export function topicLookupKeys(text) {
  const words=normalizeDiscovery(text).split(" ").slice(0,160), keys=new Set();
  for(let i=0;i<words.length;i++)for(let n=1;n<=4;n++){
    const part=words.slice(i,i+n); if(part.length!==n)continue;
    const key=normalizeTopicName(part.join(" ")); if(key.length>=3&&key.length<=48)keys.add(key);
    if(keys.size>=96)return [...keys];
  }
  return [...keys];
}
export function topicQualifies(stats,policy=TOPIC_POLICY) {
  return stats.posts>=policy.minPosts&&stats.creators>=policy.minCreators&&stats.uniqueContent>=policy.minUniqueContent&&stats.confidence>=policy.minConfidence;
}
export function topicTrendScore({posts=0,previous=0,creators=0,engagement=0,searches=0,ageHours=0}) {
  const growth=Math.min(3,posts/Math.max(3,previous));
  return (Math.log1p(posts)*2+Math.log1p(creators)*2+Math.log1p(Math.min(engagement,creators*8))*.5+
    Math.log1p(Math.min(searches,creators*4+8))*.35+growth)/(1+Math.max(0,ageHours)/48);
}
