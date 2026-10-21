import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Personal account RPCs are snapshots of current production function definitions;
// the database itself and Supabase Auth are emulated in isolated PGlite.
// Only fake user IDs and budget records are used.
const install = readFileSync(new URL("../supabase/01-installation.sql", import.meta.url), "utf8");
const personalRpcs = readFileSync(new URL("../supabase/test-fixtures/personal-privacy-prod-20261021.sql", import.meta.url), "utf8");

const alice = "00000000-0000-4000-8000-000000000011";
const bob = "00000000-0000-4000-8000-000000000022";
const member = "00000000-0000-4000-8000-000000000033";

type PersonalResponse = {
  state: { schema: number; account: null | Record<string, unknown>; transactions: unknown[]; rules: unknown[] };
  revision: number;
};

async function asUser(db: PGlite, userId: string | null) {
  await db.query("select set_config('app.test_uid', $1, false)", [userId ?? ""]);
}

async function personalLoad(db: PGlite): Promise<PersonalResponse> {
  const { rows } = await db.query<{ value: PersonalResponse }>("select public.budget_personal_load() as value");
  return rows[0].value;
}

async function personalSave(db: PGlite, state: PersonalResponse["state"], revision: number) {
  return db.query("select public.budget_personal_save($1::jsonb, $2::integer, 'test update')", [JSON.stringify(state), revision]);
}

test("Wimm SQL: personal accounts remain private between members of one household", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key, email text not null);
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('app.test_uid', true), '')::uuid $$;
      insert into auth.users(id,email) values
        ('${alice}','alice@example.invalid'),
        ('${bob}','bob@example.invalid'),
        ('${member}','member@example.invalid');
    `);
    await db.exec(install);
    await db.exec(`
      create table budget_private.personal_documents (
        user_id uuid not null references auth.users(id) on delete cascade,
        household_id uuid not null references budget_private.households(id) on delete cascade,
        body jsonb not null,
        revision integer not null default 0,
        updated_at timestamptz not null default now(),
        primary key (user_id,household_id)
      );
      alter table budget_private.personal_documents enable row level security;
      revoke all on budget_private.personal_documents from public, anon, authenticated;
    `);
    await db.exec(personalRpcs);
    await db.exec(`
      revoke all on function public.budget_personal_load() from public, anon, authenticated;
      revoke all on function public.budget_personal_save(jsonb,integer,text) from public, anon, authenticated;
      grant execute on function public.budget_personal_load() to authenticated;
      grant execute on function public.budget_personal_save(jsonb,integer,text) to authenticated;
    `);

    await asUser(db, alice);
    await db.query("select public.budget_create('Household A')");
    const aliceEmpty = await personalLoad(db);
    assert.equal(aliceEmpty.revision, 0);
    assert.equal(aliceEmpty.state.account, null);
    const aliceData = { ...aliceEmpty.state, account: { id: "alice", name: "PRIVATE-ALICE" } };
    await personalSave(db, aliceData, 0);

    const { rows: inviteRows } = await db.query<{ code: string }>("select public.budget_invite() as code");

    await asUser(db, bob);
    await db.query("select public.budget_create('Household B')");
    const bobEmpty = await personalLoad(db);
    assert.equal(bobEmpty.state.account, null);
    await personalSave(db, { ...bobEmpty.state, account: { id: "bob", name: "PRIVATE-BOB" } }, 0);

    await asUser(db, member);
    await db.query("select public.budget_join($1)", [inviteRows[0].code]);
    const memberEmpty = await personalLoad(db);
    assert.equal(memberEmpty.state.account, null);
    assert.equal(memberEmpty.revision, 0);
    await personalSave(db, { ...memberEmpty.state, account: { id: "member", name: "PRIVATE-MEMBER" } }, 0);

    await asUser(db, alice);
    const aliceAfter = await personalLoad(db);
    assert.equal(aliceAfter.revision, 1);
    assert.equal(aliceAfter.state.account?.name, "PRIVATE-ALICE");
    assert.equal(JSON.stringify(aliceAfter).includes("PRIVATE-MEMBER"), false);
    assert.equal(JSON.stringify(aliceAfter).includes("PRIVATE-BOB"), false);

    await asUser(db, bob);
    const bobAfter = await personalLoad(db);
    assert.equal(bobAfter.state.account?.name, "PRIVATE-BOB");
    assert.equal(JSON.stringify(bobAfter).includes("PRIVATE-ALICE"), false);

    await asUser(db, member);
    const memberAfter = await personalLoad(db);
    assert.equal(memberAfter.state.account?.name, "PRIVATE-MEMBER");
    // Revision checks also apply to personal data: a stale write is rejected.
    await assert.rejects(personalSave(db, memberAfter.state, 0), /CONFLICT/);

    const { rows: grants } = await db.query<{ anon: boolean; auth: boolean }>(`
      select
        has_table_privilege('anon', 'budget_private.personal_documents', 'SELECT') as anon,
        has_table_privilege('authenticated', 'budget_private.personal_documents', 'SELECT') as auth
    `);
    assert.deepEqual(grants[0], { anon: false, auth: false });
  } finally {
    await db.close();
  }
});
