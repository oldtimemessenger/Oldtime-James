const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function maskViewTransform(viewport, image, zoom = 1, panX = 0, panY = 0) {
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height) * zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  return { scale, x: (viewport.width - width) / 2 + panX, y: (viewport.height - height) / 2 + panY };
}

export function mapMaskPointer(clientX, clientY, rect, image, zoom = 1, panX = 0, panY = 0) {
  const view = maskViewTransform({ width: rect.width, height: rect.height }, image, zoom, panX, panY);
  return {
    x: clamp((clientX - rect.left - view.x) / view.scale, 0, image.width),
    y: clamp((clientY - rect.top - view.y) / view.scale, 0, image.height)
  };
}
