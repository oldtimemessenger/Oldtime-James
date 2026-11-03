import { createMatteSurface, foregroundConfidence } from "./remix-matte.js";

export async function createPersonCutout({ forceCpu = false, still = false } = {}) {
  const base = `${import.meta.env.BASE_URL}remix-assets/`;
  const probe = document.createElement("canvas");
  const graphics = probe.getContext("webgl2") || probe.getContext("webgl");
  graphics?.getExtension("WEBGL_lose_context")?.loseContext();
  if (forceCpu) {
    const { createCpuCutout } = await import("./remix-cutout-cpu.js");
    return createCpuCutout(base,{still});
  }
  let FilesetResolver, ImageSegmenter, files, segmenter;
  try {
    ({ FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision"));
    files = await FilesetResolver.forVisionTasks(`${base}wasm`);
  } catch {
    const { createCpuCutout } = await import("./remix-cutout-cpu.js");
    return createCpuCutout(base,{still});
  }
  const options = delegate => ({
    baseOptions: { modelAssetPath: `${base}selfie_segmenter.tflite`, delegate },
    runningMode: still ? "IMAGE" : "VIDEO", outputCategoryMask: false, outputConfidenceMasks: true
  });
  try {
    if (graphics) {
      try { segmenter = await ImageSegmenter.createFromOptions(files, options("GPU")); }
      catch (gpuFailure) {
        console.warn("GPU person segmentation is unavailable; using the on-device CPU model.", gpuFailure);
        segmenter = await ImageSegmenter.createFromOptions(files, options("CPU"));
      }
    } else {
      segmenter = await ImageSegmenter.createFromOptions(files, options("CPU"));
    }
  } catch (modelFailure) {
    console.warn("MediaPipe person segmentation is unavailable; using the on-device fallback.", modelFailure);
    const { createCpuCutout } = await import("./remix-cutout-cpu.js");
    return createCpuCutout(base,{still});
  }
  const surface = createMatteSurface({ maxDimension: still ? 1024 : 640 }), labels = segmenter.getLabels();
  let lastTime = -1, lastVideo = null, closed = false, fallback = null, retired = false;
  const frame = (video, time) => {
      if (video.readyState < 2) return surface.canvas;
      if (lastVideo !== video) { lastVideo = video; surface.reset(); lastTime = -1; }
      if (time - lastTime < 85) return surface.canvas;
      lastTime = time;
      const result = segmenter.segmentForVideo(video, time);
      try {
        return surface.update(video, foregroundConfidence(result.confidenceMasks, labels));
      } finally { result.close(); }
  };
  return {
    async image(source) {
      if(!still||closed)throw new Error("Still-image segmentation is unavailable.");
      try{
        const result=segmenter.segment(source);
        try{return surface.update(source,foregroundConfidence(result.confidenceMasks,labels));}
        finally{result.close();}
      }catch(failure){
        console.warn("Person cutout: switching to CPU after image segmentation failure",failure);
        segmenter.close();retired=true;
        const {createCpuCutout}=await import("./remix-cutout-cpu.js");
        fallback=await createCpuCutout(base,{still:true});
        if(closed){fallback.close();throw failure;}
        return fallback.image(source);
      }
    },
    async prepare(video) {
      if (closed) throw new Error("Cutout is closed.");
      if (fallback) return fallback.prepare(video);
      try {
        if (video.readyState >= 2) { lastTime = -1; frame(video, performance.now()); }
      } catch (failure) {
        console.warn("Remix cutout: switching to CPU after first-frame failure", failure);
        segmenter.close();
        retired=true;
        const { createCpuCutout } = await import("./remix-cutout-cpu.js");
        fallback = await createCpuCutout(base);
        if (closed) { fallback.close(); return; }
        await fallback.prepare(video);
      }
    },
    frame(video, time) { return fallback ? fallback.frame(video, time) : frame(video, time); },
    close() { if (closed) return; closed = true; if(fallback)fallback.close();else if(!retired)segmenter.close(); surface.close(); }
  };
}
