import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { deleteOwnAccount } from "../src/cloudflare/account-deletion";
import { PermanentlyDeleteOwnAccountBody } from "@workspace/api-zod";
import type { Database, Statement } from "../src/cloudflare/runtime";

test("deletion removes only the owner, revokes sessions and durably queues media", async () => {
  const sql = new DatabaseSync(":memory:");
  try {
    sql.exec("PRAGMA foreign_keys=ON");
    const dir = new URL("../migrations/", import.meta.url);
    for (const file of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) sql.exec(readFileSync(new URL(file, dir), "utf8"));
    for (const id of ["owner", "other"]) sql.prepare("INSERT INTO users(id,email,username,display_name,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?,?)")
      .run(id, `${id}@example.test`, id, id, "salt", "hash", Date.now());
    sql.prepare("INSERT INTO sessions(id,user_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)").run("session", "owner", "token", Date.now(), Date.now() + 10000);
    const columns = sql.prepare("PRAGMA table_info(user_media_assets)").all() as {name:string;notnull:number;dflt_value:unknown}[];
    // Use the real deployed table shape; no mock schema or production writes.
    const media:Record<string,unknown>={id:"media",user_id:"owner",object_key:"owner/photo.jpg",content_type:"image/jpeg",size:12,sha256:"digest",created_at:Date.now(),updated_at:Date.now(),ready:1};
    const required = columns.filter(c => c.name in media || c.notnull && c.dflt_value === null);
    sql.prepare(`INSERT INTO user_media_assets(${required.map(c=>c.name).join(",")}) VALUES(${required.map(()=>"?").join(",")})`).run(...required.map(c=>media[c.name] ?? "fixture") as any[]);
    sql.prepare("INSERT INTO media_references(user_id,target_type,target_id,media_id) VALUES(?,?,?,?)").run("other","post","reference","media");
    function prepare(query:string):Statement {
      let values:unknown[]=[];
      return {bind(...input){values=input;return this;},
        async all<T>(){return {success:true,results:sql.prepare(query).all(...values as any[]) as T[]};},
        async first<T>(){return (sql.prepare(query).get(...values as any[])??null) as T|null;},
        async run(){return {success:true,meta:{changes:Number(sql.prepare(query).run(...values as any[]).changes)}};}};
    }
    const db:Database={prepare,async batch(statements){
      sql.exec("BEGIN");try {const result=[];for(const statement of statements) result.push(await statement.run());sql.exec("COMMIT");return result;}
      catch(error){sql.exec("ROLLBACK");throw error;}
    }};
    await deleteOwnAccount(db,"owner");
    assert.equal(sql.prepare("SELECT count(*) AS n FROM users WHERE id='owner'").get()?.n,0);
    assert.equal(sql.prepare("SELECT count(*) AS n FROM sessions WHERE user_id='owner'").get()?.n,0);
    assert.equal(sql.prepare("SELECT count(*) AS n FROM users WHERE id='other'").get()?.n,1);
    assert.equal(sql.prepare("SELECT count(*) AS n FROM r2_deletion_queue WHERE object_key='owner/photo.jpg'").get()?.n,1);
    assert.equal(sql.prepare("SELECT count(*) AS n FROM user_media_assets WHERE user_id='owner'").get()?.n,0);
    await deleteOwnAccount(db,"owner");
    assert.equal(sql.prepare("SELECT count(*) AS n FROM r2_deletion_queue").get()?.n,1);
  } finally { sql.close(); }
});

test("deletion requires current password and explicit confirmation", () => {
  assert.equal(PermanentlyDeleteOwnAccountBody.safeParse({currentPassword:"password",confirmation:"DELETE"}).success,true);
  assert.equal(PermanentlyDeleteOwnAccountBody.safeParse({currentPassword:"password"}).success,false);
  assert.equal(PermanentlyDeleteOwnAccountBody.safeParse({currentPassword:"password",confirmation:"yes"}).success,false);
});
