-- Wimm / budget-v2 — Facturation Pro V2
-- À exécuter APRÈS 07-pro-multi-business-invoice-payment.sql.
-- Script transactionnel et réexécutable ; les données existantes sont conservées.
-- Après succès, OUI : le texte peut être supprimé du SQL Editor. Conservez ce fichier dans GitHub.

begin;

-- ---------------------------------------------------------------------------
-- Paramètres de facturation par entreprise
-- ---------------------------------------------------------------------------
alter table budget_private.pro_businesses add column if not exists quote_prefix text not null default 'DEV';
alter table budget_private.pro_businesses add column if not exists next_quote_number integer not null default 1 check (next_quote_number > 0);
alter table budget_private.pro_businesses add column if not exists vat_number text;
alter table budget_private.pro_businesses add column if not exists registration_text text;
alter table budget_private.pro_businesses add column if not exists capital_text text;
alter table budget_private.pro_businesses add column if not exists logo_data text;
alter table budget_private.pro_businesses add column if not exists default_payment_days integer not null default 30 check (default_payment_days between 0 and 365);
alter table budget_private.pro_businesses add column if not exists early_discount_text text not null default 'Escompte pour paiement anticipé : néant.';
alter table budget_private.pro_businesses add column if not exists late_penalty_text text not null default 'Pénalités de retard : taux BCE majoré de 10 points.';

-- ---------------------------------------------------------------------------
-- Fiches clients adaptées à la facturation B2B / B2C
-- ---------------------------------------------------------------------------
alter table budget_private.pro_clients add column if not exists client_type text not null default 'individual';
alter table budget_private.pro_clients add column if not exists billing_address text;
alter table budget_private.pro_clients add column if not exists billing_postal_code text;
alter table budget_private.pro_clients add column if not exists billing_city text;
alter table budget_private.pro_clients add column if not exists vat_number text;

alter table budget_private.pro_clients drop constraint if exists pro_clients_client_type_check;
alter table budget_private.pro_clients add constraint pro_clients_client_type_check
  check (client_type in ('individual','professional'));

update budget_private.pro_clients
set client_type='professional'
where client_type='individual'
  and (nullif(trim(coalesce(company_name,'')),'') is not null or nullif(trim(coalesce(siret,'')),'') is not null);

-- ---------------------------------------------------------------------------
-- Devis
-- ---------------------------------------------------------------------------
create table if not exists budget_private.pro_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references budget_private.pro_businesses(id) on delete restrict,
  quote_number text not null,
  client_id uuid references budget_private.pro_clients(id) on delete set null,
  client_snapshot jsonb not null default '{}'::jsonb,
  seller_snapshot jsonb not null default '{}'::jsonb,
  issue_date date not null default current_date,
  valid_until date,
  status text not null default 'draft' check (status in ('draft','sent','accepted','refused','expired')),
  notes text,
  total_ht bigint not null default 0,
  total_vat bigint not null default 0,
  total_ttc bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists budget_private.pro_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references budget_private.pro_quotes(id) on delete cascade,
  product_id uuid references budget_private.pro_products(id) on delete set null,
  description text not null check (length(trim(description)) between 1 and 300),
  quantity numeric(12,3) not null default 1 check (quantity > 0 and quantity <= 1000000),
  unit_price bigint not null default 0 check (unit_price >= 0 and unit_price <= 1000000000000),
  vat_rate numeric(6,3) not null default 0 check (vat_rate between 0 and 100),
  line_order integer not null default 0
);

create unique index if not exists pro_quotes_business_number_uidx
  on budget_private.pro_quotes(user_id,business_id,quote_number);
create index if not exists pro_quotes_business_date_idx
  on budget_private.pro_quotes(user_id,business_id,issue_date desc);
create index if not exists pro_quote_items_quote_idx
  on budget_private.pro_quote_items(quote_id,line_order);

alter table budget_private.pro_quotes enable row level security;
alter table budget_private.pro_quote_items enable row level security;
revoke all on budget_private.pro_quotes,budget_private.pro_quote_items from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- Factures : brouillon, émission verrouillée, paiement partiel
-- ---------------------------------------------------------------------------
alter table budget_private.pro_invoices add column if not exists service_date date;
alter table budget_private.pro_invoices add column if not exists purchase_order_number text;
alter table budget_private.pro_invoices add column if not exists operation_type text not null default 'services';
alter table budget_private.pro_invoices add column if not exists delivery_address text;
alter table budget_private.pro_invoices add column if not exists issued_at timestamptz;
alter table budget_private.pro_invoices add column if not exists source_quote_id uuid references budget_private.pro_quotes(id) on delete set null;

alter table budget_private.pro_invoices drop constraint if exists pro_invoices_operation_type_check;
alter table budget_private.pro_invoices add constraint pro_invoices_operation_type_check
  check (operation_type in ('goods','services','mixed'));

alter table budget_private.pro_invoices drop constraint if exists pro_invoices_status_check;
alter table budget_private.pro_invoices add constraint pro_invoices_status_check
  check (status in ('draft','sent','partially_paid','paid','cancelled'));

create unique index if not exists pro_invoice_source_quote_uidx
  on budget_private.pro_invoices(source_quote_id)
  where source_quote_id is not null and status <> 'cancelled';

create table if not exists budget_private.pro_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references budget_private.pro_businesses(id) on delete restrict,
  invoice_id uuid not null references budget_private.pro_invoices(id) on delete cascade,
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  payment_date date not null default current_date,
  payment_method text not null check (payment_method in ('card','check','cash','transfer','other')),
  transaction_id uuid unique references budget_private.pro_transactions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists pro_invoice_payments_invoice_idx on budget_private.pro_invoice_payments(invoice_id,payment_date);
create index if not exists pro_invoice_payments_business_idx on budget_private.pro_invoice_payments(user_id,business_id,payment_date desc);
alter table budget_private.pro_invoice_payments enable row level security;
revoke all on budget_private.pro_invoice_payments from public,anon,authenticated;

-- Factures historiques déjà finalisées : on les considère émises.
update budget_private.pro_invoices
set issued_at=coalesce(issued_at,created_at)
where status in ('sent','partially_paid','paid','cancelled') and issued_at is null;

-- Rattrapage des paiements déjà créés par la migration 07.
insert into budget_private.pro_invoice_payments(user_id,business_id,invoice_id,amount,payment_date,payment_method,transaction_id,notes)
select t.user_id,t.business_id,t.invoice_id,t.amount,t.transaction_date,coalesce(t.payment_method,'transfer'),t.id,'Paiement importé depuis l’encaissement existant'
from budget_private.pro_transactions t
join budget_private.pro_invoices i on i.id=t.invoice_id and i.user_id=t.user_id
where t.invoice_id is not null and t.kind='income' and t.paid
  and not exists(select 1 from budget_private.pro_invoice_payments p where p.transaction_id=t.id);

-- ---------------------------------------------------------------------------
-- Helpers de snapshots : une facture émise garde les coordonnées de l'époque.
-- ---------------------------------------------------------------------------
create or replace function budget_private.pro_seller_snapshot(p_user uuid,p_business uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'businessName',b.name,
    'legalStatus',b.legal_status,
    'activityType',b.activity_type,
    'siret',coalesce(b.siret,''),
    'siren',case when length(coalesce(b.siret,''))>=9 then left(b.siret,9) else '' end,
    'vatNumber',coalesce(b.vat_number,''),
    'registrationText',coalesce(b.registration_text,''),
    'capitalText',coalesce(b.capital_text,''),
    'address',coalesce(b.address,''),
    'postalCode',coalesce(b.postal_code,''),
    'city',coalesce(b.city,''),
    'email',coalesce(b.email,''),
    'phone',coalesce(b.phone,''),
    'iban',coalesce(b.iban,''),
    'logoData',coalesce(b.logo_data,''),
    'footerNote',coalesce(b.footer_note,''),
    'earlyDiscountText',coalesce(b.early_discount_text,'Escompte pour paiement anticipé : néant.'),
    'latePenaltyText',coalesce(b.late_penalty_text,'Pénalités de retard : taux BCE majoré de 10 points.'),
    'vatEnabled',b.vat_enabled,
    'vatRate',b.vat_rate
  )
  from budget_private.pro_businesses b
  where b.id=p_business and b.user_id=p_user;
$$;

create or replace function budget_private.pro_client_snapshot(p_user uuid,p_business uuid,p_client uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'name',c.name,
    'companyName',coalesce(c.company_name,''),
    'clientType',c.client_type,
    'email',coalesce(c.email,''),
    'phone',coalesce(c.phone,''),
    'address',coalesce(c.address,''),
    'postalCode',coalesce(c.postal_code,''),
    'city',coalesce(c.city,''),
    'billingAddress',coalesce(c.billing_address,c.address,''),
    'billingPostalCode',coalesce(c.billing_postal_code,c.postal_code,''),
    'billingCity',coalesce(c.billing_city,c.city,''),
    'siret',coalesce(c.siret,''),
    'siren',case when length(coalesce(c.siret,''))>=9 then left(c.siret,9) else '' end,
    'vatNumber',coalesce(c.vat_number,'')
  )
  from budget_private.pro_clients c
  where c.id=p_client and c.user_id=p_user and c.business_id=p_business;
$$;
revoke all on function budget_private.pro_seller_snapshot(uuid,uuid) from public,anon,authenticated;
revoke all on function budget_private.pro_client_snapshot(uuid,uuid,uuid) from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- Clients V2
-- ---------------------------------------------------------------------------
create or replace function public.budget_pro_client_save(p_client jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  client_id uuid;
  bid uuid := budget_private.active_business_id(auth.uid());
  raw_id text := nullif(p_client->>'id','');
  client_name text := trim(coalesce(p_client->>'name',''));
  siret_value text := nullif(regexp_replace(coalesce(p_client->>'siret',''),'[^0-9]','','g'),'');
  type_value text := coalesce(p_client->>'clientType','individual');
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if bid is null then raise exception 'Entreprise professionnelle introuvable'; end if;
  if length(client_name)<1 or length(client_name)>160 then raise exception 'Nom client invalide'; end if;
  if type_value not in ('individual','professional') then raise exception 'Type de client invalide'; end if;
  if siret_value is not null and length(siret_value)<>14 then raise exception 'SIRET client invalide'; end if;

  if raw_id is null then
    insert into budget_private.pro_clients(
      user_id,business_id,name,company_name,email,phone,address,postal_code,city,siret,notes,
      client_type,billing_address,billing_postal_code,billing_city,vat_number
    ) values(
      auth.uid(),bid,client_name,nullif(trim(coalesce(p_client->>'companyName','')),''),
      nullif(trim(coalesce(p_client->>'email','')),''),nullif(trim(coalesce(p_client->>'phone','')),''),
      nullif(trim(coalesce(p_client->>'address','')),''),nullif(trim(coalesce(p_client->>'postalCode','')),''),
      nullif(trim(coalesce(p_client->>'city','')),''),siret_value,nullif(trim(coalesce(p_client->>'notes','')),''),
      type_value,nullif(trim(coalesce(p_client->>'billingAddress','')),''),nullif(trim(coalesce(p_client->>'billingPostalCode','')),''),
      nullif(trim(coalesce(p_client->>'billingCity','')),''),nullif(trim(coalesce(p_client->>'vatNumber','')),'')
    ) returning id into client_id;
  else
    client_id:=raw_id::uuid;
    update budget_private.pro_clients set
      name=client_name,company_name=nullif(trim(coalesce(p_client->>'companyName','')),''),
      email=nullif(trim(coalesce(p_client->>'email','')),''),phone=nullif(trim(coalesce(p_client->>'phone','')),''),
      address=nullif(trim(coalesce(p_client->>'address','')),''),postal_code=nullif(trim(coalesce(p_client->>'postalCode','')),''),
      city=nullif(trim(coalesce(p_client->>'city','')),''),siret=siret_value,notes=nullif(trim(coalesce(p_client->>'notes','')),''),
      client_type=type_value,billing_address=nullif(trim(coalesce(p_client->>'billingAddress','')),''),
      billing_postal_code=nullif(trim(coalesce(p_client->>'billingPostalCode','')),''),billing_city=nullif(trim(coalesce(p_client->>'billingCity','')),''),
      vat_number=nullif(trim(coalesce(p_client->>'vatNumber','')),''),updated_at=now()
    where id=client_id and user_id=auth.uid() and business_id=bid;
    if not found then raise exception 'Client introuvable'; end if;
  end if;
  return public.budget_pro_suite_load();
end $$;

-- ---------------------------------------------------------------------------
-- Paramètres de facturation V2
-- ---------------------------------------------------------------------------
create or replace function public.budget_pro_billing_save(p_settings jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid := budget_private.active_business_id(auth.uid());
  invoice_prefix_value text := upper(trim(coalesce(p_settings->>'invoicePrefix','FAC')));
  quote_prefix_value text := upper(trim(coalesce(p_settings->>'quotePrefix','DEV')));
  days_value integer := coalesce((p_settings->>'defaultPaymentDays')::integer,30);
  logo_value text := nullif(p_settings->>'logoData','');
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if bid is null then raise exception 'Entreprise professionnelle introuvable'; end if;
  if invoice_prefix_value !~ '^[A-Z0-9_-]{1,12}$' then raise exception 'Préfixe de facture invalide'; end if;
  if quote_prefix_value !~ '^[A-Z0-9_-]{1,12}$' then raise exception 'Préfixe de devis invalide'; end if;
  if days_value<0 or days_value>365 then raise exception 'Délai de paiement invalide'; end if;
  if logo_value is not null and length(logo_value)>800000 then raise exception 'Logo trop volumineux'; end if;

  update budget_private.pro_businesses set
    address=nullif(trim(coalesce(p_settings->>'address','')),''),postal_code=nullif(trim(coalesce(p_settings->>'postalCode','')),''),
    city=nullif(trim(coalesce(p_settings->>'city','')),''),email=nullif(trim(coalesce(p_settings->>'email','')),''),
    phone=nullif(trim(coalesce(p_settings->>'phone','')),''),iban=nullif(trim(coalesce(p_settings->>'iban','')),''),
    invoice_prefix=invoice_prefix_value,quote_prefix=quote_prefix_value,
    vat_number=nullif(trim(coalesce(p_settings->>'vatNumber','')),''),registration_text=nullif(trim(coalesce(p_settings->>'registrationText','')),''),
    capital_text=nullif(trim(coalesce(p_settings->>'capitalText','')),''),logo_data=logo_value,default_payment_days=days_value,
    early_discount_text=coalesce(nullif(trim(coalesce(p_settings->>'earlyDiscountText','')),''),'Escompte pour paiement anticipé : néant.'),
    late_penalty_text=coalesce(nullif(trim(coalesce(p_settings->>'latePenaltyText','')),''),'Pénalités de retard : taux BCE majoré de 10 points.'),
    footer_note=nullif(trim(coalesce(p_settings->>'footerNote','')),''),updated_at=now()
  where id=bid and user_id=auth.uid();

  insert into budget_private.pro_billing_settings(user_id,address,postal_code,city,email,phone,iban,invoice_prefix,footer_note,updated_at)
  values(auth.uid(),nullif(trim(coalesce(p_settings->>'address','')),''),nullif(trim(coalesce(p_settings->>'postalCode','')),''),
    nullif(trim(coalesce(p_settings->>'city','')),''),nullif(trim(coalesce(p_settings->>'email','')),''),
    nullif(trim(coalesce(p_settings->>'phone','')),''),nullif(trim(coalesce(p_settings->>'iban','')),''),invoice_prefix_value,
    nullif(trim(coalesce(p_settings->>'footerNote','')),''),now())
  on conflict(user_id) do update set
    address=excluded.address,postal_code=excluded.postal_code,city=excluded.city,email=excluded.email,phone=excluded.phone,
    iban=excluded.iban,invoice_prefix=excluded.invoice_prefix,footer_note=excluded.footer_note,updated_at=now();

  return public.budget_pro_suite_load();
end $$;

-- ---------------------------------------------------------------------------
-- Devis CRUD + conversion
-- ---------------------------------------------------------------------------
create or replace function public.budget_pro_quote_save(p_quote jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid := budget_private.active_business_id(auth.uid());
  raw_id text := nullif(p_quote->>'id','');
  qid uuid; client_value uuid := nullif(p_quote->>'clientId','')::uuid;
  issue_value date := coalesce(nullif(p_quote->>'issueDate','')::date,current_date);
  valid_value date := coalesce(nullif(p_quote->>'validUntil','')::date,issue_value+30);
  client_row budget_private.pro_clients; business_row budget_private.pro_businesses;
  number_value text; item jsonb; qty numeric; unit_value bigint; vat numeric; line_ht bigint; line_vat bigint;
  total_ht_value bigint := 0; total_vat_value bigint := 0; ord integer := 0;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if bid is null then raise exception 'Entreprise professionnelle introuvable'; end if;
  if client_value is null then raise exception 'Choisissez un client'; end if;
  select * into client_row from budget_private.pro_clients where id=client_value and user_id=auth.uid() and business_id=bid;
  if client_row.id is null then raise exception 'Client invalide'; end if;
  select * into business_row from budget_private.pro_businesses where id=bid and user_id=auth.uid() for update;
  if valid_value<issue_value then raise exception 'Date de validité invalide'; end if;
  if jsonb_typeof(p_quote->'items')<>'array' or jsonb_array_length(p_quote->'items')<1 then raise exception 'Ajoutez au moins une ligne'; end if;

  for item in select * from jsonb_array_elements(p_quote->'items') loop
    qty:=coalesce((item->>'quantity')::numeric,0); unit_value:=coalesce((item->>'unitPrice')::bigint,-1); vat:=coalesce((item->>'vatRate')::numeric,0);
    if qty<=0 or unit_value<0 or vat<0 or vat>100 or length(trim(coalesce(item->>'description','')))<1 then raise exception 'Ligne de devis invalide'; end if;
    line_ht:=round(qty*unit_value); line_vat:=round(line_ht*vat/100); total_ht_value:=total_ht_value+line_ht; total_vat_value:=total_vat_value+line_vat;
  end loop;

  if raw_id is null then
    number_value:=business_row.quote_prefix||'-'||to_char(issue_value,'YYYY')||'-'||lpad(business_row.next_quote_number::text,4,'0');
    update budget_private.pro_businesses set next_quote_number=next_quote_number+1,updated_at=now() where id=bid and user_id=auth.uid();
    insert into budget_private.pro_quotes(user_id,business_id,quote_number,client_id,client_snapshot,seller_snapshot,issue_date,valid_until,status,notes,total_ht,total_vat,total_ttc)
    values(auth.uid(),bid,number_value,client_value,budget_private.pro_client_snapshot(auth.uid(),bid,client_value),budget_private.pro_seller_snapshot(auth.uid(),bid),issue_value,valid_value,'draft',nullif(trim(coalesce(p_quote->>'notes','')),''),total_ht_value,total_vat_value,total_ht_value+total_vat_value)
    returning id into qid;
  else
    qid:=raw_id::uuid;
    update budget_private.pro_quotes set
      client_id=client_value,client_snapshot=budget_private.pro_client_snapshot(auth.uid(),bid,client_value),seller_snapshot=budget_private.pro_seller_snapshot(auth.uid(),bid),
      issue_date=issue_value,valid_until=valid_value,notes=nullif(trim(coalesce(p_quote->>'notes','')),''),
      total_ht=total_ht_value,total_vat=total_vat_value,total_ttc=total_ht_value+total_vat_value,updated_at=now()
    where id=qid and user_id=auth.uid() and business_id=bid and status='draft';
    if not found then raise exception 'Devis introuvable ou verrouillé'; end if;
    delete from budget_private.pro_quote_items where quote_id=qid;
  end if;

  for item in select * from jsonb_array_elements(p_quote->'items') loop
    ord:=ord+1;
    insert into budget_private.pro_quote_items(quote_id,product_id,description,quantity,unit_price,vat_rate,line_order)
    values(qid,nullif(item->>'productId','')::uuid,trim(item->>'description'),(item->>'quantity')::numeric,(item->>'unitPrice')::bigint,(item->>'vatRate')::numeric,ord);
  end loop;
  return public.budget_pro_suite_load();
end $$;

create or replace function public.budget_pro_quote_status(p_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bid uuid := budget_private.active_business_id(auth.uid()); current_status text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_status not in ('sent','accepted','refused') then raise exception 'Statut de devis invalide'; end if;
  select status into current_status from budget_private.pro_quotes where id=p_id and user_id=auth.uid() and business_id=bid for update;
  if current_status is null then raise exception 'Devis introuvable'; end if;
  if current_status='accepted' then raise exception 'Ce devis est déjà accepté'; end if;
  if current_status='refused' and p_status<>'sent' then raise exception 'Ce devis est refusé'; end if;
  update budget_private.pro_quotes set status=p_status,updated_at=now() where id=p_id;
  return public.budget_pro_suite_load();
end $$;

create or replace function public.budget_pro_quote_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bid uuid := budget_private.active_business_id(auth.uid());
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  delete from budget_private.pro_quotes where id=p_id and user_id=auth.uid() and business_id=bid and status='draft';
  if not found then raise exception 'Seul un devis brouillon peut être supprimé'; end if;
  return public.budget_pro_suite_load();
end $$;

create or replace function public.budget_pro_quote_convert(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid := budget_private.active_business_id(auth.uid()); q budget_private.pro_quotes; inv_id uuid;
  business_row budget_private.pro_businesses; item budget_private.pro_quote_items;
  draft_number text := 'DRAFT-'||replace(gen_random_uuid()::text,'-','');
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into q from budget_private.pro_quotes where id=p_id and user_id=auth.uid() and business_id=bid for update;
  if q.id is null then raise exception 'Devis introuvable'; end if;
  if q.status<>'accepted' then raise exception 'Le devis doit être accepté avant conversion'; end if;
  if exists(select 1 from budget_private.pro_invoices where source_quote_id=q.id and status<>'cancelled') then raise exception 'Une facture existe déjà pour ce devis'; end if;
  select * into business_row from budget_private.pro_businesses where id=bid and user_id=auth.uid();

  insert into budget_private.pro_invoices(
    user_id,business_id,invoice_number,client_id,client_snapshot,seller_snapshot,issue_date,due_date,status,notes,
    total_ht,total_vat,total_ttc,service_date,operation_type,source_quote_id
  ) values(
    auth.uid(),bid,draft_number,q.client_id,q.client_snapshot,budget_private.pro_seller_snapshot(auth.uid(),bid),current_date,current_date+business_row.default_payment_days,'draft',
    'Créée depuis le devis '||q.quote_number,q.total_ht,q.total_vat,q.total_ttc,current_date,
    case business_row.activity_type when 'commerce' then 'goods' when 'mixed' then 'mixed' else 'services' end,q.id
  ) returning id into inv_id;

  for item in select * from budget_private.pro_quote_items where quote_id=q.id order by line_order loop
    insert into budget_private.pro_invoice_items(invoice_id,product_id,description,quantity,unit_price,vat_rate,line_order)
    values(inv_id,item.product_id,item.description,item.quantity,item.unit_price,item.vat_rate,item.line_order);
  end loop;
  return public.budget_pro_suite_load();
end $$;

-- ---------------------------------------------------------------------------
-- Factures V2
-- ---------------------------------------------------------------------------
create or replace function public.budget_pro_invoice_save(p_invoice jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid := budget_private.active_business_id(auth.uid());
  raw_id text := nullif(p_invoice->>'id',''); inv_id uuid; client_value uuid := nullif(p_invoice->>'clientId','')::uuid;
  issue_value date := coalesce(nullif(p_invoice->>'issueDate','')::date,current_date);
  due_value date; service_value date := coalesce(nullif(p_invoice->>'serviceDate','')::date,issue_value);
  operation_value text := coalesce(p_invoice->>'operationType','services'); source_quote uuid := nullif(p_invoice->>'sourceQuoteId','')::uuid;
  business_row budget_private.pro_businesses; client_row budget_private.pro_clients;
  item jsonb; qty numeric; unit_value bigint; vat numeric; line_ht bigint; line_vat bigint;
  total_ht_value bigint := 0; total_vat_value bigint := 0; ord integer := 0;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if bid is null then raise exception 'Entreprise professionnelle introuvable'; end if;
  if operation_value not in ('goods','services','mixed') then raise exception 'Type d’opération invalide'; end if;
  select * into business_row from budget_private.pro_businesses where id=bid and user_id=auth.uid();
  due_value:=coalesce(nullif(p_invoice->>'dueDate','')::date,issue_value+business_row.default_payment_days);
  if due_value<issue_value then raise exception 'Échéance invalide'; end if;
  if client_value is null then raise exception 'Choisissez un client'; end if;
  select * into client_row from budget_private.pro_clients where id=client_value and user_id=auth.uid() and business_id=bid;
  if client_row.id is null then raise exception 'Client invalide'; end if;
  if jsonb_typeof(p_invoice->'items')<>'array' or jsonb_array_length(p_invoice->'items')<1 then raise exception 'Ajoutez au moins une ligne'; end if;

  for item in select * from jsonb_array_elements(p_invoice->'items') loop
    qty:=coalesce((item->>'quantity')::numeric,0); unit_value:=coalesce((item->>'unitPrice')::bigint,-1); vat:=coalesce((item->>'vatRate')::numeric,0);
    if qty<=0 or unit_value<0 or vat<0 or vat>100 or length(trim(coalesce(item->>'description','')))<1 then raise exception 'Ligne de facture invalide'; end if;
    line_ht:=round(qty*unit_value); line_vat:=round(line_ht*vat/100); total_ht_value:=total_ht_value+line_ht; total_vat_value:=total_vat_value+line_vat;
  end loop;

  if raw_id is null then
    insert into budget_private.pro_invoices(
      user_id,business_id,invoice_number,client_id,client_snapshot,seller_snapshot,issue_date,due_date,status,notes,total_ht,total_vat,total_ttc,
      service_date,purchase_order_number,operation_type,delivery_address,source_quote_id
    ) values(
      auth.uid(),bid,'DRAFT-'||replace(gen_random_uuid()::text,'-',''),client_value,budget_private.pro_client_snapshot(auth.uid(),bid,client_value),
      budget_private.pro_seller_snapshot(auth.uid(),bid),issue_value,due_value,'draft',nullif(trim(coalesce(p_invoice->>'notes','')),''),
      total_ht_value,total_vat_value,total_ht_value+total_vat_value,service_value,nullif(trim(coalesce(p_invoice->>'purchaseOrderNumber','')),''),
      operation_value,nullif(trim(coalesce(p_invoice->>'deliveryAddress','')),''),source_quote
    ) returning id into inv_id;
  else
    inv_id:=raw_id::uuid;
    update budget_private.pro_invoices set
      client_id=client_value,client_snapshot=budget_private.pro_client_snapshot(auth.uid(),bid,client_value),seller_snapshot=budget_private.pro_seller_snapshot(auth.uid(),bid),
      issue_date=issue_value,due_date=due_value,service_date=service_value,purchase_order_number=nullif(trim(coalesce(p_invoice->>'purchaseOrderNumber','')),''),
      operation_type=operation_value,delivery_address=nullif(trim(coalesce(p_invoice->>'deliveryAddress','')),''),notes=nullif(trim(coalesce(p_invoice->>'notes','')),''),
      total_ht=total_ht_value,total_vat=total_vat_value,total_ttc=total_ht_value+total_vat_value,updated_at=now()
    where id=inv_id and user_id=auth.uid() and business_id=bid and status='draft';
    if not found then raise exception 'Facture introuvable ou déjà émise'; end if;
    delete from budget_private.pro_invoice_items where invoice_id=inv_id;
  end if;

  for item in select * from jsonb_array_elements(p_invoice->'items') loop
    ord:=ord+1;
    insert into budget_private.pro_invoice_items(invoice_id,product_id,description,quantity,unit_price,vat_rate,line_order)
    values(inv_id,nullif(item->>'productId','')::uuid,trim(item->>'description'),(item->>'quantity')::numeric,(item->>'unitPrice')::bigint,(item->>'vatRate')::numeric,ord);
  end loop;
  return public.budget_pro_suite_load();
end $$;

create or replace function public.budget_pro_invoice_issue(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid := budget_private.active_business_id(auth.uid()); inv budget_private.pro_invoices; b budget_private.pro_businesses; number_value text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into inv from budget_private.pro_invoices where id=p_id and user_id=auth.uid() and business_id=bid for update;
  if inv.id is null then raise exception 'Facture introuvable'; end if;
  if inv.status<>'draft' then raise exception 'Cette facture est déjà émise'; end if;
  if exists(select 1 from budget_private.pro_invoices x where x.user_id=auth.uid() and x.business_id=bid and x.status<>'draft' and x.status<>'cancelled' and x.issue_date>inv.issue_date) then
    raise exception 'La date d’émission ne peut pas précéder une facture déjà émise';
  end if;
  select * into b from budget_private.pro_businesses where id=bid and user_id=auth.uid() for update;
  number_value:=case when inv.invoice_number like 'DRAFT-%' then b.invoice_prefix||'-'||to_char(inv.issue_date,'YYYY')||'-'||lpad(b.next_number::text,4,'0') else inv.invoice_number end;
  if inv.invoice_number like 'DRAFT-%' then update budget_private.pro_businesses set next_number=next_number+1,updated_at=now() where id=bid; end if;
  update budget_private.pro_invoices set
    invoice_number=number_value,status='sent',issued_at=now(),seller_snapshot=budget_private.pro_seller_snapshot(auth.uid(),bid),
    client_snapshot=budget_private.pro_client_snapshot(auth.uid(),bid,inv.client_id),updated_at=now()
  where id=inv.id;
  return public.budget_pro_suite_load();
end $$;

create or replace function public.budget_pro_invoice_duplicate(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid := budget_private.active_business_id(auth.uid()); src budget_private.pro_invoices; b budget_private.pro_businesses; new_id uuid; item budget_private.pro_invoice_items;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into src from budget_private.pro_invoices where id=p_id and user_id=auth.uid() and business_id=bid;
  if src.id is null then raise exception 'Facture introuvable'; end if;
  select * into b from budget_private.pro_businesses where id=bid and user_id=auth.uid();
  insert into budget_private.pro_invoices(user_id,business_id,invoice_number,client_id,client_snapshot,seller_snapshot,issue_date,due_date,status,notes,total_ht,total_vat,total_ttc,service_date,purchase_order_number,operation_type,delivery_address)
  values(auth.uid(),bid,'DRAFT-'||replace(gen_random_uuid()::text,'-',''),src.client_id,budget_private.pro_client_snapshot(auth.uid(),bid,src.client_id),budget_private.pro_seller_snapshot(auth.uid(),bid),current_date,current_date+b.default_payment_days,'draft',src.notes,src.total_ht,src.total_vat,src.total_ttc,current_date,null,src.operation_type,src.delivery_address)
  returning id into new_id;
  for item in select * from budget_private.pro_invoice_items where invoice_id=src.id order by line_order loop
    insert into budget_private.pro_invoice_items(invoice_id,product_id,description,quantity,unit_price,vat_rate,line_order)
    values(new_id,item.product_id,item.description,item.quantity,item.unit_price,item.vat_rate,item.line_order);
  end loop;
  return public.budget_pro_suite_load();
end $$;

create or replace function public.budget_pro_invoice_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bid uuid := budget_private.active_business_id(auth.uid());
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  delete from budget_private.pro_invoices where id=p_id and user_id=auth.uid() and business_id=bid and status='draft';
  if not found then raise exception 'Seule une facture brouillon peut être supprimée'; end if;
  return public.budget_pro_suite_load();
end $$;

-- ---------------------------------------------------------------------------
-- Paiements de facture : chaque paiement crée son encaissement en trésorerie.
-- ---------------------------------------------------------------------------
create or replace function public.budget_pro_invoice_payment_save(p_payment jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid := budget_private.active_business_id(auth.uid()); inv budget_private.pro_invoices;
  invoice_value uuid := (p_payment->>'invoiceId')::uuid; amount_value bigint := coalesce((p_payment->>'amount')::bigint,0);
  date_value date := coalesce(nullif(p_payment->>'date','')::date,current_date); method_value text := coalesce(p_payment->>'method','transfer');
  already_paid bigint; remaining_value bigint; new_total bigint; account_value uuid; transaction_value uuid; vat_value bigint;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if method_value not in ('card','check','cash','transfer','other') then raise exception 'Mode de règlement invalide'; end if;
  select * into inv from budget_private.pro_invoices where id=invoice_value and user_id=auth.uid() and business_id=bid for update;
  if inv.id is null then raise exception 'Facture introuvable'; end if;
  if inv.status not in ('sent','partially_paid') then raise exception 'La facture doit être émise avant encaissement'; end if;
  select coalesce(sum(amount),0) into already_paid from budget_private.pro_invoice_payments where invoice_id=inv.id;
  remaining_value:=greatest(0,inv.total_ttc-already_paid);
  if amount_value<=0 or amount_value>remaining_value then raise exception 'Montant supérieur au solde restant'; end if;
  select id into account_value from budget_private.pro_accounts where user_id=auth.uid();
  if account_value is null then insert into budget_private.pro_accounts(user_id) values(auth.uid()) returning id into account_value; end if;
  vat_value:=case when inv.total_ttc>0 then round(inv.total_vat::numeric*amount_value/inv.total_ttc)::bigint else 0 end;

  insert into budget_private.pro_transactions(user_id,business_id,kind,label,amount,transaction_date,category,client_id,account_id,vat_amount,paid,notes,payment_method,invoice_id)
  values(auth.uid(),bid,'income','Facture '||inv.invoice_number,amount_value,date_value,'Facture',inv.client_id,account_value,vat_value,true,nullif(trim(coalesce(p_payment->>'notes','')),''),method_value,inv.id)
  returning id into transaction_value;

  insert into budget_private.pro_invoice_payments(user_id,business_id,invoice_id,amount,payment_date,payment_method,transaction_id,notes)
  values(auth.uid(),bid,inv.id,amount_value,date_value,method_value,transaction_value,nullif(trim(coalesce(p_payment->>'notes','')),''));

  new_total:=already_paid+amount_value;
  update budget_private.pro_invoices set
    status=case when new_total>=total_ttc then 'paid' else 'partially_paid' end,
    paid_date=case when new_total>=total_ttc then date_value else null end,
    payment_method=case when new_total>=total_ttc then method_value else payment_method end,
    updated_at=now()
  where id=inv.id;
  return public.budget_pro_suite_load();
end $$;

create or replace function public.budget_pro_invoice_payment_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid := budget_private.active_business_id(auth.uid()); p budget_private.pro_invoice_payments; inv budget_private.pro_invoices; total_paid bigint;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into p from budget_private.pro_invoice_payments where id=p_id and user_id=auth.uid() and business_id=bid;
  if p.id is null then raise exception 'Paiement introuvable'; end if;
  select * into inv from budget_private.pro_invoices where id=p.invoice_id and user_id=auth.uid() and business_id=bid for update;
  delete from budget_private.pro_invoice_payments where id=p.id;
  if p.transaction_id is not null then delete from budget_private.pro_transactions where id=p.transaction_id and user_id=auth.uid() and business_id=bid; end if;
  select coalesce(sum(amount),0) into total_paid from budget_private.pro_invoice_payments where invoice_id=inv.id;
  update budget_private.pro_invoices set
    status=case when total_paid<=0 then 'sent' when total_paid<total_ttc then 'partially_paid' else 'paid' end,
    paid_date=case when total_paid>=total_ttc then (select max(payment_date) from budget_private.pro_invoice_payments where invoice_id=inv.id) else null end,
    updated_at=now()
  where id=inv.id;
  return public.budget_pro_suite_load();
end $$;

-- Compatibilité du bouton historique « marquer payée » : verse le solde restant.
create or replace function public.budget_pro_invoice_mark_paid(p_id uuid,p_payment_method text,p_paid_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare inv budget_private.pro_invoices; already_paid bigint; remaining_value bigint; bid uuid := budget_private.active_business_id(auth.uid());
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into inv from budget_private.pro_invoices where id=p_id and user_id=auth.uid() and business_id=bid;
  if inv.id is null then raise exception 'Facture introuvable'; end if;
  select coalesce(sum(amount),0) into already_paid from budget_private.pro_invoice_payments where invoice_id=inv.id;
  remaining_value:=inv.total_ttc-already_paid;
  if remaining_value<=0 then raise exception 'Facture déjà réglée'; end if;
  return public.budget_pro_invoice_payment_save(jsonb_build_object('invoiceId',p_id,'amount',remaining_value,'date',coalesce(p_paid_date,current_date),'method',p_payment_method));
end $$;

-- ---------------------------------------------------------------------------
-- Chargement complet V2, toujours filtré sur l'entreprise active.
-- ---------------------------------------------------------------------------
create or replace function public.budget_pro_suite_load()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  result jsonb; enabled_value boolean; bid uuid; b budget_private.pro_businesses; account_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select coalesce(enabled,false) into enabled_value from budget_private.pro_modules where user_id=auth.uid();
  if not coalesce(enabled_value,false) then return jsonb_build_object('enabled',false); end if;
  bid:=budget_private.active_business_id(auth.uid());
  if bid is null then
    insert into budget_private.pro_businesses(user_id,name) values(auth.uid(),'Mon entreprise') returning id into bid;
    insert into budget_private.pro_business_preferences(user_id,active_business_id) values(auth.uid(),bid)
    on conflict(user_id) do update set active_business_id=excluded.active_business_id,updated_at=now();
  end if;
  select * into b from budget_private.pro_businesses where id=bid and user_id=auth.uid();
  select id into account_uuid from budget_private.pro_accounts where user_id=auth.uid();
  if account_uuid is null then insert into budget_private.pro_accounts(user_id,name,opening_balance) values(auth.uid(),b.account_name,b.opening_balance) returning id into account_uuid; end if;

  select jsonb_build_object(
    'enabled',true,
    'activeBusinessId',bid,
    'businesses',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name) order by x.created_at,x.name) from budget_private.pro_businesses x where x.user_id=auth.uid()),'[]'::jsonb),
    'profile',jsonb_build_object('businessName',b.name,'legalStatus',b.legal_status,'activityType',b.activity_type,'siret',coalesce(b.siret,''),'contributionRate',b.contribution_rate,'taxRate',b.tax_rate,'vatEnabled',b.vat_enabled,'vatRate',b.vat_rate),
    'account',jsonb_build_object('id',account_uuid,'name',b.account_name,'openingBalance',b.opening_balance),
    'billing',jsonb_build_object(
      'address',coalesce(b.address,''),'postalCode',coalesce(b.postal_code,''),'city',coalesce(b.city,''),'email',coalesce(b.email,''),'phone',coalesce(b.phone,''),'iban',coalesce(b.iban,''),
      'invoicePrefix',b.invoice_prefix,'quotePrefix',b.quote_prefix,'footerNote',coalesce(b.footer_note,''),'vatNumber',coalesce(b.vat_number,''),
      'registrationText',coalesce(b.registration_text,''),'capitalText',coalesce(b.capital_text,''),'logoData',coalesce(b.logo_data,''),
      'defaultPaymentDays',b.default_payment_days,'earlyDiscountText',b.early_discount_text,'latePenaltyText',b.late_penalty_text
    ),
    'clients',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'name',c.name,'companyName',coalesce(c.company_name,''),'clientType',c.client_type,'email',coalesce(c.email,''),'phone',coalesce(c.phone,''),
      'address',coalesce(c.address,''),'postalCode',coalesce(c.postal_code,''),'city',coalesce(c.city,''),'billingAddress',coalesce(c.billing_address,''),
      'billingPostalCode',coalesce(c.billing_postal_code,''),'billingCity',coalesce(c.billing_city,''),'siret',coalesce(c.siret,''),'vatNumber',coalesce(c.vat_number,''),'notes',coalesce(c.notes,'')
    ) order by lower(c.name)) from budget_private.pro_clients c where c.user_id=auth.uid() and c.business_id=bid),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'name',x.name,'description',coalesce(x.description,''),'unitPrice',x.unit_price,'vatRate',x.vat_rate,'active',x.active) order by x.active desc,lower(x.name)) from budget_private.pro_products x where x.user_id=auth.uid() and x.business_id=bid),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'kind',t.kind,'label',t.label,'amount',t.amount,'date',t.transaction_date,'category',coalesce(t.category,''),'clientId',t.client_id,'accountId',t.account_id,'vatAmount',t.vat_amount,'paid',t.paid,'notes',coalesce(t.notes,''),'personalTransactionId',t.personal_transaction_id,'contributionPeriodKey',t.contribution_period_key,'taxPeriodKey',t.tax_period_key,'paymentMethod',t.payment_method,'productId',t.product_id,'invoiceId',t.invoice_id) order by t.transaction_date desc,t.created_at desc) from budget_private.pro_transactions t where t.user_id=auth.uid() and t.business_id=bid),'[]'::jsonb),
    'quotes',coalesce((select jsonb_agg(jsonb_build_object(
      'id',q.id,'number',q.quote_number,'clientId',q.client_id,'clientSnapshot',q.client_snapshot,'sellerSnapshot',q.seller_snapshot,'issueDate',q.issue_date,'validUntil',q.valid_until,
      'status',case when q.status in ('draft','sent') and q.valid_until<current_date then 'expired' else q.status end,'notes',coalesce(q.notes,''),'totalHt',q.total_ht,'totalVat',q.total_vat,'totalTtc',q.total_ttc,
      'items',coalesce((select jsonb_agg(jsonb_build_object('id',it.id,'productId',it.product_id,'description',it.description,'quantity',it.quantity,'unitPrice',it.unit_price,'vatRate',it.vat_rate) order by it.line_order) from budget_private.pro_quote_items it where it.quote_id=q.id),'[]'::jsonb)
    ) order by q.issue_date desc,q.created_at desc) from budget_private.pro_quotes q where q.user_id=auth.uid() and q.business_id=bid),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'number',i.invoice_number,'clientId',i.client_id,'clientSnapshot',i.client_snapshot,'sellerSnapshot',i.seller_snapshot,'issueDate',i.issue_date,'dueDate',i.due_date,
      'serviceDate',i.service_date,'purchaseOrderNumber',coalesce(i.purchase_order_number,''),'operationType',i.operation_type,'deliveryAddress',coalesce(i.delivery_address,''),
      'status',i.status,'issuedAt',i.issued_at,'paymentMethod',i.payment_method,'paidDate',i.paid_date,'notes',coalesce(i.notes,''),'sourceQuoteId',i.source_quote_id,
      'totalHt',i.total_ht,'totalVat',i.total_vat,'totalTtc',i.total_ttc,
      'paidAmount',coalesce((select sum(p.amount) from budget_private.pro_invoice_payments p where p.invoice_id=i.id),0),
      'remainingAmount',greatest(0,i.total_ttc-coalesce((select sum(p.amount) from budget_private.pro_invoice_payments p where p.invoice_id=i.id),0)),
      'items',coalesce((select jsonb_agg(jsonb_build_object('id',it.id,'productId',it.product_id,'description',it.description,'quantity',it.quantity,'unitPrice',it.unit_price,'vatRate',it.vat_rate) order by it.line_order) from budget_private.pro_invoice_items it where it.invoice_id=i.id),'[]'::jsonb)
    ) order by i.issue_date desc,i.created_at desc) from budget_private.pro_invoices i where i.user_id=auth.uid() and i.business_id=bid),'[]'::jsonb),
    'invoicePayments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'invoiceId',p.invoice_id,'amount',p.amount,'date',p.payment_date,'method',p.payment_method,'transactionId',p.transaction_id,'notes',coalesce(p.notes,'')) order by p.payment_date desc,p.created_at desc) from budget_private.pro_invoice_payments p where p.user_id=auth.uid() and p.business_id=bid),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'clientId',e.client_id,'title',e.title,'eventType',e.event_type,'startsAt',e.starts_at,'endsAt',e.ends_at,'location',coalesce(e.location,''),'notes',coalesce(e.notes,'')) order by e.starts_at) from budget_private.pro_events e where e.user_id=auth.uid() and e.business_id=bid),'[]'::jsonb)
  ) into result;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Droits RPC
-- ---------------------------------------------------------------------------
revoke execute on function public.budget_pro_client_save(jsonb) from public,anon,authenticated;
revoke execute on function public.budget_pro_billing_save(jsonb) from public,anon,authenticated;
revoke execute on function public.budget_pro_quote_save(jsonb) from public,anon,authenticated;
revoke execute on function public.budget_pro_quote_status(uuid,text) from public,anon,authenticated;
revoke execute on function public.budget_pro_quote_delete(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_quote_convert(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_save(jsonb) from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_issue(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_duplicate(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_delete(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_payment_save(jsonb) from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_payment_delete(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_mark_paid(uuid,text,date) from public,anon,authenticated;
revoke execute on function public.budget_pro_suite_load() from public,anon,authenticated;

grant usage on schema public to authenticated;
grant execute on function public.budget_pro_client_save(jsonb) to authenticated;
grant execute on function public.budget_pro_billing_save(jsonb) to authenticated;
grant execute on function public.budget_pro_quote_save(jsonb) to authenticated;
grant execute on function public.budget_pro_quote_status(uuid,text) to authenticated;
grant execute on function public.budget_pro_quote_delete(uuid) to authenticated;
grant execute on function public.budget_pro_quote_convert(uuid) to authenticated;
grant execute on function public.budget_pro_invoice_save(jsonb) to authenticated;
grant execute on function public.budget_pro_invoice_issue(uuid) to authenticated;
grant execute on function public.budget_pro_invoice_duplicate(uuid) to authenticated;
grant execute on function public.budget_pro_invoice_delete(uuid) to authenticated;
grant execute on function public.budget_pro_invoice_payment_save(jsonb) to authenticated;
grant execute on function public.budget_pro_invoice_payment_delete(uuid) to authenticated;
grant execute on function public.budget_pro_invoice_mark_paid(uuid,text,date) to authenticated;
grant execute on function public.budget_pro_suite_load() to authenticated;

notify pgrst,'reload schema';
commit;
