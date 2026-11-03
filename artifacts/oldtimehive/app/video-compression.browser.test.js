import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import test from "node:test";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function findChromium() {
  const candidates = [process.env.CHROMIUM_PATH, "/repl/tools/bin/chromium", "/usr/bin/chromium",
    "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].filter(Boolean);
  const installed = candidates.find(path => existsSync(path));
  if (installed) return installed;
  for (const command of ["chromium", "chromium-browser", "google-chrome"]) {
    try { return execFileSync("which", [command], { encoding: "utf8" }).trim(); } catch {}
  }
  throw new Error("Chromium is required for the video compression browser test.");
}

function findFfmpeg() {
  try { return execFileSync("which", ["ffmpeg"], { encoding: "utf8" }).trim(); } catch { return ""; }
}

const ffmpegPath = findFfmpeg();
const ffprobePath = (() => {
  try { return execFileSync("which", ["ffprobe"], { encoding: "utf8" }).trim(); } catch { return ""; }
})();
test("video upload preserves 1080p60 motion and passes ordinary media through unchanged", {
  timeout: 180_000,
  skip: !ffmpegPath || !ffprobePath,
}, async () => {
  const originalPort = process.env.PORT;
  const originalBasePath = process.env.BASE_PATH;
  const fixtureDir = mkdtempSync(join(tmpdir(), "oldtime-video-"));
  const fixturePath = join(fixtureDir, "source.mp4");
  const ordinaryFixturePath = join(fixtureDir, "ordinary.mp4");
  const reencodeFixturePath = join(fixtureDir, "reencode.mp4");
  const overLimitFixturePath = join(fixtureDir, "over-limit.mp4");
  const optimizedPath = join(fixtureDir, "optimized-output");
  const reencodedPath = join(fixtureDir, "reencoded-output");
  const exportedPath = join(fixtureDir, "exported-output");
  const musicPath = join(fixtureDir, "music.wav");
  execFileSync(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "sine=frequency=660:duration=0.5:sample_rate=48000",
    "-f", "lavfi", "-i", "sine=frequency=880:duration=2:sample_rate=48000",
    "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[a]", "-map", "[a]",
    "-c:a", "pcm_s16le", musicPath,
  ]);
  execFileSync(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=60",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
    "-t", "1.3", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-b:v", "8M", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", fixturePath,
  ]);
  execFileSync(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=0x17324d:s=1280x720:r=30",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
    "-vf", "drawbox=x='mod(t*25,1200)':y=240:w=80:h=240:color=white:t=fill",
    "-t", "1.3", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-b:v", "2M", "-c:a", "aac", "-b:a", "96k",
    "-movflags", "+frag_keyframe+empty_moov+default_base_moof", ordinaryFixturePath,
  ]);
  execFileSync(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
    "-t", "1.3", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-b:v", "6M", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", reencodeFixturePath,
  ]);
  execFileSync(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=1",
    "-t", "130", "-an", "-c:v", "libx264", "-preset", "ultrafast",
    "-crf", "45", "-movflags", "+faststart", overLimitFixturePath,
  ]);
  process.env.PORT = "5173";
  process.env.BASE_PATH = "/";
  const server = await createServer({
    configFile: resolve(packageRoot, "vite.config.ts"),
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  let browser;
  try {
    await server.listen();
    const address = server.httpServer.address();
    assert.ok(address && typeof address === "object");
    browser = await chromium.launch({
      executablePath: findChromium(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
    });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/`);
    const output = await page.evaluate(async ({ encodedSource, encodedOrdinary, encodedReencode, encodedOverLimit, encodedMusic }) => {
      const { compressVideoTo720p, generateVideoThumbnail, createVideoAudioSession } = await import("/app/video-compression.js");
      const { readVideoAudioPresence } = await import("/app/video-audio-policy.js");
      const { exportCreativeVideo, releaseCreativeAudio, creativeAudioContextFor } = await import("/app/creative-export.js");
      const { publishRenderedPost } = await import("/app/media-publication.js");
      const musicBytes = Uint8Array.from(atob(encodedMusic), char => char.charCodeAt(0));
      const musicUrl = URL.createObjectURL(new Blob([musicBytes], {type:"audio/wav"}));
      const { compressImageForUpload } = await import("/app/image-compression.js");
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 1800;
      const context = canvas.getContext("2d");
      const pixels = context.createImageData(canvas.width, canvas.height);
      let seed = 17;
      for (let i = 0; i < pixels.data.length; i += 4) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        pixels.data[i] = seed >>> 24;
        pixels.data[i + 1] = (seed >>> 16) & 255;
        pixels.data[i + 2] = (seed >>> 8) & 255;
        pixels.data[i + 3] = 255;
      }
      context.putImageData(pixels, 0, 0);
      context.clearRect(0, 0, 160, 160);
      const photo = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      const optimizedPhoto = await compressImageForUpload(photo);
      const decodedPhoto = await createImageBitmap(optimizedPhoto);
      const pixel = document.createElement("canvas");
      pixel.width = pixel.height = 1;
      const pixelContext = pixel.getContext("2d");
      pixelContext.drawImage(decodedPhoto, 0, 0);
      const photoResult = {
        originalBytes: photo.size, optimizedBytes: optimizedPhoto.size, type: optimizedPhoto.type,
        width: decodedPhoto.width, height: decodedPhoto.height, alpha: pixelContext.getImageData(0, 0, 1, 1).data[3],
      };
      decodedPhoto.close();
      const nativeDecoder = globalThis.createImageBitmap;
      let fallbackBytes;
      try {
        globalThis.createImageBitmap = undefined;
        fallbackBytes = (await compressImageForUpload(photo)).size;
      } finally {
        globalThis.createImageBitmap = nativeDecoder;
      }
      const bytes = Uint8Array.from(atob(encodedSource), character => character.charCodeAt(0));
      const source = new Blob([bytes], { type: "video/mp4" });
      const ordinaryBytes = Uint8Array.from(atob(encodedOrdinary), character => character.charCodeAt(0));
      const ordinary = new Blob([ordinaryBytes], { type: "video/mp4" });
      const reencodeBytes = Uint8Array.from(atob(encodedReencode), character => character.charCodeAt(0));
      const reencodeSource = new Blob([reencodeBytes], { type: "video/mp4" });
      const nativePreparePlay = HTMLMediaElement.prototype.play;
      let blockedPreparationPlayAttempts = 0;
      let ordinaryResult;
      try {
        HTMLMediaElement.prototype.play = function(...args) {
          if (this.style?.position === "fixed") {
            blockedPreparationPlayAttempts++;
            return Promise.reject(new DOMException("User activation required for hidden video.", "NotAllowedError"));
          }
          return nativePreparePlay.apply(this, args);
        };
        ordinaryResult = await compressVideoTo720p(ordinary);
      } finally {
        HTMLMediaElement.prototype.play = nativePreparePlay;
      }
      const ordinaryHasAudio = await readVideoAudioPresence(ordinary);
      let maxHeartbeatGapMs = 0, heartbeatTicks = 0, lastHeartbeat = performance.now();
      const heartbeat = setInterval(() => {
        const now = performance.now();
        maxHeartbeatGapMs = Math.max(maxHeartbeatGapMs, now - lastHeartbeat);
        lastHeartbeat = now;
        heartbeatTicks++;
      }, 50);
      let optimized, reencoded;
      const audioSession = createVideoAudioSession();
      if (!audioSession) throw new Error("The browser could not create a user-activated audio session.");
      const nativeResume = AudioContext.prototype.resume;
      const nativePlay = HTMLMediaElement.prototype.play;
      const nativeMutedDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "muted");
      let blockedUnmutedPlayAttempts = 0;
      let simulatedSilentPauseCount = 0;
      let reencodePhase = "";
      try {
        await audioSession.ready;
        // A pre-activated context must not need a second resume after async
        // file loading, encoding, and upload preparation have begun.
        AudioContext.prototype.resume = () => Promise.reject(new Error("A late audio-context resume was blocked."));
        // Emulate Safari's autoplay policy for the hidden encoder video.
        HTMLMediaElement.prototype.play = function(...args) {
          if (this.style.position === "fixed" && !this.muted) {
            blockedUnmutedPlayAttempts++;
            return Promise.reject(new DOMException("Unmuted playback was blocked.", "NotAllowedError"));
          }
          return nativePlay.apply(this, args);
        };
        optimized = await compressVideoTo720p(source, { audioSession });
        // Emulate iOS Safari silently pausing hidden playback when audio is
        // restored after the muted play() handshake.
        const nativeFrameCallback = HTMLVideoElement.prototype.requestVideoFrameCallback;
        if (nativeMutedDescriptor?.configurable) {
          Object.defineProperty(HTMLMediaElement.prototype, "muted", {
            configurable: true,
            get() { return nativeMutedDescriptor.get.call(this); },
            set(value) {
              nativeMutedDescriptor.set.call(this, value);
              if (this.style?.position === "fixed" && value === false) {
                simulatedSilentPauseCount++;
                this.pause();
                this.currentTime = 0;
              }
            },
          });
        }
        if (nativeFrameCallback) {
          // Base the test sampler on media time so a busy headless runner does
          // not mistake its own scheduling delays for dropped source frames.
          HTMLVideoElement.prototype.requestVideoFrameCallback = function(callback) {
            return nativeFrameCallback.call(this, (timestamp, metadata) => {
              const mediaTime = Number(metadata?.mediaTime);
              callback(Number.isFinite(mediaTime) ? mediaTime * 1000 : timestamp, metadata);
            });
          };
        }
        try {
          reencoded = await compressVideoTo720p(reencodeSource, {
            audioSession,
            onProgress: (_fraction, phase) => { reencodePhase = phase; },
          });
        } finally {
          if (nativeFrameCallback) HTMLVideoElement.prototype.requestVideoFrameCallback = nativeFrameCallback;
          if (nativeMutedDescriptor?.configurable) {
            Object.defineProperty(HTMLMediaElement.prototype, "muted", nativeMutedDescriptor);
          }
        }
      } finally {
        AudioContext.prototype.resume = nativeResume;
        HTMLMediaElement.prototype.play = nativePlay;
        if (nativeMutedDescriptor?.configurable) {
          Object.defineProperty(HTMLMediaElement.prototype, "muted", nativeMutedDescriptor);
        }
        clearInterval(heartbeat);
        await audioSession.close();
      }
      const poster = await generateVideoThumbnail(optimized);
      const posterBitmap = await createImageBitmap(poster);
      const posterResult = { bytes: poster.size, type: poster.type, width: posterBitmap.width, height: posterBitmap.height };
      posterBitmap.close();
      const nativeToBlob = HTMLCanvasElement.prototype.toBlob;
      let safariFallbackPoster;
      try {
        HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
          // Safari falls back to PNG when WebP is requested but unavailable.
          return nativeToBlob.call(this, callback, type === "image/webp" ? "image/png" : type, quality);
        };
        const fallbackPoster = await generateVideoThumbnail(optimized);
        safariFallbackPoster = { type: fallbackPoster.type, bytes: fallbackPoster.size };
      } finally {
        HTMLCanvasElement.prototype.toBlob = nativeToBlob;
      }
      const exportUrl = URL.createObjectURL(source);
      const exportVideo = document.createElement("video");
      exportVideo.muted = true;
      exportVideo.playsInline = true;
      exportVideo.preload = "auto";
      const exportMetadata = new Promise((resolve, reject) => {
        exportVideo.addEventListener("loadedmetadata", resolve, { once: true });
        exportVideo.addEventListener("error", () => reject(new Error("Export test video could not be decoded.")), { once: true });
      });
      exportVideo.src = exportUrl;
      exportVideo.load();
      await exportMetadata;
      if (exportVideo.readyState < 2) {
        await new Promise((resolve, reject) => {
          exportVideo.addEventListener("loadeddata", resolve, { once: true });
          exportVideo.addEventListener("error", () => reject(new Error("Export test video frame could not be decoded.")), { once: true });
        });
      }
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = 1920;
      exportCanvas.height = 1080;
      let exportProgress = 0;
      let exported;
      let editedAudioEvidence;
      const exportAudioSession = createVideoAudioSession();
      await exportAudioSession.ready;
      const NativeAudioContext = window.AudioContext;
      let lateAudioContexts = 0;
      try {
        // Enforce the failed Safari handoff: once async work starts, a new
        // AudioContext is forbidden. Rendering must use the tap-started one.
        window.AudioContext = class LateAudioContext {
          constructor() {
            lateAudioContexts++;
            throw new DOMException("Late audio context creation blocked.", "NotAllowedError");
          }
        };
        const exportOptions = {
          canvas: exportCanvas,
          video: exportVideo,
          sourceBlob: source,
          audioTracks: [{media: musicUrl, offset: .25, volume: .8, loop: false}],
          duration: exportVideo.duration,
          render: (time, targetCanvas) => {
            const target = targetCanvas.getContext("2d");
            target.fillStyle = "#132a4a";
            target.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
            target.fillStyle = "#f43f5e";
            target.fillRect(time * 100, 0, 24, targetCanvas.height);
          },
          alive: () => true,
          onProgress: fraction => { exportProgress = Math.max(exportProgress, fraction); },
        };
        exported = await exportCreativeVideo({ ...exportOptions, audioSession: exportAudioSession });
        // This is the operation after rendering reaches 100%: use the same
        // session even while construction of any late context is forbidden.
        const transferred = [];
        const post = await publishRenderedPost({
          blobs: [exported], audioSourcePostId: "fixture-source",
          active: () => true,
          upload: async blob => { transferred.push(blob); return `oldtime-media:${crypto.randomUUID()}`; },
          createPost: async (_text, fields) => ({id:"fixture-confirmed-post", ...fields}),
        });
        if (post.mediaIds.length !== 1 || post.audioMediaId !== null || post.audioSourcePostId !== "fixture-source" ||
            transferred.length !== 1 || transferred[0] !== exported) {
          throw new Error("Added-music publication must upload the mixed video once and keep source attribution.");
        }
        await exportAudioSession.close();
        const retainedContext = creativeAudioContextFor(exportVideo);
        if (retainedContext !== exportAudioSession.context || retainedContext.state !== "running") {
          throw new Error("Publish cleanup closed the editor audio context needed for retry.");
        }
        const retryAudioSession = createVideoAudioSession(retainedContext);
        try {
          await retryAudioSession.ready;
          const retry = await exportCreativeVideo({ ...exportOptions, audioSession: retryAudioSession });
          if (!retry.size) throw new Error("A second export on the same video was empty.");
        } finally {
          await retryAudioSession.close();
        }
        const { mixTimelineAudio } = await import("/app/creative-timeline-export.js");
        const bunny = await import("/node_modules/.vite/deps/mediabunny.js");
        const strength = (buffer, frequency, start, end) => {
          const samples = buffer.getChannelData(0), rate = buffer.sampleRate;
          const first = Math.floor(start * rate), last = Math.floor(end * rate);
          let real = 0, imaginary = 0;
          for (let i = first; i < last; i++) {
            const angle = 2 * Math.PI * frequency * i / rate;
            real += samples[i] * Math.cos(angle); imaginary += samples[i] * Math.sin(angle);
          }
          return Math.hypot(real, imaginary) * 2 / (last - first);
        };
        const mixOptions = {
          video: exportVideo, sourceBlob: source, duration: 1.3,
          background: { videoEdit: { clips: [
            { in: .6, out: 1.2, speed: 2 }, { in: 0, out: .5, speed: .5 },
          ] } },
          audioPlan: { original: true, needsAudio: true, music: [] },
          check() {}, onWarning() { throw new Error("Valid edited audio must not fall back."); },
        };
        const edited = await mixTimelineAudio(bunny, mixOptions);
        const warnings = [];
        const failingDecoder = { ...bunny, AudioBufferSink: class {
          async *buffers() { throw new DOMException("Simulated Cocoa decode failure", "EncodingError"); }
        } };
        const musicBlob = await (await fetch(musicUrl)).blob();
        const fallback = await mixTimelineAudio(failingDecoder, {
          ...mixOptions, audioPlan: { original: true, needsAudio: true,
            music: [{ media: musicBlob, offset: .25, loop: false, volume: .8 }] },
          onWarning: warning => warnings.push(warning),
        });
        editedAudioEvidence = {
          fastOriginal: strength(edited, 880, .04, .2),
          slowOriginal: strength(edited, 220, .5, .8),
          keptMusic: strength(fallback, 880, .5, .8),
          omittedOriginal: strength(fallback, 440, .5, .8),
          warningStage: warnings[0]?.stage, warningCount: warnings.length,
        };
        if (lateAudioContexts) throw new Error("Video export constructed an audio context after the tap.");
      } finally {
        window.AudioContext = NativeAudioContext;
        await exportAudioSession.close();
        releaseCreativeAudio(exportVideo);
        exportVideo.pause();
        exportVideo.removeAttribute("src");
        exportVideo.load();
        URL.revokeObjectURL(exportUrl);
        URL.revokeObjectURL(musicUrl);
      }
      // Creative export already renders at the selected storage profile; the
      // real publisher uploads this final Blob directly rather than encoding
      // it a second time.
      const exportedUploadCandidate = exported;
      const exportOutputUrl = URL.createObjectURL(exportedUploadCandidate);
      const exportPreview = document.createElement("video");
      const exportOutputMetadata = new Promise((resolve, reject) => {
        exportPreview.addEventListener("loadedmetadata", resolve, { once: true });
        exportPreview.addEventListener("error", () => reject(new Error("Exported video could not be decoded.")), { once: true });
      });
      exportPreview.src = exportOutputUrl;
      await exportOutputMetadata;
      const exportDimensions = { width: exportPreview.videoWidth, height: exportPreview.videoHeight };
      URL.revokeObjectURL(exportOutputUrl);
      exportPreview.remove();
      const overLimitBytes = Uint8Array.from(atob(encodedOverLimit), character => character.charCodeAt(0));
      let overLimitMessage = "";
      try {
        await compressVideoTo720p(new Blob([overLimitBytes], { type: "video/mp4" }));
      } catch (error) {
        overLimitMessage = error instanceof Error ? error.message : String(error);
      }
      const optimizedBytes = new Uint8Array(await optimized.arrayBuffer());
      let binary = "";
      for (let i = 0; i < optimizedBytes.length; i += 0x8000) {
        binary += String.fromCharCode(...optimizedBytes.subarray(i, i + 0x8000));
      }
      const exportedBytes = new Uint8Array(await exportedUploadCandidate.arrayBuffer());
      let exportedBinary = "";
      for (let i = 0; i < exportedBytes.length; i += 0x8000) {
        exportedBinary += String.fromCharCode(...exportedBytes.subarray(i, i + 0x8000));
      }
      const reencodedBytes = new Uint8Array(await reencoded.arrayBuffer());
      let reencodedBinary = "";
      for (let i = 0; i < reencodedBytes.length; i += 0x8000) {
        reencodedBinary += String.fromCharCode(...reencodedBytes.subarray(i, i + 0x8000));
      }
      const url = URL.createObjectURL(optimized);
      const preview = document.createElement("video");
      const metadata = new Promise((resolve, reject) => {
        preview.onloadedmetadata = () => resolve({ width: preview.videoWidth, height: preview.videoHeight });
        preview.onerror = () => reject(new Error("Optimized output could not be decoded."));
      });
      preview.src = url;
      const dimensions = await metadata;
      URL.revokeObjectURL(url);
      return {
        editedAudioEvidence,
        sourceSize: source.size,
        outputSize: optimized.size,
        outputType: optimized.type,
        optimizedIsOriginal: optimized === source,
        ordinaryPassedThrough: ordinaryResult === ordinary,
        ordinaryHasAudio,
        blockedPreparationPlayAttempts,
        ordinarySourceSize: ordinary.size,
        ordinaryResultSize: ordinaryResult.size,
        maxHeartbeatGapMs,
        heartbeatTicks,
        blockedUnmutedPlayAttempts,
        poster: posterResult,
        safariFallbackPoster,
        encodedOptimized: btoa(binary),
        encodedReencoded: btoa(reencodedBinary),
        reencodedIsOriginal: reencoded === reencodeSource,
        reencodePhase,
        simulatedSilentPauseCount,
        reencodeSourceSize: reencodeSource.size,
        reencodedSize: reencoded.size,
        encodedExported: btoa(exportedBinary),
        exportedType: exported.type,
        exportedBytes: exported.size,
        exportedUsedDirectlyForPublication: exportedUploadCandidate === exported,
        exportProgress,
        exportDimensions,
        overLimitMessage,
        photo: photoResult, fallbackPhotoBytes: fallbackBytes,
        ...dimensions,
      };
    }, {
      encodedSource: readFileSync(fixturePath).toString("base64"),
      encodedOrdinary: readFileSync(ordinaryFixturePath).toString("base64"),
      encodedReencode: readFileSync(reencodeFixturePath).toString("base64"),
      encodedOverLimit: readFileSync(overLimitFixturePath).toString("base64"),
      encodedMusic: readFileSync(musicPath).toString("base64"),
    });
    assert.ok(output.sourceSize > 0);
    assert.ok(output.outputSize > 0);
    assert.equal(output.reencodedIsOriginal, true, "a stalled device must publish only the complete verified source, never a partial recording");
    assert.equal(output.reencodedSize, output.reencodeSourceSize);
    assert.equal(output.reencodePhase, "original-preserved");
    assert.ok(output.simulatedSilentPauseCount >= 1);
    if (output.optimizedIsOriginal) {
      assert.equal(output.outputSize, output.sourceSize, "an unverified browser encode must preserve the playable source unchanged");
    }
    assert.match(output.outputType, /^video\/(mp4|webm)$/);
    assert.ok(output.heartbeatTicks >= 2);
    assert.ok(output.maxHeartbeatGapMs < 1000, `video work blocked the browser event loop for ${output.maxHeartbeatGapMs}ms`);
    assert.equal(output.blockedUnmutedPlayAttempts, 0, "encoder playback must start muted for Safari");
    assert.equal(output.ordinaryPassedThrough, true);
    assert.equal(output.ordinaryHasAudio, true, "the media fixture must include the editor's audio track");
    assert.equal(output.blockedPreparationPlayAttempts, 0, "verified media that needs no encode must not require hidden playback");
    assert.equal(output.ordinaryResultSize, output.ordinarySourceSize);
    assert.match(output.exportedType, /^video\/(mp4|webm)(;|$)/);
    assert.doesNotMatch(output.exportedType, /^video\/mp4;codecs=vp[89],opus$/i,
      "the selected codec must match its output container");
    assert.ok(output.exportedBytes > 0);
    assert.equal(output.exportedUsedDirectlyForPublication, true);
    assert.equal(output.exportProgress, 1);
    assert.ok(output.exportDimensions.width <= 1920 && output.exportDimensions.height <= 1080);
    writeFileSync(optimizedPath, Buffer.from(output.encodedOptimized, "base64"));
    execFileSync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-i", optimizedPath, "-map", "0:a:0", "-f", "null", "-"]);
    const probe = path => JSON.parse(execFileSync(ffprobePath, [
      "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,avg_frame_rate",
      "-of", "json", path,
    ], { encoding: "utf8" })).streams;
    const sourceStream = probe(fixturePath).find(stream => stream.codec_type === "video");
    const outputStream = probe(optimizedPath).find(stream => stream.codec_type === "video");
    const rate = value => {
      const [numerator, denominator] = String(value).split("/").map(Number);
      return denominator ? numerator / denominator : numerator;
    };
    assert.ok(rate(sourceStream.avg_frame_rate) >= 59, `source was ${sourceStream.avg_frame_rate}`);
    assert.ok(rate(outputStream.avg_frame_rate) >= 58, `output was ${outputStream.avg_frame_rate}`);
    assert.equal(outputStream.width, 1920);
    assert.equal(outputStream.height, 1080);
    const comparison = spawnSync(ffmpegPath, [
      "-hide_banner", "-loglevel", "info", "-i", fixturePath, "-i", optimizedPath,
      "-filter_complex", "[0:v]setpts=PTS-STARTPTS[reference];[1:v]setpts=PTS-STARTPTS[encoded];[reference][encoded]ssim=shortest=1",
      "-an", "-f", "null", "-",
    ], { encoding: "utf8" });
    assert.equal(comparison.status, 0, comparison.stderr);
    const ssim = Number(comparison.stderr.match(/All:([0-9.]+)/)?.[1]);
    assert.ok(Number.isFinite(ssim) && ssim >= 0.9, `same-resolution 1080p60 SSIM was ${ssim}`);
    console.log(`High-motion 1080p60 test: ${output.sourceSize} → ${output.outputSize} bytes${output.optimizedIsOriginal ? " (compatible original preserved)" : ""}; SSIM ${ssim.toFixed(4)}; output ${outputStream.avg_frame_rate}.`);
    console.log(`Low-motion 720p30 test: passed through ${output.ordinarySourceSize} bytes unchanged.`);
    writeFileSync(exportedPath, Buffer.from(output.encodedExported, "base64"));
    execFileSync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-i", exportedPath, "-map", "0:a:0", "-f", "null", "-"]);
    const exportedStream = probe(exportedPath).find(stream => stream.codec_type === "video");
    assert.ok(exportedStream, "the final post video contains a decodable video stream");
    assert.equal(exportedStream.width, output.exportDimensions.width);
    assert.equal(exportedStream.height, output.exportDimensions.height);
    const pcm = path => {
      const bytes = execFileSync(ffmpegPath, ["-v","error","-i",path,"-map","0:a:0","-ac","1","-ar","48000","-f","f32le","-"]);
      return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
    };
    const amplitude = (samples, hz, from, to) => {
      let real=0, imaginary=0;
      const start=Math.floor(from*48000), end=Math.min(samples.length,Math.floor(to*48000));
      for(let at=start;at<end;at++){
        const phase=2*Math.PI*hz*at/48000;
        real+=samples[at]*Math.cos(phase);imaginary+=samples[at]*Math.sin(phase);
      }
      return Math.hypot(real,imaginary)*2/(end-start);
    };
    writeFileSync(reencodedPath, Buffer.from(output.encodedReencoded, "base64"));
    const reencodedStreams = probe(reencodedPath);
    assert.ok(reencodedStreams.some(stream => stream.codec_type === "audio"),
      "a muted hidden video must still deliver its source audio through Web Audio");
    const reencodedAudio = pcm(reencodedPath);
    assert.ok(amplitude(reencodedAudio, 440, .2, .9) > .008,
      "the muted source video must retain audible source sound in the encoded output");
    for (const [name, path] of [["mixed video",exportedPath]]) {
      const samples=pcm(path);
      assert.ok(amplitude(samples,660,.06,.16)>.008, `${name} lost the selected music's early section or offset`);
      assert.ok(amplitude(samples,880,.5,.8)>.008, `${name} lost the selected music's later section`);
      assert.ok(amplitude(samples,660,.5,.8)<amplitude(samples,880,.5,.8)*.25, `${name} music offset was not preserved`);
      assert.ok(Math.abs(samples.length/48000-1.3)<.25, `${name} duration drifted`);
      if(name==="mixed video") assert.ok(amplitude(samples,440,.5,.8)>.008, "original video audio was lost");
    }
    assert.ok(output.editedAudioEvidence.fastOriginal > .008, "edited fast segment lost its pitched source audio");
    assert.ok(output.editedAudioEvidence.slowOriginal > .008, "edited slow segment lost its pitched source audio");
    assert.ok(output.editedAudioEvidence.keptMusic > .008, "decode fallback lost the selected music");
    assert.ok(output.editedAudioEvidence.omittedOriginal < .002, "decode fallback retained partial original sound");
    assert.equal(output.editedAudioEvidence.warningStage, "original-audio-decode");
    assert.equal(output.editedAudioEvidence.warningCount, 1);
    console.log("Added-music render, edited segment audio, original-decode fallback, and publication handoff passed.");
    assert.match(output.overLimitMessage, /2 minutes 9 seconds or shorter/);
    assert.equal(output.width, 1920);
    assert.equal(output.height, 1080);
    assert.ok(output.width >= output.height);
    assert.match(output.poster.type, /^image\/(webp|jpeg)$/);
    assert.ok(output.poster.bytes > 0 && output.poster.bytes < output.outputSize);
    assert.ok(output.poster.width <= 1080 && output.poster.height <= 1080);
    assert.equal(output.safariFallbackPoster.type, "image/jpeg");
    assert.ok(output.safariFallbackPoster.bytes > 0);
    assert.equal(output.photo.type, "image/webp");
    assert.ok(output.photo.optimizedBytes < output.photo.originalBytes);
    assert.ok(output.photo.width <= 1600 && output.photo.height <= 1600);
    assert.equal(output.photo.alpha, 0);
    assert.ok(output.fallbackPhotoBytes > 0 && output.fallbackPhotoBytes < output.photo.originalBytes);
    console.log("Photo fixture bytes:", output.photo.originalBytes, "→", output.photo.optimizedBytes);
  } finally {
    await browser?.close();
    await server.close();
    rmSync(fixtureDir, { recursive: true, force: true });
    process.env.PORT = originalPort;
    process.env.BASE_PATH = originalBasePath;
  }
});
