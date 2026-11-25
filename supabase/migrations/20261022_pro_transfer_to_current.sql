-- Wimm Pro : se verser un salaire depuis l'entreprise active vers un compte
-- courant du foyer. À appliquer en production UNIQUEMENT avec l'accord explicite
-- du propriétaire. Testé dans src/proSalaryTransfer.test.ts (PGlite).
--
-- - Côté Pro : une sortie « transfer_personal » rattachée à l'entreprise active.
-- - Côté foyer : un revenu « Salaire » compté pour le mois du versement.
-- - Garantie serveur : jamais plus que le solde réel du compte Pro. Le plafond
--   « disponible estimé après réserves » est appliqué par l'écran, car il dépend
--   de préférences Urssaf enregistrées sur l'appareil.
-- - Supprimer l'opération côté Pro retire aussi le salaire du foyer
--   (budget_pro_transaction_delete, inchangée).
create or replace function public.budget_pro_transfer_to_current(p_transfer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  bid uuid;
  pro_account uuid;
  household uuid;
  b budget_private.pro_businesses%rowtype;
  amount_value bigint;
  transfer_date date;
  target_account text;
  account_date date;
  document_body jsonb;
  new_body jsonb;
  mirror_id uuid := gen_random_uuid();
  new_revision integer;
  cash_balance bigint;
begin
  if actor is null then raise exception 'Connexion requise'; end if;
  amount_value := nullif(p_transfer->>'amount','')::bigint;
  transfer_date := coalesce(nullif(p_transfer->>'date','')::date, (now() at time zone 'Europe/Paris')::date);
  target_account := nullif(trim(p_transfer->>'targetAccountId'),'');
  if amount_value is null or amount_value <= 0 or amount_value > 1000000000000
    then raise exception 'Montant de versement invalide'; end if;
  if transfer_date > (now() at time zone 'Europe/Paris')::date
    then raise exception 'Un versement ne peut pas être daté dans le futur'; end if;
  if coalesce((p_transfer->>'syncToHousehold')::boolean,false) is distinct from true
    then raise exception 'Un compte courant destinataire doit être sélectionné'; end if;
  if target_account is null then raise exception 'Choisissez un compte courant de destination'; end if;
  if not exists(select 1 from budget_private.pro_modules where user_id=actor and enabled)
    then raise exception 'Module Pro désactivé'; end if;

  bid := budget_private.active_business_id(actor);
  if bid is null then raise exception 'Entreprise active introuvable'; end if;
  -- Protect concurrent withdrawals from the same business.
  perform pg_advisory_xact_lock(hashtextextended('pro-withdraw:'||bid::text,0));
  select * into b from budget_private.pro_businesses where id=bid and user_id=actor for update;
  if not found then raise exception 'Entreprise introuvable'; end if;
  if b.contribution_rate = 0 and b.tax_rate = 0
    then raise exception 'Configurez les taux de cotisations ou d’impôt avant de verser un revenu'; end if;

  select id into pro_account from budget_private.pro_accounts where user_id=actor;
  if pro_account is null then raise exception 'Compte professionnel introuvable'; end if;
  select household_id into household from budget_private.members where user_id=actor;
  if household is null then raise exception 'Foyer introuvable'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pro-household:'||household::text,0));
  select body into document_body from budget_private.documents
    where household_id=household for update;
  if document_body is null then raise exception 'Document du foyer introuvable'; end if;

  select (a->>'date')::date into account_date
  from jsonb_array_elements(document_body->'accounts') a
  where a->>'id'=target_account
    and a->>'group'='current'
    and coalesce((a->>'archived')::boolean,false)=false
  limit 1;
  if account_date is null or account_date > transfer_date
    then raise exception 'Compte courant actif de destination invalide'; end if;

  select coalesce(b.opening_balance,0)
    + coalesce(sum(case
        when t.kind='income' then t.amount
        else -t.amount
      end),0)
  into cash_balance
  from budget_private.pro_transactions t
  where t.business_id=bid and t.user_id=actor and t.paid=true
    and t.transaction_date<=(now() at time zone 'Europe/Paris')::date;

  if amount_value > greatest(0,coalesce(cash_balance,0))
    then raise exception 'Versement supérieur au solde du compte Pro (maximum % euros)', round(greatest(0,coalesce(cash_balance,0))/100.0,2); end if;

  new_body := jsonb_set(document_body,'{transactions}',
    coalesce(document_body->'transactions','[]'::jsonb) ||
    jsonb_build_array(jsonb_build_object(
      'id',mirror_id::text,'type','income','amount',amount_value,
      'date',transfer_date::text,'description','Salaire — '||b.name,
      'account',target_account,'incomeType','Salaire','budgetMonth',to_char(transfer_date,'YYYY-MM')
    )));
  perform budget_private.check_document(new_body);
  update budget_private.documents
    set body=new_body,revision=revision+1,updated_at=now()
    where household_id=household returning revision into new_revision;
  insert into budget_private.audit(household_id,user_id,revision,action)
    values(household,actor,new_revision,'Salaire versé depuis le compte professionnel');

  insert into budget_private.pro_transactions(
    user_id,business_id,kind,label,amount,transaction_date,category,
    client_id,account_id,vat_amount,paid,notes,personal_transaction_id
  ) values (
    actor,bid,'transfer_personal','Salaire — '||b.name,amount_value,
    transfer_date,'Virement personnel',null,pro_account,0,true,
    'Lié au compte courant Wimm',mirror_id
  );
  return public.budget_pro_suite_load();
end;
$$;

revoke all on function public.budget_pro_transfer_to_current(jsonb) from public, anon, authenticated;
grant execute on function public.budget_pro_transfer_to_current(jsonb) to authenticated;

notify pgrst, 'reload schema';
