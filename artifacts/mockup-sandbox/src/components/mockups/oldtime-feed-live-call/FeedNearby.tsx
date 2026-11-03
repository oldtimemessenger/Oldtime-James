import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import "./_group.css";

type Glyph = "home" | "search" | "people" | "message" | "profile" | "heart" | "comment" | "bookmark" | "share" | "pin" | "camera" | "bell" | "back" | "close" | "arrow";

const glyphPaths: Record<Glyph, string> = {
  home: '<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21"/>',
  message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  profile: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  comment: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  share: '<path d="M12 16.5H6.5C3.4 16.5.4 18 .4 20.5Q.4 16.7 2.4 15.3C4.2 12 7.5 8.4 12 8.4H12V1.2Q12 0 13 .9l10.1 9.8c1.2 1.1 1.2 1.3 0 2.6L13 23.1Q12 24 12 22.8v-6.3Z"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v14H3z"/><circle cx="12" cy="13" r="4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
};

function FeedIcon({ name, fill = false, className = "" }: { name: Glyph; fill?: boolean; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: glyphPaths[name] }} />;
}

const people = [
  { name: "You", src: "/__mockup/images/old-time-me.jpg", viewed: true },
  { name: "Nova", src: "/__mockup/images/old-time-nova.jpg" },
  { name: "June", src: "/__mockup/images/old-time-june.jpg" },
  { name: "Mara", src: "/__mockup/images/old-time-mara.jpg" },
];
const areas = ["All areas", "Los Angeles", "Miami", "Fort Lauderdale"];

export function FeedNearby() {
  const [view, setView] = useState("Explore");
  const [area, setArea] = useState("All areas");
  const [liked, setLiked] = useState(true);
  const [count, setCount] = useState(2012);
  const [saved, setSaved] = useState(true);
  const [savedCount, setSavedCount] = useState(334);
  const [activeNav, setActiveNav] = useState("Home");
  const [notice, setNotice] = useState("");
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number; tilt: number }>>([]);
  const lastTap = useRef(0);
  const burstId = useRef(0);
  const noticeTimer = useRef<number | undefined>(undefined);
  const isNearby = view === "Nearby";

  const notify = (text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 1800);
  };

  const spawnHeart = (x: number, y: number) => {
    const id = ++burstId.current;
    setBursts((items) => [...items, { id, x, y, tilt: (id % 2 ? -1 : 1) * (8 + id % 9) }]);
    window.setTimeout(() => setBursts((items) => items.filter((item) => item.id !== id)), 1050);
  };

  const toggleLike = (burst = false, x = 50, y = 56) => {
    setLiked((current) => {
      if (!current) setCount((value) => value + 1);
      return true;
    });
    if (burst) spawnHeart(x, y);
  };

  const onMediaTap = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const now = Date.now();
    if (now - lastTap.current < 320) toggleLike(true, x, y);
    lastTap.current = now;
  };
  const onMediaKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleLike(true);
    }
  };

  return (
    <main className="otf-feed" aria-label="Old Time home feed preview">
      {!isNearby ? (
        <section className="otf-feed-screen">
          <div className="otf-media" onClick={onMediaTap} onKeyDown={onMediaKeyDown} role="button" tabIndex={0} aria-label="Double tap the video to like">
            <img src="/__mockup/images/oldtime-fire-escape.jpg" alt="A neighbor catches the late-afternoon light on a Los Angeles fire escape" />
            <div className="otf-media-shade" />
            {bursts.map((heart) => (
              <svg key={heart.id} className="otf-heart-burst" style={{ left: `${heart.x}%`, top: `${heart.y}%`, "--tilt": `${heart.tilt}deg`, "--drift": `${heart.tilt * 1.4}px` } as CSSProperties} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
              </svg>
            ))}
          </div>
          <header className="otf-header">
            <div className="otf-view-tabs" role="tablist" aria-label="Home feed views">
              {["Following", "Explore", "Nearby"].map((item) => <button type="button" role="tab" aria-selected={view === item} className={view === item ? "on" : ""} key={item} onClick={() => setView(item)}>{item}</button>)}
            </div>
            <div className="otf-header-actions">
              <button type="button" aria-label="Search" onClick={() => notify("Search around Old Time")}><FeedIcon name="search" /></button>
              <button type="button" aria-label="Create post" onClick={() => notify("Start a new post")}><FeedIcon name="camera" /></button>
              <button type="button" aria-label="Notifications" onClick={() => notify("You’re all caught up")}><FeedIcon name="bell" /><i /></button>
            </div>
            <div className="otf-topics"><span className="selected">For You</span><span>Interests</span><span>Culture</span><span>Food</span><span>Travel</span></div>
          </header>
          <div className="otf-stories" aria-label="Stories">
            {people.map((person) => <button type="button" key={person.name} onClick={() => notify(`${person.name}’s story`)}><span className={person.viewed ? "seen" : ""}><img src={person.src} alt="" /></span>{person.name}</button>)}
          </div>
          <div className="otf-action-rail">
            <button type="button" aria-label={liked ? "Liked" : "Like post"} aria-pressed={liked} className={liked ? "liked" : ""} onClick={() => liked ? (setLiked(false), setCount((value) => value - 1)) : toggleLike(true)}><FeedIcon name="heart" fill /><small>{count.toLocaleString()}</small></button>
            <button type="button" aria-label="Comments" onClick={() => notify("Comments on this moment")}><FeedIcon name="comment" fill /><small>48</small></button>
            <button type="button" aria-label={saved ? "Remove saved post" : "Save post"} aria-pressed={saved} className={saved ? "saved" : ""} onClick={() => { setSaved((value) => !value); setSavedCount((value) => value + (saved ? -1 : 1)); notify(saved ? "Removed from saved moments" : "Saved for later"); }}><FeedIcon name="bookmark" fill /><small>{savedCount}</small></button>
            <button type="button" aria-label="Share post" onClick={() => notify("Ready to share this moment")}><FeedIcon name="share" fill /><small>467</small></button>
          </div>
          <div className="otf-post-copy">
            <div className="otf-author"><img src="/__mockup/images/old-time-june.jpg" alt="" /><b>June Park</b><span>·</span><button type="button" onClick={() => notify("Following June Park")}>Follow</button></div>
            <button className="otf-place-card" type="button" onClick={() => { setView("Nearby"); setArea("Los Angeles"); }}>
              <span className="otf-place-pin"><FeedIcon name="pin" /></span>
              <span><b>Silver Lake, Los Angeles</b><small>Moments from around here</small></span>
              <FeedIcon name="arrow" className="otf-place-arrow" />
            </button>
            <p>Golden hour on the fire escape. The whole block smelled like dinner.</p>
            <span className="otf-caption-location">Los Angeles · Original audio</span>
          </div>
          <div className="otf-soundbar">
            <div className="otf-audio-thumb"><FeedIcon name="camera" /></div>
            <div className="otf-audio-copy"><b>June Park · original sound</b><small>Shared 12 minutes ago</small></div>
            <button type="button" aria-label="Share post" onClick={() => notify("Ready to share this moment")}><FeedIcon name="share" fill /></button>
          </div>
        </section>
      ) : (
        <section className="otf-nearby-screen">
          <header className="otf-nearby-header">
            <button className="otf-back" type="button" aria-label="Back to Explore" onClick={() => setView("Explore")}><FeedIcon name="back" /></button>
            <div><small>OLD TIME · AROUND YOU</small><h1>Nearby</h1></div>
            <button className="otf-map-button" type="button" onClick={() => notify("Map view is ready to explore")}><FeedIcon name="pin" /> Map</button>
          </header>
          <div className="otf-area-row" role="tablist" aria-label="Choose an area">
            {areas.map((item) => <button key={item} type="button" className={area === item ? "on" : ""} aria-selected={area === item} onClick={() => setArea(item)}>{item}</button>)}
          </div>
          <div className="otf-local-intro"><div><span className="otf-local-kicker">YOUR LOCAL EDIT</span><h2>A little closer<br />to home.</h2><p>Real moments from the neighborhoods you know.</p></div><div className="otf-map-art" aria-hidden="true"><i className="road road-a" /><i className="road road-b" /><i className="road road-c" /><span className="map-pin map-one"><FeedIcon name="pin" /></span><span className="map-pin map-two"><FeedIcon name="pin" /></span><span className="map-dot" /></div></div>
          <div className="otf-local-heading"><span>Moments near {area === "All areas" ? "you" : area}</span><button type="button" onClick={() => notify("Showing the newest local moments")}>Newest <span>⌄</span></button></div>
          <button className="otf-local-post" type="button" onClick={() => { setView("Explore"); notify("Opening June’s moment"); }}>
            <img src="/__mockup/images/oldtime-late-noodles.jpg" alt="A late-night neighborhood noodle counter" />
            <span className="otf-local-post-shade" />
             <span className="otf-local-post-copy"><b>After-hours noodles, always.</b><small><img src="/__mockup/images/old-time-nova.jpg" alt="" /> Nova · Echo Park</small></span>
            <span className="otf-local-post-like"><FeedIcon name="heart" fill /> 126</span>
          </button>
          <button className="otf-venue-card" type="button" onClick={() => notify("Opening the Sunset Junction place page")}><span className="otf-venue-mark">S</span><span><small>EXPLORE THIS PLACE</small><b>Sunset Junction</b><em>Local spots and neighborhood moments</em></span><FeedIcon name="arrow" /></button>
          <nav className="otf-bottom-nav" aria-label="Primary navigation">
            {(["Home", "Search", "Communities", "Messages", "Profile"] as const).map((item) => <button type="button" key={item} className={activeNav === item ? "on" : ""} onClick={() => { setActiveNav(item); if (item !== "Home") notify(`${item} preview`); }}><FeedIcon name={item === "Home" ? "home" : item === "Search" ? "search" : item === "Communities" ? "people" : item === "Messages" ? "message" : "profile"} /><span>{item}</span></button>)}
          </nav>
        </section>
      )}
      {!isNearby && <nav className="otf-bottom-nav" aria-label="Primary navigation">
        {(["Home", "Search", "Communities", "Messages", "Profile"] as const).map((item) => <button type="button" key={item} className={activeNav === item ? "on" : ""} onClick={() => { setActiveNav(item); if (item !== "Home") notify(`${item} preview`); }}><FeedIcon name={item === "Home" ? "home" : item === "Search" ? "search" : item === "Communities" ? "people" : item === "Messages" ? "message" : "profile"} /><span>{item}</span></button>)}
      </nav>}
      {notice && <div className="otf-toast" role="status">{notice}</div>}
    </main>
  );
}
