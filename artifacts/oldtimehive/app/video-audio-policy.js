const audioPresence = new WeakMap();
export function knownVideoAudioPresence(blob) {
  return blob instanceof Blob ? audioPresence.get(blob) ?? null : null;
}
function childBoxes(view, start, end) {
  const result = [];
  for (let at = start; at + 8 <= end;) {
    const size = view.getUint32(at);
    if (size < 8 || at + size > end) throw new Error("Invalid audio metadata");
    const type = String.fromCharCode(...new Uint8Array(view.buffer, at + 4, 4));
    result.push({ type, start: at + 8, end: at + size });
    at += size;
  }
  return result;
}
// Read the movie metadata, not the (potentially large) encoded media payload.
// Unknown containers remain unknown; a decode failure is never proof of silence.
export async function readVideoAudioPresence(blob) {
  if (!(blob instanceof Blob) || !/video\/(mp4|quicktime)/i.test(blob.type)) return null;
  if (audioPresence.has(blob)) return audioPresence.get(blob);
  try {
    for (let at = 0; at + 8 <= blob.size;) {
      const header = new DataView(await blob.slice(at, at + 16).arrayBuffer());
      let size = header.getUint32(0), bytes = 8;
      if (size === 1) {
        size = header.getUint32(8) * 2 ** 32 + header.getUint32(12); bytes = 16;
      } else if (size === 0) size = blob.size - at;
      if (!Number.isSafeInteger(size) || size < bytes || at + size > blob.size) return null;
      if (header.getUint32(4) === 0x6d6f6f76) {
        if (size > 8 * 1024 * 1024) return null;
        const movie = new DataView(await blob.slice(at + bytes, at + size).arrayBuffer());
        let videoFound = false;
        for (const track of childBoxes(movie, 0, movie.byteLength).filter(box => box.type === "trak")) {
          const media = childBoxes(movie, track.start, track.end).find(box => box.type === "mdia");
          if (!media) continue;
          const handler = childBoxes(movie, media.start, media.end).find(box => box.type === "hdlr");
          if (!handler || handler.end - handler.start < 12) continue;
          const type = movie.getUint32(handler.start + 8);
          if (type === 0x736f756e) { audioPresence.set(blob, true); return true; }
          if (type === 0x76696465) videoFound = true;
        }
        if (videoFound) { audioPresence.set(blob, false); return false; }
        return null;
      }
      at += size;
    }
  } catch {}
  return null;
}
export function exportAudioPlan({ video, background = {}, audioTracks = [], sourceHasAudio = null }) {
  const music = audioTracks.filter(track => track?.media && track.muted !== true &&
    (!Number.isFinite(Number(track.volume)) || Number(track.volume) > 0));
  // The element's muted flag belongs to preview/autoplay, not the user's edit.
  const original = !!video && background.audioMuted !== true && sourceHasAudio !== false;
  return { original, music, needsAudio: original || music.length > 0 };
}
export function setOriginalAudioMuted(background, muted, video = null) {
  if (!background || background.kind !== "video") return null;
  const next = muted === true;
  background.audioMuted = next;
  if (video) video.muted = next;
  return next;
}
