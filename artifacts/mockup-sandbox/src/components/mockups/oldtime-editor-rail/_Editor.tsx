import { useState } from "react";

export type Tool = {
  id: string;
  label: string;
  icon: keyof typeof paths;
};

const paths = {
  text: <path d="M4 7h16M4 12h10M4 17h14" />,
  frames: <><rect x="3" y="6" width="14" height="13" rx="3" /><path d="M8 3h10a3 3 0 013 3v10" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  draw: <><path d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-1.5" /><path d="M4 20h4" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="3.5" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5" /></>,
  removeBg: <><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  color: <><circle cx="9" cy="9" r="5.5" /><circle cx="15" cy="9" r="5.5" /><circle cx="12" cy="15" r="5.5" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></>,
} as const;

export const tools: Tool[] = [
  { id: "text", label: "Text", icon: "text" },
  { id: "templates", label: "Styles", icon: "frames" },
  { id: "sound", label: "Sound", icon: "music" },
  { id: "draw", label: "Draw", icon: "draw" },
  { id: "overlay", label: "Overlay", icon: "image" },
  { id: "remove-bg", label: "Remove BG", icon: "removeBg" },
  { id: "adjust", label: "Adjust", icon: "sliders" },
  { id: "canvas-color", label: "Canvas", icon: "color" },
];

function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg className="ot-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function Editor({ compact }: { compact: boolean }) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [soundTab, setSoundTab] = useState<"discover" | "saved">("discover");
  const soundOpen = activeTool === "sound";

  return (
    <main className="oldtime-editor-root">
      <div className="ot-frame">
        <section className="ot-editor" aria-label="Oldtime Create editor">
          <div className="ot-stage" role="img" aria-label="Neutral media placeholder">
            <div className="ot-stage-caption">Media preview · 9:16</div>
          </div>
          <header className="ot-header">
            <span className="ot-brand">Oldtime</span>
            <span className="ot-step">CREATE&nbsp; / &nbsp;EDIT</span>
          </header>
          <nav className={`ot-toolbar ${compact ? "compact" : "current"}`} aria-label="Editing tools">
            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className={`ot-tool ${tool.id === "sound" ? "sound" : ""}`}
                aria-label={tool.id === "sound" ? "Choose sound" : tool.label}
                aria-pressed={activeTool === tool.id}
                aria-expanded={tool.id === "sound" ? soundOpen : undefined}
                onClick={() => setActiveTool((current) => current === tool.id ? null : tool.id)}
              >
                <Icon name={tool.icon} />
                <span>{tool.id === "sound" ? "Sound" : tool.label}</span>
              </button>
            ))}
          </nav>
          {soundOpen && (
            <section className="ot-sound-panel" role="dialog" aria-labelledby="ot-sound-heading">
              <header className="ot-sound-head">
                <div>
                  <span className="ot-eyebrow">Source-linked audio</span>
                  <h2 id="ot-sound-heading">Add sound</h2>
                </div>
                <button className="ot-close" type="button" aria-label="Close sound picker" onClick={() => setActiveTool(null)}>
                  <Icon name="close" />
                </button>
              </header>
              <div className="ot-sound-tabs" role="tablist" aria-label="Creator sound lists">
                <button type="button" role="tab" aria-selected={soundTab === "discover"} onClick={() => setSoundTab("discover")}>
                  {compact ? "Trending" : "Discover"}
                </button>
                <button type="button" role="tab" aria-selected={soundTab === "saved"} onClick={() => setSoundTab("saved")}>Saved</button>
              </div>
              <p className="ot-source-note">
                {soundTab === "discover"
                  ? compact
                    ? "Trending audio is surfaced from creator posts. The original creator stays credited when you use a sound."
                    : "Trending audio comes from creator posts. Original creator attribution stays attached when you use a sound."
                  : "Your saved creator sounds are private to you."}
              </p>
              <div className="ot-sound-empty" role="status">
                <p>
                  {soundTab === "discover"
                    ? compact
                      ? "No trending creator sounds are available right now."
                      : "No reusable creator sounds are available right now."
                    : "Saved creator sounds will appear here."}
                </p>
              </div>
              {soundTab === "saved" && (
                <div className="ot-saved-private">
                  <Icon name="lock" />
                  <span>{compact ? "Private to the signed-in user" : "Only you can see your saved sounds"}</span>
                </div>
              )}
            </section>
          )}
          <div className="ot-footer" aria-hidden="true">
            <span className="ot-footer-mark" />
            <span>PRIVATE UNTIL SHARED</span>
          </div>
        </section>
      </div>
    </main>
  );
}
