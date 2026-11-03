import assert from "node:assert/strict";

// Uses the canonical browser test's signed-in account and network fixtures.
// The media source is a genuine browser MediaStream, not physical hardware.
export async function checkCameraReference(page) {
  await page.evaluate(() => {
    window.__captureChunks = [];
    window.__captureStreams = [];
    window.__captureFailFirstCamera = true;
    window.__captureFirstCameraTestPlanned = true;
    const start = MediaRecorder.prototype.start;
    MediaRecorder.prototype.start = function (...args) {
      this.addEventListener("dataavailable", event => {
        if (event.data.size) window.__captureChunks.push(event.data);
      });
      return start.apply(this, args);
    };
    navigator.mediaDevices.getUserMedia = async constraints => {
      if (constraints.video && window.__captureFailFirstCamera) {
        window.__captureFailFirstCamera = false;
        throw new DOMException("Camera permission denied for this test", "NotAllowedError");
      }
      if (!constraints.video) return new MediaStream();
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 480;
      const context = canvas.getContext("2d");
      let frame = 0;
      const paint = () => {
        context.fillStyle = "#2c5867"; context.fillRect(0, 0, 640, 480);
        context.fillStyle = "#e7b675"; context.fillRect(100 + frame++ % 100, 90, 200, 300);
      };
      paint();
      const stream = canvas.captureStream(12);
      window.__captureStreams.push(stream);
      const timer = setInterval(paint, 80);
      stream.getVideoTracks()[0].addEventListener("ended", () => clearInterval(timer), { once: true });
      return stream;
    };
  });
  const open = async () => {
    await page.locator("#create-open").click();
    if (await page.evaluate(() => window.__captureFirstCameraTestPlanned)) {
      await page.locator(".cs-studio.is-camera-open").waitFor({ state: "visible" });
      await page.locator("#ce-error").getByText("Allow camera access, or upload a file.").waitFor({ state: "visible" });
      assert.equal(await page.locator("#ce-empty").isVisible(), false);
      assert.equal(await page.locator('[data-ce-capture-mode="photo"]').isVisible(), true);
      assert.equal(await page.locator("#ce-camera-gallery-slot button[aria-label='Library']").isVisible(), true);
      await page.locator("#ce-camera-reset").click();
      await page.evaluate(() => { window.__captureFirstCameraTestPlanned = false; });
    }
    await page.locator(".cs-studio.is-camera-open.has-live-camera").waitFor({ state: "visible", timeout: 5000 }).catch(async failure => {
      const diagnostic = await page.evaluate(() => ({
        editor: document.querySelector(".creative-editor")?.className,
        visible: document.body.innerText.slice(0, 900),
        streams: window.__captureStreams.map(stream => stream.getTracks().map(track => track.readyState)),
        videos: Array.from(document.querySelectorAll("video"), video => ({
          state: video.readyState, width: video.videoWidth, paused: video.paused,
        })),
      }));
      await page.screenshot({ path: "/tmp/oldtime-camera-reference-blocked.png" });
      throw new Error(JSON.stringify(diagnostic), { cause: failure });
    });
    await page.waitForFunction(() => !document.getElementById("ce-shutter").disabled);
    assert.equal(await page.locator("[data-create-flow]").count(), 0);
    assert.equal(await page.locator(".cs-title").innerText(), "New post");
  };
  const close = async () => {
    await page.locator("#ce-close").click();
    if (await page.locator("#ce-exit-dialog").isVisible()) await page.locator("#ce-exit-discard").click();
    await page.locator(".creative-editor").waitFor({ state: "detached" });
  };
  const edited = () => page.locator(".cs-studio:not(.is-camera-open):not([aria-busy=true])").waitFor({ state: "visible" });
  await open();
  for (const width of [402, 320]) {
    await page.setViewportSize({ width, height: 874 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bounds = await page.evaluate(() => {
      const rect = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, center: r.left + r.width / 2 };
      };
      return { stage: rect(".cs-stage"), title: rect(".cs-title"), shutter: rect("#ce-shutter"), dock: rect(".cs-capture") };
    });
    assert.ok(bounds.stage.left >= 0 && bounds.stage.right <= width && bounds.stage.bottom <= bounds.dock.top, JSON.stringify(bounds));
    assert.ok(Math.abs(bounds.title.center - width / 2) < 1 && bounds.title.bottom <= bounds.stage.top, JSON.stringify(bounds));
    assert.ok(Math.abs(bounds.shutter.center - width / 2) < 1 && bounds.shutter.top > bounds.stage.bottom, JSON.stringify(bounds));
    assert.equal(await page.locator('[data-ce-capture-mode="photo"]').isVisible(), true);
    assert.equal(await page.locator('[data-ce-capture-mode="video"]').isVisible(), true);
  }
  await page.setViewportSize({ width: 402, height: 874 });
  assert.equal(await page.locator(".cs-library-frame").evaluate(frame => getComputedStyle(frame).opacity), "1");
  assert.equal(await page.locator(".cs-library-frame svg").isVisible(), true);
  const libraryAlignment = await page.evaluate(() => {
    const glyph = document.querySelector(".cs-library-frame svg").getBoundingClientRect();
    const shutter = document.getElementById("ce-shutter").getBoundingClientRect();
    return Math.abs(glyph.top + glyph.height / 2 - shutter.top - shutter.height / 2);
  });
  assert.ok(libraryAlignment < 1, "Library and shutter must share the same center line");
  await page.screenshot({ path: "/tmp/oldtime-camera-reference-photo.png" });
  await page.locator("#ce-shutter").click();
  await edited();
  assert.equal(await page.locator(".cs-rail").isVisible(), true);
  await close();

  await open();
  await page.locator('[data-ce-capture-mode="video"]').click();
  await page.screenshot({ path: "/tmp/oldtime-camera-reference-video.png" });
  await page.locator("#ce-shutter").click();
  await page.locator(".cs-studio.is-capturing").waitFor({ state: "visible" });
  await page.waitForFunction(() => /^00:0[1-9] \/ 01:00$/.test(document.getElementById("ce-recording-indicator").textContent));
  const stop = await page.locator("#ce-shutter>span").evaluate(span => {
    const r = span.getBoundingClientRect();
    return { width: r.width, height: r.height, radius: getComputedStyle(span).borderRadius };
  });
  assert.deepEqual(stop, { width: 26, height: 26, radius: "5px" });
  await page.screenshot({ path: "/tmp/oldtime-camera-reference-recording.png" });
  await page.locator("#ce-shutter").click();
  await edited();
  assert.equal(await page.locator(".cs-video-tools").isVisible(), true);
  const clip = await page.evaluate(async () => {
    const blob = new Blob(window.__captureChunks, { type: window.__captureChunks[0].type });
    return { type: blob.type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
  });
  assert.ok(clip.bytes.length > 0);
  await close();

  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 32;
    canvas.getContext("2d").fillRect(0, 0, 32, 32);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  for (const file of [
    { name: "picked-photo.png", mimeType: "image/png", buffer: Buffer.from(image, "base64") },
    { name: clip.type.includes("mp4") ? "picked-video.mp4" : "picked-video.webm", mimeType: clip.type, buffer: Buffer.from(clip.bytes) },
  ]) {
    await open();
    const choosing = page.waitForEvent("filechooser");
    await page.locator("#ce-camera-gallery-slot button[aria-label='Library']").click();
    await (await choosing).setFiles(file);
    await edited();
    assert.equal(await page.locator(".cs-rail").isVisible(), true);
    await close();
  }
}
