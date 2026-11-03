export function cloudApiUrl(path) {
  if (typeof path !== "string" || !path.startsWith("/api/") || path.includes("\\") || path.startsWith("//")) {
    throw new Error("Cloud API requests must use a same-origin /api/ path.");
  }

  const pathProbe = new URL(path, "https://oldtime-api.invalid");
  if (pathProbe.origin !== "https://oldtime-api.invalid" || !pathProbe.pathname.startsWith("/api/")) {
    throw new Error("Cloud API requests must stay within the /api/ route.");
  }

  return path;
}
