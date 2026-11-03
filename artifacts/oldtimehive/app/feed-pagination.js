const MIN_PREFETCH_PX = 280;
const MAX_PREFETCH_PX = 1000;

/** Choose how far ahead the Home feed should request the next page. */
export function feedPaginationRootMargin({
  viewportHeight = 640,
  connection = globalThis.navigator?.connection,
} = {}) {
  const height = Number.isFinite(Number(viewportHeight)) && Number(viewportHeight) > 0
    ? Number(viewportHeight)
    : 640;
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  const ratio = connection?.saveData === true
    ? 0.65
    : ["slow-2g", "2g"].includes(effectiveType)
      ? 1.6
      : 1.15;
  const distance = Math.round(Math.min(MAX_PREFETCH_PX, Math.max(MIN_PREFETCH_PX, height * ratio)));
  return `0px 0px ${distance}px 0px`;
}
