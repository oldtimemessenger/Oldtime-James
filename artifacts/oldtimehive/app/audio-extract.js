import { mediaUrl } from "./local-media.js";
import {readyAudioContext, loadAudioBuffer, audioStep} from "./audio-render-support.js";

async function captureBufferedExcerpt({media, seconds, offset, volume, loop, active, resolveMedia, session, Recorder}) {
  const context = session.context;
  let recorder, source, gain, analyser, destination, timer, watch;
  try {
    await readyAudioContext(context, session, 10_000);
    const buffer = await loadAudioBuffer(context, await resolveMedia(media), 20_000);
    destination = context.createMediaStreamDestination();
    gain = context.createGain();
    gain.gain.value = Math.max(0, Math.min(1, Number(volume) || 0));
    analyser = context.createAnalyser(); analyser.fftSize = 1024;
    source = context.createBufferSource(); source.buffer = buffer; source.loop = loop !== false;
    source.connect(gain); gain.connect(analyser); analyser.connect(destination);
    recorder = new Recorder(destination.stream, {mimeType: audioRecorderMimeType(Recorder), audioBitsPerSecond: 128_000});
    const chunks = [], samples = new Float32Array(analyser.fftSize);
    let audible = false;
    const result = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      recorder.onerror = event => reject(event.error || new Error("The sound excerpt could not be recorded."));
      recorder.onstop = () => {
        const blob = new Blob(chunks, {type: recorder.mimeType});
        if (!active()) reject(new Error("This editing session has ended."));
        else if (!audible || !blob.size) reject(new Error("No reusable audio was detected in the selected portion. Your edit is still here."));
        else resolve(blob);
      };
    });
    // Attach rejection handling before native recording callbacks can fire.
    result.catch(() => {});
    recorder.start(200);
    const start = Math.max(0, Number(offset) || 0);
    source.start(0, source.loop ? start % buffer.duration : Math.min(start, Math.max(0, buffer.duration - .05)));
    watch = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      if (samples.some(sample => Math.abs(sample) > .0001)) audible = true;
      if (!active() && recorder.state !== "inactive") recorder.stop();
    }, 50);
    timer = setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, seconds * 1000);
    return await audioStep("excerpt-recording", context, () => result, seconds * 1000 + 5_000);
  } finally {
    clearTimeout(timer); clearInterval(watch);
    if (recorder && recorder.state !== "inactive") { try { recorder.stop(); } catch {} }
    try { source?.stop(); } catch {}
    for (const node of [source, gain, analyser]) { try { node?.disconnect(); } catch {} }
    for (const track of destination?.stream.getTracks() || []) track.stop();
    // This is the editor's gesture-started context, not an excerpt-owned one.
  }
}

export function audioRecorderMimeType(Recorder = globalThis.MediaRecorder) {
  if (!Recorder) throw new Error("Audio recording is unavailable in this browser.");
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  const type = candidates.find(candidate => Recorder.isTypeSupported?.(candidate)) || "";
  if (!type) throw new Error("This browser cannot save an audio excerpt. Your edit is still here.");
  return type;
}

export function validateAudioExcerptDuration(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60 * 60) {
    throw new Error("The sound excerpt duration is invalid. Your edit is still here.");
  }
  return duration;
}

export async function mediaDuration(blob, createMediaElement = () => document.createElement("video")) {
  if (!(blob instanceof Blob) || !blob.size) throw new Error("The recorded video is unavailable.");
  const url = URL.createObjectURL(blob);
  const element = createMediaElement();
  try {
    element.preload = "metadata";
    element.src = url;
    const duration = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("The recorded video duration could not be read.")), 20_000);
      element.addEventListener("loadedmetadata", () => {
        clearTimeout(timeout);
        resolve(element.duration);
      }, { once: true });
      element.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("The recorded video duration could not be read."));
      }, { once: true });
      element.load();
    });
    return validateAudioExcerptDuration(duration);
  } finally {
    element.pause();
    element.removeAttribute("src");
    element.load?.();
    URL.revokeObjectURL(url);
  }
}

export async function captureAudioExcerpt({
  media, duration, offset = 0, volume = 1, loop = true, active = () => true,
  resolveMedia = mediaUrl, MediaRecorderClass = globalThis.MediaRecorder,
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  createMediaElement = () => document.createElement("video"),
  audioSession = null,
} = {}) {
  const seconds = validateAudioExcerptDuration(duration);
  if (!media || !active()) throw new Error("The selected sound is unavailable.");
  if (audioSession?.context) {
    return captureBufferedExcerpt({media, seconds, offset, volume, loop, active, resolveMedia,
      session: audioSession, Recorder: MediaRecorderClass});
  }
  if (!AudioContextClass) throw new Error("Audio extraction is unavailable in this browser. Your edit is still here.");
  const mimeType = audioRecorderMimeType(MediaRecorderClass);
  const element = createMediaElement();
  let context, recorder, timer, activeTimer, stream;
  const stop = () => {
    clearTimeout(timer);
    clearInterval(activeTimer);
    element.pause();
    element.removeAttribute("src");
    element.load?.();
    for (const track of stream?.getTracks?.() || []) track.stop();
    void context?.close?.().catch?.(() => {});
  };
  try {
    element.crossOrigin = "anonymous";
    element.preload = "auto";
    element.loop = loop !== false;
    element.src = await resolveMedia(media);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("The source sound took too long to load. Your edit is still here.")), 20_000);
      const done = () => { clearTimeout(timeout); resolve(); };
      element.addEventListener("loadedmetadata", done, { once: true });
      element.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("The source sound could not be loaded. Your edit is still here."));
      }, { once: true });
      element.load();
    });
    if (!Number.isFinite(element.duration) || element.duration <= 0) {
      throw new Error("This source has no readable audio duration. Your edit is still here.");
    }
    const start = Math.min(Math.max(0, Number(offset) || 0), Math.max(0, element.duration - 0.05));
    element.currentTime = start;
    await new Promise((resolve, reject) => {
      if (Math.abs(element.currentTime - start) < 0.02) return resolve();
      const timeout = setTimeout(() => reject(new Error("The selected audio portion could not be prepared.")), 10_000);
      element.addEventListener("seeked", () => { clearTimeout(timeout); resolve(); }, { once: true });
    });

    context = new AudioContextClass();
    await context.resume();
    const source = context.createMediaElementSource(element);
    const gain = context.createGain();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    gain.gain.value = Math.max(0, Math.min(1, Number(volume) || 0));
    source.connect(gain);
    gain.connect(analyser);
    const destination = context.createMediaStreamDestination();
    analyser.connect(destination);
    stream = destination.stream;
    recorder = new MediaRecorderClass(stream, { mimeType, audioBitsPerSecond: 128_000 });
    const chunks = [];
    let hasAudibleSignal = false;
    const samples = new Float32Array(analyser.fftSize);
    const result = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error("The sound excerpt could not be recorded. Your edit is still here."));
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
        if (!hasAudibleSignal || !blob.size) {
          reject(new Error("No reusable audio was detected in the selected portion. Your edit is still here."));
        } else resolve(blob);
      };
    });
    recorder.start(200);
    await element.play();
    const startedAt = Date.now();
    activeTimer = setInterval(() => {
      if (!active()) {
        recorder.stop();
        return;
      }
      analyser.getFloatTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) energy += sample * sample;
      if (Math.sqrt(energy / samples.length) > 0.0001) hasAudibleSignal = true;
      if (Date.now() - startedAt >= seconds * 1000) recorder.stop();
    }, 100);
    timer = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, seconds * 1000 + 1000);
    const blob = await result;
    if (!active()) throw new Error("This editing session has ended.");
    return blob;
  } catch (error) {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    throw error;
  } finally {
    stop();
  }
}
