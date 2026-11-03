import http from "node:http";
import https from "node:https";
import { pathToFileURL } from "node:url";

// Verified against the connected Cloudflare Pages project. This is a thin
// relay only: it has no database, media bucket, account store, or fallback.
export const CLOUDFLARE_ORIGIN = "https://oldtimehive.pages.dev";

function isMediaLinkLookup(request) {
  return request.method === "GET" &&
    /^\/api\/(?:media\/[a-f0-9-]{36}\/url|stories\/[a-f0-9-]{36}\/media-url)(?:\?|$)/i.test(request.url || "");
}

function rewriteMediaLinks(body, targetOrigin) {
  let payload;
  try { payload = JSON.parse(body); } catch { return body; }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return body;
  let changed = false;
  for (const key of ["url", "thumbnailUrl"]) {
    if (typeof payload[key] !== "string") continue;
    try {
      const link = new URL(payload[key]);
      if (link.origin !== targetOrigin ||
          !/^\/api\/media\/[a-f0-9-]{36}\/content$/i.test(link.pathname)) continue;
      payload[key] = `${link.pathname}${link.search}`;
      changed = true;
    } catch {}
  }
  return changed ? JSON.stringify(payload) : body;
}

export function createCloudflareGateway(origin = CLOUDFLARE_ORIGIN) {
  const target = new URL(origin);
  const transport = target.protocol === "https:" ? https : http;
  const options = request => {
    const headers = { ...request.headers, host: target.host };
    if (isMediaLinkLookup(request)) headers["accept-encoding"] = "identity";
    // Preserve the API's same-origin checks across the development reverse proxy.
    if (headers.origin) headers.origin = target.origin;
    if (headers.referer) headers.referer = `${target.origin}/`;
    for (const name of ["cf-connecting-ip", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto"]) delete headers[name];
    return { protocol: target.protocol, hostname: target.hostname, port: target.port || undefined,
      path: request.url, method: request.method, headers };
  };
  const unavailable = response => {
    if (response.writableEnded || response.destroyed) return;
    if (!response.headersSent) response.writeHead(502, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ error: "Cloudflare is temporarily unreachable. Your content has not been saved elsewhere." }));
  };
  const server = http.createServer(async (request, response) => {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
      response.end("Oldtime Cloudflare development gateway");
      return;
    }
    if (!request.url?.startsWith("/api/")) {
      response.writeHead(404); response.end(); return;
    }
    if (/^\/api\/(?:places\/|moderation\/|account\/library\/saved(?:\?|$)|stories\/[\da-f-]{36}\/reactions(?:\?|$))/i.test(request.url || "") && origin === CLOUDFLARE_ORIGIN) {
      try {
        const {isCurrentPreviewRoute,currentPreviewResponse}=await import("./places-preview.ts");
        if(isCurrentPreviewRoute(request.url)){
          const chunks=[];for await(const chunk of request)chunks.push(chunk);
          const headers={...request.headers,host:target.host};
          for(const name of ["cf-connecting-ip","x-forwarded-for","x-forwarded-host","x-forwarded-proto"])delete headers[name];
          if(headers.origin)headers.origin=target.origin;
          if(headers.referer)headers.referer=`${target.origin}/`;
          const result=await currentPreviewResponse(new Request(new URL(request.url,target),{
            method:request.method,headers,
            ...(!["GET","HEAD"].includes(request.method)?{body:Buffer.concat(chunks)}:{}),
          }));
          response.writeHead(result.status,Object.fromEntries(result.headers));
          response.end(Buffer.from(await result.arrayBuffer()));return;
        }
      }catch(error){
        console.error("Current Places preview could not complete the request",error);
        response.writeHead(503,{"content-type":"application/json","cache-control":"no-store"});
        response.end(JSON.stringify({error:"We couldn’t load this right now. Please try again."}));return;
      }
    }
    const upstream = transport.request(options(request), incoming => {
      if (isMediaLinkLookup(request) && /application\/json/i.test(String(incoming.headers["content-type"] || ""))) {
        const chunks = [];
        incoming.on("data", chunk => chunks.push(chunk));
        incoming.on("error", () => response.destroy());
        incoming.on("end", () => {
          if (response.destroyed) return;
          const body = rewriteMediaLinks(Buffer.concat(chunks).toString("utf8"), target.origin);
          const headers = { ...incoming.headers };
          for (const name of ["content-length", "content-encoding", "transfer-encoding", "connection"]) delete headers[name];
          response.writeHead(incoming.statusCode || 502, headers);
          response.end(body);
        });
        return;
      }
      response.writeHead(incoming.statusCode || 502, incoming.headers);
      incoming.on("error", () => response.destroy());
      incoming.pipe(response);
    });
    upstream.on("error", () => unavailable(response));
    request.on("aborted", () => upstream.destroy());
    response.on("close", () => { if (!response.writableEnded) upstream.destroy(); });
    // Stream uploads and responses unchanged; never write bodies to disk.
    request.pipe(upstream);
  });
  server.on("upgrade", (request, socket, head) => {
    if (!request.url?.startsWith("/api/")) { socket.destroy(); return; }
    const upstream = transport.request(options(request));
    upstream.on("upgrade", (incoming, remote, remoteHead) => {
      const headers = incoming.rawHeaders.reduce((lines, value, index, all) =>
        index % 2 === 0 ? `${lines}${value}: ${all[index + 1]}\r\n` : lines, "");
      socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n`);
      if (head.length) remote.write(head);
      if (remoteHead.length) socket.write(remoteHead);
      remote.on("error", () => socket.destroy());
      socket.on("error", () => remote.destroy());
      socket.on("close", () => remote.destroy());
      remote.on("close", () => socket.destroy());
      remote.pipe(socket); socket.pipe(remote);
    });
    upstream.on("response", incoming => {
      socket.end(`HTTP/1.1 ${incoming.statusCode || 502} ${incoming.statusMessage || "Rejected"}\r\nConnection: close\r\n\r\n`);
      incoming.resume();
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
    socket.on("close", () => upstream.destroy());
    upstream.end();
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8080);
  const server = createCloudflareGateway();
  server.listen(port, "0.0.0.0", () => console.log(`Oldtime API gateway listening on ${port}; data remains on Cloudflare.`));
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
}
