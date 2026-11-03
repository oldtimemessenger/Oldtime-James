import { useEffect, useState } from "react";
import "./_group.css";

type CallGlyph = "back" | "speaker" | "mic" | "video" | "flip" | "phone" | "star" | "check";

const iconPaths: Record<CallGlyph, string> = {
  back: '<path d="m15 18-6-6 6-6"/>',
  speaker: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 9 6-4v14l-6-4"/>',
  flip: '<path d="M3 10a9 9 0 0 1 16-5l2 2M21 3v4h-4M21 14a9 9 0 0 1-16 5l-2-2M3 21v-4h4"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3l2 5-2 2a16 16 0 0 0 6 6l2-2z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};

function CallIcon({ name, filled = false }: { name: CallGlyph; filled?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: iconPaths[name] }} />;
}

export function VideoCall() {
  const [phase, setPhase] = useState<"active" | "minimized" | "rating" | "sent">("active");
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [frontCamera, setFrontCamera] = useState(true);
  const [seconds, setSeconds] = useState(8 * 60 + 42);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (phase !== "active" && phase !== "minimized") return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  const time = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  return (
    <main className={`otc-call ${phase === "active" || phase === "minimized" ? "is-active" : "is-after-call"}`} aria-label="Old Time video call preview">
      <style>{`
        .otc-call{position:relative;display:grid;place-items:center;overflow:hidden;color:#242522;background:#f1f0ec;font-family:Manrope,system-ui,sans-serif}
        .otc-call,.otc-call *{box-sizing:border-box}.otc-call button,.otc-call textarea{font:inherit}.otc-call button{color:inherit;cursor:pointer}
        .otc-call .c-active{display:flex;width:min(100%,520px);height:100%;flex-direction:column;gap:11px;padding:max(12px,env(safe-area-inset-top)) 14px max(13px,env(safe-area-inset-bottom));}
        .otc-call .c-head{display:flex;min-height:43px;align-items:center;justify-content:space-between;padding:0 2px}
        .otc-call .c-brand{display:grid;gap:2px}.otc-call .c-brand b{font-size:11px;font-weight:850;letter-spacing:.13em}.otc-call .c-brand small{color:#777872;font-size:8px;letter-spacing:.11em}
        .otc-call .c-private{display:flex;align-items:center;gap:6px;color:#676862;font-size:8px;font-weight:800;letter-spacing:.12em}
        .otc-call .c-private i{width:5px;height:5px;border-radius:50%;background:#6c7068}
        .otc-call .c-minimize{display:grid;width:36px;height:36px;place-items:center;border:1px solid #d4d4cf;border-radius:50%;color:#383935;background:#faf9f6}
        .otc-call .c-minimize svg{width:16px;height:16px;transform:rotate(-90deg)}
        .otc-call .c-stage{position:relative;flex:1;min-height:0;overflow:hidden;border:1px solid rgba(31,32,30,.1);border-radius:23px;background:#55554f;box-shadow:0 12px 35px rgba(40,40,35,.11)}
        .otc-call .c-stage>img{width:100%;height:100%;object-fit:cover;object-position:center 38%;filter:saturate(.76)}
        .otc-call .c-stage-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(14,15,14,.13),transparent 36%,transparent 56%,rgba(14,15,14,.58))}
        .otc-call .c-stage-meta{position:absolute;right:18px;bottom:21px;left:18px;display:grid;gap:5px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.34)}
        .otc-call .c-stage-meta>span{font-size:8px;font-weight:800;letter-spacing:.16em;color:rgba(255,255,255,.8)}
        .otc-call .c-stage-meta h1{margin:0;font-family:Fraunces,Georgia,serif;font-size:clamp(28px,8vw,38px);font-weight:560;line-height:1.03;letter-spacing:-.035em}
        .otc-call .c-stage-meta p{margin:0;color:rgba(255,255,255,.8);font-size:10px}
        .otc-call .c-timer{display:flex;align-items:center;gap:7px;margin-top:5px;color:rgba(255,255,255,.9);font-size:10px;font-variant-numeric:tabular-nums}
        .otc-call .c-timer i{width:5px;height:5px;border-radius:50%;background:#eee}
        .otc-call .c-self{position:absolute;top:14px;right:14px;width:clamp(78px,24vw,105px);aspect-ratio:3/4;overflow:hidden;border:2px solid rgba(255,255,255,.88);border-radius:15px;background:#44443f;box-shadow:0 6px 19px rgba(0,0,0,.18)}
        .otc-call .c-self>img{width:100%;height:100%;object-fit:cover;transition:transform .2s ease}.otc-call .c-self.flipped>img{transform:scaleX(-1)}
        .otc-call .c-self-label{position:absolute;bottom:6px;left:6px;padding:3px 5px;border-radius:4px;color:#fff;background:rgba(20,21,20,.58);font-size:7px;font-weight:850;letter-spacing:.1em}
        .otc-call .c-camera-off{display:grid;width:100%;height:100%;align-content:center;justify-items:center;gap:8px;color:rgba(255,255,255,.82);background:#393a36;font-size:8px}
        .otc-call .c-camera-off svg{width:20px;height:20px}
        .otc-call .c-controls{display:grid;gap:11px;padding:8px 0 1px}
        .otc-call .c-actions{display:flex;align-items:flex-start;justify-content:space-between;gap:5px}
        .otc-call .c-action{display:grid;min-width:0;justify-items:center;gap:7px;padding:0;border:0;background:transparent}
        .otc-call .c-action>span{display:grid;width:47px;height:47px;place-items:center;border:1px solid #d8d8d2;border-radius:50%;color:#333430;background:#faf9f6;transition:transform .18s ease,background .18s ease}
        .otc-call .c-action:active>span{transform:scale(.94)}
        .otc-call .c-action svg{width:19px;height:19px}
        .otc-call .c-action small{color:#595a54;font-size:8px;font-weight:750}
        .otc-call .c-action.selected>span,.otc-call .c-action.muted>span{color:#242522;background:#deded8}
        .otc-call .c-action.c-end>span{color:#f3f2ee;border-color:#292a28;background:#292a28}
        .otc-call .c-action.c-end svg{transform:rotate(135deg)}
        .otc-call .c-privacy{display:flex;justify-content:center;align-items:center;gap:6px;color:#83847d;font-size:8px;text-align:center}
        .otc-call .c-privacy i{width:4px;height:4px;border-radius:50%;background:#73766e}
        .otc-call .c-minimized{display:flex;width:min(calc(100% - 26px),420px);align-items:center;gap:12px;padding:11px;border:1px solid #d9d8d2;border-radius:19px;color:#252623;background:#faf9f6;box-shadow:0 14px 45px rgba(35,35,31,.13);animation:ot-soft-in .24s ease both}
        .otc-call .c-mini-photo{width:55px;height:60px;flex:0 0 auto;overflow:hidden;border-radius:12px;background:#555}.otc-call .c-mini-photo img{width:100%;height:100%;object-fit:cover}
        .otc-call .c-mini-copy{display:grid;flex:1;gap:4px;min-width:0}.otc-call .c-mini-copy b{font-size:11px}.otc-call .c-mini-copy small{color:#73746e;font-size:9px}
        .otc-call .c-mini-actions{display:flex;gap:6px}.otc-call .c-mini-actions button{min-height:37px;padding:0 11px;border:1px solid #d9d8d2;border-radius:999px;background:#f2f1ed;font-size:9px;font-weight:750}
        .otc-call .c-mini-actions button:last-child{color:#f1f0ec;border-color:#2c2d2a;background:#2c2d2a}
        .otc-call.is-after-call{display:block;overflow-y:auto;background:#f1f0ec;scrollbar-width:none}.otc-call.is-after-call::-webkit-scrollbar{display:none}
        .otc-call .c-post{position:relative;display:flex;width:100%;min-height:100%;flex-direction:column;padding:max(18px,env(safe-area-inset-top)) 22px max(18px,env(safe-area-inset-bottom));}
        .otc-call .c-post-top{display:flex;align-items:center;justify-content:space-between;color:#343530}
        .otc-call .c-post-top b{font-size:10px;font-weight:850;letter-spacing:.13em}.otc-call .c-post-top small{color:#777872;font-size:8px;font-weight:800;letter-spacing:.1em}
        .otc-call .c-post-content{display:grid;width:min(100%,370px);justify-items:center;gap:12px;margin:auto;align-self:center;padding:20px 0;animation:ot-soft-in .3s ease both}
        .otc-call .c-avatar{position:relative;width:70px;height:70px;margin-bottom:3px}
        .otc-call .c-avatar img{width:100%;height:100%;border:2px solid #deddd7;border-radius:50%;object-fit:cover}
        .otc-call .c-avatar>span{position:absolute;right:-2px;bottom:-1px;display:grid;width:23px;height:23px;place-items:center;border:2px solid #f1f0ec;border-radius:50%;color:#f1f0ec;background:#353632}
        .otc-call .c-avatar svg{width:12px;height:12px}
        .otc-call .c-eyebrow{color:#74756e;text-align:center;font-size:8px;font-weight:850;letter-spacing:.17em}
        .otc-call .c-post h1{margin:0;color:#262723;text-align:center;font-family:Fraunces,Georgia,serif;font-size:clamp(30px,8vw,39px);font-weight:560;line-height:1.02;letter-spacing:-.035em}
        .otc-call .c-post-content>p,.otc-call .c-thanks>p{max-width:280px;margin:0;color:#73746e;text-align:center;font-size:10px;line-height:1.55}
        .otc-call .c-stars{display:flex;justify-content:center;gap:8px;margin:8px 0 5px}
        .otc-call .c-stars button{display:grid;width:40px;height:40px;place-items:center;border:1px solid #d9d8d2;border-radius:50%;color:#a4a49e;background:#f8f7f3}
        .otc-call .c-stars button.on{color:#292a27;background:#e1e0da}
        .otc-call .c-stars svg{width:19px;height:19px}
        .otc-call .c-note-label{display:flex;width:100%;justify-content:space-between;color:#3f403b;font-size:10px;font-weight:750}
        .otc-call .c-note-label span{color:#8a8b84;font-size:7px;font-weight:800;letter-spacing:.13em}
        .otc-call .c-post textarea{width:100%;min-height:76px;resize:vertical;padding:11px 12px;border:1px solid #d9d8d2;border-radius:12px;outline:none;color:#292a27;background:#faf9f6;font-size:11px}
        .otc-call .c-post textarea::placeholder{color:#9a9b94}
        .otc-call .c-count{justify-self:end;margin-top:-8px;color:#8a8b84;font-size:8px}
        .otc-call .c-save,.otc-call .c-return{display:flex;width:100%;min-height:46px;align-items:center;justify-content:center;gap:8px;margin-top:2px;border:1px solid #292a27;border-radius:13px;color:#f3f2ee;background:#292a27;font-size:10px;font-weight:800}
        .otc-call .c-save:disabled{border-color:#d6d5d0;color:#a6a69f;background:#deddd7;cursor:not-allowed}
        .otc-call .c-save svg{width:15px;height:15px}
        .otc-call .c-skip{padding:7px 12px;border:0;color:#686963;background:transparent;font-size:10px;font-weight:700}
        .otc-call .c-foot{padding-top:16px;color:#888982;text-align:center;font-size:9px}
        .otc-call .c-thanks{align-items:center;justify-content:center;text-align:center}
        .otc-call .c-thanks-mark{display:grid;width:52px;height:52px;place-items:center;margin-bottom:4px;border:1px solid #d0cfc9;border-radius:50%;color:#333430;background:#e7e6e0}
        .otc-call .c-thanks-mark svg{width:21px;height:21px}
        .otc-call .c-thanks .c-eyebrow{margin-top:2px}
        .otc-call :where(button,textarea):focus-visible{outline:2px solid #51524d;outline-offset:3px}
        @media(min-width:760px){.otc-call{padding:18px}.otc-call .c-active{height:min(920px,calc(100dvh - 36px));border:1px solid #dfded9;border-radius:28px;background:#f1f0ec;box-shadow:0 15px 54px rgba(40,40,35,.08)}.otc-call .c-post{width:min(100%,500px);min-height:min(920px,calc(100dvh - 36px));margin:auto;border:1px solid #dfded9;border-radius:28px;background:#f1f0ec;box-shadow:0 15px 54px rgba(40,40,35,.08)}}
        @media(max-height:660px){.otc-call .c-active{gap:7px;padding-top:max(8px,env(safe-area-inset-top));padding-bottom:max(8px,env(safe-area-inset-bottom))}.otc-call .c-actions{gap:2px}.otc-call .c-action>span{width:40px;height:40px}.otc-call .c-controls{gap:6px}.otc-call .c-post-content{gap:8px}.otc-call .c-avatar{width:55px;height:55px}.otc-call .c-post textarea{min-height:54px}}
      `}</style>
      {phase === "active" ? (
        <section className="c-active">
          <header className="c-head">
            <div className="c-brand"><b>OLD TIME</b><small>VIDEO CALL</small></div>
            <span className="c-private"><i /> PRIVATE CALL</span>
            <button className="c-minimize" type="button" aria-label="Minimize call" onClick={() => setPhase("minimized")}><CallIcon name="back" /></button>
          </header>
          <div className="c-stage">
            <img src="/__mockup/images/old-time-june.jpg" alt="June Park on a video call" />
            <div className="c-stage-shade" />
            <div className={`c-self ${frontCamera ? "" : "flipped"}`}>
              {cameraOn ? <img src="/__mockup/images/old-time-me.jpg" alt="Your camera preview" /> : <div className="c-camera-off"><CallIcon name="video" /><span>Camera off</span></div>}
              <span className="c-self-label">YOU</span>
            </div>
            <div className="c-stage-meta"><span>OLD TIME VIDEO</span><h1>June Park</h1><div className="c-timer"><i /> {time}</div></div>
          </div>
          <section className="c-controls">
            <div className="c-actions">
              <button type="button" className={`c-action ${muted ? "muted" : ""}`} aria-label={muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={muted} onClick={() => setMuted((value) => !value)}><span><CallIcon name="mic" /></span><small>{muted ? "Unmute" : "Mute"}</small></button>
              <button type="button" className={`c-action ${speaker ? "selected" : ""}`} aria-label={speaker ? "Switch to earpiece" : "Switch to speaker"} aria-pressed={speaker} onClick={() => setSpeaker((value) => !value)}><span><CallIcon name="speaker" /></span><small>{speaker ? "Speaker" : "Earpiece"}</small></button>
              <button type="button" className={`c-action ${cameraOn ? "" : "muted"}`} aria-label={cameraOn ? "Turn camera off" : "Turn camera on"} aria-pressed={cameraOn} onClick={() => setCameraOn((value) => !value)}><span><CallIcon name="video" /></span><small>{cameraOn ? "Camera" : "Video off"}</small></button>
              <button type="button" className="c-action" aria-label="Flip camera" onClick={() => setFrontCamera((value) => !value)}><span><CallIcon name="flip" /></span><small>Flip</small></button>
              <button type="button" className="c-action c-end" aria-label="End call" onClick={() => setPhase("rating")}><span><CallIcon name="phone" /></span><small>End</small></button>
            </div>
            <div className="c-privacy"><i /> Your call stays between you and your friend</div>
          </section>
        </section>
      ) : phase === "minimized" ? (
        <section className="c-minimized" aria-label="Call minimized">
          <div className="c-mini-photo"><img src="/__mockup/images/old-time-june.jpg" alt="" /></div>
          <div className="c-mini-copy"><b>June Park</b><small>Call in progress · {time}</small></div>
          <div className="c-mini-actions"><button type="button" aria-label="Return to call" onClick={() => setPhase("active")}>Return</button><button type="button" aria-label="End call" onClick={() => setPhase("rating")}>End</button></div>
        </section>
      ) : phase === "rating" ? (
        <section className="c-post">
          <div className="c-post-top"><b>OLD TIME</b><small>CALL ENDED · {time}</small></div>
          <div className="c-post-content">
            <div className="c-avatar"><img src="/__mockup/images/old-time-june.jpg" alt="" /><span><CallIcon name="check" /></span></div>
            <span className="c-eyebrow">A MOMENT TOGETHER</span>
            <h1>How was your<br />call with June?</h1>
            <p>Your feedback stays on this device.</p>
            <div className="c-stars" role="radiogroup" aria-label="Rate your call">
              {[1, 2, 3, 4, 5].map((value) => <button type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? "" : "s"}`} className={rating >= value ? "on" : ""} key={value} onClick={() => setRating(value)}><CallIcon name="star" filled={rating >= value} /></button>)}
            </div>
            <label className="c-note-label" htmlFor="otc-call-message">Leave June a note <span>OPTIONAL</span></label>
            <textarea id="otc-call-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={240} placeholder="Something you want them to know…" />
            <div className="c-count">{message.length}/240</div>
            <button type="button" className="c-save" disabled={!rating} onClick={() => setPhase("sent")}>Save feedback <CallIcon name="check" /></button>
            <button type="button" className="c-skip" onClick={() => setPhase("sent")}>Not now</button>
          </div>
          <div className="c-foot">A kind word can make someone’s day.</div>
        </section>
      ) : (
        <section className="c-post c-thanks">
          <div className="c-post-top"><b>OLD TIME</b><small>CALL ENDED</small></div>
          <div className="c-post-content c-thanks">
            <div className="c-thanks-mark"><CallIcon name="check" /></div>
            <span className="c-eyebrow">THAT’S A WRAP</span>
            <h1>Thanks for<br />showing up.</h1>
            <p>{rating ? `Your ${rating}-star feedback${message.trim() ? " and note" : ""} is saved on this device.` : "You can always share a little kindness next time."}</p>
            <button className="c-return" type="button" onClick={() => { setPhase("active"); setSeconds(0); setRating(0); setMessage(""); }}>Back to your moments</button>
          </div>
        </section>
      )}
    </main>
  );
}
