import { useState, type FormEvent } from "react";
import "./_group.css";
import "./_current.css";

type Glyph = "back" | "share" | "send" | "mic" | "camera" | "flip" | "close" | "speaker" | "mute";

const paths: Record<Glyph, string> = {
  back: '<path d="m15 18-6-6 6-6"/>',
  share: '<path d="M14 3h7v7M10 14 21 3"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  camera: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  flip: '<path d="M3 10a9 9 0 0 1 16-5l2 2M21 3v4h-4M21 14a9 9 0 0 1-16 5l-2-2M3 21v-4h4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  speaker: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4zM22 9l-6 6M16 9l6 6"/>',
};

function Icon({ name }: { name: Glyph }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: paths[name] }} />;
}

type Comment = { author: string; body: string };

export function Current() {
  const [soundOn, setSoundOn] = useState(false);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<Comment[]>([
    { author: "Mara", body: "That place looks so good." },
    { author: "You", body: "The last bowl before closing." },
  ]);

  const sendComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setComments((items) => [...items, { author: "You", body }]);
    setDraft("");
  };

  return (
    <main className="ot-app-live-current" aria-label="Current Old Time live room">
      <section className="live-room-screen">
        <div className="live-broadcast" role="img" aria-label="Live video from a neighborhood noodle shop">
          <img src="/__mockup/images/oldtime-late-noodles.jpg" alt="A late-night bowl of noodles" />
          <div className="live-video-shade" />
        </div>
        <header className="live-room-top">
          <button type="button" aria-label="Leave live"><Icon name="back" /></button>
          <div className="live-room-host">
            <img src="/__mockup/images/old-time-nova.jpg" alt="" />
            <div><b>Nova Reyes</b><small>Last bowl before we close</small></div>
          </div>
          <span className="live-pill"><i /> LIVE</span>
          <button type="button" aria-label="Share live link"><Icon name="share" /></button>
        </header>
        <div className="live-room-stats"><span className="live-viewer-dot" /><b>4</b><span>watching</span><span className="live-capacity">Small room · max 6</span></div>
        <div className="live-comments" aria-live="polite">
          {comments.slice(-4).map((comment, index) => <div className="live-comment" key={`${comment.author}-${index}`}><b>{comment.author}</b><span>{comment.body}</span></div>)}
        </div>
        <div className="live-room-bottom">
          <form className="live-comment-form" onSubmit={sendComment}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={280} placeholder="Say something kind" aria-label="Write a live comment" />
            <button type="submit" aria-label="Send comment"><Icon name="send" /></button>
          </form>
          <div className="live-room-controls">
            <button type="button" className={soundOn ? "" : "is-off"} aria-label={soundOn ? "Mute live audio" : "Unmute live audio"} aria-pressed={soundOn} onClick={() => setSoundOn((value) => !value)}><Icon name={soundOn ? "speaker" : "mute"} /><span>{soundOn ? "Sound on" : "Sound off"}</span></button>
            <button type="button" className="live-end" aria-label="Leave live"><Icon name="close" /><span>Leave</span></button>
          </div>
        </div>
      </section>
    </main>
  );
}
