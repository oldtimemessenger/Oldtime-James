import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent, MouseEvent } from "react";
import "./_group.css";

type LiveGlyph = "back" | "share" | "send" | "mic" | "speaker" | "close";

const paths: Record<LiveGlyph, string> = {
  back: '<path d="m15 18-6-6 6-6"/>',
  share: '<path d="M12 16.5H6.5C3.4 16.5.4 18 .4 20.5Q.4 16.7 2.4 15.3C4.2 12 7.5 8.4 12 8.4H12V1.2Q12 0 13 .9l10.1 9.8c1.2 1.1 1.2 1.3 0 2.6L13 23.1Q12 24 12 22.8v-6.3Z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  speaker: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};

function LiveIcon({ name, filled = false }: { name: LiveGlyph; filled?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: paths[name] }} />;
}

type Comment = { author: string; body: string };
type Heart = { id: number; x: number; y: number; tilt: number };

export function LiveRoom() {
  const [soundOn, setSoundOn] = useState(true);
  const [comments, setComments] = useState<Comment[]>([
    { author: "Mara", body: "That place looks so good." },
    { author: "You", body: "The last bowl before closing." },
  ]);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const [hearts, setHearts] = useState<Heart[]>([]);
  const heartId = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const commentsRef = useRef<HTMLDivElement>(null);

  const notify = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1750);
  };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (commentsRef.current) commentsRef.current.scrollTop = commentsRef.current.scrollHeight;
  }, [comments]);
  const sendHeart = (x = 82, y = 56) => {
    const id = ++heartId.current;
    setHearts((items) => [...items, { id, x, y, tilt: (id % 2 ? -1 : 1) * (7 + id % 7) }]);
    window.setTimeout(() => setHearts((items) => items.filter((item) => item.id !== id)), 1050);
  };
  const sendComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setComments((items) => [...items, { author: "You", body }]);
    setDraft("");
  };
  const shareLive = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("Live link copied");
    } catch {
      notify("Live link ready to share");
    }
  };
  const onBroadcastKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      sendHeart();
    }
  };

  return (
    <main className="otl-live" aria-label="Old Time Live room preview">
      <style>{`
        .otl-live{--li:#f3f2ee;position:relative;isolation:isolate;color:var(--li);background:#171817;font-family:Manrope,system-ui,sans-serif}
        .otl-live .l-stage{position:absolute;inset:0;overflow:hidden;cursor:pointer;background:radial-gradient(ellipse at 50% 35%,#55534c,#252624 57%,#141514)}
        .otl-live .l-stage>img{width:100%;height:100%;object-fit:cover;filter:saturate(.28) contrast(1.04);transform:scale(1.015)}
        .otl-live .l-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(9,10,10,.69),rgba(9,10,10,.06) 24%,rgba(9,10,10,.02) 48%,rgba(9,10,10,.34) 68%,rgba(9,10,10,.78))}
        .otl-live .l-top{position:absolute;z-index:4;top:max(14px,env(safe-area-inset-top));left:13px;right:13px;display:flex;align-items:center;gap:10px}
        .otl-live .l-top button{display:grid;flex:0 0 39px;width:39px;height:39px;place-items:center;border:1px solid rgba(255,255,255,.2);border-radius:50%;color:var(--li);background:rgba(18,19,18,.58);backdrop-filter:blur(12px);transition:transform .18s ease,background .18s ease}
        .otl-live .l-top button:active,.otl-live .l-actions button:active{transform:scale(.95)}.otl-live .l-top svg{width:17px;height:17px}
        .otl-live .l-identity{display:flex;flex:1;min-width:0;align-items:center;gap:9px}
        .otl-live .l-identity img{width:37px;height:37px;flex:0 0 auto;object-fit:cover;border:1px solid rgba(255,255,255,.58);border-radius:50%}
        .otl-live .l-host-copy{display:grid;min-width:0;gap:3px;text-shadow:0 1px 7px rgba(0,0,0,.5)}
        .otl-live .l-host-copy b{overflow:hidden;font-size:12px;font-weight:750;text-overflow:ellipsis;white-space:nowrap}
        .otl-live .l-host-copy small{overflow:hidden;color:rgba(255,255,255,.73);font-size:9px;text-overflow:ellipsis;white-space:nowrap}
        .otl-live .l-live-mark{display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid rgba(255,255,255,.19);border-radius:999px;color:#f7f6f1;background:rgba(18,19,18,.63);font-size:8px;font-weight:800;letter-spacing:.13em}
        .otl-live .l-live-mark i,.otl-live .l-audience i{width:6px;height:6px;flex:0 0 auto;border-radius:50%;background:#eeece5;box-shadow:0 0 0 3px rgba(255,255,255,.14)}
        .otl-live .l-audience{position:absolute;z-index:3;top:calc(max(14px,env(safe-area-inset-top)) + 53px);left:19px;display:flex;align-items:center;gap:7px;color:rgba(255,255,255,.87);font-size:10px;text-shadow:0 1px 5px #000}
        .otl-live .l-audience b{font-size:11px}.otl-live .l-audience span:last-child{margin-left:5px;color:rgba(255,255,255,.68);font-size:9px}
        .otl-live .l-comment-list{position:absolute;z-index:3;right:13px;bottom:calc(169px + env(safe-area-inset-bottom));left:13px;display:flex;max-height:min(24vh,185px);flex-direction:column;align-items:flex-start;gap:6px;overflow:auto;padding:8px 0 2px;scrollbar-width:none;mask-image:linear-gradient(transparent,#000 9%)}
        .otl-live .l-comment-list::-webkit-scrollbar{display:none}
        .otl-live .l-comment{display:flex;max-width:min(100%,340px);align-items:baseline;gap:7px;padding:7px 10px;border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#f5f4ef;background:rgba(18,19,18,.58);backdrop-filter:blur(11px);font-size:10px;line-height:1.35}
        .otl-live .l-comment b{flex:0 0 auto;color:#fff;font-size:9px;font-weight:800}.otl-live .l-comment span{overflow-wrap:anywhere}
        .otl-live .l-dock{position:absolute;z-index:5;right:12px;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 8px);left:12px;display:grid;gap:10px;padding:9px 10px 10px;border:1px solid rgba(255,255,255,.15);border-radius:19px;background:rgba(25,26,25,.87);box-shadow:0 16px 45px rgba(0,0,0,.23);backdrop-filter:blur(18px)}
        .otl-live .l-comment-form{display:flex;min-width:0;align-items:center;gap:8px;padding:3px 4px 3px 13px;border:1px solid rgba(255,255,255,.17);border-radius:999px;background:rgba(255,255,255,.065)}
        .otl-live .l-comment-form input{width:100%;min-width:0;height:34px;padding:0;border:0;outline:0;color:#f4f3ef;background:transparent;font-size:11px}
        .otl-live .l-comment-form input::placeholder{color:rgba(255,255,255,.58)}
        .otl-live .l-comment-form button{display:grid;width:32px;height:32px;flex:0 0 auto;place-items:center;border:1px solid rgba(255,255,255,.13);border-radius:50%;color:#f4f3ef;background:rgba(255,255,255,.12)}
        .otl-live .l-comment-form button svg{width:15px;height:15px}
        .otl-live .l-actions{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:8px}
        .otl-live .l-actions button{display:flex;min-width:0;height:43px;align-items:center;justify-content:center;gap:7px;border:1px solid rgba(255,255,255,.17);border-radius:999px;color:#eeede8;background:rgba(255,255,255,.075);font-size:9px;font-weight:750;transition:transform .18s ease,background .18s ease}
        .otl-live .l-actions button svg{width:16px;height:16px}.otl-live .l-actions button.is-off{color:rgba(255,255,255,.65);background:rgba(0,0,0,.18)}
        .otl-live .l-actions button.l-leave{color:#f5f4ef;background:#353635}
        .otl-live .l-hearts{position:absolute;z-index:2;inset:0;overflow:hidden;pointer-events:none}.otl-live .l-hearts .otl-heart-burst{fill:#f3f2ee;filter:drop-shadow(0 3px 10px rgba(0,0,0,.42))}
        .otl-live .l-toast{position:absolute;z-index:10;bottom:calc(170px + env(safe-area-inset-bottom));left:50%;max-width:calc(100% - 32px);padding:10px 14px;transform:translateX(-50%);border:1px solid rgba(255,255,255,.2);border-radius:999px;color:#f4f3ef;background:rgba(26,27,26,.95);box-shadow:0 8px 28px rgba(0,0,0,.25);font-size:10px;font-weight:700;white-space:nowrap;animation:ot-soft-in .2s ease both}
        .otl-live :where(button,input):focus-visible{outline:2px solid #f3f2ee;outline-offset:3px}
        @media(min-width:760px){.otl-live .l-top{right:max(18px,calc((100vw - 560px)/2));left:max(18px,calc((100vw - 560px)/2))}.otl-live .l-dock{right:auto;left:50%;width:min(calc(100% - 36px),540px);transform:translateX(-50%)}.otl-live .l-comment-list{right:max(24px,calc((100vw - 520px)/2));left:max(24px,calc((100vw - 520px)/2))}}
        @media(max-height:650px){.otl-live .l-comment-list{bottom:calc(151px + env(safe-area-inset-bottom));max-height:18vh}.otl-live .l-dock{gap:7px;padding-top:7px;padding-bottom:7px}.otl-live .l-actions button{height:38px}}
      `}</style>
      <div className="l-stage" onClick={(event: MouseEvent<HTMLDivElement>) => { const rect = event.currentTarget.getBoundingClientRect(); sendHeart(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100); }} onKeyDown={onBroadcastKeyDown} role="button" tabIndex={0} aria-label="Tap the live video to send hearts">
        <img src="/__mockup/images/oldtime-late-noodles.jpg" alt="Live from a neighborhood noodle shop after closing" />
        <div className="l-shade" />
        <div className="l-hearts" aria-hidden="true">{hearts.map((heart) => <svg key={heart.id} className="otl-heart-burst" style={{ left: `${heart.x}%`, top: `${heart.y}%`, "--tilt": `${heart.tilt}deg`, "--drift": `${heart.tilt * 1.6}px` } as CSSProperties} viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" /></svg>)}</div>
      </div>
      <header className="l-top">
        <button type="button" aria-label="Leave live room" onClick={() => notify("You left the live room")}><LiveIcon name="back" /></button>
        <div className="l-identity"><img src="/__mockup/images/old-time-nova.jpg" alt="" /><div className="l-host-copy"><b>Nova Reyes</b><small>Last bowl before we close</small></div></div>
        <span className="l-live-mark"><i /> LIVE</span>
        <button type="button" aria-label="Share live link" onClick={shareLive}><LiveIcon name="share" /></button>
      </header>
      <div className="l-audience"><i /><b>4</b><span>watching</span><span>Small room · max 6</span></div>
      <div className="l-comment-list" ref={commentsRef} aria-live="polite" aria-label="Live comments">
        {comments.slice(-4).map((comment, index) => <div className="l-comment" key={`${comment.author}-${index}`}><b>{comment.author}</b><span>{comment.body}</span></div>)}
      </div>
      <div className="l-dock">
        <form className="l-comment-form" onSubmit={sendComment}><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={280} placeholder="Say something kind" aria-label="Write a live comment" /><button type="submit" aria-label="Send comment"><LiveIcon name="send" /></button></form>
        <div className="l-actions">
          <button type="button" className={soundOn ? "" : "is-off"} aria-label={soundOn ? "Mute live audio" : "Unmute live audio"} aria-pressed={soundOn} onClick={() => setSoundOn((on) => !on)}><LiveIcon name="speaker" /><span>{soundOn ? "Sound on" : "Sound off"}</span></button>
          <button type="button" className="l-leave" aria-label="Leave live room" onClick={() => notify("You left the live room")}><LiveIcon name="close" /><span>Leave</span></button>
        </div>
      </div>
      {toast && <div className="l-toast" role="status">{toast}</div>}
    </main>
  );
}
