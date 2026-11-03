export const MAIN_SECTIONS = ["updates", "blast", "communities", "chat", "search"];

export function nextSection(current, dx, dy, elapsed = 0, sections = MAIN_SECTIONS) {
  const index = sections.indexOf(current);
  if (index < 0 || elapsed > 900 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.7) return null;
  return sections[index + (dx < 0 ? 1 : -1)] || null;
}

export function ownsHorizontalGesture(target, root, style = globalThis.getComputedStyle) {
  if (!target?.closest || target.closest(
    "input,textarea,select,[contenteditable=true],[role=slider],[role=dialog],[data-swipe-owner],.carousel,.post-carousel,.maplibregl-map,.mapboxgl-map,.places-map,.emoji-overlay,.creative-editor,.sc-root,.storyview,.sheet,.nav,.gob,.ch-back,.pp-back,details"
  )) return true;
  for (let node = target; node && node !== root; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 4 && /auto|scroll/.test(style(node).overflowX)) return true;
  }
  return false;
}

// Native horizontal scrollers and controls retain their own gestures.
// Passive touch listeners leave normal vertical scrolling unchanged.
export function bindSectionSwipes({ root, current, enabled, navigate, style, sections = () => MAIN_SECTIONS }) {
  let start = null,suppressClickUntil=0;
  const reduced=()=>globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
  const surface=()=>root.querySelector?.(".screen.on,.screen,.chat-page,.ch-app")||null;
  const restore=gesture=>{
    if(!gesture?.element?.style)return;
    gesture.element.style.transform=gesture.transform;
    gesture.element.style.willChange=gesture.willChange;
  };
  root.addEventListener("click",event=>{
    if(Date.now()>suppressClickUntil)return;
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  root.addEventListener("touchstart", event => {
    restore(start);
    start = null;
    if (!enabled() || event.touches.length !== 1 || ownsHorizontalGesture(event.target, root, style)) return;
    const touch = event.touches[0];
    const element=surface();
    start = { x: touch.clientX, y: touch.clientY, time: event.timeStamp, section: current(),element,
      transform:element?.style?.transform||"",willChange:element?.style?.willChange||"",locked:false };
  }, { passive: true });
  root.addEventListener("touchmove", event => {
    if (!start) return;
    if (event.touches.length !== 1) { restore(start);start = null; return; }
    const touch = event.touches[0];
    // Once the gesture is vertical, it belongs to feed/page scrolling.
    const dx=touch.clientX-start.x,dy=touch.clientY-start.y;
    if(!start.locked && Math.abs(dy)>20 && Math.abs(dy)>Math.abs(dx)){restore(start);start=null;return;}
    if(!start.locked && Math.abs(dx)>14 && Math.abs(dx)>Math.abs(dy)*1.7)start.locked=true;
    if(!start.locked)return;
    if(event.cancelable)event.preventDefault();
    if(!reduced() && start.element?.style){
      const width=start.element.clientWidth||390,offset=Math.max(-width*.45,Math.min(width*.45,dx*.85));
      start.element.style.willChange="transform";
      start.element.style.transform=`translate3d(${offset}px,0,0)`;
    }
  }, { passive: false });
  root.addEventListener("touchcancel", () => {restore(start);start = null; }, { passive: true });
  root.addEventListener("touchend", event => {
    const gesture = start; start = null;
    restore(gesture);
    if (!gesture || !enabled() || current() !== gesture.section || !event.changedTouches.length) return;
    if(gesture.locked)suppressClickUntil=Date.now()+300;
    const touch = event.changedTouches[0];
    const section = nextSection(gesture.section, touch.clientX - gesture.x, touch.clientY - gesture.y, event.timeStamp - gesture.time, sections());
    if (section) {
      suppressClickUntil=Date.now()+300;
      navigate(section);
      const next=surface();
      if(!reduced())next?.animate?.([
        {transform:`translate3d(${touch.clientX<gesture.x?32:-32}px,0,0)`,opacity:.86},
        {transform:"translate3d(0,0,0)",opacity:1},
      ],{duration:230,easing:"cubic-bezier(.2,.7,.2,1)"});
    }
  }, { passive: true });
}
