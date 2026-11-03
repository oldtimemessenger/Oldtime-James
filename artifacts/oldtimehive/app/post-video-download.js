// Lazy loaded only when a member explicitly saves a video to their device.
import {exportCreativeVideo} from "./creative-export.js";
import {mediaUrl} from "./local-media.js";

export async function downloadPostVideo({reference,audioSession,alive=()=>true,onProgress}){
  if(!reference)throw new Error("This video's media is unavailable.");
  const response=await fetch(await mediaUrl(reference));
  if(!response.ok)throw new Error("Couldn't load this video. Please try again.");
  const blob=await response.blob();
  const source=URL.createObjectURL(blob);
  const video=document.createElement("video");
  video.muted=true;video.playsInline=true;video.preload="auto";
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>done(new Error("Video loading timed out. Try again.")),20000);
      function done(error){clearTimeout(timer);video.onloadedmetadata=null;video.onerror=null;error?reject(error):resolve();}
      video.onloadedmetadata=()=>done();
      video.onerror=()=>done(new Error("This video couldn't be opened."));
      video.src=source;video.load();
    });
    if(!alive())throw new Error("Download cancelled.");
    const canvas=document.createElement("canvas");
    canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    const result=await exportCreativeVideo({canvas,video,sourceBlob:blob,duration:video.duration,background:{},audioSession,alive,onProgress,watermark:true,
      render:(_time,target)=>target.getContext("2d").drawImage(video,0,0,target.width,target.height)});
    if(!alive())throw new Error("Download cancelled.");
    const url=URL.createObjectURL(result);
    const link=document.createElement("a");
    link.href=url;link.download=`oldtime-video.${result.type.includes("mp4")?"mp4":"webm"}`;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }finally{
    video.pause();video.removeAttribute("src");video.load();URL.revokeObjectURL(source);
  }
}
