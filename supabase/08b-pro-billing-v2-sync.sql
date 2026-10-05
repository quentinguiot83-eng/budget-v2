-- Wimm / budget-v2 — Facturation Pro V2 : cohérence paiement / trésorerie
-- À exécuter JUSTE APRÈS 08-pro-billing-v2.sql.
-- Réexécutable et sans suppression de données métier.
-- Après succès, OUI : le texte peut être supprimé du SQL Editor. Conservez ce fichier dans GitHub.

begin;

create or replace function public.budget_pro_transaction_delete(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  row_kind text;
  row_business uuid;
  mirror_id uuid;
  payment_row budget_private.pro_invoice_payments;
  invoice_row budget_private.pro_invoices;
  total_paid bigint;
  household uuid;
  document_body jsonb;
  new_transactions jsonb;
  new_body jsonb;
  new_revision int;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;

  select kind,business_id,personal_transaction_id
  into row_kind,row_business,mirror_id
  from budget_private.pro_transactions
  where id=p_id and user_id=auth.uid();

  if row_kind is null then raise exception 'Opération introuvable'; end if;

  -- Un encaissement de facture et son paiement sont une seule réalité métier.
  select * into payment_row
  from budget_private.pro_invoice_payments
  where transaction_id=p_id and user_id=auth.uid();

  if payment_row.id is not null then
    select * into invoice_row
    from budget_private.pro_invoices
    where id=payment_row.invoice_id and user_id=auth.uid()
    for update;

    delete from budget_private.pro_invoice_payments where id=payment_row.id;
    delete from budget_private.pro_transactions where id=p_id and user_id=auth.uid();

    if invoice_row.id is not null then
      select coalesce(sum(amount),0) into total_paid
      from budget_private.pro_invoice_payments
      where invoice_id=invoice_row.id;

      update budget_private.pro_invoices set
        status=case
          when total_paid<=0 then 'sent'
          when total_paid<total_ttc then 'partially_paid'
          else 'paid'
        end,
        paid_date=case
          when total_paid>=total_ttc then (
            select max(payment_date) from budget_private.pro_invoice_payments where invoice_id=invoice_row.id
          )
          else null
        end,
        updated_at=now()
      where id=invoice_row.id;
    end if;

    return public.budget_pro_suite_load();
  end if;

  -- Conservation du comportement historique pour les virements Pro -> perso.
  if row_kind='transfer_personal' and mirror_id is not null then
    select household_id into household
    from budget_private.members
    where user_id=auth.uid();

    if household is not null then
      perform pg_advisory_xact_lock(hashtextextended(household::text,0));

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

        new_body:=jsonb_set(document_body,'{transactions}',new_transactions);
        perform budget_private.check_document(new_body);

        update budget_private.documents
        set body=new_body,revision=revision+1,updated_at=now()
        where household_id=household
        returning revision into new_revision;

        insert into budget_private.audit(household_id,user_id,revision,action)
        values(household,auth.uid(),new_revision,'Suppression virement activité pro vers budget personnel');
      end if;
    end if;
  end if;

  delete from budget_private.pro_transactions
  where id=p_id and user_id=auth.uid();

  return public.budget_pro_suite_load();
end $$;

revoke execute on function public.budget_pro_transaction_delete(uuid) from public,anon,authenticated;
grant usage on schema public to authenticated;
grant execute on function public.budget_pro_transaction_delete(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
