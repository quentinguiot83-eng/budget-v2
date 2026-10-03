-- Wimm / budget-v2 — Module Pro V2 : trésorerie, compte Pro et virements vers le perso
-- À exécuter APRÈS 01-installation.sql et 02-module-pro.sql.
-- Script réexécutable : il conserve les données Pro déjà présentes.
-- Après succès, OUI : le texte de la requête peut être supprimé du SQL Editor.
-- Conservez ce fichier dans GitHub.

begin;

create table if not exists budget_private.pro_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Compte professionnel'
    check (length(trim(name)) between 1 and 120),
  opening_balance bigint not null default 0
    check (abs(opening_balance) <= 1000000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table budget_private.pro_accounts enable row level security;
revoke all on budget_private.pro_accounts from public, anon, authenticated;

-- Un compte Pro par utilisateur pour cette version. On le crée aussi pour les
-- utilisateurs ayant déjà commencé à saisir des données avant cette migration.
insert into budget_private.pro_accounts(user_id)
select user_id from budget_private.pro_modules
union
select user_id from budget_private.pro_profiles
union
select user_id from budget_private.pro_transactions
on conflict(user_id) do nothing;

alter table budget_private.pro_transactions
  add column if not exists account_id uuid;

alter table budget_private.pro_transactions
  add column if not exists personal_transaction_id uuid;

update budget_private.pro_transactions t
set account_id = a.id
from budget_private.pro_accounts a
where a.user_id = t.user_id
  and t.account_id is null;

alter table budget_private.pro_transactions
  alter column account_id set not null;

alter table budget_private.pro_transactions
  drop constraint if exists pro_transactions_kind_check;

alter table budget_private.pro_transactions
  add constraint pro_transactions_kind_check
  check (kind in ('income','expense','transfer_personal'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pro_transactions_account_id_fkey'
      and conrelid = 'budget_private.pro_transactions'::regclass
  ) then
    alter table budget_private.pro_transactions
      add constraint pro_transactions_account_id_fkey
      foreign key (account_id)
      references budget_private.pro_accounts(id)
      on delete restrict;
  end if;
end $$;

create index if not exists pro_transactions_account_date_idx
  on budget_private.pro_transactions(account_id, transaction_date desc);

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

    insert into budget_private.pro_accounts(user_id)
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

  insert into budget_private.pro_accounts(user_id)
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
    'account', (
      select jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'openingBalance', a.opening_balance
      )
      from budget_private.pro_accounts a
      where a.user_id=auth.uid()
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
        'accountId', t.account_id,
        'vatAmount', t.vat_amount,
        'paid', t.paid,
        'notes', coalesce(t.notes,''),
        'personalTransactionId', t.personal_transaction_id
      ) order by t.transaction_date desc, t.created_at desc)
      from budget_private.pro_transactions t
      where t.user_id=auth.uid()
    ), '[]'::jsonb)
  ) into result
  from budget_private.pro_profiles p
  where p.user_id=auth.uid();

  return result;
end $$;

create or replace function public.budget_pro_account_save(p_account jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  account_name text := trim(coalesce(p_account->>'name','Compte professionnel'));
  opening_value bigint := coalesce((p_account->>'openingBalance')::bigint,0);
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(account_name) < 1 or length(account_name) > 120 then raise exception 'Nom du compte invalide'; end if;
  if abs(opening_value) > 1000000000000 then raise exception 'Solde de départ invalide'; end if;

  insert into budget_private.pro_accounts(user_id,name,opening_balance,updated_at)
  values(auth.uid(),account_name,opening_value,now())
  on conflict(user_id) do update set
    name=excluded.name,
    opening_balance=excluded.opening_balance,
    updated_at=now();

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
  account_value uuid;
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

  select id into account_value
  from budget_private.pro_accounts
  where user_id=auth.uid();

  if account_value is null then
    insert into budget_private.pro_accounts(user_id)
    values(auth.uid())
    returning id into account_value;
  end if;

  if raw_id is null then
    insert into budget_private.pro_transactions(
      user_id,kind,label,amount,transaction_date,category,client_id,
      account_id,vat_amount,paid,notes
    ) values(
      auth.uid(),kind_value,label_value,amount_value,date_value,category_value,client_value,
      account_value,vat_value,paid_value,nullif(trim(coalesce(p_transaction->>'notes','')),'')
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
      account_id=account_value,
      vat_amount=vat_value,
      paid=paid_value,
      notes=nullif(trim(coalesce(p_transaction->>'notes','')),''),
      updated_at=now()
    where id=transaction_id
      and user_id=auth.uid()
      and kind in ('income','expense');
    if not found then raise exception 'Opération introuvable ou non modifiable ici'; end if;
  end if;

  return public.budget_pro_load();
end $$;

create or replace function public.budget_pro_transfer_personal(p_transfer jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  amount_value bigint := coalesce((p_transfer->>'amount')::bigint,0);
  date_value date := coalesce((p_transfer->>'date')::date,(now() at time zone 'Europe/Paris')::date);
  label_value text := trim(coalesce(p_transfer->>'label','Virement vers le perso'));
  sync_personal boolean := coalesce((p_transfer->>'syncToHousehold')::boolean,false);
  target_account text := nullif(trim(coalesce(p_transfer->>'targetAccountId','')),'');
  pro_account uuid;
  mirror_id uuid;
  household uuid;
  document_body jsonb;
  new_body jsonb;
  new_revision int;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if amount_value <= 0 or amount_value > 1000000000000 then raise exception 'Montant invalide'; end if;
  if length(label_value) < 1 or length(label_value) > 200 then raise exception 'Libellé invalide'; end if;
  if date_value > (now() at time zone 'Europe/Paris')::date then
    raise exception 'Un virement vers le perso ne peut pas être daté dans le futur';
  end if;

  if not exists(
    select 1 from budget_private.pro_modules
    where user_id=auth.uid() and enabled=true
  ) then raise exception 'Module professionnel désactivé'; end if;

  select id into pro_account
  from budget_private.pro_accounts
  where user_id=auth.uid();

  if pro_account is null then
    insert into budget_private.pro_accounts(user_id)
    values(auth.uid())
    returning id into pro_account;
  end if;

  if sync_personal then
    if target_account is null then raise exception 'Choisissez le compte personnel destinataire'; end if;

    select household_id into household
    from budget_private.members
    where user_id=auth.uid();

    if household is null then raise exception 'Aucun foyer personnel disponible'; end if;

    select body into document_body
    from budget_private.documents
    where household_id=household
    for update;

    if document_body is null then raise exception 'Budget personnel introuvable'; end if;

    if not exists(
      select 1
      from jsonb_array_elements(document_body->'accounts') a
      where a->>'id'=target_account
        and coalesce((a->>'archived')::boolean,false)=false
        and (a->>'date')::date <= date_value
    ) then raise exception 'Compte personnel destinataire invalide'; end if;

    mirror_id := gen_random_uuid();

    new_body := jsonb_set(
      document_body,
      '{transactions}',
      (document_body->'transactions') || jsonb_build_array(jsonb_build_object(
        'id', mirror_id::text,
        'type', 'income',
        'amount', amount_value,
        'date', date_value::text,
        'description', label_value,
        'account', target_account,
        'incomeType', 'autre',
        'budgetMonth', to_char(date_value,'YYYY-MM')
      ))
    );

    perform budget_private.check_document(new_body);

    update budget_private.documents
    set body=new_body,
        revision=revision+1,
        updated_at=now()
    where household_id=household
    returning revision into new_revision;

    insert into budget_private.audit(household_id,user_id,revision,action)
    values(household,auth.uid(),new_revision,'Virement activité pro vers budget personnel');
  end if;

  insert into budget_private.pro_transactions(
    user_id,kind,label,amount,transaction_date,category,client_id,
    account_id,vat_amount,paid,notes,personal_transaction_id
  ) values(
    auth.uid(),'transfer_personal',label_value,amount_value,date_value,
    'Virement personnel',null,pro_account,0,true,
    case when sync_personal then 'Ajouté au budget personnel' else null end,
    mirror_id
  );

  return public.budget_pro_load();
end $$;

create or replace function public.budget_pro_transaction_delete(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  row_kind text;
  mirror_id uuid;
  household uuid;
  document_body jsonb;
  new_transactions jsonb;
  new_body jsonb;
  new_revision int;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;

  select kind, personal_transaction_id
  into row_kind, mirror_id
  from budget_private.pro_transactions
  where id=p_id and user_id=auth.uid();

  if row_kind is null then raise exception 'Opération introuvable'; end if;

  if row_kind='transfer_personal' and mirror_id is not null then
    select household_id into household
    from budget_private.members
    where user_id=auth.uid();

    if household is not null then
      select body into document_body
      from budget_private.documents
      where household_id=household
      for update;

      if document_body is not null and exists(
        select 1
        from jsonb_array_elements(document_body->'transactions') t
        where t->>'id'=mirror_id::text
      ) then
        select coalesce(jsonb_agg(t),'[]'::jsonb)
        into new_transactions
        from jsonb_array_elements(document_body->'transactions') t
        where t->>'id'<>mirror_id::text;

        new_body := jsonb_set(document_body,'{transactions}',new_transactions);
        perform budget_private.check_document(new_body);

        update budget_private.documents
        set body=new_body,
            revision=revision+1,
            updated_at=now()
        where household_id=household
        returning revision into new_revision;

        insert into budget_private.audit(household_id,user_id,revision,action)
        values(household,auth.uid(),new_revision,'Suppression virement activité pro vers budget personnel');
      end if;
    end if;
  end if;

  delete from budget_private.pro_transactions
  where id=p_id and user_id=auth.uid();

  return public.budget_pro_load();
end $$;

revoke execute on function public.budget_pro_account_save(jsonb) from public, anon, authenticated;
revoke execute on function public.budget_pro_transfer_personal(jsonb) from public, anon, authenticated;

grant usage on schema public to authenticated;
grant execute on function public.budget_pro_account_save(jsonb) to authenticated;
grant execute on function public.budget_pro_transfer_personal(jsonb) to authenticated;

-- Les fonctions remplacées existaient déjà dans 02-module-pro.sql : on maintient
-- explicitement leurs droits pour les environnements où le script est rejoué.
revoke execute on function public.budget_pro_toggle(boolean) from public, anon, authenticated;
revoke execute on function public.budget_pro_load() from public, anon, authenticated;
revoke execute on function public.budget_pro_transaction_save(jsonb) from public, anon, authenticated;
revoke execute on function public.budget_pro_transaction_delete(uuid) from public, anon, authenticated;

grant execute on function public.budget_pro_toggle(boolean) to authenticated;
grant execute on function public.budget_pro_load() to authenticated;
grant execute on function public.budget_pro_transaction_save(jsonb) to authenticated;
grant execute on function public.budget_pro_transaction_delete(uuid) to authenticated;

notify pgrst,'reload schema';
commit;