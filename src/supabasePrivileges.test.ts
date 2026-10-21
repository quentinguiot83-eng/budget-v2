import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const hardening = readFileSync(
  new URL("../supabase/migrations/20261021_public_api_default_privileges.sql", import.meta.url),
  "utf8",
);

test("new public objects deny implicit Data API access without changing existing grants", async () => {
  const db = new PGlite();
  try {
    // Reproduce a legacy Supabase project with permissive default grants.
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;

      alter default privileges for role postgres in schema public
        grant all privileges on tables to anon, authenticated, service_role;
      alter default privileges for role postgres in schema public
        grant all privileges on sequences to anon, authenticated, service_role;
      alter default privileges for role postgres in schema public
        grant execute on functions to anon, authenticated, service_role;

      create table public.existing_budget_test(id bigint);
      create sequence public.existing_budget_seq;
      create function public.existing_budget_rpc() returns integer
        language sql as $$ select 1 $$;
    `);

    // No existing table, sequence or RPC is modified by the migration.
    await db.exec(hardening);

    await db.exec(`
      create table public.future_budget_test(id bigint);
      create sequence public.future_budget_seq;
      create function public.future_budget_rpc() returns integer
        language sql as $$ select 2 $$;
    `);

    const result = await db.query<{
      existing_table: boolean;
      future_table_select: boolean;
      future_table_insert: boolean;
      future_table_truncate: boolean;
      future_table_authenticated: boolean;
      existing_sequence: boolean;
      future_sequence: boolean;
      existing_rpc: boolean;
      future_rpc_anon: boolean;
      future_rpc_authenticated: boolean;
    }>(`
      select
        has_table_privilege('anon', 'public.existing_budget_test', 'SELECT') as existing_table,
        has_table_privilege('anon', 'public.future_budget_test', 'SELECT') as future_table_select,
        has_table_privilege('anon', 'public.future_budget_test', 'INSERT') as future_table_insert,
        has_table_privilege('anon', 'public.future_budget_test', 'TRUNCATE') as future_table_truncate,
        has_table_privilege('authenticated', 'public.future_budget_test', 'SELECT') as future_table_authenticated,
        has_sequence_privilege('anon', 'public.existing_budget_seq', 'USAGE') as existing_sequence,
        has_sequence_privilege('anon', 'public.future_budget_seq', 'USAGE') as future_sequence,
        has_function_privilege('anon', 'public.existing_budget_rpc()', 'EXECUTE') as existing_rpc,
        has_function_privilege('anon', 'public.future_budget_rpc()', 'EXECUTE') as future_rpc_anon,
        has_function_privilege('authenticated', 'public.future_budget_rpc()', 'EXECUTE') as future_rpc_authenticated
    `);

    assert.deepEqual(result.rows[0], {
      existing_table: true,
      future_table_select: false,
      future_table_insert: false,
      future_table_truncate: false,
      future_table_authenticated: false,
      existing_sequence: true,
      future_sequence: false,
      existing_rpc: true,
      future_rpc_anon: false,
      future_rpc_authenticated: false,
    });

    // A deliberately exposed resource must explicitly opt in.
    await db.exec(`
      alter table public.future_budget_test enable row level security;
      grant select on table public.future_budget_test to authenticated;
      grant execute on function public.future_budget_rpc() to authenticated;
    `);

    const optedIn = await db.query<{ table_granted: boolean; rpc_granted: boolean; anon_rpc: boolean }>(`
      select
        has_table_privilege('authenticated', 'public.future_budget_test', 'SELECT') as table_granted,
        has_function_privilege('authenticated', 'public.future_budget_rpc()', 'EXECUTE') as rpc_granted,
        has_function_privilege('anon', 'public.future_budget_rpc()', 'EXECUTE') as anon_rpc
    `);
    assert.deepEqual(optedIn.rows[0], { table_granted: true, rpc_granted: true, anon_rpc: false });
  } finally {
    await db.close();
  }
});
