import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL push migration: ownership, server-only data, atomic leases, expiry and idempotence", async () => {
  const db = new PGlite();
  const user = "00000000-0000-4000-8000-000000000001";
  const other = "00000000-0000-4000-8000-000000000002";
  const household = "00000000-0000-4000-8000-000000000003";
  const subscription = { endpoint: "https://web.push.apple.com/test", keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) } };
  try {
    await db.exec(`
      create role authenticated; create role anon; create role service_role;
      create schema auth; create schema budget_private;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,service_role;
      grant execute on function auth.uid() to authenticated,service_role;
      create table budget_private.households(id uuid primary key);
      create table budget_private.members(user_id uuid primary key,household_id uuid);
      create table budget_private.documents(household_id uuid primary key,body jsonb);
      create table budget_private.pro_businesses(id uuid primary key,name text);
      create table budget_private.pro_invoices(id uuid,user_id uuid,business_id uuid,invoice_number text,due_date date,status text);
      insert into auth.users values ('${user}'),('${other}');
      insert into budget_private.households values ('${household}');
      insert into budget_private.members values ('${user}','${household}'),('${other}','${household}');
      insert into budget_private.documents values ('${household}','{"schema":1}');
    `);
    const migration = await readFile(new URL("../supabase/11-phone-notifications.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${user}';`);
    const save = async () => db.query<{ value: { enabled: boolean; id: string } }>("select public.budget_push_device($1::jsonb,'save',true,true,$2::text[]) value", [JSON.stringify(subscription), ["budget:2026-10:food"]]);
    assert.equal((await save()).rows[0].value.enabled, true);
    await assert.rejects(() => db.query("select public.budget_push_context(null)"), /permission denied/);
    await assert.rejects(() => db.query("select * from budget_private.push_devices"), /permission denied/);
    await db.exec(`set request.jwt.claim.sub='${other}';`);
    await assert.rejects(save, /autre compte/);
    await db.exec("reset role; set role service_role;");
    const context = await db.query<{ value: { id: string; userId: string }[] }>("select public.budget_push_context(null) value");
    const id = context.rows[0].value[0].id;
    assert.equal(context.rows[0].value[0].userId, user);
    const claim = async (key: string) => (await db.query<{ value: boolean }>("select public.budget_push_claim($1,$2) value", [id, key])).rows[0].value;
    assert.equal(await claim("budget:2026-10:food"), false, "activation seeds existing alerts");
    assert.equal(await claim("due:rent:2026-10-07"), true);
    assert.equal(await claim("due:rent:2026-10-07"), false, "second worker cannot claim the same alert");
    await db.query("select public.budget_push_finish($1,$2,true)", [id, ["due:rent:2026-10-07"]]);
    assert.equal(await claim("due:rent:2026-10-07"), false, "delivered alerts stay deduplicated");
    await db.query("select public.budget_push_expire($1)", [id]);
    assert.equal((await db.query<{ value: unknown[] }>("select public.budget_push_context(null) value")).rows[0].value.length, 0);
    await db.exec("reset role");
    assert.equal((await db.query<{ count: number }>("select count(*)::int count from budget_private.push_deliveries")).rows[0].count, 0);
  } finally { await db.close(); }
});
