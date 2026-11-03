import "./_group.css";

type IconName = "search" | "more" | "plus" | "heart" | "comment" | "bookmark" | "share" | "home" | "users" | "user";

function Icon({ name }: { name: IconName }) {
  const common = {
    className: "navic",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "search": return <svg {...common}><circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 4.5 4.5" /></svg>;
    case "more": return <svg {...common}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "heart": return <svg {...common}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" /></svg>;
    case "comment": return <svg {...common}><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></svg>;
    case "bookmark": return <svg {...common}><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z" /></svg>;
    case "share": return <svg {...common}><path d="M14 5h5v5M19 5 10 14" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></svg>;
    case "home": return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>;
    case "users": return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21" /></svg>;
    case "user": return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
  }
}

const storyPeople = [
  { name: "Your story", initial: "+", tone: "own" },
  { name: "zoe_babiie_", initial: "Z", tone: "one" },
  { name: "Maya", initial: "M", tone: "two" },
  { name: "Theo", initial: "T", tone: "three" },
  { name: "June", initial: "J", tone: "four" },
];

export function Current() {
  return (
    <div className="stage blast-timeline-preview">
      <div className="phone stories-phone">
        <section className="screen on community-screen">
          <div className="stories-feed-scroll">
            <header className="community-header">
              <h1>Blast</h1>
              <button type="button" className="community-header-action" aria-label="Search people, posts, and tags"><Icon name="search" /></button>
              <button type="button" className="community-header-action" aria-label="More Blast tools"><Icon name="more" /></button>
            </header>

            <section className="stories-section community-story-section">
              <div className="community-story-heading-row"><h2 className="stories-heading">Following</h2></div>
              <div className="community-story-rail" aria-label="Following and active Stories">
                {storyPeople.map((person) => (
                  <div className={`community-story-person ${person.tone === "own" ? "own-story" : ""}`} key={person.name}>
                    <button type="button" className="community-story-avatar-button" aria-label={`${person.name} story`}>
                      <span className="community-story-avatar-wrap">
                        <span className={`community-story-ring ${person.tone === "own" ? "" : "has-story"}`}>
                          <span className="preview-story-avatar">{person.initial}</span>
                        </span>
                        {person.tone === "own" && <i className="community-story-add"><Icon name="plus" /></i>}
                      </span>
                    </button>
                    <button type="button" className="community-story-name">{person.name}</button>
                  </div>
                ))}
              </div>
            </section>

            <section className="stories-section community-feed-section">
              <div className="community-feed-heading">
                <button className="community-note-open" type="button"><Icon name="plus" /><span>Create</span></button>
              </div>
              <div className="community-feed-tabs" role="tablist" aria-label="Community posts">
                <button type="button" role="tab" aria-selected="false">Following</button>
                <button type="button" role="tab" aria-selected="true" className="on">For you</button>
              </div>
              <div className="community-content-grid" aria-label="Recommended community posts">
                <article className="community-post-card">
                  <header className="community-post-author-row">
                    <button type="button" className="community-post-avatar" aria-label="Open Maya's profile"><span>M</span></button>
                    <button type="button" className="community-post-identity"><b>Maya Chen</b><small>@mayachen · 12m</small></button>
                  </header>
                  <button type="button" className="community-post-copy">The first tomatoes are finally ready. I left a basket by the shared gate if anyone wants to take a few home.</button>
                  <div className="community-post-media" data-count="1" data-kind="photo" aria-label="Post photos">
                    <button type="button" className="community-post-media-item" aria-label="Open garden photo">
                      <img src="https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=85" alt="Sunlight over a green garden" />
                    </button>
                  </div>
                  <div className="community-post-actions" aria-label="Post actions">
                    <button type="button" aria-label="Save post"><Icon name="bookmark" /><span>0</span></button>
                    <button type="button" aria-label="Like post"><Icon name="heart" /><span>18</span></button>
                    <button type="button" aria-label="Comment on post"><Icon name="comment" /><span>4</span></button>
                    <button type="button" aria-label="Share post"><Icon name="share" /></button>
                  </div>
                </article>

                <article className="community-post-card">
                  <header className="community-post-author-row">
                    <button type="button" className="community-post-avatar" aria-label="Open Theo's profile"><span>T</span></button>
                    <button type="button" className="community-post-identity"><b>Theo Brooks</b><small>@theobrooks · 38m</small></button>
                  </header>
                  <button type="button" className="community-post-copy">Took the lakeside path before the crowds. The water is so still this morning.</button>
                  <div className="community-post-actions" aria-label="Post actions">
                    <button type="button" aria-label="Save post"><Icon name="bookmark" /><span>0</span></button>
                    <button type="button" aria-label="Like post"><Icon name="heart" /><span>12</span></button>
                    <button type="button" aria-label="Comment on post"><Icon name="comment" /><span>3</span></button>
                    <button type="button" aria-label="Share post"><Icon name="share" /></button>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </section>
        <nav className="nav" aria-label="Primary navigation">
          <button type="button"><Icon name="home" /><span>Home</span></button>
          <button type="button" className="on"><Icon name="users" /><span>Blast</span></button>
          <button type="button"><Icon name="search" /><span>Search</span></button>
          <button type="button"><Icon name="comment" /><span>Chat</span></button>
          <button type="button"><Icon name="user" /><span>Profile</span></button>
        </nav>
      </div>
    </div>
  );
}

export default Current;
