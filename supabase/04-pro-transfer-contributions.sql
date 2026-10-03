-- Wimm / budget-v2 — Module Pro V2.1 : virements perso + paiements de cotisations
-- À exécuter APRÈS 03-pro-treasury.sql.
-- Script réexécutable : il conserve toutes les données existantes.
-- Après succès, OUI : le texte de la requête peut être supprimé du SQL Editor.
-- Conservez ce fichier dans GitHub.

begin;

create table if not exists budget_private.pro_contribution_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  paid_date date not null default current_date,
  period_key text not null check (period_key ~ '^[0-9]{4}(-[0-9]{2})?$'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pro_contribution_payments_user_date_idx
  on budget_private.pro_contribution_payments(user_id, paid_date desc);
create index if not exists pro_contribution_payments_user_period_idx
  on budget_private.pro_contribution_payments(user_id, period_key);

alter table budget_private.pro_contribution_payments enable row level security;
revoke all on budget_private.pro_contribution_payments from public, anon, authenticated;

-- Liste dédiée des comptes personnels accessibles à l'utilisateur.
-- Cela évite de dépendre de budget_load() uniquement pour alimenter le formulaire de virement.
create or replace function public.budget_pro_personal_accounts()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  household uuid;
  document_body jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;

  select household_id into household
  from budget_private.members
  where user_id=auth.uid();

  if household is null then return '[]'::jsonb; end if;

  select body into document_body
  from budget_private.documents
  where household_id=household;

  if document_body is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a->>'id',
      'name', coalesce(a->>'name','Compte'),
      'archived', coalesce((a->>'archived')::boolean,false)
    ) order by lower(coalesce(a->>'name','')))
    from jsonb_array_elements(document_body->'accounts') a
    where coalesce((a->>'archived')::boolean,false)=false
  ), '[]'::jsonb);
end $$;

-- Recréation explicite du RPC de virement pour corriger les environnements où
-- PostgREST ne l'avait pas correctement exposé après la migration précédente.
create or replace function public.budget_pro_transfer_personal(p_transfer jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  amount_value bigint := coalesce((p_transfer->>'amount')::bigint,0);
  date_value date := coalesce((p_transfer->>'date')::date,(now() at time zone 'Europe/Paris')::date);
  label_value text := trim(coalesce(p_transfer->>'label','Virement activité pro'));
  sync_personal boolean := coalesce((p_transfer->>'syncToHousehold')::boolean,false);
  target_account text := nullif(trim(coalesce(p_transfer->>'targetAccountId','')),'');
  pro_account uuid;
  mirror_id uuid;
  household uuid;
  document_body jsonb;
  new_body jsonb;
  new_revision int;
  available_cash bigint;
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

  select
    a.opening_balance
    + coalesce(sum(case
        when t.paid and t.kind='income' then t.amount
        when t.paid and t.kind in ('expense','transfer_personal') then -t.amount
        else 0
      end),0)
    - coalesce((
        select sum(cp.amount)
        from budget_private.pro_contribution_payments cp
        where cp.user_id=auth.uid()
      ),0)
  into available_cash
  from budget_private.pro_accounts a
  left join budget_private.pro_transactions t
    on t.account_id=a.id and t.user_id=auth.uid()
  where a.id=pro_account
  group by a.id, a.opening_balance;

  if amount_value > coalesce(available_cash,0) then
    raise exception 'Trésorerie Pro insuffisante pour ce virement';
  end if;

  if sync_personal then
    if target_account is null then raise exception 'Choisissez le compte personnel destinataire'; end if;

    select household_id into household
    from budget_private.members
    where user_id=auth.uid();

    if household is null then raise exception 'Aucun foyer personnel disponible'; end if;

    perform pg_advisory_xact_lock(hashtextextended(household::text, 0));

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

create or replace function public.budget_pro_contribution_payment_save(p_payment jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  payment_id uuid;
  raw_id text := nullif(p_payment->>'id','');
  amount_value bigint := coalesce((p_payment->>'amount')::bigint,0);
  paid_value date := coalesce((p_payment->>'paidDate')::date,(now() at time zone 'Europe/Paris')::date);
  period_value text := trim(coalesce(p_payment->>'periodKey',''));
  notes_value text := nullif(trim(coalesce(p_payment->>'notes','')),'');
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if amount_value <= 0 or amount_value > 1000000000000 then raise exception 'Montant invalide'; end if;
  if paid_value > (now() at time zone 'Europe/Paris')::date then raise exception 'La date de paiement ne peut pas être dans le futur'; end if;
  if period_value !~ '^[0-9]{4}(-[0-9]{2})?$' then raise exception 'Période invalide'; end if;

  if raw_id is null then
    insert into budget_private.pro_contribution_payments(user_id,amount,paid_date,period_key,notes)
    values(auth.uid(),amount_value,paid_value,period_value,notes_value)
    returning id into payment_id;
  else
    payment_id := raw_id::uuid;
    update budget_private.pro_contribution_payments set
      amount=amount_value,
      paid_date=paid_value,
      period_key=period_value,
      notes=notes_value,
      updated_at=now()
    where id=payment_id and user_id=auth.uid();
    if not found then raise exception 'Paiement de cotisations introuvable'; end if;
  end if;

  return public.budget_pro_load();
end $$;

create or replace function public.budget_pro_contribution_payment_delete(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  delete from budget_private.pro_contribution_payments
  where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Paiement de cotisations introuvable'; end if;
  return public.budget_pro_load();
end $$;

-- Étend la charge Pro avec l'historique des paiements de cotisations.
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
    ), '[]'::jsonb),
    'contributionPayments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cp.id,
        'amount', cp.amount,
        'paidDate', cp.paid_date,
        'periodKey', cp.period_key,
        'notes', coalesce(cp.notes,'')
      ) order by cp.paid_date desc, cp.created_at desc)
      from budget_private.pro_contribution_payments cp
      where cp.user_id=auth.uid()
    ), '[]'::jsonb)
  ) into result
  from budget_private.pro_profiles p
  where p.user_id=auth.uid();

  return result;
end $$;

revoke execute on function public.budget_pro_personal_accounts() from public, anon, authenticated;
revoke execute on function public.budget_pro_transfer_personal(jsonb) from public, anon, authenticated;
revoke execute on function public.budget_pro_contribution_payment_save(jsonb) from public, anon, authenticated;
revoke execute on function public.budget_pro_contribution_payment_delete(uuid) from public, anon, authenticated;
revoke execute on function public.budget_pro_load() from public, anon, authenticated;

grant usage on schema public to authenticated;
grant execute on function public.budget_pro_personal_accounts() to authenticated;
grant execute on function public.budget_pro_transfer_personal(jsonb) to authenticated;
grant execute on function public.budget_pro_contribution_payment_save(jsonb) to authenticated;
grant execute on function public.budget_pro_contribution_payment_delete(uuid) to authenticated;
grant execute on function public.budget_pro_load() to authenticated;

notify pgrst,'reload schema';
commit;