import assert from "node:assert/strict";

export async function verifyMediaBrowsingControls(page) {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.evaluate(()=>{
    const pane=document.querySelector(".stories-feed-scroll");
    const spacer=document.createElement("div");
    spacer.id="scroll-test-spacer";
    spacer.style.height="3600px";
    pane.append(spacer);
    pane.scrollTop=1900;
  });
  const top=page.locator(".page-top-control");
  await top.waitFor({state:"visible"});
  await page.screenshot({path:"/tmp/oldtime-back-to-top-verified.png"});
  await top.click();
  await page.waitForFunction(()=>document.querySelector(".stories-feed-scroll").scrollTop===0);
  await top.waitFor({state:"hidden"});
  await page.evaluate(async()=>{
    document.querySelector("#scroll-test-spacer").remove();
    const card=document.createElement("article");
    card.className="community-post-card";
    card.innerHTML='<div class="community-post-media"><button type="button" class="community-post-media-item" data-stories-post="float-check"><video muted playsinline style="width:100%;height:240px"></video></button><button type="button" class="clip-float-control" data-video-float="float-check" aria-label="Continue video in a floating player">Float</button></div>';
    document.querySelector(".stories-feed-scroll").append(card);
    const video=card.querySelector("video");
    const canvas=document.createElement("canvas");
    canvas.width=160;canvas.height=90;
    const context=canvas.getContext("2d");
    const draw=()=>{context.fillStyle="#a92536";context.fillRect(0,0,160,90);context.fillStyle="#fff";context.fillText(String(Date.now()),8,40);};
    draw();
    const timer=setInterval(draw,60);
    const stream=canvas.captureStream(15);
    video.srcObject=stream;
    window.floatCheck={video,stream,timer};
    await video.play();
  });
  await page.waitForFunction(()=>window.floatCheck.video.currentTime>0.2);
  const time=await page.evaluate(()=>window.floatCheck.video.currentTime);
  await page.locator('[data-video-float="float-check"]').click();
  const player=page.locator('[data-testid="floating-video-player"]');
  await player.waitFor({state:"visible"});
  assert.equal(await page.evaluate(()=>document.querySelector(".ot-video-float video")===window.floatCheck.video),true);
  assert.ok(await page.evaluate(()=>window.floatCheck.video.currentTime)>=time);
  await page.locator("[data-video-play]").click();
  await page.waitForFunction(()=>window.floatCheck.video.paused);
  assert.equal(await page.locator("[data-video-play]").getAttribute("aria-label"),"Play video");
  await page.locator("[data-video-play]").click();
  await page.waitForFunction(()=>!window.floatCheck.video.paused);
  await page.locator("[data-video-expand]").click();
  assert.match(await player.getAttribute("class"),/is-expanded/);
  await page.locator("[data-video-expand]").click();
  await page.locator('.nav [data-tab="updates"]').click();
  await page.locator('button.icon[data-tab="search"]').click();
  await page.waitForFunction(()=>!document.querySelector(".community-screen"));
  assert.equal(await player.count(),1);
  assert.equal(await page.evaluate(()=>window.floatCheck.video.isConnected&&!window.floatCheck.video.paused),true);
  await top.waitFor({state:"hidden"});
  await page.screenshot({path:"/tmp/oldtime-floating-video-verified.png"});
  await page.locator("[data-video-close]").click();
  await player.waitFor({state:"detached"});
  assert.equal(await page.evaluate(()=>window.floatCheck.video.paused&&!window.floatCheck.video.isConnected),true);
  await page.evaluate(()=>{
    window.floatCheck.stream.getTracks().forEach(track=>track.stop());
    clearInterval(window.floatCheck.timer);
  });
}
