import "./_group.css";

const currentCampaigns = [
  {
    eyebrow: "Official Oldtime update",
    category: "WELCOME",
    title: "Make yourself at home",
    description: "Share your moments and find your community. Ordinary posting stays free.",
    action: "Explore Oldtime",
    icon: "⌂",
  },
  {
    eyebrow: "Official Oldtime update",
    category: "CREATOR",
    title: "Your creator journey",
    description: "See how your original posts and community participation contribute to creator eligibility.",
    action: "Open Creator Center",
    icon: "▣",
  },
];

export default function CurrentBaseline() {
  return (
    <main className="oa-preview">
      <p className="oa-preview-label">Current layout · two update cards in a row</p>
      <div className="oa-current-stack">
        {currentCampaigns.map((campaign) => (
          <article className="oa-current-card" key={campaign.title}>
            <div className="oa-current-art">
              <div className="oa-current-brand">OLDTIME <span>{campaign.category} UPDATE</span></div>
              <div className="oa-current-panels" aria-hidden="true">
                <span>⌂</span><span>♧</span><span>{campaign.icon}</span>
              </div>
            </div>
            <div className="oa-current-copy">
              <div className="oa-current-top">
                <small>{campaign.eyebrow}</small>
                <span className="oa-current-close" aria-hidden="true">×</span>
              </div>
              <h2>{campaign.title}</h2>
              <p>{campaign.description}</p>
              <span className="oa-current-cta">{campaign.action}</span>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
