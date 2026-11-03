import {clamp,setProjectDuration} from "./creative-project.js";
import {readLook,setAdjust} from "./creative-look.js";
import {initVideoEdit,editedDuration,clipDuration,splitVideoClip,updateVideoClip} from "./creative-video-edit.js";

export function bindMediaEditor({root,editor,q,project,assets,history,changed,seek,time,stop,canEdit,inline,error}) {
  let clipIndex=0,thumbKey="",thumbRequest=0,thumbVideo=null,destroyed=false;
  const source=()=>assets.get(project.background.media),isVideo=()=>project.background.kind==="video"&&project.background.media!=="live-camera";
  const edit=()=>isVideo()?initVideoEdit(project.background,source()?.creativeDuration||source()?.duration||project.duration):null;
  const closeProperties=()=>{
    for(const [id,selector] of [["source-toggle",".ce-source"],["style-toggle","#ce-inspector"],["share-toggle",".ce-share"]]){q(id).setAttribute("aria-expanded","false");root.querySelector(selector).classList.add("is-collapsed");}
    q("stickers").hidden=true;q("comments").hidden=true;q("layers-toggle").setAttribute("aria-expanded","false");root.querySelector(".ce-panel").classList.remove("is-layers-open");
  };
  const closePanel=()=>{q("media-panel").hidden=true;q("trim-handle-start").hidden=q("trim-handle-end").hidden=true;root.querySelectorAll("[data-ce-media-tool]").forEach(el=>{el.classList.remove("on");el.setAttribute("aria-pressed","false");});};
  const refresh=()=>{
    if(destroyed)return;
    const model=edit(),clip=model?.clips[clipIndex]||model?.clips[0];
    if(model&&clipIndex>=model.clips.length)clipIndex=0;
    root.querySelector(".ce-video-context").hidden=!model;
    root.querySelectorAll("[data-ce-media-tool]").forEach(button=>{
      button.disabled=!canEdit()||(["trim","speed"].includes(button.dataset.ceMediaTool)&&!model)||button.dataset.ceMediaTool==="color"&&!source();
    });
    const adjust=root.querySelector('[data-ce-rail="adjust"]');
    if(adjust)adjust.disabled=project.background.kind==="color"||!project.background.media;
    q("split").disabled=!model||!canEdit();q("clip-delete").disabled=!model||!canEdit();
    q("clip-prev").disabled=!model||clipIndex===0;q("clip-next").disabled=!model||clipIndex===model.clips.length-1;
    if(clip){
      for(const id of ["trim-start","trim-end"]){q(id).max=model.sourceDuration;q(id).min=0;}
      q("trim-start").value=clip.in.toFixed(2);q("trim-end").value=clip.out.toFixed(2);q("speed").value=clip.speed;
      q("speed-value").value=`${clip.speed.toFixed(2)}×`;
    }
    for(const [name,property] of [["start","in"],["end","out"]]){
      const handle=q(`trim-handle-${name}`);handle.hidden=!clip||q("media-panel").hidden||root.querySelector('[data-ce-media-panel="trim"]').hidden;
      if(clip)handle.style.left=`${clamp(clip[property]/model.sourceDuration*100,3,97)}%`;
    }
    for(const name of ["brightness","contrast","saturation"]){q(name).value=100+readLook(project.background).adjust[name];q(`${name}-value`).value=`${q(name).value}%`;}
    const list=q("clip-list"),key=JSON.stringify(model?.clips||[]);
    if(list.dataset.clips!==key){
      list.dataset.clips=key;list.replaceChildren();
      (model?.clips||[]).forEach((item,index)=>{
        const button=document.createElement("button");button.type="button";button.textContent=`Clip ${index+1} · ${clipDuration(item).toFixed(1)}s`;button.dataset.clipIndex=index;
        button.onclick=()=>{clipIndex=index;seek(model.clips.slice(0,index).reduce((n,c)=>n+clipDuration(c),0));refresh();};
        list.append(button);
      });
    }
    list.querySelectorAll("button").forEach(button=>button.setAttribute("aria-pressed",String(Number(button.dataset.clipIndex)===clipIndex)));
    void thumbnails();
  };
  const thumbnails=async()=>{
    const key=project.background.media;if(!isVideo()||key===thumbKey||!source()?.videoWidth)return;
    thumbKey=key;const request=++thumbRequest;q("filmstrip").replaceChildren();
    thumbVideo?.pause();thumbVideo?.remove();
    const video=document.createElement("video");thumbVideo=video;video.muted=true;video.playsInline=true;video.crossOrigin="anonymous";video.src=source().src;
    video.style.cssText="position:absolute;width:1px;height:1px;opacity:.01;pointer-events:none";root.append(video);
    try{
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Thumbnail timeout")),8000);video.onloadeddata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject();};video.load();});
      const duration=edit().sourceDuration,canvas=document.createElement("canvas");canvas.width=48;canvas.height=64;
      for(let i=0;i<8;i++){
        if(destroyed||request!==thumbRequest)return;
        await new Promise(resolve=>{const timer=setTimeout(resolve,500);video.onseeked=()=>{clearTimeout(timer);resolve();};video.currentTime=Math.max(.01,duration*(i+.5)/8);});
        canvas.getContext("2d").drawImage(video,0,0,48,64);const image=document.createElement("img");image.src=canvas.toDataURL("image/jpeg",.55);image.alt="";q("filmstrip").append(image);
      }
    }catch{/* Scrubbing and editing remain usable when a browser cannot generate thumbnails. */}
    finally{video.pause();video.removeAttribute("src");video.load();video.remove();}
  };
  const updateDuration=()=>{setProjectDuration(project,editedDuration(edit()));seek(Math.min(time(),project.duration));changed();refresh();};
  const applyClip=changes=>{if(!canEdit())return;try{history.record();updateVideoClip(edit(),clipIndex,changes);updateDuration();error("");}catch(failure){error(failure);refresh();}};
  for(const [name,property] of [["start","in"],["end","out"]]){
    const handle=q(`trim-handle-${name}`);let drag;
    handle.onpointerdown=e=>{
      const model=edit();if(!model||!canEdit())return;e.preventDefault();history.record();stop();
      drag={id:e.pointerId,x:e.clientX,value:model.clips[clipIndex][property],width:handle.parentElement.clientWidth};handle.setPointerCapture(e.pointerId);
    };
    handle.onpointermove=e=>{
      if(!drag||e.pointerId!==drag.id)return;
      const model=edit(),clip=model.clips[clipIndex],raw=drag.value+(e.clientX-drag.x)/drag.width*model.sourceDuration;
      const value=property==="in"?clamp(raw,0,clip.out-.1):clamp(raw,clip.in+.1,model.sourceDuration);
      try{
        updateVideoClip(model,clipIndex,{[property]:value});setProjectDuration(project,editedDuration(model));
        const offset=model.clips.slice(0,clipIndex).reduce((n,c)=>n+clipDuration(c),0);
        seek(property==="in"?offset:offset+clipDuration(clip)-.02);changed();refresh();
      }catch(failure){error(failure);}
    };
    handle.onpointerup=handle.onpointercancel=()=>drag=null;
  }
  for(const [name,property] of [["trim-start","in"],["trim-end","out"]])q(name).onchange=()=>applyClip({[property]:Number(q(name).value)});
  q("speed").onpointerdown=()=>history.record();q("speed").onkeydown=()=>history.record();
  q("speed").oninput=()=>{if(!canEdit())return;try{updateVideoClip(edit(),clipIndex,{speed:Number(q("speed").value)});updateDuration();error("");}catch(failure){error(failure);refresh();}};
  for(const name of ["brightness","contrast","saturation"]){
    q(name).onpointerdown=()=>history.record();q(name).onkeydown=()=>history.record();
    q(name).oninput=()=>{if(!canEdit())return;setAdjust(project.background,name,Number(q(name).value)-100);changed(false);refresh();};
  }
  const split=()=>{if(!canEdit()||!edit())return;try{history.record();clipIndex=splitVideoClip(edit(),time());changed();refresh();error("");}catch(failure){error(failure);}};
  q("split").onclick=split;root.querySelectorAll("[data-ce-quick-split]").forEach(button=>button.onclick=split);
  for(const [id,direction] of [["clip-prev",-1],["clip-next",1]])q(id).onclick=()=>{
    const model=edit(),next=clipIndex+direction;if(!model||next<0||next>=model.clips.length)return;
    history.record();const [item]=model.clips.splice(clipIndex,1);model.clips.splice(next,0,item);clipIndex=next;updateDuration();
  };
  q("clip-delete").onclick=()=>{
    const model=edit();if(!model||!canEdit())return;history.record();model.clips.splice(clipIndex,1);
    if(!model.clips.length){stop();project.background={kind:"color",color:project.background.color||"#17191d",media:""};setProjectDuration(project,5);seek(0);closePanel();}
    else{clipIndex=Math.min(clipIndex,model.clips.length-1);updateDuration();}
    changed();refresh();
  };
  const openTool=tool=>{
    if(tool==="more"){const open=editor.classList.toggle("is-more-open");root.querySelector('[data-ce-media-tool="more"]')?.setAttribute("aria-expanded",String(open));return;}
    if(!canEdit()&&tool!=="color")return;
    if(tool==="color"&&(project.background.kind==="color"||!project.background.media))return;
    inline.finish();stop();closeProperties();
    if(tool!=="color"&&!edit())return;
    q("media-panel").hidden=false;q("media-title").textContent={trim:"Trim / Split",speed:"Speed",color:"Color"}[tool];
    root.querySelectorAll("[data-ce-media-panel]").forEach(panel=>panel.hidden=panel.dataset.ceMediaPanel!==tool);
    root.querySelectorAll("[data-ce-media-tool]").forEach(el=>{el.classList.toggle("on",el.dataset.ceMediaTool===tool);el.setAttribute("aria-pressed",String(el.dataset.ceMediaTool===tool));});
    refresh();
  };
  root.querySelectorAll("[data-ce-media-tool]").forEach(button=>button.onclick=()=>openTool(button.dataset.ceMediaTool));
  q("media-close").onclick=closePanel;
  return {refresh,open:openTool,dispose(){destroyed=true;++thumbRequest;thumbVideo?.pause();thumbVideo?.remove();}};
}
