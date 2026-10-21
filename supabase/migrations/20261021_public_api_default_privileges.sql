-- Wimm | Future Data API objects: deny access by default (2026-10-21).
-- Prepared for validation on a test database first; do NOT run on production
-- until the security checks in docs/security-hardening-20261021.md pass.
--
-- The current Wimm tables live in budget_private and have NO direct API grants.
-- Existing permissions on tables and RPC functions must remain unchanged.
-- ALTER DEFAULT PRIVILEGES applies only to objects created IN THE FUTURE
-- by the specified creating role (postgres), not to existing objects.
--
-- New public tables/functions must receive only their required explicit
-- GRANTs in the same migration. RLS is an additional, separate boundary.
begin;

-- Prevent accidental grants (including TRUNCATE/REFERENCES/TRIGGER/MAINTAIN)
-- on future public tables created by the postgres migration role.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;

-- Remove Supabase's role-specific automatic EXECUTE grants on new RPCs.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

-- PostgreSQL also grants EXECUTE on new functions to PUBLIC globally by
-- default. A per-schema REVOKE does NOT override that global default.
-- This applies to future functions created by postgres in ALL schemas:
-- future functions intentionally called by API roles need an explicit GRANT.
alter default privileges for role postgres
  revoke execute on functions from public;

commit;
