import "./_group.css";

function FeatherMark() {
  return (
    <svg className="ot-signup-mark" viewBox="0 0 64 84" aria-hidden="true">
      <path d="M51 4C34 16 19 33 8 76c13-11 25-25 35-43 5-9 8-18 8-29Z" fill="#fff" stroke="#8d1a16" strokeWidth="2.5" />
      <path d="M11 72 46 12M16 59l18 1M21 47l18 1M26 35l17 2M32 24l15 2" fill="none" stroke="#8d1a16" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function SignupCurrent() {
  return (
    <main className="ot-preview ot-signup-preview signup-current">
      <FeatherMark />
      <button className="ot-signup-back" type="button" aria-label="Back">‹</button>
      <p className="ot-signup-eyebrow">Join Oldtime</p>
      <h1>What’s your birthday?</h1>
      <p className="ot-signup-lede">Oldtime is for people 16 and older. Your birthday stays private.</p>
      <label className="ot-signup-label">
        Birthday
        <small>Your birthday is private and won’t appear on your public profile.</small>
        <input className="ot-signup-date" type="date" value="1995-10-29" readOnly />
      </label>
      <button className="ot-signup-next" type="button">Next</button>
      <div className="ot-signup-empty-feedback" />
      <div className="ot-signup-empty-feedback" />
      <button className="ot-signup-login" type="button">Log in</button>
    </main>
  );
}
