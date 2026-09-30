-- Notre budget v2 — installer dans le NOUVEAU projet Supabase.
-- Script transactionnel, réexécutable ; ne supprime pas les données existantes.
-- Après succès, vous pouvez supprimer son texte de SQL Editor.
-- Conservez ce fichier avec le code pour les futures installations.
begin;
create schema if not exists budget_private;
revoke all on schema budget_private from public, anon, authenticated;
create table if not exists budget_private.households(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 80),owner uuid not null references auth.users(id),created_at timestamptz not null default now());
create table if not exists budget_private.members(user_id uuid primary key references auth.users(id) on delete cascade,household_id uuid not null references budget_private.households(id) on delete cascade,joined_at timestamptz not null default now());
create index if not exists members_household on budget_private.members(household_id);
create table if not exists budget_private.documents(household_id uuid primary key references budget_private.households(id) on delete cascade,body jsonb not null,revision integer not null default 0,updated_at timestamptz not null default now());
create table if not exists budget_private.invitations(id uuid primary key default gen_random_uuid(),household_id uuid not null references budget_private.households(id) on delete cascade,code_hash text unique not null,expires_at timestamptz not null default now()+interval '7 days',used_by uuid references auth.users(id));
create table if not exists budget_private.preferences(user_id uuid primary key references auth.users(id) on delete cascade,theme text not null default 'blue' check(theme in ('blue','lavender','sage','rose','peach')));
create table if not exists budget_private.join_attempts(user_id uuid primary key references auth.users(id) on delete cascade,last_attempt timestamptz not null default now(),attempts int not null default 1);
create table if not exists budget_private.audit(id bigint generated always as identity primary key,household_id uuid not null references budget_private.households(id) on delete cascade,user_id uuid not null,revision int not null,action text not null,created_at timestamptz not null default now());
alter table budget_private.households enable row level security;
alter table budget_private.members enable row level security;
alter table budget_private.documents enable row level security;
alter table budget_private.invitations enable row level security;
alter table budget_private.preferences enable row level security;
alter table budget_private.join_attempts enable row level security;
alter table budget_private.audit enable row level security;
-- Aucune table n'est exposée. Les fonctions ci-dessous sont l'unique accès,
-- avec auth.uid(), contrôle d'appartenance et version optimiste à chaque écriture.
revoke all on all tables in schema budget_private from public,anon,authenticated;
create or replace function budget_private.empty_document() returns jsonb language sql immutable set search_path='' as $$
select '{"schema":1,"accounts":[],"categories":[],"rules":[],"transactions":[],"trips":[],"projects":[],"loans":[],"income":0,"hidden":[],"cancelled":[]}'::jsonb;
$$;
create or replace function budget_private.check_document(b jsonb) returns void language plpgsql set search_path='' as $$
declare k text; t jsonb; a jsonb;
begin
 if jsonb_typeof(b)<>'object' or (b->>'schema')::int<>1 or octet_length(b::text)>10000000 then raise exception 'Format de données invalide'; end if;
 foreach k in array array['accounts','categories','rules','transactions','trips','projects','loans','hidden','cancelled'] loop
  if jsonb_typeof(b->k) is distinct from 'array' then raise exception 'Liste manquante : %',k; end if;
 end loop;
 foreach k in array array['accounts','categories','rules','transactions','trips','projects','loans'] loop
  if exists(select 1 from jsonb_array_elements(b->k) x where coalesce(x->>'id','')='') or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(b->k) x) then raise exception 'Identifiants invalides : %',k; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(b->'transactions') x where x->>'dueKey' is not null group by x->>'dueKey' having count(*)>1) then raise exception 'Échéance déjà validée';end if;
 for t in select * from jsonb_array_elements(b->'transactions') loop
  if t->>'type' not in ('expense','income','transfer','loan','repay','adjust') or t->>'amount' !~ '^-?[0-9]+$' or abs((t->>'amount')::numeric)>1000000000000 or (t->>'type'<>'adjust' and (t->>'amount')::numeric<=0) then raise exception 'Opération invalide';end if;
  select x into a from jsonb_array_elements(b->'accounts') x where x->>'id'=t->>'account';
  if a is null or (t->>'date')::date<(a->>'date')::date or (t->>'date')::date>(now() at time zone 'Europe/Paris')::date then raise exception 'Compte ou date invalide';end if;
  if t->>'type'='transfer' and (t->>'to'=t->>'account' or not exists(select 1 from jsonb_array_elements(b->'accounts') x where x->>'id'=t->>'to' and (x->>'date')::date<=(t->>'date')::date)) then raise exception 'Virement invalide';end if;
 end loop;
end $$;
create or replace function public.budget_load() returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid; result jsonb;
begin
 if auth.uid() is null then raise exception 'Connexion requise';end if;
 select household_id into h from budget_private.members where user_id=auth.uid();
 if h is null then return jsonb_build_object('household',null,'theme',coalesce((select theme from budget_private.preferences where user_id=auth.uid()),'blue'));end if;
 select jsonb_build_object('household',jsonb_build_object('id',hh.id,'name',hh.name,'owner',hh.owner),'state',d.body,'revision',d.revision,'theme',coalesce((select theme from budget_private.preferences where user_id=auth.uid()),'blue'),'members',(select jsonb_agg(jsonb_build_object('id',m.user_id,'email',u.email,'owner',m.user_id=hh.owner)) from budget_private.members m join auth.users u on u.id=m.user_id where m.household_id=h)) into result from budget_private.households hh join budget_private.documents d on d.household_id=hh.id where hh.id=h;
 return result;
end $$;
create or replace function public.budget_create(p_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
 if auth.uid() is null then raise exception 'Connexion requise';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from budget_private.members where user_id=auth.uid()) then raise exception 'Vous avez déjà un foyer';end if;
 insert into budget_private.households(name,owner) values(trim(p_name),auth.uid()) returning id into h;
 insert into budget_private.members(user_id,household_id) values(auth.uid(),h);
 insert into budget_private.documents(household_id,body) values(h,budget_private.empty_document());
 return public.budget_load();
end $$;
create or replace function public.budget_save(p_state jsonb,p_revision int,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid; r int;
begin
 select household_id into h from budget_private.members where user_id=auth.uid() for share;
 if h is null then raise exception 'Accès refusé';end if;
 perform budget_private.check_document(p_state);
 update budget_private.documents set body=p_state,revision=revision+1,updated_at=now() where household_id=h and revision=p_revision returning revision into r;
 if r is null then raise exception 'CONFLICT: données modifiées par un autre appareil. Actualisez avant de réessayer.';end if;
 insert into budget_private.audit(household_id,user_id,revision,action) values(h,auth.uid(),r,left(p_action,160));
 return jsonb_build_object('revision',r);
end $$;
create or replace function public.budget_theme(p_theme text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Connexion requise';end if;
 insert into budget_private.preferences(user_id,theme) values(auth.uid(),p_theme) on conflict(user_id) do update set theme=excluded.theme;
end $$;
create or replace function public.budget_invite() returns text language plpgsql security definer set search_path='' as $$
declare h uuid; code text;
begin
 select id into h from budget_private.households where owner=auth.uid();
 if h is null then raise exception 'Seul le propriétaire peut inviter';end if;
 update budget_private.invitations set expires_at=now() where household_id=h and used_by is null;
 code=upper(replace(gen_random_uuid()::text,'-',''));
 insert into budget_private.invitations(household_id,code_hash) values(h,encode(sha256(convert_to(code,'UTF8')),'hex'));
 return code;
end $$;
create or replace function public.budget_join(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare inv budget_private.invitations; n int;
begin
 if auth.uid() is null then raise exception 'Connexion requise';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from budget_private.members where user_id=auth.uid()) then raise exception 'Quittez votre foyer avant de rejoindre un autre foyer';end if;
 insert into budget_private.join_attempts(user_id) values(auth.uid()) on conflict(user_id) do update set attempts=case when budget_private.join_attempts.last_attempt<now()-interval '15 minutes' then 1 else budget_private.join_attempts.attempts+1 end,last_attempt=case when budget_private.join_attempts.last_attempt<now()-interval '15 minutes' then now() else budget_private.join_attempts.last_attempt end returning attempts into n;
 if n>10 then return jsonb_build_object('error','Trop de tentatives. Réessayez dans 15 minutes.');end if;
 select * into inv from budget_private.invitations where code_hash=encode(sha256(convert_to(upper(regexp_replace(p_code,'\s','','g')),'UTF8')),'hex') and used_by is null and expires_at>now() for update;
 if inv.id is null then return jsonb_build_object('error','Code invalide, expiré ou déjà utilisé.');end if;
 insert into budget_private.members(user_id,household_id) values(auth.uid(),inv.household_id);
 update budget_private.invitations set used_by=auth.uid() where id=inv.id;
 return public.budget_load();
end $$;
create or replace function public.budget_remove_member(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
 select id into h from budget_private.households where owner=auth.uid();
 if h is null or p_user=auth.uid() then raise exception 'Action non autorisée';end if;
 delete from budget_private.members where user_id=p_user and household_id=h;
end $$;
create or replace function public.budget_reset(p_confirmation text,p_revision int) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid; r int;
begin
 select id into h from budget_private.households where owner=auth.uid();
 if h is null or p_confirmation<>'REINITIALISER' then raise exception 'Confirmation ou autorisation invalide';end if;
 update budget_private.documents set body=budget_private.empty_document(),revision=revision+1,updated_at=now() where household_id=h and revision=p_revision returning revision into r;
 if r is null then raise exception 'CONFLICT: actualisez avant de réessayer';end if;
 insert into budget_private.audit(household_id,user_id,revision,action) values(h,auth.uid(),r,'Réinitialisation globale');
 return public.budget_load();
end $$;
create or replace function public.budget_rename(p_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 update budget_private.households set name=trim(p_name) where owner=auth.uid();
 if not found then raise exception 'Action non autorisée';end if;
end $$;
revoke all on all functions in schema budget_private from public,anon,authenticated;
revoke execute on function public.budget_load(),public.budget_create(text),public.budget_save(jsonb,int,text),public.budget_theme(text),public.budget_invite(),public.budget_join(text),public.budget_remove_member(uuid),public.budget_reset(text,int),public.budget_rename(text) from public,anon,authenticated;
grant usage on schema public to authenticated;
grant execute on function public.budget_load(),public.budget_create(text),public.budget_save(jsonb,int,text),public.budget_theme(text),public.budget_invite(),public.budget_join(text),public.budget_remove_member(uuid),public.budget_reset(text,int),public.budget_rename(text) to authenticated;
notify pgrst,'reload schema';
commit;
