import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import test from "node:test";
import { WebSocket, WebSocketServer } from "ws";
import { createCloudflareGateway } from "../scripts/cloudflare-preview-gateway.mjs";

test("preview streams API bytes to Cloudflare without a second data store", async t => {
  let received;
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = { method: request.method, url: request.url, headers: request.headers, bytes: Buffer.concat(chunks) };
    response.writeHead(200, { "content-type": "application/octet-stream", "cache-control": "no-store" });
    response.end(received.bytes);
  });
  upstream.listen(0, "127.0.0.1"); await once(upstream, "listening");
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  const gateway = createCloudflareGateway(origin);
  gateway.listen(0, "127.0.0.1"); await once(gateway, "listening");
  t.after(async () => {
    for (const server of [gateway, upstream]) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
  const base = `http://127.0.0.1:${gateway.address().port}`;
  const bytes = Buffer.from([0, 255, 18, 240, 0, 13]);
  const result = await fetch(`${base}/api/media/example/resumable`, { method: "PATCH", body: bytes,
    headers: { Origin: "https://preview.example", Referer: "https://preview.example/", Authorization: "Bearer fixture",
      "cf-connecting-ip": "invalid", "x-forwarded-for": "invalid" } });
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes);
  assert.equal(received.method, "PATCH");
  assert.equal(received.url, "/api/media/example/resumable");
  assert.equal(received.headers.origin, origin);
  assert.equal(received.headers.authorization, "Bearer fixture");
  assert.equal(received.headers["cf-connecting-ip"], undefined);
  assert.equal(received.headers["x-forwarded-for"], undefined);
  assert.equal((await fetch(`${base}/not-an-api`)).status, 404);
});

test("preview rewrites Cloudflare media links to relative same-origin paths", async t => {
  const mediaId = "a12b34cd-5678-4abc-9def-0123456789ab";
  const thumbnailId = "b12b34cd-5678-4abc-9def-0123456789ab";
  let origin = "";
  const upstream = http.createServer((_request, response) => {
    const body = JSON.stringify({
      url: new URL(`/api/media/${mediaId}/content?access=read-token`, origin).href,
      thumbnailUrl: new URL(`/api/media/${thumbnailId}/content?access=thumb-token`, origin).href,
    });
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(body),
    });
    response.end(body);
  });
  upstream.listen(0, "127.0.0.1"); await once(upstream, "listening");
  origin = `http://127.0.0.1:${upstream.address().port}`;
  const gateway = createCloudflareGateway(origin);
  gateway.listen(0, "127.0.0.1"); await once(gateway, "listening");
  t.after(async () => {
    for (const server of [gateway, upstream]) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });

  const base = `http://127.0.0.1:${gateway.address().port}`;
  const result = await fetch(`${base}/api/media/${mediaId}/url`);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), {
    url: `/api/media/${mediaId}/content?access=read-token`,
    thumbnailUrl: `/api/media/${thumbnailId}/content?access=thumb-token`,
  });
});

test("preview forwards private realtime upgrades without a local realtime backend", async t => {
  const upstream = http.createServer();
  const sockets = new WebSocketServer({ server: upstream });
  let observedOrigin;
  sockets.on("connection", (socket, request) => {
    observedOrigin = request.headers.origin;
    socket.on("message", bytes => socket.send(bytes.toString()));
  });
  upstream.listen(0, "127.0.0.1"); await once(upstream, "listening");
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  const gateway = createCloudflareGateway(origin);
  gateway.listen(0, "127.0.0.1"); await once(gateway, "listening");
  const client = new WebSocket(`ws://127.0.0.1:${gateway.address().port}/api/realtime`, { origin: "https://preview.example" });
  t.after(async () => {
    client.terminate();
    for (const socket of sockets.clients) socket.terminate();
    await new Promise(resolve => sockets.close(resolve));
    for (const server of [gateway, upstream]) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
  await once(client, "open");
  const reply = once(client, "message");
  client.send("A fixture realtime frame");
  assert.equal((await reply)[0].toString(), "A fixture realtime frame");
  assert.equal(observedOrigin, origin);
  const closed = once(client, "close");
  client.close(); await closed;
});
