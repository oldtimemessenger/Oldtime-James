import worker from "../src/cloudflare/worker";
import type {Database,Statement,D1Result} from "../src/cloudflare/runtime";

// Development only: execute the current handlers against the existing D1
// binding. Credentials stay in this server process; no Worker is published.
const accountId="a996a99de07190e688aa6c935e5918b6";
const databaseId="38401455-1735-42e1-b704-550308d381db";
type BoundStatement=Statement&{query:{sql:string;params:unknown[]}};
export function remoteDatabase(token:string,transport:typeof fetch=fetch):Database{
 async function query<T>(body:unknown):Promise<D1Result<T>[]>{
  const response=await transport(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,{
   method:"POST",headers:{"authorization":`Bearer ${token}`,"content-type":"application/json"},
   body:JSON.stringify(body),signal:AbortSignal.timeout(20000),
  });
  const result=await response.json() as {success?:boolean;result?:D1Result<T>[]};
  if(!response.ok||!result.success||!result.result?.every(item=>item.success))throw new Error("Preview database request failed");
  return result.result;
 }
 function statement(sql:string,params:unknown[]=[]):BoundStatement{
  return {query:{sql,params},
   bind(...values){return statement(sql,values)},
   async all<T>(){return (await query<T>({sql,params}))[0]},
   async first<T>(){return (await query<T>({sql,params}))[0]?.results?.[0]??null},
   async run<T>(){return (await query<T>({sql,params}))[0]},
  };
 }
 return{prepare:statement,batch<T>(statements:Statement[]){return query<T>({batch:statements.map(s=>(s as BoundStatement).query)})}};
}
let database:Database|undefined;
export function isCurrentPreviewRoute(path:string){
 return /^\/api\/places\/(?:search|profile|feed|discovery|reviews(?:\/[\da-f-]{36}\/report)?|saved|landing)(?:\?|$)/i.test(path)
  || /^\/api\/moderation\/(?:access|reports)(?:\?|$)/.test(path)
  || /^\/api\/stories\/[\da-f-]{36}\/reactions(?:\?|$)/i.test(path)
  || /^\/api\/account\/library\/saved(?:\?|$)/.test(path);
}
export async function currentPreviewResponse(request:Request){
 const token=process.env.CLOUDFLARE_API_TOKEN;
 if(!token)throw new Error("The preview needs its existing Cloudflare connection");
 database??=remoteDatabase(token);
 return worker.fetch(request,{DB:database} as Parameters<typeof worker.fetch>[1]);
}
