// Read-only browser fixtures: no account creation, publishing or live API writes.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  page.on("dialog", dialog => dialog.accept());
  await page.route("**/api/**", route => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
  await page.routeWebSocket("**", socket => socket.close());
  await page.goto("http://127.0.0.1:80/", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    window.cameraRequests = 0; window.stoppedTracks = 0;
    navigator.mediaDevices.getUserMedia = () => {
      window.cameraRequests++;
      return new Promise(resolve => { window.finishCamera = () => resolve({
        getTracks: () => [{ stop() { window.stoppedTracks++; } }],
      }); });
    };
    const { openStatusCapture } = await import("/app/status-capture.js");
    openStatusCapture();
  });
  assert.equal(await page.evaluate(() => window.cameraRequests), 0);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const kind of ["camera", "gallery", "text"]) {
      const box = await page.getByTestId(`status-choice-${kind}`).boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width);
    }
    assert.equal(await page.locator(".sc-choice").evaluate(el => el.scrollWidth <= el.clientWidth), true);
  }
  await page.screenshot({ path: "/tmp/oldtime-status-choice.png" });
  await page.getByTestId("status-choice-camera").click();
  assert.equal(await page.evaluate(() => window.cameraRequests), 1);
  await page.getByTestId("button-back-to-status-choices").click();
  await page.evaluate(() => window.finishCamera());
  await page.waitForFunction(() => window.stoppedTracks === 1);
  assert.equal(await page.getByTestId("status-choice").isVisible(), true);
  await page.getByTestId("status-choice-text").click();
  await page.locator(".sc-root textarea, .sc-root [contenteditable='true']").fill("A moment to share");
  await page.locator('[data-ed="text-done"]').click();
  await page.getByTestId("button-send-status").waitFor({ state: "visible" });
  assert.equal(await page.locator(".creative-editor").count(), 0);
  await page.locator('[data-ed="back"]').click();
  await page.getByTestId("status-choice-gallery").waitFor({ state: "visible" });
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 900;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white"; ctx.fillRect(0,0,1600,900);
    ctx.fillStyle = "red"; ctx.fillRect(0,0,160,900);
    ctx.fillStyle = "blue"; ctx.fillRect(1440,0,160,900);
    return canvas.toDataURL("image/png");
  });
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("status-choice-gallery").click();
  await (await chooser).setFiles({ name: "landscape.png", mimeType: "image/png", buffer: Buffer.from(image.split(",")[1], "base64") });
  await page.getByTestId("canvas-status").waitFor();
  await page.waitForFunction(() => {
    const c = document.querySelector(".sc-canvas"); if (!c) return false;
    const ctx = c.getContext("2d"), l = ctx.getImageData(2,c.height/2,1,1).data;
    const r = ctx.getImageData(c.width-3,c.height/2,1,1).data;
    return l[0]>200 && l[2]<50 && r[2]>200 && r[0]<50;
  });
  console.log("PASS Status choices at 320/390px; no automatic camera prompt; pending camera cancelled; text and gallery work; landscape edges retained");

  await page.goto("http://127.0.0.1:80/", { waitUntil: "networkidle" });
  const output = await page.evaluate(async data => {
    const { api } = await import("/app/store.js");
    api.me = () => ({id:"layout-fixture",name:"Layout fixture",username:"layoutfixture"});
    const { openCreativeEditor } = await import("/app/creative-editor.js");
    const { icon } = await import("/app/icons.js");
    openCreativeEditor({ background: { kind:"photo", media:data }, editorVersion:"v2", esc: value => String(value ?? ""), icons:icon });
    const { CreativeAssets, drawProject } = await import("/app/creative-renderer.js");
    const { createProject, uploadedMediaFrame } = await import("/app/creative-project.js");
    const { canvasBlob } = await import("/app/creative-export.js");
    const assets = new CreativeAssets(), img = await assets.load(data, "image");
    const project = createProject(); Object.assign(project, uploadedMediaFrame(img));
    project.background = {kind:"photo",media:data,color:"#17191c",fit:"contain"};
    const canvas = document.createElement("canvas"); canvas.width=project.width; canvas.height=project.height;
    drawProject(canvas,project,assets,()=>null);
    const bitmap = await createImageBitmap(await canvasBlob(canvas));
    const decoded = document.createElement("canvas"); decoded.width=bitmap.width; decoded.height=bitmap.height;
    const ctx=decoded.getContext("2d"); ctx.drawImage(bitmap,0,0); bitmap.close(); assets.dispose();
    return { width:decoded.width,height:decoded.height,
      left:[...ctx.getImageData(2,decoded.height/2,1,1).data],
      right:[...ctx.getImageData(decoded.width-3,decoded.height/2,1,1).data] };
  }, image);
  assert.equal(output.width,1600); assert.equal(output.height,900);
  assert.ok(output.left[0]>200 && output.left[2]<50 && output.right[2]>200 && output.right[0]<50);
  await page.waitForFunction(() => document.querySelector("#ce-canvas")?.width === 1600);
  const stage = await page.locator("#ce-canvas").boundingBox();
  assert.ok(stage.width > 320 && Math.abs(stage.width/stage.height-1600/900)<.02);
  await page.screenshot({ path:"/tmp/oldtime-studio-landscape.png" });
  console.log("PASS actual Studio landscape canvas uses the full available width; exported PNG keeps both edges and 1600×900 dimensions");
} finally {
  await browser.close();
}
