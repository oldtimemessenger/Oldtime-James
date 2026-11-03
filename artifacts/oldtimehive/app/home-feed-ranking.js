function normalize(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function rankHomeRecommendations(posts, interests = [], interestTerms = {}) {
  const selectedTerms = [...new Set(interests.flatMap(interest => interestTerms[interest] || [interest])
    .map(normalize).filter(Boolean))];
  if (!selectedTerms.length) return [...posts];

  const ranked = posts.map((post, index) => {
    const content = ` ${normalize([post.caption, post.text, post.sound, ...(post.tags || [])].join(" "))} `;
    const hits = selectedTerms.reduce((count, term) => count + Number(content.includes(` ${term} `)), 0);
    return { post, index, hits };
  });
  const ordered = [];
  const remaining = [...ranked];
  const lastAuthors = [];
  while (remaining.length) {
    let bestIndex = remaining.findIndex(candidate =>
      candidate.hits > 0 && (!candidate.post.author || lastAuthors.filter(id => id === candidate.post.author).length < 1));
    if (bestIndex < 0) bestIndex = remaining.findIndex(candidate =>
      !candidate.post.author || lastAuthors.filter(id => id === candidate.post.author).length < 2);
    if (bestIndex < 0) bestIndex = 0;
    const [chosen] = remaining.splice(bestIndex, 1);
    ordered.push(chosen.post);
    if (chosen.post.author) {
      lastAuthors.push(chosen.post.author);
      if (lastAuthors.length > 5) lastAuthors.shift();
    }
  }
  return ordered;
}
