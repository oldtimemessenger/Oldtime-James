import { discoveryFtsQuery, normalizeDiscovery } from "../../../../lib/discovery-engine/index.js";
import { TOPICS } from "./discovery-index";
import { object, type Database } from "./runtime";

const interestTopics: Record<string, string[]> = {
  sports: ["nba", "fitness"],
  photography: ["photography"],
  music: ["music"],
  comedy: ["humor", "relationship-humor", "dating-humor"],
  food: ["food"],
  travel: ["travel"],
  fitness: ["fitness"],
  news: [],
  art: ["art"],
  gaming: ["gaming"],
  fashion: ["fashion", "beauty"],
  technology: ["tech"],
};

const interestTerms: Record<string, string[]> = {
  sports: ["sports", "basketball", "nba", "football", "soccer", "baseball", "tennis", "hockey", "wnba"],
  photography: ["photography", "photographer", "photoshoot", "photo"],
  music: ["music", "song", "singing", "singer", "concert", "guitar", "rap"],
  comedy: ["comedy", "funny", "joke", "laugh", "meme", "skit"],
  food: ["food", "recipe", "cooking", "restaurant", "baking"],
  travel: ["travel", "vacation", "trip", "airport", "hotel"],
  fitness: ["fitness", "gym", "workout", "yoga", "exercise"],
  news: ["news", "headline", "headlines", "current events", "breaking news", "world news"],
  art: ["art", "painting", "drawing", "artwork", "illustration"],
  gaming: ["gaming", "gamer", "gameplay", "playstation", "xbox", "nintendo"],
  fashion: ["fashion", "outfit", "streetwear", "sneakers", "makeup", "beauty", "style"],
  technology: ["technology", "tech", "coding", "software", "programming", "cybersecurity"],
};

function interestKey(value: string) {
  return normalizeDiscovery(value).replaceAll(" ", "");
}

export async function selectedInterests(db: Database, userId: string, personalize = true): Promise<string[]> {
  if (!personalize) return [];
  const saved = await db.prepare("SELECT data FROM account_state WHERE user_id=?")
    .bind(userId).first<{ data: string }>();
  const state = object(saved?.data);
  const preferences = object(state.interestPreferences);
  if (preferences.enabled === false) return [];
  const selected = Array.isArray(preferences.selected)
    ? preferences.selected
    : object(state.profile).interests;
  return [...new Set((Array.isArray(selected) ? selected : [])
    .filter((value): value is string => typeof value === "string")
    .map(value => value.trim())
    .filter(Boolean))].slice(0, 24);
}

export function interestTopicIds(interests: readonly string[], hiddenTopics: readonly string[] = []) {
  const hidden = new Set(hiddenTopics);
  const topics = new Set<string>();
  for (const interest of interests) {
    const key = interestKey(interest);
    const mapped = interestTopics[key];
    for (const id of mapped ?? []) if (!hidden.has(id)) topics.add(id);
    for (const topic of TOPICS) {
      if (key === interestKey(topic.id) || key === interestKey(topic.label)) {
        if (!hidden.has(topic.id)) topics.add(topic.id);
      }
    }
  }
  return [...topics];
}

export function interestFtsQuery(interests: readonly string[]) {
  const terms = new Set<string>();
  for (const interest of interests) {
    const key = interestKey(interest);
    for (const term of interestTerms[key] ?? [interest]) terms.add(term);
  }
  const queries = [...terms].map(term => discoveryFtsQuery(term)).filter(Boolean).slice(0, 48);
  return queries.length ? queries.map(query => `(${query})`).join(" OR ") : "";
}

export function topicMatchesInterests(topic: string, interests: readonly string[]) {
  const normalizedTopic = normalizeDiscovery(topic.replace(/^#/, ""));
  if (!normalizedTopic) return false;
  return interests.some(interest => {
    const key = interestKey(interest);
    const related = [
      ...(interestTerms[key] ?? [interest]),
      ...(interestTopics[key] ?? []),
      TOPICS.find(candidate => interestKey(candidate.id) === key || interestKey(candidate.label) === key)?.label ?? "",
    ];
    return related.some(term => {
      const normalizedTerm = normalizeDiscovery(term);
      return normalizedTerm && (normalizedTopic === normalizedTerm ||
        normalizedTopic.split(" ").includes(normalizedTerm) ||
        normalizedTerm.split(" ").includes(normalizedTopic));
    });
  });
}
