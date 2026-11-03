export async function onRequest({ request, env }) {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith("/api/")) {
    return new Response("Not found", { status: 404 });
  }

  const api = env.OLDTIME_API;
  if (!api || typeof api.fetch !== "function") {
    return new Response("The Oldtime API is not connected.", {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  return api.fetch(request);
}
