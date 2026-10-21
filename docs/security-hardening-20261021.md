# Wimm / Supabase — hardening prepared on 2026-10-21

## Deployment status

**NOT DEPLOYED TO THE DATABASE OR TO WIMM PRODUCTION.**
This branch contains a proposed migration and a local Postgres test only.
Never run a SQL migration merely by building/deploying the web app.

Supabase project: `Wimm - where is my money ?` (`fdgllctuepwdbulquzqk`).
Production has 34 application tables in `budget_private`, RLS enabled on all 34,
and no direct `anon`/`authenticated` access to these tables. There are
no tables in `public`. Existing RPC grants should remain untouched.

## Why the migration is needed

Supabase's Oct 30, 2026 default-grants change means that newly created objects
must opt into access by Data API roles. Pre-existing `public` defaults on
this project still grant broad permissions to roles for future objects created
by `postgres`. The proposed migration opts `postgres` into deny-by-default,
including `TRUNCATE` and automatic function `EXECUTE`.

Migration: `supabase/migrations/20261021_public_api_default_privileges.sql`.

The migration:

- Changes **default privileges only**, not privileges on any existing objects.
- Blocks automatic table and sequence grants for `anon`, `authenticated`,
  and `service_role` on future objects created by `postgres` in `public`.
- Removes automatic function EXECUTE grants for those roles in `public`.
- Revokes PostgreSQL's *global* default function EXECUTE for `PUBLIC` on
  **future functions created by `postgres` in every schema**. That last
  statement is necessary because a schema-specific REVOKE cannot undo
  globally inherited `PUBLIC` privileges. Any newly created callable
  function must explicitly grant EXECUTE to its intended callers.

**Important limitation:** default privileges belong to the object-creating
role. The migration only targets `postgres`. The Supabase-managed
`supabase_admin` defaults are intentionally not changed here; check how
future migrations create objects and revisit this exception as needed.

## Development / staging validation

1. In a local or disposable Supabase database, apply the migration as
   `postgres`. Do **not** run it against the current production project.
2. Run `npm ci && npm test && npm run build`; the
   `src/supabasePrivileges.test.ts` integration test recreates permissive
   grants and asserts that old objects retain privileges, while future
   objects are inaccessible until explicitly granted.
3. Create a new table in `public`, enable RLS and define a policy, then
   explicitly GRANT only the methods the frontend needs. Verify other
   roles cannot SELECT/INSERT/UPDATE/DELETE/TRUNCATE.
4. Create a new RPC function and verify it is NOT callable before an
   explicit `GRANT EXECUTE`. Verify any expected scheduled/internal
   PostgreSQL code using newly created functions still works.
5. Smoke-test Wimm using **two disposable user accounts in two distinct
   households**, plus a member of the same household. Verify household,
   personal account, invoices, clients, expenses, backups and calendar
   feeds remain isolated. In particular, do not assume privileged
   `SECURITY DEFINER` RPCs are protected by RLS: inspect their per-user
   authorization checks.
6. Validate all notification jobs, recurring Pro billing, backups,
   calendar subscriptions and new account onboarding in that test setup.
7. If staging passes, make a database backup, approve a maintenance
   window, apply only the reviewed SQL to production, then repeat the
   permission and Wimm smoke checks.

For intentionally exposed functions, prefer the pattern:

```sql
create or replace function public.example_for_signed_in_user()
returns integer language sql security definer set search_path = ''
as $$ select 1 $$;

revoke all on function public.example_for_signed_in_user()
  from public, anon, authenticated, service_role;
grant execute on function public.example_for_signed_in_user()
  to authenticated;
```

For new tables, grant only the necessary SELECT/INSERT/UPDATE/DELETE
permissions *and* enable RLS and write ownership policies in the same
migration. Do not use automatic `grant all` for API roles.

## Separate follow-ups not fixed by this migration

- **Compromised-password protection is disabled** per Supabase Security
  Advisor. Review its availability in Supabase Auth settings and enable
  it separately if supported. Git changes cannot enable this project
  setting: https://supabase.com/docs/guides/auth/password-security
- Supabase flags one intentionally public token-based calendar RPC
  (`budget_pro_calendar_feed`) as SECURITY DEFINER executable by `anon`.
  It validates the 64-character token and returns events for the matching
  subscription. Preserve that behavior, assess token leakage and
  calendar-data scope, and consider monitoring/rate limiting.
- 65 authenticated SECURITY DEFINER RPCs are part of Wimm's private-schema
  architecture. Revoke or rewrite individual functions only after
  per-user access tests; bulk revocation would break the app.
- 31 private tables with RLS but no policies are **intentional** under
  the RPC-only design: they have no direct API grants or schema USAGE
  for `anon`/`authenticated`.
- Three Pro recurrence policies have an `auth.uid()` per-row performance
  warning; index and RLS performance improvements are separate from this
  safety change and need query-plan tests.
- Database migration history contains scripts absent from the Git
  `supabase/migrations` directory. Before replaying a fresh database,
  reconcile the true applied migration history with all standalone
  `supabase/*.sql` setup scripts. Do NOT assume this branch can be
  migrated from a completely empty database as-is.

Reference: https://supabase.com/docs/guides/api/securing-your-api

## Local test execution — 2026-10-21

GitHub Actions run: https://github.com/quentinguiot83-eng/budget-v2/actions/runs/39565343072

**PASS:** `npm run build` and `npm test`, including the isolated PostgreSQL/PGlite suites:

- `src/supabasePrivileges.test.ts` — existing SQL grants remain unchanged, newly created table/sequence/RPC objects deny automatic API access, and explicit GRANT opt-in is possible.
- `src/householdIsolationSql.test.ts` — executes real `supabase/01-installation.sql` using three synthetic identities across two households. Confirms unauthenticated calls are rejected, membership confines reads/writes to the right household, non-owners cannot reset and optimistic write revisions reject stale edits.
- `src/personalPrivacySql.test.ts` — loads a date-stamped snapshot of `budget_personal_load`, `budget_personal_save` and their private helper functions read-only from production. Confirms that two members of the same household have different personal accounts, an outsider sees neither, and stale personal writes fail.

The harness simulates `auth.uid()` through an isolated test setting; it **does not** validate real Supabase JWT issuance or session handling. The personal RPCs are a point-in-time snapshot and must be rechecked after future changes. No production records or real identities were used, and **no Supabase test branch was created or billed**.

These local tests are a strong regression check but not a substitute for an end-to-end security test on deployed Supabase/Vercel, including Wimm Pro invoice RPCs, storage policies and notifications. The SQL migration in this PR remains unapplied.
