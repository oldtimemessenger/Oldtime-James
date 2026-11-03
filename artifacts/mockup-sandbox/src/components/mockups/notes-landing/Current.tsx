import "./_group.css";
import type { ReactNode } from "react";

const iconPaths: Record<string, ReactNode> = {
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21" /></>,
  settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  camera: <><path d="M3 7h4l2-3h6l2 3h4v14H3z" /><circle cx="12" cy="13" r="4" /></>,
  image: <><rect x="3" y="5" width="18" height="16" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  play: <path d="m8 4 12 8-12 8z" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />,
  comment: <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg className="navic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name] || iconPaths.plus}
    </svg>
  );
}

const notes = [
  {
    id: "note-1",
    name: "Maya Chen",
    username: "mayachen",
    initial: "M",
    time: "9:42 AM",
    image: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1100&q=85",
    caption: "Took the long way to the market this morning. The light was too good to rush past.",
    mediaType: "image",
    audience: "Blast Friends",
    hearts: 8,
    comments: 3,
  },
  {
    id: "note-2",
    name: "Theo Brooks",
    username: "theobrooks",
    initial: "T",
    time: "8:16 AM",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1100&q=85",
    caption: "A little trail update before the weekend. The last stretch is finally dry again.",
    mediaType: "video",
    duration: "0:18",
    audience: "Blast Friends",
    hearts: 12,
    comments: 5,
  },
  {
    id: "note-3",
    name: "Nina Alvarez",
    username: "ninaalvarez",
    initial: "N",
    time: "Yesterday",
    image: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1100&q=85",
    caption: "A quiet corner, a good book, and absolutely nowhere else to be.",
    mediaType: "image",
    audience: "Blast Friends",
    hearts: 21,
    comments: 4,
  },
];

const post = {
  author: "Jordan Lee",
  username: "jordanlee",
  initial: "J",
  time: "Yesterday",
  audience: "Blast Friends",
  body: "Anyone up for the Saturday farmers market? I’ll be there around 10 if you want to say hi.",
  hearts: 6,
  comments: 2,
};

function Avatar({ initial, className = "bvn-avatar" }: { initial: string; className?: string }) {
  return <span className={className} aria-hidden="true">{initial}</span>;
}

function NoteCard({ note }: { note: (typeof notes)[number] }) {
  return (
    <article className="bvn-feed-card" data-testid="blast-video-note-card">
      <div className="bvn-card-top">
        <Avatar initial={note.initial} />
        <div className="bvn-card-person">
          <b>{note.name}</b>
          <small>@{note.username} · {note.time}</small>
        </div>
        <span className="bvn-audience">{note.audience}</span>
      </div>
      <div className="bvn-feed-media">
        <button className="bvn-note-preview" type="button" aria-label={`Open ${note.mediaType} note`}>
          <img src={note.image} alt={note.mediaType === "video" ? "Video note preview" : "Photo note"} />
          <span className="bvn-note-overlay" aria-hidden="true" />
          {note.mediaType === "video" && <span className="bvn-note-duration">{note.duration}</span>}
          <span className="bvn-note-play" aria-hidden="true"><Icon name="play" /></span>
        </button>
      </div>
      <p className="bvn-caption">{note.caption}</p>
      <div className="bvn-card-actions">
        <span>{note.mediaType === "video" ? `Video note · ${note.duration}` : "Photo note"}</span>
        <div className="bvn-social-actions">
          <button type="button" aria-label={`Heart this note, ${note.hearts} hearts`}><Icon name="heart" /> {note.hearts}</button>
          <button type="button"><Icon name="comment" /> Comments · {note.comments}</button>
        </div>
      </div>
    </article>
  );
}

function MomentCard({ note }: { note: (typeof notes)[number] }) {
  return (
    <button className="bvn-story-card" type="button" aria-label={`Open ${note.name}'s latest moment`}>
      <span className="bvn-story-media"><img src={note.image} alt="" /></span>
      <span className="bvn-story-person"><Avatar initial={note.initial} className="bvn-story-avatar" /><b>{note.name.split(" ")[0]}</b></span>
      <span className="bvn-story-play" aria-hidden="true"><Icon name="play" /></span>
    </button>
  );
}

function PostCard() {
  return (
    <article className="bvn-feed-card bvn-post-card">
      <div className="bvn-card-top">
        <Avatar initial={post.initial} />
        <div className="bvn-card-person">
          <b>{post.author}</b>
          <small>@{post.username} · {post.time}</small>
        </div>
        <span className="bvn-audience">{post.audience}</span>
      </div>
      <p className="blast-post-copy">{post.body}</p>
      <div className="blast-post-meta"><span>Post</span></div>
      <div className="blast-post-actions">
        <button type="button" aria-label={`Reply, ${post.comments} replies`}><Icon name="comment" /><span>{post.comments}</span></button>
        <button type="button" aria-label={`Heart, ${post.hearts} hearts`}><Icon name="heart" /><span>{post.hearts}</span></button>
      </div>
    </article>
  );
}

export function Current() {
  return (
    <div className="notes-landing-root">
      <main className="bvn-screen bvn-twitter-feed">
        <div className="bvn-wrap">
          <header className="bvn-header">
            <div><span className="bvn-kicker">MOMENTS &amp; COMMUNITY</span><h1>Blast</h1></div>
            <div className="bvn-header-actions">
              <button className="bvn-icon-button" type="button" aria-label="Blast Friends"><Icon name="users" /></button>
              <button className="bvn-icon-button" type="button" aria-label="Open Blast settings"><Icon name="settings" /></button>
            </div>
          </header>
          <nav className="bvn-tabs" aria-label="Blast sections">
            <button type="button" className="is-active" aria-current="page">Timeline</button>
            <button type="button">Chats</button>
            <button type="button">Blasts</button>
          </nav>

          <section className="bvn-content-composer" aria-label="Create a post">
            <div className="bvn-compose-main">
              <Avatar initial="O" />
              <button type="button" className="bvn-compose-prompt">What's on your mind?</button>
              <button type="button" className="bvn-compose-photo" aria-label="Add a photo or video"><Icon name="image" /></button>
            </div>
            <div className="bvn-compose-actions">
              <button type="button"><Icon name="camera" /><span>Record</span></button>
              <button type="button"><Icon name="image" /><span>Photo or video</span></button>
              <button type="button"><Icon name="calendar" /><span>Plan an event</span></button>
            </div>
          </section>

          <section className="bvn-moments-section bvn-content-stories" aria-label="Recent moments">
            <div className="bvn-moments-heading">
              <div><span className="bvn-kicker">RECENT MOMENTS</span><h2>From your people</h2></div>
              <small>{notes.length} people</small>
            </div>
            <div className="bvn-moment-row">
              <button type="button" className="bvn-story-card bvn-story-create" aria-label="Create a moment">
                <span className="bvn-story-create-art"><span><Icon name="plus" /></span></span>
                <span className="bvn-story-create-label">Create a moment</span>
              </button>
              {notes.map((note) => <MomentCard key={note.id} note={note} />)}
            </div>
          </section>

          <div className="bvn-feed-heading">
            <div><span className="bvn-kicker">THE LATEST</span><h2>For you</h2></div>
            <span>4 updates</span>
          </div>
          <nav className="bvn-feed-filters" aria-label="Filter timeline">
            <button type="button" className="is-active" aria-pressed="true">All</button>
            <button type="button" aria-pressed="false">Moments</button>
            <button type="button" aria-pressed="false">Posts</button>
            <button type="button" aria-pressed="false">Events</button>
          </nav>
          <div className="bvn-feed-list">
            <NoteCard note={notes[0]} />
            <NoteCard note={notes[1]} />
            <PostCard />
            <NoteCard note={notes[2]} />
          </div>
          <p className="bvn-feed-end">You're all caught up.</p>
        </div>
      </main>
    </div>
  );
}
