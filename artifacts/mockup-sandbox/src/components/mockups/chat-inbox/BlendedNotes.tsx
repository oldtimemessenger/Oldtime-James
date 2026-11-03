import { useEffect, useState } from "react";

const iconPaths = {
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
  plus: "M12 5v14M5 12h14",
  edit: "m16 3 5 5-12 12-6 1 1-6zM14 5l5 5",
  home: "m3 10 9-7 9 7v10h-6v-7H9v7H3z",
  play: "m8 4 12 8-12 8z",
  search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5",
  comment: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z",
  users: "M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21",
  user: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-2a8 8 0 0 1 16 0v2",
} as const;

type IconName = keyof typeof iconPaths;

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

const conversations = [
  {
    name: "Nova Hale",
    avatar: "/__mockup/images/old-time-nova.jpg",
    message: "You catching the drive later?",
    time: "8:32 PM",
  },
  {
    name: "Coast crew",
    avatar: "/__mockup/images/old-time-june.jpg",
    message: "Map pin is up.",
    time: "7:18 PM",
    unread: 1,
  },
];

const notePeople = [
  {
    name: "You",
    note: "Try sharing a song...",
    avatar: "/__mockup/images/old-time-me.jpg",
  },
  {
    name: "Nova",
    note: "Could stay out all night talking.",
    avatar: "/__mockup/images/old-time-nova.jpg",
  },
  {
    name: "June",
    note: "Finally made it to the beach",
    avatar: "/__mockup/images/old-time-june.jpg",
  },
  {
    name: "Mara",
    note: "Taking it slow today.",
    avatar: "/__mockup/images/old-time-mara.jpg",
  },
];

const navigation: { label: string; icon: IconName }[] = [
  { label: "Home", icon: "home" },
  { label: "Search", icon: "search" },
  { label: "Chats", icon: "comment" },
  { label: "Communities", icon: "users" },
  { label: "Profile", icon: "user" },
];

export function BlendedNotes() {
  const [query, setQuery] = useState("");
  const [activeNav, setActiveNav] = useState("Chats");
  const [selectedNote, setSelectedNote] = useState("");
  const [notice, setNotice] = useState("");
  const [savedActive, setSavedActive] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 1800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const visibleConversations = conversations.filter((item) =>
    `${item.name} ${item.message}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <main className="blended-notes">
      <style>{`
        .blended-notes {
          --bn-ink: #24212c;
          --bn-muted: #77717c;
          --bn-paper: #fffaf3;
          --bn-dark: #1b1a22;
          --bn-coral: #ff694f;
          position: relative;
          isolation: isolate;
          width: 100%;
          height: 100dvh;
          min-height: 680px;
          overflow: hidden;
          color: var(--bn-ink);
          background: #fffaf3;
          font-family: Manrope, "Avenir Next", Avenir, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .blended-notes *,
        .blended-notes *::before,
        .blended-notes *::after { box-sizing: border-box; }
        .blended-notes button,
        .blended-notes input { color: inherit; font: inherit; }
        .blended-notes button { border: 0; cursor: pointer; }
        .bn-header {
          position: relative;
          z-index: 2;
          padding: max(9px, env(safe-area-inset-top)) 20px 20px;
          color: #fff9f2;
          background:
            radial-gradient(ellipse at 83% 0%, rgba(132, 91, 190, .19), transparent 42%),
            #1b1a22;
          border-radius: 0 0 28px 28px;
          box-shadow: 0 12px 28px rgba(43, 30, 47, .13);
        }
        .bn-profile-top {
          height: 39px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .bn-me-ring {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          padding: 2.5px;
          border-radius: 50%;
          background: linear-gradient(135deg, #66d6ff 2%, #657eff 45%, #bc72ff 100%);
          box-shadow: 0 0 0 2px rgba(255,255,255,.08);
        }
        .bn-me-ring img {
          width: 100%;
          height: 100%;
          border: 2px solid #1b1a22;
          border-radius: 50%;
          object-fit: cover;
        }
        .bn-title-row {
          min-height: 58px;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          margin-top: 3px;
        }
        .bn-header-icon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #fff9f2;
          background: rgba(255,255,255,.075);
          transition: transform .18s ease, background .18s ease;
        }
        .bn-header-icon:hover { background: rgba(255,255,255,.14); }
        .bn-header-icon:active { transform: scale(.92); }
        .bn-header-icon svg { width: 23px; height: 23px; }
        .bn-title {
          color: #fff9f2;
          font-family: Fraunces, Georgia, serif;
          font-size: 36px;
          font-weight: 680;
          letter-spacing: -.055em;
          line-height: 1;
        }
        .bn-header-actions { display: flex; gap: 7px; }
        .bn-search {
          height: 49px;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          padding: 0 15px;
          border: 1px solid rgba(255,255,255,.7);
          border-radius: 15px;
          color: #55535a;
          background: #f7f4f2;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
        }
        .bn-search svg { width: 21px; height: 21px; flex: 0 0 auto; color: #85828a; }
        .bn-search input {
          width: 100%;
          min-width: 0;
          height: 100%;
          padding: 0;
          border: 0;
          outline: 0;
          color: #292630;
          background: transparent;
          font-size: 15px;
          font-weight: 600;
        }
        .bn-search input::placeholder { color: #87838a; opacity: 1; }
        .bn-main {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          overflow: auto;
          padding-bottom: calc(82px + env(safe-area-inset-bottom));
          scrollbar-width: none;
        }
        .bn-main::-webkit-scrollbar,
        .bn-note-track::-webkit-scrollbar { display: none; }
        .bn-notes-panel {
          position: relative;
          flex: 0 0 auto;
          margin: 12px 13px 0;
          padding: 13px 11px 12px;
          overflow: hidden;
          border-radius: 23px;
          background: linear-gradient(112deg, #ff694f 0%, #ff9255 33%, #f4bf68 66%, #d8f277 100%);
          box-shadow: 0 10px 23px rgba(203, 119, 64, .15);
        }
        .bn-notes-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .13;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.2'/%3E%3C/svg%3E");
          mix-blend-mode: soft-light;
        }
        .bn-notes-heading {
          position: relative;
          z-index: 1;
          height: 23px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 3px;
          color: rgba(47, 34, 34, .79);
        }
        .bn-notes-heading strong {
          font-size: 12px;
          font-weight: 850;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .bn-notes-heading span { font-size: 11px; font-weight: 750; }
        .bn-note-track {
          position: relative;
          z-index: 1;
          margin: 0 -2px;
          overflow-x: auto;
          overflow-y: visible;
          overscroll-behavior-x: contain;
          scrollbar-width: none;
        }
        .bn-note-items {
          width: max-content;
          min-width: 100%;
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
          gap: 8px;
          padding: 49px 2px 2px;
        }
        .bn-note-person {
          position: relative;
          flex: 0 0 76px;
          width: 76px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 0;
          text-align: center;
          color: #302b30;
          background: transparent;
          border-radius: 16px;
        }
        .bn-note-avatar-wrap {
          position: relative;
          width: 57px;
          height: 57px;
          flex: 0 0 57px;
          display: grid;
          place-items: center;
          padding: 3px;
          border-radius: 50%;
          background: linear-gradient(137deg, #62d5ff 2%, #5f85ff 43%, #a373ff 72%, #e183ff);
          box-shadow: 0 3px 11px rgba(78, 79, 180, .23);
          transition: transform .18s ease;
        }
        .bn-note-person:active .bn-note-avatar-wrap { transform: scale(.94); }
        .bn-note-avatar {
          width: 100%;
          height: 100%;
          border: 2px solid #fffaf3;
          border-radius: 50%;
          object-fit: cover;
        }
        .bn-note-bubble {
          position: absolute;
          z-index: 2;
          left: 50%;
          bottom: calc(100% + 7px);
          width: 88px;
          min-height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 7px 8px;
          border: 1px solid rgba(61, 44, 42, .06);
          border-radius: 14px;
          color: #312c31;
          background: #fffaf5;
          box-shadow: 0 4px 12px rgba(75, 49, 42, .14);
          transform: translateX(-50%);
          font-size: 9.5px;
          font-weight: 750;
          line-height: 1.23;
          overflow-wrap: anywhere;
        }
        .bn-note-bubble::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -4px;
          width: 8px;
          height: 8px;
          border-right: 1px solid rgba(61, 44, 42, .05);
          border-bottom: 1px solid rgba(61, 44, 42, .05);
          background: #fffaf5;
          transform: translateX(-50%) rotate(45deg);
        }
        .bn-note-bubble span {
          display: -webkit-box;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }
        .bn-note-bubble.is-empty { color: #827c82; }
        .bn-note-name {
          max-width: 76px;
          overflow: hidden;
          color: rgba(48, 43, 48, .83);
          font-size: 10px;
          font-weight: 800;
          line-height: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bn-note-person[aria-pressed="true"] .bn-note-avatar-wrap {
          box-shadow: 0 0 0 3px rgba(255,250,243,.74), 0 4px 13px rgba(62,67,167,.3);
        }
        .bn-conversations {
          flex: 1 0 auto;
          margin: 21px 20px 0;
        }
        .bn-list-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          padding: 0 1px 7px;
        }
        .bn-list-heading h2 {
          color: #37313b;
          font-family: Fraunces, Georgia, serif;
          font-size: 21px;
          font-weight: 680;
          letter-spacing: -.035em;
          line-height: 1.1;
        }
        .bn-list-heading span {
          color: #88818a;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .bn-conversation {
          width: 100%;
          min-height: 81px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(71, 54, 67, .12);
          text-align: left;
          background: transparent;
        }
        .bn-conversation:last-child { border-bottom: 0; }
        .bn-chat-avatar-ring {
          width: 57px;
          height: 57px;
          flex: 0 0 57px;
          display: grid;
          place-items: center;
          padding: 3px;
          border-radius: 50%;
          background: linear-gradient(137deg, #63d5ff, #5c84ff 47%, #a16dff 76%, #df82ff);
          box-shadow: 0 3px 12px rgba(83, 84, 186, .2);
        }
        .bn-chat-avatar-ring img {
          width: 100%;
          height: 100%;
          border: 2px solid #fffaf3;
          border-radius: 50%;
          object-fit: cover;
        }
        .bn-chat-copy { min-width: 0; flex: 1; }
        .bn-chat-copy strong {
          display: block;
          overflow: hidden;
          color: #28242d;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -.02em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bn-chat-copy span {
          display: block;
          overflow: hidden;
          margin-top: 4px;
          color: #817b84;
          font-size: 12px;
          font-weight: 550;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bn-chat-meta {
          min-width: 58px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 7px;
          color: #8d8790;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }
        .bn-unread {
          min-width: 19px;
          height: 19px;
          display: grid;
          place-items: center;
          padding: 0 5px;
          border-radius: 20px;
          color: #fffaf3;
          background: #7968df;
          font-size: 10px;
          font-weight: 850;
        }
        .bn-empty {
          display: grid;
          justify-items: center;
          gap: 5px;
          padding: 30px 12px;
          color: #77717c;
          text-align: center;
          font-size: 12px;
        }
        .bn-empty strong { color: #39333d; font-size: 14px; }
        .bn-nav {
          position: absolute;
          z-index: 5;
          right: 0;
          bottom: 0;
          left: 0;
          height: calc(74px + env(safe-area-inset-bottom));
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          align-items: center;
          padding: 7px 7px max(10px, env(safe-area-inset-bottom));
          border-top: 1px solid rgba(96, 70, 82, .09);
          background: rgba(255, 250, 243, .94);
          backdrop-filter: blur(18px);
        }
        .bn-nav button {
          height: 48px;
          display: grid;
          align-content: center;
          justify-items: center;
          gap: 4px;
          color: #9a939b;
          background: transparent;
          transition: transform .18s ease, color .18s ease;
        }
        .bn-nav button:active { transform: scale(.92); }
        .bn-nav button[aria-current="page"] { color: #675be0; }
        .bn-nav svg { width: 21px; height: 21px; }
        .bn-nav span { font-size: 9px; font-weight: 750; }
        .bn-notice {
          position: absolute;
          z-index: 8;
          right: 50%;
          bottom: calc(83px + env(safe-area-inset-bottom));
          max-width: calc(100% - 32px);
          padding: 10px 15px;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 999px;
          color: #fffaf3;
          background: rgba(35, 30, 41, .93);
          box-shadow: 0 6px 20px rgba(49, 36, 51, .19);
          transform: translateX(50%);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          pointer-events: none;
        }
        @media (max-height: 740px) {
          .blended-notes { min-height: 620px; }
          .bn-notes-panel { padding-top: 10px; padding-bottom: 9px; }
          .bn-note-items { padding-top: 44px; }
          .bn-conversations { margin-top: 13px; }
          .bn-conversation { min-height: 73px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .blended-notes *, .blended-notes *::before, .blended-notes *::after { transition-duration: .01ms !important; }
        }
      `}</style>

      <section className="bn-main" aria-label="Chat inbox">
        <header className="bn-header">
          <div className="bn-profile-top">
            <span className="bn-me-ring">
              <img src="/__mockup/images/old-time-me.jpg" alt="" />
            </span>
          </div>
          <div className="bn-title-row">
            <button
              className="bn-header-icon"
              type="button"
              aria-label="Saved messages"
              aria-pressed={savedActive}
              onClick={() => {
                setSavedActive((value) => !value);
                setNotice(savedActive ? "Saved messages closed" : "Saved messages");
              }}
            >
              <Icon name="star" />
            </button>
            <h1 className="bn-title">Chats</h1>
            <div className="bn-header-actions">
              <button className="bn-header-icon" type="button" aria-label="New group" onClick={() => setNotice("Start a new group")}>
                <Icon name="plus" />
              </button>
              <button className="bn-header-icon" type="button" aria-label="New message" onClick={() => setNotice("Write a new message")}>
                <Icon name="edit" />
              </button>
            </div>
          </div>
          <label className="bn-search">
            <Icon name="search" />
            <input
              aria-label="Search chats"
              placeholder="Search chats"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </header>

        <section className="bn-notes-panel" aria-label="Friends' notes">
          <div className="bn-notes-heading">
            <strong>Notes</strong>
            <span>From your people</span>
          </div>
          <div className="bn-note-track">
            <div className="bn-note-items">
              {notePeople.map((person) => (
                <button
                  className="bn-note-person"
                  type="button"
                  key={person.name}
                  aria-label={`${person.name === "You" ? "Your" : `${person.name}'s`} note: ${person.note}`}
                  aria-pressed={selectedNote === person.name}
                  onClick={() => {
                    setSelectedNote(person.name);
                    setNotice(`${person.name === "You" ? "Your" : person.name + "'s"} note`);
                  }}
                >
                  <span className="bn-note-avatar-wrap">
                    <img className="bn-note-avatar" src={person.avatar} alt="" />
                    <span className={`bn-note-bubble${person.name === "You" ? " is-empty" : ""}`}>
                      <span>{person.note}</span>
                    </span>
                  </span>
                  <span className="bn-note-name">{person.name === "You" ? "Your note" : person.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="bn-conversations" aria-label="Conversations">
          <div className="bn-list-heading">
            <h2>Messages</h2>
            <span>{visibleConversations.length} conversations</span>
          </div>
          {visibleConversations.length ? visibleConversations.map((item) => (
            <button
              className="bn-conversation"
              type="button"
              key={item.name}
              onClick={() => setNotice(`Opening ${item.name}`)}
            >
              <span className="bn-chat-avatar-ring">
                <img src={item.avatar} alt="" />
              </span>
              <span className="bn-chat-copy">
                <strong>{item.name}</strong>
                <span>{item.message}</span>
              </span>
              <span className="bn-chat-meta">
                <span>{item.time}</span>
                {item.unread ? <span className="bn-unread">{item.unread}</span> : null}
              </span>
            </button>
          )) : (
            <div className="bn-empty">
              <strong>No chats found</strong>
              <span>Try another name or message.</span>
            </div>
          )}
        </section>
      </section>

      <nav className="bn-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <button
            type="button"
            key={item.label}
            aria-label={item.label}
            aria-current={activeNav === item.label ? "page" : undefined}
            onClick={() => {
              setActiveNav(item.label);
              setNotice(`${item.label} selected`);
            }}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {notice ? <div className="bn-notice" role="status">{notice}</div> : null}
    </main>
  );
}
