-- Wimm / budget-v2 — Module Pro V3 : clients, facturation, catalogue, agenda et règlements
-- À exécuter APRÈS 05-pro-tax-sync-delete.sql.
-- Script transactionnel et réexécutable ; il conserve toutes les données existantes.
-- Après succès, OUI : le texte peut être supprimé du SQL Editor. Conservez ce fichier dans GitHub.

begin;

-- Fiches clients enrichies ----------------------------------------------------
alter table budget_private.pro_clients add column if not exists company_name text;
alter table budget_private.pro_clients add column if not exists address text;
alter table budget_private.pro_clients add column if not exists postal_code text;
alter table budget_private.pro_clients add column if not exists city text;
alter table budget_private.pro_clients add column if not exists siret text;

-- Encaissements : règlement + lien éventuel vers catalogue / facture --------
alter table budget_private.pro_transactions add column if not exists payment_method text;
alter table budget_private.pro_transactions add column if not exists product_id uuid;
alter table budget_private.pro_transactions add column if not exists invoice_id uuid;

alter table budget_private.pro_transactions drop constraint if exists pro_transactions_payment_method_check;
alter table budget_private.pro_transactions add constraint pro_transactions_payment_method_check
  check (payment_method is null or payment_method in ('card','check','cash','transfer','other'));

-- Paramètres de facturation --------------------------------------------------
create table if not exists budget_private.pro_billing_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  address text,
  postal_code text,
  city text,
  email text,
  phone text,
  iban text,
  invoice_prefix text not null default 'FAC',
  next_number integer not null default 1 check (next_number > 0),
  footer_note text,
  updated_at timestamptz not null default now()
);

-- Catalogue -----------------------------------------------------------------
create table if not exists budget_private.pro_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'service' check (kind in ('product','service')),
  name text not null check (length(trim(name)) between 1 and 160),
  description text,
  unit_price bigint not null default 0 check (unit_price >= 0 and unit_price <= 1000000000000),
  vat_rate numeric(6,3) not null default 0 check (vat_rate between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pro_products_user_idx on budget_private.pro_products(user_id, active, name);

-- Factures ------------------------------------------------------------------
create table if not exists budget_private.pro_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null,
  client_id uuid references budget_private.pro_clients(id) on delete set null,
  client_snapshot jsonb not null default '{}'::jsonb,
  seller_snapshot jsonb not null default '{}'::jsonb,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'draft' check (status in ('draft','sent','paid','cancelled')),
  payment_method text check (payment_method is null or payment_method in ('card','check','cash','transfer','other')),
  paid_date date,
  notes text,
  total_ht bigint not null default 0,
  total_vat bigint not null default 0,
  total_ttc bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, invoice_number)
);
create index if not exists pro_invoices_user_date_idx on budget_private.pro_invoices(user_id, issue_date desc);

create table if not exists budget_private.pro_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references budget_private.pro_invoices(id) on delete cascade,
  product_id uuid references budget_private.pro_products(id) on delete set null,
  description text not null check (length(trim(description)) between 1 and 300),
  quantity numeric(12,3) not null default 1 check (quantity > 0 and quantity <= 1000000),
  unit_price bigint not null default 0 check (unit_price >= 0 and unit_price <= 1000000000000),
  vat_rate numeric(6,3) not null default 0 check (vat_rate between 0 and 100),
  line_order integer not null default 0
);
create index if not exists pro_invoice_items_invoice_idx on budget_private.pro_invoice_items(invoice_id, line_order);

-- Agenda --------------------------------------------------------------------
create table if not exists budget_private.pro_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references budget_private.pro_clients(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 180),
  event_type text not null default 'appointment' check (event_type in ('appointment','shooting','deadline','admin','other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);
create index if not exists pro_events_user_start_idx on budget_private.pro_events(user_id, starts_at);

-- FK catalogue/facture des transactions une fois les tables créées ---------
do $$ begin
  if not exists(select 1 from pg_constraint where conname='pro_transactions_product_id_fkey' and conrelid='budget_private.pro_transactions'::regclass) then
    alter table budget_private.pro_transactions add constraint pro_transactions_product_id_fkey
      foreign key(product_id) references budget_private.pro_products(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='pro_transactions_invoice_id_fkey' and conrelid='budget_private.pro_transactions'::regclass) then
    alter table budget_private.pro_transactions add constraint pro_transactions_invoice_id_fkey
      foreign key(invoice_id) references budget_private.pro_invoices(id) on delete set null;
  end if;
end $$;

alter table budget_private.pro_billing_settings enable row level security;
alter table budget_private.pro_products enable row level security;
alter table budget_private.pro_invoices enable row level security;
alter table budget_private.pro_invoice_items enable row level security;
alter table budget_private.pro_events enable row level security;
revoke all on budget_private.pro_billing_settings,budget_private.pro_products,budget_private.pro_invoices,budget_private.pro_invoice_items,budget_private.pro_events from public,anon,authenticated;

-- Client CRUD enrichi --------------------------------------------------------
create or replace function public.budget_pro_client_save(p_client jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  client_id uuid;
  raw_id text := nullif(p_client->>'id','');
  client_name text := trim(coalesce(p_client->>'name',''));
  siret_value text := nullif(regexp_replace(coalesce(p_client->>'siret',''),'[^0-9]','','g'),'');
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(client_name) < 1 or length(client_name) > 160 then raise exception 'Nom client invalide'; end if;
  if siret_value is not null and length(siret_value) <> 14 then raise exception 'SIRET client invalide'; end if;
  if raw_id is null then
    insert into budget_private.pro_clients(user_id,name,company_name,email,phone,address,postal_code,city,siret,notes)
    values(auth.uid(),client_name,nullif(trim(coalesce(p_client->>'companyName','')),''),nullif(trim(coalesce(p_client->>'email','')),''),nullif(trim(coalesce(p_client->>'phone','')),''),nullif(trim(coalesce(p_client->>'address','')),''),nullif(trim(coalesce(p_client->>'postalCode','')),''),nullif(trim(coalesce(p_client->>'city','')),''),siret_value,nullif(trim(coalesce(p_client->>'notes','')),''))
    returning id into client_id;
  else
    client_id := raw_id::uuid;
    update budget_private.pro_clients set
      name=client_name,
      company_name=nullif(trim(coalesce(p_client->>'companyName','')),''),
      email=nullif(trim(coalesce(p_client->>'email','')),''),
      phone=nullif(trim(coalesce(p_client->>'phone','')),''),
      address=nullif(trim(coalesce(p_client->>'address','')),''),
      postal_code=nullif(trim(coalesce(p_client->>'postalCode','')),''),
      city=nullif(trim(coalesce(p_client->>'city','')),''),
      siret=siret_value,
      notes=nullif(trim(coalesce(p_client->>'notes','')),''),updated_at=now()
    where id=client_id and user_id=auth.uid();
    if not found then raise exception 'Client introuvable'; end if;
  end if;
  return public.budget_pro_suite_load();
end $$;

-- Paramètres facturation -----------------------------------------------------
create or replace function public.budget_pro_billing_save(p_settings jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prefix_value text := upper(trim(coalesce(p_settings->>'invoicePrefix','FAC')));
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if prefix_value !~ '^[A-Z0-9_-]{1,12}$' then raise exception 'Préfixe de facture invalide'; end if;
  insert into budget_private.pro_billing_settings(user_id,address,postal_code,city,email,phone,iban,invoice_prefix,footer_note,updated_at)
  values(auth.uid(),nullif(trim(coalesce(p_settings->>'address','')),''),nullif(trim(coalesce(p_settings->>'postalCode','')),''),nullif(trim(coalesce(p_settings->>'city','')),''),nullif(trim(coalesce(p_settings->>'email','')),''),nullif(trim(coalesce(p_settings->>'phone','')),''),nullif(trim(coalesce(p_settings->>'iban','')),''),prefix_value,nullif(trim(coalesce(p_settings->>'footerNote','')),''),now())
  on conflict(user_id) do update set address=excluded.address,postal_code=excluded.postal_code,city=excluded.city,email=excluded.email,phone=excluded.phone,iban=excluded.iban,invoice_prefix=excluded.invoice_prefix,footer_note=excluded.footer_note,updated_at=now();
  return public.budget_pro_suite_load();
end $$;

-- Catalogue -----------------------------------------------------------------
create or replace function public.budget_pro_product_save(p_product jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  raw_id text := nullif(p_product->>'id','');
  product_id uuid;
  kind_value text := coalesce(p_product->>'kind','service');
  name_value text := trim(coalesce(p_product->>'name',''));
  price_value bigint := coalesce((p_product->>'unitPrice')::bigint,0);
  vat_value numeric := coalesce((p_product->>'vatRate')::numeric,0);
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if kind_value not in ('product','service') then raise exception 'Type invalide'; end if;
  if length(name_value) < 1 or length(name_value) > 160 then raise exception 'Nom invalide'; end if;
  if price_value < 0 or vat_value < 0 or vat_value > 100 then raise exception 'Prix ou TVA invalide'; end if;
  if raw_id is null then
    insert into budget_private.pro_products(user_id,kind,name,description,unit_price,vat_rate,active)
    values(auth.uid(),kind_value,name_value,nullif(trim(coalesce(p_product->>'description','')),''),price_value,vat_value,coalesce((p_product->>'active')::boolean,true)) returning id into product_id;
  else
    product_id := raw_id::uuid;
    update budget_private.pro_products set kind=kind_value,name=name_value,description=nullif(trim(coalesce(p_product->>'description','')),''),unit_price=price_value,vat_rate=vat_value,active=coalesce((p_product->>'active')::boolean,true),updated_at=now()
    where id=product_id and user_id=auth.uid();
    if not found then raise exception 'Produit ou service introuvable'; end if;
  end if;
  return public.budget_pro_suite_load();
end $$;

create or replace function public.budget_pro_product_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  delete from budget_private.pro_products where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Produit ou service introuvable'; end if;
  return public.budget_pro_suite_load();
end $$;

-- Agenda --------------------------------------------------------------------
create or replace function public.budget_pro_event_save(p_event jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  raw_id text := nullif(p_event->>'id',''); event_id uuid;
  client_value uuid := nullif(p_event->>'clientId','')::uuid;
  type_value text := coalesce(p_event->>'eventType','appointment');
  title_value text := trim(coalesce(p_event->>'title',''));
  start_value timestamptz := (p_event->>'startsAt')::timestamptz;
  end_value timestamptz := (p_event->>'endsAt')::timestamptz;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(title_value)<1 or type_value not in ('appointment','shooting','deadline','admin','other') or start_value is null or end_value is null or end_value<start_value then raise exception 'Événement invalide'; end if;
  if client_value is not null and not exists(select 1 from budget_private.pro_clients where id=client_value and user_id=auth.uid()) then raise exception 'Client invalide'; end if;
  if raw_id is null then
    insert into budget_private.pro_events(user_id,client_id,title,event_type,starts_at,ends_at,location,notes)
    values(auth.uid(),client_value,title_value,type_value,start_value,end_value,nullif(trim(coalesce(p_event->>'location','')),''),nullif(trim(coalesce(p_event->>'notes','')),'')) returning id into event_id;
  else
    event_id:=raw_id::uuid;
    update budget_private.pro_events set client_id=client_value,title=title_value,event_type=type_value,starts_at=start_value,ends_at=end_value,location=nullif(trim(coalesce(p_event->>'location','')),''),notes=nullif(trim(coalesce(p_event->>'notes','')),''),updated_at=now()
    where id=event_id and user_id=auth.uid();
    if not found then raise exception 'Événement introuvable'; end if;
  end if;
  return public.budget_pro_suite_load();
end $$;

create or replace function public.budget_pro_event_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  delete from budget_private.pro_events where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Événement introuvable'; end if;
  return public.budget_pro_suite_load();
end $$;

-- Factures ------------------------------------------------------------------
create or replace function public.budget_pro_invoice_save(p_invoice jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  raw_id text := nullif(p_invoice->>'id',''); invoice_id_value uuid;
  client_value uuid := nullif(p_invoice->>'clientId','')::uuid;
  issue_value date := coalesce((p_invoice->>'issueDate')::date,current_date);
  due_value date := nullif(p_invoice->>'dueDate','')::date;
  status_value text := coalesce(p_invoice->>'status','draft');
  number_value text;
  settings budget_private.pro_billing_settings;
  profile budget_private.pro_profiles;
  client budget_private.pro_clients;
  item jsonb; qty numeric; unit_value bigint; vat numeric; line_ht bigint; line_vat bigint;
  total_ht_value bigint := 0; total_vat_value bigint := 0; ord integer := 0;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if client_value is null then raise exception 'Choisissez un client'; end if;
  select * into client from budget_private.pro_clients where id=client_value and user_id=auth.uid();
  if client.id is null then raise exception 'Client invalide'; end if;
  if status_value not in ('draft','sent') then raise exception 'Statut invalide'; end if;
  if jsonb_typeof(p_invoice->'items') is distinct from 'array' or jsonb_array_length(p_invoice->'items')=0 then raise exception 'Ajoutez au moins une ligne'; end if;
  insert into budget_private.pro_billing_settings(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select * into settings from budget_private.pro_billing_settings where user_id=auth.uid() for update;
  select * into profile from budget_private.pro_profiles where user_id=auth.uid();

  for item in select * from jsonb_array_elements(p_invoice->'items') loop
    qty := coalesce((item->>'quantity')::numeric,0); unit_value := coalesce((item->>'unitPrice')::bigint,0); vat := coalesce((item->>'vatRate')::numeric,0);
    if qty<=0 or unit_value<0 or vat<0 or vat>100 or length(trim(coalesce(item->>'description','')))<1 then raise exception 'Ligne de facture invalide'; end if;
    line_ht := round(qty*unit_value); line_vat := round(line_ht*vat/100); total_ht_value:=total_ht_value+line_ht; total_vat_value:=total_vat_value+line_vat;
  end loop;

  if raw_id is null then
    number_value := settings.invoice_prefix || '-' || to_char(issue_value,'YYYY') || '-' || lpad(settings.next_number::text,4,'0');
    update budget_private.pro_billing_settings set next_number=next_number+1,updated_at=now() where user_id=auth.uid();
    insert into budget_private.pro_invoices(user_id,invoice_number,client_id,client_snapshot,seller_snapshot,issue_date,due_date,status,notes,total_ht,total_vat,total_ttc)
    values(auth.uid(),number_value,client_value,
      jsonb_build_object('name',client.name,'companyName',coalesce(client.company_name,''),'email',coalesce(client.email,''),'phone',coalesce(client.phone,''),'address',coalesce(client.address,''),'postalCode',coalesce(client.postal_code,''),'city',coalesce(client.city,''),'siret',coalesce(client.siret,'')),
      jsonb_build_object('businessName',profile.business_name,'siret',coalesce(profile.siret,''),'address',coalesce(settings.address,''),'postalCode',coalesce(settings.postal_code,''),'city',coalesce(settings.city,''),'email',coalesce(settings.email,''),'phone',coalesce(settings.phone,''),'iban',coalesce(settings.iban,''),'footerNote',coalesce(settings.footer_note,'')),
      issue_value,due_value,status_value,nullif(trim(coalesce(p_invoice->>'notes','')),''),total_ht_value,total_vat_value,total_ht_value+total_vat_value) returning id into invoice_id_value;
  else
    invoice_id_value:=raw_id::uuid;
    update budget_private.pro_invoices set client_id=client_value,client_snapshot=jsonb_build_object('name',client.name,'companyName',coalesce(client.company_name,''),'email',coalesce(client.email,''),'phone',coalesce(client.phone,''),'address',coalesce(client.address,''),'postalCode',coalesce(client.postal_code,''),'city',coalesce(client.city,''),'siret',coalesce(client.siret,'')),issue_date=issue_value,due_date=due_value,status=status_value,notes=nullif(trim(coalesce(p_invoice->>'notes','')),''),total_ht=total_ht_value,total_vat=total_vat_value,total_ttc=total_ht_value+total_vat_value,updated_at=now()
    where id=invoice_id_value and user_id=auth.uid() and status in ('draft','sent');
    if not found then raise exception 'Facture introuvable ou verrouillée'; end if;
    delete from budget_private.pro_invoice_items where invoice_id=invoice_id_value;
  end if;

  for item in select * from jsonb_array_elements(p_invoice->'items') loop
    ord:=ord+1;
    insert into budget_private.pro_invoice_items(invoice_id,product_id,description,quantity,unit_price,vat_rate,line_order)
    values(invoice_id_value,nullif(item->>'productId','')::uuid,trim(item->>'description'),(item->>'quantity')::numeric,(item->>'unitPrice')::bigint,(item->>'vatRate')::numeric,ord);
  end loop;
  return public.budget_pro_suite_load();
end $$;

create or replace function public.budget_pro_invoice_mark_paid(p_id uuid,p_payment_method text,p_paid_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_payment_method not in ('card','check','cash','transfer','other') then raise exception 'Mode de règlement invalide'; end if;
  update budget_private.pro_invoices set status='paid',payment_method=p_payment_method,paid_date=coalesce(p_paid_date,current_date),updated_at=now()
  where id=p_id and user_id=auth.uid() and status in ('draft','sent');
  if not found then raise exception 'Facture introuvable ou déjà finalisée'; end if;
  return public.budget_pro_suite_load();
end $$;

create or replace function public.budget_pro_invoice_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  delete from budget_private.pro_invoices where id=p_id and user_id=auth.uid() and status<>'paid';
  if not found then raise exception 'Facture introuvable ou déjà payée'; end if;
  return public.budget_pro_suite_load();
end $$;

-- Transaction save : ajoute mode de règlement + produit ----------------------
create or replace function public.budget_pro_transaction_save(p_transaction jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  transaction_id uuid; account_value uuid;
  raw_id text := nullif(p_transaction->>'id',''); kind_value text := coalesce(p_transaction->>'kind','income');
  label_value text := trim(coalesce(p_transaction->>'label','')); amount_value bigint := coalesce((p_transaction->>'amount')::bigint,0);
  date_value date := coalesce((p_transaction->>'date')::date,(now() at time zone 'Europe/Paris')::date);
  category_value text := nullif(trim(coalesce(p_transaction->>'category','')),''); client_value uuid := nullif(p_transaction->>'clientId','')::uuid;
  product_value uuid := nullif(p_transaction->>'productId','')::uuid; vat_value bigint := coalesce((p_transaction->>'vatAmount')::bigint,0);
  paid_value boolean := coalesce((p_transaction->>'paid')::boolean,true); method_value text := nullif(p_transaction->>'paymentMethod','');
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if kind_value not in ('income','expense') then raise exception 'Type invalide'; end if;
  if length(label_value)<1 or amount_value<=0 or vat_value<0 or vat_value>amount_value then raise exception 'Opération invalide'; end if;
  if method_value is not null and method_value not in ('card','check','cash','transfer','other') then raise exception 'Mode de règlement invalide'; end if;
  if client_value is not null and not exists(select 1 from budget_private.pro_clients where id=client_value and user_id=auth.uid()) then raise exception 'Client invalide'; end if;
  if product_value is not null and not exists(select 1 from budget_private.pro_products where id=product_value and user_id=auth.uid()) then raise exception 'Produit invalide'; end if;
  select id into account_value from budget_private.pro_accounts where user_id=auth.uid();
  if account_value is null then insert into budget_private.pro_accounts(user_id) values(auth.uid()) returning id into account_value; end if;
  if raw_id is null then
    insert into budget_private.pro_transactions(user_id,kind,label,amount,transaction_date,category,client_id,account_id,vat_amount,paid,notes,payment_method,product_id)
    values(auth.uid(),kind_value,label_value,amount_value,date_value,category_value,client_value,account_value,vat_value,paid_value,nullif(trim(coalesce(p_transaction->>'notes','')),''),method_value,product_value) returning id into transaction_id;
  else
    transaction_id:=raw_id::uuid;
    update budget_private.pro_transactions set kind=kind_value,label=label_value,amount=amount_value,transaction_date=date_value,category=category_value,client_id=client_value,vat_amount=vat_value,paid=paid_value,notes=nullif(trim(coalesce(p_transaction->>'notes','')),''),payment_method=method_value,product_id=product_value,updated_at=now()
    where id=transaction_id and user_id=auth.uid() and kind in ('income','expense');
    if not found then raise exception 'Opération introuvable'; end if;
  end if;
  return public.budget_pro_suite_load();
end $$;

-- Chargement complet du nouvel espace Pro -----------------------------------
create or replace function public.budget_pro_suite_load()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; enabled_value boolean;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select coalesce(enabled,false) into enabled_value from budget_private.pro_modules where user_id=auth.uid();
  if not coalesce(enabled_value,false) then return jsonb_build_object('enabled',false); end if;
  insert into budget_private.pro_profiles(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  insert into budget_private.pro_accounts(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  insert into budget_private.pro_billing_settings(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select jsonb_build_object(
    'enabled',true,
    'profile',jsonb_build_object('businessName',p.business_name,'legalStatus',p.legal_status,'activityType',p.activity_type,'siret',coalesce(p.siret,''),'contributionRate',p.contribution_rate,'taxRate',p.tax_rate,'vatEnabled',p.vat_enabled,'vatRate',p.vat_rate),
    'account',(select jsonb_build_object('id',a.id,'name',a.name,'openingBalance',a.opening_balance) from budget_private.pro_accounts a where a.user_id=auth.uid()),
    'billing',(select jsonb_build_object('address',coalesce(b.address,''),'postalCode',coalesce(b.postal_code,''),'city',coalesce(b.city,''),'email',coalesce(b.email,''),'phone',coalesce(b.phone,''),'iban',coalesce(b.iban,''),'invoicePrefix',b.invoice_prefix,'footerNote',coalesce(b.footer_note,'')) from budget_private.pro_billing_settings b where b.user_id=auth.uid()),
    'clients',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'companyName',coalesce(c.company_name,''),'email',coalesce(c.email,''),'phone',coalesce(c.phone,''),'address',coalesce(c.address,''),'postalCode',coalesce(c.postal_code,''),'city',coalesce(c.city,''),'siret',coalesce(c.siret,''),'notes',coalesce(c.notes,'')) order by lower(c.name)) from budget_private.pro_clients c where c.user_id=auth.uid()),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'name',x.name,'description',coalesce(x.description,''),'unitPrice',x.unit_price,'vatRate',x.vat_rate,'active',x.active) order by x.active desc,lower(x.name)) from budget_private.pro_products x where x.user_id=auth.uid()),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'kind',t.kind,'label',t.label,'amount',t.amount,'date',t.transaction_date,'category',coalesce(t.category,''),'clientId',t.client_id,'accountId',t.account_id,'vatAmount',t.vat_amount,'paid',t.paid,'notes',coalesce(t.notes,''),'personalTransactionId',t.personal_transaction_id,'contributionPeriodKey',t.contribution_period_key,'taxPeriodKey',t.tax_period_key,'paymentMethod',t.payment_method,'productId',t.product_id,'invoiceId',t.invoice_id) order by t.transaction_date desc,t.created_at desc) from budget_private.pro_transactions t where t.user_id=auth.uid()),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'number',i.invoice_number,'clientId',i.client_id,'clientSnapshot',i.client_snapshot,'sellerSnapshot',i.seller_snapshot,'issueDate',i.issue_date,'dueDate',i.due_date,'status',i.status,'paymentMethod',i.payment_method,'paidDate',i.paid_date,'notes',coalesce(i.notes,''),'totalHt',i.total_ht,'totalVat',i.total_vat,'totalTtc',i.total_ttc,'items',coalesce((select jsonb_agg(jsonb_build_object('id',it.id,'productId',it.product_id,'description',it.description,'quantity',it.quantity,'unitPrice',it.unit_price,'vatRate',it.vat_rate) order by it.line_order) from budget_private.pro_invoice_items it where it.invoice_id=i.id),'[]'::jsonb)) order by i.issue_date desc,i.created_at desc) from budget_private.pro_invoices i where i.user_id=auth.uid()),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'clientId',e.client_id,'title',e.title,'eventType',e.event_type,'startsAt',e.starts_at,'endsAt',e.ends_at,'location',coalesce(e.location,''),'notes',coalesce(e.notes,'')) order by e.starts_at) from budget_private.pro_events e where e.user_id=auth.uid()),'[]'::jsonb)
  ) into result from budget_private.pro_profiles p where p.user_id=auth.uid();
  return result;
end $$;

-- Droits --------------------------------------------------------------------
revoke execute on function public.budget_pro_suite_load() from public,anon,authenticated;
revoke execute on function public.budget_pro_billing_save(jsonb) from public,anon,authenticated;
revoke execute on function public.budget_pro_product_save(jsonb) from public,anon,authenticated;
revoke execute on function public.budget_pro_product_delete(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_event_save(jsonb) from public,anon,authenticated;
revoke execute on function public.budget_pro_event_delete(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_save(jsonb) from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_mark_paid(uuid,text,date) from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_delete(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_transaction_save(jsonb) from public,anon,authenticated;
revoke execute on function public.budget_pro_client_save(jsonb) from public,anon,authenticated;

grant usage on schema public to authenticated;
grant execute on function public.budget_pro_suite_load() to authenticated;
grant execute on function public.budget_pro_billing_save(jsonb) to authenticated;
grant execute on function public.budget_pro_product_save(jsonb) to authenticated;
grant execute on function public.budget_pro_product_delete(uuid) to authenticated;
grant execute on function public.budget_pro_event_save(jsonb) to authenticated;
grant execute on function public.budget_pro_event_delete(uuid) to authenticated;
grant execute on function public.budget_pro_invoice_save(jsonb) to authenticated;
grant execute on function public.budget_pro_invoice_mark_paid(uuid,text,date) to authenticated;
grant execute on function public.budget_pro_invoice_delete(uuid) to authenticated;
grant execute on function public.budget_pro_transaction_save(jsonb) to authenticated;
grant execute on function public.budget_pro_client_save(jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
