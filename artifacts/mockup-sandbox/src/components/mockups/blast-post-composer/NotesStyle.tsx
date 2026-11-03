import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import "./_group.css";

type PostType = "post" | "question" | "activity";
type Audience = "public" | "friends" | "group" | "only-me";
type Panel = "type" | "audience" | "location" | "";
type MediaTool = "text" | "draw" | "";
type Point = { x: number; y: number };
type MediaLabel = Point & { text: string };
type MediaStroke = { points: Point[] };

const types: { id: PostType | "event"; label: string }[] = [
  { id: "post", label: "Post" },
  { id: "question", label: "Question" },
  { id: "activity", label: "Activity" },
  { id: "event", label: "Event" },
];
const audiences: { id: Audience; label: string }[] = [
  { id: "public", label: "Public" },
  { id: "friends", label: "Blast Friends" },
  { id: "group", label: "Group conversation" },
  { id: "only-me", label: "Only me" },
];
const iconPaths = {
  back: "m12 5-7 7 7 7M5 12h15",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-2",
  share: "M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  lock: "M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3",
  image: "M4 4h16v16H4zM4 16l5-5 4 4 2-2 5 5M9 9h.01",
  location: "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0ZM12 10h.01",
  edit: "M4 5h16M4 12h16M4 19h10",
  chevron: "m9 18 6-6-6-6",
};

function Icon({ name, size = 19 }: { name: keyof typeof iconPaths; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

export function NotesStyle() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<PostType>("post");
  const [audience, setAudience] = useState<Audience>("public");
  const [panel, setPanel] = useState<Panel>("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [mediaTool, setMediaTool] = useState<MediaTool>("");
  const [mediaLabels, setMediaLabels] = useState<MediaLabel[]>([]);
  const [mediaStrokes, setMediaStrokes] = useState<MediaStroke[]>([]);
  const [activeLabel, setActiveLabel] = useState<MediaLabel | null>(null);
  const previousText = useRef({ title: "", body: "" });
  const mediaInput = useRef<HTMLInputElement>(null);
  const mediaUrlRef = useRef<string | null>(null);
  const mediaStageRef = useRef<HTMLDivElement>(null);
  const textEditorRef = useRef<HTMLDivElement>(null);
  const activeStrokeIndex = useRef<number | null>(null);
  const activeLabelRef = useRef<MediaLabel | null>(null);

  useEffect(() => () => {
    if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current);
  }, []);

  function commitActiveLabel(text = textEditorRef.current?.innerText || "") {
    const label = activeLabelRef.current;
    if (!label) return;
    activeLabelRef.current = null;
    const value = text.replace(/\r/g, "").replace(/\u00a0/g, " ").trim().slice(0, 80);
    if (value) setMediaLabels((current) => [...current, { ...label, text: value }]);
    setActiveLabel(null);
  }

  function getPoint(event: ReactPointerEvent<HTMLDivElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(98, (event.clientX - bounds.left) / Math.max(1, bounds.width) * 100)),
      y: Math.max(0, Math.min(98, (event.clientY - bounds.top) / Math.max(1, bounds.height) * 100)),
    };
  }

  function startMediaEdit(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-bpc-text-editor]")) return;
    if (mediaTool === "text") {
      event.preventDefault();
      commitActiveLabel();
      const label = { ...getPoint(event), text: "" };
      activeLabelRef.current = label;
      setActiveLabel(label);
      requestAnimationFrame(() => textEditorRef.current?.focus());
      return;
    }
    if (mediaTool !== "draw") return;
    event.preventDefault();
    commitActiveLabel();
    const point = getPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    activeStrokeIndex.current = mediaStrokes.length;
    setMediaStrokes((current) => [...current, { points: [point] }]);
  }

  function continueMediaEdit(event: ReactPointerEvent<HTMLDivElement>) {
    const index = activeStrokeIndex.current;
    if (index === null) return;
    const point = getPoint(event);
    setMediaStrokes((current) => current.map((stroke, strokeIndex) =>
      strokeIndex === index ? { ...stroke, points: [...stroke.points, point] } : stroke
    ));
  }

  function finishMediaEdit() {
    activeStrokeIndex.current = null;
  }

  function chooseMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    commitActiveLabel();
    if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    mediaUrlRef.current = nextUrl;
    setMediaUrl(nextUrl);
    setMediaType(file.type.startsWith("video/") ? "video" : "image");
    setMediaTool("text");
    setMediaLabels([]);
    setMediaStrokes([]);
    activeStrokeIndex.current = null;
    setActiveLabel(null);
    event.currentTarget.value = "";
    setMessage("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) {
      setMessage("Add your thought before sharing.");
      return;
    }
    setMessage(`Blast shared with ${audiences.find((item) => item.id === audience)?.label}.`);
  }

  return (
    <main className="bpc-notes-screen">
      <form className="bpc-notes-form" onSubmit={submit}>
        <header className="bpc-notes-topbar">
          <button
            className="bpc-notes-round"
            type="button"
            aria-label="Back to Blast"
            onClick={() => setMessage("Draft closed.")}
          >
            <Icon name="back" />
          </button>
          <span className="bpc-notes-page-title">New Blast</span>
          <div className="bpc-notes-top-actions">
            <button
              className="bpc-notes-round"
              type="button"
              aria-label="Undo last edit"
              onClick={() => {
                setTitle(previousText.current.title);
                setBody(previousText.current.body);
                setMessage("Last text edit undone.");
              }}
            >
              <Icon name="undo" />
            </button>
            <button className="bpc-notes-share" type="submit" aria-label="Share Blast">
              <Icon name="share" size={18} />
            </button>
            <button
              className={`bpc-notes-round ${panel === "type" ? "is-active" : ""}`}
              type="button"
              aria-label="Post type options"
              aria-expanded={panel === "type"}
              onClick={() => setPanel(panel === "type" ? "" : "type")}
            >
              <Icon name="more" />
            </button>
          </div>
        </header>

        <div className="bpc-notes-writing-area">
          <input
            className="bpc-notes-title-input"
            aria-label="Post title (optional)"
            name="title"
            maxLength={90}
            placeholder="Title"
            value={title}
            onChange={(event) => {
              previousText.current = { title, body };
              setTitle(event.target.value);
              setMessage("");
            }}
          />
          <textarea
            className="bpc-notes-body-input"
            aria-label={type === "question" ? "Question" : "Post text"}
            name="body"
            maxLength={1000}
            placeholder={type === "question" ? "What would you like to ask?" : "Start writing…"}
            value={body}
            onChange={(event) => {
              previousText.current = { title, body };
              setBody(event.target.value);
              setMessage("");
            }}
            required
          />

          {type === "activity" && (
            <input className="bpc-notes-inline-input" maxLength={100} placeholder="Activity goal (optional)" />
          )}

          {mediaUrl && (
            <section className="bpc-notes-media-editor" aria-label="Edit attached media">
              <div
                className={`bpc-notes-media-stage ${mediaTool ? `is-${mediaTool}` : ""}`}
                ref={mediaStageRef}
                role="group"
                aria-label="Photo or video annotation area"
                onPointerDown={startMediaEdit}
                onPointerMove={continueMediaEdit}
                onPointerUp={finishMediaEdit}
                onPointerCancel={finishMediaEdit}
              >
                {mediaType === "video"
                  ? <video src={mediaUrl} controls playsInline preload="metadata" aria-label="Video being edited" />
                  : <img src={mediaUrl} alt="Photo being edited" />}
                <svg className="bpc-notes-media-ink" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {mediaStrokes.map((stroke, index) => {
                    const points = stroke.points.map((point) => `${point.x},${point.y}`).join(" ");
                    if (stroke.points.length === 1) {
                      const point = stroke.points[0];
                      return (
                        <g key={index}>
                          <circle cx={point.x} cy={point.y} r="2.2" fill="none" stroke="#111" strokeWidth="1.5" />
                          <circle cx={point.x} cy={point.y} r="0.8" fill="#fff" />
                        </g>
                      );
                    }
                    return (
                      <g key={index}>
                        <polyline points={points} fill="none" stroke="#111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        <polyline points={points} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      </g>
                    );
                  })}
                </svg>
                <div className="bpc-notes-media-text-layer">
                  {mediaLabels.map((label, index) => (
                    <div key={index} className="bpc-notes-media-label" style={{ left: `${label.x}%`, top: `${label.y}%`, maxWidth: `calc(100% - ${label.x}%)` }}>
                      {label.text}
                    </div>
                  ))}
                  {activeLabel && (
                    <div
                      ref={textEditorRef}
                      className="bpc-notes-media-text-editor"
                      contentEditable
                      suppressContentEditableWarning
                      data-bpc-text-editor
                      data-placeholder="Type here"
                      role="textbox"
                      aria-label="Text placed on media"
                      aria-multiline="true"
                      style={{ left: `${activeLabel.x}%`, top: `${activeLabel.y}%`, maxWidth: `calc(100% - ${activeLabel.x}%)` }}
                      onInput={(event) => {
                        if (event.currentTarget.innerText.length > 80) {
                          event.currentTarget.innerText = event.currentTarget.innerText.slice(0, 80);
                        }
                      }}
                      onBlur={(event) => commitActiveLabel(event.currentTarget.innerText)}
                    />
                  )}
                </div>
              </div>
              <div className="bpc-notes-media-tools" role="group" aria-label="Media editing tools">
                <button
                  className={mediaTool === "text" ? "is-active" : ""}
                  type="button"
                  aria-pressed={mediaTool === "text"}
                  onClick={() => {
                    commitActiveLabel();
                    setMediaTool((current) => current === "text" ? "" : "text");
                  }}
                >
                  <b aria-hidden="true">T</b>Text
                </button>
                <button
                  className={mediaTool === "draw" ? "is-active" : ""}
                  type="button"
                  aria-pressed={mediaTool === "draw"}
                  onClick={() => {
                    commitActiveLabel();
                    setMediaTool((current) => current === "draw" ? "" : "draw");
                  }}
                >
                  Draw
                </button>
                <button
                  type="button"
                  aria-label="Undo last media mark"
                  onClick={() => {
                    commitActiveLabel();
                    if (mediaStrokes.length) setMediaStrokes((current) => current.slice(0, -1));
                    else setMediaLabels((current) => current.slice(0, -1));
                  }}
                >
                  Undo
                </button>
              </div>
              <p className="bpc-notes-media-hint" role="status">
                {mediaTool === "draw"
                  ? "Draw with your finger, mouse, or stylus. Tap Draw again for video controls."
                  : mediaTool === "text"
                    ? "Tap anywhere on the media to start typing. Tap Text again for video controls."
                    : "Choose Text or Draw to mark up this media."}
              </p>
            </section>
          )}

          {location && (
            <label className="bpc-notes-location-row">
              <Icon name="location" size={16} />
              <input
                aria-label="Post location"
                maxLength={120}
                placeholder="Add a place manually"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </label>
          )}

        </div>

        <div className="bpc-notes-bottom">
          <div className="bpc-notes-audience-line">
            <span className="bpc-notes-audience-copy">
              <Icon name="lock" size={15} />
              <span>{audiences.find((item) => item.id === audience)?.label}</span>
            </span>
            <button
              type="button"
              aria-expanded={panel === "audience"}
              onClick={() => setPanel(panel === "audience" ? "" : "audience")}
            >
              Change
              <Icon name="chevron" size={14} />
            </button>
          </div>

          {panel === "type" && (
            <section className="bpc-notes-popover" aria-label="Choose post type">
              <span className="bpc-notes-popover-label">Post type</span>
              <div className="bpc-notes-choice-row">
                {types.map((item) => (
                  <button
                    key={item.id}
                    className={type === item.id ? "is-active" : ""}
                    type="button"
                    onClick={() => {
                      if (item.id === "event") {
                        setMessage("Event creation continues in the existing event planner.");
                        return;
                      }
                      setType(item.id);
                      setPanel("");
                      setMessage("");
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {panel === "audience" && (
            <section className="bpc-notes-popover" aria-label="Choose audience">
              <span className="bpc-notes-popover-label">Who can see this?</span>
              <div className="bpc-notes-audience-list">
                {audiences.map((item) => (
                  <button
                    key={item.id}
                    className={audience === item.id ? "is-active" : ""}
                    type="button"
                    aria-pressed={audience === item.id}
                    onClick={() => {
                      setAudience(item.id);
                      setMessage("");
                    }}
                  >
                    {item.label}
                    {audience === item.id && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
              {audience === "group" && (
                <select className="bpc-notes-group-select" aria-label="Group conversation" defaultValue="">
                  <option value="" disabled>Choose a group conversation</option>
                  <option value="weekend-walkers">Weekend Walkers · 8 members</option>
                </select>
              )}
            </section>
          )}

          {panel === "location" && (
            <label className="bpc-notes-popover bpc-notes-location-field">
              <span className="bpc-notes-popover-label">Place (optional)</span>
              <input
                aria-label="Post location"
                maxLength={120}
                placeholder="Add a place manually"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </label>
          )}

          <div className="bpc-notes-toolbar">
            <div className="bpc-notes-tools" role="group" aria-label="Post options">
              <button type="button" aria-label="Choose post type" onClick={() => setPanel(panel === "type" ? "" : "type")}>
                <Icon name="edit" />
              </button>
              <button type="button" aria-label="Attach an image or video" onClick={() => mediaInput.current?.click()}>
                <Icon name="image" />
              </button>
              <button type="button" aria-label="Choose who can see this" onClick={() => setPanel(panel === "audience" ? "" : "audience")}>
                <Icon name="lock" />
              </button>
              <button type="button" aria-label="Add a place" onClick={() => setPanel(panel === "location" ? "" : "location")}>
                <Icon name="location" />
              </button>
            </div>
          </div>

          <input
            ref={mediaInput}
            className="bpc-notes-hidden-file"
            type="file"
            accept="image/*,video/*"
            aria-label="Choose an image or video"
            onChange={chooseMedia}
          />
          {message && <p className="bpc-notes-status" role="status">{message}</p>}
        </div>
      </form>
    </main>
  );
}
