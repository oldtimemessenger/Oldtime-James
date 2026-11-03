import { useEffect, useRef, useState, type ReactElement } from "react";
import "./CreateFlow.css";

type ActionId = "studio" | "camera" | "board" | "quote" | "story" | "challenge" | "event" | "post" | "video" | "feed";
type Stage = "create" | "picker" | "camera" | "compose" | "shared";
type CaptureMode = "Photo" | "Video" | "Story";
type LocalMedia = { url: string; name: string; type: string };

const communityActions: { id: ActionId; title: string; description: string; icon: string }[] = [
  { id: "story", title: "Story", description: "Your moment, for 24 hours", icon: "story" },
  { id: "challenge", title: "Challenges", description: "Sports challenges", icon: "challenge" },
  { id: "event", title: "Events", description: "Plan with your community", icon: "event" },
  { id: "post", title: "Community post", description: "Share with your people", icon: "post" },
  { id: "video", title: "Video note", description: "A quick video for friends", icon: "video" },
  { id: "feed", title: "Main feed · Photo", description: "Post a photo to your feed", icon: "photo" },
];

function Icon({ name, size = 21 }: { name: string; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Record<string, ReactElement> = {
    studio: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9" r="1.3" /><path d="m21 15-5-5L5 20" /></>,
    camera: <><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-2h4.6l1.2 2h2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.2" /></>,
    photo: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9" r="1.3" /><path d="m21 15-5-5L5 20" /></>,
    story: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.4" /><circle cx="12" cy="12" r=".8" /></>,
    quote: <><path d="M5 18.5 6.2 14 16 4.2a2.4 2.4 0 0 1 3.4 3.4L9.6 17.4 5 18.5Z" /><path d="m14.5 5.8 3.6 3.6" /></>,
    board: <><path d="M5 12h13M12 6l6 6-6 6" /><path d="M5 5v14" /></>,
    challenge: <><path d="M5 21V4" /><path d="M5 5c5-4 9 4 14 0v9c-5 4-9-4-14 0" /></>,
    event: <><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></>,
    post: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8 8 0 0 1-3.5-.8L4 20l1.2-4.1A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4h.5a7.5 7.5 0 0 1 7.5 7.5Z" /><path d="M8 12h8M8 9h5" /></>,
    video: <><rect x="3" y="5" width="13" height="14" rx="3" /><path d="m16 10 5-3v10l-5-3z" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    back: <><path d="m15 18-6-6 6-6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    flip: <><path d="M4 8h12l-3-3M20 16H8l3 3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>{icons[name] || icons.photo}</svg>;
}

export function CreateFlow() {
  const [stage, setStage] = useState<Stage>("create");
  const [action, setAction] = useState<ActionId>("feed");
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [caption, setCaption] = useState("");
  const [mode, setMode] = useState<CaptureMode>("Photo");
  const [message, setMessage] = useState("");
  const [flashOn, setFlashOn] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  const mediaTypeAction = action === "camera" || action === "story" || action === "video" || action === "feed" || action === "studio";

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function openPicker() {
    setAction("studio");
    setCaption("");
    setMedia([]);
    setMessage("");
    setStage("picker");
  }

  function openCamera(nextAction: ActionId = "camera") {
    setAction(nextAction);
    setMode(nextAction === "story" ? "Story" : nextAction === "video" ? "Video" : "Photo");
    setCaption("");
    setMedia([]);
    setMessage("");
    setStage("camera");
  }

  function begin(id: ActionId) {
    setAction(id);
    setCaption("");
    setMedia([]);
    setMessage("");
    if (id === "story" || id === "video" || id === "camera") {
      openCamera(id);
    } else if (id === "feed" || id === "studio") {
      openPicker();
      if (id === "feed") setAction("feed");
    } else {
      setStage("compose");
    }
  }

  function chooseFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList).map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      return { url, name: file.name, type: file.type };
    });
    setMedia(incoming);
    setMessage("");
    setStage("compose");
    if (fileInput.current) fileInput.current.value = "";
  }

  function capturePreview() {
    setMedia([]);
    setMessage("Illustrative capture for this prototype. No device camera was accessed.");
    setStage("compose");
  }

  function goBack() {
    setMessage("");
    if (stage === "camera") {
      setStage("create");
      return;
    }
    if (stage === "picker") {
      setStage("create");
      return;
    }
    if (stage === "compose" && (action === "studio" || action === "feed")) {
      setStage("picker");
      return;
    }
    if (stage === "compose" && (action === "camera" || action === "story" || action === "video")) {
      setStage("camera");
      return;
    }
    setStage("create");
  }

  function share() {
    setMessage("");
    setStage("shared");
  }

  return (
    <main className="cf-root">
      {stage === "create" && (
        <section className="cf-create-page" aria-labelledby="cf-page-title">
          <header className="cf-page-header">
            <button className="cf-wordmark" type="button" onClick={() => setStage("create")} aria-label="Oldtime home">oldtime<span>.</span></button>
            <span className="cf-header-context">A place for your people</span>
            <button className="cf-avatar" type="button" aria-label="Maya Chen profile">M</button>
          </header>
          <div className="cf-create-content">
            <div className="cf-title-row"><div><span className="cf-eyebrow">MAKE IT YOURS</span><h1 id="cf-page-title">Create</h1></div><span className="cf-step-label">01 <i /> 02</span></div>

            <div className="cf-primary-actions" aria-label="Primary creation actions">
              <button type="button" className="cf-primary-action cf-studio-primary" onClick={openPicker}>
                <span className="cf-primary-icon"><Icon name="studio" size={23} /></span>
                <span className="cf-primary-copy"><small>MAKE WITH</small><b>Oldtime Studio</b><em>Choose media. Make it yours.</em></span>
                <Icon name="arrow" size={20} />
              </button>
              <button type="button" className="cf-primary-action cf-camera-primary" onClick={() => openCamera("camera")}>
                <span className="cf-primary-icon"><Icon name="camera" size={23} /></span>
                <span className="cf-primary-copy"><small>CAPTURE A MOMENT</small><b>Camera</b><em>Open a full-screen capture view.</em></span>
                <Icon name="arrow" size={20} />
              </button>
            </div>

            <div className="cf-quick-actions" aria-label="Quick actions">
              <span className="cf-section-label">QUICK CREATE</span>
              <button type="button" onClick={() => begin("board")}><span className="cf-quick-icon"><Icon name="board" size={18} /></span>Get On Board<Icon name="arrow" size={16} /></button>
              <button type="button" onClick={() => begin("quote")}><span className="cf-quick-icon cf-quote-quick"><Icon name="quote" size={18} /></span>Quote<Icon name="arrow" size={16} /></button>
            </div>

            <section className="cf-media-grid-section" aria-labelledby="cf-media-title">
              <div className="cf-section-heading"><div><span className="cf-section-label">YOUR MEDIA</span><h2 id="cf-media-title">Choose from this device</h2></div><span className="cf-media-count">LOCAL FILES ONLY</span></div>
              <div className="cf-media-grid">
                {[0, 1, 2, 3, 4, 5].map((slot) => (
                  <button type="button" className="cf-media-slot" key={slot} onClick={() => { setAction("feed"); fileInput.current?.click(); }} aria-label={`Choose a local photo or video for slot ${slot + 1}`}>
                    <span><Icon name="plus" size={20} /></span>
                  </button>
                ))}
              </div>
              <button type="button" className="cf-local-picker-button" onClick={() => { setAction("feed"); fileInput.current?.click(); }}><Icon name="photo" size={18} />Choose photos or videos</button>
              <p className="cf-local-note">Nothing here yet. Files appear after you select them from your device.</p>
            </section>

            <section className="cf-destinations" aria-labelledby="cf-destination-title">
              <div className="cf-section-heading cf-dest-heading"><div><span className="cf-section-label">OTHER WAYS TO SHARE</span><h2 id="cf-destination-title">Choose a destination</h2></div></div>
              <div className="cf-destination-list">
                {communityActions.map((item) => (
                  <button type="button" className="cf-destination-link" key={item.id} onClick={() => begin(item.id)}>
                    <span className={`cf-destination-icon cf-destination-${item.id}`}><Icon name={item.icon} size={19} /></span>
                    <span className="cf-destination-copy"><b>{item.title}</b><small>{item.description}</small></span>
                    <Icon name="arrow" size={17} />
                  </button>
                ))}
              </div>
            </section>
            <p className="cf-create-footer">Oldtime, made for showing up.</p>
          </div>
        </section>
      )}

      {stage === "picker" && (
        <section className="cf-picker-page" aria-labelledby="cf-picker-title">
          <header className="cf-flow-header"><button type="button" onClick={goBack} aria-label="Back to Create"><Icon name="back" /></button><div><span className="cf-eyebrow">OLDTIME STUDIO</span><h1 id="cf-picker-title">Choose media</h1></div><span className="cf-header-context">LOCAL</span></header>
          <div className="cf-picker-body">
            <p className="cf-picker-intro">Select photos or videos saved on this device. Oldtime won’t show a gallery until you choose files.</p>
            <div className="cf-empty-grid" aria-label="Empty local media grid">
              {Array.from({ length: 9 }, (_, index) => <button type="button" key={index} onClick={() => fileInput.current?.click()} aria-label={`Select local media, empty slot ${index + 1}`}><Icon name="plus" size={21} /></button>)}
            </div>
            <div className="cf-picker-empty"><span className="cf-empty-mark"><Icon name="studio" size={24} /></span><b>No media selected</b><p>Choose files from your device to start a post.</p></div>
            <button type="button" className="cf-red-button" onClick={() => fileInput.current?.click()}><Icon name="photo" size={19} />Choose from device</button>
            <button type="button" className="cf-secondary-button" onClick={() => openCamera("camera")}><Icon name="camera" size={18} />Use Camera instead</button>
          </div>
        </section>
      )}

      {stage === "camera" && (
        <section className="cf-camera" aria-label="Full-screen Camera">
          <div className="cf-camera-preview" aria-hidden="true">
            <div className="cf-preview-shade" /><div className="cf-preview-frame"><span /><span /><span /><span /></div>
            <div className="cf-preview-center"><span className="cf-center-ring" /><span className="cf-center-crosshair" /></div>
            <span className="cf-preview-watermark">OLDTIME / CAMERA</span>
          </div>
          <header className="cf-camera-top">
            <button type="button" className="cf-cam-control" onClick={goBack} aria-label="Close Camera"><Icon name="close" /></button>
            <span className="cf-camera-title">{action === "story" ? "Story" : action === "video" ? "Video note" : "Camera"}</span>
            <button type="button" className={`cf-cam-flash ${flashOn ? "is-active" : ""}`} onClick={() => setFlashOn(!flashOn)} aria-pressed={flashOn}>FLASH {flashOn ? "ON" : "OFF"}</button>
          </header>
          <div className="cf-camera-hint"><span className="cf-live-dot" />Illustrative camera preview <small>No device camera is connected in this prototype.</small></div>
          <button type="button" className="cf-camera-flip cf-cam-control" aria-label="Flip camera" onClick={() => setMessage("Camera flip is illustrative; no device camera is connected.")}><Icon name="flip" /></button>
          <div className="cf-camera-bottom">
            <button type="button" className="cf-camera-gallery" onClick={() => fileInput.current?.click()} aria-label="Choose a local file"><span><Icon name="photo" size={21} /></span><small>ADD MEDIA</small></button>
            <button type="button" className={`cf-shutter ${mode === "Video" ? "is-video" : ""}`} onClick={capturePreview} aria-label="Capture illustrative preview"><span /></button>
            <span className="cf-camera-side-space" />
          </div>
          <div className="cf-camera-modes" role="tablist" aria-label="Capture type">
            {(["Photo", "Video", "Story"] as const).map((item) => <button type="button" role="tab" aria-selected={mode === item} key={item} onClick={() => { setMode(item); setAction(item === "Story" ? "story" : item === "Video" ? "video" : "camera"); }}>{item}</button>)}
          </div>
          <p className="cf-camera-bottom-note">NO DEVICE CAMERA ACCESS · MOCK CAPTURE ONLY</p>
          {message && <p className="cf-camera-status" role="status">{message}</p>}
        </section>
      )}

      {stage === "compose" && (
        <section className="cf-review-page" aria-labelledby="cf-review-title">
          <header className="cf-flow-header cf-review-header"><button type="button" onClick={goBack} aria-label="Go back"><Icon name="back" /></button><div><span className="cf-eyebrow">REVIEW & SHARE</span><h1 id="cf-review-title">{action === "quote" ? "Quote" : action === "board" ? "Get On Board" : action === "challenge" ? "Sports challenge" : action === "event" ? "Create event" : action === "post" ? "Community post" : action === "video" ? "Video note" : action === "story" ? "Story" : action === "camera" ? "Camera" : "Main feed post"}</h1></div><button type="button" className="cf-cancel-link" onClick={() => setStage("create")}>Cancel</button></header>
          <div className="cf-review-body">
            {mediaTypeAction ? (
              <>
                <div className="cf-review-media">
                  {media.length > 0 ? media.map((item) => item.type.startsWith("video/") ? <video key={item.url} src={item.url} controls aria-label={`Selected video: ${item.name}`} /> : <img key={item.url} src={item.url} alt={`Selected local file: ${item.name}`} />) : <div className="cf-captured-preview"><span className="cf-captured-label">ILLUSTRATIVE CAPTURE</span><div className="cf-capture-art"><span /><span /><span /></div><small>Generated as a visual placeholder in this prototype</small></div>}
                  {media.length > 0 && <span className="cf-selected-file-label">YOUR SELECTED FILE · {media[0].name}</span>}
                </div>
                <button type="button" className="cf-text-link" onClick={() => fileInput.current?.click()}><Icon name="plus" size={17} />Add or change local media</button>
                <label className="cf-field-label" htmlFor="cf-caption">Caption</label><textarea id="cf-caption" className="cf-textarea" rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Add a little context…" />
                <div className="cf-share-destination"><span><b>Sharing to</b><small>{action === "story" ? "Your Story · 24 hours" : action === "video" ? "Video notes · Friends" : "Main feed"}</small></span><span className="cf-dest-tag">{action === "story" ? "STORY" : action === "video" ? "VIDEO NOTE" : "FEED"}</span></div>
                {message && <p className="cf-status-note" role="status">{message}</p>}
                <button type="button" className="cf-red-button cf-share-cta" onClick={share}>Share {action === "story" ? "Story" : action === "video" ? "video note" : "post"} <Icon name="arrow" /></button>
              </>
            ) : (
              <div className="cf-community-compose">
                <span className="cf-user-initial">M</span><span className="cf-user-name">Maya Chen <small>Posting with your community</small></span>
                {action === "quote" ? <><label className="cf-field-label" htmlFor="cf-community-text">Your words</label><textarea id="cf-community-text" className="cf-textarea cf-quote-textarea" rows={5} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Write something worth keeping…" /></> :
                  action === "event" ? <><label className="cf-field-label" htmlFor="cf-community-text">Event name</label><input id="cf-community-text" className="cf-text-input" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="What are we getting together for?" /><label className="cf-field-label" htmlFor="cf-event-date">When</label><input id="cf-event-date" className="cf-text-input" type="datetime-local" /><label className="cf-field-label" htmlFor="cf-event-location">Where</label><input id="cf-event-location" className="cf-text-input" placeholder="Add a place or link" /></> :
                    action === "challenge" ? <><label className="cf-field-label" htmlFor="cf-community-text">Challenge details</label><textarea id="cf-community-text" className="cf-textarea" rows={4} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Set a sports challenge for your community…" /><label className="cf-field-label" htmlFor="cf-sport">Sport</label><select id="cf-sport" className="cf-text-input"><option>Choose a sport</option><option>Running</option><option>Basketball</option><option>Football</option><option>Other</option></select></> :
                      action === "board" ? <><div className="cf-board-prompt"><span className="cf-section-label">COMMUNITY PROMPT</span><b>What’s one small thing that made this week better?</b><small>Join the conversation on Get On Board.</small></div><label className="cf-field-label" htmlFor="cf-community-text">Your response</label><textarea id="cf-community-text" className="cf-textarea" rows={4} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Add your thought…" /></> :
                        <><label className="cf-field-label" htmlFor="cf-community-text">Your post</label><textarea id="cf-community-text" className="cf-textarea" rows={6} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="What would you like your community to know?" /><button type="button" className="cf-text-link" onClick={() => fileInput.current?.click()}><Icon name="photo" size={17} />Attach a local photo or video</button>{media.map((item) => <img className="cf-inline-attachment" key={item.url} src={item.url} alt={`Selected local file: ${item.name}`} />)}</>}
                <div className="cf-share-destination"><span><b>Sharing with</b><small>{action === "event" ? "Your community · Event" : action === "challenge" ? "Sports community · Challenge" : action === "board" ? "Get On Board · Prompt" : action === "quote" ? "Your feed · Quote" : "Your community · Post"}</small></span><span className="cf-dest-tag">{action === "event" ? "EVENT" : action === "challenge" ? "SPORTS" : action === "board" ? "PROMPT" : action === "quote" ? "QUOTE" : "POST"}</span></div>
                <button type="button" className="cf-red-button cf-share-cta" onClick={share}>{action === "event" ? "Create event" : action === "challenge" ? "Post challenge" : action === "board" ? "Add to prompt" : action === "quote" ? "Share quote" : "Share post"} <Icon name="arrow" /></button>
              </div>
            )}
          </div>
        </section>
      )}

      {stage === "shared" && (
        <section className="cf-shared-page" role="status">
          <span className="cf-shared-mark"><Icon name="check" size={29} /></span>
          <span className="cf-eyebrow">OLDTIME PREVIEW</span>
          <h1>Ready to share.</h1>
          <p>This is a visual prototype. Nothing was published.</p>
          <button type="button" className="cf-red-button" onClick={() => setStage("create")}>Back to Create <Icon name="arrow" /></button>
        </section>
      )}
      <input ref={fileInput} className="cf-file-input" type="file" accept="image/*,video/*" multiple aria-label="Choose photos or videos from this device" onChange={(event) => chooseFiles(event.currentTarget.files)} />
    </main>
  );
}

export default CreateFlow;
