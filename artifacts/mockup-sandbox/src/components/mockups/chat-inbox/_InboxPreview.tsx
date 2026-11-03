import "./_group.css";

type InboxPreviewProps = {
  centered?: boolean;
  showNotes?: boolean;
};

const iconPaths: Record<string, string> = {
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM14 5l5 5"/>',
  home: '<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  comment: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
};

function Icon({ name }: { name: keyof typeof iconPaths }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="navic"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: iconPaths[name] }}
    />
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

function ConversationRow({ item }: { item: (typeof conversations)[number] }) {
  return (
    <button className="listbtn" type="button">
      <img src={item.avatar} alt="" />
      <span className="chat-row-copy">
        <b>{item.name}</b>
        <span className="sub" style={{ display: "block" }}>{item.message}</span>
      </span>
      <span className="chat-time-column">
        <span className="sub">{item.time}</span>
        {item.unread ? <span className="unread">{item.unread}</span> : null}
      </span>
    </button>
  );
}

export function InboxPreview({ centered = false, showNotes = false }: InboxPreviewProps) {
  const body = (
    <>
      <input className="chatsearch" aria-label="Search chats" placeholder="Search" />
      {showNotes ? (
        <div className="chat-note-track" aria-label="Profile notes">
          <div className="chat-note-items">
            {notePeople.map((person) => (
              <button className="chat-note-person" type="button" key={person.name} aria-label={`${person.name}'s note: ${person.note}`}>
                <span className="chat-note-avatar-wrap">
                  <img className="chat-note-avatar" src={person.avatar} alt="" />
                  <span className={`profile-note-bubble chat-note-bubble${person.name === "You" ? " empty" : ""}`}>
                    <span className="chat-note-bubble-text">{person.note}</span>
                  </span>
                </span>
                <span className="chat-note-name">{person.name === "You" ? "Your note" : person.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {conversations.map((item) => <ConversationRow item={item} key={item.name} />)}
    </>
  );

  return (
    <main className="chat-mockup-device light">
      <section className="chat-mockup-screen">
        <div className="chat-mockup-scroll">
          <div className="row chat-demo-header">
            <button className="icon" type="button" aria-label="Saved messages"><Icon name="star" /></button>
            <div className="row chat-demo-title">
              <img src="/__mockup/images/old-time-me.jpg" alt="" />
              <b>Chats</b>
            </div>
            <div className="row">
              <button className="icon" type="button" aria-label="New group"><Icon name="plus" /></button>
              <button className="icon" type="button" aria-label="New message"><Icon name="edit" /></button>
            </div>
          </div>
          {centered ? <div className="chat-list-body">{body}</div> : body}
        </div>
      </section>
      <nav className="nav lightnav" aria-label="Main navigation">
        <button type="button" aria-label="Home"><Icon name="home" /></button>
        <button type="button" aria-label="Search"><Icon name="search" /></button>
        <button className="on" type="button" aria-label="Chats"><Icon name="comment" /></button>
        <button type="button" aria-label="Communities"><Icon name="users" /></button>
        <button type="button" aria-label="Profile"><Icon name="user" /></button>
      </nav>
    </main>
  );
}
