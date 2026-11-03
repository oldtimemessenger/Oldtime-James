import { useState, type ReactElement } from "react";
import "./_group.css";

const rows = [
  ["board", "Get On Board", "Join a prompt"],
  ["story", "Story", "Disappears in 24 hours"],
  ["quote", "Quotes", "Write something"],
  ["challenge", "Challenges", "Sports challenges"],
  ["event", "Events", "Plan an event with your community"],
  ["blast", "Community post", "Write a post"],
  ["video", "Video note", "Record a video note"],
  ["photo", "Photo or camera", "Post to your feed"],
] as const;

const iconPaths: Record<string, ReactElement> = {
  board: <><path d="M5 12h14M12 5l7 7-7 7" /></>,
  story: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  quote: <><path d="M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z" /><path d="M13.5 6.5l4 4" /></>,
  challenge: <><path d="M5 21V4" /><path d="M5 5c5-4 9 4 14 0v9c-5 4-9-4-14 0" /></>,
  event: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  blast: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></>,
  video: <><path d="M3 8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="m16 10 5-3v10l-5-3z" /></>,
  photo: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
};

export function Current() {
  const [selected, setSelected] = useState("");
  return (
    <div className="create-current-root">
      <div className="ch-underlay-label">Oldtime home</div>
      <div className="ch-back">
        <section className="ch-sheet" role="dialog" aria-modal="true" aria-label="Create">
          <h2>Create</h2>
          {rows.map(([id, label, description]) => (
            <button
              type="button"
              className="ch-row"
              data-ch={id}
              data-testid={`current-create-${id}`}
              key={id}
              onClick={() => setSelected(label)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {iconPaths[id]}
              </svg>
              <span className="ch-row-label">{label}<small>{description}</small></span>
            </button>
          ))}
          {selected && <p role="status" style={{ padding: "0 12px", color: "#6a6660", fontSize: 12 }}>{selected}</p>}
        </section>
      </div>
    </div>
  );
}
