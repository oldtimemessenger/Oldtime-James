import assert from "node:assert/strict";
import test from "node:test";
import type { Database, D1Result, MediaBucket, Statement } from "../src/cloudflare/runtime";
import { drainMediaDeletions } from "../src/cloudflare/media-lifecycle";

interface QueueEntry {
  object_key:string;
  upload_id:string|null;
  size_bytes:number;
  attempt_count:number;
  next_attempt_at:number;
  last_error:string|null;
}

class QueueStatement implements Statement {
  private values:unknown[]=[];
  constructor(private readonly database:QueueDatabase,private readonly sql:string){}
  bind(...values:unknown[]){this.values=values;return this;}
  async all<T>():Promise<D1Result<T>>{
    return {success:true,results:this.database.entries.filter(entry=>entry.next_attempt_at<=Number(this.values[0]))
      .map(entry=>({...entry}) as T)};
  }
  async first<T>():Promise<T|null>{return null;}
  async run<T>():Promise<D1Result<T>>{
    if(this.sql.startsWith("DELETE FROM r2_deletion_queue")){
      const keys=new Set(JSON.parse(String(this.values[0])) as string[]);
      this.database.entries=this.database.entries.filter(entry=>!keys.has(entry.object_key));
    }
    return {success:true};
  }
  applyRetry(){
    const [nextAttemptAt,lastError,key]=this.values as [number,string,string];
    const entry=this.database.entries.find(item=>item.object_key===key);
    if(entry){entry.attempt_count++;entry.next_attempt_at=nextAttemptAt;entry.last_error=lastError;}
  }
}

class QueueDatabase implements Database {
  entries:QueueEntry[]=[{
    object_key:"media/test/one",upload_id:null,size_bytes:512,attempt_count:0,next_attempt_at:0,last_error:null,
  }];
  prepare(sql:string){return new QueueStatement(this,sql);}
  async batch<T>(statements:Statement[]):Promise<D1Result<T>[]>{
    for(const statement of statements)(statement as QueueStatement).applyRetry();
    return [];
  }
}

test("R2 delete failures stay queued with bounded retry timing and succeed idempotently",async()=>{
  const db=new QueueDatabase(),objects=new Set(["media/test/one"]);
  let calls=0;
  const bucket={
    delete:async(keys:string|string[])=>{
      calls++;
      if(calls===1)throw new Error("private upstream detail");
      for(const key of Array.isArray(keys)?keys:[keys])objects.delete(key);
    },
    resumeMultipartUpload:()=>({abort:async()=>{}}),
  } as unknown as MediaBucket;
  const now=Date.now();

  const failed=await drainMediaDeletions(db,bucket,undefined,now);
  assert.deepEqual(failed,{queued:1,deletedObjects:0,deletedBytes:0,failedObjects:1});
  assert.equal(db.entries[0].attempt_count,1);
  assert.equal(db.entries[0].next_attempt_at,now+60000);
  assert.equal(db.entries[0].last_error,"Error");
  assert.ok(objects.has("media/test/one"));

  const tooEarly=await drainMediaDeletions(db,bucket,undefined,now+59999);
  assert.equal(tooEarly.queued,0);
  assert.equal(calls,1);

  const retried=await drainMediaDeletions(db,bucket,undefined,now+60000);
  assert.deepEqual(retried,{queued:1,deletedObjects:1,deletedBytes:512,failedObjects:0});
  assert.equal(db.entries.length,0);
  assert.equal(objects.has("media/test/one"),false);
  assert.equal((await drainMediaDeletions(db,bucket,undefined,now+120000)).queued,0);
  assert.equal(calls,2);
});
