import { type Database, object } from "./runtime";

/** Only call for results received from Photon, not arbitrary client metadata. */
export async function rememberPlaces(db: Database, places: unknown[]) {
  const statements = places.flatMap(value => {
    const p = object(value);
    if (p.source !== "osm" || !/^osm:(node|way|relation):\d{1,18}$/.test(String(p.id)) ||
        typeof p.label !== "string" || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return [];
    return [db.prepare(`INSERT INTO places(id,label,category,address,lat,lon,updated_at,kind,city) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET label=excluded.label,category=excluded.category,address=excluded.address,
      lat=excluded.lat,lon=excluded.lon,updated_at=excluded.updated_at,kind=excluded.kind,city=excluded.city
      WHERE places.label<>excluded.label OR places.category<>excluded.category OR places.address<>excluded.address
      OR places.lat<>excluded.lat OR places.lon<>excluded.lon OR places.kind<>excluded.kind OR places.city<>excluded.city`)
      .bind(p.id, p.label, p.category || "", p.address || "", p.lat, p.lon, Date.now(),p.kind||"unknown",p.city||"")];
  });
  if (statements.length) await db.batch(statements);
}

export function photonMetadata(p: Record<string, unknown>) {
  const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
  return {
    kind: p.osm_key==="place"||p.osm_key==="boundary"?"area" as const:"venue" as const,
    city: (text(p.city)||text(p.town)||text(p.village)).slice(0,140),
    category: text(p.osm_value).replaceAll("_", " ").slice(0, 80),
    address: [...new Set([
      [text(p.housenumber), text(p.street)].filter(Boolean).join(" "),
      text(p.city) || text(p.town) || text(p.village),
      text(p.state), text(p.postcode), text(p.country),
    ].filter(Boolean))].join(", ").slice(0, 300),
  };
}
