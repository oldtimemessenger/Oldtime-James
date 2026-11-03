import { useState } from "react";
import "./CombinedTimeline.css";

type Kind = "Moment" | "Post" | "Event";
type Entry = {
  id: string;
  kind: Kind;
  author: string;
  initials: string;
  time: string;
  audience: string;
  text: string;
  likes: number;
  comments: number;
  noteType?: "Photo note" | "Video note";
  duration?: string;
  eventTitle?: string;
  eventMeta?: string;
};

const initialEntries: Entry[] = [
  {
    id: "morning-light", kind: "Moment", author: "Maya Chen", initials: "M", time: "9:42 AM",
    audience: "Blast friends", text: "Took the long way to the market this morning. The light was too good to rush past.",
    likes: 8, comments: 3, noteType: "Photo note",
  },
  {
    id: "garden-meetup", kind: "Event", author: "June Park", initials: "J", time: "9:18 AM",
    audience: "Neighborhood", text: "Saturday morning at the garden. Bring a mug; we’ll have the kettle on.",
    likes: 14, comments: 6, eventTitle: "Riverside garden morning", eventMeta: "Sat, Oct 18 · 10:00 AM · Riverside plots",
  },
  {
    id: "trail-note", kind: "Moment", author: "Theo Brooks", initials: "T", time: "8:57 AM",
    audience: "Public", text: "A little trail update before the weekend. The last stretch is finally dry again.",
    likes: 12, comments: 5, noteType: "Video note", duration: "0:18",
  },
  {
    id: "corner-store", kind: "Post", author: "Sam Rivera", initials: "S", time: "8:31 AM",
    audience: "Public", text: "The corner store is collecting pantry staples for the school drive through Friday. Drop-off box is by the front door.",
    likes: 21, comments: 4,
  },
  {
    id: "book-swap", kind: "Event", author: "Old Mill Neighbors", initials: "O", time: "Yesterday · 6:14 PM",
    audience: "Neighborhood", text: "Bring one book, leave with another. All ages welcome.",
    likes: 19, comments: 8, eventTitle: "Little free book swap", eventMeta: "Sun, Oct 19 · 2:00 PM · Mill Square",
  },
];

const drawerItems = [
  { title: "Friends & requests", subtitle: "Your Blast friends, kept close", icon: "friends", disabled: false },
  { title: "Gifts catalog", subtitle: "Not available in this preview", icon: "gift", disabled: true },
  { title: "Membership", subtitle: "Membership plans", icon: "check", disabled: true },
  { title: "Blue Badge", subtitle: "Verification details", icon: "badge", disabled: true },
  { title: "Gift activity & revenue", subtitle: "Earnings and gift history", icon: "activity", disabled: true },
  { title: "Gift preferences", subtitle: "Choose what you’re open to", icon: "settings", disabled: false },
  { title: "Community guidelines", subtitle: "How we look out for each other", icon: "lock", disabled: false },
  { title: "Privacy summary", subtitle: "Your audience, at a glance", icon: "privacy", disabled: false },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (name) {
    case "camera": return <svg {...common}><path d="M3 7h4l2-3h6l2 3h4v14H3z" /><circle cx="12" cy="13" r="4" /></svg>;
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "menu": return <svg {...common}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
    case "home": return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>;
    case "users": return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21" /></svg>;
    case "heart": return <svg {...common}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" /></svg>;
    case "message": return <svg {...common}><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></svg>;
    case "lock": return <svg {...common}><rect x="4" y="10" width="16" height="12" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4" /></svg>;
    case "play": return <svg {...common}><path d="m9 6 10 6-10 6z" fill="currentColor" stroke="none" /></svg>;
    case "photo": return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></svg>;
    case "text": return <svg {...common}><path d="M4 6h16M4 12h11M4 18h8" /></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
    case "chevron": return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
    case "gift": return <svg {...common}><rect x="3" y="9" width="18" height="12" rx="2" /><path d="M12 9v12M3 13h18M12 9H7.5a2.5 2.5 0 1 1 2.5-2.5V9Zm0 0h4.5A2.5 2.5 0 1 0 14 6.5V9Z" /></svg>;
    case "check": return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    case "badge": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
    case "activity": return <svg {...common}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>;
    case "settings": return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9L16 21h-3l-.4-1.9a8 8 0 0 1-1.6-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.6-.9L13 7h3l.3 1.9a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 2.3Z" transform="translate(-1 -2)" /></svg>;
    case "privacy": return <svg {...common}><rect x="4" y="10" width="16" height="12" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v4" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

function EntryCard({
  entry, liked, going, onLike, onRsvp, onNotice,
}: {
  entry: Entry;
  liked: boolean;
  going: boolean;
  onLike: () => void;
  onRsvp: () => void;
  onNotice: (message: string) => void;
}) {
  return (
    <article className="blast-home__item">
      <div className="blast-home__item-top">
        <span className="blast-home__avatar" aria-hidden="true">{entry.initials}</span>
        <div className="blast-home__person">
          <strong>{entry.author}</strong>
          <small>{entry.time} · {entry.kind === "Moment" ? entry.noteType : entry.kind}</small>
        </div>
        <span className="blast-home__audience">{entry.audience}</span>
        <button className="blast-home__more" type="button" aria-label={`More about ${entry.author}'s ${entry.kind.toLowerCase()}`} onClick={() => onNotice("More post options are part of this preview.")}>
          <Icon name="menu" size={17} />
        </button>
      </div>
      {entry.kind === "Moment" && (
        <div className="blast-home__moment-art" role="img" aria-label="Illustrated golden-hour hills">
          <div className="blast-home__hills" />
          <span className="blast-home__art-label"><Icon name={entry.noteType === "Video note" ? "play" : "photo"} size={12} /> {entry.noteType}{entry.duration ? ` · ${entry.duration}` : ""}</span>
          {entry.noteType === "Video note" && <button className="blast-home__play" type="button" aria-label="Play video note" onClick={() => onNotice("Video note preview") }><span><Icon name="play" size={18} /></span></button>}
        </div>
      )}
      <p className={`blast-home__message${entry.kind === "Moment" ? " blast-home__note-copy" : ""}`}>{entry.text}</p>
      {entry.kind === "Event" && (
        <div className="blast-home__event">
          <span className="blast-home__event-date"><small>OCT</small><b>{entry.id === "garden-meetup" ? "18" : "19"}</b></span>
          <div className="blast-home__event-copy"><strong>{entry.eventTitle}</strong><span>{entry.eventMeta}</span></div>
          <button type="button" className={`blast-home__rsvp${going ? " is-going" : ""}`} onClick={onRsvp} aria-pressed={going}>{going ? "Going" : "I’m in"}</button>
        </div>
      )}
      <div className="blast-home__card-actions">
        <button type="button" className={`blast-home__action${liked ? " is-liked" : ""}`} onClick={onLike} aria-pressed={liked} aria-label={`${liked ? "Unlike" : "Like"} this ${entry.kind.toLowerCase()}`}>
          <Icon name="heart" size={15} /> {entry.likes + (liked ? 1 : 0)}
        </button>
        <button type="button" className="blast-home__action" onClick={() => onNotice(`${entry.comments} replies on this ${entry.kind.toLowerCase()}.`)}>
          <Icon name="message" size={15} /> {entry.comments}
        </button>
      </div>
    </article>
  );
}

export function CombinedTimeline() {
  const [filter, setFilter] = useState<"All" | Kind>("All");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [going, setGoing] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");

  const showNotice = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2300);
  };
  const shownEntries = filter === "All" ? initialEntries : initialEntries.filter((entry) => entry.kind === filter);
  const startCompose = (choice: string) => {
    setComposeOpen(false);
    showNotice(`${choice} composer · ready to start`);
  };
  const selectDestination = (title: string, disabled: boolean) => {
    if (disabled) return;
    setDrawerOpen(false);
    showNotice(`${title} · on this device`);
  };

  return (
    <main className="blast-home" aria-label="Blast home">
      <div className="blast-home__scroll">
        <div className="blast-home__inner">
          <header className="blast-home__header">
            <div className="blast-home__brand">
              <span className="blast-home__brand-mark" aria-hidden="true"><Icon name="camera" size={20} /></span>
              <div><h1 className="blast-home__wordmark">Old Time’s <span>Blast</span></h1><p className="blast-home__subhead">Good things happen nearby.</p></div>
            </div>
            <div className="blast-home__header-actions">
              <button className="blast-home__icon-btn" type="button" aria-label="Open Blast friends" onClick={() => showNotice("Friends & requests are in More from Blast.")}><Icon name="users" /></button>
              <button className="blast-home__icon-btn" type="button" aria-label="Open More from Blast" onClick={() => setDrawerOpen(true)}><Icon name="menu" /></button>
            </div>
          </header>

          <section className="blast-home__moments" aria-label="Friends’ recent moments">
            <button type="button" className="blast-home__moment blast-home__moment--self" onClick={() => setComposeOpen(true)} aria-label="Add your moment">
              <span className="blast-home__moment-ring"><Icon name="plus" size={17} /><span className="blast-home__moment-add"><Icon name="plus" size={10} /></span></span><span>Your note</span>
            </button>
            {[["M","Maya"],["T","Theo"],["J","June"],["S","Sam"]].map(([initial, name]) => (
              <button type="button" className="blast-home__moment" key={name} onClick={() => showNotice(`${name}’s recent moments`)}>
                <span className="blast-home__moment-ring">{initial}</span><span>{name}</span>
              </button>
            ))}
          </section>

          <section className="blast-home__compose" aria-label="Share a moment">
            <span className="blast-home__self-avatar" aria-hidden="true">Y</span>
            <button type="button" className="blast-home__compose-prompt" onClick={() => setComposeOpen((open) => !open)}>What’s happening around you?</button>
            <button type="button" className="blast-home__capture" onClick={() => setComposeOpen((open) => !open)} aria-expanded={composeOpen}><Icon name="camera" size={17} /> Capture</button>
          </section>

          <div className="blast-home__timeline-head">
            <div><h2 className="blast-home__timeline-title">Around you</h2><p className="blast-home__timeline-caption">One stream, in the order it happened.</p></div>
            <span className="blast-home__scope"><Icon name="lock" size={12} /> Your circle</span>
          </div>
          <nav className="blast-home__filters" aria-label="Filter timeline">
            {(["All", "Moment", "Post", "Event"] as const).map((item) => (
              <button type="button" key={item} className={`blast-home__filter${filter === item ? " is-active" : ""}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                {item === "All" ? "Everything" : item === "Moment" ? "Moments" : `${item}s`}
              </button>
            ))}
          </nav>

          <section className="blast-home__feed" aria-label={`${filter === "All" ? "All updates" : `${filter} updates`} in chronological order`}>
            {shownEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                liked={!!liked[entry.id]}
                going={!!going[entry.id]}
                onLike={() => setLiked((current) => ({ ...current, [entry.id]: !current[entry.id] }))}
                onRsvp={() => setGoing((current) => ({ ...current, [entry.id]: !current[entry.id] }))}
                onNotice={showNotice}
              />
            ))}
          </section>
          <p className="blast-home__device-note"><Icon name="lock" size={12} /> Moments and Blast chats stay on this device.</p>
        </div>
      </div>

      {composeOpen && (
        <section className="blast-home__compose-pop" aria-label="Choose what to share">
          <h3>Share a moment</h3>
          <div className="blast-home__compose-options">
            <button type="button" className="blast-home__compose-option" onClick={() => startCompose("Video note")}><Icon name="camera" /> Video note</button>
            <button type="button" className="blast-home__compose-option" onClick={() => startCompose("Photo note")}><Icon name="photo" /> Photo note</button>
            <button type="button" className="blast-home__compose-option" onClick={() => startCompose("Text post")}><Icon name="text" /> Text post</button>
            <button type="button" className="blast-home__compose-option" onClick={() => startCompose("Event plan")}><Icon name="calendar" /> Event plan</button>
          </div>
        </section>
      )}

      {toast && <div className="blast-home__toast" role="status" aria-live="polite">{toast}</div>}

      {drawerOpen && (
        <>
          <button type="button" className="blast-home__scrim" aria-label="Close More from Blast" onClick={() => setDrawerOpen(false)} />
          <section className="blast-home__drawer" role="dialog" aria-modal="true" aria-labelledby="blast-drawer-title">
            <header className="blast-home__drawer-head">
              <h2 id="blast-drawer-title">More from Blast</h2>
              <span className="blast-home__device-label">On this device</span>
            </header>
            <p className="blast-home__drawer-intro">Your people, privacy, and neighborhood tools — all in one place.</p>
            <div className="blast-home__drawer-list">
              {drawerItems.map((item) => (
                <button
                  type="button"
                  className="blast-home__drawer-row"
                  key={item.title}
                  disabled={item.disabled}
                  aria-label={`${item.title}${item.disabled ? " — preview only" : ""}`}
                  onClick={() => selectDestination(item.title, item.disabled)}
                >
                  <span className="blast-home__drawer-icon"><Icon name={item.icon} size={21} /></span>
                  <span className="blast-home__drawer-copy"><strong>{item.title}</strong><small>{item.disabled ? "Not available in this preview" : item.subtitle}</small></span>
                  {item.disabled ? <span className="blast-home__locked-tag">Preview only</span> : <Icon name="chevron" size={16} />}
                </button>
              ))}
            </div>
            <p className="blast-home__drawer-foot"><Icon name="lock" size={15} /> Friends and close relationships stay separate from public follows.</p>
          </section>
        </>
      )}
    </main>
  );
}

export default CombinedTimeline;
