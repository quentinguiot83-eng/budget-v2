-- Wimm / budget-v2 — Module professionnel facultatif
-- À exécuter UNE SEULE FOIS après 01-installation.sql dans Supabase SQL Editor.
-- Le script est réexécutable et ne supprime aucune donnée existante.
-- Après succès, le texte peut être supprimé du SQL Editor ; conservez ce fichier dans Git.

begin;

create schema if not exists budget_private;
revoke all on schema budget_private from public, anon, authenticated;

create table if not exists budget_private.pro_modules (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists budget_private.pro_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default '',
  legal_status text not null default 'micro'
    check (legal_status in ('micro','ei','eurl','sasu','sarl','sas','other')),
  activity_type text not null default 'service'
    check (activity_type in ('service','commerce','mixed','liberal','other')),
  siret text,
  contribution_rate numeric(6,3) not null default 0
    check (contribution_rate between 0 and 100),
  tax_rate numeric(6,3) not null default 0
    check (tax_rate between 0 and 100),
  vat_enabled boolean not null default false,
  vat_rate numeric(6,3) not null default 20
    check (vat_rate between 0 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists budget_private.pro_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pro_clients_user_id_idx
  on budget_private.pro_clients(user_id);

create table if not exists budget_private.pro_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income','expense')),
  label text not null check (length(trim(label)) between 1 and 200),
  amount bigint not null check (amount > 0),
  transaction_date date not null default current_date,
  category text,
  client_id uuid references budget_private.pro_clients(id) on delete set null,
  vat_amount bigint not null default 0 check (vat_amount >= 0),
  paid boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vat_amount <= amount)
);

create index if not exists pro_transactions_user_date_idx
  on budget_private.pro_transactions(user_id, transaction_date desc);

alter table budget_private.pro_modules enable row level security;
alter table budget_private.pro_profiles enable row level security;
alter table budget_private.pro_clients enable row level security;
alter table budget_private.pro_transactions enable row level security;

-- Comme le reste de budget-v2, aucune table Pro n'est exposée directement.
revoke all on budget_private.pro_modules from public, anon, authenticated;
revoke all on budget_private.pro_profiles from public, anon, authenticated;
revoke all on budget_private.pro_clients from public, anon, authenticated;
revoke all on budget_private.pro_transactions from public, anon, authenticated;

create or replace function public.budget_pro_status()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;

  select jsonb_build_object(
    'enabled', coalesce((select enabled from budget_private.pro_modules where user_id=auth.uid()), false),
    'profileConfigured', exists(
      select 1 from budget_private.pro_profiles
      where user_id=auth.uid() and length(trim(business_name)) > 0
    )
  ) into result;

  return result;
end $$;

create or replace function public.budget_pro_toggle(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;

  insert into budget_private.pro_modules(user_id, enabled, updated_at)
  values(auth.uid(), p_enabled, now())
  on conflict(user_id) do update
    set enabled=excluded.enabled, updated_at=now();

  if p_enabled then
    insert into budget_private.pro_profiles(user_id)
    values(auth.uid())
    on conflict(user_id) do nothing;
  end if;

  return public.budget_pro_status();
end $$;

create or replace function public.budget_pro_load()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  is_enabled boolean;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;

  select coalesce(enabled,false) into is_enabled
  from budget_private.pro_modules
  where user_id=auth.uid();

  if not coalesce(is_enabled,false) then
    return jsonb_build_object('enabled',false);
  end if;

  insert into budget_private.pro_profiles(user_id)
  values(auth.uid())
  on conflict(user_id) do nothing;

  select jsonb_build_object(
    'enabled', true,
    'profile', jsonb_build_object(
      'businessName', p.business_name,
      'legalStatus', p.legal_status,
      'activityType', p.activity_type,
      'siret', coalesce(p.siret,''),
      'contributionRate', p.contribution_rate,
      'taxRate', p.tax_rate,
      'vatEnabled', p.vat_enabled,
      'vatRate', p.vat_rate
    ),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'email', coalesce(c.email,''),
        'phone', coalesce(c.phone,''),
        'notes', coalesce(c.notes,'')
      ) order by lower(c.name))
      from budget_private.pro_clients c
      where c.user_id=auth.uid()
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'kind', t.kind,
        'label', t.label,
        'amount', t.amount,
        'date', t.transaction_date,
        'category', coalesce(t.category,''),
        'clientId', t.client_id,
        'vatAmount', t.vat_amount,
        'paid', t.paid,
        'notes', coalesce(t.notes,'')
      ) order by t.transaction_date desc, t.created_at desc)
      from budget_private.pro_transactions t
      where t.user_id=auth.uid()
    ), '[]'::jsonb)
  ) into result
  from budget_private.pro_profiles p
  where p.user_id=auth.uid();

  return result;
end $$;

create or replace function public.budget_pro_profile_save(p_profile jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  business_name text := trim(coalesce(p_profile->>'businessName',''));
  legal_status text := coalesce(p_profile->>'legalStatus','micro');
  activity_type text := coalesce(p_profile->>'activityType','service');
  siret_value text := nullif(regexp_replace(coalesce(p_profile->>'siret',''),'[^0-9]','','g'),'');
  contribution numeric := coalesce((p_profile->>'contributionRate')::numeric,0);
  tax numeric := coalesce((p_profile->>'taxRate')::numeric,0);
  vat_enabled_value boolean := coalesce((p_profile->>'vatEnabled')::boolean,false);
  vat numeric := coalesce((p_profile->>'vatRate')::numeric,20);
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(business_name) > 160 then raise exception 'Nom d’activité trop long'; end if;
  if legal_status not in ('micro','ei','eurl','sasu','sarl','sas','other') then raise exception 'Statut juridique invalide'; end if;
  if activity_type not in ('service','commerce','mixed','liberal','other') then raise exception 'Type d’activité invalide'; end if;
  if siret_value is not null and length(siret_value) <> 14 then raise exception 'Le SIRET doit contenir 14 chiffres'; end if;
  if contribution < 0 or contribution > 100 or tax < 0 or tax > 100 or vat < 0 or vat > 100 then raise exception 'Taux invalide'; end if;

  insert into budget_private.pro_profiles(
    user_id,business_name,legal_status,activity_type,siret,
    contribution_rate,tax_rate,vat_enabled,vat_rate,updated_at
  ) values(
    auth.uid(),business_name,legal_status,activity_type,siret_value,
    contribution,tax,vat_enabled_value,vat,now()
  )
  on conflict(user_id) do update set
    business_name=excluded.business_name,
    legal_status=excluded.legal_status,
    activity_type=excluded.activity_type,
    siret=excluded.siret,
    contribution_rate=excluded.contribution_rate,
    tax_rate=excluded.tax_rate,
    vat_enabled=excluded.vat_enabled,
    vat_rate=excluded.vat_rate,
    updated_at=now();

  return public.budget_pro_load();
end $$;

create or replace function public.budget_pro_client_save(p_client jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  client_id uuid;
  raw_id text := nullif(p_client->>'id','');
  client_name text := trim(coalesce(p_client->>'name',''));
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(client_name) < 1 or length(client_name) > 160 then raise exception 'Nom client invalide'; end if;

  if raw_id is null then
    insert into budget_private.pro_clients(user_id,name,email,phone,notes)
    values(
      auth.uid(), client_name,
      nullif(trim(coalesce(p_client->>'email','')),''),
      nullif(trim(coalesce(p_client->>'phone','')),''),
      nullif(trim(coalesce(p_client->>'notes','')),'')
    ) returning id into client_id;
  else
    client_id := raw_id::uuid;
    update budget_private.pro_clients set
      name=client_name,
      email=nullif(trim(coalesce(p_client->>'email','')),''),
      phone=nullif(trim(coalesce(p_client->>'phone','')),''),
      notes=nullif(trim(coalesce(p_client->>'notes','')),''),
      updated_at=now()
    where id=client_id and user_id=auth.uid();
    if not found then raise exception 'Client introuvable'; end if;
  end if;

  return public.budget_pro_load();
end $$;

create or replace function public.budget_pro_client_delete(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  delete from budget_private.pro_clients where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Client introuvable'; end if;
  return public.budget_pro_load();
end $$;

create or replace function public.budget_pro_transaction_save(p_transaction jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  transaction_id uuid;
  raw_id text := nullif(p_transaction->>'id','');
  kind_value text := coalesce(p_transaction->>'kind','income');
  label_value text := trim(coalesce(p_transaction->>'label',''));
  amount_value bigint := coalesce((p_transaction->>'amount')::bigint,0);
  date_value date := coalesce((p_transaction->>'date')::date,(now() at time zone 'Europe/Paris')::date);
  category_value text := nullif(trim(coalesce(p_transaction->>'category','')),'');
  client_value uuid := nullif(p_transaction->>'clientId','')::uuid;
  vat_value bigint := coalesce((p_transaction->>'vatAmount')::bigint,0);
  paid_value boolean := coalesce((p_transaction->>'paid')::boolean,true);
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if kind_value not in ('income','expense') then raise exception 'Type d’opération invalide'; end if;
  if length(label_value) < 1 or length(label_value) > 200 then raise exception 'Libellé invalide'; end if;
  if amount_value <= 0 or amount_value > 1000000000000 then raise exception 'Montant invalide'; end if;
  if vat_value < 0 or vat_value > amount_value then raise exception 'TVA invalide'; end if;
  if date_value > (now() at time zone 'Europe/Paris')::date + 365 then raise exception 'Date invalide'; end if;
  if client_value is not null and not exists(
    select 1 from budget_private.pro_clients where id=client_value and user_id=auth.uid()
  ) then raise exception 'Client invalide'; end if;

  if raw_id is null then
    insert into budget_private.pro_transactions(
      user_id,kind,label,amount,transaction_date,category,client_id,vat_amount,paid,notes
    ) values(
      auth.uid(),kind_value,label_value,amount_value,date_value,category_value,client_value,
      vat_value,paid_value,nullif(trim(coalesce(p_transaction->>'notes','')),'')
    ) returning id into transaction_id;
  else
    transaction_id := raw_id::uuid;
    update budget_private.pro_transactions set
      kind=kind_value,
      label=label_value,
      amount=amount_value,
      transaction_date=date_value,
      category=category_value,
      client_id=client_value,
      vat_amount=vat_value,
      paid=paid_value,
      notes=nullif(trim(coalesce(p_transaction->>'notes','')),''),
      updated_at=now()
    where id=transaction_id and user_id=auth.uid();
    if not found then raise exception 'Opération introuvable'; end if;
  end if;

  return public.budget_pro_load();
end $$;

create or replace function public.budget_pro_transaction_delete(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  delete from budget_private.pro_transactions where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Opération introuvable'; end if;
  return public.budget_pro_load();
end $$;

revoke execute on function public.budget_pro_status() from public, anon, authenticated;
revoke execute on function public.budget_pro_toggle(boolean) from public, anon, authenticated;
revoke execute on function public.budget_pro_load() from public, anon, authenticated;
revoke execute on function public.budget_pro_profile_save(jsonb) from public, anon, authenticated;
revoke execute on function public.budget_pro_client_save(jsonb) from public, anon, authenticated;
revoke execute on function public.budget_pro_client_delete(uuid) from public, anon, authenticated;
revoke execute on function public.budget_pro_transaction_save(jsonb) from public, anon, authenticated;
revoke execute on function public.budget_pro_transaction_delete(uuid) from public, anon, authenticated;

grant usage on schema public to authenticated;
grant execute on function public.budget_pro_status() to authenticated;
grant execute on function public.budget_pro_toggle(boolean) to authenticated;
grant execute on function public.budget_pro_load() to authenticated;
grant execute on function public.budget_pro_profile_save(jsonb) to authenticated;
grant execute on function public.budget_pro_client_save(jsonb) to authenticated;
grant execute on function public.budget_pro_client_delete(uuid) to authenticated;
grant execute on function public.budget_pro_transaction_save(jsonb) to authenticated;
grant execute on function public.budget_pro_transaction_delete(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
