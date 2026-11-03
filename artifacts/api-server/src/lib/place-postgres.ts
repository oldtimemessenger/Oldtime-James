import type { Database, Statement, D1Result } from "../cloudflare/runtime";

/** PostgreSQL repository adapter limited to the shared Places query vocabulary.
 * Values always use positional binds, never string interpolation. */
export function placePostgresQuery(sql: string) {
  let index=0;
  return sql.replace(/json_extract\((\w+\.place),'\$\.(\w+)'\)/g,"($1->>'$2')")
    .replace(/SELECT \? AS id/g,"SELECT ?::uuid AS id")
    .replace(/\bu\.is_private=0\b/g,"u.is_private=false")
    .replace(/\bu\.is_virtual=0\b/g,"true")
    .replace(/\bm\.ready=1\b/g,"m.ready=true")
    .replace(/\bp\.created_at\b/g,"(EXTRACT(EPOCH FROM p.created_at)*1000)::bigint")
    .replace(/\bc\.created_at\b/g,"(EXTRACT(EPOCH FROM c.created_at)*1000)::bigint")
    .replace(/\?/g,()=>`$${++index}`);
}
type Queryable = { query(text:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]}> };
export function placesPostgres(db: Queryable): Database {
  function prepare(source: string, values: unknown[] = []): Statement {
    const execute = async () => {
      const result = await db.query(placePostgresQuery(source),values);
      return result.rows.map((row: Record<string,unknown>) => Object.fromEntries(Object.entries(row).map(([key,value])=>[
        key, value instanceof Date ? value.getTime() : ["count","posts","people","average","rating","created_at","updated_at"].includes(key) && typeof value==="string" ? Number(value) : value,
      ])));
    };
    return {bind:(...v)=>prepare(source,v),all:async<T>()=>({success:true,results:await execute() as T[]}),
      first:async<T>()=>(await execute())[0] as T || null,
      run:async<T>()=>({success:true,results:await execute() as T[]})};
  }
  return {prepare,batch:async<T>(statements:Statement[])=> {
    const result:D1Result<T>[]=[];
    for(const statement of statements) result.push(await statement.run<T>());
    return result;
  }};
}
