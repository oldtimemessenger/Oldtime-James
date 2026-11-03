// Pick one clear feed-video candidate when IntersectionObserver reports a batch.
// The highest visible share wins; ties prefer the video closest to the feed center.
export function selectFeedVideoCandidate(entries) {
  if (!entries || typeof entries[Symbol.iterator] !== "function") return null;
  let candidate = null;
  let candidateRatio = -1;
  let candidateCenterDistance = Infinity;
  for (const entry of entries) {
    if (!entry?.isIntersecting || !entry.target) continue;
    const ratio = Number(entry.intersectionRatio);
    const visibleRatio = Number.isFinite(ratio) ? ratio : 0;
    const rect = entry.boundingClientRect;
    const centerDistance = rect && Number.isFinite(rect.top) && Number.isFinite(rect.height)
      ? Math.abs(rect.top + rect.height / 2)
      : Infinity;
    if (visibleRatio > candidateRatio ||
        (visibleRatio === candidateRatio && centerDistance < candidateCenterDistance)) {
      candidate = entry.target;
      candidateRatio = visibleRatio;
      candidateCenterDistance = centerDistance;
    }
  }
  return candidate;
}
