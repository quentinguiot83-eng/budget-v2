import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("scheduled-push tokens: only service role can consume once and only before expiry",async()=>{
  const db=new PGlite();
  try{
    await db.exec("create role anon; create role authenticated; create role service_role; create schema budget_private;");
    const sql=await readFile(new URL("../supabase/14-daily-reminder-scheduler.sql",import.meta.url),"utf8");
    const from=sql.indexOf("create table if not exists budget_private.push_dispatch_tokens");
    const until=sql.indexOf("-- This internal function is invoked only by postgres");
    assert.ok(from>=0 && until>from);
    await db.exec(sql.slice(from,until));
    const token="30000000-0000-4000-8000-000000000001";
    const expired="30000000-0000-4000-8000-000000000002";
    await db.query("insert into budget_private.push_dispatch_tokens(token) values($1)",[token]);
    await db.query("insert into budget_private.push_dispatch_tokens(token,expires_at) values($1, now()-interval '1 minute')",[expired]);
    await db.exec("set role authenticated;");
    await assert.rejects(db.query("select public.budget_push_cron_consume($1)",[token]),/permission denied/);
    await db.exec("reset role; set role service_role;");
    const consume=async(t:string)=>(await db.query<{accepted:boolean}>("select public.budget_push_cron_consume($1) accepted",[t])).rows[0].accepted;
    assert.equal(await consume(expired),false);
    assert.equal(await consume(token),true);
    assert.equal(await consume(token),false,"replay must be denied");
    await db.exec("reset role;");
  }finally{await db.close();}
});
