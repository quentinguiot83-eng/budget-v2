-- Phase 1: safe JSON import and complete read-only professional export.
-- KEEP THIS MIGRATION in version control after execution: do not delete it.
-- DDL only: functions/permissions; it never modifies existing user data.
--
-- JSON file restore is an authenticated, revision-checked, single Postgres
-- transaction. Existing history triggers save the prior AND restored revisions.
-- External storage/photos and Pro data are intentionally outside this import.

create or replace function public.budget_restore_import(
  p_backup jsonb,
  p_expected_revision integer,
  p_confirmation text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  h uuid;
  h_owner uuid;
  scope text;
  saved_state jsonb;
  current_revision integer;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_confirmation is distinct from 'RESTAURER' then
    raise exception 'Confirmation requise'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Révision attendue invalide'; end if;
  if p_backup is null or jsonb_typeof(p_backup) <> 'object'
      or octet_length(p_backup::text) > 20000000
      or p_backup->>'format' is distinct from 'wimm-manual-backup'
      or p_backup->>'version' not in ('1','2') then
    raise exception 'Sauvegarde Wimm invalide ou trop volumineuse';
  end if;
  if jsonb_typeof(p_backup->'integrity') is distinct from 'object'
      or coalesce(p_backup#>>'{integrity,algorithm}','') <> 'SHA-256' then
    raise exception 'Empreinte de sauvegarde absente';
  end if;
  scope := p_backup->>'scope';
  if scope not in ('household','personal') then
    raise exception 'La restauration de ce type de sauvegarde est indisponible';
  end if;
  saved_state := p_backup->'state';
  if saved_state is null or jsonb_typeof(saved_state) <> 'object' then
    raise exception 'État de sauvegarde invalide'; end if;

  select m.household_id into h
    from budget_private.members m where m.user_id=auth.uid() for share;
  if h is null then raise exception 'Accès au foyer refusé'; end if;
  if p_backup->>'householdId' is distinct from h::text then
    raise exception 'Cette sauvegarde concerne un autre foyer'; end if;

  if scope='household' then
    select owner into h_owner from budget_private.households where id=h;
    if h_owner is distinct from auth.uid() then
      raise exception 'Seul le propriétaire peut restaurer le foyer'; end if;

    select revision into current_revision
      from budget_private.documents where household_id=h for update;
    if current_revision is distinct from p_expected_revision then
      raise exception 'CONFLICT: votre foyer a été modifié. Actualisez avant de restaurer';
    end if;
    perform budget_private.check_document(saved_state);

    -- Preserve the existing Pro-to-household transfer integrity constraint.
    if exists (
      select 1 from budget_private.pro_transactions pt
      where pt.kind='transfer_personal'
        and pt.personal_transaction_id is not null
        and pt.user_id in (
          select user_id from budget_private.members where household_id=h
        )
        and exists (
          select 1 from jsonb_array_elements(coalesce(
            (select body->'transactions' from budget_private.documents where household_id=h),
            '[]'::jsonb
          )) current_tx
          where current_tx->>'id'=pt.personal_transaction_id::text
        )
        and not exists (
          select 1 from jsonb_array_elements(saved_state->'transactions') target_tx
          where target_tx->>'id'=pt.personal_transaction_id::text
        )
    ) then
      raise exception 'Restauration bloquée : virements liés à Wimm Pro absents du fichier';
    end if;
    result := public.budget_save(saved_state,p_expected_revision,'Import JSON contrôlé du foyer');
  else
    select revision into current_revision
      from budget_private.personal_documents
      where user_id=auth.uid() and household_id=h for update;
    if current_revision is distinct from p_expected_revision then
      raise exception 'CONFLICT: votre compte privé a été modifié. Actualisez avant de restaurer';
    end if;
    perform budget_private.check_personal_document(saved_state);
    result := public.budget_personal_save(saved_state,p_expected_revision,'Import JSON contrôlé privé');
  end if;
  -- The existing AFTER UPDATE history triggers preserve previous versions.
  return result || jsonb_build_object('scope',scope);
end;
$$;
revoke all on function public.budget_restore_import(jsonb,integer,text) from public,anon;
grant execute on function public.budget_restore_import(jsonb,integer,text) to authenticated;


-- Read-only export of every professional business owned by the caller.
-- Never call budget_pro_suite_load here: that older loader can create defaults.
-- Access tokens for calendar subscriptions and external media are excluded.
create or replace function public.budget_pro_backup_export()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from budget_private.pro_modules
                where user_id=uid and enabled=true) then
    raise exception 'L’espace professionnel n’est pas activé';
  end if;
  return jsonb_build_object(
    'schema',1,
    'businesses',coalesce((select jsonb_agg(to_jsonb(b)-'user_id')
                       from budget_private.pro_businesses b where b.user_id=uid),'[]'::jsonb),
    'preferences',coalesce((select to_jsonb(p)-'user_id' from budget_private.pro_business_preferences p
                       where p.user_id=uid),'null'::jsonb),
    'accounts',coalesce((select jsonb_agg(to_jsonb(a)-'user_id')
                       from budget_private.pro_accounts a where a.user_id=uid),'[]'::jsonb),
    'profiles',coalesce((select jsonb_agg(to_jsonb(p)-'user_id')
                       from budget_private.pro_profiles p where p.user_id=uid),'[]'::jsonb),
    'billingSettings',coalesce((select jsonb_agg(to_jsonb(s)-'user_id')
                       from budget_private.pro_billing_settings s where s.user_id=uid),'[]'::jsonb),
    'clients',coalesce((select jsonb_agg(to_jsonb(c)-'user_id')
                       from budget_private.pro_clients c where c.user_id=uid),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(to_jsonb(p)-'user_id')
                       from budget_private.pro_products p where p.user_id=uid),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(to_jsonb(t)-'user_id')
                       from budget_private.pro_transactions t where t.user_id=uid),'[]'::jsonb),
    'quotes',coalesce((select jsonb_agg(to_jsonb(q)-'user_id')
                       from budget_private.pro_quotes q where q.user_id=uid),'[]'::jsonb),
    'quoteItems',coalesce((select jsonb_agg(to_jsonb(qi))
                       from budget_private.pro_quote_items qi
                       join budget_private.pro_quotes q on q.id=qi.quote_id
                       where q.user_id=uid),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(to_jsonb(i)-'user_id')
                       from budget_private.pro_invoices i where i.user_id=uid),'[]'::jsonb),
    'invoiceItems',coalesce((select jsonb_agg(to_jsonb(it))
                       from budget_private.pro_invoice_items it
                       join budget_private.pro_invoices i on i.id=it.invoice_id
                       where i.user_id=uid),'[]'::jsonb),
    'invoicePayments',coalesce((select jsonb_agg(to_jsonb(p)-'user_id')
                       from budget_private.pro_invoice_payments p where p.user_id=uid),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e)-'user_id')
                       from budget_private.pro_events e where e.user_id=uid),'[]'::jsonb),
    'excluded',jsonb_build_array('calendarSubscriptionTokens','externalStorageFiles'),
    'restorable',false
  );
end;
$$;
revoke all on function public.budget_pro_backup_export() from public,anon;
grant execute on function public.budget_pro_backup_export() to authenticated;
