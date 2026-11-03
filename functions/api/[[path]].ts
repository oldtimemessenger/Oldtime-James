interface Context {
  request: Request;
  env: { OLDTIME_API?: { fetch(request: Request): Promise<Response> } };
}

export function onRequest(context: Context): Promise<Response> | Response {
  if (!context.env.OLDTIME_API) {
    return Response.json(
      { error: "The Oldtime API is not connected. Please try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  // Preserve the site's URL, client context, streaming bodies, private cache
  // headers and WebSocket upgrades. Never fall back to another data provider.
  return context.env.OLDTIME_API.fetch(context.request);
}
