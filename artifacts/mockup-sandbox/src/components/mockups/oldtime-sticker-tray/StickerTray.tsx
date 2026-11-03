import { useRef, useState, type PointerEvent } from "react";
import {
  ArrowDownRight, ArrowLeft, AudioLines, Check, Copy, Hash, Heart, MapPin,
  MessageCircle, Minus, Music2, Plus,
  RotateCw, Trash2, Type, X,
} from "lucide-react";
import "./_group.css";

type Kind = "original" | "poll" | "question" | "hey" | "reaction" | "emoji" | "text" | "place" | "handle" | "audio";
type Sticker = {
  id: string;
  kind: Kind;
  label: string;
  detail: string;
  value?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  response?: string;
  choices?: [string, string];
};

const options: { kind: Kind; label: string; sub: string }[] = [
  { kind: "original", label: "Oldtime", sub: "Original art" },
  { kind: "poll", label: "Poll", sub: "Choose an answer" },
  { kind: "question", label: "Question", sub: "Invite a reply" },
  { kind: "hey", label: "Hey Word", sub: "Story prompt" },
  { kind: "reaction", label: "Reaction", sub: "Quick response" },
  { kind: "emoji", label: "Emoji", sub: "Pick an expression" },
  { kind: "text", label: "Text", sub: "Make it yours" },
  { kind: "place", label: "Place", sub: "Text label only" },
  { kind: "handle", label: "Handle", sub: "Text label only" },
  { kind: "audio", label: "Audio", sub: "Text label only" },
];

const starterStickers: Sticker[] = [
  { id: "welcome", kind: "original", label: "Oldtime", value: "GOOD DAYS, GOOD PEOPLE", detail: "", x: 51, y: 33, scale: 1, rotation: -7 },
];

const emojiChoices = ["🙌", "🫶", "😂", "👀", "🥹", "🔥"];
const createsForm = (kind: Kind) => ["poll", "question", "hey", "emoji", "text", "place", "handle", "audio"].includes(kind);

function Art({ kind }: { kind: Kind }) {
  if (kind === "original") {
    return <span className="oldtime-mark" aria-hidden="true"><span className="mark-sun" /><b>OT</b><i>OLDTIME</i></span>;
  }
  if (kind === "poll") return <span className="mini-poll-art" aria-hidden="true"><i /><i /><i /></span>;
  if (kind === "question" || kind === "hey") return <span className={`mini-prompt-art ${kind}`} aria-hidden="true"><MessageCircle size={20} /><b>{kind === "hey" ? "HEY!" : "?"}</b></span>;
  if (kind === "reaction") return <span className="mini-reaction-art" aria-hidden="true"><Heart size={25} fill="currentColor" /></span>;
  if (kind === "emoji") return <span className="mini-emoji-art" aria-hidden="true">🙌</span>;
  if (kind === "text") return <span className="mini-text-art" aria-hidden="true"><Type size={24} /><b>Aa</b></span>;
  const Icon = kind === "place" ? MapPin : kind === "handle" ? Hash : AudioLines;
  return <span className="mini-label-art" aria-hidden="true"><Icon size={21} /><b>{kind === "place" ? "PLACE" : kind === "handle" ? "HANDLE" : "AUDIO"}</b></span>;
}

function StickerVisual({ sticker, onResponse }: { sticker: Sticker; onResponse: (value: string) => void }) {
  if (sticker.kind === "original") {
    return <div className="placed-oldtime"><span>OLDTIME</span><b>{sticker.value || "GOOD DAYS, GOOD PEOPLE"}</b><i>EST. IN GOOD COMPANY</i></div>;
  }
  if (sticker.kind === "poll") {
    return <div className="placed-poll">
      <b>{sticker.value || "What’s the move?"}</b>
      {(sticker.choices || ["Absolutely", "Maybe next time"]).map((choice) => <button key={choice} onClick={(event) => { event.stopPropagation(); onResponse(choice); }}>{choice}</button>)}
      {sticker.response && <small>Your vote: {sticker.response}</small>}
    </div>;
  }
  if (sticker.kind === "question") {
    return <div className="placed-question"><small>QUESTION FOR YOU</small><b>{sticker.value || "Ask me anything"}</b><span>Write a reply…</span><button onClick={(event) => { event.stopPropagation(); onResponse("Reply sent"); }}>Send</button>{sticker.response && <small className="response-note">{sticker.response}</small>}</div>;
  }
  if (sticker.kind === "hey") return <div className="placed-hey"><small>OLDTIME STORY PROMPT</small><b>{sticker.value || "Hey Word"}</b><span>Share your take</span></div>;
  if (sticker.kind === "reaction") return <div className="placed-heart"><Heart size={31} fill="currentColor" /><small>Felt that</small></div>;
  if (sticker.kind === "emoji") return <div className="placed-emoji" aria-label={`Emoji ${sticker.value || "🙌"}`}>{sticker.value || "🙌"}</div>;
  if (sticker.kind === "text") return <div className="placed-text">{sticker.value || "Add your words"}</div>;
  const Icon = sticker.kind === "place" ? MapPin : sticker.kind === "handle" ? Hash : Music2;
  const prefix = sticker.kind === "place" ? "AT" : sticker.kind === "handle" ? "@" : "NOW PLAYING";
  return <div className="placed-label"><Icon size={14} /><span><small>{prefix}</small><b>{sticker.value || (sticker.kind === "place" ? "Your place" : sticker.kind === "handle" ? "@yourhandle" : "Audio title")}</b></span></div>;
}

export function StickerTray() {
  const [stickers, setStickers] = useState<Sticker[]>(starterStickers);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Kind | null>(null);
  const [draft, setDraft] = useState("");
  const [pollChoiceA, setPollChoiceA] = useState("Absolutely");
  const [pollChoiceB, setPollChoiceB] = useState("Maybe next time");
  const [dragging, setDragging] = useState<string | null>(null);
  const stageRef = useRef<HTMLElement>(null);

  const activeSticker = stickers.find((item) => item.id === activeId) || null;
  const currentOption = options.find((item) => item.kind === editing);

  const addSticker = (kind: Kind) => {
    if (createsForm(kind)) {
      setEditing(kind);
      setActiveId(null);
      setDraft(kind === "poll" ? "What’s the move?" : kind === "question" ? "Ask me anything" : kind === "hey" ? "Hey Word" : kind === "emoji" ? emojiChoices[0] : "");
      if (kind === "poll") {
        setPollChoiceA("Absolutely");
        setPollChoiceB("Maybe next time");
      }
      return;
    }
    const value = kind === "original" ? "GOOD DAYS, GOOD PEOPLE" : undefined;
    const next: Sticker = { id: `${kind}-${Date.now()}`, kind, label: options.find((item) => item.kind === kind)?.label || kind, detail: "", value, x: 50, y: 42, scale: 1, rotation: kind === "reaction" ? 5 : 0 };
    setStickers((items) => [...items, next]);
    setActiveId(next.id);
  };

  const confirmSticker = () => {
    if (!editing) return;
    const value = editing === "emoji" ? draft : draft.trim() || (editing === "hey" ? "Hey Word" : editing === "question" ? "Ask me anything" : editing === "poll" ? "What’s the move?" : "Add your words");
    const choices: [string, string] | undefined = editing === "poll"
      ? [pollChoiceA.trim() || "Option 1", pollChoiceB.trim() || "Option 2"]
      : undefined;
    const next: Sticker = { id: `${editing}-${Date.now()}`, kind: editing, label: currentOption?.label || editing, detail: "", value, choices, x: 50, y: 40, scale: 1, rotation: editing === "hey" ? -3 : 0 };
    setStickers((items) => [...items, next]);
    setActiveId(next.id);
    setEditing(null);
    setDraft("");
  };

  const updateSticker = (id: string, change: Partial<Sticker>) => setStickers((items) => items.map((item) => item.id === id ? { ...item, ...change } : item));
  const duplicate = () => {
    if (!activeSticker) return;
    const copy = { ...activeSticker, id: `${activeSticker.kind}-${Date.now()}`, x: Math.min(activeSticker.x + 8, 82), y: Math.min(activeSticker.y + 8, 76), response: undefined };
    setStickers((items) => [...items, copy]);
    setActiveId(copy.id);
  };
  const remove = () => {
    if (!activeId) return;
    setStickers((items) => items.filter((item) => item.id !== activeId));
    setActiveId(null);
  };
  const editActive = () => {
    if (!activeSticker || !createsForm(activeSticker.kind)) return;
    setEditing(activeSticker.kind);
    setDraft(activeSticker.value || "");
    if (activeSticker.kind === "poll") {
      setPollChoiceA(activeSticker.choices?.[0] || "Absolutely");
      setPollChoiceB(activeSticker.choices?.[1] || "Maybe next time");
    }
  };
  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragging || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    updateSticker(dragging, {
      x: Math.max(8, Math.min(92, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(8, Math.min(80, ((event.clientY - rect.top) / rect.height) * 100)),
    });
  };
  const adjustScale = (amount: number) => activeSticker && updateSticker(activeSticker.id, { scale: Math.max(0.72, Math.min(1.35, activeSticker.scale + amount)) });
  const rotateActive = () => activeSticker && updateSticker(activeSticker.id, { rotation: (activeSticker.rotation + 12) % 360 });

  return (
    <main className="ot-phone">
      <div className="ot-status"><span>9:41</span><span className="status-glyphs"><i /><i /><i /></span></div>
      <header className="ot-topbar">
        <span className="top-icon" aria-hidden="true"><X size={19} /></span>
        <div className="top-title"><strong>New story</strong><span>Just for your people</span></div>
        <span className="draft-label">DRAFT</span>
      </header>
      <section
        className="ot-stage"
        ref={stageRef}
        aria-label="Full-screen story media with placed stickers"
        onPointerMove={pointerMove}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
        onClick={(event) => { if (event.target === event.currentTarget) setActiveId(null); }}
      >
        <div className="stage-photo" aria-hidden="true">
          <div className="photo-sky" />
          <div className="photo-sun" />
          <div className="photo-wall" />
          <div className="photo-window"><i /><i /><i /><i /></div>
          <div className="photo-shadow" />
          <div className="photo-plant plant-one"><i /><i /><i /><b /></div>
          <div className="photo-plant plant-two"><i /><i /><i /><b /></div>
          <div className="photo-table" />
          <div className="photo-cup"><i /></div>
        </div>
        <div className="story-meta"><span className="story-avatar">M</span><div><b>Maya’s story</b><small>Today, out and about</small></div></div>
        <div className="scene-caption"><span>THE SLOW PART OF SUNDAY</span><b>A little sun, a long coffee.</b></div>
        {stickers.map((sticker) => (
          <div
            key={sticker.id}
            className={`placed-sticker ${activeId === sticker.id ? "is-selected" : ""} sticker-${sticker.kind}`}
            style={{ left: `${sticker.x}%`, top: `${sticker.y}%`, transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})` }}
            onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button")) return; event.stopPropagation(); setActiveId(sticker.id); setDragging(sticker.id); event.currentTarget.setPointerCapture(event.pointerId); }}
            onClick={(event) => { event.stopPropagation(); setActiveId(sticker.id); }}
          >
            <StickerVisual sticker={sticker} onResponse={(response) => updateSticker(sticker.id, { response })} />
          </div>
        ))}
        {activeSticker && !editing && <div className="sticker-tools" onPointerDown={(event) => event.stopPropagation()}>
          <button aria-label="Edit sticker" onClick={editActive} disabled={!createsForm(activeSticker.kind)}><Type size={15} /></button>
          <button aria-label="Duplicate sticker" onClick={duplicate}><Copy size={15} /></button>
          <button aria-label="Rotate sticker" onClick={rotateActive}><RotateCw size={15} /></button>
          <button aria-label="Make sticker smaller" onClick={() => adjustScale(-0.12)}><Minus size={15} /></button>
          <button aria-label="Make sticker larger" onClick={() => adjustScale(0.12)}><Plus size={15} /></button>
          <button className="tool-delete" aria-label="Delete sticker" onClick={remove}><Trash2 size={15} /></button>
        </div>}
        <div className="stage-hint"><span className="hint-dot" /> Drag to move <i /> Resize &amp; turn below</div>
        <div className="stage-bottom-fade" />
      </section>
      <section className="ot-tray" aria-label="Swipeable sticker tray">
        <div className="tray-grabber" />
        {editing ? (
          <div className="edit-panel">
            <div className="edit-heading">
              <button className="tray-back" onClick={() => setEditing(null)} aria-label="Back to sticker tray"><ArrowLeft size={18} /></button>
              <div><strong>{currentOption?.label}</strong><small>{editing === "place" || editing === "handle" || editing === "audio" ? "Text only · not connected to an account or service" : editing === "hey" ? "A prompt your community can answer with a story" : editing === "emoji" ? "Pick one to add to your moment" : "Add a short line to your story"}</small></div>
              <button className="tray-confirm" onClick={confirmSticker} aria-label="Add sticker"><Check size={18} /></button>
            </div>
            {editing === "emoji" ? <div className="emoji-picker">
              <span>Choose an emoji</span>
              <div>{emojiChoices.map((emoji) => <button key={emoji} type="button" aria-label={`Choose ${emoji}`} aria-pressed={draft === emoji} onClick={() => setDraft(emoji)}>{emoji}</button>)}</div>
            </div> : editing === "poll" ? <div className="edit-fields">
              <label>Question<input autoFocus maxLength={80} value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
              <div className="poll-choice-fields">
                <label>Answer 1<input maxLength={34} value={pollChoiceA} onChange={(event) => setPollChoiceA(event.target.value)} /></label>
                <label>Answer 2<input maxLength={34} value={pollChoiceB} onChange={(event) => setPollChoiceB(event.target.value)} /></label>
              </div>
              <small>Viewers can tap either answer.</small>
            </div> : <div className="edit-fields">
              <label>{editing === "question" ? "Your question" : editing === "hey" ? "Story prompt" : editing === "place" ? "Place name" : editing === "handle" ? "Handle text" : editing === "audio" ? "Audio title" : "Your text"}
                <input autoFocus maxLength={100} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={editing === "place" ? "e.g. North Beach" : editing === "handle" ? "e.g. @maya" : editing === "audio" ? "e.g. Sunday Kind of Love" : editing === "hey" ? "e.g. Hey Word: a small joy today?" : "Write something short"} />
              </label>
              {(editing === "place" || editing === "handle" || editing === "audio") && <p className="text-only-note">This is a text label. No live location, account tagging, or music playback.</p>}
              {editing === "question" && <p className="text-only-note">People can write a response to your question.</p>}
              {editing === "hey" && <p className="text-only-note">A community prompt made for story replies.</p>}
            </div>}
          </div>
        ) : <>
          <div className="tray-heading">
            <div><span className="tray-kicker">MAKE IT YOURS</span><strong>Add a sticker</strong></div>
            <span className="tray-mark" aria-hidden="true">OT <i /></span>
          </div>
          <div className="sticker-rail" aria-label="Swipe horizontally to browse sticker types">
            {options.map((option, index) => (
              <button key={option.kind} className={`sticker-option ${option.kind === "original" ? "is-featured" : ""}`} onClick={() => addSticker(option.kind)} aria-label={`Add ${option.label}`}>
                <span className="option-art"><Art kind={option.kind} /></span>
                <b>{option.label}</b><small>{option.sub}</small>
                {index === 0 && <i className="original-tag">OT ORIGINAL</i>}
              </button>
            ))}
          </div>
          <div className="tray-footer"><span><ArrowDownRight size={13} /> Drag to move</span><span>Swipe for more <span className="rail-arrows">↔</span></span></div>
        </>}
      </section>
      <div className="phone-home"><span /></div>
    </main>
  );
}
