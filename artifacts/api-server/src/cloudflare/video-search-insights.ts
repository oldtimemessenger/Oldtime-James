import type { Database, Statement } from "./runtime";

const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","but","by","for","from","how","i","in","is","it",
  "of","on","or","our","the","to","was","we","what","when","where","who","why","with","you",
]);

export function normalizeVideoSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/https?:\/\/\S+/gu, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/[’']/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 120);
}

export function videoSearchTerms(value: unknown): string[] {
  const normalized = normalizeVideoSearchText(value);
  const words = normalized.split(" ").filter(word =>
    word.length > 1 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)
  );
  return [...new Set(words)].slice(0, 16);
}

function captionHashtags(caption: string): string[] {
  const matches = caption.match(/#[\p{L}\p{N}_]{2,40}/gu) ?? [];
  return [...new Set(matches.map(tag => normalizeVideoSearchText(tag.slice(1))).filter(Boolean))].slice(0, 20);
}

export function videoSearchIndexStatements(
  db: Database,
  video: { id: string; creatorId: string; caption: string; isPublic: boolean; createdAt: number },
): Statement[] {
  if (!video.isPublic) {
    return [
      db.prepare("DELETE FROM videos WHERE id=?").bind(video.id),
    ];
  }
  const caption = String(video.caption ?? "").slice(0, 1000);
  const hashtags = captionHashtags(caption);
  const terms = videoSearchTerms(caption);
  const tags = JSON.stringify(hashtags);
  const now = video.createdAt;
  const statements: Statement[] = [
    db.prepare(`INSERT INTO videos(id,creator_id,caption,tags,created_at,updated_at)
      VALUES(?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET creator_id=excluded.creator_id,caption=excluded.caption,
        tags=excluded.tags,updated_at=excluded.updated_at`)
      .bind(video.id, video.creatorId, caption, tags, now, now),
    db.prepare("DELETE FROM video_search_index WHERE video_id=? AND source IN ('caption','hashtag')").bind(video.id),
  ];
  for (const term of terms) {
    statements.push(db.prepare(`INSERT INTO video_search_index(keyword,video_id,weight_score,source,updated_at)
      VALUES(?,?,1,'caption',?) ON CONFLICT(keyword,video_id,source) DO NOTHING`).bind(term,video.id,now));
  }
  for (const tag of hashtags) {
    statements.push(db.prepare(`INSERT INTO video_search_index(keyword,video_id,weight_score,source,updated_at)
      VALUES(?,?,1,'hashtag',?) ON CONFLICT(keyword,video_id,source) DO NOTHING`).bind(tag,video.id,now));
  }
  return statements;
}

export async function recordVideoSearchClick(
  db: Database,
  input: { userId: string; videoId: string; queryText: string; watchTime: number; now?: number },
): Promise<{ learned: boolean; keywords: string[] }> {
  const now = input.now ?? Date.now();
  const phrase = normalizeVideoSearchText(input.queryText);
  const terms = videoSearchTerms(phrase);
  if (!phrase || !terms.length || input.watchTime <= 5 || input.watchTime > 3600) {
    return { learned: false, keywords: [] };
  }
  const clickId = crypto.randomUUID();
  const inserted = await db.prepare(`INSERT INTO search_clicks
    (id,user_id,query_text,video_id,watch_time,day_bucket,created_at)
    VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(user_id,query_text,video_id,day_bucket) DO NOTHING
    RETURNING id`)
    .bind(clickId,input.userId,phrase,input.videoId,Math.floor(input.watchTime),Math.floor(now/86400000),now)
    .first<{id:string}>();
  if (!inserted) return { learned: false, keywords: [] };

  const statements: Statement[] = [];
  statements.push(db.prepare(`INSERT INTO video_search_index(keyword,video_id,weight_score,source,updated_at)
    VALUES(?,?,5,'search_phrase',?)
    ON CONFLICT(keyword,video_id,source) DO UPDATE SET
      weight_score=MIN(video_search_index.weight_score+5,1000000),updated_at=excluded.updated_at`)
    .bind(phrase,input.videoId,now));
  for (const term of terms) {
    statements.push(db.prepare(`INSERT INTO video_search_index(keyword,video_id,weight_score,source,updated_at)
      VALUES(?,?,5,'search_term',?)
      ON CONFLICT(keyword,video_id,source) DO UPDATE SET
        weight_score=MIN(video_search_index.weight_score+5,1000000),updated_at=excluded.updated_at`)
      .bind(term,input.videoId,now));
  }
  await db.batch(statements);
  return { learned: true, keywords: [phrase,...terms] };
}

export async function highestVideoSearchInsight(db: Database, videoId: string) {
  return db.prepare(`SELECT keyword, SUM(weight_score) AS weight_score
    FROM video_search_index WHERE video_id=?
    GROUP BY keyword
    ORDER BY weight_score DESC, length(keyword) DESC, keyword ASC
    LIMIT 1`).bind(videoId).first<{keyword:string;weight_score:number}>();
}
