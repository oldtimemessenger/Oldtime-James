import "./_group.css";

const icons = {
  users: (
    <svg viewBox="0 0 24 24" className="navic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" className="navic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" className="navic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h4l2-3h6l2 3h4v14H3z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" className="navic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="13" height="15" rx="2" />
      <path d="M7 5V3h14v14h-5M4 16l4-4 3 3 2-2 3 3" />
      <circle cx="9" cy="10" r="1.2" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" className="navic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 4 12 8-12 8z" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" className="navic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  ),
  comment: (
    <svg viewBox="0 0 24 24" className="navic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" className="navic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="12" rx="2" />
      <path d="M8 10V6a4 4 0 0 1 8 0v4" />
    </svg>
  ),
};

const notes = [
  {
    id: "note-1",
    name: "Maya Chen",
    username: "mayachen",
    initial: "M",
    time: "Today · 9:42 AM",
    audience: "Blast Friends",
    image: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=85",
    caption: "Took the long way to the market this morning. The light was too good to rush past.",
    type: "Photo note",
    hearts: 8,
    comments: 3,
  },
  {
    id: "note-2",
    name: "Theo Brooks",
    username: "theobrooks",
    initial: "T",
    time: "Yesterday",
    audience: "Public",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
    caption: "A little trail update before the weekend. The last stretch is finally dry again.",
    type: "Video note",
    duration: "0:18",
    hearts: 12,
    comments: 5,
  },
];

function NoteCard({ note }: { note: (typeof notes)[number] }) {
  return (
    <article className="bvn-feed-card" data-testid="blast-video-note-card">
      <div className="bvn-card-top">
        <span className="bvn-avatar" aria-hidden="true">{note.initial}</span>
        <div className="bvn-card-person">
          <b>{note.name}</b>
          <small>@{note.username} · {note.time}</small>
        </div>
        <span className="bvn-audience">{note.audience}</span>
      </div>
      <div className="bvn-feed-media">
        <button className="bvn-note-preview" type="button" aria-label={`Open ${note.type.toLowerCase()}`}>
          <img className="bvn-note-image" src={note.image} alt="" />
          <svg className="bvn-note-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" />
          {note.duration && <span className="bvn-note-duration">{note.duration}</span>}
          <span className="bvn-note-play" aria-hidden="true">{icons.play}</span>
        </button>
      </div>
      <p className="bvn-caption">{note.caption}</p>
      <div className="bvn-card-actions">
        <span>{note.type}{note.duration ? ` · ${note.duration}` : ""}</span>
        <div className="bvn-social-actions">
          <button type="button" aria-label={`Heart this note, ${note.hearts} hearts`}>{icons.heart} {note.hearts}</button>
          <button type="button">{icons.comment} Comments · {note.comments}</button>
        </div>
      </div>
    </article>
  );
}

export function Current() {
  return (
    <main className="blast-screen bvn-screen min-h-screen">
      <div className="blast-wrap bvn-wrap">
        <header className="bvn-header">
          <div><span className="bvn-kicker">VIDEO NOTES</span><h1>Blast</h1></div>
          <div className="bvn-header-actions">
            <button className="bvn-icon-button" type="button" aria-label="Blast Friends">{icons.users}</button>
            <button className="bvn-icon-button" type="button" aria-label="Blast extras">{icons.more}</button>
          </div>
        </header>
        <nav className="bvn-tabs" aria-label="Blast sections">
          <button type="button" className="is-active" aria-current="page">Video notes</button>
          <button type="button">Chats</button>
          <button type="button">Feed &amp; events</button>
        </nav>
        <section className="bvn-intro">
          <div className="bvn-intro-copy">
            <span className="bvn-kicker">A quick moment, shared your way</span>
            <h2>Make a video note.</h2>
            <p>Record a short note, mark up a photo, then send it to a friend or your feed.</p>
          </div>
          <div className="bvn-quick-actions">
            <button className="bvn-record-cta" type="button" data-testid="blast-record-note">{icons.camera}<span>Record a video note</span></button>
            <button className="bvn-library-cta" type="button">{icons.image} Add photo or clip</button>
          </div>
        </section>
        <div className="bvn-feed-heading">
          <div><span className="bvn-kicker">FROM YOUR PEOPLE</span><h2>Video notes</h2></div>
          <span>{notes.length}</span>
        </div>
        {notes.map((note) => <NoteCard key={note.id} note={note} />)}
        <p className="bvn-device-note">{icons.lock} Notes, media, and Blast chats stay on this device. They do not sync to other devices.</p>
      </div>
    </main>
  );
}
