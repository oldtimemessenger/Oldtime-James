import { api } from "./store.js";
import { createLayer, setProjectAspect, clamp } from "./creative-project.js";
import { commentSource, resolveCommentSource } from "./creative-content.js";

export function bindCreativeTools({ root, q, project, layer, history, inline, add, changed, seek, setSelected }) {
  const values = { "font-size": ["fontSize",64], "background-opacity": ["backgroundOpacity",1], "letter-spacing": ["letterSpacing",0],
    "line-spacing": ["lineSpacing",1.35], case: ["caseStyle","none"], bubble: ["bubble","rounded"], animation: ["animation","none"] };
  const checks = { bold: ["bold",true], italic: ["italic",false], shadow: ["shadow",false], outline: ["outline",false] };
  for (const [name,[property]] of Object.entries(values)) {
    q(name).onfocus = () => history.record();
    q(name).oninput = () => {
      const item=layer(); if(!item||item.locked)return;
      item[property]=["case","bubble","animation"].includes(name)?q(name).value:Number(q(name).value);
      changed(false); inline.sync();
    };
  }
  q("text-width").onfocus = () => history.record();
  q("text-width").oninput = () => {
    const item = layer(); if (!item || item.kind !== "text" || item.locked) return;
    item.width = clamp(Number(q("text-width").value), .08, 1) * project.width;
    changed(false); inline.sync();
  };
  for (const [name,[property]] of Object.entries(checks)) q(name).onchange=()=>{
    const item=layer(); if(!item||item.locked)return; history.record(); item[property]=q(name).checked; changed(false); inline.sync();
  };
  const restore = method => { inline.finish(); if(history[method]()) { setSelected(null); seek(Math.min(project.duration,Number(q("scrub").value))); changed(); } };
  q("undo").onclick=()=>restore("undo"); q("redo").onclick=()=>restore("redo");
  for (const [id,section] of [["source-toggle",".ce-source"],["style-toggle","#ce-inspector"],["share-toggle",".ce-share"]]) {
    q(id).onclick=()=>{
      const target=root.querySelector(section), expanded=q(id).getAttribute("aria-expanded")!=="true";
      root.querySelector("#ce-media-panel").hidden=true;
      q("trim-handle-start").hidden=q("trim-handle-end").hidden=true;
      for(const [otherId,otherSection] of [["source-toggle",".ce-source"],["style-toggle","#ce-inspector"],["share-toggle",".ce-share"]]){
        if(otherId!==id){q(otherId).setAttribute("aria-expanded","false");root.querySelector(otherSection).classList.add("is-collapsed");}
      }
      q(id).setAttribute("aria-expanded",String(expanded)); target.classList.toggle("is-collapsed",!expanded);
    };
  }
  q("layers-toggle").onclick=()=>{
    const open=q("layers-toggle").getAttribute("aria-expanded")!=="true";
    q("layers-toggle").setAttribute("aria-expanded",String(open)); root.querySelector(".ce-panel").classList.toggle("is-layers-open",open);
  };
  q("aspect").onchange=()=>{ const ratio=q("aspect").value;inline.finish(); history.record(); setProjectAspect(project,ratio); changed(); };
  q("safe").onchange=()=>{ q("safe-guides").hidden=!q("safe").checked; };
  q("allow-outside").onchange=()=>{ history.record(); project.allowOutside=q("allow-outside").checked; changed(); };
  q("lock").onclick=()=>{ const item=layer(); if(!item)return; inline.finish(); history.record(); item.locked=!item.locked; changed(); };
  q("hide").onclick=()=>{ const item=layer(); if(!item)return; inline.finish(); history.record(); item.hidden=!item.hidden; changed(); };
  for (const name of ["overlay-start","overlay-end"]) {
    q(name).onpointerdown=()=>history.record();
    q(name).onkeydown=()=>history.record();
    q(name).oninput=()=>{
      const item=layer(); if(!item||item.locked)return;
      if(name==="overlay-start")item.startTime=clamp(q(name).value,0,item.endTime-.1);
      else item.endTime=clamp(q(name).value,item.startTime+.1,project.duration);
      seek(clamp(Number(q(name).value),item.startTime,item.endTime)); changed(false); refresh();
    };
  }
  const keyboard=event=>{
    if(event.target.matches("input,textarea,[contenteditable=true]"))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();restore(event.shiftKey?"redo":"undo");}
  };
  root.addEventListener("keydown",keyboard);
  const populateComments=()=>{
    q("comment-select").replaceChildren();
    for(const post of api.posts()){
      if(!api.canSeePost(post))continue;
      for(const comment of (post.comments||[]).flatMap(c=>[c,...c.replies||[]])){
        const source={postId:post.id,commentId:comment.id,commentAuthorId:comment.author};
        if(!resolveCommentSource(source))continue;
        const option=document.createElement("option");option.value=JSON.stringify([post.id,comment.id]);
        option.textContent=`@${api.user(comment.author)?.username||"member"}: ${(comment.body||"Photo comment").slice(0,90)}`;
        q("comment-select").append(option);
      }
    }
    q("comment-add").disabled=!q("comment-select").options.length;
  };
  q("comment-add").onclick=()=>{
    if(!q("comment-select").value)return;
    try {const [post,comment]=JSON.parse(q("comment-select").value);add(createLayer("comment",{source:commentSource(post,comment),x:.5,y:.3}));q("comments").hidden=true;}
    catch(error){q("error").textContent=error.message;}
  };
  const refresh=()=>{
    const item=layer(); q("undo").disabled=!history.past.length; q("redo").disabled=!history.future.length;
    q("aspect").value=project.aspect||"9:16";q("allow-outside").checked=!!project.allowOutside;
    q("safe-guides").hidden=!q("safe").checked;
    q("text-width").disabled=!item||item.kind!=="text"||!!item.locked;
    q("text-width").value=clamp((item?.width||760)/project.width,.08,1);
    if(!item)return;
    for(const [name,[property,fallback]] of Object.entries(values))q(name).value=item[property]??fallback;
    for(const [name,[property,fallback]] of Object.entries(checks))q(name).checked=item[property]??fallback;
    q("lock").textContent=item.locked?"Unlock":"Lock";q("hide").textContent=item.hidden?"Show":"Hide";
    for(const name of ["overlay-start","overlay-end"])q(name).max=project.duration;
    q("overlay-start").value=item.startTime;q("overlay-end").value=item.endTime;
    q("timeline-summary").textContent=`${item.startTime.toFixed(1)}s – ${item.endTime.toFixed(1)}s`;
    for(const id of ["delete","duplicate","forward","backward"])q(id).disabled=!!item.locked;
  };
  return {refresh,populateComments};
}
