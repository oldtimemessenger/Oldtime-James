import "./_group.css";
import { useRef, useState, type FormEvent } from "react";

type IconName =
  | "home" | "heart" | "comment" | "repost" | "bookmark" | "search"
  | "bell" | "user" | "users" | "camera" | "plus" | "close" | "send"
  | "more" | "pin" | "check" | "spark";

const portraits = {
  june: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70",
  nova: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=70",
  kev: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=70",
  mara: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=200&q=70",
  you: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=70",
};

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
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/>',
};

function Icon({ name, filled = false, className = "" }: { name: IconName; filled?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`suno-icon ${className}`}
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

type Post = {
  id: string;
  name: string;
  username: string;
  avatar: string;
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
  following: boolean;
  position?: string;
};

const startingPosts: Post[] = [
  {
    id: "p2",
    name: "June Park",
    username: "@june",
    avatar: portraits.june,
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
    following: true,
  },
  {
    id: "p3",
    name: "Kev May",
    username: "@kevmay",
    avatar: portraits.kev,
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
    following: false,
    position: "center 56%",
  },
  {
    id: "p6",
    name: "June Park",
    username: "@june",
    avatar: portraits.june,
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
    following: true,
  },
];

const topics = ["For You", "Around the World", "Culture", "Comedy", "Fashion", "Food", "Travel"];
const stories = [
  { name: "You", image: portraits.you, seen: true },
  { name: "Nova", image: portraits.nova, seen: false },
  { name: "Kev", image: portraits.kev, seen: false },
  { name: "Mara", image: portraits.mara, seen: false },
];

type Overlay = "story" | "search" | "create" | "notifications" | "comments" | "profile" | "nav" | null;

export function SunoVisual() {
  const [activeView, setActiveView] = useState("Explore");
  const [activeTopic, setActiveTopic] = useState("For You");
  const [activeNav, setActiveNav] = useState("Home");
  const [posts, setPosts] = useState(startingPosts);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [activePostId, setActivePostId] = useState("p2");
  const [activeStory, setActiveStory] = useState(stories[1]);
  const [followed, setFollowed] = useState<string[]>(["@june"]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, string[]>>({
    p2: [],
    p3: ["That stretch of road is unreal."],
    p6: ["Saving this for tonight."],
  });
  const [commentDraft, setCommentDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [composerText, setComposerText] = useState("");
  const [toast, setToast] = useState("");
  const [searchSelection, setSearchSelection] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  const activePost = posts.find((post) => post.id === activePostId) ?? posts[0];
  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2300);
  };

  const patchPost = (id: string, patch: Partial<Post>) => {
    setPosts((current) => current.map((post) => post.id === id ? { ...post, ...patch } : post));
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

  const addComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = commentDraft.trim();
    if (!value) return;
    setCommentsByPost((current) => ({ ...current, [activePostId]: [...(current[activePostId] ?? []), value] }));
    patchPost(activePostId, { comments: activePost.comments + 1 });
    setCommentDraft("");
  };

  const publishPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const caption = composerText.trim();
    if (!caption) return;
    const newPost: Post = {
      id: `post-${Date.now()}`,
      name: "You",
      username: "@you",
      avatar: portraits.you,
      image: "/__mockup/images/oldtime-fire-escape.jpg",
      caption,
      location: "Miami",
      likes: 0,
      comments: 0,
      reposts: 0,
      views: "1",
      time: "now",
      liked: false,
      saved: false,
      following: true,
    };
    setPosts((current) => [newPost, ...current]);
    setComposerText("");
    setOverlay(null);
    setActiveNav("Home");
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    announce("Your post is live");
  };

  const openProfile = (post: Post) => {
    setActivePostId(post.id);
    setOverlay("profile");
  };

  const selectNav = (label: string) => {
    setActiveNav(label);
    if (label === "Home") {
      setOverlay(null);
      return;
    }
    if (label === "Search") setOverlay("search");
    else setOverlay("nav");
  };

  return (
    <div className="stage suno-stage">
      <style>{`
        .suno-stage { min-height: 100dvh; height: 100dvh; background: #100f15; color: #fff8ed; }
        .suno-stage .phone { width: 100%; height: 100dvh; max-width: none; border-radius: 0; background: #111017; }
        .suno-stage .screen { display: flex; background: #111017; }
        .suno-concept {
          --suno-ink: #fff8ed;
          --suno-muted: rgba(255,248,237,.67);
          --suno-coral: #ff694f;
          --suno-lime: #d8f277;
          --suno-panel: rgba(19,17,22,.72);
          position: absolute; inset: 0; overflow: hidden; color: var(--suno-ink);
          background: #111017; isolation: isolate;
        }
        .suno-concept::after {
          content: ""; position: absolute; inset: 0; z-index: 8; pointer-events: none; opacity: .12;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.88' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.21'/%3E%3C/svg%3E");
          mix-blend-mode: soft-light;
        }
        .suno-feed { position: absolute; inset: 0; overflow: auto; scroll-snap-type: y mandatory; scrollbar-width: none; }
        .suno-feed::-webkit-scrollbar { display: none; }
        .suno-post { position: relative; height: 100%; min-height: 620px; scroll-snap-align: start; overflow: hidden; background: #252029; }
        .suno-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .suno-post::before { content: ""; position: absolute; z-index: 1; inset: 0; background: linear-gradient(180deg, rgba(18,14,21,.78) 0%, rgba(18,14,21,.17) 23%, transparent 43%, rgba(15,12,17,.12) 58%, rgba(12,10,15,.88) 100%); }
        .suno-header {
          position: absolute; z-index: 5; top: 0; left: 0; right: 0;
          padding: max(12px, env(safe-area-inset-top)) 14px 8px;
          background: linear-gradient(180deg, rgba(17,16,23,.94), rgba(17,16,23,.68) 75%, transparent);
        }
        .suno-top-row { position: relative; display: flex; justify-content: center; align-items: center; min-height: 40px; }
        .suno-tabs { display: flex; justify-content: center; gap: 3px; min-width: 0; background: rgba(255,255,255,.075); padding: 3px; border-radius: 999px; }
        .suno-view { min-width: 0; padding: 7px 6px; border-radius: 999px; color: rgba(255,248,237,.64); font-size: 11px; line-height: 1; font-weight: 700; white-space: nowrap; transition: background .18s ease, color .18s ease, transform .18s ease; }
        .suno-view[aria-selected="true"] { color: #271514; background: var(--suno-coral); box-shadow: 0 3px 14px rgba(255,105,79,.25); }
        .suno-view:active, .suno-action:active, .suno-nav-button:active { transform: scale(.93); }
        .suno-tools { position: absolute; top: 50%; right: 0; display: flex; gap: 2px; align-items: center; transform: translateY(-50%); }
        .suno-action { width: 28px; height: 31px; display: grid; place-items: center; border-radius: 50%; color: #fff8ed; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.08); transition: transform .18s ease, background .18s ease; }
        .suno-action .suno-icon { width: 16px; height: 16px; }
        .suno-action.has-dot { position: relative; }
        .suno-action.has-dot::after { content: ""; position: absolute; width: 6px; height: 6px; right: 4px; top: 4px; border-radius: 50%; background: var(--suno-lime); border: 1px solid #302b28; }
        .suno-topics { display: flex; gap: 18px; overflow-x: auto; scrollbar-width: none; padding: 8px 2px 4px; white-space: nowrap; }
        .suno-topics::-webkit-scrollbar { display: none; }
        .suno-topic { flex: 0 0 auto; position: relative; color: rgba(255,248,237,.64); font-size: 11px; font-weight: 700; padding: 2px 0 6px; }
        .suno-topic[aria-selected="true"] { color: white; }
        .suno-topic[aria-selected="true"]::after { content: ""; position: absolute; bottom: 0; left: 0; width: 18px; height: 2px; border-radius: 4px; background: var(--suno-lime); }
        .suno-stories { position: absolute; z-index: 4; top: calc(max(12px, env(safe-area-inset-top)) + 91px); left: 0; right: 0; display: flex; gap: 14px; overflow-x: auto; padding: 3px 15px 8px; scrollbar-width: none; }
        .suno-stories::-webkit-scrollbar { display: none; }
        .suno-story { flex: 0 0 52px; display: grid; justify-items: center; gap: 4px; color: rgba(255,248,237,.88); font-size: 10px; font-weight: 600; }
        .suno-story-ring { width: 48px; height: 48px; display: grid; place-items: center; padding: 2px; border-radius: 50%; background: conic-gradient(from 205deg, #ff694f, #ffcc76, #dcf278, #fe7658, #ff694f); }
        .suno-story-ring.seen { background: rgba(255,255,255,.24); }
        .suno-story-face { width: 100%; height: 100%; border: 2px solid #19171c; border-radius: 50%; object-fit: cover; }
        .suno-rail { position: absolute; z-index: 3; right: 13px; bottom: calc(170px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 15px; align-items: center; }
        .suno-rail-button { display: grid; justify-items: center; gap: 4px; color: #fff8ed; font-size: 10px; font-weight: 750; text-shadow: 0 1px 7px rgba(0,0,0,.6); transition: transform .18s ease; }
        .suno-rail-button .suno-icon { width: 27px; height: 27px; filter: drop-shadow(0 1px 3px rgba(0,0,0,.26)); }
        .suno-rail-button.liked { color: var(--suno-coral); }
        .suno-rail-button.reposted { color: var(--suno-lime); }
        .suno-meta { position: absolute; z-index: 3; left: 18px; right: 73px; bottom: calc(166px + env(safe-area-inset-bottom)); }
        .suno-author-row { display: flex; align-items: center; gap: 8px; }
        .suno-post-avatar { width: 29px; height: 29px; border: 1.5px solid rgba(255,248,237,.88); border-radius: 50%; object-fit: cover; }
        .suno-author { color: #fff8ed; font-size: 14px; font-weight: 800; letter-spacing: -.02em; text-shadow: 0 1px 8px rgba(0,0,0,.4); }
        .suno-verified { color: #1c1a17; background: var(--suno-lime); border-radius: 50%; width: 14px; height: 14px; display: grid; place-items: center; }
        .suno-verified .suno-icon { width: 10px; height: 10px; }
        .suno-follow { margin-left: 1px; padding: 5px 10px; border: 1px solid rgba(255,248,237,.75); border-radius: 99px; color: white; font-size: 10px; font-weight: 750; background: rgba(20,16,19,.18); }
        .suno-caption { margin-top: 8px; max-width: 310px; color: #fff8ed; font-size: 16px; line-height: 1.32; font-weight: 650; letter-spacing: -.025em; text-shadow: 0 1px 12px rgba(0,0,0,.5); }
        .suno-location { display: flex; align-items: center; gap: 5px; margin-top: 7px; color: rgba(255,248,237,.8); font-size: 11px; font-weight: 650; text-shadow: 0 1px 8px rgba(0,0,0,.55); }
        .suno-location .suno-icon { width: 13px; height: 13px; color: var(--suno-lime); }
        .suno-postbar { position: absolute; z-index: 4; left: 13px; right: 13px; bottom: calc(84px + env(safe-area-inset-bottom)); min-height: 57px; display: grid; grid-template-columns: 34px minmax(0,1fr) auto auto; gap: 9px; align-items: center; padding: 8px 9px; border: 1px solid rgba(255,255,255,.14); border-radius: 17px; background: rgba(25,22,26,.77); box-shadow: 0 10px 30px rgba(0,0,0,.16); backdrop-filter: blur(16px); }
        .suno-bar-avatar { width: 33px; height: 33px; border-radius: 10px; object-fit: cover; }
        .suno-post-stats { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .suno-post-stats strong { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,248,237,.6); }
        .suno-post-stats span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #fff8ed; font-size: 11px; font-weight: 700; }
        .suno-bar-button { min-width: 36px; height: 35px; display: grid; place-items: center; gap: 2px; padding: 0 8px; border-radius: 12px; color: rgba(255,248,237,.86); background: rgba(255,255,255,.08); font-size: 10px; font-weight: 700; }
        .suno-bar-button .suno-icon { width: 16px; height: 16px; }
        .suno-bar-button.saved { color: var(--suno-lime); }
        .suno-nav { position: absolute; z-index: 5; left: 0; right: 0; bottom: 0; height: calc(70px + env(safe-area-inset-bottom)); display: grid; grid-template-columns: repeat(5,1fr); align-items: center; padding: 7px 8px max(11px, env(safe-area-inset-bottom)); background: linear-gradient(180deg,rgba(17,16,23,0),rgba(17,16,23,.94) 36%); }
        .suno-nav-button { height: 46px; display: grid; place-content: center; justify-items: center; gap: 3px; color: rgba(255,248,237,.58); transition: transform .18s ease,color .18s ease; }
        .suno-nav-button .suno-icon { width: 21px; height: 21px; }
        .suno-nav-button.active { color: var(--suno-lime); }
        .suno-overlay { position: absolute; z-index: 10; inset: 0; display: flex; align-items: flex-end; justify-content: center; padding: 14px; background: rgba(10,9,13,.58); backdrop-filter: blur(8px); animation: sunoFade .18s ease both; }
        .suno-sheet { width: 100%; max-height: min(76dvh,650px); overflow: auto; padding: 20px 18px max(22px, env(safe-area-inset-bottom)); border: 1px solid rgba(255,255,255,.12); border-radius: 25px 25px 18px 18px; background: #211e26; box-shadow: 0 20px 70px rgba(0,0,0,.38); animation: sunoRise .24s cubic-bezier(.2,.8,.2,1) both; }
        .suno-sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
        .suno-sheet-head h2 { font-family: var(--serif); font-size: 24px; letter-spacing: -.035em; }
        .suno-close { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; color: #fff8ed; background: rgba(255,255,255,.09); }
        .suno-close .suno-icon { width: 17px; height: 17px; }
        .suno-field { width: 100%; min-height: 94px; resize: vertical; padding: 13px; outline: none; border: 1px solid rgba(255,255,255,.13); border-radius: 15px; color: #fff8ed; background: rgba(255,255,255,.055); font-size: 14px; }
        .suno-field::placeholder { color: rgba(255,248,237,.42); }
        .suno-submit { width: 100%; min-height: 45px; margin-top: 13px; border-radius: 14px; color: #241713; background: var(--suno-lime); font-size: 13px; font-weight: 800; }
        .suno-submit:disabled { opacity: .45; cursor: not-allowed; }
        .suno-searchbox { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 13px; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; background: rgba(255,255,255,.055); }
        .suno-searchbox .suno-icon { width: 18px; height: 18px; color: var(--suno-lime); }
        .suno-searchbox input { min-width: 0; flex: 1; outline: none; border: 0; color: #fff8ed; background: transparent; font-size: 14px; }
        .suno-result { display: flex; align-items: center; gap: 11px; width: 100%; padding: 12px 2px; text-align: left; border-bottom: 1px solid rgba(255,255,255,.08); color: #fff8ed; }
        .suno-result:last-child { border-bottom: 0; }
        .suno-result-face { width: 40px; height: 40px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 50%; object-fit: cover; color: #fff8ed; background: linear-gradient(145deg,#ce795e,#54405c); font-size: 11px; font-weight: 800; }
        .suno-result small { display: block; margin-top: 3px; color: var(--suno-muted); font-size: 11px; }
        .suno-empty { color: var(--suno-muted); padding: 18px 2px; font-size: 13px; line-height: 1.5; }
        .suno-comment-list { display: grid; gap: 14px; max-height: 33dvh; overflow-y: auto; }
        .suno-comment { display: flex; gap: 10px; align-items: flex-start; color: rgba(255,248,237,.9); font-size: 13px; line-height: 1.45; }
        .suno-comment strong { display: block; margin-bottom: 2px; font-size: 11px; color: var(--suno-lime); }
        .suno-comment-face { flex: 0 0 auto; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; object-fit: cover; background: #47404b; font-size: 9px; font-weight: 800; }
        .suno-comment-form { display: flex; gap: 8px; margin-top: 17px; }
        .suno-comment-form input { flex: 1; min-width: 0; padding: 12px; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; outline: none; color: #fff8ed; background: rgba(255,255,255,.06); font-size: 13px; }
        .suno-send { width: 44px; border-radius: 14px; display: grid; place-items: center; color: #241713; background: var(--suno-coral); }
        .suno-send .suno-icon { width: 18px; height: 18px; }
        .suno-story-view { position: absolute; inset: 0; display: flex; align-items: flex-end; padding: 25px 20px 44px; background: #1b171b; }
        .suno-story-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .suno-story-view::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg,rgba(12,10,14,.58),transparent 30%,rgba(12,10,14,.48)); }
        .suno-story-progress { position: absolute; z-index: 1; top: max(22px,env(safe-area-inset-top)); left: 18px; right: 18px; height: 3px; border-radius: 9px; background: rgba(255,255,255,.35); }
        .suno-story-progress::before { content: ""; display: block; width: 42%; height: 100%; border-radius: inherit; background: white; }
        .suno-story-profile { position: absolute; z-index: 1; top: calc(max(22px,env(safe-area-inset-top)) + 17px); left: 18px; display: flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 800; }
        .suno-story-profile .suno-story-face { width: 30px; height: 30px; flex: 0 0 auto; }
        .suno-story-copy { z-index: 1; font-family: var(--serif); font-size: 32px; line-height: 1.12; letter-spacing: -.035em; text-shadow: 0 2px 14px rgba(0,0,0,.4); }
        .suno-story-dismiss { position: absolute; z-index: 2; top: max(47px,calc(env(safe-area-inset-top) + 40px)); right: 16px; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: rgba(0,0,0,.34); color: white; }
        .suno-story-dismiss .suno-icon { width: 18px; height: 18px; }
        .suno-nav-note { padding: 5px 0 4px; color: rgba(255,248,237,.68); font-size: 13px; line-height: 1.6; }
        .suno-nav-note strong { display: block; margin-bottom: 4px; color: #fff8ed; font-size: 15px; }
        .suno-toast { position: absolute; z-index: 12; left: 50%; bottom: calc(86px + env(safe-area-inset-bottom)); transform: translateX(-50%); padding: 10px 15px; border: 1px solid rgba(255,255,255,.15); border-radius: 99px; background: rgba(28,25,31,.92); color: #fff8ed; font-size: 12px; font-weight: 700; white-space: nowrap; box-shadow: 0 6px 24px rgba(0,0,0,.25); animation: sunoFade .18s ease both; }
        @keyframes sunoFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sunoRise { from { opacity: .5; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 370px) {
          .suno-view { padding: 7px 5px; font-size: 10px; }
          .suno-tools { gap: 1px; }
          .suno-action { width: 25px; height: 28px; }
          .suno-topics { gap: 14px; }
          .suno-meta { left: 14px; right: 65px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .suno-concept *, .suno-concept *::before, .suno-concept *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>
      <div className="phone suno-phone">
        <section className="screen on home-screen">
          <div className="suno-concept">
            <div className="suno-feed" id="suno-feed" ref={feedRef}>
              {posts.map((post) => {
                const isFollowed = followed.includes(post.username);
                return (
                  <article className="suno-post" key={post.id} id={post.id}>
                    <img className="suno-photo" src={post.image} alt="" style={{ objectPosition: post.position ?? "center" }} />
                    <div className="suno-rail">
                      <button className={`suno-rail-button${post.liked ? " liked" : ""}`} type="button" aria-label="Like post" aria-pressed={post.liked} onClick={() => patchPost(post.id, { liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) })}>
                        <Icon name="heart" filled={post.liked} />
                        <span>{post.likes}</span>
                      </button>
                      <button className="suno-rail-button" type="button" aria-label="Comments" onClick={() => { setActivePostId(post.id); setOverlay("comments"); }}>
                        <Icon name="comment" />
                        <span>{post.comments}</span>
                      </button>
                      <button className={`suno-rail-button${post.reposts > (post.id === "p3" ? 2 : post.id === "p6" ? 1 : 0) ? " reposted" : ""}`} type="button" aria-label="Repost post" onClick={() => { patchPost(post.id, { reposts: post.reposts + 1 }); announce("Reposted to your followers"); }}>
                        <Icon name="repost" />
                        <span>{post.reposts}</span>
                      </button>
                    </div>
                    <div className="suno-meta">
                      <div className="suno-author-row">
                        <img className="suno-post-avatar" src={post.avatar} alt="" />
                        <button className="suno-author" type="button" onClick={() => openProfile(post)}>{post.name}</button>
                        {post.id === "p3" && <span className="suno-verified" aria-label="Verified creator"><Icon name="check" /></span>}
                        {!isFollowed && (
                          <button className="suno-follow" type="button" onClick={() => { setFollowed((current) => current.includes(post.username) ? current.filter((item) => item !== post.username) : [...current, post.username]); announce(followed.includes(post.username) ? "Unfollowed creator" : `Following ${post.name}`); }}>
                            {followed.includes(post.username) ? "Following" : "Follow"}
                          </button>
                        )}
                      </div>
                      <p className="suno-caption">{post.caption}</p>
                      <p className="suno-location"><Icon name="pin" />{post.location}<span aria-hidden="true">·</span>{post.time} ago</p>
                    </div>
                    <div className="suno-postbar">
                      <img className="suno-bar-avatar" src={post.avatar} alt="" />
                      <div className="suno-post-stats">
                        <strong>In the moment</strong>
                        <span>{post.views} views · shared {post.time} ago</span>
                      </div>
                      <button className={`suno-bar-button${post.saved ? " saved" : ""}`} type="button" aria-label="Save post" aria-pressed={post.saved} onClick={() => { patchPost(post.id, { saved: !post.saved }); announce(post.saved ? "Removed from saved posts" : "Added to saved posts"); }}>
                        <Icon name="bookmark" filled={post.saved} />
                      </button>
                      <button className="suno-bar-button" type="button" aria-label="Share post" onClick={() => void sharePost(post)}>
                        <Icon name="send" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <header className="suno-header">
              <div className="suno-top-row">
                <nav className="suno-tabs" role="tablist" aria-label="Home feed views">
                  {["Following", "Explore", "Nearby"].map((view) => (
                    <button className="suno-view" key={view} type="button" role="tab" aria-selected={activeView === view} onClick={() => setActiveView(view)}>{view}</button>
                  ))}
                </nav>
                <div className="suno-tools">
                  <button className="suno-action" type="button" aria-label="Search" onClick={() => { setActiveNav("Search"); setOverlay("search"); }}><Icon name="search" /></button>
                  <button className="suno-action" type="button" aria-label="Create" onClick={() => setOverlay("create")}><Icon name="camera" /></button>
                  <button className="suno-action has-dot" type="button" aria-label="Notifications" onClick={() => setOverlay("notifications")}><Icon name="bell" /></button>
                </div>
              </div>
              <nav className="suno-topics" role="tablist" aria-label="Explore topics">
                {topics.map((topic) => (
                  <button className="suno-topic" key={topic} type="button" role="tab" aria-selected={activeTopic === topic} onClick={() => setActiveTopic(topic)}>{topic}</button>
                ))}
              </nav>
            </header>

            <div className="suno-stories" aria-label="Stories">
              {stories.map((story) => (
                <button className="suno-story" type="button" key={story.name} aria-label={`Open ${story.name} story`} onClick={() => { setActiveStory(story); setOverlay("story"); }}>
                  <span className={`suno-story-ring${story.seen ? " seen" : ""}`}><img className="suno-story-face" src={story.image} alt="" /></span>
                  <span>{story.name}</span>
                </button>
              ))}
            </div>

            <nav className="suno-nav" aria-label="Main navigation">
              <button className={`suno-nav-button${activeNav === "Home" ? " active" : ""}`} type="button" aria-label="Home" onClick={() => selectNav("Home")}><Icon name="home" /></button>
              <button className={`suno-nav-button${activeNav === "Search" ? " active" : ""}`} type="button" aria-label="Search" onClick={() => selectNav("Search")}><Icon name="search" /></button>
              <button className={`suno-nav-button${activeNav === "Chat" ? " active" : ""}`} type="button" aria-label="Chat" onClick={() => selectNav("Chat")}><Icon name="comment" /></button>
              <button className={`suno-nav-button${activeNav === "Communities" ? " active" : ""}`} type="button" aria-label="Communities" onClick={() => selectNav("Communities")}><Icon name="users" /></button>
              <button className={`suno-nav-button${activeNav === "Profile" ? " active" : ""}`} type="button" aria-label="Profile" onClick={() => selectNav("Profile")}><Icon name="user" /></button>
            </nav>

            {overlay === "story" && (
              <div className="suno-story-view" role="dialog" aria-modal="true" aria-label={`${activeStory.name} story`}>
                <img className="suno-story-photo" src={activeStory.name === "Kev" ? "/__mockup/images/oldtime-coast-road.jpg" : activeStory.name === "Mara" ? "/__mockup/images/oldtime-late-noodles.jpg" : "/__mockup/images/oldtime-fire-escape.jpg"} alt="" />
                <div className="suno-story-progress" />
                <div className="suno-story-profile"><img className="suno-story-face" src={activeStory.image} alt="" />{activeStory.name}<small> · 18m</small></div>
                <button className="suno-story-dismiss" type="button" aria-label="Close story" onClick={() => setOverlay(null)}><Icon name="close" /></button>
                <p className="suno-story-copy">{activeStory.name === "Kev" ? "Just keep taking the long way." : activeStory.name === "Mara" ? "A small pause in the middle of it all." : "Little things, held onto a little longer."}</p>
              </div>
            )}

            {overlay && overlay !== "story" && (
              <div className="suno-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setOverlay(null); }}>
                <section className="suno-sheet" role="dialog" aria-modal="true" aria-label={overlay === "comments" ? "Comments" : overlay === "create" ? "Create a post" : overlay === "search" ? "Search Old Time" : overlay === "notifications" ? "Notifications" : overlay === "profile" ? "Creator profile" : activeNav}>
                  <div className="suno-sheet-head">
                    <h2>{overlay === "comments" ? "The conversation" : overlay === "create" ? "A moment, shared." : overlay === "search" ? "Find your people" : overlay === "notifications" ? "A little activity" : overlay === "profile" ? activePost.name : activeNav}</h2>
                    <button className="suno-close" type="button" aria-label="Close" onClick={() => setOverlay(null)}><Icon name="close" /></button>
                  </div>

                  {overlay === "create" && (
                    <form onSubmit={publishPost}>
                      <textarea className="suno-field" value={composerText} onChange={(event) => setComposerText(event.target.value)} placeholder="What are you holding onto today?" maxLength={180} autoFocus />
                      <div className="suno-nav-note">A note, a place, a small ordinary thing. Keep it yours.</div>
                      <button className="suno-submit" type="submit" disabled={!composerText.trim()}>Share with your circle</button>
                    </form>
                  )}

                  {overlay === "search" && (
                    <>
                      <label className="suno-searchbox"><Icon name="search" /><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchSelection(""); }} placeholder="People, places, little moments" autoFocus /></label>
                      <div style={{ marginTop: 10 }}>
                        {(searchQuery ? posts.filter((post) => `${post.name} ${post.username} ${post.caption} ${post.location}`.toLowerCase().includes(searchQuery.toLowerCase())) : posts.slice(0, 3)).map((post) => (
                          <button className="suno-result" type="button" key={post.id} onClick={() => { setSearchSelection(post.name); setActivePostId(post.id); }}>
                            <img className="suno-result-face" src={post.avatar} alt="" /><span>{post.name}<small>{post.location} · {post.caption}</small></span>
                          </button>
                        ))}
                        {searchSelection && <p className="suno-empty">Showing moments from {searchSelection}. Close to return to your feed.</p>}
                        {searchQuery && !posts.some((post) => `${post.name} ${post.username} ${post.caption} ${post.location}`.toLowerCase().includes(searchQuery.toLowerCase())) && <p className="suno-empty">No moments found yet. Try a person or a place.</p>}
                      </div>
                    </>
                  )}

                  {overlay === "comments" && (
                    <>
                      <div className="suno-comment-list">
                        {(commentsByPost[activePostId] ?? []).length === 0 && <p className="suno-empty">A fresh page. Leave the first note on {activePost.name}’s post.</p>}
                        {(commentsByPost[activePostId] ?? []).map((comment, index) => <div className="suno-comment" key={`${activePostId}-${index}`}><img className="suno-comment-face" src={index % 2 ? portraits.june : portraits.you} alt="" /><p><strong>{index % 2 ? "June Park" : "You"}</strong>{comment}</p></div>)}
                      </div>
                      <form className="suno-comment-form" onSubmit={addComment}>
                        <input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add a kind thought…" aria-label="Write a comment" />
                        <button className="suno-send" type="submit" aria-label="Send comment"><Icon name="send" /></button>
                      </form>
                    </>
                  )}

                  {overlay === "notifications" && (
                    <div>
                      <button className="suno-result" type="button" onClick={() => { setActivePostId("p2"); setOverlay("comments"); }}><img className="suno-result-face" src={portraits.june} alt="" /><span>June Park<small>liked a moment you shared · 12m</small></span></button>
                      <button className="suno-result" type="button" onClick={() => { setActivePostId("p3"); setOverlay("comments"); }}><img className="suno-result-face" src={portraits.kev} alt="" /><span>Kev May<small>and 8 others found your post · 1h</small></span></button>
                      <p className="suno-nav-note">You’re all caught up. Come back when there’s more.</p>
                    </div>
                  )}

                  {overlay === "profile" && (
                    <div>
                      <div className="suno-result" style={{ borderBottom: 0 }}>
                        <img className="suno-result-face" src={activePost.avatar} alt="" style={{ width: 54, height: 54 }} />
                        <span>{activePost.username}<small>Sharing from {activePost.location} · on Old Time since spring</small></span>
                      </div>
                      <p className="suno-nav-note">{activePost.name === "June Park" ? "Food, windows, late light." : "Cars, coast roads, no script."}</p>
                      <button className="suno-submit" type="button" onClick={() => { setFollowed((current) => current.includes(activePost.username) ? current.filter((item) => item !== activePost.username) : [...current, activePost.username]); announce(followed.includes(activePost.username) ? "Unfollowed creator" : `Following ${activePost.name}`); setOverlay(null); }}>
                        {followed.includes(activePost.username) ? "Following" : "Follow"}
                      </button>
                    </div>
                  )}

                  {overlay === "nav" && (
                    <div className="suno-nav-note">
                      <strong>{activeNav === "Communities" ? "Your circle, together." : "A little space that’s yours."}</strong>
                      {activeNav === "Communities" ? "Shared moments from people you know will live here." : "Your profile, posts, and saved moments are close at hand."}
                      <button className="suno-submit" type="button" onClick={() => { setOverlay(null); announce(activeNav === "Communities" ? "Your circle is up to date" : "Profile preview opened"); }}>Got it</button>
                    </div>
                  )}
                </section>
              </div>
            )}

            {toast && <div className="suno-toast" role="status">{toast}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
