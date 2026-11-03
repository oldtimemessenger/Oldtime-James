import { useState } from "react";
import "./_group.css";
import "./_current-call.css";

type Glyph = "back" | "speaker" | "mute" | "mic" | "camera" | "flip" | "phone" | "star" | "check";

const paths: Record<Glyph, string> = {
  back: '<path d="m15 18-6-6 6-6"/>',
  speaker: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4zM22 9l-6 6M16 9l6 6"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  camera: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 9 6-4v14l-6-4"/>',
  flip: '<path d="M3 10a9 9 0 0 1 16-5l2 2M21 3v4h-4M21 14a9 9 0 0 1-16 5l-2-2M3 21v-4h4"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3l2 5-2 2a16 16 0 0 0 6 6l2-2z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};

function Icon({ name, filled = false }: { name: Glyph; filled?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: paths[name] }} />;
}

export function CurrentCall() {
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [phase, setPhase] = useState<"active" | "rating" | "thanks">("active");
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");

  return (
    <main className="ot-app-call-current" aria-label="Current Old Time call screen">
      {phase === "active" ? (
        <section className="ot-card ot-call-active is-video">
          <div className="ot-call-stage">
            <img className="ot-current-remote" src="/__mockup/images/old-time-june.jpg" alt="June Park on a video call" />
            <div className="ot-call-shade" />
            <header className="ot-call-top">
              <span className="ot-call-brand">OLD TIME <i /> PRIVATE CALL</span>
              <div className="ot-call-top-actions">
                <button type="button" aria-label={speaker ? "Switch to earpiece" : "Switch to speaker"} aria-pressed={speaker} onClick={() => setSpeaker((value) => !value)}><Icon name={speaker ? "speaker" : "mute"} /></button>
                <button type="button" aria-label="Minimize call"><Icon name="back" /></button>
              </div>
            </header>
            <div className="ot-call-copy">
              <span className="ot-call-eyebrow">OLD TIME VIDEO</span>
              <h2>June Park</h2>
              <p>08:42</p>
              <small>In conversation</small>
            </div>
            <div className="ot-self-view">
              {cameraOn ? <img src="/__mockup/images/old-time-me.jpg" alt="Your camera preview" /> : <span className="ot-self-off">Camera off</span>}
              <span className="ot-self-label">YOU</span>
            </div>
          </div>
          <section className="ot-call-controls">
            <div className="ot-call-actions">
              <button type="button" className={`ot-control ${muted ? "is-selected" : ""}`} aria-label={muted ? "Unmute microphone" : "Mute microphone"} onClick={() => setMuted((value) => !value)}><Icon name={muted ? "mute" : "mic"} /><small>{muted ? "Unmute" : "Mute"}</small></button>
              <button type="button" className={`ot-control ${cameraOn ? "" : "is-selected"}`} aria-label={cameraOn ? "Turn camera off" : "Turn camera on"} onClick={() => setCameraOn((value) => !value)}><Icon name="camera" /><small>{cameraOn ? "Camera" : "Video off"}</small></button>
              <button type="button" className="ot-control" aria-label="Flip camera"><Icon name="flip" /><small>Flip</small></button>
              <button type="button" className="ot-control ot-end-call" aria-label="End call" onClick={() => setPhase("rating")}><Icon name="phone" /><small>End</small></button>
            </div>
            <p className="ot-call-privacy"><span />Your conversation stays between you and your friend.</p>
          </section>
        </section>
      ) : phase === "rating" ? (
        <section className="ot-card ot-post-call">
          <div className="ot-post-brand">OLD TIME <span>·</span> CALL ENDED · 08:42</div>
          <div className="ot-post-content">
            <div className="ot-post-avatar"><img src="/__mockup/images/old-time-june.jpg" alt="" /><span><Icon name="check" /></span></div>
            <span className="ot-call-eyebrow">A MOMENT TOGETHER</span>
            <h2>How was your<br />call with June?</h2>
            <p>Your feedback stays on this device.</p>
            <div className="ot-call-stars" role="radiogroup" aria-label="Rate your call">
              {[1, 2, 3, 4, 5].map((value) => <button type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? "" : "s"}`} className={rating >= value ? "on" : ""} key={value} onClick={() => setRating(value)}><Icon name="star" filled={rating >= value} /></button>)}
            </div>
            <label className="ot-call-note-label" htmlFor="current-call-note">Leave a note <span>OPTIONAL</span></label>
            <textarea id="current-call-note" maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a thought about this call…" />
            <small className="ot-call-note-count">{note.length}/240</small>
            <button type="button" className="ot-post-primary" disabled={!rating} onClick={() => setPhase("thanks")}>Save feedback <Icon name="check" /></button>
            <button type="button" className="ot-post-skip" onClick={() => setPhase("thanks")}>Not now</button>
          </div>
        </section>
      ) : (
        <section className="ot-card ot-post-call ot-post-thanks">
          <div className="ot-post-brand">OLD TIME <span>·</span> CALL ENDED</div>
          <div className="ot-thanks-mark"><Icon name="check" /></div>
          <span className="ot-call-eyebrow">A MOMENT TOGETHER</span>
          <h2>Thanks for<br />showing up.</h2>
          <p>{rating ? `Your ${rating}-star feedback${note.trim() ? " and note" : ""} is saved on this device.` : "You can share a little feedback after another call."}</p>
          <button type="button" className="ot-post-primary" onClick={() => setPhase("active")}>Back to Old Time</button>
        </section>
      )}
    </main>
  );
}
