export const CAPTURE_MODES=["photo","video"];
export const MAX_CAPTURE_SECONDS=60;
export function captureRecordingState(elapsedMs){
  const seconds=Math.min(MAX_CAPTURE_SECONDS,Math.max(0,(Number(elapsedMs)||0)/1000));
  const format=value=>`${String(Math.floor(value/60)).padStart(2,"0")}:${String(Math.floor(value%60)).padStart(2,"0")}`;
  return {label:`${format(seconds)} / ${format(MAX_CAPTURE_SECONDS)}`,progress:`${seconds/MAX_CAPTURE_SECONDS*100}%`};
}
export function captureChoice(mode){
  if(!CAPTURE_MODES.includes(mode))throw new Error("Unknown capture mode.");
  return {capture:mode};
}
export function bindCaptureModes({editor,q,changed,canEdit,alive=()=>true,initialMode="photo"}){
  const picker=q("capture-picker");
  let mode=CAPTURE_MODES.includes(initialMode)?initialMode:"photo",timer,wasVisible=false;
  const center=()=>{
    const button=picker.querySelector(`[data-ce-capture-mode="${mode}"]`);
    if(button)picker.scrollTo({left:button.offsetLeft-(picker.clientWidth-button.offsetWidth)/2,behavior:"auto"});
  };
  const refresh=()=>{
    const visible=(editor.classList.contains("is-basic")||editor.classList.contains("is-create-v2"))&&editor.classList.contains("is-camera-open");
    picker.hidden=!visible;
    if(visible&&!wasVisible)requestAnimationFrame(center);wasVisible=visible;
    editor.dataset.captureMode=mode;
    picker.querySelectorAll("button").forEach(button=>{
      button.setAttribute("aria-selected",String(button.dataset.ceCaptureMode===mode));
      button.disabled=!canEdit();
    });
  };
  const select=value=>{
    if(!canEdit()||!CAPTURE_MODES.includes(value)){center();return;}
    mode=value;
    q(captureChoice(mode).capture==="video"?"record":"photo").click();
    refresh();changed();center();
  };
  picker.querySelectorAll("[data-ce-capture-mode]").forEach(button=>button.onclick=()=>select(button.dataset.ceCaptureMode));
  picker.addEventListener("scroll",()=>{
    clearTimeout(timer);timer=setTimeout(()=>{
      if(!alive()||!canEdit())return;
      const middle=picker.scrollLeft+picker.clientWidth/2;
      const buttons=[...picker.querySelectorAll("[data-ce-capture-mode]")];
      if(!buttons.length)return;
      const nearest=buttons.reduce((best,button)=>Math.abs(button.offsetLeft+button.offsetWidth/2-middle)<Math.abs(best.offsetLeft+best.offsetWidth/2-middle)?button:best);
      if(nearest.dataset.ceCaptureMode!==mode)select(nearest.dataset.ceCaptureMode);
    },180);
  });
  refresh();requestAnimationFrame(center);
  return {refresh,select,mode:()=>mode};
}
