import { ReportClientPerformanceBody } from "@workspace/api-zod";

const feedMetrics = new Set(["fetchMs", "renderMs", "totalMs", "workerMs", "rowsMs", "hydrateMs", "rankMs"]);
const videoMetrics = new Set(["urlMs", "activeToFrameMs", "playCallMs"]);
const feedOutcomes = new Set(["success", "failure"]);
const videoOutcomes = new Set(["frame", "play-rejected", "media-error", "timeout", "url-error"]);

export function normalizeClientPerformanceEvent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !["event", "outcome", "frameSignal", "metrics"].includes(key))) return null;
  if ((raw.event !== "feed" && raw.event !== "video") || !raw.metrics ||
      typeof raw.metrics !== "object" || Array.isArray(raw.metrics)) return null;
  const rawMetrics = raw.metrics as Record<string, unknown>;
  const rawAllowed = raw.event === "feed" ? feedMetrics : videoMetrics;
  if (Object.keys(rawMetrics).some(key => !rawAllowed.has(key))) return null;

  const parsed = ReportClientPerformanceBody.safeParse(value);
  if (!parsed.success) return null;

  const { event, metrics, outcome, frameSignal } = parsed.data;
  const allowedMetrics = event === "feed" ? feedMetrics : videoMetrics;
  const allowedOutcomes = event === "feed" ? feedOutcomes : videoOutcomes;
  const metricEntries = Object.entries(metrics);
  if (!allowedOutcomes.has(outcome) || !metricEntries.length ||
      metricEntries.some(([key]) => !allowedMetrics.has(key))) return null;

  const safeMetrics: Record<string, number> = {};
  for (const [key, value] of metricEntries) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 120_000) return null;
    safeMetrics[key] = Math.round(value / 10) * 10;
  }
  return { event, outcome, metrics: safeMetrics, ...(frameSignal ? { frameSignal } : {}) };
}
