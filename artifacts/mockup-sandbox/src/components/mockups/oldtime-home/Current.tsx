import "./_group.css";

const avatar = {
  june: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70",
  nova: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=70",
  kev: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=70",
  mara: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=200&q=70",
  you: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=70",
};

const iconPaths = {
  home: '<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  comment: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  share: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4zM16 9l5 5M21 9l-5 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v14H3z"/><circle cx="12" cy="13" r="4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  repost: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 14-4 4 4 4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
};

function Icon({ name, filled = false }: { name: keyof typeof iconPaths; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="navic"
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: iconPaths[name] }}
    />
  );
}

const storyPeople = [
  { name: "You", image: avatar.you, seen: true },
  { name: "Nova", image: avatar.nova },
  { name: "Kev", image: avatar.kev },
  { name: "Mara", image: avatar.mara },
];

export function Current() {
  return (
    <div className="stage">
      <div className="phone">
        <section className="screen on home-screen">
          <div className="feed" id="feed">
            <article className="clip" data-id="p2">
              <img
                className="fullimg"
                src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=70"
                alt=""
              />
              <div className="shade" />
              <div className="rail">
                <button className="act on" type="button" aria-label="Like post" aria-pressed="true">
                  <Icon name="heart" filled />
                  2
                </button>
                <button className="act" type="button" aria-label="Comments">
                  <Icon name="comment" />
                  0
                </button>
                <button className="act" type="button" aria-label="Repost post">
                  <Icon name="repost" />
                  0
                </button>
              </div>
              <div className="meta" style={{ bottom: 158 }}>
                <div className="handle">
                  <img src={avatar.june} alt="" className="avatar" />
                  <button type="button">June Park</button>
                </div>
                <div className="cap">Golden hour on the fire escape.</div>
                <div className="sub">Los Angeles</div>
              </div>
              <div className="soundbar">
                <img src={avatar.june} alt="" />
                <div>
                  <b>Original audio</b>
                  <div className="sub">▶ 4.2k</div>
                </div>
                <button className="remix" type="button" aria-label="Save post">
                  <Icon name="bookmark" />
                </button>
                <button className="remix" type="button">Share</button>
              </div>
            </article>
          </div>

          <header className="home-discovery-header">
            <div className="home-primary-row">
              <nav className="home-view-tabs" role="tablist" aria-label="Home feed views">
                <button className="home-view-tab" type="button" role="tab" aria-selected="false">Following</button>
                <button className="home-view-tab on" type="button" role="tab" aria-selected="true">Explore</button>
                <button className="home-view-tab" type="button" role="tab" aria-selected="false">Nearby</button>
              </nav>
              <span className="home-header-actions">
                <button className="icon" type="button" aria-label="Search"><Icon name="search" /></button>
                <button className="icon" type="button" aria-label="Create"><Icon name="camera" /></button>
                <button className="icon" type="button" aria-label="Notifications"><Icon name="bell" /></button>
              </span>
            </div>
            <nav className="home-topic-tabs" role="tablist" aria-label="Explore topics">
              {["For You", "Around the World", "Culture", "Comedy", "Fashion", "Food", "Travel", "Music", "Beauty", "Sports", "Art & Design", "Pets", "Gaming", "Learning"].map((topic, index) => (
                <button className={`home-topic-tab${index === 0 ? " on" : ""}`} type="button" role="tab" aria-selected={index === 0} key={topic}>
                  {topic}
                </button>
              ))}
            </nav>
          </header>

          <div className="stories home-stories" aria-label="Stories">
            {storyPeople.map((person) => (
              <button className="story" type="button" key={person.name}>
                <div className={`ring${person.seen ? " seen" : ""}`}>
                  <img src={person.image} alt="" />
                </div>
                {person.name}
              </button>
            ))}
          </div>
        </section>

        <nav className="nav" aria-label="Main navigation">
          <button className="on" type="button" aria-label="Home"><Icon name="home" /></button>
          <button type="button" aria-label="Search"><Icon name="search" /></button>
          <button type="button" aria-label="Chat"><Icon name="comment" /></button>
          <button type="button" aria-label="Communities"><Icon name="users" /></button>
          <button type="button" aria-label="Profile"><Icon name="user" /></button>
        </nav>
      </div>
    </div>
  );
}
