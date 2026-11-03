import "./_group.css";
import "./preview.css";

const paths: Record<string, string> = {
  home: '<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  comment: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  timeCircle: '<rect x="9" y="1" width="6" height="3.3" rx="1.1"/><path d="M7.9 6.1a8.8 8.8 0 0 0-3.7 13.5M8.3 21.9a8.8 8.8 0 0 0 12.1-11.5"/><path d="m4.7 23 3.3-8.2.8 2.5.5-5.2 1.8 2 1-4.8.9 1.2c2.4-4 5.2-5.7 9-5.9.5 2.5-.9 5.7-2.8 7.5L17 12l1.4 1.2-4.8 2.8-2-.1.5 1.6-3.5 1.9Z"/><path d="M4.7 23 19.6 7.4"/>',
};

function Icon({ name }: { name: string }) {
  return (
    <svg className="navic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <g dangerouslySetInnerHTML={{ __html: paths[name] || paths.timeCircle }} />
    </svg>
  );
}

const links = [
  ["Home", "home"],
  ["Blast", "timeCircle"],
  ["Communities", "users"],
  ["Messages", "comment"],
  ["Profile", "user"],
];

export function Current() {
  return (
    <div className="blast-mock-root">
      <div className="phone light blast-wide-phone">
        <div className="blast-x-workspace">
          <aside className="blast-x-sidebar" aria-label="Oldtime navigation">
            <div className="blast-x-wordmark">
              <span className="blast-x-mark"><Icon name="timeCircle" /></span><span>Blast</span>
            </div>
            <nav className="blast-x-primary-nav" aria-label="Main navigation">
              {links.map(([label, icon]) => (
                <button className={`blast-x-nav-link ${label === "Blast" ? "is-current" : ""}`} type="button" key={label}>
                  <Icon name={icon} /><span>{label}</span>
                </button>
              ))}
            </nav>
            <button className="blast-x-post-button" type="button">Post</button>
            <div className="blast-x-sidebar-bottom">
              <div className="blast-x-account"><span className="blast-x-account-name">Oldtime member</span><span>@member</span></div>
              <button className="blast-x-nav-link" type="button"><Icon name="settings" /><span>More</span></button>
            </div>
          </aside>

          <main className="blast-screen blast-hub">
            <div className="blast-wrap blast-anim">
              <header className="blast-head">
                <div><div className="blast-brand">Blast</div><p className="blast-kicker">A little closer to home.</p></div>
                <div className="blast-head-actions">
                  <button className="blast-icon-btn" type="button" aria-label="Manage Blast Friends"><Icon name="users" /></button>
                  <button className="blast-icon-btn" type="button" aria-label="Open Blast settings"><Icon name="settings" /></button>
                </div>
              </header>
              <nav className="blast-tabs" aria-label="Blast sections">
                <button className="blast-tab" type="button">Notes</button>
                <button className="blast-tab is-active" type="button" aria-current="page">Blasts</button>
                <button className="blast-tab" type="button">Communities</button>
              </nav>
              <div className="blast-feed-title"><h2>Home</h2><small>0 posts</small></div>
              <div className="blast-compose-bar">
                <span className="blast-me-avatar" aria-hidden="true">O</span>
                <button className="blast-compose-prompt" type="button">What’s happening?</button>
                <button className="blast-compose-create" type="button">Post</button>
              </div>
              <form className="blast-feed-tools">
                <input className="blast-input" type="search" placeholder="Search posts" aria-label="Search posts" />
                <label className="blast-filter-wrap"><span className="blast-sr-only">Filter by category</span><select className="blast-select" aria-label="Filter by category"><option>All categories</option></select></label>
                <button className="blast-search-submit" type="button" aria-label="Search"><Icon name="search" /></button>
              </form>
              <section className="blast-card blast-empty">
                <span className="blast-empty-mark"><Icon name="comment" /></span>
                <h3>Start the conversation</h3>
                <p>Your Blast feed is ready for its first thought or plan.</p>
                <button className="blast-primary" type="button">Create a Blast</button>
              </section>
            </div>
          </main>

          <aside className="blast-x-right-rail" aria-label="Blast discovery and information">
            <section className="blast-x-rail-card"><h2>Find your people</h2><p>Discover communities and conversations around the things you care about.</p><button type="button">Explore communities</button></section>
            <section className="blast-x-rail-card"><h2>Build your circle</h2><p>Blast Friends are a separate circle for posts and private chats.</p><button type="button">Manage Blast Friends</button></section>
            <section className="blast-x-rail-note"><h2>Your audience, your choice</h2><p>Choose Blast Friends, a group, a community, or Only me when you post.</p><button type="button">Privacy details</button></section>
            <footer className="blast-x-footer">Oldtime · Blast</footer>
          </aside>
        </div>
      </div>
    </div>
  );
}
