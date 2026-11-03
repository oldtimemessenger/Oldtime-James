import "./creative-editor.css";
import "./creative-overlay.css";
import "./create-studio.css";
import "./creative-studio-workspace.css";
import { bindTextBar } from "./creative-text-bar.js";
import { bindViewport, bindSheets } from "./creative-overlay.js";
import { api } from "./store.js";
import { bindMentionAutocomplete } from "./mention-autocomplete.js";
import { icon } from "./icons.js";
import { openEmojiPicker, closeEmojiPicker } from "./emoji.js";
import { renderCreativeEditor } from "./creative-editor-view.js";
import { createProject, createBackgroundForMedia, uploadedMediaFrame, createLayer, duplicateLayer, moveLayer, clamp, setProjectDuration, keepLayerInFrame, ProjectHistory, projectScenes } from "./creative-project.js";
import { mediaUrl, putLocalMedia } from "./local-media.js";
import { audioSource, audioTitle, savedAudio, canReuseAudio, loadAudioSource, loadAudioLibrary, discoverSounds, saveAudio } from "./audio-library.js";
import { CreativeAssets, drawProject, coverCreativeImage } from "./creative-renderer.js";
import { bindCreativeGestures } from "./creative-gestures.js";
import { commentSource, resolveCommentSource, validateProjectSources, validateProjectAudience, publishCreativeProject } from "./creative-content.js";
import { publishRenderedPost, originalPublicationMedia } from "./media-publication.js";
import { createVideoAudioSession } from "./video-compression.js";
import { publicFeedVideoLimitMessage } from "./public-feed-video-limits.js";
import { videoMime, canvasBlob, exportCreativeVideo, creativeAudioContextFor } from "./creative-export.js";
import { bindInlineText } from "./creative-inline-text.js";
import { bindCreativeTools } from "./creative-editor-tools.js";
import { bindCreativePages } from "./creative-pages.js";
import { bindMediaEditor } from "./creative-media-editor.js";
import { initVideoEdit, syncVideoEdit } from "./creative-video-edit.js";
import { waitForVideoFrame } from "./remix-video.js";
import { createCameraStrip } from "./creative-camera-strip.js";
import { bindToolsTheme } from "./creative-controls-palette.js";
import { naturalZoom, cameraConstraints, captureFrame, zoomFromPinch, distance } from "./creative-capture-geometry.js";
import { bindCaptureModes, captureRecordingState, MAX_CAPTURE_SECONDS } from "./creative-capture-modes.js";
import { openPlacePicker } from "./place-picker.js";
import { shouldAutoStartCamera } from "./creative-editor-startup.js";
import { projectOutputKind, matchingOriginal } from "./creative-output.js";
import { createPersonCutout } from "./remix-cutout.js";
import { adjustCutoutEdges } from "./remix-matte.js";
import { openCreativeMaskRefiner } from "./creative-mask-refiner.js";
import { setOriginalAudioMuted } from "./video-audio-policy.js";
import { bindStudioWorkspace } from "./creative-studio-workspace.js";
import { migrateLook, previewLookPixels } from "./creative-look.js";

let currentEditor = null;
export function closeCreativeEditor() { currentEditor?.(); }
export function openCreativeEditor({ postId, commentId, destination = "post", startCamera = false, mediaPicker = false, startText = false, startShare = false, background = null, caption = "", location = "", visibility, esc, icons, toast = () => {}, onClose, onPosted, onSave, saveLabel = "Save", initialProject, responseStudio = false, editorVersion = "legacy" } = {}) {
  closeCreativeEditor();
  if (!["post", "community", "story"].includes(destination)) destination = "post";
  startText = startText === true && destination === "story";
  if (startText) startCamera = false;
  const openedInCommunity = destination === "community";
  let source;
  try { source = postId && commentId ? commentSource(postId, commentId) : null; }
  catch (error) { toast(error.message); return; }
  const ownerId = api.me()?.id;
  if (!ownerId) { toast("Sign in to create a post."); return; }
  const project = createProject(source), assets = new CreativeAssets(), blobs = new Map(), edgeBaseImages = new Map(), edgePriorMedia = new WeakMap(), cutoutSourceInfo = new WeakMap();
  let publishPostIdempotencyKey = null;
  if(!source&&!initialProject&&!background?.media)project.background.color=startText ? "#ffffff" : "#000000";
  if(initialProject)Object.assign(project,structuredClone(initialProject));
  for(const scene of [project,...project.pages||[]])migrateLook(scene.background);
  project.audioTracks ||= [];
  const history = new ProjectHistory(project);
  const root = document.createElement("div"); root.innerHTML = renderCreativeEditor({ destination, hasSource: !!source, hasSaveHandler: !!onSave, responseStudio, esc, icons, editorVersion });
  document.body.appendChild(root);
  const editor = root.firstElementChild, q = name => root.querySelector("#ce-" + name), canvas = q("canvas");
  const mentionCleanup = bindMentionAutocomplete(q("caption"), { api });
  q("destination").value=destination;
  const unbindTheme=bindToolsTheme(editor);
  const mediaHost=document.createElement("div");mediaHost.setAttribute("aria-hidden","true");
  mediaHost.style.cssText="position:absolute;width:1px;height:1px;opacity:.01;pointer-events:none;overflow:hidden";
  root.append(mediaHost);assets.container=mediaHost;
  for(const [id,selector] of [["source-toggle",".ce-source"],["style-toggle","#ce-inspector"],["share-toggle",".ce-share"]]){
    q(id).setAttribute("aria-expanded","false");root.querySelector(selector).classList.add("is-collapsed");
  }
  const oldOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
  const viewport = bindViewport({ editor });
  let selectedId = project.layers.find(item => item.kind !== "sticker")?.id || null, time = 0, measurements = new Map(), raf;
  const initialCaptureMode=project.background?.kind==="video"?"video":"photo";
  let closed = false, busy = false, recording = null, live = null, facing = "user", drawing = false, preview = false, playing = false,cameraMode=initialCaptureMode,cameraOpen=false;
  let playbackStart = 0, recordingStart = 0, inline, tools, pages, mediaTools, captureModes, previousCamera = null, captureTimer = null, cameraRequest = 0;
  let shutterHoldTimer = null, ignoreNextShutterClick = false;
  const soundPreview=document.createElement("audio");soundPreview.loop=true;soundPreview.preload="auto";
  const soundVideoPreview=document.createElement("video");soundVideoPreview.loop=true;soundVideoPreview.preload="auto";soundVideoPreview.playsInline=true;soundVideoPreview.setAttribute("playsinline","");soundVideoPreview.setAttribute("aria-hidden","true");
  soundVideoPreview.style.cssText="position:fixed;left:-2px;top:-2px;width:1px;height:1px;opacity:.001;pointer-events:none;z-index:-1";
  editor.append(soundVideoPreview);
  let detailsOpen=false,closeDetails=()=>{};let sheets=null,quoteReturn=null,quoteDraft=null,quoteCaption="",closeMaskRefiner=null;
  const replaceProject=value=>{for(const key of Object.keys(project))delete project[key];Object.assign(project,structuredClone(value));};
  const layer = () => project.layers.find(item => item.id === selectedId && item.kind !== "sticker");
  const edgeTarget = () => {
    const selected = layer();
    if (selected?.subjectCutout) return selected;
    if (selected?.kind === "text") {
      const foreground = project.layers.find(item => item.subjectForTextId === selected.id && item.subjectCutout);
      if (foreground) return foreground;
    }
    return project.background.subjectCutout ? project.background : null;
  };
  const audioWarnings = [];
  const clearAudioWarnings = () => {
    audioWarnings.length = 0;
    const el = q("audio-warning");
    if (el) { el.hidden = true; el.textContent = ""; }
  };
  const warnAudio = warning => {
    audioWarnings.push(warning);
    if (closed) return;
    const el = q("audio-warning");
    if (el) { el.hidden = false; el.textContent = warning.userMessage; }
    const panel = q("details-diagnostic"), details = q("details-diagnostic-text");
    if (panel) panel.hidden = false;
    if (details) details.textContent = JSON.stringify({ warnings: audioWarnings }, null, 2);
    console.warn("[Oldtime export audio warning]", warning);
  };
  const status = value => { const el = q("details-status"); if (el) el.textContent = value || ""; };
  const error = value => {
    const diagnostic = value?.mediaDiagnostic || ((value?.name || value?.stack || value?.request || value?.status) ? {
      time: new Date().toISOString(),
      stage: value?.publicationStage || value?.mediaStage || "publish",
      errorName: value?.name || "Error",
      message: value?.message || String(value || ""),
      stack: value?.cause?.stack || value?.stack || "",
      ...(value?.cause ? {
        originalError: {
          name: value.cause.name || "Error",
          message: value.cause.message || String(value.cause),
          stack: value.cause.stack || "",
        },
      } : {}),
      request: value?.request || null,
      status: value?.status ?? null,
      responseBody: value?.responseBody || null,
      requestId: value?.requestId || null,
      ...(value?.audioDiagnostic ? {audio: value.audioDiagnostic} : {}),
      ...(audioWarnings.length ? { warnings: [...audioWarnings] } : {}),
    } : null);
    const text = `${value?.message || String(value || "")}${diagnostic ? `\nFailed during ${diagnostic.stage} (${diagnostic.errorName}).` : ""}`;
    q("error").textContent = text;
    const el = q("details-error"); if (el) el.textContent = text;
    const go = q("details-publish"); if (go && text) go.textContent = "Retry publish";
    const panel = q("details-diagnostic");
    if (panel) {
      panel.hidden = !diagnostic;
      const details = q("details-diagnostic-text");
      if (details) details.textContent = diagnostic ? JSON.stringify(diagnostic, null, 2) : "";
    }
    if (diagnostic) console.error("[Oldtime publish failure]", diagnostic);
  };
  const syncShareDestinationButtons = () => {
    const selected = q("visibility").value === "close-friends"
      ? "close-friends"
      : q("destination").value === "story" ? "story" : "feed";
    root.querySelectorAll("[data-ce-share-destination]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.ceShareDestination === selected));
    });
    root.querySelectorAll("[data-ce-feed-visibility]").forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.ceFeedVisibility === q("visibility").value)));
    q("feed-privacy").hidden=q("destination").value==="story"||q("visibility").value==="close-friends";
    const destinations = q("media-share-destinations");
    if (destinations) {
      const hasContent = !!project.background.media || project.layers.length > 0 || editor.classList.contains("is-quote");
      destinations.hidden = !!live || !hasContent || editor.classList.contains("is-create-v2") &&
        (q("destination").value === "story" || q("visibility").value === "close-friends");
    }
  };
  const render = at => {
    const size=project;
    if(canvas.width!==size.width)canvas.width=size.width;
    if(canvas.height!==size.height)canvas.height=size.height;
    editor.style.setProperty("--ce-ratio",`${size.width}/${size.height}`);
    editor.style.setProperty("--ce-ratio-num",size.width/size.height);
    editor.classList.toggle("is-typing",!!inline?.active());
    const wrap=root.querySelector(".ce-stage").parentElement,available=Math.max(80,wrap.clientHeight-root.querySelector(".ce-transport").offsetHeight-16);
    editor.style.setProperty("--ce-stage-width",`${Math.min(wrap.clientWidth-16,available*size.width/size.height)}px`);
    const lookOptions={preview:true,maxLookPixels:previewLookPixels(),bypassLook:!!workspace?.isComparing()};
    measurements = drawProject(canvas, project, assets, resolveCommentSource, at, preview || busy ? null : selectedId, lookOptions);
    if (!project.allowOutside && !drawing && !preview && !busy) {
      let moved = false;
      for (const item of project.layers) if(!item.subjectCutout)moved = keepLayerInFrame(item, measurements.get(item.id), project) || moved;
      if (moved) measurements = drawProject(canvas, project, assets, resolveCommentSource, at, selectedId, lookOptions);
    }
    inline?.sync();
  };
  let strip=null,workspace=null;
  const rememberBlob = blob => { const url = URL.createObjectURL(blob); blobs.set(url, blob); return url; };
  const activeSound=()=>project.audioTracks?.[0]||null;
  const syncOriginalAudioControl=()=>{
    const wrap=q("original-audio-wrap"),toggle=q("original-audio-toggle");
    if(!wrap||!toggle)return;
    const available=project.background.kind==="video"&&project.background.media!=="live-camera";
    wrap.hidden=!available;
    toggle.checked=available&&project.background.audioMuted===true;
  };
  const soundPreviewFor=track=>track?.sourcePostId?soundVideoPreview:soundPreview;
  const syncSoundPreviewTime=value=>{
    const preview=soundPreviewFor(activeSound());
    const duration=preview.duration;
    if(!preview.src||!Number.isFinite(duration)||duration<=0)return;
    const target=value%duration;
    if(Math.abs(preview.currentTime-target)>.35)preview.currentTime=target;
  };
  const syncSoundControls=()=>{
    const title=q("sound-title");if(!title)return;
    const track=activeSound();
    title.textContent=track?.title||"Add sound";
    q("sound-chip").setAttribute("aria-label",track?`Sound: ${track.title}`:"Add sound");
    const pill=q("sound-pill");
    if(pill){
      pill.hidden=!track;
      q("sound-pill-title").textContent=track?.title||"";
      q("sound-pill-main").setAttribute("aria-label",track?`Change sound · ${track.title}`:"Choose sound");
      const art=q("sound-pill-art"),fallback=q("sound-pill-icon");
      if(track?.avatar){art.src=track.avatar;art.hidden=false;fallback.hidden=true;}
      else{art.removeAttribute("src");art.hidden=true;fallback.hidden=false;}
    }
    q("sound-volume-wrap").hidden=!track;
    q("sound-remove").hidden=!track;
    const previewToggle=q("sound-preview-toggle");
    if(previewToggle){
      const preview=soundPreviewFor(track),isPlaying=Boolean(track&&!preview.paused);
      previewToggle.hidden=!track;
      previewToggle.setAttribute("aria-pressed",String(isPlaying));
      previewToggle.setAttribute("aria-label",isPlaying?"Pause sound preview":"Preview selected sound");
      previewToggle.innerHTML=icon(isPlaying?"pause":"play")||"Play";
    }
    if(track&&q("sound-volume")&&document.activeElement!==q("sound-volume"))q("sound-volume").value=String(track.volume??.8);
    const preview=soundPreviewFor(track),otherPreview=preview===soundPreview?soundVideoPreview:soundPreview;
    otherPreview.pause();otherPreview.removeAttribute("src");delete otherPreview.dataset.creativeMedia;otherPreview.load();
    preview.volume=Math.max(0,Math.min(1,Number(track?.volume??.8)));
    if(!track){
      preview.pause();preview.removeAttribute("src");delete preview.dataset.creativeMedia;preview.load();
    }else if(preview.dataset.creativeMedia!==track.media){
      preview.pause();preview.removeAttribute("src");preview.dataset.creativeMedia=track.media;
      void mediaUrl(track.media).then(url=>{
        if(closed||preview.dataset.creativeMedia!==track.media)return;
        preview.src=url;preview.load();
        if(playing){
          stopPlayback();
          if(q("sound-error"))q("sound-error").textContent="The sound loaded after playback started. Tap Play again to hear it.";
          refreshControls();
        }
      }).catch(failure=>{
        if(!closed&&preview.dataset.creativeMedia===track.media&&q("sound-error"))q("sound-error").textContent=failure.message||"Couldn’t load that sound.";
      });
    }
    if(track&&!playing)syncSoundPreviewTime(time);
  };
  // Sounds are manual-only: no automatic trending suggestion is fetched or shown when media opens.
  let soundReuseChoiceTouched=false;
  const syncSoundRights=()=>{
    const panel=q("sound-rights");if(!panel)return;
    const track=activeSound(),linked=Boolean(track?.sourcePostId||track?.sourceSoundId);
    const isVideo=projectOutputKind(project,assets)==="video";
    const isFeed=q("destination").value!=="story";
    panel.hidden=!isVideo||!isFeed||linked;
    const checkbox=q("sound-rights-confirm");
    const accountAllowsReuse=api.cloudAccountState()?.soundReuseEnabled!==false;
    const postAllowsReuse=accountAllowsReuse&&api.me()?.private!==true&&q("visibility")?.value==="public";
    if(checkbox){
      checkbox.disabled=!postAllowsReuse;
      if(!postAllowsReuse)checkbox.checked=false;
      else if(!soundReuseChoiceTouched)checkbox.checked=true;
    }
    const note=q("sound-rights-note");
    if(linked){
      if(checkbox)checkbox.checked=false;
      note.textContent="This sound stays attributed to its original creator and can only be reused while their permission is active.";
    }else if(!postAllowsReuse){
      note.textContent="Sound reuse is off in Settings or this post is not public.";
    }else{
      note.textContent="Eligible public videos may be suggested with the creator credited. Saved sounds remain private to you.";
    }
  };
  const exportAudioTracks=async scene=>Promise.all((scene.audioTracks||[]).map(async track=>({...track,media:await mediaUrl(track.media)})));
  const backgroundVideo = () => assets.get(project.background.media)?.tagName === "VIDEO" ? assets.get(project.background.media) : null;
  const stopLive = () => {
    for (const track of live?.getTracks() || []) track.stop();
    const preview=assets.get("live-camera");
    if(preview?.classList?.contains("cs-live-camera")){
      preview.pause();preview.srcObject=null;preview.remove();assets.items.delete("live-camera");
    }
    live = null; q("record").disabled = true; q("photo").disabled = true; q("flip").hidden = true;
    clearInterval(captureTimer); captureTimer=null;
  };
  const stopPlayback = () => { playing = false;if(!live)backgroundVideo()?.pause();soundPreview.pause();soundVideoPreview.pause();q("play").innerHTML = icon("play") || "Play"; };
  const refreshControls = () => {
    root.inert=busy;editor.setAttribute("aria-busy",String(busy));
    editor.classList.toggle("has-live-camera",!!live);
    editor.classList.toggle("is-camera-open",cameraOpen);editor.classList.toggle("is-camera-video",cameraMode==="video");editor.classList.toggle("is-capturing",!!recording);
    editor.classList.toggle("is-video-media",project.background.kind==="video"&&project.background.media!=="live-camera");
    q("photo").setAttribute("aria-pressed",String(cameraMode==="photo"));q("record").setAttribute("aria-pressed",String(cameraMode==="video"));
    q("shutter").setAttribute("aria-label",recording?"Stop recording video":cameraMode==="photo"?"Take photo":"Start recording video");
    const indicator=q("recording-indicator");
    if(indicator)indicator.textContent=recording?captureRecordingState(performance.now()-recordingStart).label:"";
    if(!recording)q("shutter").style.setProperty("--cs-recording-progress","0%");
    if(q("camera-reset"))q("camera-reset").disabled=busy||!!recording||!!captureTimer;
    q("flip").disabled=busy||!!recording||!!captureTimer;
    const track=live?.getVideoTracks()[0],caps=track?.readyState==="live"?track.getCapabilities?.()||{}:{};
    q("flash").disabled=!caps.torch;q("zoom").disabled=!caps.zoom;
    q("publish").disabled = busy || !!live || !project.layers.length && !project.background.media;
    if(editor.classList.contains("is-quote")&&!project.layers.some(item=>item.kind==="text"&&item.text.trim()))q("publish").disabled=true;
    q("export").disabled = q("publish").disabled;
    const goPublish=q("details-publish");if(goPublish){goPublish.disabled=busy;if(busy)goPublish.textContent="Publishing…";}
    const nextAction=q("next-action");if(nextAction)nextAction.disabled=q("publish").disabled;
    const cutoutSource=layer()?.kind==="image"?assets.get(layer().media):project.background.kind==="photo"?assets.get(project.background.media):null;
    const cutoutButton=root.querySelector('[data-ce-rail="remove-bg"]');if(cutoutButton)cutoutButton.disabled=busy||!!live||!cutoutSource;
    q("refine-mask").disabled=busy||!!live||!edgeTarget()?.subjectCutout;
    const trimButton=root.querySelector('[data-ce-rail="trim"]');if(trimButton)trimButton.disabled=busy||!!live||project.background.kind!=="video";
    if(q("save-exit")){
      q("save-exit").disabled=busy||!!recording||!!captureTimer;
      q("save-exit").title=recording?"Stop recording before saving.":"Return to the original composer.";
      q("save-exit").setAttribute("aria-describedby","ce-save-hint");
    }
    q("upload").disabled = busy || !!recording;
    q("camera").disabled = busy || !!recording;
    q("flip").disabled = busy || !!recording;
    q("record").disabled = q("photo").disabled = busy || !!recording || !!captureTimer;
    q("shutter").disabled = track?.readyState!=="live" || busy || !!captureTimer;
    q("pages").disabled=busy||!!live;q("remove-page").disabled=busy||!!live;
    q("undo").disabled = !!live || busy || !history.past.length;
    q("redo").disabled = !!live || busy || !history.future.length;
    q("preview").disabled = busy || !!recording;
    q("scrub").max = project.duration;
    q("time").textContent = `${time.toFixed(1)} / ${project.duration.toFixed(1)}s`;
    q("scrub").value = time;
    q("draw").setAttribute("aria-pressed", String(drawing));
    q("draw-controls").hidden = !drawing;
    mediaTools?.refresh();
    captureModes?.refresh();
    syncShareDestinationButtons();
    syncSoundControls();
    syncOriginalAudioControl();
    syncSoundRights();
    if((playing||recording||live)&&!raf)raf=requestAnimationFrame(tick);
  };
  const updateInspector = () => {
    const item = layer(), edgeItem = edgeTarget();
    const subjectCutout = item?.kind === "text" && project.layers.find(value => value.subjectForTextId === item.id && value.subjectCutout);
    const behindActive = !!item?.behindSubject && !!subjectCutout;
    const behindAvailable = item?.kind === "text" && project.background.kind === "photo" && !!project.background.media;
    q("inspector").hidden = !item && !edgeItem;
    q("subject-controls").hidden = !edgeItem && !behindAvailable;
    q("behind-subject").hidden = !behindAvailable;
    q("behind-subject").setAttribute("aria-pressed", String(behindActive));
    q("behind-subject").textContent = behindActive ? "Bring text in front" : "Text behind subject";
    q("edge-controls").hidden = !edgeItem;
    q("refine-mask").hidden = !edgeItem?.subjectCutout;
    if (edgeItem) {
      q("edge-shift").value = String(edgeItem.edgeShift || 0);
      q("edge-feather").value = String(edgeItem.edgeFeather || 0);
    }
    tools?.refresh();
    if (!item) return;
    q("text-fields").hidden = item.kind !== "text";
    for (const [name, value] of Object.entries({ text: item.text || "", font: item.font || "Manrope", align: item.align || "center",
      color: item.color || "#ffffff", background: item.background || "#17191d", opacity: item.opacity, scale: item.scale,
      rotation: item.rotation, start: item.startTime, end: item.endTime })) q(name).value = value;
    q("background-on").checked = !!item.backgroundOn;
    q("start").max = project.duration; q("end").max = project.duration;
  };
  const refreshLayers = () => {
    q("layer-list").replaceChildren();
    [...project.layers].filter(item => item.kind !== "sticker").reverse().forEach((item, index) => {
      const button = document.createElement("button"); button.type = "button";
      button.textContent = (item.locked ? "Locked · " : item.hidden ? "Hidden · " : "") + (item.kind === "comment" ? "Original comment" : item.kind === "text" ? item.text.slice(0, 24) || "Text" : item.kind === "image" ? item.subjectCutout?"Subject cutout":"Image / GIF" : item.kind === "drawing" ? "Drawing" : "Emoji");
      button.dataset.layerId = item.id; button.setAttribute("aria-selected", String(selectedId === item.id));
      button.onclick = () => { inline?.finish(); selectedId = item.id; drawing = false; if (time < item.startTime || time > item.endTime) seek(item.startTime); changed(); };
      button.ondblclick = () => inline.edit(item);
      q("layer-list").appendChild(button);
    });
  };
  const changed = (full = true) => {
    if (closed) return;
    if (full) { refreshLayers(); updateInspector(); pages?.refresh(); }
    refreshControls(); render(time); workspace?.refresh();
  };
  const select = id => { if (id!==selectedId) inline?.finish(); selectedId = id; changed(); };
  const remove = () => { if(layer()?.locked)return; history.record(); inline?.finish(); project.layers = project.layers.filter(item => item.id !== selectedId); selectedId = null; changed(); };
  const seek = value => {
    stopPlayback(); time = clamp(value, 0, project.duration);
    const video = backgroundVideo(); if(video&&!live){if(project.background.videoEdit)syncVideoEdit(video,project.background,time);else video.currentTime=Math.min(time,Math.max(0,video.duration-.01));}
    syncSoundPreviewTime(time);
    refreshControls(); render(time); workspace?.tick(time);
  };
  const options = () => {
    q("inspector").classList.remove("is-collapsed");q("style-toggle").setAttribute("aria-expanded","true");changed();
    q("duplicate").scrollIntoView({block:"nearest",behavior:"smooth"});q("duplicate").focus({preventScroll:true});
  };
  const unbind = bindCreativeGestures(canvas, { project, measurements: () => measurements, time: () => time, selected: () => selectedId,
    select, changed, trash: q("trash"), remove, options, drawing: () => drawing ? { color: q("draw-color").value, width: Number(q("draw-width").value), opacity:Number(q("draw-opacity").value), mode:q("brush").value } : null,
    checkpoint:()=>history.record(), editText:item=>inline.edit(item),
    background:()=>{
      const media=project.background.media,item=media&&media!=="live-camera"&&!live&&!preview&&!busy&&!recording?assets.get(media):null;
      const w=item?.videoWidth||item?.naturalWidth||item?.width,h=item?.videoHeight||item?.naturalHeight||item?.height;
      return w&&h?{rect:{x:0,y:0,width:1,height:1,...project.background.crop},asset:{w,h}}:null;
    },
    setCrop:rect=>{project.background.crop={...rect};},
    preview: () => preview || busy || !!recording || !!captureTimer });
  const close = (posted = false) => {
    if (closed) return;
    closed = true; playing = false; soundPreview.pause();soundVideoPreview.pause();soundPreview.removeAttribute("src");soundVideoPreview.removeAttribute("src");soundPreview.load();soundVideoPreview.load();soundVideoPreview.remove();cancelAnimationFrame(raf); mentionCleanup(); unbind();textBar?.dispose();unbindTheme();mediaTools?.dispose();workspace?.dispose();
    closeMaskRefiner?.();closeMaskRefiner=null;
    if (recording?.state !== "inactive") recording?.stop();
    stopLive(); closeEmojiPicker(); assets.dispose();
    strip?.dispose();
    for (const url of blobs.keys()) URL.revokeObjectURL(url);
    document.removeEventListener("keydown", keyboard); window.removeEventListener("pagehide", pagehide);
    window.removeEventListener("beforeunload",beforeunload);
    viewport.dispose(); sheets?.dispose(); document.body.style.overflow = oldOverflow;
    root.remove(); currentEditor = null;
    if (!posted) onClose?.();
  };
  currentEditor = close;
  const pagehide = () => close(true);
  window.addEventListener("pagehide", pagehide);
  const sceneHasContent=scene=>!!(scene&&(scene.layers?.some(item=>item.kind!=="text"||item.text?.trim())||
    scene.background?.media&&scene.background.media!=="live-camera"||scene.pages?.some(sceneHasContent)));
  const hasContent=()=>!!(sceneHasContent(project)||sceneHasContent(quoteReturn?.project)||sceneHasContent(quoteDraft)||
     previousCamera?.background.media||q("caption").value.trim());
  const beforeunload=event=>{if(!closed&&hasContent()){event.preventDefault();event.returnValue="";}};
  if (!editor.classList.contains("is-create-v2")) window.addEventListener("beforeunload",beforeunload);
  const hideExit=()=>{q("exit-dialog").hidden=true;editor.querySelectorAll(":scope > :not(#ce-exit-dialog)").forEach(node=>node.inert=false);q("exit-cancel").focus();};
  const showExit=()=>{
    if(editor.classList.contains("is-create-v2")){inline?.finish();close();return;}
    if(!hasContent()){close();return;}
    inline?.finish();q("exit-dialog").hidden=false;
    editor.querySelectorAll(":scope > :not(#ce-exit-dialog)").forEach(node=>node.inert=true);
    q("exit-cancel").focus();
  };
  const keyboard = event => {
    if (document.querySelector(".emoji-overlay")) return;
    if(!q("exit-dialog").hidden&&event.key==="Escape"){event.preventDefault();hideExit();return;}
    if(event.key==="Escape"){event.preventDefault();navigateBack();}
    if (event.key === "Tab") {
      const host=q("exit-dialog").hidden?root:q("exit-dialog");
      const controls = [...host.querySelectorAll("button,input,textarea,select")].filter(el => !el.disabled && !el.closest("[hidden]") && el.getClientRects().length);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }
  };
  document.addEventListener("keydown", keyboard);
  q("close").onclick = () => {
    navigateBack();
  };
  q("back").onclick = () => navigateBack();
  q("exit-cancel").onclick=hideExit;
  q("exit-discard").onclick=()=>{if(!busy)close();};
  q("save-exit")?.addEventListener("click",()=>void saveAndExit());
  async function saveAndExit(){
    if(!onSave||busy||recording||captureTimer)return;
    inline.finish();pages.flush();
    if(!hasContent()){close();return;}
    ++cameraRequest;stopLive();cameraOpen=false;
    if(previousCamera){project.background=previousCamera.background;setProjectDuration(project,previousCamera.duration);previousCamera=null;}
    changed();await q("publish").onclick();
  }
  function navigateBack(){
    if(busy||recording||captureTimer)return;
    if(detailsOpen){closeDetails();return;}
    if(workspace?.closeSheet())return;
    if(editor.classList.contains("is-create-v2")){inline?.finish();close();return;}
    if(cameraOpen){showExit();return;}
    if(sheets?.dismissAll())return;
    if(quoteReturn){
      inline.finish();quoteDraft=structuredClone(project);quoteCaption=q("caption").value;
      const saved=quoteReturn;quoteReturn=null;replaceProject(saved.project);
      previousCamera=null;selectedId=saved.selectedId;time=saved.time;
      history.past=saved.past;history.future=saved.future;
      editor.classList.remove("is-quote");q("title").textContent="Create";
      q("inline-text").setAttribute("aria-label","Text on media");
      q("destination").value=["post","community","story"].includes(saved.destination)?saved.destination:"post";syncDestinationChoice();q("caption").value=saved.caption;
      pages.reset();changed();
      if(saved.cameraOpen||!source&&!onSave&&!project.background.media)void camera();
      return;
    }
    if(inline?.active()){inline.finish();changed();return;}
    const openMenus=root.querySelectorAll("details[open]");
    if(openMenus.length){openMenus.forEach(menu=>menu.open=false);return;}
    if(!q("media-panel").hidden){q("media-close").click();return;}
    if(!cameraOpen&&!source&&!onSave){void camera();return;}
    showExit();
  }
  const loadSources = async () => {
    const current = source ? resolveCommentSource(source) : null;
    if (!current) return;
    const resources = [current.author.avatar, current.comment.attachment?.url].filter(Boolean);
    await Promise.all(resources.map(key => assets.load(key).catch(() => {})));
    if (!closed) changed(false);
  };
  const setBackground = async (file, kind, { preserveCameraMirror = false, adoptFrame = false } = {}) => {
    if (closed) return;
    previousCamera = null;
    const previousBackground=project.background;
    const value = typeof file === "string" && /^data:(image|video)\//.test(file) ? await (await fetch(file)).blob() : file;
    const media = typeof value === "string" ? value : rememberBlob(value);
    const item = await assets.load(media, kind === "video" ? "video" : "image");
    if (closed) return;
    stopPlayback();
    history.record(); stopLive();cameraOpen=false;
    project.background = createBackgroundForMedia(adoptFrame ? null : previousBackground, kind, media, q("canvas-color").value, { preserveCameraMirror,
      fit: adoptFrame ? "contain" : previousBackground?.fit });
    if (adoptFrame && !initialProject && !project.layers.length && !(project.pages?.length > 1)) {
      const frame = uploadedMediaFrame(item);
      if (frame) Object.assign(project, frame);
    }
    if(kind==="photo")strip?.add(media);
    setProjectDuration(project, kind === "video" ? Math.min(60, item.creativeDuration || item.duration) : 5);
    if(kind==="video")initVideoEdit(project.background,item.creativeDuration||item.duration);
    time = 0; changed(); status(kind === "video" ? "Video ready. Edit on screen or choose a tool below." : "Photo ready. Edit directly on screen.");
  };
  strip=createCameraStrip({host:q("camera-strip"),uploadHost:q("camera-gallery-slot"),plainGallery:editor.classList.contains("is-create-v2"),onUpload:()=>{if(!busy&&!recording&&!captureTimer)q("upload").click();},
    onPick:async url=>{
      const blob=blobs.get(url);if(!blob||busy||recording||captureTimer)return;
      try{busy=true;inline?.finish();error("");refreshControls();
        await setBackground(blob,"photo", { adoptFrame: true });
      }catch(failure){error(failure);}finally{busy=false;if(!closed)changed();}
    }});
  q("upload").onchange = async event => {
    const files = [...event.target.files]; event.target.value = ""; if (!files.length) return;
    if (editor.classList.contains("is-quote")) {
      if (files.length !== 1 || !files[0].type.startsWith("image/")) {
        return error("Choose one supported photo for this quote.");
      }
      try {
        busy = true; inline.finish(); error(""); refreshControls();
        await setBackground(files[0], "photo", { adoptFrame: true });
        status("Photo added to quote. Adjust the text and share when ready.");
      } catch (failure) {
        error(failure);
      } finally {
        busy = false;
        if (!closed) changed();
      }
      return;
    }
    if(files.length>10)return error("Choose up to 10 photos or videos.");
    if (files.some(file=>!/^(image|video)\//.test(file.type))) return error("Choose supported photos or videos.");
    try {
      busy = true; inline.finish(); error(""); refreshControls(); await setBackground(files[0], files[0].type.startsWith("video/") ? "video" : "photo", { adoptFrame: true });
      for(const file of files.slice(1)){
        const media=rememberBlob(file),video=file.type.startsWith("video/"),asset=await assets.load(media,video?"video":"image");
        if(!video)strip?.add(media);
        const scene=createProject(source);scene.background={kind:video?"video":"photo",media,color:project.background.color};
        setProjectDuration(scene,video?asset.creativeDuration||asset.duration:5);pages.append(scene);
      }
      pages.flush();pages.refresh();root.querySelector(".ce-source").classList.add("is-collapsed");q("source-toggle").setAttribute("aria-expanded","false");
    }
    catch (failure) { error(failure); } finally { busy = false; if (!closed) changed(); }
  };
  const camera = async () => {
    if (closed || busy || recording) return;
    cameraOpen=true;refreshControls();
    if (!navigator.mediaDevices?.getUserMedia) return error("Camera is unavailable. Upload a photo or video instead.");
    try {
      error(""); const request=++cameraRequest;
      editor.classList.add("is-camera-pending");
      // Mobile cameras may not open the other lens while the first is active.
      if(live){backgroundVideo()?.pause();live.getTracks().forEach(track=>track.stop());refreshControls();}
      const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(facing));
      if (closed || request!==cameraRequest) { stream.getTracks().forEach(track => track.stop()); return; }
      if(!previousCamera)previousCamera={background:structuredClone(project.background),duration:project.duration};
      stopPlayback(); stopLive(); live = stream;
      const video = document.createElement("video"); video.playsInline = true; video.muted = true;video.setAttribute("playsinline","");video.srcObject = stream;mediaHost.append(video);await video.play();await waitForVideoFrame(video);
      if(closed||request!==cameraRequest){stream.getTracks().forEach(track=>track.stop());video.remove();return;}
      assets.items.set("live-camera", video);
      if(editor.classList.contains("is-create-v2")){
        video.className="cs-live-camera";
        video.style.transform=facing==="user"?"scaleX(-1)":"none";
        root.querySelector(".ce-stage").prepend(video);
      }
      project.background = { kind: "video", media: "live-camera", color: "#17191d", mirror: facing === "user" };q("zoom").value=1;
      q("record").disabled = false; q("photo").disabled = false; q("flip").hidden = false; time = 0;
      const caps=stream.getVideoTracks()[0]?.getCapabilities?.()||{};
      q("flash").disabled=!caps.torch;q("zoom").disabled=!caps.zoom;
      if(caps.zoom){q("zoom").min=caps.zoom.min;q("zoom").max=caps.zoom.max;const z=naturalZoom(caps.zoom.min,caps.zoom.max);q("zoom").value=z;if(stream.getVideoTracks()[0].getSettings?.().zoom!==z)void stream.getVideoTracks()[0].applyConstraints({advanced:[{zoom:z}]}).catch(()=>{});}
      status("Tap the shutter for a photo. Press and hold to switch to video."); changed();
      root.querySelector(".ce-source").classList.add("is-collapsed");q("source-toggle").setAttribute("aria-expanded","false");
      editor.classList.remove("is-camera-pending");
    } catch (failure) {
      editor.classList.remove("is-camera-pending");
      stopLive(); if(previousCamera){project.background=previousCamera.background;setProjectDuration(project,previousCamera.duration);previousCamera=null;}
      error(failure.name === "NotAllowedError" ? "Allow camera access, or upload a file." : "Camera unavailable. Upload a photo or video instead."); changed();
    }
  };
  q("camera").onclick = camera;
  q("camera-reset")?.addEventListener("click",()=>{
    if(!busy&&!recording&&!captureTimer)void camera();
  });
  q("flip").onclick = () => { facing = facing === "user" ? "environment" : "user"; void camera(); };
  const countdown=action=>{
    const delay=Number(q("camera-timer").value);if(!delay){void action();return;}
    let remaining=delay;status(`Capturing in ${remaining}…`);
    captureTimer=setInterval(()=>{if(closed||!live){clearInterval(captureTimer);captureTimer=null;return;}remaining--;
      if(remaining<=0){clearInterval(captureTimer);captureTimer=null;void action();}else status(`Capturing in ${remaining}…`);
    },1000);refreshControls();
  };
  const pinch=new Map();let pinchStart=null;
  const zoomTo=value=>{const track=live?.getVideoTracks()[0];if(!track||q("zoom").disabled)return;q("zoom").value=value;void track.applyConstraints({advanced:[{zoom:value}]}).catch(()=>{});};
  canvas.addEventListener("pointerdown",e=>{if(!live||q("zoom").disabled||busy||captureTimer||!cameraOpen)return;pinch.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch.size===2){const [a,b]=[...pinch.values()];pinchStart={d:distance(a,b),z:Number(q("zoom").value)};}});
  canvas.addEventListener("pointermove",e=>{if(!pinch.has(e.pointerId))return;pinch.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch.size===2&&pinchStart){e.preventDefault();const [a,b]=[...pinch.values()];zoomTo(zoomFromPinch(pinchStart.z,pinchStart.d,distance(a,b),Number(q("zoom").min),Number(q("zoom").max)));}});
  const endPinch=e=>{pinch.delete(e.pointerId);if(pinch.size<2)pinchStart=null;};
  canvas.addEventListener("pointerup",endPinch);canvas.addEventListener("pointercancel",endPinch);
  q("flash").onclick=async()=>{
    const track=live?.getVideoTracks()[0];if(!track)return;
    const on=q("flash").getAttribute("aria-pressed")!=="true";
    try{await track.applyConstraints({advanced:[{torch:on}]});q("flash").setAttribute("aria-pressed",String(on));}catch{error("Flash is unavailable on this camera.");}
  };
  q("zoom").oninput=()=>{const track=live?.getVideoTracks()[0];if(track)void track.applyConstraints({advanced:[{zoom:Number(q("zoom").value)}]}).catch(()=>error("Zoom is unavailable on this camera."));};
  const capturePhoto=async()=>{
    const video=assets.get("live-camera");if(!live||!video?.videoWidth)return;
    try{busy=true;refreshControls();const photo=captureFrame(document.createElement("canvas"),video,project.width,project.height,facing);const blob=await canvasBlob(photo);
      await setBackground(blob,"photo");
    }catch(failure){error(failure);}finally{busy=false;if(!closed)changed();}
  };
  q("photo").onclick=()=>{if(recording||busy||captureTimer)return;cameraMode="photo";refreshControls();};
  q("record").onclick=()=>{if(recording||busy||captureTimer)return;cameraMode="video";refreshControls();};
  const recordVideo = async () => {
    if (recording) { recording.stop(); return; }
    if (!live || busy) return;
    try {
      busy=true;refreshControls();
      if(!live.getAudioTracks().length){
        try{const audio=await navigator.mediaDevices.getUserMedia({audio:true});if(closed||!live){audio.getTracks().forEach(track=>track.stop());return;}audio.getAudioTracks().forEach(track=>live.addTrack(track));}
        catch{error("Microphone unavailable. This video will be recorded without sound.");}
      }
      const chunks = [], recorder = new MediaRecorder(live, { mimeType: videoMime(), videoBitsPerSecond: 8_000_000 });
      busy=false;
      recording = recorder; recordingStart = performance.now();
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { error("Recording failed. Upload a video or try again."); recording = null; refreshControls(); };
      recorder.onstop = async () => {
        const duration = Math.min(MAX_CAPTURE_SECONDS, (performance.now() - recordingStart) / 1000);
        recording = null; if (closed) return;
        busy = true; refreshControls();
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType }); if (!blob.size) throw new Error("The recording was empty.");
          await setBackground(blob, "video", { preserveCameraMirror: true });
          // Some WebM recorders omit the container duration. Retain the measured recording duration.
          setProjectDuration(project,duration);
          const asset=backgroundVideo();if(asset)asset.creativeDuration=project.duration;
          delete project.background.videoEdit;initVideoEdit(project.background,project.duration);
          time=0;status("Recording ready. Preview it before sharing.");
        } catch (failure) { error(failure); }
        finally { busy = false; if (!closed) changed(); }
      };
      recorder.start(200);refreshControls();status("Recording underneath your layers…");
    } catch (failure) { busy=false;error(failure); recording = null; refreshControls(); }
  };
  q("shutter").onclick=()=>{
    if(ignoreNextShutterClick){ignoreNextShutterClick=false;return;}
    if(recording){if(recording.state!=="inactive")recording.stop();q("shutter").disabled=true;return;}
    if(!live||busy||captureTimer)return;
    countdown(cameraMode==="photo"?capturePhoto:recordVideo);
  };
  q("shutter").addEventListener("pointerdown",event=>{
    if(!cameraOpen||!live||busy||recording||captureTimer||event.button>0)return;
    clearTimeout(shutterHoldTimer);
    shutterHoldTimer=setTimeout(()=>{
      shutterHoldTimer=null;
      if(closed||!live||recording||busy)return;
      ignoreNextShutterClick=true;
      window.setTimeout(()=>{ignoreNextShutterClick=false;},750);
      captureModes?.select(cameraMode==="video"?"photo":"video");
      status("Video mode selected. Tap the shutter to start recording.");
    },450);
  });
  const cancelShutterHold=event=>{
    clearTimeout(shutterHoldTimer);
    shutterHoldTimer=null;
    if(event?.type==="pointercancel"||event?.type==="lostpointercapture")ignoreNextShutterClick=false;
  };
  q("shutter").addEventListener("pointerup",cancelShutterHold);
  q("shutter").addEventListener("pointercancel",cancelShutterHold);
  q("shutter").addEventListener("lostpointercapture",cancelShutterHold);
  const add = item => {
    inline?.finish(); history.record();
    item.endTime = project.duration; project.layers.push(item); selectedId = item.id; drawing = false; changed(); return item;
  };
  inline = bindInlineText({ input:q("inline-text"),done:q("text-done"),canvas,project,layer,history,changed });
  tools = bindCreativeTools({root,q,project,layer,history,inline,add,changed,seek,setSelected:id=>{selectedId=id;}});
  pages = bindCreativePages({q,project,history,changed,seek,setSelected:id=>{selectedId=id;}});
  mediaTools=bindMediaEditor({root,editor,q,project,assets,history,changed,seek,time:()=>time,stop:stopPlayback,
    canEdit:()=>!busy&&!recording&&!captureTimer,inline,error});
  captureModes=bindCaptureModes({editor,q,changed,canEdit:()=>!busy&&!recording&&!captureTimer,alive:()=>!closed,initialMode:initialCaptureMode});
  sheets = bindSheets({ root, editor, q });
  if(editor.classList.contains("cs-studio"))workspace=bindStudioWorkspace({root,editor,q,project,assets,history,changed,seek,time:()=>time,select,selectedId:()=>selectedId,stop:stopPlayback,
    canEdit:()=>!busy&&!recording&&!captureTimer&&!live,onCompare:()=>render(time)});
  if(q("studio-publish"))q("studio-publish").onclick=()=>{if(!q("publish").disabled){workspace?.closeSheet(false);inline.finish();q("publish").click();}};
  root.querySelectorAll("[data-ce-add]").forEach(button => button.onclick = () => {
    const kind = button.dataset.ceAdd;
    if(kind==="text"&&cameraOpen){
      if(busy||recording||captureTimer)return;
      history.record();++cameraRequest;stopLive();cameraOpen=false;
      project.background={kind:"color",color:"#ffffff"};
    }
    if (kind === "text") { const item=add(createLayer("text",{text:"",color:project.background.kind==="color"?"#17191d":"#ffffff"})); inline.edit(item); }
    if (kind === "image") q("image-upload").click();
    if (kind === "comment") {inline.finish();tools.populateComments();q("comments").hidden=!q("comments").hidden;}
    if (kind === "drawing") { drawing = !drawing; selectedId = null; changed(); status(drawing ? "Draw on the canvas. Turn Draw off to move your strokes as layers." : "Drawing finished."); }
    if (kind === "emoji") {
      openEmojiPicker(null, emoji => add(createLayer("emoji", { text: emoji, width: 210 })), { chat: true, selectOnly: true });
      document.querySelector(".emoji-overlay").style.zIndex = "2400";
    }
  });
  canvas.addEventListener("click",()=>{
    if(!editor.classList.contains("is-quote")||inline.active()||busy||preview)return;
    const item=layer()?.kind==="text"?layer():project.layers.find(value=>value.kind==="text"&&!value.locked);
    if(item){selectedId=item.id;inline.edit(item);changed(false);}
  });
  q("draw").onclick = () => { drawing = !drawing; selectedId = null; changed(); };
  q("image-upload").onchange = async event => {
    const file = event.target.files[0]; event.target.value = ""; if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return error("Choose an image or GIF smaller than 10 MB.");
    try {
      const media = rememberBlob(file), image = await assets.load(media);
      if (closed) return;
      const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
      add(createLayer("image", { media, width: 480, height: 480 * height / width }));
    } catch (failure) { error(failure); }
  };
  for (const [name, property] of Object.entries({ text: "text", font: "font", align: "align", color: "color", background: "background", opacity: "opacity", scale: "scale", rotation: "rotation" })) {
    q(name).onfocus=()=>history.record();
    q(name).oninput = () => {
      const item = layer(); if (!item || busy || item.locked) return;
      item[property] = ["opacity", "scale", "rotation"].includes(name) ? Number(q(name).value) : q(name).value;
      changed(false);
      if (name === "text") refreshLayers();
    };
  }
  q("background-on").onchange = () => { if (layer()&&!layer().locked) {history.record();layer().backgroundOn = q("background-on").checked;} changed(false); };
  for (const name of ["start", "end"]) q(name).onchange = () => {
    const item = layer(); if (!item) return;
    if(item.locked)return;history.record();
    if (name === "start") item.startTime = clamp(q(name).value, 0, item.endTime - .1);
    else item.endTime = clamp(q(name).value, item.startTime + .1, project.duration);
    changed(); seek(Math.min(Math.max(time, item.startTime), item.endTime));
  };
  q("duplicate").onclick = () => { if(layer()?.locked)return;history.record();const copy = duplicateLayer(project, selectedId); if (copy) { selectedId = copy.id; changed(); } };
  q("delete").onclick = remove;
  q("forward").onclick = () => { if(layer()?.locked)return;history.record();moveLayer(project, selectedId, 1); changed(); };
  q("backward").onclick = () => { if(layer()?.locked)return;history.record();moveLayer(project, selectedId, -1); changed(); };
  q("canvas-color").onfocus=()=>history.record();
  q("canvas-color").oninput = () => { project.background.color = q("canvas-color").value; changed(false); };
  if(q("next-action"))q("next-action").onclick=()=>{
    if(onSave){q("publish").click();return;}
    inline.finish();
    q("publish").click();
  };
  if(q("final-share"))q("final-share").onclick=()=>q("publish").click();
  root.querySelectorAll("[data-ce-rail]").forEach(button=>button.onclick=()=>{
    const action=button.dataset.ceRail;
    if(action==="text"){
      if(cameraOpen){
        ++cameraRequest;stopLive();cameraOpen=false;
        if(previousCamera){
          project.background=previousCamera.background;
          setProjectDuration(project,previousCamera.duration);
          previousCamera=null;
        }else if(project.background.kind==="live-camera"){
          project.background={kind:"color",color:q("canvas-color").value,media:""};
        }
        changed();
      }
      root.querySelector('[data-ce-add="text"]').click();
    }
    if(action==="draw"){
      inline?.finish();q("draw").click();
      const panel=root.querySelector(".ce-panel");panel.dataset.sheet="open";
      q("draw-controls").scrollIntoView({block:"center"});
    }
    if(action==="adjust"&&workspace){inline?.finish();stopPlayback();workspace.openSheet("adjust");return;}
    if(action==="adjust"){
      inline?.finish();stopPlayback();
      const panel=root.querySelector(".ce-panel");
      panel.removeAttribute("data-sheet");
      q("inspector").hidden=true;q("inspector").classList.add("is-collapsed");
      root.querySelector(".ce-source").classList.add("is-collapsed");
      q("media-panel").hidden=false;q("media-title").textContent="Color";
      root.querySelectorAll("[data-ce-media-panel]").forEach(item=>item.hidden=item.dataset.ceMediaPanel!=="color");
      mediaTools.refresh();
    }
    if(action==="trim")root.querySelector('[data-ce-media-tool="trim"]')?.click();
    if(action==="templates"){
      inline?.finish();
      q("inspector").hidden=false;q("text-fields").hidden=false;
      q("inspector").classList.remove("is-collapsed");
      const panel=root.querySelector(".ce-panel");panel.dataset.sheet="open";
      const target=!q("behind-subject").hidden?q("behind-subject"):root.querySelector(".ce-presets");
      target?.scrollIntoView({block:"center"});
    }
    if(action==="overlay"){inline?.finish();q("image-upload").click();}
    if(action==="remove-bg"){inline?.finish();void removePersonBackground();}
    if(action==="caption"){
      if(editor.classList.contains("is-create-v2"))q("publish").click();
      else q("share-toggle").click();
    }
    if(action==="more"){
      const menu=root.querySelector(".ce-header-menu");
      if(menu)menu.open=!menu.open;
    }
    if(action==="canvas-color"){
      inline?.finish();
      const panel=root.querySelector(".ce-panel");panel.dataset.sheet="open";
      const source=root.querySelector(".ce-source");
      if(source.classList.contains("is-collapsed"))q("source-toggle").click();
      root.querySelector(".ce-source")?.scrollIntoView({block:"center"});
      q("canvas-color").click();
    }
    if(action==="layers")q("layers-toggle").click();
  });
  if(q("sound-chip")){
    const soundPicker=q("sound-picker"),soundList=q("sound-list");
    let soundMode="trending",soundResults=new Map();
    const fillSounds=async()=>{
      soundList.replaceChildren();
      const loading=document.createElement("p");
      loading.textContent=soundMode==="saved"?"Loading saved sounds…":"Loading trending sounds…";
      soundList.append(loading);
      try{
      const library=soundMode==="saved"
        ? (await loadAudioLibrary()).filter(sound=>sound.saved===true&&Boolean(sound.sourcePostId))
        : (await discoverSounds()).filter(sound=>
          sound.trending===true&&sound.available===true&&sound.reuseAllowed===true&&
          Boolean(sound.mediaReference)&&Boolean(sound.sourcePostId));
      if(closed||soundPicker.hidden)return;
      soundResults=new Map(library.map(sound=>[sound.id,sound]));
      soundList.replaceChildren();
      if(!library.length){
        const empty=document.createElement("p");
        empty.textContent=soundMode==="saved"?"Your saved sounds will appear here.":"No trending sounds are available right now.";
        soundList.append(empty);
        return;
      }
      for(const sound of library){
        const row=document.createElement("div");row.className="ce-sound-row";
        const button=document.createElement("button");
        button.type="button";button.className="ce-sound-use";
        if(sound.mediaReference)button.dataset.librarySoundId=sound.id;
        else button.dataset.savedSoundId=sound.id;
        button.disabled=sound.unavailable===true||sound.available===false;
        const details=document.createElement("span");details.className="ce-sound-result";
        const title=document.createElement("b");title.textContent=sound.title||"Original audio";
        const author=document.createElement("small");
        author.textContent=`${sound.author||"Creator"}${sound.useCount?` · ${sound.useCount.toLocaleString()} uses`:""}`;
        details.append(title,author);button.append(details);
        if(sound.trending){const badge=document.createElement("small");badge.className="ce-sound-trending";badge.textContent="Trending";button.append(badge);}
        row.append(button);
        if(sound.mediaReference){
          const save=document.createElement("button");
          save.type="button";save.className="ce-sound-save";save.dataset.toggleSoundSave=sound.id;
          save.disabled=!sound.available||(!sound.reuseAllowed&&!sound.owned);
          save.textContent=sound.saved?"Saved":"Save";
          save.setAttribute("aria-pressed",String(sound.saved));
          save.setAttribute("aria-label",`${sound.saved?"Remove":"Save"} ${sound.title||"sound"} ${sound.saved?"from":"to"} your saved sounds`);
          row.append(save);
        }
        soundList.append(row);
      }
      }catch(failure){
        soundList.replaceChildren();
        const message=document.createElement("p");message.textContent=failure.message||"Sounds couldn’t load.";soundList.append(message);
      }
    };
    const setSound=async({media,title,sourcePostId=null,sourceSoundId=null,previewUrl=null,avatar=""})=>{
      const preview=previewUrl||await mediaUrl(media);
      const track={id:`sound-${crypto.randomUUID()}`,media,title:String(title||"Sound").trim().slice(0,100),sourcePostId,sourceSoundId,avatar,volume:activeSound()?.volume??.8,offset:0,loop:true};
      history.record();project.audioTracks=[track];
      const previewElement=soundPreviewFor(track),otherPreview=previewElement===soundPreview?soundVideoPreview:soundPreview;
      otherPreview.pause();otherPreview.removeAttribute("src");delete otherPreview.dataset.creativeMedia;otherPreview.load();
      previewElement.pause();previewElement.dataset.creativeMedia=media;previewElement.src=preview;previewElement.load();
      soundPicker.hidden=true;q("sound-error").textContent="";
      syncSoundControls();
      changed();
    };
    q("sound-preview-toggle")?.addEventListener("click",async event=>{
      event.preventDefault();event.stopPropagation();
      const track=activeSound();
      if(!track)return;
      const preview=soundPreviewFor(track);
      if(!preview.src)return;
      if(!preview.paused){preview.pause();syncSoundControls();return;}
      syncSoundPreviewTime(time);
      try{await preview.play();syncSoundControls();}
      catch(failure){if(q("sound-error"))q("sound-error").textContent=`${failure?.name||"PlaybackError"}: ${failure?.message||"Sound preview could not start."}`;syncSoundControls();}
    });
    if(q("sound-pill-main"))q("sound-pill-main").onclick=()=>q("sound-chip").click();
    if(q("sound-pill-remove"))q("sound-pill-remove").onclick=()=>q("sound-remove").click();
    q("sound-chip").onclick=()=>{
      inline?.finish();q("sound-error").textContent="";
      soundPicker.hidden=!soundPicker.hidden;
      q("sound-chip").setAttribute("aria-expanded",String(!soundPicker.hidden));
      
      if(!soundPicker.hidden){void fillSounds();q("sound-close").focus();}
    };
    q("sound-close").onclick=()=>{soundPicker.hidden=true;q("sound-chip").setAttribute("aria-expanded","false");q("sound-chip").focus();};
    soundPicker.querySelectorAll("[data-sound-mode]").forEach(button=>button.onclick=()=>{
      soundMode=button.dataset.soundMode;
      soundPicker.querySelectorAll("[data-sound-mode]").forEach(tab=>tab.setAttribute("aria-selected",String(tab===button)));
      void fillSounds();
    });
    q("sound-upload-open").onclick=()=>q("sound-upload").click();
    q("sound-upload").onchange=async event=>{
      const file=event.target.files?.[0];event.target.value="";
      if(!file)return;
      if(!file.type.startsWith("audio/")&&!/\.(mp3|m4a|aac|wav|ogg|opus|flac|webm)$/i.test(file.name)){
        q("sound-error").textContent="Choose an audio file.";return;
      }
      try{
        const media=rememberBlob(file);
        await setSound({media,title:file.name.replace(/\.[^.]+$/,"")||"My sound",previewUrl:media});
      }catch(failure){q("sound-error").textContent=failure.message||"Couldn’t add that sound.";}
    };
    soundList.onclick=async event=>{
      const saveButton=event.target.closest("[data-toggle-sound-save]");
      if(saveButton){
        const sound=soundResults.get(saveButton.dataset.toggleSoundSave);if(!sound)return;
        saveButton.disabled=true;q("sound-error").textContent="";
        try{
          const nextSaved=!sound.saved;
          const savedItem={kind:"audio-sound",soundId:sound.sourcePostId?null:sound.id,
            sourcePostId:sound.sourcePostId||null,sourceSoundId:sound.sourcePostId?null:sound.id,
            available:sound.available,owned:sound.owned,audioReuseAllowed:sound.reuseAllowed,visibility:"public"};
          await saveAudio(savedItem,nextSaved);
          sound.saved=nextSaved;
          saveButton.textContent=nextSaved?"Saved":"Save";
          saveButton.setAttribute("aria-pressed",String(nextSaved));
          saveButton.setAttribute("aria-label",`${nextSaved?"Remove":"Save"} ${sound.title||"sound"} ${nextSaved?"from":"to"} your saved sounds`);
        }catch(failure){q("sound-error").textContent=failure.message||"Couldn’t save that sound.";}
        finally{if(saveButton.isConnected)saveButton.disabled=false;}
        return;
      }
      const libraryButton=event.target.closest("[data-library-sound-id]");
      if(libraryButton){
        const sound=soundResults.get(libraryButton.dataset.librarySoundId);if(!sound)return;
        libraryButton.disabled=true;q("sound-error").textContent="";
        try{
          await setSound({
            media:sound.mediaReference,title:sound.title,
            sourcePostId:sound.sourcePostId||null,
            sourceSoundId:sound.sourcePostId?null:sound.id,
            avatar:sound.avatar||"",
          });
        }catch(failure){q("sound-error").textContent=failure.message||"Couldn’t load that sound.";}
        finally{if(libraryButton.isConnected)libraryButton.disabled=false;}
        return;
      }
      const button=event.target.closest("[data-saved-sound-id]");if(!button)return;
      button.disabled=true;q("sound-error").textContent="";
      try{
        let post=api.post(button.dataset.savedSoundId);
        if(!post&&api.authMode()==="cloud")post=await api.loadCloudPost(button.dataset.savedSoundId);
        const source=await loadAudioSource(post);
        if(!source?.media?.[0]||!canReuseAudio(post))throw new Error("That saved sound is no longer available for reuse.");
        const media=source.media[0],previewUrl=await mediaUrl(media);
        if(closed)return;
         await setSound({
           media,previewUrl,title:audioTitle(source),
           sourcePostId:source.soundId?null:(source.sourcePostId||source.id),
           sourceSoundId:source.soundId||null,
           avatar:source.authorProfile?.avatar||api.user(source.author)?.avatar||"",
         });
      }catch(failure){q("sound-error").textContent=failure.message||"Couldn’t load that sound.";}
      finally{if(button.isConnected)button.disabled=false;}
    };
    q("sound-volume").onfocus=()=>history.record();
    q("sound-volume").oninput=()=>{
      const track=activeSound();if(!track)return;
      track.volume=Number(q("sound-volume").value);soundPreviewFor(track).volume=track.volume;changed(false);
    };
    q("original-audio-toggle").onchange=()=>{
      history.record();
      const muted=setOriginalAudioMuted(project.background,q("original-audio-toggle").checked,backgroundVideo());
      if(muted===null){q("original-audio-toggle").checked=false;return;}
      changed();
    };
    q("sound-remove").onclick=()=>{
      history.record();project.audioTracks=[];soundPreview.pause();soundVideoPreview.pause();soundPreview.removeAttribute("src");soundVideoPreview.removeAttribute("src");delete soundPreview.dataset.creativeMedia;delete soundVideoPreview.dataset.creativeMedia;soundPreview.load();soundVideoPreview.load();soundPicker.hidden=true;syncSoundControls();changed();
    };
    if(q("sound-rights-confirm"))q("sound-rights-confirm").onchange=()=>{
      soundReuseChoiceTouched=true;
      syncSoundRights();
    };
  }
  let edgeGeneration = 0;
  async function renderCutoutEdges(commit = false) {
    const target = edgeTarget();
    if (!target?.subjectBaseMedia) return;
    const generation = ++edgeGeneration, baseMedia = target.subjectBaseMedia;
    try {
      let base = edgeBaseImages.get(baseMedia);
      if (!base) { base = await assets.load(baseMedia, "image"); edgeBaseImages.set(baseMedia, base); }
      if (generation !== edgeGeneration || closed) return;
      const previewKey = `edge-preview:${target.id || "background"}`;
      if (!(target.edgeShift || target.edgeFeather)) {
        target.media = baseMedia;
        assets.items.delete(previewKey);
        assets.items.set(baseMedia, base);
        edgePriorMedia.delete(target);
        changed(false);
        if (commit) status("Edge adjustment reset.");
        return;
      }
      const canvas = adjustCutoutEdges(base, target.edgeShift || 0, target.edgeFeather || 0);
      if (target.media !== previewKey) edgePriorMedia.set(target, target.media);
      assets.items.set(previewKey, canvas);
      target.media = previewKey;
      changed(false);
      if (!commit) return;
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not save the edge adjustment.")), "image/png"));
      if (generation !== edgeGeneration || closed) return;
      const oldMedia = edgePriorMedia.get(target) || target.media;
      const media = rememberBlob(blob);
      await assets.load(media, "image");
      if (generation !== edgeGeneration || closed) return;
      target.media = media;
      edgePriorMedia.delete(target);
      assets.items.delete(previewKey);
      assets.items.set(baseMedia, base);
      if (oldMedia?.startsWith("blob:") && oldMedia !== baseMedia) {
        blobs.delete(oldMedia); assets.items.delete(oldMedia); URL.revokeObjectURL(oldMedia);
      }
      changed();
      status("Subject edge updated.");
    } catch (failure) { error(failure); }
  }
  q("edge-shift").onfocus = q("edge-feather").onfocus = () => history.record();
  q("edge-shift").oninput = () => { const target=edgeTarget();if(target){target.edgeShift=Number(q("edge-shift").value);void renderCutoutEdges(false);} };
  q("edge-feather").oninput = () => { const target=edgeTarget();if(target){target.edgeFeather=Number(q("edge-feather").value);void renderCutoutEdges(false);} };
  q("edge-shift").onchange = q("edge-feather").onchange = () => void renderCutoutEdges(true);
  q("edge-reset").onclick = () => {
    const target=edgeTarget();if(!target)return;
    history.record();target.edgeShift=0;target.edgeFeather=0;
    q("edge-shift").value="0";q("edge-feather").value="0";void renderCutoutEdges(true);
  };
  q("refine-mask").onclick = async () => {
    const target=edgeTarget();
    if(!target?.subjectCutout||busy||live)return;
    try {
      const cutout=await assets.load(target.media,"image");
      if(closed)return;
      const source=cutoutSourceInfo.get(target);
      closeMaskRefiner?.();
      closeMaskRefiner=openCreativeMaskRefiner({
        host:q("canvas").closest(".ce-stage"),cutout,renderSource:source?.renderSource||null,toast,
        onCommit:async blob=>{
          const media=rememberBlob(blob),refined=await assets.load(media,"image");
          if(closed)return;
          history.record();
          target.media=media;target.subjectBaseMedia=media;
          target.edgeShift=0;target.edgeFeather=0;
          edgeBaseImages.set(media,refined);
          q("edge-shift").value="0";q("edge-feather").value="0";
          changed();status("Mask refined. Continue with Edge or Feather if needed.");
        }
      });
    } catch(failure) { error(failure); }
  };
  q("behind-subject").onclick = async () => {
    inline?.finish();
    const textLayer=layer();
    if(textLayer?.kind!=="text"||project.background.kind!=="photo"||!project.background.media)return;
    const existing=project.layers.find(item=>item.subjectForTextId===textLayer.id);
    if(existing){
      history.record();project.layers=project.layers.filter(item=>item!==existing);textLayer.behindSubject=false;
      changed();status("Text returned in front.");return;
    }
    if(busy||recording||live)return;
    if(!textLayer.text?.trim())return error("Add text before placing it behind the subject.");
    const image=assets.get(project.background.media);if(!image)return error("The photo is not ready yet.");
    busy=true;refreshControls();status("Finding the subject and placing text behind it…");
    let cutout;
    try{
      cutout=await createPersonCutout({still:true});
      const matte=await cutout.image(image);
      const work=document.createElement("canvas");work.width=project.width;work.height=project.height;
      const context=work.getContext("2d",{willReadFrequently:true});
      if(!context)throw new Error("Could not prepare the subject layer.");
      coverCreativeImage(context,image,project.width,project.height,project.background.crop,project.background.fit);
      context.globalCompositeOperation="destination-in";
      coverCreativeImage(context,matte,project.width,project.height,project.background.crop,project.background.fit);
      context.globalCompositeOperation="source-over";
      const blob=await new Promise((resolve,reject)=>work.toBlob(value=>value?resolve(value):reject(new Error("Could not create the foreground subject layer.")),"image/png"));
      if(closed)return;
      history.record();
      const media=rememberBlob(blob);await assets.load(media,"image");
      const foreground=createLayer("image",{media,subjectBaseMedia:media,subjectCutout:true,subjectForTextId:textLayer.id,
        width:project.width,height:project.height,startTime:textLayer.startTime,endTime:textLayer.endTime,locked:true,edgeShift:0,edgeFeather:0});
      cutoutSourceInfo.set(foreground,{renderSource:(context,width,height)=>coverCreativeImage(context,image,width,height,project.background.crop,project.background.fit)});
      project.layers.push(foreground);textLayer.behindSubject=true;selectedId=textLayer.id;
      q("inspector").classList.remove("is-collapsed");q("style-toggle").setAttribute("aria-expanded","true");
      changed();status("Text is behind the subject. Drag it into place.");
    }catch(failure){error(failure);}
    finally{cutout?.close();busy=false;if(!closed)changed(false);}
  };
  async function removePersonBackground(){
    const item=layer();
    const backgroundTarget=item?.kind!=="image"&&project.background.kind==="photo"&&project.background.media;
    if(item?.kind!=="image"&&!backgroundTarget)return error("Select a photo or image overlay first.");
    if(item?.locked)return error("Unlock this image before editing it.");
    if(item?.subjectCutout||backgroundTarget&&project.background.subjectCutout){
      q("inspector").classList.remove("is-collapsed");q("style-toggle").setAttribute("aria-expanded","true");changed();
      status("Background already removed. Adjust Edge or Feather to refine it.");return;
    }
    const image=assets.get(backgroundTarget?project.background.media:item.media);
    if(!image)return error("The selected photo is not ready yet.");
    if(busy||recording||live)return;
    busy=true;refreshControls();error("");status("Finding the subject and refining its edges…");
    let cutout;
    try{
      const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
      cutout=await createPersonCutout({still:true});
      const matte=await cutout.image(image);
      const work=document.createElement("canvas");work.width=width;work.height=height;
      const context=work.getContext("2d",{willReadFrequently:true});
      context.drawImage(image,0,0,width,height);
      context.globalCompositeOperation="destination-in";
      context.drawImage(matte,0,0,width,height);
      context.globalCompositeOperation="source-over";
      const blob=await new Promise((resolve,reject)=>work.toBlob(value=>value?resolve(value):reject(new Error("Could not create the transparent image.")),"image/png"));
      if(closed)return;
      history.record();
      const media=rememberBlob(blob);await assets.load(media,"image");
      const target=backgroundTarget?project.background:item;
      cutoutSourceInfo.set(target,{renderSource:(outputContext,outputWidth,outputHeight)=>outputContext.drawImage(image,0,0,outputWidth,outputHeight)});
      target.media=media;target.subjectCutout=true;target.subjectBaseMedia=media;target.edgeShift=0;target.edgeFeather=0;
      q("inspector").classList.remove("is-collapsed");q("style-toggle").setAttribute("aria-expanded","true");
      changed();
      status("Background removed. Adjust Edge or Feather to refine the boundary.");
    }catch(failure){error(failure);}
    finally{cutout?.close();busy=false;if(!closed)changed(false);}
  }
  q("preview").onclick = () => {
    inline.finish();
    preview = !preview; drawing = false; editor.classList.toggle("is-preview", preview); q("preview").setAttribute("aria-pressed", String(preview));
    q("preview").querySelector(".ce-lbl").textContent=preview?"Edit":"Preview";changed(false);
    if (preview) { seek(0); q("play").click(); }
  };
  q("scrub").oninput = () => { if (!live && !busy) seek(q("scrub").value); };
  q("play").onclick = async () => {
    if (live || busy) return;
    if (playing) { stopPlayback(); refreshControls(); return; }
    if (time >= project.duration - .05) time = 0;
    playbackStart = performance.now() - time * 1000; playing = true;
    const video = backgroundVideo();
    const soundTrack=activeSound(),soundPreviewElement=soundPreviewFor(soundTrack);
    const startMedia=element=>{
      try{return Promise.resolve(element.play());}
      catch(failure){return Promise.reject(failure);}
    };
    const starts=[];
    if(video){
      if(project.background.videoEdit)syncVideoEdit(video,project.background,time);else video.currentTime=time;
      video.muted=project.background.audioMuted===true;
      starts.push({kind:"video",promise:startMedia(video)});
    }
    if(soundTrack&&soundPreviewElement.src){
      syncSoundPreviewTime(time);
      starts.push({kind:"sound",promise:startMedia(soundPreviewElement)});
    }else if(soundTrack&&q("sound-error")){
      q("sound-error").textContent="The selected sound is not ready yet. Tap Play again when it finishes loading.";
    }
    const results=await Promise.all(starts.map(async start=>({kind:start.kind,result:await start.promise.then(()=>null,failure=>failure)})));
    const videoFailure=results.find(result=>result.kind==="video"&&result.result)?.result;
    const soundFailure=results.find(result=>result.kind==="sound"&&result.result)?.result;
    if(videoFailure){stopPlayback();error(videoFailure);}
    if(soundFailure&&q("sound-error"))q("sound-error").textContent=`${soundFailure.name||"PlaybackError"}: ${soundFailure.message||"Sound preview could not start."}`;
    refreshControls();
  };
  q("publish").onclick = async audioSessionFromGesture => {
    if (busy || live) return;
    const videoAudioSession = audioSessionFromGesture?.context
      ? audioSessionFromGesture
      : projectOutputKind(project, assets) === "video"
        ? createVideoAudioSession(creativeAudioContextFor(backgroundVideo())) : null;
    inline.finish();
    pages.flush();
    const destination = q("destination").value;
    clearAudioWarnings();
    busy = true; stopPlayback(); refreshControls(); error(""); status("Saving your layers and media…");
    try {
      if(onSave){
        validateProjectSources(project);
        await onSave({project,blobs,ownerId,active:()=>!closed&&api.me()?.id===ownerId,caption:q("caption").value,
          preview:async()=>{
            await document.fonts.ready;
            // Blast's fallback media must not bake revocable source comments into pixels.
            const scene=structuredClone(project);scene.layers=scene.layers.filter(item=>item.kind!=="comment");
            const animated=projectOutputKind(scene,assets)==="video";
            return animated?exportCreativeVideo({canvas,video:backgroundVideo(),sourceBlob:blobs.get(scene.background.media),background:scene.background,duration:scene.duration,render:(at,targetCanvas=canvas)=>drawProject(targetCanvas,scene,assets,resolveCommentSource,at),alive:()=>!closed,audioSession:videoAudioSession,audioTracks:await exportAudioTracks(scene),
              onProgress:fraction=>!closed&&status(`Rendering video · ${Math.round(fraction*100)}%`)})
              :(drawProject(canvas,scene,assets,resolveCommentSource,time),canvasBlob(canvas));
          }});
        close(true);return;
      }
      if (api.authMode() !== "cloud") {
        throw new Error("Reconnect your online account before publishing. Nothing was saved on this device.");
      }
      if (["story", "post", "community"].includes(destination)) {
        validateProjectSources(project);
        if (destination !== "story") validateProjectAudience(project, q("visibility").value);
        if (api.me()?.id !== ownerId || closed) throw new Error("This editing session has ended.");
        await document.fonts.ready;
        const storyProject = structuredClone(project);
        const outputKind=projectOutputKind(storyProject,assets);
        const hasAddedSound=storyProject.audioTracks?.some(track=>track?.media);
        const original = !hasAddedSound ? matchingOriginal(originalPublicationMedia(storyProject, blobs, assets.get(storyProject.background.media)),outputKind) : null;
        const scenes = projectScenes(storyProject);
        const carousel = destination !== "story" && outputKind==="photo" && scenes.length > 1 && scenes.length <= 10 &&
          scenes.every(scene => scene.background.kind==="photo" && scene.background.media);
        const animated = outputKind==="video";
        const rendered = [];
        if (carousel) {
          for (const scene of scenes) {
            drawProject(canvas, scene, assets, resolveCommentSource, 0);
            rendered.push(await canvasBlob(canvas));
          }
        }
        const mediaBlob = original || (carousel ? rendered[0] : animated
          ? await exportCreativeVideo({
              canvas, video: backgroundVideo(), background: storyProject.background,
              duration: storyProject.duration,
              render: (at,targetCanvas=canvas) => drawProject(targetCanvas, storyProject, assets, resolveCommentSource, at),
              alive: () => !closed && api.me()?.id === ownerId,
              sourceBlob: blobs.get(storyProject.background.media),
              audioSession: videoAudioSession,
              audioTracks: await exportAudioTracks(storyProject),
              onWarning: warnAudio,
              onProgress: fraction => !closed && status(`Preparing video · ${Math.round(fraction*100)}%`),
            })
          : (drawProject(canvas, storyProject, assets, resolveCommentSource, 0), await canvasBlob(canvas)));
        if (!mediaBlob.size) throw new Error("The rendered Story is empty.");
        if (api.me()?.id !== ownerId || closed) throw new Error("This editing session has ended.");
        validateProjectSources(project);
        if (destination !== "story") validateProjectAudience(project, q("visibility").value);
        status(destination === "story" ? "Preparing Story upload…" : "Preparing post upload…");
        const shareToOtherFeed = destination !== "story" && q("other-feed").checked;
        const postDestination = destination === "community"
          ? (shareToOtherFeed ? "both" : "community")
          : (shareToOtherFeed ? "both" : "main");
         const videoLimitMessage = publicFeedVideoLimitMessage({
           visibility: q("visibility").value,
           destination: postDestination,
           kind: outputKind,
           durationSeconds: storyProject.duration,
           size: mediaBlob.size,
         });
         if (videoLimitMessage) throw new Error(videoLimitMessage);
        const item = destination === "story" ? await api.createCloudStory({
          text: q("caption").value,
          visibility: q("visibility").value,
          mediaBlob,
          audioSession: videoAudioSession,
          onUploadProgress: (fraction, phase) => !closed && status(
            phase === "original-preserved" ? "Keeping the original video to preserve its sound…"
              : phase === "preparing" ? "Preparing video…"
              : phase === "optimizing" ? "Preparing photo…"
                : phase === "compressing" ? `Preparing video · ${Math.round(fraction * 100)}%`
                  : `Uploading Story · ${Math.round(fraction * 100)}%`,
          ),
        }) : await publishRenderedPost({
          blobs: carousel ? rendered : [mediaBlob],
          upload: (blob, onProgress, uploadOptions = {}) => {
            const videoUpload = String(blob.type || "").toLowerCase().startsWith("video/");
            const reportMediaProgress = (fraction, phase, details) => {
              if (phase === "stage") {
                if (!closed) status(details?.label || "Preparing media…");
              } else if (phase === "preparing") {
                if (!closed) status(videoUpload ? "Preparing video…" : "Preparing photo…");
              } else if (phase === "optimizing") {
                if (!closed) status("Preparing photo…");
              } else if (phase === "original-preserved") {
                if (!closed) status("Keeping the original video to preserve its sound…");
              } else if (phase === "compressing") {
                if (!closed) status(`${videoUpload ? "Preparing video" : "Preparing photo"} · ${Math.round(fraction * 100)}%`);
              } else if (phase === "uploading" && fraction >= 1) {
                if (!closed) status(videoUpload ? "Verifying uploaded video…" : "Verifying uploaded photo…");
              } else if (phase === "complete") {
                if (!closed) status(videoUpload ? "Video upload verified…" : "Photo upload verified…");
              } else {
                onProgress?.(fraction);
              }
            };
            reportMediaProgress.reportMediaStages = true;
            return putLocalMedia(blob, undefined, reportMediaProgress, { audioSession: videoAudioSession, ...uploadOptions });
          },
          onProgress: ({ fraction, index, total, stage }) => {
            if (closed) return;
            if (stage === "post-creation") status("Publishing post…");
            else status(`Uploading post${total > 1 ? ` · ${index + 1} of ${total}` : ""} · ${Math.round(fraction * 100)}%`);
          },
          createPost: (text, fields) => {
            publishPostIdempotencyKey ||= crypto.randomUUID();
            return api.createCloudPost(text, { ...fields, destination: postDestination },
              {idempotencyKey:publishPostIdempotencyKey});
          },
          text: q("caption").value,
          visibility: q("visibility").value,
          place: storyProject.place || null,
          audioSourcePostId: activeSound()?.sourcePostId || null,
          audioSourceSoundId: activeSound()?.sourceSoundId || null,
          audioTitle: activeSound()?.title || "Original audio",
          audioReuseAllowed: storyProject.background?.kind === "video" &&
            storyProject.background.audioMuted !== true &&
            !audioWarnings.some(warning => warning.stage === "original-audio-decode") &&
            !activeSound()?.sourcePostId && !activeSound()?.sourceSoundId &&
            q("sound-rights-confirm")?.checked === true,
          audioRightsConfirmed: !activeSound()?.sourcePostId && !activeSound()?.sourceSoundId && q("sound-rights-confirm")?.checked === true,
          active: () => !closed && api.me()?.id === ownerId,
        });
        close(true);
        const story = destination === "story";
        toast(audioWarnings.length
          ? `${story ? "Story uploaded" : "Posted"}. The original sound couldn’t be included.`
          : story ? "Story uploaded" : "Posted");
        onPosted?.(item?.id, story, !story && destination === "community");
        return;
      }
      const item = await publishCreativeProject(project, blobs, { destination, visibility: q("visibility").value,
        quote: editor.classList.contains("is-quote"),
        caption: q("caption").value, location:q("location").value, ownerId, active: () => !closed });
      const story = q("destination").value === "story"; close(true); toast(story ? "Added to your story" : "Posted"); onPosted?.(item.id, story, !story && (openedInCommunity || destination === "community"));
    } catch (failure) {
      if (failure.publishedId) {
        close(true);toast(failure.message);onPosted?.(failure.publishedId,true,false);return;
      }
      if (!closed) { busy = false; error(failure); status("Your edit is still here. Nothing was published."); refreshControls(); }
    } finally {
      await videoAudioSession?.close?.();
    }
  };
  q("export").onclick = async () => {
    if (busy || live) return;
    const audioSession = projectOutputKind(project,assets)==="video"
      ? createVideoAudioSession(creativeAudioContextFor(backgroundVideo())) : null;
    inline.finish();
    clearAudioWarnings();
    busy = true; stopPlayback(); refreshControls(); error(""); status("Rendering your preview…");
    try {
      validateProjectSources(project); await document.fonts.ready;
      const animated = projectOutputKind(project,assets)==="video";
      const blob = animated ? await exportCreativeVideo({ canvas, video: backgroundVideo(),sourceBlob:blobs.get(project.background.media),background:project.background, duration: project.duration, watermark:true, render: (at,targetCanvas=canvas) => drawProject(targetCanvas, project, assets, resolveCommentSource, at),
        alive: () => { if (closed) return false; try { validateProjectSources(project); return true; } catch { return false; } },audioSession,audioTracks:await exportAudioTracks(project),
        onWarning:warnAudio,onProgress:fraction=>!closed&&status(`Rendering video · ${Math.round(fraction*100)}%`) }) : (drawProject(canvas, project, assets, resolveCommentSource, time), await canvasBlob(canvas));
      if (closed) return;
      const link = document.createElement("a"), url = URL.createObjectURL(blob);
      link.href = url; link.download = `old-time-remix.${blob.type.includes("mp4") ? "mp4" : blob.type.startsWith("video/") ? "webm" : "png"}`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      status("Preview downloaded. Shared remixes keep editable layers and source links.");
    } catch (failure) { if (!closed) error(failure); }
    finally { await audioSession?.close?.();busy = false; if (!closed) changed(); }
  };
  function tick(now) {
    raf=0;
    if (closed) return;
    if (recording) {
      time = Math.min(project.duration, (now - recordingStart) / 1000);
      const progress=captureRecordingState(now-recordingStart);
      const indicator=q("recording-indicator");
      if(indicator&&indicator.textContent!==progress.label)indicator.textContent=progress.label;
      q("shutter").style.setProperty("--cs-recording-progress",progress.progress);
      if (now - recordingStart >= MAX_CAPTURE_SECONDS*1000 && recording.state === "recording") recording.stop();
    } else if (playing) {
      time = Math.min(project.duration, (now - playbackStart) / 1000);
      syncVideoEdit(backgroundVideo(),project.background,time,true);
      if (time >= project.duration) stopPlayback();
    }
    if (!busy && (playing || recording || live) && !(live&&editor.classList.contains("is-create-v2"))) render(time);
    workspace?.tick(time); q("scrub").value = time; q("time").textContent = `${time.toFixed(1)} / ${project.duration.toFixed(1)}s`;
    if(playing||recording||live)raf = requestAnimationFrame(tick);
  }
  q("caption").value=caption;q("location").value=location;
  {const loc=q("location");loc.readOnly=true;loc.placeholder="Add place";
   const pick=()=>openPlacePicker({value:project.place||(loc.value?{id:"custom:existing",label:loc.value,source:"custom"}:null),toast,
     onSelect:p=>{project.place=p;loc.value=p.label;},onRemove:()=>{project.place=null;loc.value="";}});
   loc.onclick=pick;loc.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick();}};}
  q("destination").value=["post","community","story"].includes(destination)?destination:"post";
  const syncDestinationChoice = () => {
    const selected = q("destination").value;
    q("other-feed-label").textContent = selected === "community" ? "Also share to Main feed" : "Also share to Community";
    q("other-feed-field").hidden = selected === "story" || !!onSave;
    q("location").closest("label").hidden = selected === "story";
    if (selected === "story") q("other-feed").checked = false;
    syncShareDestinationButtons();
  };
  q("destination").addEventListener("change", syncDestinationChoice);
  syncDestinationChoice();
  if(onSave){q("publish").textContent=saveLabel;q("next-action").textContent=saveLabel;q("destination").closest("label").hidden=true;q("visibility").closest("label").hidden=true;}
  q("visibility").value = visibility || (api.me().private ? "friends" : "public");
  syncShareDestinationButtons();
  root.querySelectorAll("[data-ce-share-destination]").forEach(button => {
    button.onclick = () => {
      const choice = button.dataset.ceShareDestination;
      if (choice === "story") {
        q("destination").value = "story";
        q("visibility").value = api.me().private ? "friends" : "public";
      } else if (choice === "close-friends") {
        q("destination").value = "story";
        q("visibility").value = "close-friends";
      } else {
        q("destination").value = "post";
        if (!["friends", "public"].includes(q("visibility").value)) {
          q("visibility").value = api.me().private ? "friends" : "public";
        }
      }
      syncDestinationChoice();
      changed();
    };
  });
  root.querySelectorAll("[data-ce-feed-visibility]").forEach(button => {
    button.onclick = () => {
      if (q("destination").value === "story") q("destination").value = "post";
      q("visibility").value = button.dataset.ceFeedVisibility;
      syncDestinationChoice();
      changed();
    };
  });
  syncShareDestinationButtons();
  if (source && !api.canSeePost(api.post(source.postId), null)) {
    q("visibility").value = api.post(source.postId).visibility === "close-friends" ? "close-friends" : "friends";
    status("The original is restricted. Your remix must use an audience that can view it.");
  }
  if(onSave){
    q("save-hint").textContent="Returns your edit to its original composer without sharing.";
    q("exit-description").textContent="Your edit will be returned to the original composer, or you can discard it. Nothing will be shared.";
  }
  if(editor.classList.contains("is-create-v2")&&!onSave&&q("details")){
    const doPublish=q("publish").onclick,me=api.me();
    const fields=q("details-fields"),captionLabel=q("caption").closest("label");
    fields.append(captionLabel);
    const place=q("location").closest("label");fields.append(place);
    const defaultFeedVisibility=me.private?"connections":"public";
    const defaultStoryVisibility=me.private?"followers":"public";
    let feedVisibility=["public","connections","close-friends"].includes(visibility)?visibility:defaultFeedVisibility;
    let storyVisibility=["public","followers","friends","close-friends"].includes(visibility)?visibility:defaultStoryVisibility;
    q("visibility").value=q("destination").value==="story"?storyVisibility:feedVisibility;
    const setDetailsInert=open=>{
      for(const child of q("details").parentElement.children)if(child!==q("details"))child.inert=open;
    };
    const syncAudience=()=>{
      const active=q("destination").value==="story"?"story":"post",cur=q("visibility").value;
      q("feed-audience").hidden=active!=="post";
      q("story-audience").hidden=active!=="story";
      q("details").dataset.ceKind=active;
      q("details-title").textContent=active==="story"?"Share to Story":"New post";
      q("caption").placeholder=active==="story"?"Add a caption":"Write a caption";
      place.hidden=active==="story";
      root.querySelectorAll("[data-ce-destination]").forEach(button=>
        button.setAttribute("aria-pressed",String(button.dataset.ceDestination===active||button.dataset.ceDestination==="post"&&active==="post")));
      root.querySelectorAll("[data-ce-audience]").forEach(button=>{
        const group=button.closest("[data-ce-audience-group]"),visible=group?.dataset.ceAudienceGroup===active;
        const value=button.dataset.ceAudience;
        button.setAttribute("aria-pressed",String(visible&&(value==="story"?cur!=="close-friends":value===cur)));
      });
      syncSoundRights();
    };
    root.querySelectorAll("[data-ce-destination]").forEach(button=>button.onclick=()=>{
      if(busy)return;
      if(q("destination").value==="story")storyVisibility=q("visibility").value;
      else feedVisibility=q("visibility").value;
      const next=button.dataset.ceDestination==="story"?"story":"post";
      q("destination").value=next;
      q("visibility").value=next==="story"?storyVisibility:feedVisibility;
      syncDestinationChoice();syncAudience();error("");status("");
    });
    root.querySelectorAll("[data-ce-audience]").forEach(button=>button.onclick=()=>{
      if(busy)return;
      const v=button.dataset.ceAudience;
      const active=q("destination").value==="story"?"story":"post";
      if(active==="story")storyVisibility=v==="story"?defaultStoryVisibility:v;
      else feedVisibility=v;
      q("visibility").value=active==="story"?storyVisibility:feedVisibility;
      error("");q("details-publish").textContent="Publish";syncAudience();
    });
    q("publish").onclick=()=>{
      if(busy||q("publish").disabled)return;
      inline.finish();pages.flush();detailsOpen=true;q("details").hidden=false;editor.classList.add("is-details");
      setDetailsInert(true);
      syncDestinationChoice();syncAudience();
      q("details-publish").textContent="Publish";error("");status("");
      q("details-back").focus({preventScroll:true});
    };
    closeDetails=()=>{detailsOpen=false;q("details").hidden=true;editor.classList.remove("is-details");setDetailsInert(false);q("next-action").focus({preventScroll:true});};
    q("details-back").onclick=()=>{if(!busy)closeDetails();};
    q("details-publish").onclick=()=>{
      if(busy)return;
      const audioSession = projectOutputKind(project, assets) === "video"
        ? createVideoAudioSession(creativeAudioContextFor(backgroundVideo())) : null;
      error("");void doPublish(audioSession);
    };
    q("share-toggle").addEventListener("click",event=>{
      event.preventDefault();event.stopImmediatePropagation();q("publish").click();
    },true);
    syncDestinationChoice();syncAudience();
  }
  const textBar=bindTextBar({root,editor,q,layer,duplicate:()=>{
    inline.finish();q("duplicate").click();if(layer()?.kind==="text")inline.edit(layer());
  },remove,record:()=>history.record(),changed});
  textBar.refresh();changed(); void loadSources(); raf = requestAnimationFrame(tick); q("close").focus();
  if (startShare) q("share-toggle").click();
  void (async()=>{
    if(closed)return;
    if(initialProject){
      await Promise.all([project,...project.pages||[]].flatMap(scene=>[
        scene.background.media?assets.load(scene.background.media,scene.background.kind==="video"?"video":"image"):null,
        ...scene.layers.filter(item=>item.kind==="image").map(item=>assets.load(item.media))
      ]).filter(Boolean)).catch(error);
      if(!closed){
        pages.reset();changed();
        const audioCameraStart=startCamera&&initialProject.audioTracks?.length&&
          !initialProject.background?.media&&!initialProject.layers?.length;
        if(audioCameraStart)void camera();
      }
    }else{
      if(shouldAutoStartCamera({
        startCamera,
        hasSource: !!source,
        hasInitialProject: !!initialProject,
        hasBackground: !!background?.media,
        hasSaveHandler: !!onSave,
        preferMediaPicker: mediaPicker
      }))void camera();
      if(background?.media)await setBackground(background.media,background.kind,{ adoptFrame: !initialProject }).catch(error);
      if(startText && !source && !background?.media && !closed) {
        const item = add(createLayer("text", {text:"",color:"#17191d"}));
        inline.edit(item);
      }
    }
  })();
  return { project, close };
}
