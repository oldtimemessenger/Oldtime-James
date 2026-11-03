import { useState } from "react";
import "./_group.css";
import "./preview.css";

type IconName = "oldtime" | "home" | "search" | "bell" | "message" | "bookmark" | "users" | "activity" | "user" | "settings" | "plus" | "lock" | "chevron";

const iconPaths: Record<IconName, string> = {
  oldtime: '<rect x="9" y="1" width="6" height="3.3" rx="1.1"/><path d="M7.9 6.1a8.8 8.8 0 0 0-3.7 13.5M8.3 21.9a8.8 8.8 0 0 0 12.1-11.5"/><path d="m4.7 23 3.3-8.2.8 2.5.5-5.2 1.8 2 1-4.8.9 1.2c2.4-4 5.2-5.7 9-5.9.5 2.5-.9 5.7-2.8 7.5L17 12l1.4 1.2-4.8 2.8-2-.1.5 1.6-3.5 1.9Z"/><path d="M4.7 23 19.6 7.4"/>',
  home: '<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lock: '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
};

function Icon({ name }: { name: IconName }) {
  return <svg className="navic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><g dangerouslySetInnerHTML={{ __html: iconPaths[name] }} /></svg>;
}

const navigation: { label: string; icon: IconName; key: string }[] = [
  { label: "Home", icon: "home", key: "Home" },
  { label: "Search", icon: "search", key: "Search" },
  { label: "Notifications", icon: "bell", key: "Notifications" },
  { label: "Messages", icon: "message", key: "Messages" },
  { label: "Saved", icon: "bookmark", key: "Saved" },
  { label: "Communities", icon: "users", key: "Communities" },
  { label: "Activity", icon: "activity", key: "Activity" },
  { label: "Blast", icon: "oldtime", key: "Blast" },
  { label: "Profile", icon: "user", key: "Profile" },
];

export function Refresh() {
  const [activeNav, setActiveNav] = useState("Blast");
  const [activeTab, setActiveTab] = useState("Blasts");
  const [feedView, setFeedView] = useState("For you");
  const [savedOnly, setSavedOnly] = useState(false);
  const [storyDraftOpen, setStoryDraftOpen] = useState(false);
  const title = activeNav === "Saved" || savedOnly ? "Saved" : activeNav === "Blast" ? "Home" : activeNav;
  const communities: { name: string; category: string; description: string; icon: IconName }[] = [
    { name: "Everyday life", category: "Life", description: "Small wins, questions, and the things happening around you.", icon: "message" },
    { name: "Outdoors", category: "Outdoors", description: "Routes, hikes, fresh air, and places worth sharing.", icon: "activity" },
    { name: "Music scenes", category: "Music", description: "Find new sounds and talk about the music you love.", icon: "activity" },
  ];

  const chooseNav = (key: string) => {
    setActiveNav(key);
    if (key === "Saved") setSavedOnly(true);
    else if (key === "Blast" || key === "Home") setSavedOnly(false);
    if (key === "Communities") setActiveTab("Communities");
    if (key === "Blast" || key === "Home") setActiveTab("Blasts");
  };

  return (
    <div className="blast-mock-root refresh-root">
      <div className="phone light blast-wide-phone refresh-phone">
        <div className="blast-x-workspace refresh-workspace">
          <aside className="blast-x-sidebar refresh-sidebar" aria-label="Oldtime navigation">
            <button className="refresh-brand" type="button" onClick={() => chooseNav("Blast")} aria-label="Oldtime Blast home">
              <span className="refresh-mark"><Icon name="oldtime" /></span><span>Oldtime</span>
            </button>
            <nav className="blast-x-primary-nav refresh-nav" aria-label="Main navigation">
              {navigation.map((item) => (
                <button
                  className={`blast-x-nav-link refresh-nav-link ${activeNav === item.key ? "is-current" : ""}`}
                  type="button"
                  key={item.key}
                  onClick={() => chooseNav(item.key)}
                  aria-current={activeNav === item.key ? "page" : undefined}
                >
                  <Icon name={item.icon} /><span>{item.label}</span>
                </button>
              ))}
            </nav>
            <button className="refresh-compose" type="button" onClick={() => chooseNav("Blast")}><Icon name="plus" /><span>Post</span></button>
            <div className="refresh-sidebar-bottom">
              <button className="refresh-profile" type="button" onClick={() => chooseNav("Profile")}>
                <span className="refresh-avatar">O</span>
                <span className="refresh-profile-copy"><b>Oldtime member</b><small>@member</small></span>
                <span className="refresh-profile-more">···</span>
              </button>
            </div>
          </aside>

          <main className="blast-screen blast-hub refresh-main">
            <div className="blast-wrap blast-anim refresh-feed">
              <header className="refresh-mobile-header">
                <span className="refresh-mark"><Icon name="oldtime" /></span>
                <span>Blast</span>
                <button className="refresh-mobile-avatar" type="button" onClick={() => chooseNav("Profile")} aria-label="Open profile">O</button>
              </header>
              <div className="refresh-page-heading">
                <div><h1>Blast</h1><p>Small updates. Closer circles.</p></div>
                <button className="refresh-account-switch" type="button" onClick={() => chooseNav("Profile")} aria-label="Open your profile"><span className="refresh-avatar">O</span><span className="refresh-chevron">⌄</span></button>
              </div>
              <nav className="blast-tabs refresh-tabs" aria-label="Blast sections">
                {["Notes", "Blasts", "Communities"].map((tab) => (
                  <button className={`blast-tab ${activeTab === tab ? "is-active" : ""}`} type="button" key={tab} onClick={() => { setActiveTab(tab); setActiveNav(tab === "Communities" ? "Communities" : "Blast"); setSavedOnly(false); }} aria-current={activeTab === tab ? "page" : undefined}>{tab}</button>
                ))}
              </nav>
              <div className="refresh-feed-switcher">
                <div className="refresh-feed-views" role="tablist" aria-label="Timeline view">
                  {["For you", "Following"].map((view) => <button type="button" role="tab" aria-selected={feedView === view} className={feedView === view ? "is-active" : ""} key={view} onClick={() => setFeedView(view)}>{view}</button>)}
                </div>
                <button
                  type="button"
                  className={`refresh-saved-control ${savedOnly ? "is-selected" : ""}`}
                  onClick={() => { setSavedOnly((value) => !value); setActiveNav(savedOnly ? "Blast" : "Saved"); }}
                  aria-pressed={savedOnly}
                ><Icon name="bookmark" /><span>{savedOnly ? "Saved feed" : "Saved"}</span></button>
              </div>
              <section className="refresh-stories" aria-labelledby="refresh-stories-title">
                <div className="refresh-section-heading"><div><h2 id="refresh-stories-title">Stories</h2><span>Short moments from your circles</span></div><span className="refresh-section-note">Stories</span></div>
                <div className="refresh-story-rail">
                  <button className={`refresh-story-create ${storyDraftOpen ? "is-open" : ""}`} type="button" onClick={() => setStoryDraftOpen((open) => !open)} aria-expanded={storyDraftOpen}>
                    <span className="refresh-story-create-art"><span className="refresh-avatar">O</span><span className="refresh-story-plus"><Icon name="plus" /></span></span>
                    <b>{storyDraftOpen ? "Draft story" : "Add story"}</b><small>{storyDraftOpen ? "Preview only" : "Share a moment"}</small>
                  </button>
                  <div className="refresh-story-empty">
                    <span className="refresh-story-empty-mark"><Icon name="activity" /></span>
                    <span><b>No stories yet</b><small>New stories from your circles will appear here.</small></span>
                  </div>
                </div>
                {storyDraftOpen && <p className="refresh-story-notice" role="status">Story sharing isn’t connected in this preview. Nothing has been posted.</p>}
              </section>
              <section className="refresh-discover" aria-labelledby="refresh-discover-title">
                <div className="refresh-section-heading refresh-discover-heading">
                  <div><h2 id="refresh-discover-title">Discover</h2><span>Find a community to make yours</span></div>
                  <button type="button" onClick={() => { setActiveTab("Communities"); setActiveNav("Communities"); }}>View all <Icon name="chevron" /></button>
                </div>
                <div className="refresh-community-rail">
                  {communities.map((community) => (
                    <button className="refresh-community-card" type="button" key={community.name} onClick={() => { setActiveTab("Communities"); setActiveNav("Communities"); }}>
                      <span className="refresh-community-icon"><Icon name={community.icon} /></span>
                      <span className="refresh-community-category">{community.category}</span>
                      <b>{community.name}</b>
                      <small>{community.description}</small>
                    </button>
                  ))}
                </div>
              </section>
              <div className="refresh-compose-box">
                <span className="refresh-avatar">O</span>
                <button className="refresh-compose-prompt" type="button" onClick={() => chooseNav("Blast")}>What’s happening?</button>
                <span className="refresh-compose-divider" />
                <span className="refresh-audience"><Icon name="users" /> Blast Friends <span aria-hidden="true">⌄</span></span>
                <button className="refresh-post-button" type="button" onClick={() => chooseNav("Blast")}>Post</button>
              </div>
              <div className="refresh-filter-row">
                <label className="refresh-search"><Icon name="search" /><input type="search" placeholder="Search Blasts" aria-label="Search Blasts" /></label>
                <button className="refresh-filter-button" type="button" onClick={() => setSavedOnly((value) => !value)} aria-pressed={savedOnly}><Icon name="settings" /><span>Filter</span></button>
              </div>
              <section className="refresh-timeline" aria-labelledby="refresh-timeline-title">
                <div className="refresh-timeline-title"><div><h2 id="refresh-timeline-title">{savedOnly ? "Saved Blasts" : "Your timeline"}</h2><span>{savedOnly ? "Kept for later" : feedView === "For you" ? "A mix of your circles and communities" : "Posts from people you follow"}</span></div><span className="refresh-timeline-type">Latest</span></div>
                <div className="refresh-empty" aria-live="polite">
                  <span className="refresh-empty-mark"><Icon name={savedOnly ? "bookmark" : "message"} /></span>
                  <div className="refresh-empty-label">{savedOnly ? "SAVED" : feedView === "Following" ? "FOLLOWING" : "FOR YOU"}</div>
                  <h2>{savedOnly ? "Nothing saved just yet" : "Your timeline is ready"}</h2>
                  <p>{savedOnly ? "Save a Blast and it’ll be easy to find here later." : feedView === "Following" ? "Posts from people you follow will appear here. There’s nothing to catch up on yet." : "When your circles share a thought, question, activity, or plan, it’ll show up here."}</p>
                </div>
              </section>
              <div className="refresh-privacy"><Icon name="lock" /><span>Your audience is always your choice. Posts can be shared with Blast Friends, a group, a community, or just you.</span></div>
            </div>
          </main>

          <aside className="blast-x-right-rail refresh-rail" aria-label="Blast information">
            <label className="refresh-global-search"><Icon name="search" /><input type="search" placeholder="Search Oldtime" aria-label="Search Oldtime" /></label>
            <section className="refresh-rail-card">
              <div className="refresh-rail-eyebrow">YOUR SPACE</div>
              <h2>Close by, not crowded.</h2>
              <p>Blasts make room for quick thoughts, questions, activities, and plans with the people and communities you choose.</p>
              <button type="button" onClick={() => { setActiveTab("Communities"); setActiveNav("Communities"); }}>Browse Communities <Icon name="chevron" /></button>
            </section>
            <section className="refresh-privacy-card">
              <span className="refresh-lock-chip"><Icon name="lock" /> PRIVACY</span>
              <h2>Choose who sees each post.</h2>
              <p>Blast Friends, a group conversation, community members, or Only me.</p>
              <button type="button" onClick={() => setSavedOnly(false)}>How audiences work <Icon name="chevron" /></button>
            </section>
            <footer className="refresh-footer">About&nbsp; · &nbsp;Guidelines&nbsp; · &nbsp;Privacy<br /><span>Oldtime · A little closer to home.</span></footer>
          </aside>
        </div>
        <nav className="refresh-mobile-nav" aria-label="Mobile navigation">
          {[navigation[0], navigation[4], navigation[7], navigation[5], navigation[6]].map((item) => (
            <button type="button" key={item.key} onClick={() => chooseNav(item.key)} className={activeNav === item.key ? "is-current" : ""} aria-label={item.label}><Icon name={item.icon} /><span>{item.label}</span></button>
          ))}
        </nav>
      </div>
    </div>
  );
}
