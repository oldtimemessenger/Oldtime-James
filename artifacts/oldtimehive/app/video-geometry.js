function fitVideoTo(width, height, maxLongEdge, maxShortEdge) {
  const sourceWidth = Number(width);
  const sourceHeight = Number(height);
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) ||
      sourceWidth < 2 || sourceHeight < 2) {
    throw new Error("The video dimensions could not be read.");
  }
  const scale = Math.min(
    1,
    maxLongEdge / Math.max(sourceWidth, sourceHeight),
    maxShortEdge / Math.min(sourceWidth, sourceHeight),
  );
  const even = value => Math.max(2, Math.floor(value * scale / 2) * 2);
  return { width: even(sourceWidth), height: even(sourceHeight) };
}

export function fitVideoTo720p(width, height) {
  return fitVideoTo(width, height, 1280, 720);
}

export function fitVideoTo1080p(width, height) {
  return fitVideoTo(width, height, 1920, 1080);
}
