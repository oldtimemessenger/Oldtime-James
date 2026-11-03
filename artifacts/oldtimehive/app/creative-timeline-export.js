// Offline, timestamped encoding. Rendering speed must never become video time.
// Loaded only on export; the muxer/encoders are not part of initial navigation.
import { videoPoint } from "./creative-video-edit.js";

export function exportFramePlan(duration, frameRate) {
  const rate = Math.max(1, Math.min(60, Number(frameRate) || 30));
  const count = Math.ceil(duration * rate);
  return { rate, count, at: index => index / rate, length: index => Math.min(1 / rate, duration - index / rate) };
}

export function originalAudioSegments(background, duration) {
  const clips = background.videoEdit?.clips;
  if (!clips?.length) return [{ in: 0, out: duration, speed: 1, offset: 0 }];
  let offset = 0;
  return clips.map(clip => {
    const segment = { in: clip.in, out: clip.out, speed: clip.speed, offset };
    offset += (clip.out - clip.in) / clip.speed;
    return segment;
  });
}

async function mediaBlob(reference, signal) {
  if (reference instanceof Blob) return reference;
  const response = await fetch(reference, { signal });
  if (!response.ok) throw new Error("Couldn't load the audio for this edit. Your edit is still here.");
  return response.blob();
}

export function audioExportFailure(value, step) {
  const error = value instanceof Error ? value : new Error(String(value));
  error.publicationStage ||= step;
  error.audioDiagnostic = { ...error.audioDiagnostic, operation: error.publicationStage };
  return error;
}

function originalSoundWarning(failure, onWarning) {
  const error = audioExportFailure(failure, "original-audio-decode");
  onWarning?.({
    stage: "original-audio-decode", errorName: error.name, message: error.message,
    userMessage: "The original sound couldn’t be included. This export won’t include the original sound.",
  });
}

export async function mixTimelineAudio(m, { video, sourceBlob, background, duration, audioPlan, signal, check, onWarning }) {
  if (!audioPlan.needsAudio) return null;
  const Constructor = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  let context;
  try {
    if (!Constructor) throw new Error("Sound export isn't available in this browser.");
    context = new Constructor(2, Math.ceil(duration * 48000), 48000);
  } catch (failure) {
    check();
    if (audioPlan.music.length) throw audioExportFailure(failure, "music-decode");
    originalSoundWarning(failure, onWarning);
    return null;
  }
  let scheduled = false;
  if (audioPlan.original) {
    let input;
    const nodes = [];
    const abortInput=()=>input?.dispose();
    try {
      const blob = sourceBlob || await mediaBlob(video.currentSrc || video.src, signal);
      check();
      input = new m.Input({ source: new m.BlobSource(blob), formats: m.ALL_FORMATS });
      signal?.addEventListener("abort",abortInput,{once:true});
      const track = await input.getPrimaryAudioTrack();
      if (track) {
        const sink = new m.AudioBufferSink(track);
        const clips = originalAudioSegments(background, duration);
        // One decoder pass from zero, including discarded leading audio.
        // WebKit's Cocoa decoder can fail when restarted at nonzero in-points.
        // Route each decoded chunk to every intersecting timeline segment;
        // this also supports reordered and repeated source segments.
        for await (const sample of sink.buffers(0, Math.max(...clips.map(clip => clip.out)))) {
          check();
          for (const clip of clips) {
            const start = Math.max(clip.in, sample.timestamp);
            const end = Math.min(clip.out, sample.timestamp + sample.duration);
            if (end <= start) continue;
            const node = context.createBufferSource();
            nodes.push(node);
            node.buffer = sample.buffer;
            node.playbackRate.value = clip.speed;
            node.connect(context.destination);
            node.start(clip.offset + (start - clip.in) / clip.speed, start - sample.timestamp, end - start);
          }
        }
        if (!nodes.length) throw new Error("Original audio decoding returned no samples for this edit.");
        scheduled = true;
      }
    } catch (failure) {
      // Never retain a partially decoded original underneath the music.
      for (const node of nodes) {
        try { node.stop(); } catch {}
        node.disconnect();
      }
      check(); // Cancellation/account changes are not a silent-audio fallback.
      if (signal?.aborted) throw failure;
      originalSoundWarning(failure, onWarning);
    } finally { signal?.removeEventListener("abort",abortInput);input?.dispose(); }
  }
  for (const track of audioPlan.music) {
    check();
    let buffer;
    try {
      const blob = await mediaBlob(track.media, signal);
      buffer = await context.decodeAudioData(await blob.arrayBuffer());
    } catch (failure) {
      throw audioExportFailure(failure, "music-decode");
    }
    check();
    const offset = Math.max(0, Number(track.offset) || 0);
    if (track.loop === false && offset >= buffer.duration) continue;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    source.loop = track.loop !== false;
    gain.gain.value = Math.max(0, Math.min(1, Number.isFinite(Number(track.volume)) ? Number(track.volume) : .8));
    source.connect(gain); gain.connect(context.destination);
    source.start(0, source.loop ? offset % buffer.duration : offset);
    scheduled = true;
  }
  check();
  // A source without an audio track is legitimate; don't manufacture silence.
  return scheduled ? context.startRendering() : null;
}

export async function exportCreativeTimeline(options) {
  try { return await encodeCreativeTimeline(options); }
  catch (failure) { throw audioExportFailure(failure, "encode"); }
}

async function encodeCreativeTimeline({
  canvas, video, background, duration, profile, render, seekVideo, sourceBlob,
  audioPlan, alive, signal, onProgress, onWarning,
}) {
  const m = await import("mediabunny");
  const check = () => {
    if (!alive() || signal?.aborted) throw new Error("Export canceled. Your edit is still here.");
  };
  check();
  const options = { width: canvas.width, height: canvas.height, bitrate: profile.videoBitsPerSecond };
  video?.pause();
  const audioBuffer = await mixTimelineAudio(m, { video, sourceBlob, background, duration, audioPlan, signal, check, onWarning });
  let format, codec, audioCodec;
  for (const candidate of [new m.Mp4OutputFormat(), new m.WebMOutputFormat()]) {
    const videoCodec = await m.getFirstEncodableVideoCodec(candidate.getSupportedVideoCodecs(), options);
    if (!videoCodec) continue;
    const soundCodec = audioBuffer ? await m.getFirstEncodableAudioCodec(candidate.getSupportedAudioCodecs(), {
      numberOfChannels: audioBuffer.numberOfChannels, sampleRate: audioBuffer.sampleRate, bitrate: profile.audioBitsPerSecond,
    }) : null;
    if (audioBuffer && !soundCodec) continue;
    format = candidate; codec = videoCodec; audioCodec = soundCodec; break;
  }
  if (!codec) throw new Error("Video and sound encoding aren't available on this device. Your edit is still here.");
  const target = new m.BufferTarget(), output = new m.Output({ format, target });
  const frames = new m.CanvasSource(canvas, { codec, bitrate: profile.videoBitsPerSecond, keyFrameInterval: 2 });
  output.addVideoTrack(frames, { frameRate: profile.frameRate });
  const audio = audioBuffer ? new m.AudioBufferSource({ codec: audioCodec, bitrate: profile.audioBitsPerSecond }) : null;
  if (audio) output.addAudioTrack(audio);
  const abort=()=>{void output.cancel().catch(()=>{});};
  signal?.addEventListener("abort",abort,{once:true});
  let completed = false;
  try {
    await output.start();
    const plan = exportFramePlan(duration, profile.frameRate);
    for (let index = 0; index < plan.count; index++) {
      check();
      const at = plan.at(index);
      if (video) await seekVideo(videoPoint(background, at).sourceTime);
      check();
      render(at, canvas);
      await frames.add(at, plan.length(index));
      onProgress?.((index + 1) / plan.count * .95);
    }
    frames.close();
    if (audio) { check(); await audio.add(audioBuffer); audio.close(); }
    check();
    await output.finalize();
    check();
    if (!target.buffer?.byteLength) throw new Error("The video export was empty. Your edit is still here.");
    completed = true;
    onProgress?.(1);
    return new Blob([target.buffer], { type: format.mimeType });
  } finally {
    signal?.removeEventListener("abort",abort);
    if (!completed) await output.cancel().catch(() => {});
  }
}
