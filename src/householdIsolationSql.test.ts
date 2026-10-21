import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Integration tests against the REAL Wimm initial-installation SQL, not mocked
// copies of its RPCs. The auth.uid() test shim replaces only Supabase Auth;
// identities and financial documents are synthetic and remain local to PGlite.
const initialSql = readFileSync(
  new URL("../supabase/01-installation.sql", import.meta.url),
  "utf8",
);

const alice = "00000000-0000-4000-8000-000000000011";
const bob = "00000000-0000-4000-8000-000000000022";
const member = "00000000-0000-4000-8000-000000000033";

type Loaded = {
  household: null | { id: string; owner: string; name: string };
  state?: { projects?: Array<{ id: string; name: string }> };
  revision?: number;
  members?: Array<{ id: string }>;
};

async function asUser(db: PGlite, uid: string | null) {
  await db.query("select set_config('app.test_uid', $1, false)", [uid ?? ""]);
}

async function rpc<T = unknown>(
  db: PGlite,
  fn: string,
  params: unknown[] = [],
): Promise<T> {
  const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await db.query<Record<string, T>>(
    `select public.${fn}(${placeholders}) as value`, params,
  );
  return rows[0].value;
}

async function setup() {
  const db = new PGlite();
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
  await db.exec(initialSql);
  return db;
}

function projectState(base: Loaded, id: string, name: string) {
  return {
    ...(base.state ?? {}),
    projects: [{ id, name }],
  };
}

test("Wimm SQL: unauthenticated users cannot load budget and API roles cannot read private tables", async () => {
  const db = await setup();
  try {
    await asUser(db, null);
    await assert.rejects(rpc(db, "budget_load"), /Connexion requise/);
    const { rows } = await db.query<{
      anon_schema: boolean;
      auth_schema: boolean;
      anon_table: boolean;
      authenticated_table: boolean;
      anonymous_rpc: boolean;
      authorized_rpc: boolean;
    }>(`
      select
        has_schema_privilege('anon', 'budget_private', 'USAGE') as anon_schema,
        has_schema_privilege('authenticated', 'budget_private', 'USAGE') as auth_schema,
        has_table_privilege('anon', 'budget_private.documents', 'SELECT') as anon_table,
        has_table_privilege('authenticated', 'budget_private.documents', 'SELECT') as authenticated_table,
        has_function_privilege('anon', 'public.budget_load()', 'EXECUTE') as anonymous_rpc,
        has_function_privilege('authenticated', 'public.budget_load()', 'EXECUTE') as authorized_rpc
    `);
    assert.deepEqual(rows[0], {
      anon_schema: false,
      auth_schema: false,
      anon_table: false,
      authenticated_table: false,
      anonymous_rpc: false,
      authorized_rpc: true,
    });
  } finally {
    await db.close();
  }
});

test("Wimm SQL: households are isolated and a member shares only their own household", async () => {
  const db = await setup();
  try {
    await asUser(db, alice);
    let a = await rpc<Loaded>(db, "budget_create", ["Alice household"]);
    const aliceHousehold = a.household!.id;
    assert.equal(a.revision, 0);
    await rpc(db, "budget_save", [JSON.stringify(projectState(a, "alice-project", "PRIVATE-ALICE")), 0, "Alice update"]);
    a = await rpc<Loaded>(db, "budget_load");
    assert.equal(a.state!.projects![0].name, "PRIVATE-ALICE");
    const invite = await rpc<string>(db, "budget_invite");

    await asUser(db, bob);
    let b = await rpc<Loaded>(db, "budget_create", ["Bob household"]);
    const bobHousehold = b.household!.id;
    assert.notEqual(bobHousehold, aliceHousehold);
    assert.equal(b.state!.projects!.length, 0);
    assert.equal(JSON.stringify(b).includes("PRIVATE-ALICE"), false);

    await rpc(db, "budget_save", [JSON.stringify(projectState(b, "bob-project", "PRIVATE-BOB")), 0, "Bob update"]);
    b = await rpc<Loaded>(db, "budget_load");
    assert.equal(b.state!.projects![0].name, "PRIVATE-BOB");

    await asUser(db, member);
    const joined = await rpc<Loaded>(db, "budget_join", [invite]);
    assert.equal(joined.household!.id, aliceHousehold);
    assert.equal(joined.state!.projects![0].name, "PRIVATE-ALICE");
    assert.equal(JSON.stringify(joined).includes("PRIVATE-BOB"), false);
    assert.equal(joined.members!.length, 2);

    // Member can edit shared household but cannot reset it (only its owner can).
    await assert.rejects(
      rpc(db, "budget_reset", ["REINITIALISER", 1]),
      /Confirmation ou autorisation invalide/,
    );
    await rpc(db, "budget_save", [JSON.stringify(projectState(joined, "member-project", "MEMBER-OF-ALICE")), 1, "Member update"]);

    await asUser(db, bob);
    b = await rpc<Loaded>(db, "budget_load");
    assert.equal(b.household!.id, bobHousehold);
    assert.equal(b.state!.projects![0].name, "PRIVATE-BOB");
    assert.equal(JSON.stringify(b).includes("MEMBER-OF-ALICE"), false);

    // Bob is owner of another household: removing Alice's member must not
    // remove the person from Alice's household.
    await rpc(db, "budget_remove_member", [member]);
    await asUser(db, alice);
    a = await rpc<Loaded>(db, "budget_load");
    assert.equal(a.state!.projects![0].name, "MEMBER-OF-ALICE");
    assert.equal(a.members!.length, 2);
  } finally {
    await db.close();
  }
});

test("Wimm SQL: optimistic revisions block stale writes and only owners can reset", async () => {
  const db = await setup();
  try {
    await asUser(db, alice);
    const household = await rpc<Loaded>(db, "budget_create", ["My household"]);
    const updated = projectState(household, "p1", "HISTORY");
    await rpc(db, "budget_save", [JSON.stringify(updated), 0, "first write"]);
    await assert.rejects(
      rpc(db, "budget_save", [JSON.stringify(updated), 0, "stale write"]),
      /CONFLICT/,
    );
    await assert.rejects(
      rpc(db, "budget_reset", ["WRONG", 1]),
      /Confirmation ou autorisation invalide/,
    );
    const state = await rpc<Loaded>(db, "budget_load");
    assert.equal(state.revision, 1);
    assert.equal(state.state!.projects![0].name, "HISTORY");
    const reset = await rpc<Loaded>(db, "budget_reset", ["REINITIALISER", 1]);
    assert.equal(reset.revision, 2);
    assert.equal(reset.state!.projects!.length, 0);
  } finally {
    await db.close();
  }
});
