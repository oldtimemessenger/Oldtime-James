import { useRef, useState, type FormEvent } from "react";

type IconName =
  | "home" | "heart" | "comment" | "repost" | "bookmark" | "search"
  | "bell" | "user" | "users" | "camera" | "menu" | "close" | "share"
  | "pin" | "send" | "settings" | "check" | "plus";

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
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  share: '<path d="M4 12c0-5 3.6-8 9-8h2V1l7 7-7 7v-3h-2c-3.7 0-6.6 1.4-9 4z"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  send: '<path d="m5 12 14-7-5 14-3-6z"/><path d="m11 13 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 1 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 1 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 1 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 1 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

function Icon({ name, filled = false, className = "" }: { name: IconName; filled?: boolean; className?: string }) {
  return (
    <svg
      className={`ot-suno-icon ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={name === "repost" ? 2.7 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: iconPaths[name] }}
    />
  );
}

type Post = {
  id: string;
  name: string;
  username: string;
  initials: string;
  image: string;
  caption: string;
  location: string;
  likes: number;
  comments: number;
  reposts: number;
  views: string;
  time: string;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  following: boolean;
};

const initialPosts: Post[] = [
  {
    id: "p2",
    name: "June Park",
    username: "@june",
    initials: "JP",
    image: "/__mockup/images/oldtime-fire-escape.jpg",
    caption: "Golden hour on the fire escape.",
    location: "Los Angeles",
    likes: 2,
    comments: 0,
    reposts: 0,
    views: "4.2k",
    time: "2h",
    liked: true,
    saved: false,
    reposted: false,
    following: true,
  },
  {
    id: "p3",
    name: "Kev May",
    username: "@kevmay",
    initials: "KM",
    image: "/__mockup/images/oldtime-coast-road.jpg",
    caption: "Coast road, three frames.",
    location: "Miami",
    likes: 36,
    comments: 4,
    reposts: 2,
    views: "2.1k",
    time: "5h",
    liked: false,
    saved: false,
    reposted: false,
    following: false,
  },
  {
    id: "p6",
    name: "June Park",
    username: "@june",
    initials: "JP",
    image: "/__mockup/images/oldtime-late-noodles.jpg",
    caption: "Late noodles, no filter.",
    location: "Los Angeles",
    likes: 18,
    comments: 3,
    reposts: 1,
    views: "1.5k",
    time: "8h",
    liked: false,
    saved: false,
    reposted: false,
    following: true,
  },
];

const topics = [
  "For You", "Interests", "Around the World", "Culture", "Comedy", "Fashion",
  "Food", "Travel", "Music", "Beauty", "Sports", "Art & Design", "Pets",
  "Gaming", "Learning",
];
const views = ["Following", "Explore", "Nearby"];
const storyPeople = [
  { name: "You", initials: "Y", seen: true, image: "/__mockup/images/oldtime-coast-road.jpg" },
  { name: "Nova", initials: "N", seen: false, image: "/__mockup/images/oldtime-late-noodles.jpg" },
  { name: "Kev", initials: "K", seen: false, image: "/__mockup/images/oldtime-coast-road.jpg" },
  { name: "Mara", initials: "M", seen: false, image: "/__mockup/images/oldtime-fire-escape.jpg" },
];
const nearbyAreas = ["Los Angeles", "Miami"];
type Overlay = "drawer" | "story" | "search" | "create" | "quote" | "notifications" | "comments" | null;

export function SunoInspired() {
  const [activeView, setActiveView] = useState("Explore");
  const [activeTopic, setActiveTopic] = useState("For You");
  const [activeNav, setActiveNav] = useState("Home");
  const [posts, setPosts] = useState(initialPosts);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [activePostId, setActivePostId] = useState("p2");
  const [activeStory, setActiveStory] = useState(storyPeople[1]);
  const [followed, setFollowed] = useState<string[]>(["@june"]);
  const [nearbyArea, setNearbyArea] = useState("all");
  const [locationUsed, setLocationUsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [composerText, setComposerText] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentsByPost, setCommentsByPost] = useState<Record<string, string[]>>({});
  const [toast, setToast] = useState("");
  const [storyIndex, setStoryIndex] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const toastTimeout = useRef<number | undefined>(undefined);

  const announce = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimeout.current);
    toastTimeout.current = window.setTimeout(() => setToast(""), 2200);
  };

  const patchPost = (id: string, patch: Partial<Post>) => {
    setPosts((current) => current.map((post) => post.id === id ? { ...post, ...patch } : post));
  };

  const currentPost = posts.find((post) => post.id === activePostId) ?? posts[0];
  const visiblePosts = posts.filter((post) => {
    if (activeView === "Following" && !post.following) return false;
    if (activeView === "Nearby" && nearbyArea !== "all" && post.location !== nearbyArea) return false;
    return true;
  });

  const openComments = (post: Post) => {
    setActivePostId(post.id);
    setOverlay("comments");
  };

  const addComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = commentDraft.trim();
    if (!value) return;
    setCommentsByPost((current) => ({ ...current, [activePostId]: [...(current[activePostId] ?? []), value] }));
    patchPost(activePostId, { comments: currentPost.comments + 1 });
    setCommentDraft("");
    announce("Comment added");
  };

  const sharePost = async (post: Post) => {
    const shareUrl = `${window.location.href.split("#")[0]}#${post.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      announce("Post link copied");
    } catch {
      announce(`Ready to share ${post.name}’s post`);
    }
  };

  const publishPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const caption = composerText.trim();
    if (!caption) return;
    const newPost: Post = {
      id: `post-${Date.now()}`,
      name: "You",
      username: "@you",
      initials: "Y",
      image: "/__mockup/images/oldtime-fire-escape.jpg",
      caption,
      location: "Los Angeles",
      likes: 0,
      comments: 0,
      reposts: 0,
      views: "1",
      time: "now",
      liked: false,
      saved: false,
      reposted: false,
      following: true,
    };
    setPosts((current) => [newPost, ...current]);
    setComposerText("");
    setOverlay(null);
    setActiveNav("Home");
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    announce("Your post is live");
  };

  const chooseNav = (label: string) => {
    setActiveNav(label);
    if (label === "Home") {
      setOverlay(null);
    } else if (label === "Search") {
      setOverlay("search");
    } else {
      announce(`${label} opens from Old Time navigation`);
    }
  };

  const chooseDrawerItem = (label: string) => {
    setOverlay(null);
    if (label === "Home") {
      setActiveNav("Home");
      return;
    }
    if (label === "Search") {
      setActiveNav("Search");
      setOverlay("search");
      return;
    }
    if (label === "Notifications") {
      setOverlay("notifications");
      return;
    }
    if (label === "Create a post") {
      setComposerText("");
      setOverlay("create");
      return;
    }
    if (label === "Write a quote") {
      setComposerText("");
      setOverlay("quote");
      return;
    }
    announce(`${label} remains in the Old Time app`);
  };

  const searchedPosts = posts.filter((post) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || `${post.name} ${post.username} ${post.caption} ${post.location}`.toLowerCase().includes(query);
  });

  return (
    <div className="ot-suno">
      <style>{`
        .ot-suno {
          --ot-bg: #111114;
          --ot-panel: #1b1b1f;
          --ot-panel-raised: #232327;
          --ot-line: rgba(245,241,232,.12);
          --ot-ink: #f2efe8;
          --ot-muted: #a7a49d;
          --ot-dim: #77766f;
          --ot-gold: #d6ad68;
          width: 100%;
          height: 100dvh;
          min-height: 660px;
          display: flex;
          justify-content: center;
          overflow: hidden;
          color: var(--ot-ink);
          background: #0b0b0d;
          font-family: "Manrope", "Avenir Next", system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .ot-suno *, .ot-suno *::before, .ot-suno *::after { box-sizing: border-box; }
        .ot-suno button, .ot-suno input, .ot-suno textarea { font: inherit; color: inherit; }
        .ot-suno button { padding: 0; border: 0; cursor: pointer; background: none; }
        .ot-suno button:focus-visible, .ot-suno input:focus-visible, .ot-suno textarea:focus-visible {
          outline: 2px solid rgba(242,239,232,.82); outline-offset: 3px;
        }
        .ot-suno-icon { display: block; width: 20px; height: 20px; flex: 0 0 auto; }
        .ot-phone { position: relative; width: min(100%, 430px); height: 100dvh; min-height: 660px; overflow: hidden; background: var(--ot-bg); isolation: isolate; }
        .ot-feed { position: absolute; inset: 0; z-index: 0; overflow-y: auto; scroll-snap-type: y mandatory; scrollbar-width: none; }
        .ot-feed::-webkit-scrollbar, .ot-topic-list::-webkit-scrollbar, .ot-stories::-webkit-scrollbar, .ot-area-list::-webkit-scrollbar { display: none; }
        .ot-post { position: relative; min-height: 100%; height: 100%; overflow: hidden; scroll-snap-align: start; background: #252421; }
        .ot-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .ot-photo-shade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg,rgba(13,13,15,.84) 0%,rgba(13,13,15,.32) 19%,transparent 38%,rgba(13,13,15,.16) 55%,rgba(13,13,15,.9) 100%); }
        .ot-header { position: absolute; z-index: 5; top: 0; left: 0; right: 0; padding: max(12px,env(safe-area-inset-top)) 14px 0; background: linear-gradient(180deg,rgba(17,17,20,.99),rgba(17,17,20,.91) 75%,rgba(17,17,20,0)); }
        .ot-brand-row { display: flex; align-items: center; justify-content: space-between; min-height: 32px; }
        .ot-brand { display: flex; align-items: center; gap: 9px; color: var(--ot-ink); }
        .ot-menu-button { display: grid; place-items: center; width: 32px; height: 32px; color: var(--ot-ink); border-radius: 50%; background: rgba(255,255,255,.065) !important; }
        .ot-menu-button .ot-suno-icon { width: 18px; height: 18px; }
        .ot-wordmark { font-size: 11px; letter-spacing: .2em; font-weight: 850; }
        .ot-header-actions { display: flex; align-items: center; gap: 6px; }
        .ot-tool { position: relative; display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid rgba(255,255,255,.065) !important; border-radius: 50%; color: var(--ot-ink); background: rgba(255,255,255,.06) !important; transition: transform .18s ease, background .18s ease; }
        .ot-tool:active, .ot-story:active, .ot-nav-button:active, .ot-rail-button:active { transform: scale(.92); }
        .ot-tool .ot-suno-icon { width: 16px; height: 16px; }
        .ot-badge { position: absolute; top: 5px; right: 5px; width: 7px; height: 7px; border: 1px solid var(--ot-bg); border-radius: 50%; background: var(--ot-gold); }
        .ot-view-row { display: flex; justify-content: center; padding-top: 7px; }
        .ot-view-tabs { display: flex; gap: 3px; padding: 3px; border: 1px solid rgba(255,255,255,.055); border-radius: 999px; background: rgba(255,255,255,.075); }
        .ot-view-tab { min-width: 72px; padding: 8px 10px !important; border-radius: 999px; color: rgba(242,239,232,.62) !important; font-size: 11px !important; font-weight: 750 !important; white-space: nowrap; transition: color .2s ease, background .2s ease, transform .2s ease; }
        .ot-view-tab[aria-selected="true"] { color: #1d1d20 !important; background: var(--ot-ink) !important; }
        .ot-topic-list { display: flex; gap: 20px; overflow-x: auto; padding: 14px 2px 10px; white-space: nowrap; scrollbar-width: none; }
        .ot-topic { position: relative; flex: 0 0 auto; padding: 0 0 7px !important; color: rgba(242,239,232,.61) !important; font-size: 11px !important; font-weight: 680 !important; }
        .ot-topic[aria-selected="true"] { color: var(--ot-ink) !important; }
        .ot-topic[aria-selected="true"]::after { content: ""; position: absolute; left: 0; bottom: 0; width: 17px; height: 2px; border-radius: 4px; background: var(--ot-ink); }
        .ot-nearby { padding: 7px 0 0; animation: ot-in .2s ease both; }
        .ot-location-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0 7px; border-top: 1px solid rgba(255,255,255,.09); }
        .ot-location-label { display: flex; align-items: center; gap: 7px; color: var(--ot-ink); font-size: 12px; font-weight: 750; }
        .ot-location-label .ot-suno-icon { width: 15px; height: 15px; color: var(--ot-muted); }
        .ot-locate-button { padding: 7px 10px !important; border: 1px solid rgba(255,255,255,.17) !important; border-radius: 999px; color: var(--ot-ink) !important; font-size: 10px !important; font-weight: 750 !important; white-space: nowrap; }
        .ot-area-list { display: flex; gap: 7px; overflow-x: auto; padding: 4px 0 5px; scrollbar-width: none; }
        .ot-area-chip { flex: 0 0 auto; padding: 7px 10px !important; border: 1px solid rgba(255,255,255,.12) !important; border-radius: 999px; color: rgba(242,239,232,.7) !important; font-size: 10px !important; font-weight: 700 !important; }
        .ot-area-chip[aria-pressed="true"] { color: var(--ot-ink) !important; border-color: rgba(242,239,232,.72) !important; background: rgba(255,255,255,.1) !important; }
        .ot-privacy { display: block; padding: 2px 0 8px; color: rgba(242,239,232,.56); font-size: 9px; }
        .ot-stories { position: absolute; z-index: 4; top: calc(max(12px,env(safe-area-inset-top)) + 137px); left: 0; right: 0; display: flex; gap: 13px; overflow-x: auto; padding: 3px 15px 8px; scrollbar-width: none; }
        .ot-stories.nearby-on { top: calc(max(12px,env(safe-area-inset-top)) + 224px); }
        .ot-story { display: grid; flex: 0 0 51px; justify-items: center; gap: 4px; color: rgba(242,239,232,.83); font-size: 9px; font-weight: 650; }
        .ot-story-ring { position: relative; display: grid; place-items: center; width: 47px; height: 47px; padding: 2px; border-radius: 50%; background: conic-gradient(from 210deg,var(--ot-gold),#f0d59a,var(--ot-gold)); }
        .ot-story-ring.seen { background: rgba(242,239,232,.23); }
        .ot-story-inner { display: grid; place-items: center; width: 100%; height: 100%; border: 2px solid var(--ot-bg); border-radius: 50%; overflow: hidden; background: #29292b; }
        .ot-story-inner img { width: 100%; height: 100%; object-fit: cover; }
        .ot-story-initial { position: absolute; width: 39px; height: 39px; display: grid; place-items: center; border-radius: 50%; color: #f2efe8; background: rgba(22,22,24,.6); font-size: 11px; font-weight: 800; }
        .ot-post-topline { position: absolute; z-index: 2; top: calc(max(12px,env(safe-area-inset-top)) + 207px); left: 16px; right: 16px; display: flex; align-items: center; justify-content: space-between; pointer-events: none; }
        .ot-post-place { display: inline-flex; align-items: center; gap: 6px; padding: 6px 9px; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; color: rgba(242,239,232,.9); background: rgba(17,17,20,.28); backdrop-filter: blur(12px); font-size: 10px; font-weight: 700; }
        .ot-post-place .ot-suno-icon { width: 13px; height: 13px; }
        .ot-post-time { color: rgba(242,239,232,.76); font-size: 10px; font-weight: 700; text-shadow: 0 1px 8px rgba(0,0,0,.6); }
        .ot-rail { position: absolute; z-index: 3; right: 13px; bottom: calc(179px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .ot-rail-button { display: grid; justify-items: center; gap: 4px; color: var(--ot-ink); font-size: 10px; font-weight: 750; text-shadow: 0 1px 7px rgba(0,0,0,.55); transition: transform .18s ease, color .18s ease; }
        .ot-rail-button .ot-suno-icon { width: 25px; height: 25px; filter: drop-shadow(0 1px 3px rgba(0,0,0,.3)); }
        .ot-rail-button.liked { color: #f4f0e7; }
        .ot-rail-button.reposted { color: #f4f0e7; }
        .ot-meta { position: absolute; z-index: 3; left: 17px; right: 71px; bottom: calc(135px + env(safe-area-inset-bottom)); }
        .ot-author-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .ot-avatar { display: grid; flex: 0 0 auto; place-items: center; width: 30px; height: 30px; border: 1px solid rgba(242,239,232,.72); border-radius: 50%; color: var(--ot-ink); background: rgba(26,26,29,.72); font-size: 9px; font-weight: 850; }
        .ot-author { overflow: hidden; color: var(--ot-ink); font-size: 13px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 9px rgba(0,0,0,.45); }
        .ot-follow { padding: 5px 10px !important; border: 1px solid rgba(242,239,232,.72) !important; border-radius: 99px; color: var(--ot-ink) !important; background: rgba(18,18,20,.2) !important; font-size: 9px !important; font-weight: 800 !important; }
        .ot-caption { max-width: 300px; margin-top: 8px; color: var(--ot-ink); font-size: 15px; line-height: 1.34; font-weight: 650; letter-spacing: -.025em; text-shadow: 0 1px 11px rgba(0,0,0,.55); }
        .ot-location { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: rgba(242,239,232,.75); font-size: 10px; font-weight: 650; text-shadow: 0 1px 8px rgba(0,0,0,.55); }
        .ot-action-shelf { position: absolute; z-index: 4; left: 13px; right: 13px; bottom: calc(78px + env(safe-area-inset-bottom)); min-height: 47px; display: grid; grid-template-columns: minmax(0,1fr) auto auto auto; align-items: center; gap: 7px; padding: 6px 7px 6px 11px; border: 1px solid rgba(242,239,232,.12); border-radius: 14px; background: rgba(26,26,29,.78); backdrop-filter: blur(17px); }
        .ot-view-count { min-width: 0; color: rgba(242,239,232,.68); font-size: 10px; font-weight: 700; line-height: 1.2; }
        .ot-view-count strong { display: block; overflow: hidden; color: var(--ot-ink); font-size: 10px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
        .ot-view-count small { display: block; margin-top: 3px; color: rgba(242,239,232,.62); font-size: 9px; }
        .ot-shelf-action { display: grid; place-items: center; min-width: 34px; height: 33px; padding: 0 8px !important; border-radius: 10px; color: rgba(242,239,232,.87) !important; background: rgba(255,255,255,.075) !important; transition: transform .18s ease, background .18s ease; }
        .ot-shelf-action .ot-suno-icon { width: 17px; height: 17px; }
        .ot-shelf-action.saved { color: var(--ot-ink) !important; background: rgba(255,255,255,.16) !important; }
        .ot-shelf-action.reposted { color: var(--ot-ink) !important; }
        .ot-nav { position: absolute; z-index: 5; left: 0; right: 0; bottom: 0; height: calc(68px + env(safe-area-inset-bottom)); display: grid; grid-template-columns: repeat(5,1fr); align-items: center; padding: 6px 8px max(8px,env(safe-area-inset-bottom)); background: linear-gradient(180deg,rgba(17,17,20,0),rgba(17,17,20,.95) 34%); }
        .ot-nav-button { display: grid; justify-items: center; align-content: center; gap: 4px; height: 47px; color: rgba(242,239,232,.54); font-size: 9px; font-weight: 680; transition: transform .18s ease,color .18s ease; }
        .ot-nav-button .ot-suno-icon { width: 20px; height: 20px; }
        .ot-nav-button.active { color: var(--ot-ink); }
        .ot-nav-button span { white-space: nowrap; font-size: 8px; letter-spacing: -.02em; }
        .ot-empty { position: absolute; inset: 0; display: grid; place-content: center; gap: 10px; padding: 40px; text-align: center; background: rgba(17,17,20,.62); }
        .ot-empty-mark { width: 46px; height: 46px; display: grid; place-items: center; margin: 0 auto; border: 1px solid rgba(242,239,232,.18); border-radius: 50%; color: var(--ot-ink); font-size: 24px; }
        .ot-empty strong { font-family: Fraunces, Georgia, serif; font-size: 21px; font-weight: 600; }
        .ot-empty p { color: rgba(242,239,232,.7); font-size: 12px; line-height: 1.55; }
        .ot-empty button { justify-self: center; padding: 10px 14px !important; border: 1px solid rgba(242,239,232,.3) !important; border-radius: 999px; font-size: 11px !important; font-weight: 800 !important; }
        .ot-overlay { position: absolute; z-index: 10; inset: 0; display: flex; align-items: flex-end; justify-content: center; padding: 12px; background: rgba(8,8,10,.66); backdrop-filter: blur(9px); animation: ot-fade .18s ease both; }
        .ot-sheet { width: 100%; max-height: min(78dvh,650px); overflow: auto; padding: 19px 17px max(20px,env(safe-area-inset-bottom)); border: 1px solid rgba(242,239,232,.13); border-radius: 22px 22px 15px 15px; background: #202024; box-shadow: 0 20px 60px rgba(0,0,0,.35); animation: ot-rise .22s cubic-bezier(.2,.8,.2,1) both; }
        .ot-sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 15px; }
        .ot-sheet-head h2 { color: var(--ot-ink); font-family: Fraunces, Georgia, serif; font-size: 23px; font-weight: 600; letter-spacing: -.035em; }
        .ot-close { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; color: var(--ot-ink) !important; background: rgba(255,255,255,.09) !important; }
        .ot-close .ot-suno-icon { width: 17px; height: 17px; }
        .ot-searchbox { display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 12px; border: 1px solid rgba(242,239,232,.14); border-radius: 13px; background: rgba(255,255,255,.045); }
        .ot-searchbox .ot-suno-icon { width: 18px; height: 18px; color: var(--ot-muted); }
        .ot-searchbox input { width: 100%; min-width: 0; border: 0; outline: 0; color: var(--ot-ink); background: transparent; font-size: 13px; }
        .ot-result { display: flex; align-items: center; gap: 11px; width: 100%; padding: 12px 1px !important; border-bottom: 1px solid rgba(242,239,232,.08) !important; text-align: left; }
        .ot-result:last-child { border-bottom: 0 !important; }
        .ot-result-image { width: 45px; height: 45px; flex: 0 0 auto; border-radius: 10px; object-fit: cover; }
        .ot-result strong { display: block; color: var(--ot-ink); font-size: 12px; }
        .ot-result small { display: block; margin-top: 4px; color: var(--ot-muted); font-size: 10px; }
        .ot-sheet-note { padding: 5px 0 8px; color: rgba(242,239,232,.65); font-size: 12px; line-height: 1.55; }
        .ot-field { width: 100%; min-height: 108px; resize: vertical; padding: 12px; border: 1px solid rgba(242,239,232,.14); border-radius: 13px; outline: none; color: var(--ot-ink); background: rgba(255,255,255,.045); font-size: 13px; }
        .ot-field::placeholder, .ot-comment-input::placeholder { color: rgba(242,239,232,.4); }
        .ot-publish { width: 100%; min-height: 43px; margin-top: 12px; border-radius: 12px !important; color: #1e1e20 !important; background: var(--ot-ink) !important; font-size: 12px !important; font-weight: 850 !important; }
        .ot-publish:disabled { opacity: .42; cursor: not-allowed; }
        .ot-comment-list { display: grid; gap: 13px; max-height: 31dvh; overflow-y: auto; }
        .ot-comment { display: flex; align-items: flex-start; gap: 10px; color: rgba(242,239,232,.88); font-size: 12px; line-height: 1.5; }
        .ot-comment .ot-avatar { width: 28px; height: 28px; }
        .ot-comment strong { display: block; margin-bottom: 2px; color: var(--ot-ink); font-size: 10px; }
        .ot-comment-empty { padding: 10px 0 16px; color: rgba(242,239,232,.6); font-size: 12px; }
        .ot-comment-form { display: flex; gap: 8px; margin-top: 15px; }
        .ot-comment-input { flex: 1; min-width: 0; padding: 11px; border: 1px solid rgba(242,239,232,.13); border-radius: 12px; outline: 0; color: var(--ot-ink); background: rgba(255,255,255,.055); font-size: 12px; }
        .ot-send { display: grid; place-items: center; width: 42px; border-radius: 12px !important; color: #202024 !important; background: var(--ot-ink) !important; }
        .ot-send .ot-suno-icon { width: 18px; height: 18px; }
        .ot-drawer-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .ot-drawer-profile { display: flex; align-items: center; gap: 10px; text-align: left; }
        .ot-drawer-profile .ot-avatar { width: 42px; height: 42px; }
        .ot-drawer-profile strong { display: block; font-size: 12px; }
        .ot-drawer-profile small { display: block; margin-top: 3px; color: var(--ot-muted); font-size: 10px; }
        .ot-drawer-label { margin: 15px 0 6px; color: var(--ot-dim); font-size: 9px; font-weight: 850; letter-spacing: .16em; text-transform: uppercase; }
        .ot-drawer-link { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 41px; text-align: left; color: rgba(242,239,232,.9) !important; font-size: 12px !important; font-weight: 700 !important; }
        .ot-drawer-link .ot-suno-icon { width: 17px; height: 17px; color: rgba(242,239,232,.72); }
        .ot-drawer-separator { height: 1px; margin: 8px 0; background: rgba(242,239,232,.1); }
        .ot-story-view { position: absolute; z-index: 11; inset: 0; overflow: hidden; background: #1b1b1d; animation: ot-fade .18s ease both; }
        .ot-story-photo { width: 100%; height: 100%; object-fit: cover; }
        .ot-story-view::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg,rgba(10,10,12,.6),transparent 32%,rgba(10,10,12,.4)); }
        .ot-story-progress { position: absolute; z-index: 1; top: max(17px,env(safe-area-inset-top)); left: 15px; right: 15px; height: 3px; border-radius: 6px; background: rgba(255,255,255,.32); }
        .ot-story-progress span { display: block; width: 43%; height: 100%; border-radius: inherit; background: var(--ot-gold); }
        .ot-story-user { position: absolute; z-index: 1; top: calc(max(17px,env(safe-area-inset-top)) + 15px); left: 17px; display: flex; align-items: center; gap: 9px; color: var(--ot-ink); font-size: 12px; font-weight: 800; }
        .ot-story-user .ot-avatar { width: 31px; height: 31px; }
        .ot-story-copy { position: absolute; z-index: 1; left: 20px; right: 20px; bottom: 44px; color: var(--ot-ink); font-family: Fraunces, Georgia, serif; font-size: 32px; line-height: 1.12; letter-spacing: -.035em; text-shadow: 0 2px 14px rgba(0,0,0,.45); }
        .ot-story-close { position: absolute; z-index: 2; top: calc(max(45px,env(safe-area-inset-top) + 35px)); right: 15px; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50% !important; color: var(--ot-ink) !important; background: rgba(15,15,18,.38) !important; }
        .ot-toast { position: absolute; z-index: 14; left: 50%; bottom: calc(78px + env(safe-area-inset-bottom)); transform: translateX(-50%); max-width: calc(100% - 32px); padding: 10px 15px; border: 1px solid rgba(242,239,232,.15); border-radius: 99px; color: var(--ot-ink); background: rgba(35,35,39,.95); box-shadow: 0 5px 22px rgba(0,0,0,.28); font-size: 11px; font-weight: 750; white-space: nowrap; animation: ot-fade .16s ease both; }
        @keyframes ot-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ot-rise { from { opacity: .5; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ot-in { from { opacity: .5; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 370px) {
          .ot-header { padding-left: 11px; padding-right: 11px; }
          .ot-wordmark { font-size: 10px; letter-spacing: .16em; }
          .ot-view-tab { min-width: 65px; padding: 8px 8px !important; font-size: 10px !important; }
          .ot-topic-list { gap: 16px; }
          .ot-rail { right: 10px; gap: 13px; }
          .ot-meta { left: 14px; right: 64px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ot-suno *, .ot-suno *::before, .ot-suno *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>

      <div className="ot-phone">
        <div className="ot-feed" ref={feedRef} aria-label="Home feed">
          {visiblePosts.map((post) => {
            const isFollowed = followed.includes(post.username);
            return (
              <article className="ot-post" key={post.id} id={post.id}>
                <img
                  className="ot-photo"
                  src={post.image}
                  alt=""
                  onDoubleClick={() => {
                    if (!post.liked) patchPost(post.id, { liked: true, likes: post.likes + 1 });
                  }}
                />
                <div className="ot-photo-shade" />
                <div className="ot-rail">
                  <button className={`ot-rail-button${post.liked ? " liked" : ""}`} type="button" aria-label="Like post" aria-pressed={post.liked} onClick={() => patchPost(post.id, { liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) })}>
                    <Icon name="heart" filled={post.liked} /><span>{post.likes}</span>
                  </button>
                  <button className="ot-rail-button" type="button" aria-label="Comments" onClick={() => openComments(post)}>
                    <Icon name="comment" /><span>{post.comments}</span>
                  </button>
                  <button className={`ot-rail-button${post.reposted ? " reposted" : ""}`} type="button" aria-label={post.reposted ? "Remove repost" : "Repost post"} aria-pressed={post.reposted} onClick={() => {
                    const next = !post.reposted;
                    patchPost(post.id, { reposted: next, reposts: post.reposts + (next ? 1 : -1) });
                    announce(next ? "Reposted to your followers" : "Repost removed");
                  }}>
                    <Icon name="repost" /><span>{post.reposts}</span>
                  </button>
                </div>
                <div className="ot-meta">
                  <div className="ot-author-row">
                    <span className="ot-avatar" aria-hidden="true">{post.initials}</span>
                    <button className="ot-author" type="button" onClick={() => announce(`Profile: ${post.name}`)}>{post.name}</button>
                    {!isFollowed && post.username !== "@you" && (
                      <button className="ot-follow" type="button" onClick={() => {
                        setFollowed((current) => current.includes(post.username) ? current.filter((item) => item !== post.username) : [...current, post.username]);
                        announce(isFollowed ? `Unfollowed ${post.name}` : `Following ${post.name}`);
                      }}>{isFollowed ? "Following" : "Follow"}</button>
                    )}
                  </div>
                  <p className="ot-caption">{post.caption}</p>
                  <p className="ot-location">{post.location}<span aria-hidden="true">·</span>{post.time} ago</p>
                </div>
                <div className="ot-action-shelf" aria-label="Post actions">
                  <span className="ot-view-count"><strong>Original audio</strong><small>{post.views} views</small></span>
                  <button className={`ot-shelf-action${post.saved ? " saved" : ""}`} type="button" aria-label={post.saved ? "Remove saved post" : "Save post"} aria-pressed={post.saved} onClick={() => {
                    patchPost(post.id, { saved: !post.saved });
                    announce(post.saved ? "Removed from saved posts" : "Added to saved posts");
                  }}><Icon name="bookmark" filled={post.saved} /></button>
                  <button className={`ot-shelf-action${post.reposted ? " reposted" : ""}`} type="button" aria-label={post.reposted ? "Remove repost" : "Repost post"} aria-pressed={post.reposted} onClick={() => {
                    const next = !post.reposted;
                    patchPost(post.id, { reposted: next, reposts: post.reposts + (next ? 1 : -1) });
                    announce(next ? "Reposted to your followers" : "Repost removed");
                  }}><Icon name="repost" /></button>
                  <button className="ot-shelf-action" type="button" aria-label="Share post" onClick={() => void sharePost(post)}><Icon name="share" filled /></button>
                </div>
              </article>
            );
          })}
          {visiblePosts.length === 0 && (
            <div className="ot-empty">
              <span className="ot-empty-mark" aria-hidden="true">⌖</span>
              <strong>{activeView === "Nearby" ? "No posts in this area yet" : "Your feed is quiet for now"}</strong>
              <p>{activeView === "Nearby" ? "Pick an area or switch to all areas to find more posts." : "Check back soon for more moments from your community."}</p>
              {activeView === "Nearby" && <button type="button" onClick={() => setNearbyArea("all")}>Explore all areas</button>}
            </div>
          )}
        </div>

        <header className="ot-header">
          <div className="ot-brand-row">
            <div className="ot-brand">
              <button className="ot-menu-button" type="button" aria-label="Open navigation menu" onClick={() => setOverlay("drawer")}><Icon name="menu" /></button>
              <span className="ot-wordmark">OLD TIME</span>
            </div>
            <div className="ot-header-actions">
              <button className="ot-tool" type="button" aria-label="Search" onClick={() => { setActiveNav("Search"); setOverlay("search"); }}><Icon name="search" /></button>
              <button className="ot-tool" type="button" aria-label="Create" onClick={() => { setComposerText(""); setOverlay("create"); }}><Icon name="camera" /></button>
              <button className="ot-tool" type="button" aria-label="Notifications" onClick={() => setOverlay("notifications")}><Icon name="bell" /><span className="ot-badge" /></button>
            </div>
          </div>
          <div className="ot-view-row">
            <nav className="ot-view-tabs" role="tablist" aria-label="Home feed views">
              {views.map((view) => (
                <button className="ot-view-tab" key={view} type="button" role="tab" aria-selected={activeView === view} onClick={() => setActiveView(view)}>{view}</button>
              ))}
            </nav>
          </div>
          <nav className="ot-topic-list" role="tablist" aria-label="Explore topics">
            {topics.map((topic) => (
              <button className="ot-topic" key={topic} type="button" role="tab" aria-selected={activeTopic === topic} onClick={() => {
                setActiveTopic(topic);
                announce(topic);
              }}>{topic}</button>
            ))}
          </nav>
          {activeView === "Nearby" && (
            <div className="ot-nearby">
              <div className="ot-location-line">
                <span className="ot-location-label"><Icon name="pin" />{nearbyArea === "all" ? "Explore posts by area" : `Near ${nearbyArea}`}</span>
                <button className="ot-locate-button" type="button" onClick={() => {
                  setLocationUsed(true);
                  announce("Area updated for this preview");
                }}>{locationUsed ? "Refresh" : "Use my location"}</button>
              </div>
              <nav className="ot-area-list" aria-label="Choose a nearby area">
                <button className="ot-area-chip" type="button" aria-pressed={nearbyArea === "all"} onClick={() => setNearbyArea("all")}>All areas <small>3</small></button>
                {nearbyAreas.map((area) => (
                  <button className="ot-area-chip" key={area} type="button" aria-pressed={nearbyArea === area} onClick={() => setNearbyArea(area)}>
                    {area} <small>{posts.filter((post) => post.location === area).length}</small>
                  </button>
                ))}
              </nav>
              <small className="ot-privacy">{locationUsed ? "Your exact location isn’t saved or shared." : "Location is optional. You can browse these areas without it."}</small>
            </div>
          )}
        </header>

        <div className={`ot-stories${activeView === "Nearby" ? " nearby-on" : ""}`} aria-label="Stories">
          {storyPeople.map((story, index) => (
            <button className="ot-story" type="button" key={story.name} aria-label={`Open ${story.name} story`} onClick={() => {
              setActiveStory(story);
              setStoryIndex(index);
              setOverlay("story");
            }}>
              <span className={`ot-story-ring${story.seen ? " seen" : ""}`}>
                <span className="ot-story-inner"><img src={story.image} alt="" /></span>
                <span className="ot-story-initial">{story.initials}</span>
              </span>
              <span>{story.name}</span>
            </button>
          ))}
        </div>

        <nav className="ot-nav" aria-label="Primary navigation">
          <button className={`ot-nav-button${activeNav === "Home" ? " active" : ""}`} type="button" aria-label="Home" onClick={() => chooseNav("Home")}><Icon name="home" /><span>Home</span></button>
          <button className={`ot-nav-button${activeNav === "Search" ? " active" : ""}`} type="button" aria-label="Search" onClick={() => { setActiveNav("Search"); setOverlay("search"); }}><Icon name="search" /><span>Search</span></button>
          <button className={`ot-nav-button${activeNav === "Communities" ? " active" : ""}`} type="button" aria-label="Communities" onClick={() => chooseNav("Communities")}><Icon name="users" /><span>Communities</span></button>
          <button className={`ot-nav-button${activeNav === "Messages" ? " active" : ""}`} type="button" aria-label="Messages" onClick={() => chooseNav("Messages")}><Icon name="comment" /><span>Messages</span></button>
          <button className={`ot-nav-button${activeNav === "Profile" ? " active" : ""}`} type="button" aria-label="Profile" onClick={() => chooseNav("Profile")}><Icon name="user" /><span>Profile</span></button>
        </nav>

        {overlay === "drawer" && (
          <div className="ot-overlay" role="presentation" onClick={() => setOverlay(null)}>
            <section className="ot-sheet" role="dialog" aria-modal="true" aria-label="Old Time navigation" onClick={(event) => event.stopPropagation()}>
              <div className="ot-drawer-head">
                <button className="ot-drawer-profile" type="button" onClick={() => chooseDrawerItem("My profile")}>
                  <span className="ot-avatar">Y</span><span><strong>You</strong><small>@you</small></span>
                </button>
                <button className="ot-close" type="button" aria-label="Close menu" onClick={() => setOverlay(null)}><Icon name="close" /></button>
              </div>
              <p className="ot-drawer-label">Explore</p>
              <button className="ot-drawer-link" type="button" onClick={() => chooseDrawerItem("Home")}><Icon name="home" />Home</button>
              <button className="ot-drawer-link" type="button" onClick={() => chooseDrawerItem("Search")}><Icon name="search" />Search</button>
              <button className="ot-drawer-link" type="button" onClick={() => chooseDrawerItem("Messages")}><Icon name="comment" />Messages</button>
              <button className="ot-drawer-link" type="button" onClick={() => chooseDrawerItem("Communities")}><Icon name="users" />Communities</button>
              <button className="ot-drawer-link" type="button" onClick={() => chooseDrawerItem("Notifications")}><Icon name="bell" />Notifications</button>
              <div className="ot-drawer-separator" />
              <p className="ot-drawer-label">Create</p>
              <button className="ot-drawer-link" type="button" onClick={() => chooseDrawerItem("Create a post")}><Icon name="camera" />Create a post</button>
              <button className="ot-drawer-link" type="button" onClick={() => chooseDrawerItem("Write a quote")}><Icon name="plus" />Write a quote</button>
              <div className="ot-drawer-separator" />
              <p className="ot-drawer-label">Account</p>
              <button className="ot-drawer-link" type="button" onClick={() => chooseDrawerItem("My profile")}><Icon name="user" />My profile</button>
              <button className="ot-drawer-link" type="button" onClick={() => chooseDrawerItem("Settings")}><Icon name="settings" />Settings</button>
            </section>
          </div>
        )}

        {(overlay === "search" || overlay === "create" || overlay === "quote" || overlay === "notifications" || overlay === "comments") && (
          <div className="ot-overlay" role="presentation" onClick={() => setOverlay(null)}>
            <section className="ot-sheet" role="dialog" aria-modal="true" aria-label={
              overlay === "search" ? "Search Old Time" : overlay === "notifications" ? "Notifications" : overlay === "comments" ? "Comments" : overlay === "quote" ? "Write a quote" : "Create a post"
            } onClick={(event) => event.stopPropagation()}>
              <div className="ot-sheet-head">
                <h2>{overlay === "search" ? "Search" : overlay === "notifications" ? "Notifications" : overlay === "comments" ? "Comments" : overlay === "quote" ? "Write a quote" : "Create a post"}</h2>
                <button className="ot-close" type="button" aria-label="Close" onClick={() => setOverlay(null)}><Icon name="close" /></button>
              </div>
              {overlay === "search" && (
                <>
                  <label className="ot-searchbox"><Icon name="search" /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search people, places, moments" /></label>
                  <div>
                    {searchedPosts.length ? searchedPosts.map((post) => (
                      <button className="ot-result" type="button" key={post.id} onClick={() => {
                        setOverlay(null);
                        setActiveNav("Home");
                        window.setTimeout(() => document.getElementById(post.id)?.scrollIntoView({ behavior: "smooth" }), 30);
                      }}>
                        <img className="ot-result-image" src={post.image} alt="" />
                        <span><strong>{post.name}</strong><small>{post.caption} · {post.location}</small></span>
                      </button>
                    )) : <p className="ot-sheet-note">No moments found. Try another name or place.</p>}
                  </div>
                </>
              )}
              {(overlay === "create" || overlay === "quote") && (
                <form onSubmit={publishPost}>
                  <p className="ot-sheet-note">{overlay === "quote" ? "Write a thought to share with your community." : "Share a candid moment with your friends."}</p>
                  <textarea className="ot-field" value={composerText} onChange={(event) => setComposerText(event.target.value)} placeholder={overlay === "quote" ? "What’s on your mind?" : "Add a caption to your moment…"} />
                  <button className="ot-publish" type="submit" disabled={!composerText.trim()}>{overlay === "quote" ? "Share quote" : "Share post"}</button>
                </form>
              )}
              {overlay === "notifications" && <p className="ot-sheet-note">You’re all caught up. New notifications will appear here.</p>}
              {overlay === "comments" && (
                <>
                  <div className="ot-comment-list">
                    {(commentsByPost[activePostId] ?? []).map((comment, index) => (
                      <div className="ot-comment" key={`${activePostId}-${index}`}><span className="ot-avatar">Y</span><p><strong>You</strong>{comment}</p></div>
                    ))}
                    {!(commentsByPost[activePostId] ?? []).length && <p className="ot-comment-empty">Be the first to join the conversation.</p>}
                  </div>
                  <form className="ot-comment-form" onSubmit={addComment}>
                    <input className="ot-comment-input" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add a comment…" />
                    <button className="ot-send" type="submit" aria-label="Post comment"><Icon name="send" /></button>
                  </form>
                </>
              )}
            </section>
          </div>
        )}

        {overlay === "story" && (
          <div className="ot-story-view" onClick={() => setOverlay(null)}>
            <img className="ot-story-photo" src={activeStory.image} alt="" />
            <div className="ot-story-progress"><span style={{ width: `${Math.min(90, 28 + storyIndex * 16)}%` }} /></div>
            <div className="ot-story-user"><span className="ot-avatar">{activeStory.initials}</span>{activeStory.name}</div>
            <button className="ot-story-close" type="button" aria-label="Close story" onClick={() => setOverlay(null)}><Icon name="close" /></button>
            <p className="ot-story-copy">{activeStory.name === "You" ? "Your moments, all in one place." : "A little window into the day."}</p>
          </div>
        )}
        {toast && <div className="ot-toast" role="status">{toast}</div>}
      </div>
    </div>
  );
}
