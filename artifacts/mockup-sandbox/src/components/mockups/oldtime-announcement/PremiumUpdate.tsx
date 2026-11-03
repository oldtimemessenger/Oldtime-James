import "./_group.css";

export default function PremiumUpdate() {
  return (
    <main className="oa-preview">
      <p className="oa-preview-label">Community · For you · single update card</p>
      <article className="oa-premium-card">
        <div className="oa-hero">
          <img
            src="/__mockup/images/oldtime-community-update.jpg"
            alt=""
            aria-hidden="true"
          />
          <span className="oa-hero-label">OFFICIAL OLDTIME UPDATE</span>
          <button className="oa-dismiss" type="button" aria-label="Dismiss update">×</button>
        </div>
        <div className="oa-premium-copy">
          <div className="oa-meta-row">
            <span className="oa-category-icon" data-category="community" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3" />
                <path d="M3 21v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V21" />
              </svg>
            </span>
            <p className="oa-meta">Community · Oldtime</p>
          </div>
          <h2>Make yourself at home</h2>
          <p>Share your moments and find your community. Ordinary posting stays free.</p>
          <div className="oa-premium-footer">
            <span className="oa-brand-mark">OLDTIME</span>
            <button className="oa-cta" type="button">Explore Oldtime</button>
          </div>
        </div>
      </article>
      <p className="oa-spacing-note">One campaign at a time, after four real Community posts. It stays in the feed until the person dismisses it.</p>
    </main>
  );
}
