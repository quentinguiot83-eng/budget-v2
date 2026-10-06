-- Wimm — Archivage réversible des factures Pro
-- À exécuter après 08-pro-billing-v2.sql et 08b-pro-billing-v2-sync.sql.
-- Réexécutable. Aucune facture ni aucun paiement n'est supprimé par ce script.
-- Après succès, OUI : vous pouvez supprimer le texte du SQL Editor.
-- Le fichier reste conservé dans GitHub.

begin;

alter table budget_private.pro_invoices add column if not exists archived_at timestamptz;

create or replace function public.budget_pro_invoice_archive(p_id uuid, p_archived boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid;
  invoice_row budget_private.pro_invoices;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_archived is null then raise exception 'Choisissez archiver ou restaurer'; end if;
  bid := budget_private.active_business_id(auth.uid());
  select * into invoice_row from budget_private.pro_invoices
    where id=p_id and user_id=auth.uid() and business_id=bid for update;
  if not found then raise exception 'Facture introuvable dans cette entreprise'; end if;
  update budget_private.pro_invoices
    set archived_at=case when p_archived then coalesce(archived_at,now()) else null end,
        updated_at=now()
    where id=invoice_row.id and user_id=auth.uid() and business_id=bid;
  return public.budget_pro_suite_load();
end $$;

-- La suppression définitive reste réservée aux brouillons non émis sans paiement.
create or replace function public.budget_pro_invoice_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid;
  invoice_row budget_private.pro_invoices;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  bid := budget_private.active_business_id(auth.uid());
  select * into invoice_row from budget_private.pro_invoices
    where id=p_id and user_id=auth.uid() and business_id=bid for update;
  if not found then raise exception 'Facture introuvable dans cette entreprise'; end if;
  if invoice_row.status<>'draft' or invoice_row.issued_at is not null then
    raise exception 'Seul un brouillon non émis peut être supprimé. Archivez cette facture pour la conserver.';
  end if;
  if exists(select 1 from budget_private.pro_invoice_payments where invoice_id=p_id)
    or exists(select 1 from budget_private.pro_transactions where invoice_id=p_id) then
    raise exception 'Ce document possède des paiements ou des opérations liés et ne peut pas être supprimé';
  end if;
  delete from budget_private.pro_invoices where id=p_id and user_id=auth.uid() and business_id=bid;
  return public.budget_pro_suite_load();
end $$;

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
    'invoiceArchivingEnabled',true,
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
      'status',i.status,'issuedAt',i.issued_at,'archivedAt',i.archived_at,'paymentMethod',i.payment_method,'paidDate',i.paid_date,'notes',coalesce(i.notes,''),'sourceQuoteId',i.source_quote_id,
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

revoke execute on function public.budget_pro_invoice_archive(uuid,boolean) from public,anon,authenticated;
revoke execute on function public.budget_pro_invoice_delete(uuid) from public,anon,authenticated;
revoke execute on function public.budget_pro_suite_load() from public,anon,authenticated;
grant execute on function public.budget_pro_invoice_archive(uuid,boolean) to authenticated;
grant execute on function public.budget_pro_invoice_delete(uuid) to authenticated;
grant execute on function public.budget_pro_suite_load() to authenticated;

notify pgrst, 'reload schema';
commit;
