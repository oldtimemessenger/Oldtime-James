// Shared deterministic metadata engine. It never reads media bytes or calls AI.
export const DISCOVERY_VERSION = "text-topics-1";
export const TOPICS = [
  {id:"relationship-humor",label:"Relationship humor",terms:[]},
  {id:"dating-humor",label:"Dating humor",terms:[]},
  {id:"humor",label:"Humor",terms:["humor","humour","comedy","comedian","funny","joke","jokes","laugh","laughing","laughs","lol","lmao","roast","prank","skit","parody","meme","memes"]},
  {id:"relationships",label:"Relationships",terms:["relationship","relationships","couple","couples","boyfriend","girlfriend","husband","wife","partner","situationship","breakup","break up"]},
  {id:"dating",label:"Dating",terms:["dating","date night","first date","first dates","crush","talking stage","situationship"]},
  {id:"nba",label:"Basketball",terms:["nba","wnba","basketball","lebron","curry","lakers","celtics","playoffs"]},
  {id:"food",label:"Food",terms:["food","recipe","recipes","cook","cooking","dinner","breakfast","lunch","restaurant","meal","baking","bake"]},
  {id:"travel",label:"Travel",terms:["travel","vacation","holiday","trip","road trip","airport","getaway","hotel","sightseeing"]},
  {id:"fashion",label:"Fashion",terms:["fashion","outfit","ootd","streetwear","sneakers","wardrobe","fit check"]},
  {id:"beauty",label:"Beauty",terms:["beauty","skincare","makeup","hairstyle","hair","nails"]},
  {id:"music",label:"Music",terms:["music","song","singing","singer","concert","guitar","piano","album","rap"]},
  {id:"fitness",label:"Fitness",terms:["fitness","gym","workout","weightlifting","yoga","exercise","training routine"]},
  {id:"gaming",label:"Gaming",terms:["gaming","gamer","gameplay","videogame","video game","playstation","xbox","nintendo"]},
  {id:"cars",label:"Cars",terms:["cars","car meet","supercar","supercars","automotive","lamborghini","ferrari","porsche","car modifications"]},
  {id:"tech",label:"Technology",terms:["technology","tech","coding","software","programming","cybersecurity"]},
  {id:"pets",label:"Animals & pets",terms:["animals","pets","puppy","kitten","dog","dogs","cat","cats"]},
  {id:"education",label:"Education",terms:["education","school","college","university","studying","study group","classroom"]},
  {id:"business",label:"Business",terms:["business","entrepreneur","entrepreneurship","startup","small business","marketing"]},
  {id:"art",label:"Art",terms:["painting","drawing","artwork","illustration","art gallery"]},
  {id:"photography",label:"Photography",terms:["photography","photographer","photoshoot"]},
];
const stop = new Set("a an the and or but if to of in on for with at from by as is are was were be been being i me my we our you your he she they them it its this that these those not no so very just really have has had do does did will can could would should about into out up down more most all any some what when where who how today yesterday tomorrow post posts video videos photo photos oldtime".split(" "));
const broadAliases = new Map([
  ["humour","humor"],["funny","humor"],["comedy","humor"],["memes","humor"],
  ["automotive","cars"],["car","cars"],["supercars","cars"],["basketball","nba"],
  ["workouts","fitness"],["workout","fitness"],["exercise","fitness"],
  ["cooking","food"],["recipes","food"],["animals","pets"],
  ["technology","tech"],["outfits","fashion"],
]);

export function normalizeDiscovery(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[#@]/g," ").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
}
export function discoveryText(post) {
  return [post?.text,post?.caption,post?.sound,post?.location,
    post?.place?.label,post?.place?.name,...(Array.isArray(post?.tags)?post.tags:[])].filter(Boolean).join(" ").slice(0,16000);
}
export function classifyDiscovery(post, excluded = []) {
  const text=` ${normalizeDiscovery(discoveryText(post))} `, hidden=new Set(excluded);
  const assigned=TOPICS.filter(t=>t.terms.length).flatMap(topic=>{
    const evidence=topic.terms.filter(term=>text.includes(` ${normalizeDiscovery(term)} `));
    // Distinct evidence, not term frequency: repeating hashtags cannot boost confidence.
    const score=evidence.reduce((n,term)=>n+(term.includes(" ")?1.6:1),0);
    return score ? [{id:topic.id,label:topic.label,confidence:Math.min(.96,.5+score*.13),evidence:evidence.slice(0,4)}] : [];
  });
  const ids=new Set(assigned.filter(t=>!hidden.has(t.id)).map(t=>t.id));
  if(ids.has("humor")&&ids.has("dating"))assigned.push({id:"dating-humor",label:"Dating humor",confidence:.85,evidence:["dating","humor"]});
  else if(ids.has("humor")&&ids.has("relationships"))assigned.push({id:"relationship-humor",label:"Relationship humor",confidence:.85,evidence:["relationships","humor"]});
  return assigned.filter(t=>!hidden.has(t.id)).sort((a,b)=>b.confidence-a.confidence||a.id.localeCompare(b.id)).slice(0,6);
}
export function extractDiscoveryTags(text) {
  return [...new Set([...String(text||"").matchAll(/(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{2,40})/gu)]
    .map(m=>m[1].toLowerCase()))].slice(0,20);
}
export function makeDiscoveryDocument(post, excluded = []) {
  const body=discoveryText(post), topics=classifyDiscovery(post,excluded);
  return {body,topics,tags:extractDiscoveryTags(body),
    topicText:topics.map(t=>`${t.id.replaceAll("-"," ")} ${t.label}`).join(" "),version:DISCOVERY_VERSION};
}
export function discoveryQueryTokens(query) {
  const all=normalizeDiscovery(query).split(" ").filter(t=>t.length>=2);
  const useful=all.filter(t=>!stop.has(t));
  return (useful.length?useful:all).slice(0,8);
}
export function discoveryFtsQuery(query) {
  return discoveryQueryTokens(query).map(token=>{
    const canonical=broadAliases.get(token);
    // Only generated, quoted alphanumeric tokens enter MATCH, never raw FTS syntax.
    return canonical ? `("${token}"* OR "${canonical}")` : `"${token}"*`;
  }).join(" AND ");
}
export function discoveryPhrases(text) {
  const tokens=normalizeDiscovery(text).split(" ").slice(0,160), phrases=new Set();
  for(let i=0;i<tokens.length-1;i++){
    if(stop.has(tokens[i])||tokens[i].length<3)continue;
    for(const size of [2,3]){
      const part=tokens.slice(i,i+size);
      if(part.length!==size||part.some(t=>stop.has(t)||t.length<3||/^\d+$/.test(t)))continue;
      const phrase=part.join(" ");
      if(phrase.length<=48)phrases.add(phrase);
    }
  }
  return [...phrases].slice(0,36);
}
export function emergingDiscoveryTopics(records) {
  const groups=new Map();
  for(const record of records){
    for(const phrase of discoveryPhrases(record.text)){
      const group=groups.get(phrase)||{posts:new Set(),creators:new Set()};
      group.posts.add(record.id);group.creators.add(record.authorId);groups.set(phrase,group);
    }
  }
  return [...groups].filter(([,g])=>g.posts.size>=3&&g.creators.size>=2)
    .map(([label,g])=>({label,postCount:g.posts.size,creatorCount:g.creators.size}))
    .sort((a,b)=>b.creatorCount-a.creatorCount||b.postCount-a.postCount||a.label.localeCompare(b.label))
    .filter((item,i,all)=>!all.slice(0,i).some(other=>other.label.includes(item.label)&&other.postCount===item.postCount)).slice(0,8);
}
function oneEdit(a,b) {
  if(a===b||Math.abs(a.length-b.length)>1)return false;
  if(a.length===b.length){
    const first=[...a].findIndex((char,i)=>char!==b[i]);
    if(first>=0&&a[first]===b[first+1]&&a[first+1]===b[first]&&a.slice(first+2)===b.slice(first+2))return true;
  }
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){
    if(a[i]===b[j]){i++;j++;continue;}
    if(++edits>1)return false;
    if(a.length>=b.length)i++;
    if(b.length>=a.length)j++;
  }
  return edits+(i<a.length||j<b.length?1:0)===1;
}
export function correctDiscoveryQuery(query, visibleCorpus) {
  const vocabulary=new Map();
  for(const record of visibleCorpus){
    for(const word of new Set(normalizeDiscovery(record.text).split(" ").filter(t=>t.length>=2&&!stop.has(t)).slice(0,160)))
      vocabulary.set(word,(vocabulary.get(word)||0)+1);
  }
  const words=discoveryQueryTokens(query);
  let changed=false;
  const corrected=words.map(word=>{
    if(word.length<4||vocabulary.has(word))return word;
    const choices=[...vocabulary].filter(([candidate])=>oneEdit(word,candidate)).sort((a,b)=>b[1]-a[1]);
    if(!choices.length||choices[1]?.[1]===choices[0][1])return word;
    changed=true;return choices[0][0];
  }).join(" ");
  return changed?corrected:null;
}
export function rankDiscovery(records, {query="",interests=[],now=Date.now()}={}) {
  const tokens=discoveryQueryTokens(query), explicit=new Set(interests.map(normalizeDiscovery));
  const ranked=records.map(record=>{
    const text=normalizeDiscovery(record.text), topics=record.topics||[];
    const exact=tokens.filter(token=>text.includes(token)).length;
    const interest=topics.filter(t=>explicit.has(t.id)||explicit.has(normalizeDiscovery(t.label))).length;
    const age=Math.max(0,(now-record.createdAt)/86400000);
    const engagement=Math.log1p(Math.min(1000,Math.max(0,record.likes||0)+2*Math.max(0,record.reposts||0)+Math.max(0,record.comments||0)));
    const relevance=tokens.length ? exact/tokens.length*6+(text.includes(normalizeDiscovery(query))?3:0)+Math.min(2,Math.max(0,-(record.searchRank||0))) : 0;
    return {record,score:relevance+Math.min(1,interest*.35)+1/(1+age*.12)+engagement*.08};
  }).sort((a,b)=>b.score-a.score||b.record.createdAt-a.record.createdAt||a.record.id.localeCompare(b.record.id));
  // Soft creator diversity: don't silently discard a sole creator's relevant posts.
  const counts=new Map(), result=[];
  while(ranked.length){
    let best=0,bestScore=-Infinity;
    for(let i=0;i<ranked.length;i++){
      const adjusted=ranked[i].score-(counts.get(ranked[i].record.authorId)||0)*1.25;
      if(adjusted>bestScore){bestScore=adjusted;best=i;}
    }
    const {record}=ranked.splice(best,1)[0];
    counts.set(record.authorId,(counts.get(record.authorId)||0)+1);result.push(record);
  }
  return result;
}
