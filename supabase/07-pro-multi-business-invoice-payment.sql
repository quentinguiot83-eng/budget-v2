-- Wimm / budget-v2 — Module Pro V3.1 : multi-entreprises + factures payées => encaissement
-- À exécuter APRÈS 06-pro-business-suite.sql et 06b-pro-suite-compat.sql.
-- Script transactionnel et réexécutable ; les données existantes sont conservées.
-- Après succès, OUI : le texte peut être supprimé du SQL Editor. Conservez ce fichier dans GitHub.

begin;

-- ---------------------------------------------------------------------------
-- Entreprises et entreprise active
-- ---------------------------------------------------------------------------
create table if not exists budget_private.pro_businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mon entreprise' check (length(trim(name)) between 1 and 160),
  legal_status text not null default 'micro' check (legal_status in ('micro','ei','eurl','sasu','sarl','sas','other')),
  activity_type text not null default 'service' check (activity_type in ('service','commerce','mixed','liberal','other')),
  siret text,
  contribution_rate numeric(6,3) not null default 0 check (contribution_rate between 0 and 100),
  tax_rate numeric(6,3) not null default 0 check (tax_rate between 0 and 100),
  vat_enabled boolean not null default false,
  vat_rate numeric(6,3) not null default 20 check (vat_rate between 0 and 100),
  address text,
  postal_code text,
  city text,
  email text,
  phone text,
  iban text,
  invoice_prefix text not null default 'FAC',
  next_number integer not null default 1 check (next_number > 0),
  footer_note text,
  account_name text not null default 'Compte professionnel',
  opening_balance bigint not null default 0 check (abs(opening_balance) <= 1000000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pro_businesses_user_idx on budget_private.pro_businesses(user_id, created_at);

create table if not exists budget_private.pro_business_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_business_id uuid references budget_private.pro_businesses(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table budget_private.pro_businesses enable row level security;
alter table budget_private.pro_business_preferences enable row level security;
revoke all on budget_private.pro_businesses,budget_private.pro_business_preferences from public,anon,authenticated;

-- Première entreprise à partir des réglages existants.
insert into budget_private.pro_businesses(
  user_id,name,legal_status,activity_type,siret,contribution_rate,tax_rate,vat_enabled,vat_rate,
  address,postal_code,city,email,phone,iban,invoice_prefix,next_number,footer_note,account_name,opening_balance
)
select p.user_id,
       coalesce(nullif(trim(p.business_name),''),'Mon entreprise'),
       p.legal_status,p.activity_type,p.siret,p.contribution_rate,p.tax_rate,p.vat_enabled,p.vat_rate,
       b.address,b.postal_code,b.city,b.email,b.phone,b.iban,coalesce(b.invoice_prefix,'FAC'),coalesce(b.next_number,1),b.footer_note,
       coalesce(a.name,'Compte professionnel'),coalesce(a.opening_balance,0)
from budget_private.pro_profiles p
left join budget_private.pro_billing_settings b on b.user_id=p.user_id
left join budget_private.pro_accounts a on a.user_id=p.user_id
where not exists(select 1 from budget_private.pro_businesses x where x.user_id=p.user_id);

insert into budget_private.pro_businesses(user_id,name)
select m.user_id,'Mon entreprise'
from budget_private.pro_modules m
where not exists(select 1 from budget_private.pro_businesses x where x.user_id=m.user_id);

insert into budget_private.pro_business_preferences(user_id,active_business_id)
select u.user_id,
       (select b.id from budget_private.pro_businesses b where b.user_id=u.user_id order by b.created_at,b.id limit 1)
from (
  select user_id from budget_private.pro_businesses
  union select user_id from budget_private.pro_modules
) u
on conflict(user_id) do update set
  active_business_id=coalesce(budget_private.pro_business_preferences.active_business_id,excluded.active_business_id),
  updated_at=now();

create or replace function budget_private.active_business_id(p_user uuid)
returns uuid language sql stable security definer set search_path='' as $$
  select coalesce(
    (select p.active_business_id from budget_private.pro_business_preferences p
      join budget_private.pro_businesses b on b.id=p.active_business_id and b.user_id=p_user
      where p.user_id=p_user),
    (select b.id from budget_private.pro_businesses b where b.user_id=p_user order by b.created_at,b.id limit 1)
  );
$$;
revoke all on function budget_private.active_business_id(uuid) from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- Rattachement des données existantes à leur entreprise
-- ---------------------------------------------------------------------------
alter table budget_private.pro_clients add column if not exists business_id uuid references budget_private.pro_businesses(id) on delete restrict;
alter table budget_private.pro_products add column if not exists business_id uuid references budget_private.pro_businesses(id) on delete restrict;
alter table budget_private.pro_transactions add column if not exists business_id uuid references budget_private.pro_businesses(id) on delete restrict;
alter table budget_private.pro_invoices add column if not exists business_id uuid references budget_private.pro_businesses(id) on delete restrict;
alter table budget_private.pro_events add column if not exists business_id uuid references budget_private.pro_businesses(id) on delete restrict;

update budget_private.pro_clients t set business_id=budget_private.active_business_id(t.user_id) where business_id is null;
update budget_private.pro_products t set business_id=budget_private.active_business_id(t.user_id) where business_id is null;
update budget_private.pro_transactions t set business_id=budget_private.active_business_id(t.user_id) where business_id is null;
update budget_private.pro_invoices t set business_id=budget_private.active_business_id(t.user_id) where business_id is null;
update budget_private.pro_events t set business_id=budget_private.active_business_id(t.user_id) where business_id is null;

alter table budget_private.pro_clients alter column business_id set not null;
alter table budget_private.pro_products alter column business_id set not null;
alter table budget_private.pro_transactions alter column business_id set not null;
alter table budget_private.pro_invoices alter column business_id set not null;
alter table budget_private.pro_events alter column business_id set not null;

create index if not exists pro_clients_business_idx on budget_private.pro_clients(user_id,business_id,name);
create index if not exists pro_products_business_idx on budget_private.pro_products(user_id,business_id,active,name);
create index if not exists pro_transactions_business_date_idx on budget_private.pro_transactions(user_id,business_id,transaction_date desc);
create index if not exists pro_invoices_business_date_idx on budget_private.pro_invoices(user_id,business_id,issue_date desc);
create index if not exists pro_events_business_start_idx on budget_private.pro_events(user_id,business_id,starts_at);

-- La numérotation est indépendante par entreprise.
alter table budget_private.pro_invoices drop constraint if exists pro_invoices_user_id_invoice_number_key;
drop index if exists budget_private.pro_invoices_user_id_invoice_number_key;
create unique index if not exists pro_invoices_business_number_uidx
  on budget_private.pro_invoices(user_id,business_id,invoice_number);

-- Affectation automatique de l'entreprise active aux nouvelles lignes.
create or replace function budget_private.assign_active_business()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.business_id is null then
    new.business_id := budget_private.active_business_id(new.user_id);
  end if;
  if new.business_id is null or not exists(
    select 1 from budget_private.pro_businesses b where b.id=new.business_id and b.user_id=new.user_id
  ) then
    raise exception 'Entreprise professionnelle introuvable';
  end if;
  return new;
end $$;
revoke all on function budget_private.assign_active_business() from public,anon,authenticated;

do $$ begin
  drop trigger if exists pro_clients_assign_business on budget_private.pro_clients;
  create trigger pro_clients_assign_business before insert on budget_private.pro_clients for each row execute function budget_private.assign_active_business();
  drop trigger if exists pro_products_assign_business on budget_private.pro_products;
  create trigger pro_products_assign_business before insert on budget_private.pro_products for each row execute function budget_private.assign_active_business();
  drop trigger if exists pro_transactions_assign_business on budget_private.pro_transactions;
  create trigger pro_transactions_assign_business before insert on budget_private.pro_transactions for each row execute function budget_private.assign_active_business();
  drop trigger if exists pro_invoices_assign_business on budget_private.pro_invoices;
  create trigger pro_invoices_assign_business before insert on budget_private.pro_invoices for each row execute function budget_private.assign_active_business();
  drop trigger if exists pro_events_assign_business on budget_private.pro_events;
  create trigger pro_events_assign_business before insert on budget_private.pro_events for each row execute function budget_private.assign_active_business();
end $$;

-- ---------------------------------------------------------------------------
-- Compatibilité : les anciennes tables restent synchronisées avec l'entreprise active
-- ---------------------------------------------------------------------------
create or replace function budget_private.sync_active_business(p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare b budget_private.pro_businesses;
begin
  select * into b from budget_private.pro_businesses
  where id=budget_private.active_business_id(p_user) and user_id=p_user;
  if b.id is null then return; end if;

  insert into budget_private.pro_profiles(user_id,business_name,legal_status,activity_type,siret,contribution_rate,tax_rate,vat_enabled,vat_rate,updated_at)
  values(p_user,b.name,b.legal_status,b.activity_type,b.siret,b.contribution_rate,b.tax_rate,b.vat_enabled,b.vat_rate,now())
  on conflict(user_id) do update set business_name=excluded.business_name,legal_status=excluded.legal_status,activity_type=excluded.activity_type,siret=excluded.siret,contribution_rate=excluded.contribution_rate,tax_rate=excluded.tax_rate,vat_enabled=excluded.vat_enabled,vat_rate=excluded.vat_rate,updated_at=now();

  insert into budget_private.pro_billing_settings(user_id,address,postal_code,city,email,phone,iban,invoice_prefix,next_number,footer_note,updated_at)
  values(p_user,b.address,b.postal_code,b.city,b.email,b.phone,b.iban,b.invoice_prefix,b.next_number,b.footer_note,now())
  on conflict(user_id) do update set address=excluded.address,postal_code=excluded.postal_code,city=excluded.city,email=excluded.email,phone=excluded.phone,iban=excluded.iban,invoice_prefix=excluded.invoice_prefix,next_number=excluded.next_number,footer_note=excluded.footer_note,updated_at=now();

  insert into budget_private.pro_accounts(user_id,name,opening_balance,updated_at)
  values(p_user,b.account_name,b.opening_balance,now())
  on conflict(user_id) do update set name=excluded.name,opening_balance=excluded.opening_balance,updated_at=now();
end $$;
revoke all on function budget_private.sync_active_business(uuid) from public,anon,authenticated;

create or replace function budget_private.sync_profile_to_business()
returns trigger language plpgsql security definer set search_path='' as $$
declare bid uuid := budget_private.active_business_id(new.user_id);
begin
  if bid is not null then
    update budget_private.pro_businesses set name=coalesce(nullif(trim(new.business_name),''),name),legal_status=new.legal_status,activity_type=new.activity_type,siret=new.siret,contribution_rate=new.contribution_rate,tax_rate=new.tax_rate,vat_enabled=new.vat_enabled,vat_rate=new.vat_rate,updated_at=now() where id=bid and user_id=new.user_id;
  end if;
  return new;
end $$;

create or replace function budget_private.sync_billing_to_business()
returns trigger language plpgsql security definer set search_path='' as $$
declare bid uuid := budget_private.active_business_id(new.user_id);
begin
  if bid is not null then
    update budget_private.pro_businesses set address=new.address,postal_code=new.postal_code,city=new.city,email=new.email,phone=new.phone,iban=new.iban,invoice_prefix=new.invoice_prefix,next_number=new.next_number,footer_note=new.footer_note,updated_at=now() where id=bid and user_id=new.user_id;
  end if;
  return new;
end $$;

create or replace function budget_private.sync_account_to_business()
returns trigger language plpgsql security definer set search_path='' as $$
declare bid uuid := budget_private.active_business_id(new.user_id);
begin
  if bid is not null then
    update budget_private.pro_businesses set account_name=new.name,opening_balance=new.opening_balance,updated_at=now() where id=bid and user_id=new.user_id;
  end if;
  return new;
end $$;

revoke all on function budget_private.sync_profile_to_business() from public,anon,authenticated;
revoke all on function budget_private.sync_billing_to_business() from public,anon,authenticated;
revoke all on function budget_private.sync_account_to_business() from public,anon,authenticated;

do $$ begin
  drop trigger if exists pro_profile_sync_business on budget_private.pro_profiles;
  create trigger pro_profile_sync_business after insert or update on budget_private.pro_profiles for each row execute function budget_private.sync_profile_to_business();
  drop trigger if exists pro_billing_sync_business on budget_private.pro_billing_settings;
  create trigger pro_billing_sync_business after insert or update on budget_private.pro_billing_settings for each row execute function budget_private.sync_billing_to_business();
  drop trigger if exists pro_account_sync_business on budget_private.pro_accounts;
  create trigger pro_account_sync_business after insert or update on budget_private.pro_accounts for each row execute function budget_private.sync_account_to_business();
end $$;

-- ---------------------------------------------------------------------------
-- Gestion des entreprises
-- ---------------------------------------------------------------------------
create or replace function public.budget_pro_businesses_list()
returns jsonb language plpgsql security definer set search_path='' as $$
declare active_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  active_id := budget_private.active_business_id(auth.uid());
  return jsonb_build_object(
    'activeBusinessId',active_id,
    'businesses',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',b.id,'name',b.name,'legalStatus',b.legal_status,'activityType',b.activity_type,'siret',coalesce(b.siret,''),
        'contributionRate',b.contribution_rate,'taxRate',b.tax_rate,'vatEnabled',b.vat_enabled,'vatRate',b.vat_rate,
        'address',coalesce(b.address,''),'postalCode',coalesce(b.postal_code,''),'city',coalesce(b.city,''),'email',coalesce(b.email,''),'phone',coalesce(b.phone,''),'iban',coalesce(b.iban,''),
        'invoicePrefix',b.invoice_prefix,'footerNote',coalesce(b.footer_note,''),'accountName',b.account_name,'openingBalance',b.opening_balance
      ) order by b.created_at,b.name)
      from budget_private.pro_businesses b where b.user_id=auth.uid()
    ),'[]'::jsonb)
  );
end $$;

create or replace function public.budget_pro_business_save(p_business jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  raw_id text := nullif(p_business->>'id','');
  bid uuid;
  name_value text := trim(coalesce(p_business->>'name',''));
  siret_value text := nullif(regexp_replace(coalesce(p_business->>'siret',''),'[^0-9]','','g'),'');
  legal_value text := coalesce(p_business->>'legalStatus','micro');
  activity_value text := coalesce(p_business->>'activityType','service');
  prefix_value text := upper(trim(coalesce(p_business->>'invoicePrefix','FAC')));
  contribution_value numeric := coalesce((p_business->>'contributionRate')::numeric,0);
  tax_value numeric := coalesce((p_business->>'taxRate')::numeric,0);
  vat_value numeric := coalesce((p_business->>'vatRate')::numeric,20);
  opening_value bigint := coalesce((p_business->>'openingBalance')::bigint,0);
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(name_value)<1 or length(name_value)>160 then raise exception 'Nom d’entreprise invalide'; end if;
  if legal_value not in ('micro','ei','eurl','sasu','sarl','sas','other') then raise exception 'Statut juridique invalide'; end if;
  if activity_value not in ('service','commerce','mixed','liberal','other') then raise exception 'Type d’activité invalide'; end if;
  if siret_value is not null and length(siret_value)<>14 then raise exception 'Le SIRET doit contenir 14 chiffres'; end if;
  if prefix_value !~ '^[A-Z0-9_-]{1,12}$' then raise exception 'Préfixe de facture invalide'; end if;
  if contribution_value<0 or contribution_value>100 or tax_value<0 or tax_value>100 or vat_value<0 or vat_value>100 then raise exception 'Taux invalide'; end if;
  if abs(opening_value)>1000000000000 then raise exception 'Solde de départ invalide'; end if;

  if raw_id is null then
    insert into budget_private.pro_businesses(
      user_id,name,legal_status,activity_type,siret,contribution_rate,tax_rate,vat_enabled,vat_rate,
      address,postal_code,city,email,phone,iban,invoice_prefix,footer_note,account_name,opening_balance
    ) values(
      auth.uid(),name_value,legal_value,activity_value,siret_value,contribution_value,tax_value,coalesce((p_business->>'vatEnabled')::boolean,false),vat_value,
      nullif(trim(coalesce(p_business->>'address','')),''),nullif(trim(coalesce(p_business->>'postalCode','')),''),nullif(trim(coalesce(p_business->>'city','')),''),nullif(trim(coalesce(p_business->>'email','')),''),nullif(trim(coalesce(p_business->>'phone','')),''),nullif(trim(coalesce(p_business->>'iban','')),''),prefix_value,nullif(trim(coalesce(p_business->>'footerNote','')),''),coalesce(nullif(trim(coalesce(p_business->>'accountName','')),''),'Compte professionnel'),opening_value
    ) returning id into bid;
  else
    bid := raw_id::uuid;
    update budget_private.pro_businesses set
      name=name_value,legal_status=legal_value,activity_type=activity_value,siret=siret_value,contribution_rate=contribution_value,tax_rate=tax_value,vat_enabled=coalesce((p_business->>'vatEnabled')::boolean,false),vat_rate=vat_value,
      address=nullif(trim(coalesce(p_business->>'address','')),''),postal_code=nullif(trim(coalesce(p_business->>'postalCode','')),''),city=nullif(trim(coalesce(p_business->>'city','')),''),email=nullif(trim(coalesce(p_business->>'email','')),''),phone=nullif(trim(coalesce(p_business->>'phone','')),''),iban=nullif(trim(coalesce(p_business->>'iban','')),''),invoice_prefix=prefix_value,footer_note=nullif(trim(coalesce(p_business->>'footerNote','')),''),account_name=coalesce(nullif(trim(coalesce(p_business->>'accountName','')),''),'Compte professionnel'),opening_balance=opening_value,updated_at=now()
    where id=bid and user_id=auth.uid();
    if not found then raise exception 'Entreprise introuvable'; end if;
  end if;

  insert into budget_private.pro_business_preferences(user_id,active_business_id,updated_at)
  values(auth.uid(),bid,now()) on conflict(user_id) do update set active_business_id=excluded.active_business_id,updated_at=now();
  perform budget_private.sync_active_business(auth.uid());
  return public.budget_pro_businesses_list();
end $$;

create or replace function public.budget_pro_business_select(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from budget_private.pro_businesses where id=p_id and user_id=auth.uid()) then raise exception 'Entreprise introuvable'; end if;
  insert into budget_private.pro_business_preferences(user_id,active_business_id,updated_at)
  values(auth.uid(),p_id,now()) on conflict(user_id) do update set active_business_id=excluded.active_business_id,updated_at=now();
  perform budget_private.sync_active_business(auth.uid());
  return public.budget_pro_businesses_list();
end $$;

create or replace function public.budget_pro_business_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare replacement uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from budget_private.pro_businesses where id=p_id and user_id=auth.uid()) then raise exception 'Entreprise introuvable'; end if;
  if (select count(*) from budget_private.pro_businesses where user_id=auth.uid())<=1 then raise exception 'Vous devez conserver au moins une entreprise'; end if;
  if exists(select 1 from budget_private.pro_transactions where user_id=auth.uid() and business_id=p_id)
     or exists(select 1 from budget_private.pro_invoices where user_id=auth.uid() and business_id=p_id)
     or exists(select 1 from budget_private.pro_clients where user_id=auth.uid() and business_id=p_id)
     or exists(select 1 from budget_private.pro_products where user_id=auth.uid() and business_id=p_id)
     or exists(select 1 from budget_private.pro_events where user_id=auth.uid() and business_id=p_id)
  then raise exception 'Cette entreprise contient des données. Supprimez ou transférez d’abord ses éléments.'; end if;

  if budget_private.active_business_id(auth.uid())=p_id then
    select id into replacement from budget_private.pro_businesses where user_id=auth.uid() and id<>p_id order by created_at,id limit 1;
    update budget_private.pro_business_preferences set active_business_id=replacement,updated_at=now() where user_id=auth.uid();
  end if;
  delete from budget_private.pro_businesses where id=p_id and user_id=auth.uid();
  perform budget_private.sync_active_business(auth.uid());
  return public.budget_pro_businesses_list();
end $$;

-- Les nouveaux comptes Pro créent aussi automatiquement une première entreprise.
create or replace function public.budget_pro_toggle(p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into budget_private.pro_modules(user_id,enabled,updated_at) values(auth.uid(),p_enabled,now())
  on conflict(user_id) do update set enabled=excluded.enabled,updated_at=now();
  if p_enabled then
    insert into budget_private.pro_profiles(user_id) values(auth.uid()) on conflict(user_id) do nothing;
    insert into budget_private.pro_accounts(user_id) values(auth.uid()) on conflict(user_id) do nothing;
    insert into budget_private.pro_billing_settings(user_id) values(auth.uid()) on conflict(user_id) do nothing;
    select id into bid from budget_private.pro_businesses where user_id=auth.uid() order by created_at,id limit 1;
    if bid is null then
      insert into budget_private.pro_businesses(user_id,name) values(auth.uid(),'Mon entreprise') returning id into bid;
    end if;
    insert into budget_private.pro_business_preferences(user_id,active_business_id,updated_at) values(auth.uid(),bid,now())
    on conflict(user_id) do update set active_business_id=coalesce(budget_private.pro_business_preferences.active_business_id,excluded.active_business_id),updated_at=now();
    perform budget_private.sync_active_business(auth.uid());
  end if;
  return public.budget_pro_status();
end $$;

-- ---------------------------------------------------------------------------
-- Chargement V3 filtré sur l'entreprise active
-- ---------------------------------------------------------------------------
create or replace function public.budget_pro_suite_load()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  result jsonb; enabled_value boolean; bid uuid; b budget_private.pro_businesses; account_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select coalesce(enabled,false) into enabled_value from budget_private.pro_modules where user_id=auth.uid();
  if not coalesce(enabled_value,false) then return jsonb_build_object('enabled',false); end if;

  bid := budget_private.active_business_id(auth.uid());
  if bid is null then
    insert into budget_private.pro_businesses(user_id,name) values(auth.uid(),'Mon entreprise') returning id into bid;
    insert into budget_private.pro_business_preferences(user_id,active_business_id) values(auth.uid(),bid)
    on conflict(user_id) do update set active_business_id=excluded.active_business_id,updated_at=now();
  end if;
  select * into b from budget_private.pro_businesses where id=bid and user_id=auth.uid();
  select id into account_uuid from budget_private.pro_accounts where user_id=auth.uid();
  if account_uuid is null then
    insert into budget_private.pro_accounts(user_id,name,opening_balance) values(auth.uid(),b.account_name,b.opening_balance) returning id into account_uuid;
  end if;

  select jsonb_build_object(
    'enabled',true,
    'activeBusinessId',bid,
    'businesses',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name) order by x.created_at,x.name) from budget_private.pro_businesses x where x.user_id=auth.uid()),'[]'::jsonb),
    'profile',jsonb_build_object('businessName',b.name,'legalStatus',b.legal_status,'activityType',b.activity_type,'siret',coalesce(b.siret,''),'contributionRate',b.contribution_rate,'taxRate',b.tax_rate,'vatEnabled',b.vat_enabled,'vatRate',b.vat_rate),
    'account',jsonb_build_object('id',account_uuid,'name',b.account_name,'openingBalance',b.opening_balance),
    'billing',jsonb_build_object('address',coalesce(b.address,''),'postalCode',coalesce(b.postal_code,''),'city',coalesce(b.city,''),'email',coalesce(b.email,''),'phone',coalesce(b.phone,''),'iban',coalesce(b.iban,''),'invoicePrefix',b.invoice_prefix,'footerNote',coalesce(b.footer_note,'')),
    'clients',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'companyName',coalesce(c.company_name,''),'email',coalesce(c.email,''),'phone',coalesce(c.phone,''),'address',coalesce(c.address,''),'postalCode',coalesce(c.postal_code,''),'city',coalesce(c.city,''),'siret',coalesce(c.siret,''),'notes',coalesce(c.notes,'')) order by lower(c.name)) from budget_private.pro_clients c where c.user_id=auth.uid() and c.business_id=bid),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'name',x.name,'description',coalesce(x.description,''),'unitPrice',x.unit_price,'vatRate',x.vat_rate,'active',x.active) order by x.active desc,lower(x.name)) from budget_private.pro_products x where x.user_id=auth.uid() and x.business_id=bid),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'kind',t.kind,'label',t.label,'amount',t.amount,'date',t.transaction_date,'category',coalesce(t.category,''),'clientId',t.client_id,'accountId',t.account_id,'vatAmount',t.vat_amount,'paid',t.paid,'notes',coalesce(t.notes,''),'personalTransactionId',t.personal_transaction_id,'contributionPeriodKey',t.contribution_period_key,'taxPeriodKey',t.tax_period_key,'paymentMethod',t.payment_method,'productId',t.product_id,'invoiceId',t.invoice_id) order by t.transaction_date desc,t.created_at desc) from budget_private.pro_transactions t where t.user_id=auth.uid() and t.business_id=bid),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'number',i.invoice_number,'clientId',i.client_id,'clientSnapshot',i.client_snapshot,'sellerSnapshot',i.seller_snapshot,'issueDate',i.issue_date,'dueDate',i.due_date,'status',i.status,'paymentMethod',i.payment_method,'paidDate',i.paid_date,'notes',coalesce(i.notes,''),'totalHt',i.total_ht,'totalVat',i.total_vat,'totalTtc',i.total_ttc,'items',coalesce((select jsonb_agg(jsonb_build_object('id',it.id,'productId',it.product_id,'description',it.description,'quantity',it.quantity,'unitPrice',it.unit_price,'vatRate',it.vat_rate) order by it.line_order) from budget_private.pro_invoice_items it where it.invoice_id=i.id),'[]'::jsonb)) order by i.issue_date desc,i.created_at desc) from budget_private.pro_invoices i where i.user_id=auth.uid() and i.business_id=bid),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'clientId',e.client_id,'title',e.title,'eventType',e.event_type,'startsAt',e.starts_at,'endsAt',e.ends_at,'location',coalesce(e.location,''),'notes',coalesce(e.notes,'')) order by e.starts_at) from budget_private.pro_events e where e.user_id=auth.uid() and e.business_id=bid),'[]'::jsonb)
  ) into result;
  return result;
end $$;

-- Les anciennes actions continuent de renvoyer le nouvel état filtré.
create or replace function public.budget_pro_load()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  return public.budget_pro_suite_load();
end $$;

-- ---------------------------------------------------------------------------
-- Une facture payée crée automatiquement son encaissement
-- ---------------------------------------------------------------------------
create or replace function public.budget_pro_invoice_mark_paid(p_id uuid,p_payment_method text,p_paid_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  inv budget_private.pro_invoices;
  paid_value date := coalesce(p_paid_date,current_date);
  account_value uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_payment_method not in ('card','check','cash','transfer','other') then raise exception 'Mode de règlement invalide'; end if;
  select * into inv from budget_private.pro_invoices where id=p_id and user_id=auth.uid();
  if inv.id is null then raise exception 'Facture introuvable'; end if;
  if inv.status='cancelled' then raise exception 'Une facture annulée ne peut pas être encaissée'; end if;

  update budget_private.pro_invoices set status='paid',payment_method=p_payment_method,paid_date=paid_value,updated_at=now()
  where id=p_id and user_id=auth.uid();

  select id into account_value from budget_private.pro_accounts where user_id=auth.uid();
  if account_value is null then
    insert into budget_private.pro_accounts(user_id) values(auth.uid()) returning id into account_value;
  end if;

  if not exists(select 1 from budget_private.pro_transactions where user_id=auth.uid() and invoice_id=p_id and kind='income') then
    insert into budget_private.pro_transactions(
      user_id,business_id,kind,label,amount,transaction_date,category,client_id,account_id,vat_amount,paid,notes,payment_method,invoice_id
    ) values(
      auth.uid(),inv.business_id,'income','Facture '||inv.invoice_number,inv.total_ttc,paid_value,'Facture',inv.client_id,account_value,inv.total_vat,true,null,p_payment_method,inv.id
    );
  else
    update budget_private.pro_transactions set amount=inv.total_ttc,transaction_date=paid_value,vat_amount=inv.total_vat,payment_method=p_payment_method,paid=true,updated_at=now()
    where user_id=auth.uid() and invoice_id=p_id and kind='income';
  end if;
  return public.budget_pro_suite_load();
end $$;

-- Rattrapage des factures déjà marquées payées avant cette migration.
insert into budget_private.pro_transactions(
  user_id,business_id,kind,label,amount,transaction_date,category,client_id,account_id,vat_amount,paid,notes,payment_method,invoice_id
)
select i.user_id,i.business_id,'income','Facture '||i.invoice_number,i.total_ttc,coalesce(i.paid_date,i.issue_date),'Facture',i.client_id,a.id,i.total_vat,true,null,coalesce(i.payment_method,'transfer'),i.id
from budget_private.pro_invoices i
join budget_private.pro_accounts a on a.user_id=i.user_id
where i.status='paid'
  and not exists(select 1 from budget_private.pro_transactions t where t.invoice_id=i.id and t.kind='income');

-- ---------------------------------------------------------------------------
-- Droits RPC
-- ---------------------------------------------------------------------------
revoke execute on function public.budget_pro_businesses_list() from public,anon,authenticated;
revoke execute on function public.budget_pro_business_save(jsonb) from public,anon,authenticated;
revoke execute on function public.budget_pro_business_select(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_business_delete(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_suite_load() from public,anon,authenticated;
revoke execute on function public.budget_pro_load() from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_mark_paid(uuid,text,date) from public,anon,authenticated;
revoke execute on function public.budget_pro_toggle(boolean) from public,anon,authenticated;

grant usage on schema public to authenticated;
grant execute on function public.budget_pro_businesses_list() to authenticated;
grant execute on function public.budget_pro_business_save(jsonb) to authenticated;
grant execute on function public.budget_pro_business_select(uuid) to authenticated;
grant execute on function public.budget_pro_business_delete(uuid) to authenticated;
grant execute on function public.budget_pro_suite_load() to authenticated;
grant execute on function public.budget_pro_load() to authenticated;
grant execute on function public.budget_pro_invoice_mark_paid(uuid,text,date) to authenticated;
grant execute on function public.budget_pro_toggle(boolean) to authenticated;

notify pgrst,'reload schema';
commit;
