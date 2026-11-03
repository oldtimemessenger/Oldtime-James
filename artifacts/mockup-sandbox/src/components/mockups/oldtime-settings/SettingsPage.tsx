import { useState } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Eye,
  Heart,
  Info,
  LockKeyhole,
  MessageCircle,
  RotateCcw,
  Shield,
  UserRound,
} from "lucide-react";
import "./_group.css";
import "./_settings.css";
import portrait from "./profile-portrait.jpg";

type ConfirmAction = "reset" | "logout" | null;

const friendOptions = ["Nova Hale", "June Park", "Kev May", "Mara Cole"];
const blockedOptions = ["@orio"];

function Toggle({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="ot-settings__switch"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
    />
  );
}

export function SettingsPage() {
  const [privateAccount, setPrivateAccount] = useState(false);
  const [showCity, setShowCity] = useState(true);
  const [showInterests, setShowInterests] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState("Everyone");
  const [notifications, setNotifications] = useState(true);
  const [closeFriends, setCloseFriends] = useState<string[]>([]);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState("");
  const [blocked, setBlocked] = useState(blockedOptions);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [notice, setNotice] = useState("");

  const toggleCloseFriend = (name: string) => {
    setCloseFriends((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  };

  const savePassword = () => {
    if (password.length < 6) {
      setNotice("Use at least 6 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setNotice("Those passwords don’t match yet.");
      return;
    }
    setPasswordOpen(false);
    setPassword("");
    setConfirmPassword("");
    setNotice("Password updated in this preview.");
  };

  const saveReport = () => {
    if (!report.trim()) {
      setNotice("Add a short description before saving your report.");
      return;
    }
    setReport("");
    setReportOpen(false);
    setNotice("Report saved on this device.");
  };

  return (
    <main className="ot-shell">
      <section className="ot-screen ot-settings" aria-label="Settings">
        <header className="ot-screen__header">
          <button
            className="ot-screen__icon-button"
            type="button"
            aria-label="Back"
            onClick={() => setNotice("Back to your profile")}
          >
            <ChevronLeft />
          </button>
          <h1>Settings</h1>
          <span />
        </header>

        <div className="ot-screen__content">
          <div className="ot-settings__intro">
            <img className="ot-settings__avatar" src={portrait} alt="" />
            <div className="ot-settings__intro-copy">
              <strong>You</strong>
              <span>@you</span>
            </div>
            <button className="ot-settings__edit-link" type="button" onClick={() => setNotice("Edit profile opened in its own page.")}>
              Edit profile <ChevronRight />
            </button>
          </div>

          {notice && <p className="ot-status" role="status">{notice}</p>}

          <section className="ot-settings__group" aria-labelledby="account-heading">
            <h2 className="ot-settings__group-title" id="account-heading"><UserRound />Account</h2>
            <div className="ot-settings__card">
              <div className="ot-settings__row">
                <span className="ot-settings__row-icon"><LockKeyhole /></span>
                <span className="ot-settings__row-copy">
                  <strong>Password</strong>
                  <small>Change the password for your account</small>
                </span>
                <button className="ot-settings__inline-action" type="button" style={{ marginTop: 0 }} onClick={() => setPasswordOpen(!passwordOpen)}>
                  {passwordOpen ? "Close" : "Change"}
                </button>
              </div>
              {passwordOpen && (
                <div className="ot-settings__form">
                  <div className="ot-settings__password-fields">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="New password"
                      aria-label="New password"
                    />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Confirm new password"
                      aria-label="Confirm new password"
                    />
                  </div>
                  <button type="button" onClick={savePassword}>Save password</button>
                </div>
              )}
            </div>
          </section>

          <section className="ot-settings__group" aria-labelledby="privacy-heading">
            <h2 className="ot-settings__group-title" id="privacy-heading"><Shield />Privacy</h2>
            <div className="ot-settings__card">
              <div className="ot-settings__row">
                <span className="ot-settings__row-icon"><LockKeyhole /></span>
                <span className="ot-settings__row-copy">
                  <strong>Private account</strong>
                  <small>Only approved followers can see your account</small>
                </span>
                <Toggle checked={privateAccount} label="Private account" onClick={() => setPrivateAccount(!privateAccount)} />
              </div>
              <div className="ot-settings__row">
                <span className="ot-settings__row-icon"><Eye /></span>
                <span className="ot-settings__row-copy">
                  <strong>Show city on profile</strong>
                  <small>Your exact location is never shared</small>
                </span>
                <Toggle checked={showCity} label="Show city on profile" onClick={() => setShowCity(!showCity)} />
              </div>
              <div className="ot-settings__row">
                <span className="ot-settings__row-icon"><Heart /></span>
                <span className="ot-settings__row-copy">
                  <strong>Show interests on profile</strong>
                  <small>Let people find things in common</small>
                </span>
                <Toggle checked={showInterests} label="Show interests on profile" onClick={() => setShowInterests(!showInterests)} />
              </div>
            </div>
          </section>

          <section className="ot-settings__group" aria-labelledby="friends-heading">
            <h2 className="ot-settings__group-title" id="friends-heading"><Heart />Close Friends</h2>
            <div className="ot-settings__card">
              <div className="ot-settings__row">
                <span className="ot-settings__row-copy">
                  <strong>Your private list</strong>
                  <small>Stories shared with Close Friends are limited to this list</small>
                </span>
                <span className="ot-settings__close-count" aria-label={`${closeFriends.length} added`}>{closeFriends.length}</span>
              </div>
              <div className="ot-settings__friends">
                {friendOptions.map((name) => {
                  const selected = closeFriends.includes(name);
                  return (
                    <div className="ot-settings__friend" key={name}>
                      <span className="ot-settings__friend-initial" aria-hidden="true">{name.charAt(0)}</span>
                      <span className="ot-settings__friend-name">{name}</span>
                      <button type="button" onClick={() => toggleCloseFriend(name)} aria-pressed={selected}>
                        {selected ? "Added" : "Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="ot-settings__group" aria-labelledby="chat-heading">
            <h2 className="ot-settings__group-title" id="chat-heading"><MessageCircle />Chat privacy</h2>
            <div className="ot-settings__card">
              <div className="ot-settings__row">
                <span className="ot-settings__row-copy">
                  <strong>Read receipts</strong>
                  <small>Let people know when you’ve read their messages</small>
                </span>
                <Toggle checked={readReceipts} label="Read receipts" onClick={() => setReadReceipts(!readReceipts)} />
              </div>
              <div className="ot-settings__row" style={{ borderBottom: 0 }}>
                <span className="ot-settings__row-copy">
                  <strong>Last seen</strong>
                  <small>Who can see when you were last active</small>
                </span>
                <span style={{ color: "#806329", fontSize: 10, fontWeight: 800 }}>{lastSeen}</span>
              </div>
              <div className="ot-settings__segmented" role="group" aria-label="Last seen audience">
                {["Everyone", "Contacts", "Nobody"].map((choice) => (
                  <button
                    type="button"
                    key={choice}
                    className={lastSeen === choice ? "is-selected" : ""}
                    aria-pressed={lastSeen === choice}
                    onClick={() => setLastSeen(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="ot-settings__group" aria-labelledby="notifications-heading">
            <h2 className="ot-settings__group-title" id="notifications-heading"><Bell />Notifications</h2>
            <div className="ot-settings__card">
              <div className="ot-settings__row">
                <span className="ot-settings__row-copy">
                  <strong>Notifications</strong>
                  <small>Updates about messages and activity</small>
                </span>
                <Toggle checked={notifications} label="Notifications" onClick={() => setNotifications(!notifications)} />
              </div>
            </div>
          </section>

          <section className="ot-settings__group" aria-labelledby="safety-heading">
            <h2 className="ot-settings__group-title" id="safety-heading"><Shield />Safety</h2>
            <div className="ot-settings__card">
              <button className="ot-settings__action" type="button" onClick={() => setNotice(blocked.length ? "Manage blocked accounts below." : "There are no blocked accounts.")}>
                <span className="ot-settings__row-icon"><LockKeyhole /></span>
                <span className="ot-settings__action-copy">Blocked users</span>
                <span className="ot-settings__close-count">{blocked.length}</span>
                <ChevronRight className="ot-settings__chevron" />
              </button>
              {blocked.length > 0 ? (
                <div className="ot-settings__blocked">
                  {blocked.map((user) => (
                    <div className="ot-settings__blocked-row" key={user}>
                      <span>{user}</span>
                      <button className="ot-settings__unblock" type="button" onClick={() => { setBlocked((current) => current.filter((item) => item !== user)); setNotice(`${user} unblocked.`); }}>Unblock</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ot-settings__blocked">No blocked users.</div>
              )}
            </div>
          </section>

          <section className="ot-settings__group" aria-labelledby="help-heading">
            <h2 className="ot-settings__group-title" id="help-heading"><CircleHelp />Help</h2>
            <div className="ot-settings__card">
              <button className="ot-settings__action" type="button" onClick={() => setReportOpen(!reportOpen)}>
                <span className="ot-settings__row-icon"><CircleHelp /></span>
                <span className="ot-settings__action-copy">Help & report a problem</span>
                <ChevronRight className="ot-settings__chevron" />
              </button>
              {reportOpen && (
                <div className="ot-settings__form">
                  <textarea value={report} onChange={(event) => setReport(event.target.value)} placeholder="Describe the problem" aria-label="Describe the problem" />
                  <button type="button" onClick={saveReport}>Save on this device</button>
                </div>
              )}
            </div>
          </section>

          <section className="ot-settings__group" aria-labelledby="about-heading">
            <h2 className="ot-settings__group-title" id="about-heading"><Info />About</h2>
            <div className="ot-settings__card">
              <div className="ot-settings__about">
                Old Time is a social feed and chat app. Your account, posts, and chats are stored in this browser.
              </div>
            </div>
          </section>

          <div className="ot-settings__foot-actions">
            <button type="button" onClick={() => setConfirmAction("reset")}><RotateCcw size={14} style={{ verticalAlign: "-3px", marginRight: 6 }} />Reset app data</button>
            <button type="button" onClick={() => setConfirmAction("logout")}>Log out · @you</button>
          </div>

          {confirmAction && (
            <div className="ot-settings__overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmAction(null); }}>
              <div className="ot-settings__confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
                <h3 id="confirm-title">{confirmAction === "reset" ? "Reset app data?" : "Log out?"}</h3>
                <p>{confirmAction === "reset" ? "This restores the app’s local demo data on this device." : "You’ll be signed out of this device."}</p>
                <div className="ot-settings__confirm-actions">
                  <button type="button" onClick={() => setConfirmAction(null)}>Cancel</button>
                  <button
                    type="button"
                    onClick={() => {
                      const completed = confirmAction;
                      setConfirmAction(null);
                      setNotice(completed === "reset" ? "App data reset in this preview." : "Logged out in this preview.");
                    }}
                  >
                    {confirmAction === "reset" ? "Reset data" : "Log out"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
