const ignored = "textarea,input,[contenteditable=true],.creative-editor,.camera-screen";

export function shouldShowPageTop(top, height, scrollHeight) {
  return height > 180 && scrollHeight > height + 1
    && top > Math.max(600, height * 1.5);
}

export function installPageTopControl(root, { onScreenChange = () => {} } = {}) {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "page-top-control";
  button.setAttribute("aria-label", "Back to top");
  button.title = "Back to top";
  button.hidden = true;
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>';
  doc.body.append(button);
  let scroller = null;
  let frame = 0;
  const eligible = element => element?.isConnected
    && !element.matches?.(ignored) && !element.closest?.(".creative-editor,.camera-screen")
    && element.clientHeight > 180 && element.scrollHeight > element.clientHeight + 1;
  const update = () => {
    frame = 0;
    const screen = root.querySelector(".screen.on");
    if (!screen || screen.classList.contains("home-screen") || root.querySelector(".sheet.on,#storyview.on,.creative-editor,.app-drawer:not([hidden])")) {
      button.hidden = true;
      return;
    }
    if (!eligible(scroller) || !(screen === scroller || screen.contains(scroller) || scroller === doc.scrollingElement)) {
      scroller = [...screen.querySelectorAll("[data-scroll-preserve],.scroll,.feed,.stories-feed-scroll,.settings-scroll"), screen, doc.scrollingElement]
        .filter(eligible).sort((a,b) => b.scrollTop-a.scrollTop)[0] || null;
    }
    button.hidden = !scroller || !shouldShowPageTop(scroller.scrollTop,scroller.clientHeight,scroller.scrollHeight);
    button.style.left = `${Math.max(14,root.getBoundingClientRect().left+14)}px`;
  };
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(update); };
  const scroll = event => {
    const target = event.target === doc ? doc.scrollingElement : event.target;
    if (eligible(target) && (root.contains(target) || target === doc.scrollingElement)) {
      scroller = target;
      schedule();
    }
  };
  button.onclick = () => {
    if (!eligible(scroller)) return schedule();
    const reduced = win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({top:0,behavior:reduced ? "instant" : "smooth"});
  };
  const observer = new win.MutationObserver(() => { onScreenChange(); schedule(); });
  observer.observe(root,{childList:true});
  doc.addEventListener("scroll",scroll,{capture:true,passive:true});
  doc.addEventListener("click",schedule,true);
  doc.addEventListener("keydown",schedule,true);
  win.addEventListener("resize",schedule,{passive:true});
  schedule();
  return () => {
    observer.disconnect();
    doc.removeEventListener("scroll",scroll,true);
    doc.removeEventListener("click",schedule,true);
    doc.removeEventListener("keydown",schedule,true);
    win.removeEventListener("resize",schedule);
    if (frame) win.cancelAnimationFrame(frame);
    button.remove();
  };
}
