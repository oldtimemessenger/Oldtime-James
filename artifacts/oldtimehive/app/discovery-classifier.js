import { TOPICS, classifyDiscovery } from "../../../lib/discovery-engine/index.js";

const order = ["relationship-humor","dating-humor","nba","humor","relationships","dating",
  "food","travel","fashion","beauty","music"];

// Preserve the familiar chip order, but never duplicate the server's vocabulary.
const CATEGORY_RULES = [...TOPICS].sort((a,b) =>
  (order.includes(a.id) ? order.indexOf(a.id) : 100) - (order.includes(b.id) ? order.indexOf(b.id) : 100));

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[#@]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function postText(post) {
  const placeLabel = post?.place?.label || post?.place?.name || "";
  return normalize([
    post?.caption,
    post?.text,
    post?.sound,
    post?.location,
    placeLabel,
    ...(Array.isArray(post?.tags) ? post.tags : []),
  ].join(" "));
}

function hasTerm(text, terms) {
  return terms.some(term => (` ${text} `).includes(` ${normalize(term)} `));
}

export function discoveryPostCategoryIds(post) {
  const categories = new Set(classifyDiscovery(post).map(category => category.id));
  return CATEGORY_RULES.filter(category => categories.has(category.id)).map(category => category.id);
}

export function searchTextForDiscoveryPost(post) {
  return postText(post);
}

export function matchesDiscoveryPost(post, { category = "", query = "" } = {}) {
  const normalizedQuery = normalize(query);
  return (!category || discoveryPostCategoryIds(post).includes(category)) &&
    (!normalizedQuery || (` ${postText(post)} `).includes(` ${normalizedQuery} `) ||
      postText(post).includes(normalizedQuery));
}

export function availableDiscoveryPostCategories(posts) {
  const available = new Set();
  for (const post of posts || []) {
    for (const id of discoveryPostCategoryIds(post)) available.add(id);
  }
  return CATEGORY_RULES.filter(category => available.has(category.id));
}
