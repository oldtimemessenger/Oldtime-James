import { useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  DoorOpen,
  Heart,
  Home,
  LockKeyhole,
  MessageCircle,
  Settings,
  Shield,
  X,
} from "lucide-react";
import "./_group.css";
import "./_settings.css";
import portrait from "./profile-portrait.jpg";

type Destination = "Updates" | "Chats" | "Explore" | "Your profile";

const destinations: { name: Destination; icon: typeof Home; detail?: string }[] = [
  { name: "Updates", icon: Home },
  { name: "Chats", icon: MessageCircle, detail: "2 new" },
  { name: "Explore", icon: Compass },
  { name: "Your profile", icon: Heart },
];

export function Drawer() {
  const [active, setActive] = useState<Destination>("Updates");
  const [privateAccount, setPrivateAccount] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [notice, setNotice] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  const choose = (name: Destination) => {
    setActive(name);
    setNotice(`${name} selected`);
  };

  return (
    <main className="ot-shell">
      <section className="ot-screen ot-drawer" aria-label="Old Time navigation drawer">
        <div className="ot-drawer__top">
          <div className="ot-brand">
            <span className="ot-brand__mark" aria-hidden="true">
              <span style={{ fontFamily: "var(--ot-serif)", fontSize: 19, fontWeight: 700 }}>o</span>
            </span>
            <span>old time</span>
          </div>
          <button
            className="ot-drawer__close"
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              setNotice(isOpen ? "Drawer closed in this preview" : "Navigation drawer open");
            }}
            aria-label={isOpen ? "Close navigation drawer" : "Open navigation drawer"}
          >
            {isOpen ? <X /> : <Settings />}
          </button>
        </div>

        {isOpen ? (
          <>
            <div className="ot-drawer__account">
              <img className="ot-drawer__avatar" src={portrait} alt="Your profile" />
              <div className="ot-drawer__account-copy">
                <strong>You</strong>
                <span>@you</span>
              </div>
              <button className="ot-drawer__profile" type="button" onClick={() => choose("Your profile")}>
                Profile
              </button>
            </div>

            <p className="ot-drawer__section-label">Your Old Time</p>
            <nav className="ot-drawer__nav" aria-label="Main destinations">
              {destinations.map(({ name, icon: Icon, detail }) => (
                <button
                  type="button"
                  key={name}
                  className={active === name ? "is-active" : ""}
                  onClick={() => choose(name)}
                  aria-current={active === name ? "page" : undefined}
                >
                  <Icon aria-hidden="true" />
                  <span>{name}</span>
                  {detail && <small>{detail}</small>}
                  {active === name && <Check aria-hidden="true" style={{ width: 15, height: 15 }} />}
                </button>
              ))}
            </nav>

            <p className="ot-drawer__section-label">Quick controls</p>
            <div className="ot-drawer__quick">
              <div className="ot-drawer__quick-row">
                <span><Shield size={15} style={{ verticalAlign: "-3px", marginRight: 7, color: "#ad873c" }} />Private account</span>
                <button type="button" onClick={() => setPrivateAccount(!privateAccount)} aria-pressed={privateAccount}>
                  {privateAccount ? "On" : "Off"} <ChevronRight size={13} />
                </button>
              </div>
              <div className="ot-drawer__quick-row">
                <span><Bell size={15} style={{ verticalAlign: "-3px", marginRight: 7, color: "#ad873c" }} />Notifications</span>
                <button type="button" onClick={() => setNotifications(!notifications)} aria-pressed={notifications}>
                  {notifications ? "On" : "Off"} <ChevronRight size={13} />
                </button>
              </div>
              <div className="ot-drawer__quick-row">
                <span><Heart size={15} style={{ verticalAlign: "-3px", marginRight: 7, color: "#ad873c" }} />Close Friends</span>
                <button type="button" onClick={() => setNotice("Close Friends is ready to manage in Settings")}>
                  0 people <ChevronRight size={13} />
                </button>
              </div>
            </div>

            <p className="ot-drawer__section-label">Account</p>
            <nav className="ot-drawer__nav" aria-label="Account options">
              <button type="button" onClick={() => setNotice("Settings page selected")}>
                <Settings aria-hidden="true" /><span>Settings</span><ChevronRight aria-hidden="true" style={{ width: 15, height: 15 }} />
              </button>
              <button type="button" onClick={() => setNotice("Privacy controls are in Settings")}>
                <LockKeyhole aria-hidden="true" /><span>Privacy</span><ChevronRight aria-hidden="true" style={{ width: 15, height: 15 }} />
              </button>
              <button type="button" onClick={() => setNotice("Help & report is in Settings")}>
                <CircleHelp aria-hidden="true" /><span>Help & report</span><ChevronRight aria-hidden="true" style={{ width: 15, height: 15 }} />
              </button>
            </nav>

            <div className="ot-drawer__footer">
              <button type="button" onClick={() => setNotice("You’re signed in as @you")}>Log out · @you</button>
              <p className="ot-drawer__version">Old Time · A little closer, every day</p>
            </div>
          </>
        ) : (
          <div className="ot-settings__empty" style={{ display: "grid", flex: 1, alignContent: "center", justifyItems: "center", gap: 10, padding: 24, textAlign: "center" }}>
            <DoorOpen size={30} color="#a88437" />
            <strong>Navigation drawer closed</strong>
            <span className="ot-note">Open it again to reach your places and account options.</span>
            <button className="ot-settings__inline-action" type="button" onClick={() => setIsOpen(true)}>Open drawer</button>
          </div>
        )}
        {notice && <p className="ot-status" role="status">{notice}</p>}
      </section>
    </main>
  );
}
