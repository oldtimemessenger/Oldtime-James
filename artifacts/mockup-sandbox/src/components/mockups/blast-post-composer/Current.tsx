import { useState, type FormEvent } from "react";
import "./_group.css";

type PostType = "post" | "question" | "activity" | "event";
type Audience = "public" | "friends" | "group" | "only-me";

const types: { id: PostType; label: string; icon: string }[] = [
  { id: "post", label: "Post", icon: "M16 4 20 8 8 20 3 21 4 16z M14 6l4 4" },
  { id: "question", label: "Question", icon: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 5 M12 18h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { id: "activity", label: "Activity", icon: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" },
  { id: "event", label: "Event", icon: "M8 3v4m8-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1z" },
];
const audiences: { id: Audience; label: string }[] = [
  { id: "public", label: "Public" },
  { id: "friends", label: "Blast Friends" },
  { id: "group", label: "Group conversation" },
  { id: "only-me", label: "Only me" },
];

function Icon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

export function Current() {
  const [type, setType] = useState<PostType>("post");
  const [audience, setAudience] = useState<Audience>("public");
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setMessage("Blast shared with your selected audience.");
  }

  return (
    <main className="bpc-current-screen">
      <div className="bpc-current-wrap">
        <header className="bpc-current-header">
          <button className="bpc-current-round" type="button" aria-label="Back to Blast">
            <Icon path="m12 5-7 7 7 7M5 12h15" />
          </button>
          <h1>{type === "event" ? "Plan an event" : "Write a Blast"}</h1>
          <button className="bpc-current-round" type="button" aria-label="Blast timeline">
            <Icon path="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
          </button>
        </header>
        <p className="bpc-current-hint">
          Pick the audience that feels right. Friends here are separate from follows.
        </p>

        <form className="bpc-current-form" onSubmit={submit}>
          <fieldset className="bpc-current-field">
            <legend>Choose a format</legend>
            <div className="bpc-current-type-grid">
              {types.map((item) => (
                <button
                  key={item.id}
                  className={`bpc-current-type ${type === item.id ? "is-active" : ""}`}
                  type="button"
                  aria-pressed={type === item.id}
                  onClick={() => {
                    setType(item.id);
                    setMessage("");
                  }}
                >
                  <Icon path={item.icon} size={17} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="bpc-current-field">
            <span>{type === "event" ? "Event title" : "Title (optional)"}</span>
            <input
              name="title"
              maxLength={90}
              placeholder={type === "event" ? "Give the plan a name" : "Add a heading"}
              required={type === "event"}
            />
          </label>
          <label className="bpc-current-field">
            <span>{type === "question" ? "Ask your neighborhood" : type === "event" ? "Details (optional)" : "Your thought"}</span>
            <textarea
              name="body"
              maxLength={1000}
              placeholder={type === "question" ? "What would you like to know?" : "Share the details…"}
              required={type !== "event"}
            />
            <small>Up to 1,000 characters.</small>
          </label>

          {type === "activity" && (
            <label className="bpc-current-field">
              <span>Activity goal (optional)</span>
              <input name="activityGoal" maxLength={100} placeholder="A goal to work toward" />
            </label>
          )}

          {type === "event" && (
            <section className="bpc-current-event">
              <span className="bpc-current-eyebrow">Event details</span>
              <label className="bpc-current-field">
                <span>What are we doing?</span>
                <select defaultValue="meetup" name="eventKind">
                  <option value="watch-party">Watch party</option>
                  <option value="meetup">Meetup</option>
                  <option value="fitness-challenge">Fitness challenge</option>
                </select>
              </label>
              <div className="bpc-current-inline">
                <label className="bpc-current-field">
                  <span>Starts</span>
                  <input name="startsAt" type="datetime-local" required />
                </label>
                <label className="bpc-current-field">
                  <span>Duration, minutes</span>
                  <input name="durationMinutes" type="number" min={15} max={1440} defaultValue={60} required />
                </label>
              </div>
              <label className="bpc-current-check">
                <input name="online" type="checkbox" /> This event is online
              </label>
              <label className="bpc-current-field">
                <span>Venue or meeting place</span>
                <input name="eventLocation" maxLength={120} placeholder="Enter a venue manually" />
                <small>Location is entered by you. Blast does not request device location.</small>
              </label>
            </section>
          )}

          <fieldset className="bpc-current-field">
            <legend>Who can see this?</legend>
            <div className="bpc-current-audience-grid">
              {audiences.map((item) => (
                <button
                  key={item.id}
                  className={audience === item.id ? "is-active" : ""}
                  type="button"
                  aria-pressed={audience === item.id}
                  onClick={() => setAudience(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          {audience === "group" && (
            <label className="bpc-current-field">
              <span>Group conversation</span>
              <select required defaultValue="">
                <option value="" disabled>Choose a group</option>
                <option value="weekend-walkers">Weekend Walkers · 8 members</option>
              </select>
            </label>
          )}

          <label className="bpc-current-field">
            <span>Place (optional)</span>
            <input name="location" maxLength={120} placeholder="Add a place manually" />
          </label>
          <label className="bpc-current-field">
            <span>Image or video (optional)</span>
            <input
              name="media"
              type="file"
              accept="image/*,video/*"
              onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
            />
            <small>Files must be 2 MB or smaller. Choose media before sharing.</small>
            {fileName && <small>Attached: {fileName}</small>}
          </label>
          <div className="bpc-current-actions">
            <button className="bpc-current-primary" type="submit">
              {type === "event" ? "Create event" : "Share Blast"}
            </button>
            <button
              className="bpc-current-secondary"
              type="button"
              onClick={() => {
                setType("post");
                setAudience("public");
                setFileName("");
                setMessage("Draft cancelled.");
              }}
            >
              Cancel
            </button>
          </div>
          {message && <p className="bpc-current-message" role="status">{message}</p>}
        </form>
      </div>

      <nav className="bpc-current-nav" aria-label="Primary navigation">
        <button type="button"><span>⌂</span>Home</button>
        <button type="button" className="is-active"><span>✦</span>Blast</button>
        <button type="button"><span>♧</span>Communities</button>
        <button type="button"><span>▤</span>Messages</button>
        <button type="button"><span>◉</span>Profile</button>
      </nav>
    </main>
  );
}
