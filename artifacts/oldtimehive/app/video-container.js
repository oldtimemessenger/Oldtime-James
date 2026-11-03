// MediaRecorder writes fragmented MP4: its frame timing lives in moof/trun,
// not the empty moov/stts table used by ordinary camera files.
function boxes(view, start = 0, end = view.byteLength) {
  const result = [];
  for (let at = start; at + 8 <= end;) {
    let size = view.getUint32(at), header = 8;
    if (size === 1) {
      if (at + 16 > end) break;
      size = view.getUint32(at + 8) * 2 ** 32 + view.getUint32(at + 12);
      header = 16;
    } else if (!size) size = end - at;
    if (!Number.isSafeInteger(size) || size < header || at + size > end) break;
    const type = String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + at + 4, 4));
    result.push({ type, start: at + header, end: at + size });
    at += size;
  }
  return result;
}
const children = (view, box) => box ? boxes(view, box.start, box.end) : [];
export function fragmentedMp4FrameRate(buffer) {
  try {
    const view = new DataView(buffer), top = boxes(view);
    const moov = top.find(box => box.type === "moov");
    const movie = children(view, moov);
    for (const trak of movie.filter(box => box.type === "trak")) {
      const track = children(view, trak), tkhd = track.find(box => box.type === "tkhd");
      const media = children(view, track.find(box => box.type === "mdia"));
      const hdlr = media.find(box => box.type === "hdlr"), mdhd = media.find(box => box.type === "mdhd");
      if (!tkhd || !hdlr || !mdhd || view.getUint32(hdlr.start + 8) !== 0x76696465) continue;
      const trackId = view.getUint32(tkhd.start + (view.getUint8(tkhd.start) === 1 ? 20 : 12));
      const timescale = view.getUint32(mdhd.start + (view.getUint8(mdhd.start) === 1 ? 20 : 12));
      if (!timescale) continue;
      const trex = children(view, movie.find(box => box.type === "mvex"))
        .find(box => box.type === "trex" && view.getUint32(box.start + 4) === trackId);
      const trackDefault = trex ? view.getUint32(trex.start + 12) : 0;
      let samples = 0, ticks = 0;
      for (const moof of top.filter(box => box.type === "moof")) {
        for (const traf of children(view, moof).filter(box => box.type === "traf")) {
          const fragments = children(view, traf), tfhd = fragments.find(box => box.type === "tfhd");
          if (!tfhd || view.getUint32(tfhd.start + 4) !== trackId) continue;
          const flags = view.getUint32(tfhd.start) & 0xffffff;
          const offset = tfhd.start + 8 + (flags & 1 ? 8 : 0) + (flags & 2 ? 4 : 0);
          const defaultDuration = flags & 8 ? view.getUint32(offset) : trackDefault;
          for (const trun of fragments.filter(box => box.type === "trun")) {
            const runFlags = view.getUint32(trun.start) & 0xffffff;
            const count = view.getUint32(trun.start + 4);
            let cursor = trun.start + 8 + (runFlags & 1 ? 4 : 0) + (runFlags & 4 ? 4 : 0);
            const stride = (runFlags & 0x100 ? 4 : 0) + (runFlags & 0x200 ? 4 : 0) +
              (runFlags & 0x400 ? 4 : 0) + (runFlags & 0x800 ? 4 : 0);
            if (stride && count > (trun.end - cursor) / stride) return null;
            if (!stride) {
              if (defaultDuration) { samples += count; ticks += count * defaultDuration; }
              continue;
            }
            for (let index = 0; index < count; index++, cursor += stride) {
              const duration = runFlags & 0x100 ? view.getUint32(cursor) : defaultDuration;
              if (duration) { samples++; ticks += duration; }
            }
          }
        }
      }
      const fps = samples * timescale / ticks;
      if (samples >= 2 && Number.isFinite(fps) && fps > 0 && fps <= 240) return fps;
    }
  } catch {
    // Unrecognized/malformed timing is not evidence of a supported frame rate.
  }
  return null;
}
