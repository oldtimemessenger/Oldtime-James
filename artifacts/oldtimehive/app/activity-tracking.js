import { api,mutate,requestCloudApi } from "./store.js";
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
let registrations=new Map(),currentAccount=null;
const SAMPLE_INTERVAL_MS=500,PROGRESS_INTERVAL_MS=15000;
const ownerId = item => api.user(item?.author)?.cloudAccountId || (item?.author===api.me()?.id?api.cloudAccountId():uuid.test(item?.author||"")?item.author:null);
function isPublicAnalyticsItem(item){
  const visibility=String(item?.visibility||item?.audience||"public").toLowerCase().replace(/_/g,"-");
  return !item?.closeFriends&&!api.user(item?.author)?.private&&["public","everyone",""].includes(visibility);
}
export function recordActivity(kind,item,source="content"){
  const owner=ownerId(item);
  if(!owner||owner===api.cloudAccountId()||!api.cloudAccountId())return;
  void requestCloudApi("/api/analytics/events",{method:"POST",body:{ownerId:owner,sourceId:item.id||null,kind,source,nonce:crypto.randomUUID()}}).catch(()=>{});
}
export function recordProfileVisit(id,source="direct"){
  const user=api.user(id),owner=user?.cloudAccountId|| (uuid.test(id||"")?id:null);
  if(!owner||id===api.me()?.id||!api.cloudAccountId())return;
  void requestCloudApi("/api/analytics/events",{method:"POST",body:{ownerId:owner,sourceId:null,kind:"profile_visit",source,nonce:crypto.randomUUID()}}).catch(()=>{});
}
export function registerOwnActivityContent(){
  const account=api.cloudAccountId(),me=api.me();
  if(!account||!me)return;
  if(account!==currentAccount){registrations=new Map();currentAccount=account;}
  const originals=[...api.db().posts,...api.db().stories].filter(p=>p.author===me.id);
  for(const item of originals){
    const isStory=api.db().stories.includes(item);
    const visibility=String(item.visibility||item.audience||"public").toLowerCase().replace(/_/g,"-");
    const isPublic=!me.private&&!item.closeFriends&&["public","everyone",""].includes(visibility);
    const signature=JSON.stringify([isPublic,item.caption||item.text,item.trim]);
    if(registrations.get(item.id)===signature)continue;
    registrations.set(item.id,signature);
    void requestCloudApi("/api/analytics/resources",{method:"POST",body:{
      sourceId:item.id,kind:isStory?"story":item.kind==="video"?"video":item.kind==="photo"||item.media?.length?"photo":"text",
      title:isPublic?(item.caption||item.text||"Untitled content").slice(0,100):"Private content",isPublic,
      durationMs:item.kind==="video"&&item.trim?Math.round(item.trim*1000):null,
      publishedAt:Math.round(item.created||Date.now()),
    }}).then(result=>{
      if(account!==api.cloudAccountId()||!result.id)return;
      mutate(db=>{const stored=[...db.posts,...db.stories].find(p=>p.id===item.id&&p.author===me.id);if(stored)stored.analyticsId=result.id;});
    }).catch(()=>{if(account===currentAccount)registrations.delete(item.id);});
  }
  for(const id of registrations.keys())if(!originals.some(p=>p.id===id)){
    registrations.delete(id);
    void requestCloudApi(`/api/analytics/resources/${encodeURIComponent(id)}`,{method:"DELETE"}).catch(()=>{});
  }
}
export function trackQualifiedView(item,element,source="content"){
  const viewer=api.me()?.id,account=api.cloudAccountId(),isStory=api.db().stories.includes(item);
  if(!item||!element||!viewer||item.author===viewer||!isPublicAnalyticsItem(item))return ()=>{};
  const video=element.querySelector("video")||(element.tagName==="VIDEO"?element:null);
  let visibleMs=0,watchedMs=0,last=performance.now(),lastVideo=video?.currentTime||0,credited=false,session=null,
    sessionRequested=false,lastSent=performance.now(),stopped=false,progressInFlight=false,pendingFinal=false,
    savedVisibleMs=-1,savedWatchedMs=-1;
  const owner=ownerId(item);
  const ensureSession=()=>{
    if(session||sessionRequested||!owner||!account||owner===account)return;
    sessionRequested=true;
    void requestCloudApi("/api/analytics/sessions",{method:"POST",body:{ownerId:owner,sourceId:item.id,nonce:crypto.randomUUID(),source}})
      .then(r=>{session=r.id||null;if(session&&pendingFinal){pendingFinal=false;submit(true);}})
      .catch(()=>{});
  };
  const submit=ended=>{
    if(!session){if(ended&&sessionRequested)pendingFinal=true;return;}
    if(account!==api.cloudAccountId())return;
    if(video&&watchedMs===0)return;
    const snapshot={visibleMs:Math.floor(visibleMs),watchedMs:Math.floor(watchedMs)};
    if(!ended&&snapshot.visibleMs<=savedVisibleMs&&snapshot.watchedMs<=savedWatchedMs)return;
    if(progressInFlight){if(ended)pendingFinal=true;return;}
    progressInFlight=true;
    void requestCloudApi(`/api/analytics/sessions/${session}`,{method:"PUT",body:{
      ...snapshot,progress:video?.duration?Math.min(1,watchedMs/(video.duration*1000)):0,ended:!!ended,
    }}).then(()=>{
      savedVisibleMs=Math.max(savedVisibleMs,snapshot.visibleMs);
      savedWatchedMs=Math.max(savedWatchedMs,snapshot.watchedMs);
    }).catch(()=>{}).finally(()=>{
      progressInFlight=false;
      if(pendingFinal){pendingFinal=false;submit(true);}
    });
  };
  const credit=()=>{
    if(credited)return;credited=true;
    const bucket=isStory?"story":Math.floor(Date.now()/1800000),key=`${viewer}:${item.id}:${bucket}`;
    // A recreated player must not repeat account-state projection work for an
    // impression that was already credited.
    if (api.db().measuredViews?.some(view => view.key === key)) return;
    mutate(db=>{
      db.measuredViews=Array.isArray(db.measuredViews)?db.measuredViews:[];
      // Never import old seeded/artificial .views counters into measured views.
      db.measuredViews=db.measuredViews.filter(v=>v.at>Date.now()-120*86400000);
      if(db.measuredViews.some(v=>v.key===key))return;
      db.measuredViews.push({key,itemId:item.id,actor:viewer,at:Date.now(),story:isStory});
      const stored=[...db.posts,...db.stories].find(p=>p.id===item.id);
      if(stored)stored.measuredViews=db.measuredViews.filter(v=>v.itemId===item.id).length;
    });
  };
  const onVisibilityChange=()=>{
    if(document.hidden)submit(false);
    last=performance.now();lastVideo=video?.currentTime||0;
  };
  document.addEventListener("visibilitychange",onVisibilityChange);
  const stop=()=>{if(stopped)return;stopped=true;clearInterval(timer);document.removeEventListener("visibilitychange",onVisibilityChange);submit(video?.ended);};
  const timer=setInterval(()=>{
    const now=performance.now(),delta=Math.min(1000,now-last);last=now;
    if(!element.isConnected||api.me()?.id!==viewer){stop();return;}
    if(document.hidden){lastVideo=video?.currentTime||0;return;}
    const rect=element.getBoundingClientRect();
    const area=Math.max(0,Math.min(rect.bottom,innerHeight)-Math.max(rect.top,0));
    const shown=!document.hidden&&rect.height>0&&area/rect.height>=.65;
    const images=[...element.querySelectorAll("img")];
    const ready=images.every(img=>img.complete&&img.naturalWidth>0);
    if(shown&&ready)visibleMs+=delta;
    if(shown&&ready&&!video&&item.kind!=="video")ensureSession();
    if(video){
      const advance=(video.currentTime-lastVideo)*1000;lastVideo=video.currentTime;
      if(shown&&!video.paused&&!video.ended&&video.readyState>=2&&advance>0&&advance<=delta+500){
        watchedMs+=Math.min(delta,advance);
        ensureSession();
      }
    }
    const videoContent=!!video||item.kind==="video";
    const threshold=videoContent?Math.min(3000,Number.isFinite(video?.duration)?video.duration*1000:3000):2000;
    if((videoContent?watchedMs:visibleMs)>=threshold)credit();
    if(now-lastSent>=PROGRESS_INTERVAL_MS){lastSent=now;submit(false);}
  },SAMPLE_INTERVAL_MS);
  video?.addEventListener("ended",()=>{
    const now=performance.now(),advance=(video.currentTime-lastVideo)*1000,delta=Math.min(1000,now-last);
    if(!document.hidden&&element.isConnected&&advance>0&&advance<=delta+500){
      watchedMs+=Math.min(delta,advance);visibleMs+=delta;lastVideo=video.currentTime;last=now;
      const threshold=Math.min(3000,video.duration*1000);
      if(watchedMs>=threshold||video.duration<=3&&watchedMs>=video.duration*950)credit();
    }
    submit(true);
  },{once:true});
  return stop;
}
