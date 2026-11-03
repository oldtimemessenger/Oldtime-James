import "./NotesLanding.css";
import { useState } from "react";
import type { ReactNode } from "react";

const iconPaths: Record<string, ReactNode> = {
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21" /></>,
  settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  image: <><rect x="3" y="5" width="18" height="16" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  play: <path d="m8 4 12 8-12 8z" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />,
  comment: <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
};

function Icon({ name }: { name: string }) {
  return <svg className="ot-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name] ?? iconPaths.plus}</svg>;
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

type Note = (typeof notes)[number];
type FeedItem = { kind: "note"; note: Note } | { kind: "post" };

function Avatar({ initial, className = "ot-avatar" }: { initial: string; className?: string }) {
  return <span className={className} aria-hidden="true">{initial}</span>;
}

function NoteCard({ note, liked, onLike }: { note: Note; liked: boolean; onLike: () => void }) {
  return (
    <article className="ot-feed-card">
      <div className="ot-card-top">
        <Avatar initial={note.initial} />
        <div className="ot-card-person"><b>{note.name}</b><small>@{note.username}<span>·</span>{note.time}</small></div>
        <span className="ot-audience">{note.audience}</span>
        <button className="ot-more" type="button" aria-label={`More options for ${note.name}'s note`}><Icon name="more" /></button>
      </div>
      <button className="ot-note-preview" type="button" aria-label={`Open ${note.mediaType} note`}>
        <img src={note.image} alt={note.mediaType === "video" ? "Video note preview" : "Photo note"} />
        {note.mediaType === "video" && <><span className="ot-video-tag"><Icon name="play" /> Video · {note.duration}</span><span className="ot-note-play"><Icon name="play" /></span></>}
      </button>
      <p className="ot-caption">{note.caption}</p>
      <div className="ot-card-actions">
        <span className="ot-note-kind">{note.mediaType === "video" ? `Video note · ${note.duration}` : "Photo note"}</span>
        <div className="ot-social-actions">
          <button type="button" className={liked ? "is-liked" : ""} aria-label={`${liked ? "Unlike" : "Like"} note, ${note.hearts + Number(liked)} hearts`} aria-pressed={liked} onClick={onLike}><Icon name="heart" /> {note.hearts + Number(liked)}</button>
          <button type="button" aria-label={`${note.comments} comments`}><Icon name="comment" /> {note.comments}</button>
        </div>
      </div>
    </article>
  );
}

function MomentCard({ note }: { note: Note }) {
  return <button className="ot-story-card" type="button" aria-label={`Open ${note.name}'s latest moment`}>
    <img src={note.image} alt="" />
    <span className="ot-story-wash" />
    <span className="ot-story-person"><Avatar initial={note.initial} className="ot-story-avatar" /><b>{note.name.split(" ")[0]}</b></span>
    {note.mediaType === "video" && <span className="ot-story-play"><Icon name="play" /></span>}
  </button>;
}

function PostCard({ liked, onLike }: { liked: boolean; onLike: () => void }) {
  return <article className="ot-feed-card ot-post-card">
    <div className="ot-card-top">
      <Avatar initial={post.initial} />
      <div className="ot-card-person"><b>{post.author}</b><small>@{post.username}<span>·</span>{post.time}</small></div>
      <span className="ot-audience">{post.audience}</span>
      <button className="ot-more" type="button" aria-label="More options for Jordan's post"><Icon name="more" /></button>
    </div>
    <p className="ot-post-copy">{post.body}</p>
    <div className="ot-card-actions">
      <span className="ot-note-kind">A note from your circle</span>
      <div className="ot-social-actions">
        <button type="button" aria-label={`${post.comments} replies`}><Icon name="comment" /> {post.comments}</button>
        <button type="button" className={liked ? "is-liked" : ""} aria-label={`${liked ? "Unlike" : "Like"} post, ${post.hearts + Number(liked)} hearts`} aria-pressed={liked} onClick={onLike}><Icon name="heart" /> {post.hearts + Number(liked)}</button>
      </div>
    </div>
  </article>;
}

export function NotesLanding() {
  const [filter, setFilter] = useState("All");
  const [liked, setLiked] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const items: FeedItem[] = [
    { kind: "note", note: notes[0] },
    { kind: "note", note: notes[1] },
    { kind: "post" },
    { kind: "note", note: notes[2] },
  ];
  const visibleItems = items.filter((item) => filter === "All" || (filter === "Moments" ? item.kind === "note" : item.kind === "post"));
  const toggleLike = (id: string) => setLiked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const acknowledge = (label: string) => {
    setNotice(`${label} is ready to share from your Notes.`);
    window.setTimeout(() => setNotice(""), 2400);
  };

  return <div className="oldtime-notes">
    <main className="ot-screen">
      <div className="ot-shell">
        <header className="ot-header">
          <div className="ot-brand-lockup"><span className="ot-brand-mark">o</span><span className="ot-brand-name">oldtime</span></div>
          <div className="ot-header-tools"><button type="button" aria-label="Friends" onClick={() => acknowledge("Friends")}><Icon name="users" /></button><button type="button" aria-label="Notes settings" onClick={() => acknowledge("Settings")}><Icon name="settings" /></button></div>
        </header>
        <section className="ot-title-row">
          <div><span className="ot-eyebrow">YOUR PEOPLE, IN THE MOMENT</span><h1>Notes<span className="ot-title-dot">.</span></h1></div>
          <button className="ot-new-note" type="button" onClick={() => acknowledge("A new note")}><Icon name="plus" /><span>New note</span></button>
        </section>
        <nav className="ot-section-nav" aria-label="Notes timeline">
          <button type="button" className="active" aria-current="page">For you</button>
          <span className="ot-nav-divider" />
          <span className="ot-nav-context">A little of everything from your circle</span>
        </nav>
        <section className="ot-composer" aria-label="Create a note">
          <div className="ot-compose-main"><Avatar initial="O" className="ot-avatar ot-you-avatar" /><button type="button" className="ot-compose-prompt" onClick={() => acknowledge("Your note")}>What’s happening in your world?</button><button className="ot-compose-photo" type="button" aria-label="Add a photo or video" onClick={() => acknowledge("A photo or video")}><Icon name="image" /></button></div>
          <div className="ot-compose-actions">
            <button type="button" onClick={() => acknowledge("A quick moment")}><span className="ot-action-icon ot-action-record" /><span>Record</span></button>
            <button type="button" onClick={() => acknowledge("A photo or video")}><Icon name="image" /><span>Photo or video</span></button>
            <button type="button" onClick={() => acknowledge("An event")}><Icon name="calendar" /><span>Plan an event</span></button>
          </div>
        </section>
        <section className="ot-moments" aria-label="Recent moments">
          <div className="ot-section-heading"><div><span className="ot-eyebrow">FRESH FROM YOUR FRIENDS</span><h2>Recent moments</h2></div><span className="ot-count">03 people</span></div>
          <div className="ot-story-row">
            <button className="ot-story-card ot-create-story" type="button" onClick={() => acknowledge("A new moment")} aria-label="Create a moment"><span className="ot-create-icon"><Icon name="plus" /></span><span className="ot-create-copy"><b>Your moment</b><small>Add to the day</small></span></button>
            {notes.map((note) => <MomentCard key={note.id} note={note} />)}
          </div>
        </section>
        <section className="ot-feed" aria-label="Your Notes feed">
          <div className="ot-section-heading ot-feed-heading"><div><span className="ot-eyebrow">THE DAILY EDIT</span><h2>From your circle</h2></div><span className="ot-count">04 updates</span></div>
          <nav className="ot-filters" aria-label="Filter notes">
            {["All", "Moments", "Posts", "Events"].map((label) => <button key={label} type="button" className={filter === label ? "active" : ""} aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}
          </nav>
          <div className="ot-feed-list">
            {visibleItems.map((item, index) => item.kind === "note"
              ? <NoteCard key={item.note.id} note={item.note} liked={liked.includes(item.note.id)} onLike={() => toggleLike(item.note.id)} />
              : <PostCard key={`post-${index}`} liked={liked.includes("post")} onLike={() => toggleLike("post")} />)}
          </div>
          {visibleItems.length === 0 ? <p className="ot-empty">No events in this part of your feed yet.</p> : <p className="ot-feed-end">You’re all caught up.</p>}
        </section>
      </div>
      {notice && <div className="ot-notice" role="status">{notice}</div>}
    </main>
  </div>;
}
