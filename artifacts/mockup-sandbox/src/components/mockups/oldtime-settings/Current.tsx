import "./_group.css";

const avatar =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=180&q=80";
const cover =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80";

export function Current() {
  return (
    <main className="ot-current">
      <div className="ot-current__profile">
        <div className="ot-current__cover" />
        <header className="ot-current__topbar">
          <span aria-hidden="true">‹</span>
          <b>you</b>
          <span aria-hidden="true">⋯</span>
        </header>
        <section className="ot-current__identity">
          <img src={avatar} alt="" />
          <div>
            <b>You</b>
            <small>@you</small>
          </div>
        </section>
        <div className="ot-current__stats">0 plays · 1 follower · 1 following</div>
        <p className="ot-current__bio">New on Old Time.</p>
        <div className="ot-current__actions">
          <span>Edit</span>
          <span>Log out</span>
        </div>
      </div>

      <div className="ot-current__scrim" />
      <section className="ot-current__sheet" aria-label="Current edit profile sheet">
        <div className="ot-current__panel">
          <div className="ot-current__grab" />
          <b className="ot-current__title">Edit profile</b>
          <input value="You" readOnly aria-label="Name" />
          <input value="you" readOnly aria-label="Username" />
          <input value="you@oldtime.app" readOnly aria-label="Email" />
          <textarea value="New on Old Time." readOnly aria-label="Bio" />
          <button className="ot-current__emoji" aria-label="Add emoji to bio">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 14.5c.9 1.1 2.1 1.7 3.5 1.7s2.6-.6 3.5-1.7M9 9.5h.01M15 9.5h.01" />
            </svg>
          </button>
          <label>
            Profile photo
            <input type="file" readOnly aria-label="Profile photo" />
          </label>
          <div className="ot-current__cover-label">Profile cover</div>
          <img className="ot-current__cover-preview" src={cover} alt="Current profile cover" />
          <label>
            Upload a custom cover image
            <input type="file" readOnly aria-label="Custom profile cover" />
          </label>
          <small>Without a custom image, your first non-video post with media is the automatic cover.</small>
          <button className="ot-current__auto">Use automatic cover</button>
          <label>
            Birthday
            <input value="1998-04-12" readOnly aria-label="Birthday" />
          </label>
          <input value="Miami" readOnly aria-label="City" />
          <div className="ot-current__interests">
            <b>Interests</b>
            <small>Choose up to 8</small>
            <p>Shared interests help people find something to talk about.</p>
            <div>
              <span>Art</span>
              <span>Food</span>
              <span>Travel</span>
            </div>
          </div>
          <button className="ot-current__save">Save</button>
        </div>
      </section>
    </main>
  );
}
