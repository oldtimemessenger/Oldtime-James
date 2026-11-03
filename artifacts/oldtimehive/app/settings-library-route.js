import { renderAccountLibrary } from "./account-library.js";
import "./account-library.css";
import { mediaUrl } from "./local-media.js";
import { createAccountLibraryData } from "./account-library-data.js";

export function mountLibrary({host,mode,api,requestCloudApi,app,esc,icons,toast,back,openPost,openAudio,create}) {
  const library=createAccountLibraryData({api,request:requestCloudApi});
  const resolveMedia=async({kind,item})=>{
    if(kind==="story"){
      const result=await requestCloudApi(`/api/stories/${encodeURIComponent(item.id)}/media-url`);
      return result.url;
    }
    // Normalized cloud posts carry media[] references, mediaTypes[] and mediaPosters[].
    const media=Array.isArray(item.media)?item.media:[];
    const first=media.map(m=>typeof m==="string"?m:m?.reference||m?.url||"").find(Boolean)||"";
    const type=String((item.mediaTypes||[])[0]||media[0]?.contentType||"");
    const isVideo=type.startsWith("video/")||(item.kind==="video"&&!type.startsWith("image/"));
    const posterRef=(item.mediaPosters||[]).find(Boolean)||item.poster||item.thumbnail||"";
    if(!first&&!posterRef)return "";
    if(!isVideo)return {kind:"image",url:await mediaUrl(first||posterRef)};
    const poster=posterRef?await mediaUrl(posterRef).catch(()=>""):"";
    return {kind:"video",url:first?await mediaUrl(first):poster,poster};
  };
  const authorLabel=post=>{
    const a=post?.author;
    if(a&&typeof a==="object")return a.username||"";
    const user=a?api.user?.(a):null;
    return typeof user?.username==="string"&&user.username?user.username:"";
  };
  return renderAccountLibrary({
    app,shell:host,esc,icons,toast,library,onBack:back,onOpenPost:openPost,onOpenAudio:openAudio,resolveMedia,authorLabel,
    onRestorePost:item=>api.setOwnPostArchived(typeof item==="string"?item:item.id,false),
    async onReshareMemory({kind,item}){
      try{
        const resolved=await resolveMedia({kind,item});const media=kind==="story"?resolved:item.video||(typeof resolved==="string"?resolved:resolved?.url);
        if(!media)throw new Error("This memory doesn't have media available to share.");
        create({destination:"story",background:{kind:item.mediaType==="video"||item.kind==="video"?"video":"photo",media},caption:item.text||item.caption||""});
      }catch(error){toast(error.message||"Couldn't open this memory. Try again.");}
    },
  },{view:mode});
}
