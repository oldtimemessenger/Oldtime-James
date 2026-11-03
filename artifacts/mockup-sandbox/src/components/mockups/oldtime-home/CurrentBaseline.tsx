import { useState } from "react";
import "./_group.css";

type IconName =
  | "home"
  | "heart"
  | "comment"
  | "repost"
  | "bookmark"
  | "search"
  | "bell"
  | "user"
  | "users"
  | "camera"
  | "share"
  | "pin";

const iconPaths: Record<IconName, string> = {
  home: '<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  comment: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  repost: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 14-4 4 4 4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v14H3z"/><circle cx="12" cy="13" r="4"/>',
  share: '<path d="M4 12c0-5 3.6-8 9-8h2V1l7 7-7 7v-3h-2c-3.7 0-6.6 1.4-9 4z"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
};

function Icon({ name, filled = false }: { name: IconName; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="navic"
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={name === "repost" ? 2.7 : name === "share" ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: iconPaths[name] }}
    />
  );
}

const topics = [
  "For You",
  "Interests",
  "Around the World",
  "Culture",
  "Comedy",
  "Fashion",
  "Food",
  "Travel",
  "Music",
  "Beauty",
  "Sports",
  "Art & Design",
  "Pets",
  "Gaming",
  "Learning",
];

const views = ["Following", "Explore", "Nearby"];

const avatars = {
  june: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70",
  nova: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=70",
  kev: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=70",
  mara: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=200&q=70",
  you: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=70",
};

const storyPeople = [
  { name: "You", image: avatars.you, seen: true },
  { name: "Nova", image: avatars.nova },
  { name: "Kev", image: avatars.kev },
  { name: "Mara", image: avatars.mara },
];

const nearbyAreas = ["Los Angeles", "Miami"];

export function CurrentBaseline() {
  const [activeView, setActiveView] = useState("Explore");
  const [activeTopic, setActiveTopic] = useState("For You");
  const [activeNav, setActiveNav] = useState("Home");
  const [nearbyArea, setNearbyArea] = useState("all");
  const [locationUsed, setLocationUsed] = useState(false);
  const [liked, setLiked] = useState(true);
  const [likeCount, setLikeCount] = useState(2);
  const [saved, setSaved] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [notice, setNotice] = useState("");

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1800);
  };

  const postVisible = activeView !== "Nearby" || nearbyArea === "all" || nearbyArea === "Los Angeles";

  return (
    <div className="ot-current-baseline">
      <style>{`
        .ot-current-baseline {
          --bg: #151c1b;
          --panel: #202a28;
          --card: #263330;
          --line: rgba(245,238,220,.13);
          --text: #f5f0e4;
          --muted: #aab8ae;
          --accent: #d3ddd4;
          --accent-pink: #d3ddd4;
          --close-friends: #8dba91;
          --accent-gold: #e7b85e;
          --notification-accent: var(--accent-gold);
          --close-friends-ring: var(--accent-gold);
          --story-ring: conic-gradient(from 200deg, #e7b85e 0%, #f2ca78 50%, #e7b85e 100%);
          --font: Manrope, system-ui, sans-serif;
          width: 100%;
          height: 100dvh;
          min-height: 660px;
          overflow: hidden;
          color: var(--text);
          background: #000;
          font-family: var(--font);
          -webkit-font-smoothing: antialiased;
        }
        .ot-current-baseline *, .ot-current-baseline *::before, .ot-current-baseline *::after { box-sizing: border-box; }
        .ot-current-baseline button, .ot-current-baseline input { font: inherit; color: inherit; }
        .ot-current-baseline button { cursor: pointer; }
        .ot-current-baseline .stage { width: 100%; height: 100%; min-height: 100%; padding: 0; background: #000; }
        .ot-current-baseline .phone { width: 100%; height: 100dvh; background: var(--bg); }
        .ot-current-baseline .screen, .ot-current-baseline .clip { background: var(--bg); }
        .ot-current-baseline .clip { background: #0c0d12; }
        .ot-current-baseline .home-discovery-header { background: linear-gradient(180deg, rgba(7,8,12,.98), rgba(7,8,12,.9) 72%, rgba(7,8,12,0)); }
        .ot-current-baseline .home-topic-tab.on::after, .ot-current-baseline .home-view-tab.on::after { background: var(--accent); }
        .ot-current-baseline .home-header-actions .icon { width: 28px; min-width: 28px; height: 30px; }
        .ot-current-baseline .home-header-actions .navic { width: 16px; height: 16px; }
        .ot-current-baseline .home-stories { top: calc(max(16px, env(safe-area-inset-top, 0px)) + 78px); }
        .ot-current-baseline .nearby-controls { padding: 4px 2px 0; }
        .ot-current-baseline .nearby-location-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0 7px; border-top: 1px solid rgba(245,238,220,.13); }
        .ot-current-baseline .nearby-location-label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; }
        .ot-current-baseline .nearby-location-label .navic { width: 14px; height: 14px; color: var(--muted); }
        .ot-current-baseline .nearby-location-button { padding: 6px 9px; border: 1px solid rgba(245,238,220,.2); border-radius: 999px; font-size: 10px; font-weight: 750; white-space: nowrap; }
        .ot-current-baseline .nearby-area-list { display: flex; gap: 7px; overflow-x: auto; padding: 3px 0 5px; scrollbar-width: none; }
        .ot-current-baseline .nearby-area-chip { flex: 0 0 auto; padding: 6px 9px; border: 1px solid rgba(245,238,220,.16); border-radius: 999px; color: var(--muted); font-size: 10px; font-weight: 700; }
        .ot-current-baseline .nearby-area-chip.on { color: var(--text); border-color: rgba(245,238,220,.65); background: rgba(255,255,255,.08); }
        .ot-current-baseline .nearby-area-chip small { margin-left: 3px; color: var(--muted); }
        .ot-current-baseline .nearby-privacy-note { display: block; padding: 1px 0 6px; color: var(--muted); font-size: 9px; }
        .ot-current-baseline .home-stories.nearby-on { top: calc(max(16px, env(safe-area-inset-top, 0px)) + 142px); }
        .ot-current-baseline .feed { background: var(--bg); }
        .ot-current-baseline .clip .fullimg { object-fit: cover; }
        .ot-current-baseline .act.on { color: var(--accent); }
        .ot-current-baseline .act[data-repost].on { color: #fff; }
        .ot-current-baseline .nav { grid-template-columns: repeat(5, 1fr); }
        .ot-current-baseline .nav button { color: #a39c93; font-size: 10px; }
        .ot-current-baseline .nav button.on { color: var(--text); }
        .ot-current-baseline .nav button .navic { width: 24px; height: 24px; }
        .ot-current-baseline .nav button span { display: block; }
        .ot-current-baseline .soundbar { grid-template-columns: 36px minmax(0,1fr) auto; }
        .ot-current-baseline .soundbar > div:not(.post-actions) { min-width: 0; }
        .ot-current-baseline .soundbar > div b { color: #fff; font-size: 11px; }
        .ot-current-baseline .soundbar .sub { color: rgba(255,255,255,.68); font-size: 10px; }
        .ot-current-baseline .current-post-actions { display: flex; align-items: center; gap: 4px; }
        .ot-current-baseline .current-post-actions button { min-width: 32px; height: 34px; display: grid; place-items: center; padding: 7px !important; }
        .ot-current-baseline .current-post-actions .navic { width: 16px; height: 16px; }
        .ot-current-baseline .current-post-actions .on { color: var(--accent); }
        .ot-current-baseline .soundbar .share-action .navic { fill: currentColor; stroke-width: 0; }
        .ot-current-baseline .current-notice { position: absolute; z-index: 20; left: 50%; bottom: calc(80px + env(safe-area-inset-bottom)); max-width: calc(100% - 32px); padding: 9px 13px; border: 1px solid rgba(245,238,220,.15); border-radius: 999px; color: var(--text); background: rgba(32,42,40,.96); font-size: 11px; font-weight: 750; white-space: nowrap; transform: translateX(-50%); }
        @media (max-width: 370px) {
          .ot-current-baseline .home-view-tabs { gap: 4px; }
          .ot-current-baseline .home-view-tab { font-size: 11px; }
          .ot-current-baseline .home-header-actions .icon { width: 26px; min-width: 26px; height: 28px; }
        }
      `}</style>

      <div className="stage">
        <div className="phone">
          <section className="screen on home-screen">
            <div className="feed" id="current-baseline-feed">
              {postVisible ? (
                <article className="clip" data-id="p2">
                  <img
                    className="fullimg"
                    src="/__mockup/images/oldtime-fire-escape.jpg"
                    alt=""
                  />
                  <div className="shade" />
                  <div className="rail">
                    <button
                      className={`act${liked ? " on" : ""}`}
                      type="button"
                      aria-label="Like post"
                      aria-pressed={liked}
                      onClick={() => {
                        setLiked((current) => !current);
                        setLikeCount((current) => current + (liked ? -1 : 1));
                      }}
                    >
                      <Icon name="heart" filled />
                      {likeCount}
                    </button>
                    <button className="act" type="button" aria-label="Comments" onClick={() => notify("Comments open from this post")}>
                      <Icon name="comment" />
                      0
                    </button>
                  </div>
                  <div className="meta" style={{ bottom: 158 }}>
                    <div className="handle">
                      <img src={avatars.june} alt="" className="avatar" />
                      <button type="button" onClick={() => notify("June Park’s profile")}>June Park</button>
                    </div>
                    <div className="cap">Golden hour on the fire escape.</div>
                    <div className="sub">Los Angeles</div>
                  </div>
                  <div className="soundbar" role="group" aria-label="Post details and actions">
                    <img src={avatars.june} alt="" />
                    <div>
                      <b>Original audio</b>
                      <div className="sub">4.2k views</div>
                    </div>
                    <div className="post-actions current-post-actions">
                      <button className={`remix${saved ? " on" : ""}`} type="button" aria-label={saved ? "Remove saved post" : "Save post"} aria-pressed={saved} onClick={() => setSaved((current) => !current)}>
                        <Icon name="bookmark" filled={saved} />
                      </button>
                      <button className={`remix${reposted ? " on" : ""}`} type="button" aria-label={reposted ? "Remove repost" : "Repost post"} aria-pressed={reposted} onClick={() => setReposted((current) => !current)}>
                        <Icon name="repost" />
                      </button>
                      <button className="remix share-action" type="button" aria-label="Share post" onClick={() => notify("Ready to share this post")}>
                        <Icon name="share" filled />
                      </button>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="interest-feed-empty">
                  <div className="interest-feed-mark" aria-hidden="true">⌖</div>
                  <b>No posts in this area yet</b>
                  <p>Pick an area or switch to all areas to find more posts.</p>
                  <button type="button" onClick={() => setNearbyArea("all")}>Explore all areas</button>
                </div>
              )}
            </div>

            <header className="home-discovery-header">
              <div className="home-primary-row">
                <nav className="home-view-tabs" role="tablist" aria-label="Home feed views">
                  {views.map((view) => (
                    <button
                      className={`home-view-tab${activeView === view ? " on" : ""}`}
                      key={view}
                      type="button"
                      role="tab"
                      aria-selected={activeView === view}
                      onClick={() => setActiveView(view)}
                    >
                      {view}
                    </button>
                  ))}
                </nav>
                <span className="home-header-actions">
                  <button className="icon" type="button" aria-label="Search" onClick={() => notify("Search opens from Home")}><Icon name="search" /></button>
                  <button className="icon" type="button" aria-label="Create" onClick={() => notify("Create a post")}><Icon name="camera" /></button>
                  <button className="icon" type="button" aria-label="Notifications" onClick={() => notify("Notifications")}><Icon name="bell" /><i className="badge" /></button>
                </span>
              </div>
              <nav className="home-topic-tabs" role="tablist" aria-label="Explore topics">
                {topics.map((topic) => (
                  <button
                    className={`home-topic-tab${activeTopic === topic ? " on" : ""}`}
                    key={topic}
                    type="button"
                    role="tab"
                    aria-selected={activeTopic === topic}
                    onClick={() => setActiveTopic(topic)}
                  >
                    {topic}
                  </button>
                ))}
              </nav>
              {activeView === "Nearby" && (
                <div className="nearby-controls">
                  <div className="nearby-location-line">
                    <span className="nearby-location-label"><Icon name="pin" />{nearbyArea === "all" ? "Explore posts by area" : `Near ${nearbyArea}`}</span>
                    <button className="nearby-location-button" type="button" onClick={() => setLocationUsed(true)}>
                      {locationUsed ? "Refresh" : "Use my location"}
                    </button>
                  </div>
                  <nav className="nearby-area-list" aria-label="Choose a nearby area">
                    <button className={`nearby-area-chip${nearbyArea === "all" ? " on" : ""}`} type="button" aria-pressed={nearbyArea === "all"} onClick={() => setNearbyArea("all")}>All areas <small>3</small></button>
                    {nearbyAreas.map((area) => (
                      <button className={`nearby-area-chip${nearbyArea === area ? " on" : ""}`} key={area} type="button" aria-pressed={nearbyArea === area} onClick={() => setNearbyArea(area)}>
                        {area} <small>{area === "Los Angeles" ? "2" : "1"}</small>
                      </button>
                    ))}
                  </nav>
                  <small className="nearby-privacy-note">{locationUsed ? "Your exact location isn’t saved or shared." : "Location is optional. You can browse these areas without it."}</small>
                </div>
              )}
            </header>

            <div className={`stories home-stories${activeView === "Nearby" ? " nearby-on" : ""}`} aria-label="Stories">
              {storyPeople.map((person) => (
                <button className="story" type="button" key={person.name} onClick={() => notify(`${person.name}’s story`)}>
                  <div className={`ring${person.seen ? " seen" : ""}`}>
                    <img src={person.image} alt="" />
                  </div>
                  {person.name}
                </button>
              ))}
            </div>
          </section>

          <nav className="nav" aria-label="Primary navigation">
            <button className={activeNav === "Home" ? "on" : ""} type="button" aria-label="Home" onClick={() => setActiveNav("Home")}><Icon name="home" /><span>Home</span></button>
            <button className={activeNav === "Search" ? "on" : ""} type="button" aria-label="Search" onClick={() => { setActiveNav("Search"); notify("Search"); }}><Icon name="search" /><span>Search</span></button>
            <button className={activeNav === "Communities" ? "on" : ""} type="button" aria-label="Communities" onClick={() => { setActiveNav("Communities"); notify("Communities"); }}><Icon name="users" /><span>Communities</span></button>
            <button className={activeNav === "Messages" ? "on" : ""} type="button" aria-label="Messages" onClick={() => { setActiveNav("Messages"); notify("Messages"); }}><Icon name="comment" /><span>Messages</span></button>
            <button className={activeNav === "Profile" ? "on" : ""} type="button" aria-label="Profile" onClick={() => { setActiveNav("Profile"); notify("Profile"); }}><Icon name="user" /><span>Profile</span></button>
          </nav>
        </div>
      </div>
      {notice && <div className="current-notice" role="status">{notice}</div>}
    </div>
  );
}
