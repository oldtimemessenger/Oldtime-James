import {videoPoint} from "./creative-video-edit.js";
import {fitVideoTo1080p} from "./video-geometry.js";
import {measureSourceFrameRate, videoEncodingProfile, videoMimeType} from "./video-compression.js";
import {exportAudioPlan, readVideoAudioPresence} from "./video-audio-policy.js";
import {readyAudioContext, loadAudioBuffer, audioStep} from "./audio-render-support.js";
import {drawOldtimeWatermark} from "./video-watermark.js";

const graphs = new WeakMap();
export function creativeAudioContextFor(video) {
  const context = video ? graphs.get(video)?.context : null;
  return context?.state === "closed" ? null : context || null;
}
export function releaseCreativeAudio(video) {
  const graph = graphs.get(video);
  if (graph) {
    try { graph.source.disconnect(); } catch {}
    void graph.context.close().catch(() => {});
    graphs.delete(video);
  }
}
export function videoMime() {
  if (!globalThis.MediaRecorder) throw new Error("Video recording is unavailable in this browser.");
  const type = videoMimeType();
  if (!type) throw new Error("Video export is unavailable in this browser.");
  return type;
}
export function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Couldn’t render the image.")), "image/png"); }
    catch { reject(new Error("This media cannot be exported. Upload an original file instead.")); }
  });
}
function withTimeout(promise, timeoutMs, message) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}
function resolveTimeout(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(5, Math.min(240_000, parsed)) : fallback;
}
export async function exportCreativeVideo({
  canvas, video, background = {}, duration, render:renderFrame, alive, audioTracks = [], audioSession = null, sourceBlob = null, onProgress, onWarning, timeouts = {}, watermark = false,
}) {
  const render=(time,target=canvas)=>{
    renderFrame(time,target);
    if(watermark)drawOldtimeWatermark(target);
  };
  const exportDuration = Number(duration);
  if (!Number.isFinite(exportDuration) || exportDuration <= 0) {
    throw new Error("The video duration could not be read. Your edit is still here.");
  }
  const stepTimeoutMs = resolveTimeout(timeouts.stepMs, 10_000);
  const recordingTimeoutMs = resolveTimeout(
    timeouts.recordingMs,
    Math.min(240_000, Math.max(45_000, exportDuration * 3_000 + 15_000)),
  );
  const mimeType = videoMime();
  const frameRate = video ? (await measureSourceFrameRate(video)).frameRate : 30;
  const exportSize = fitVideoTo1080p(canvas.width, canvas.height);
  const profile = videoEncodingProfile(exportSize.width, exportSize.height, frameRate);
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = exportSize.width;
  exportCanvas.height = exportSize.height;
  let audioContext, output, recorder, timer, source, destination, ownsAudioContext = false;
  const connected = [];
  const audioConnections = [], audioElements = [];
  const audioPlan = exportAudioPlan({video, background, audioTracks,
    sourceHasAudio: await readVideoAudioPresence(sourceBlob)});
  const tracksToMix = audioPlan.music;
  const oldTime = video?.currentTime || 0;
  const oldMuted = video?.muted,oldSpeed=video?.playbackRate||1;
  const seekVideo=target=>new Promise((resolve,reject)=>{
    if(Math.abs(video.currentTime-target)<.001&&!video.seeking&&video.readyState>=2){resolve();return;}
    let timer;
    const cleanup=()=>{clearTimeout(timer);video.removeEventListener("seeked",done);video.removeEventListener("error",failed);};
    const done=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(new Error("Couldn’t seek this video. Your edit is still here."));};
    video.addEventListener("seeked",done,{once:true});video.addEventListener("error",failed,{once:true});timer=setTimeout(failed,8000);video.currentTime=target;
  });
  try {
    if (typeof globalThis.VideoEncoder === "function" && typeof globalThis.VideoFrame === "function" &&
      (!audioPlan.needsAudio || (typeof globalThis.AudioEncoder === "function" && typeof globalThis.AudioDecoder === "function"))) {
      const controller = new AbortController();
      let progressTimer;
      try {
        // Keep the tap-started playback graph alive for editor preview/retry,
        // even though the actual encoding and audio mix run offline.
        if(video && audioSession?.context){
          let graph=graphs.get(video);
          if(audioPlan.original&&!graph){
            const context=audioSession.context;
            await readyAudioContext(context,audioSession,stepTimeoutMs);
            const original=await audioStep("original-source",context,()=>context.createMediaElementSource(video),stepTimeoutMs);
            graph={context,source:original};graphs.set(video,graph);
          }
          if(graph){
            if(graph.context===audioSession.context)audioSession.retainContext?.();
            graph.source.connect(graph.context.destination);
          }
        }
        const { exportCreativeTimeline } = await import("./creative-timeline-export.js");
        let rejectStall;
        const stalled=new Promise((_,reject)=>{rejectStall=reject;});
        const progress=fraction=>{
          clearTimeout(progressTimer);
          progressTimer=setTimeout(()=>{
            controller.abort();
            rejectStall(new Error("Video export stopped responding. Your edit is still here; try again."));
          },Math.max(30000,stepTimeoutMs*2));
          onProgress?.(fraction);
        };
        progress(0);
        return await Promise.race([exportCreativeTimeline({
          canvas: exportCanvas, video, background, duration: exportDuration, profile, render, seekVideo,
          sourceBlob, audioPlan, alive, signal: controller.signal, onProgress:progress, onWarning,
        }),stalled]);
      } finally { clearTimeout(progressTimer);controller.abort(); }
    }
    // Render once at the final storage size. This avoids an oversized export
    // followed by a second, expensive browser-side compression pass.
    if (typeof exportCanvas.captureStream !== "function") {
      const error = new Error("Video rendering is unavailable on this device. Your edit is still here.");
      error.publicationStage = "video-capture";
      throw error;
    }
    output = exportCanvas.captureStream(profile.frameRate);
    const frame=()=>output.getVideoTracks()[0]?.requestFrame?.();
    const existingGraph = video ? graphs.get(video) : null;
    if (!audioPlan.needsAudio) {
      audioContext = null;
    } else if (existingGraph) {
      audioContext = existingGraph.context;
    } else if (audioSession?.context) {
      audioContext = audioSession.context;
    } else if (audioPlan.needsAudio) {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) throw new Error("Sound export is unavailable in this browser.");
      audioContext = new AudioContextConstructor();
      ownsAudioContext = !video && !audioSession;
    }
    if (audioContext) {
      await readyAudioContext(audioContext, audioSession, stepTimeoutMs);
      destination = await audioStep("destination", audioContext, () => audioContext.createMediaStreamDestination(), stepTimeoutMs);
      if (audioPlan.original) {
        let graph = existingGraph;
        if (!graph) {
          source = await audioStep("original-source", audioContext, () => audioContext.createMediaElementSource(video), stepTimeoutMs);
          graph = { context: audioContext, source };
          graphs.set(video, graph);
        } else source = graph.source;
        source.connect(destination); connected.push(source);
        if (audioSession?.context === audioContext) audioSession.retainContext?.();
      }
      for (const track of tracksToMix) {
        const buffer = await loadAudioBuffer(audioContext, track.media, stepTimeoutMs);
        const gain = audioContext.createGain();
        gain.gain.value = Math.max(0, Math.min(1, Number.isFinite(Number(track.volume)) ? Number(track.volume) : .8));
        gain.connect(destination);
        audioConnections.push([gain, destination]);
        audioElements.push({ buffer, gain, track, source: null });
      }
      for (const track of destination.stream.getAudioTracks()) output.addTrack(track);
    }
    const stopMusic = () => {
      for (const item of audioElements) {
        try { item.source?.stop(); } catch {}
        try { item.source?.disconnect(); } catch {}
        item.source = null;
      }
    };
    const startMusic = time => {
      stopMusic();
      for (const item of audioElements) {
        const offset = Math.max(0, time + (Number(item.track.offset) || 0));
        if (item.track.loop === false && offset >= item.buffer.duration) continue;
        const input = audioContext.createBufferSource();
        input.buffer = item.buffer; input.loop = item.track.loop !== false;
        input.connect(item.gain); item.source = input;
        input.start(0, input.loop ? offset % item.buffer.duration : offset);
      }
    };
    const playVideo = async () => {
      // WebKit can pause playback when a muted element is unmuted outside a
      // gesture. Set the intended state before play; never hide a denial.
      video.muted = !audioPlan.original;
      await withTimeout(video.play(), stepTimeoutMs,
        "The video could not start exporting. Your edit is still here; try again.");
    };
    if (video) {
      const point=videoPoint(background,0);await seekVideo(point.sourceTime);video.playbackRate=point.speed;
      render(0,exportCanvas);frame();await playVideo();
    }
    render(0,exportCanvas);output.getVideoTracks()[0]?.requestFrame?.();
    const recording = new Promise((resolve, reject) => {
      const chunks = [];
      recorder = new MediaRecorder(output, {
        mimeType,
        videoBitsPerSecond: profile.videoBitsPerSecond,
        audioBitsPerSecond: profile.audioBitsPerSecond,
        videoBitrateMode: "variable",
      });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = event => reject(event.error || new Error("Video export failed. Your edit is still available."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
      const start = performance.now();let pausedTime=0,lastClip=video?videoPoint(background,0).id:null,updating=false,lastProgressAt=0;
      recorder.start(200);
      startMusic(0);
      output.getVideoTracks()[0]?.requestFrame?.();
      timer = setInterval(async () => {
        if(updating)return;updating=true;
        try{
        if (!alive()) { clearInterval(timer); if (recorder.state !== "inactive") recorder.stop(); reject(new Error("Export canceled.")); return; }
        const time = Math.min(exportDuration, (performance.now() - start-pausedTime) / 1000);
        if(video&&background.videoEdit){
          const point=videoPoint(background,time);
          if(point.id!==lastClip){
            const pauseStart=performance.now();recorder.pause();video.pause();await seekVideo(point.sourceTime);video.playbackRate=point.speed;
            stopMusic();
            render(time,exportCanvas);
            await playVideo();startMusic(time);
            pausedTime+=performance.now()-pauseStart;lastClip=point.id;recorder.resume();
          }
        }
        render(time,exportCanvas);output.getVideoTracks()[0]?.requestFrame?.();
        const progressNow=performance.now();
        if(progressNow-lastProgressAt>=400||time>=exportDuration){
          lastProgressAt=progressNow;
          onProgress?.(Math.min(1,time/exportDuration));
        }
        if (time >= exportDuration) { clearInterval(timer); recorder.stop(); }
        }catch(failure){clearInterval(timer);if(recorder.state!=="inactive")recorder.stop();reject(failure);}
        finally{updating=false;}
      }, 1000 / profile.frameRate);
    });
    const blob = await withTimeout(recording, recordingTimeoutMs,
      "Video export stopped responding. Your edit is still here; try again.");
    if (!blob.size) throw new Error("The export was empty.");
    if (audioPlan.needsAudio && !output.getAudioTracks().length) {
      throw new Error("The rendered video's audio track is missing. Your edit is still here; nothing was uploaded.");
    }
    onProgress?.(1);
    return blob;
  } finally {
    clearInterval(timer);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    for (const track of output?.getTracks() || []) track.stop();
    exportCanvas.width=0;exportCanvas.height=0;
    for (const node of new Set(connected)) {
      try { node.disconnect(destination); } catch {}
    }
    for (const [node, target] of audioConnections) {
      try { node.disconnect(target); } catch {}
    }
    for (const item of audioElements) {
      try { item.source?.stop(); } catch {}
      try { item.source?.disconnect(); } catch {}
    }
    if (video) { video.pause(); video.muted = oldMuted;video.playbackRate=oldSpeed; video.currentTime = oldTime; }
    if (ownsAudioContext && audioContext?.state !== "closed") {
      await withTimeout(audioContext.close(), Math.min(stepTimeoutMs, 3_000), "Audio cleanup timed out.")
        .catch(() => {});
    }
  }
}
