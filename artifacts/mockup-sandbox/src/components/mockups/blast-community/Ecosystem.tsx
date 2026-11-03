import { FormEvent, useMemo, useState } from "react";
import "./Ecosystem.css";

type IconName = "community" | "chat" | "home" | "camera" | "plus" | "heart" | "reply" | "play" | "lock" | "close" | "send" | "search" | "chevron";
type FeedPost = {
  id: string;
  author: string;
  initials: string;
  time: string;
  community: string;
  text: string;
  likes: number;
  replies: number;
  image?: "hills" | "lake" | "interior";
  mediaLabel?: string;
};

const initialPosts: FeedPost[] = [
  {
    id: "morning-market", author: "Maya Chen", initials: "M", time: "12 min",
    community: "Neighborhood Gardeners",
    text: "The first tomatoes are finally ready. I left a basket by the shared gate if anyone wants to take a few home.",
    likes: 18, replies: 4, image: "hills", mediaLabel: "A bright morning over the garden beds",
  },
  {
    id: "shoreline-walk", author: "Theo Brooks", initials: "T", time: "38 min",
    community: "Weekend Walkers",
    text: "Took the lakeside path before the crowds. The water is so still this morning.",
    likes: 12, replies: 3, image: "lake", mediaLabel: "Quiet water at the edge of the trail",
  },
  {
    id: "open-studio", author: "June Park", initials: "J", time: "1 hr",
    community: "Neighborhood Gardeners",
    text: "A small reminder that the seed library is open this afternoon. Bring anything you’ve saved, or just come say hello.",
    likes: 9, replies: 2, image: "interior", mediaLabel: "A sunlit community room",
  },
  {
    id: "good-book", author: "Sam Rivera", initials: "S", time: "2 hr",
    community: "Book People",
    text: "Finished The Door in the Hedge last night. Looking for something gentle and strange for the next rainy day.",
    likes: 7, replies: 6,
  },
];

const communities = [
  { id: "gardeners", name: "Neighborhood Gardeners", icon: "community" as const, posts: "6 new updates" },
  { id: "walkers", name: "Weekend Walkers", icon: "home" as const, posts: "2 new updates" },
  { id: "book-people", name: "Book People", icon: "chat" as const, posts: "1 new update" },
];

const stories = [
  { initial: "M", name: "Maya", line: "Morning in the garden" },
  { initial: "T", name: "Theo", line: "A quiet walk by the lake" },
  { initial: "J", name: "June", line: "Getting the room ready" },
  { initial: "S", name: "Sam", line: "Today’s reading corner" },
];

function Icon({ name, size }: { name: IconName; size?: number }) {
  const common = {
    className: "ce-icon",
    width: size ?? 18,
    height: size ?? 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "community": return <svg {...common}><path d="M3 20v-1.2a5.8 5.8 0 0 1 11.6 0V20M8.8 10.7a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2ZM15.5 5.2a3 3 0 0 1 0 5.9M17 14.2a4.8 4.8 0 0 1 4 4.7V20" /></svg>;
    case "chat": return <svg {...common}><path d="M20.5 11.5a8.2 8.2 0 0 1-.9 3.8 8.4 8.4 0 0 1-7.5 4.6 8.2 8.2 0 0 1-3.8-.9L3 21l1.8-5.4a8.2 8.2 0 0 1-.9-3.8 8.4 8.4 0 0 1 4.6-7.5 8.2 8.2 0 0 1 3.8-.9h.5a8.4 8.4 0 0 1 7.7 7.7v.4Z" /></svg>;
    case "home": return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>;
    case "camera": return <svg {...common}><path d="M3 7h4l2-3h6l2 3h4v14H3z" /><circle cx="12" cy="13" r="4" /></svg>;
    case "plus": return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "heart": return <svg {...common}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" /></svg>;
    case "reply": return <svg {...common}><path d="M10 8 5 12l5 4M5 12h9a5 5 0 0 1 5 5v1" /></svg>;
    case "play": return <svg {...common}><path d="m9 6 10 6-10 6z" fill="currentColor" stroke="none" /></svg>;
    case "lock": return <svg {...common}><rect x="4" y="10" width="16" height="12" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4" /></svg>;
    case "close": return <svg {...common}><path d="m18 6-12 12M6 6l12 12" /></svg>;
    case "send": return <svg {...common}><path d="m21 3-7.5 18-3.7-7.8L2 9.5 21 3ZM9.8 13.2 21 3" /></svg>;
    case "search": return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
    case "chevron": return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
  }
}

function Avatar({ initial, className = "" }: { initial: string; className?: string }) {
  return <span className={`ce-avatar ${className}`} aria-hidden="true">{initial}</span>;
}

export function Ecosystem() {
  const [scope, setScope] = useState<"all" | "joined">("all");
  const [selectedCommunity, setSelectedCommunity] = useState("");
  const [joined, setJoined] = useState(true);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [posts, setPosts] = useState(initialPosts);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState("");
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const [chatName, setChatName] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatReplies, setChatReplies] = useState<string[]>([]);
  const [activeMobileTab, setActiveMobileTab] = useState<"community" | "chats">("community");
  const [toast, setToast] = useState("");

  const shownPosts = useMemo(() => posts.filter((post) => {
    const matchesScope = scope === "all" || joined;
    const matchesCommunity = !selectedCommunity || communities.find((community) => community.id === selectedCommunity)?.name === post.community;
    return matchesScope && matchesCommunity;
  }), [joined, posts, scope, selectedCommunity]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const toggleLike = (id: string) => setLiked((current) => ({ ...current, [id]: !current[id] }));

  const publishPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = composeText.trim();
    if (!text) return;
    setPosts((current) => [{
      id: `preview-${Date.now()}`,
      author: "You",
      initials: "Y",
      time: "Just now",
      community: selectedCommunity ? communities.find((community) => community.id === selectedCommunity)?.name ?? "Your community" : "Your community",
      text,
      likes: 0,
      replies: 0,
    }, ...current]);
    setComposeText("");
    setComposeOpen(false);
    setScope("all");
    setSelectedCommunity("");
    notify("Added to this local preview.");
  };

  const openChat = (name: string) => {
    setChatName(name);
    setChatReplies([]);
    setChatMessage("");
  };

  const sendChat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chatMessage.trim()) return;
    setChatReplies((current) => [...current, chatMessage.trim()]);
    setChatMessage("");
  };

  const selectCommunity = (id: string) => {
    setSelectedCommunity((current) => current === id ? "" : id);
    setActiveMobileTab("community");
  };

  return (
    <main className="community-ecosystem" aria-label="Oldtime Community">
      <div className="ce-shell">
        <header className="ce-header">
          <div className="ce-brand">
            <span className="ce-brand-mark"><Icon name="community" /></span>
            <div>
              <p className="ce-brand-name">Oldtime <span>Community</span></p>
              <p className="ce-brand-sub">Your people, all in one place</p>
            </div>
          </div>
          <div className="ce-header-tools">
            <button type="button" className="ce-icon-btn" aria-label="Search community" onClick={() => notify("Search is not connected in this preview.")}><Icon name="search" /></button>
            <button type="button" className="ce-icon-btn" aria-label="Open private chats" onClick={() => { setActiveMobileTab("chats"); setChatName("Chats"); }}><Icon name="chat" /></button>
            <Avatar initial="Y" className="ce-header-avatar" />
          </div>
        </header>

        <div className="ce-layout">
          <aside className="ce-sidebar" aria-label="Community navigation">
            <p className="ce-sidebar-heading">Your space</p>
            <nav className="ce-nav">
              <button type="button" className="is-active" onClick={() => { setSelectedCommunity(""); setScope("all"); }}><Icon name="community" /> Community <span className="ce-count">12</span></button>
              <button type="button" onClick={() => { setScope("joined"); setSelectedCommunity(""); }}><Icon name="home" /> Joined updates</button>
              <button type="button" onClick={() => { setActiveMobileTab("chats"); setChatName("Chats"); }}><Icon name="chat" /> Private chats <span className="ce-count">2</span></button>
            </nav>

            <div className="ce-community-list">
              <p className="ce-sidebar-heading">Your communities</p>
              {communities.map((community) => (
                <button type="button" key={community.id} className={`ce-community-link${selectedCommunity === community.id ? " is-selected" : ""}`} onClick={() => selectCommunity(community.id)}>
                  <span className="ce-community-glyph"><Icon name={community.icon} /></span>{community.name}
                </button>
              ))}
            </div>
            <div className="ce-sidebar-note">
              <b><Icon name="lock" /> A note on privacy</b>
              Community posts are visible to members. Private chats stay on this device.
            </div>
          </aside>

          <section className="ce-main" aria-label="Community feed">
            <div className="ce-main-head">
              <div>
                <span className="ce-eyebrow">A place to keep up</span>
                <h1 className="ce-title">Community</h1>
                <p className="ce-head-caption">Conversations, shared moments, and the people around you.</p>
              </div>
              <button className="ce-icon-btn" type="button" aria-label="Create a post" onClick={() => setComposeOpen(true)}><Icon name="plus" /></button>
            </div>

            <div className="ce-compose-mini">
              <Avatar initial="Y" />
              <button type="button" className="ce-compose-trigger" onClick={() => setComposeOpen(true)}>Share something with your community…</button>
              <button type="button" className="ce-capture-btn" onClick={() => notify("Moment capture is not connected in this preview.")}><Icon name="camera" /> Add a moment</button>
            </div>

            <section className="ce-moments" aria-label="Recent stories">
              <button type="button" className="ce-moment ce-moment--own" onClick={() => setComposeOpen(true)}>
                <span className="ce-moment-face"><Icon name="plus" /></span><span>Your story</span>
              </button>
              {stories.map((story, index) => (
                <button type="button" className="ce-moment" key={story.name} onClick={() => setStoryIndex(index)}>
                  <span className="ce-moment-face">{story.initial}</span><span>{story.name}</span>
                </button>
              ))}
            </section>

            <div className="ce-stream-tools">
              <span className="ce-stream-label">{selectedCommunity ? communities.find((item) => item.id === selectedCommunity)?.name : "A little of everything"}</span>
              <div className="ce-scope-switch" role="group" aria-label="Feed scope">
                <button type="button" className={scope === "all" ? "is-active" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}>For you</button>
                <button type="button" className={scope === "joined" ? "is-active" : ""} aria-pressed={scope === "joined"} onClick={() => { setScope("joined"); setSelectedCommunity(""); }}>Joined</button>
              </div>
            </div>

            <div className="ce-feed">
              {shownPosts.length ? shownPosts.map((post) => (
                <article className="ce-post" key={post.id}>
                  <div className="ce-post-head">
                    <Avatar initial={post.initials} />
                    <div className="ce-person"><strong>{post.author}</strong><small>{post.time} · shared with members</small></div>
                    <span className="ce-source"><Icon name="community" />{post.community}</span>
                  </div>
                  <p className="ce-post-copy">{post.text}</p>
                  {post.image && (
                    <button type="button" className={`ce-media ce-media--${post.image}`} aria-label={`Open photo: ${post.mediaLabel}`} onClick={() => notify("Photo preview")}>
                      <span className="ce-media-art" />
                      <span className="ce-media-title">{post.mediaLabel}</span>
                      {post.image === "lake" && <span className="ce-media-play"><Icon name="play" /></span>}
                    </button>
                  )}
                  <div className="ce-actions">
                    <button type="button" className={`ce-action${liked[post.id] ? " is-liked" : ""}`} onClick={() => toggleLike(post.id)} aria-pressed={!!liked[post.id]} aria-label={liked[post.id] ? "Remove like" : "Like post"}><Icon name="heart" />{post.likes + (liked[post.id] ? 1 : 0)}</button>
                    <button type="button" className="ce-action" onClick={() => notify(`Replies on ${post.author}’s post`)}><Icon name="reply" />{post.replies} replies</button>
                    <button type="button" className="ce-action" onClick={() => openChat(post.author)}><Icon name="chat" />Message</button>
                  </div>
                </article>
              )) : (
                <div className="ce-empty">Join a community to see member updates here.</div>
              )}
            </div>
          </section>

          <aside className="ce-rail" aria-label="Community details and chats">
            <p className="ce-rail-heading">Your circles</p>
            <section className="ce-community-brief">
              <div className="ce-brief-title"><b>Joined communities</b><button type="button" onClick={() => notify("Community directory is not connected in this preview.")}>Explore</button></div>
              {communities.map((community) => (
                <button type="button" className="ce-brief-row" key={community.id} onClick={() => selectCommunity(community.id)}>
                  <span className="ce-community-glyph"><Icon name={community.icon} /></span>
                  <span className="ce-brief-copy"><b>{community.name}</b><small>{community.posts}</small></span>
                  <span className="ce-brief-count"><Icon name="chevron" size={13} /></span>
                </button>
              ))}
            </section>
            <section className="ce-chat-card">
              <div className="ce-chat-heading"><h2>Private chats</h2><button type="button" aria-label="Open chats" onClick={() => { setActiveMobileTab("chats"); setChatName("Chats"); }}><Icon name="plus" /></button></div>
              {[["J","June Park","Sent the photos from Saturday","9:14"],["T","Theo Brooks","That path looks lovely","Yesterday"],["M","Maya Chen","Thanks for sharing the seeds","Mon"]].map(([initial, name, preview, time]) => (
                <button type="button" className="ce-chat-row" key={name} onClick={() => openChat(name)}>
                  <Avatar initial={initial} />
                  <span className="ce-chat-copy"><b>{name}</b><small>{preview}</small></span><span className="ce-chat-time">{time}</span>
                </button>
              ))}
              <p className="ce-chat-privacy"><Icon name="lock" /> Private chats are stored on this device and don’t sync to other devices.</p>
            </section>
            <div className="ce-join-cta">
              <div><b>{joined ? "Your circles, together" : "Join the conversation"}</b><small>{joined ? "Updates from places you care about." : "Membership brings community updates into your feed."}</small></div>
              <button type="button" onClick={() => { setJoined((current) => !current); notify(joined ? "Joined updates hidden in this preview." : "Joined updates shown in this preview."); }}>{joined ? "Joined" : "Join"}</button>
            </div>
          </aside>
        </div>
      </div>

      <nav className="ce-mobile-nav" aria-label="Community and chats">
        <button type="button" className={activeMobileTab === "community" ? "is-active" : ""} onClick={() => { setActiveMobileTab("community"); setChatName(""); }}><Icon name="community" />Community</button>
        <button type="button" className={activeMobileTab === "chats" ? "is-active" : ""} onClick={() => { setActiveMobileTab("chats"); setChatName("Chats"); }}><Icon name="chat" />Chats</button>
      </nav>

      {composeOpen && (
        <div className="ce-overlay" role="presentation" onClick={() => setComposeOpen(false)}>
          <section className="ce-modal ce-compose-modal" role="dialog" aria-modal="true" aria-labelledby="ce-compose-title" onClick={(event) => event.stopPropagation()}>
            <div className="ce-modal-head"><h2 id="ce-compose-title">Share with your community</h2><button type="button" className="ce-modal-close" aria-label="Close" onClick={() => setComposeOpen(false)}><Icon name="close" /></button></div>
            <form onSubmit={publishPost}>
              <textarea autoFocus maxLength={500} value={composeText} onChange={(event) => setComposeText(event.target.value)} placeholder="What would you like to share?" aria-label="Post text" />
              <div className="ce-compose-footer"><span className="ce-audience-note"><Icon name="lock" size={12} /> Visible to community members</span><button className="ce-publish" type="submit" disabled={!composeText.trim()}>Share</button></div>
            </form>
          </section>
        </div>
      )}

      {storyIndex !== null && (
        <div className="ce-overlay" role="presentation" onClick={() => setStoryIndex(null)}>
          <section className="ce-modal" role="dialog" aria-modal="true" aria-label={`${stories[storyIndex].name} story`} onClick={(event) => event.stopPropagation()}>
            <div className="ce-modal-head"><h2>{stories[storyIndex].name} · Story</h2><button type="button" className="ce-modal-close" aria-label="Close story" onClick={() => setStoryIndex(null)}><Icon name="close" /></button></div>
            <div className="ce-story-frame"><div className="ce-story-copy"><b>{stories[storyIndex].line}</b><small>Shared with community members · today</small></div></div>
          </section>
        </div>
      )}

      {chatName && (
        <div className="ce-overlay" role="presentation" onClick={() => setChatName("")}>
          <section className="ce-modal" role="dialog" aria-modal="true" aria-label={`Private chat ${chatName}`} onClick={(event) => event.stopPropagation()}>
            <div className="ce-modal-head"><h2>{chatName}</h2><button type="button" className="ce-modal-close" aria-label="Close chat" onClick={() => setChatName("")}><Icon name="close" /></button></div>
            {chatName === "Chats" ? (
              <>
                {["June Park", "Theo Brooks", "Maya Chen"].map((name, index) => (
                  <button type="button" className="ce-chat-row" key={name} onClick={() => openChat(name)}>
                    <Avatar initial={name[0]} />
                    <span className="ce-chat-copy"><b>{name}</b><small>{["Sent the photos from Saturday", "That path looks lovely", "Thanks for sharing the seeds"][index]}</small></span>
                    <Icon name="chevron" size={14} />
                  </button>
                ))}
                <p className="ce-thread-note"><Icon name="lock" size={12} /> Private chats stay on this device and don’t sync to other devices.</p>
              </>
            ) : (
              <>
                <div className="ce-chat-thread">
                  <div className="ce-bubble">I saw your update in the community. Thanks for sharing it here.</div>
                  <div className="ce-bubble is-mine">Glad it was useful. See you soon.</div>
                  {chatReplies.map((reply, index) => <div className="ce-bubble is-mine" key={`${reply}-${index}`}>{reply}</div>)}
                </div>
                <p className="ce-thread-note"><Icon name="lock" size={12} /> Private chat preview. Messages stay on this device.</p>
                <form className="ce-chat-compose" onSubmit={sendChat}>
                  <input value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Write a private message" aria-label="Write a private message" maxLength={500} />
                  <button type="submit" aria-label="Send preview message"><Icon name="send" /></button>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      {toast && <div className="ce-toast" role="status" aria-live="polite">{toast}</div>}
    </main>
  );
}

export default Ecosystem;
