export async function audioStep(stage, context, action, timeoutMs = 10_000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`Audio ${stage} timed out. Your edit is still here.`);
          error.name = "AudioTimeoutError";
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } catch (failure) {
    const error = failure instanceof Error ? failure : new Error(String(failure));
    error.publicationStage ||= `audio-${stage}`;
    error.audioDiagnostic = { operation: stage, contextState: context?.state || "unavailable" };
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export async function readyAudioContext(context, session, timeoutMs) {
  if (context.state === "closed") {
    return audioStep("resume", context, () => { throw new Error("The audio context was closed. Your edit is still here."); }, timeoutMs);
  }
  if (context.state !== "running" && session?.context === context && session.ready) {
    await audioStep("resume", context, () => session.ready, timeoutMs);
  }
  if (context.state !== "running") {
    await audioStep("resume", context, () => context.resume(), timeoutMs);
  }
  if (context.state !== "running") {
    await audioStep("resume", context, () => { throw new Error(`Audio is ${context.state}. Your edit is still here.`); }, timeoutMs);
  }
}
export async function loadAudioBuffer(context, media, timeoutMs) {
  const request = {method: "GET", url: String(media).split("?")[0]};
  let response;
  try {
    response = await audioStep("sound-load", context, () => fetch(media), timeoutMs);
  } catch (error) {
    error.request = request; throw error;
  }
  if (!response.ok) {
    let body = null;
    try { body = (await response.text()).slice(0, 2000); } catch {}
    return audioStep("sound-load", context, () => {
      const error = new Error(`The selected sound could not be loaded (HTTP ${response.status}).`);
      error.request = request; error.status = response.status; error.responseBody = body;
      error.requestId = response.headers.get("cf-ray") || null;
      throw error;
    }, timeoutMs);
  }
  const bytes = await audioStep("sound-read", context, () => response.arrayBuffer(), timeoutMs);
  return audioStep("decode", context, () => context.decodeAudioData(bytes), timeoutMs);
}
