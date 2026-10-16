-- Additive Wimm Pro recurring contracts; does not alter existing invoices.
create table if not exists budget_private.pro_recurring_rules (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 business_id uuid not null references budget_private.pro_businesses(id) on delete cascade,
 client_id uuid not null references budget_private.pro_clients(id),
 title text not null,
 frequency text not null check(frequency in ('weekly','biweekly','twice_monthly')),
 day_one int not null default 1 check(day_one between 1 and 28),
 day_two int not null default 15 check(day_two between 1 and 28),
 start_date date not null,
 end_date date,
 billing_mode text not null default 'monthly' check(billing_mode in ('monthly','per_visit')),
 price_mode text not null default 'per_visit' check(price_mode in ('per_visit','flat_monthly')),
 unit_price bigint not null check(unit_price>=0 and unit_price<=1000000000),
 vat_rate numeric(5,2) not null default 0 check(vat_rate between 0 and 100),
 auto_draft boolean not null default true,
 status text not null default 'active' check(status in ('active','paused')),
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(end_date is null or end_date>=start_date),
 check(day_one<>day_two),
 check(price_mode='per_visit' or billing_mode='monthly')
);
create index if not exists pro_recurring_rules_owner on budget_private.pro_recurring_rules(user_id,business_id,status);
alter table budget_private.pro_recurring_rules enable row level security;
drop policy if exists "Recurring rules belong to user" on budget_private.pro_recurring_rules;
create policy "Recurring rules belong to user" on budget_private.pro_recurring_rules
 for all to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid());

create table if not exists budget_private.pro_recurring_visits (
 id uuid primary key default gen_random_uuid(),
 rule_id uuid not null references budget_private.pro_recurring_rules(id) on delete cascade,
 service_date date not null,
 status text not null default 'scheduled' check(status in ('scheduled','done','cancelled')),
 invoice_id uuid references budget_private.pro_invoices(id) on delete set null,
 invoiced_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(rule_id,service_date)
);
create index if not exists pro_recurring_visits_due on budget_private.pro_recurring_visits(rule_id,status,service_date);
alter table budget_private.pro_recurring_visits enable row level security;
drop policy if exists "Recurring visits belong to user" on budget_private.pro_recurring_visits;
create policy "Recurring visits belong to user" on budget_private.pro_recurring_visits
 for all to authenticated using (exists(select 1 from budget_private.pro_recurring_rules r where r.id=rule_id and r.user_id=auth.uid()))
 with check(exists(select 1 from budget_private.pro_recurring_rules r where r.id=rule_id and r.user_id=auth.uid()));

create table if not exists budget_private.pro_recurring_batches (
 id uuid primary key default gen_random_uuid(),
 rule_id uuid not null references budget_private.pro_recurring_rules(id) on delete cascade,
 period_key text not null,
 invoice_id uuid references budget_private.pro_invoices(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(rule_id,period_key)
);
alter table budget_private.pro_recurring_batches enable row level security;
drop policy if exists "Recurring batches belong to user" on budget_private.pro_recurring_batches;
create policy "Recurring batches belong to user" on budget_private.pro_recurring_batches
 for all to authenticated using (exists(select 1 from budget_private.pro_recurring_rules r where r.id=rule_id and r.user_id=auth.uid()))
 with check(exists(select 1 from budget_private.pro_recurring_rules r where r.id=rule_id and r.user_id=auth.uid()));

create or replace function budget_private.pro_recurring_sync(p_owner uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare r record; day_date date; today_paris date := (now() at time zone 'Europe/Paris')::date;
begin
 for r in select * from budget_private.pro_recurring_rules
  where status='active' and (p_owner is null or user_id=p_owner) loop
   for day_date in select gs::date from generate_series(
      greatest(r.start_date,today_paris),least(coalesce(r.end_date,today_paris+interval '62 days')::date,today_paris+interval '62 days'),'1 day'::interval) gs loop
     if (r.frequency='weekly' and mod(day_date-r.start_date,7)=0)
        or (r.frequency='biweekly' and mod(day_date-r.start_date,14)=0)
        or (r.frequency='twice_monthly' and extract(day from day_date)::int in (r.day_one,r.day_two)) then
       insert into budget_private.pro_recurring_visits(rule_id,service_date)
       values(r.id,day_date) on conflict(rule_id,service_date) do nothing;
     end if;
   end loop;
 end loop;
end $$;

create or replace function budget_private.pro_recurring_prepare(p_owner uuid default null,p_force boolean default false)
returns integer language plpgsql security definer set search_path='' as $$
declare
 r record; v record; group_row record; b budget_private.pro_businesses; inv_id uuid;
 amount_ht bigint; amount_vat bigint; qty int; invoice_date date;
 today_paris date:=(now() at time zone 'Europe/Paris')::date; made integer:=0;
 batch_id uuid; period text; item_desc text;
begin
 for r in select * from budget_private.pro_recurring_rules
  where (p_owner is null or user_id=p_owner) and (auto_draft or p_force)
  order by id for update loop
  select * into b from budget_private.pro_businesses where id=r.business_id and user_id=r.user_id;
  if b.id is null or not exists(select 1 from budget_private.pro_clients where id=r.client_id and business_id=r.business_id and user_id=r.user_id) then continue; end if;
  if r.billing_mode='per_visit' then
   for v in select * from budget_private.pro_recurring_visits
     where rule_id=r.id and status='done' and service_date<=today_paris and invoiced_at is null
     order by service_date for update loop
     invoice_date:=today_paris;qty:=1;amount_ht:=r.unit_price;amount_vat:=round(amount_ht*r.vat_rate/100);
     item_desc:=r.title||' — prestation du '||to_char(v.service_date,'DD/MM/YYYY');
     insert into budget_private.pro_invoices(user_id,business_id,invoice_number,client_id,client_snapshot,seller_snapshot,issue_date,due_date,status,notes,total_ht,total_vat,total_ttc,service_date,operation_type)
     values(r.user_id,r.business_id,'DRAFT-'||replace(gen_random_uuid()::text,'-',''),r.client_id,
        budget_private.pro_client_snapshot(r.user_id,r.business_id,r.client_id),
        budget_private.pro_seller_snapshot(r.user_id,r.business_id),invoice_date,
        invoice_date+b.default_payment_days,'draft','Préparée depuis la récurrence '||r.title,amount_ht,amount_vat,amount_ht+amount_vat,v.service_date,'services')
     returning id into inv_id;
     insert into budget_private.pro_invoice_items(invoice_id,description,quantity,unit_price,vat_rate,line_order)
       values(inv_id,item_desc,1,r.unit_price,r.vat_rate,1);
     update budget_private.pro_recurring_visits set invoice_id=inv_id,invoiced_at=now(),updated_at=now() where id=v.id;
     made:=made+1;
   end loop;
  else
   for group_row in select to_char(service_date,'YYYY-MM') as period_key,count(*)::int as visits,max(service_date) as last_service
    from budget_private.pro_recurring_visits
    where rule_id=r.id and status='done' and invoiced_at is null and service_date<date_trunc('month',today_paris)::date
    group by to_char(service_date,'YYYY-MM') order by period_key loop
      period:=group_row.period_key;qty:=group_row.visits;
      insert into budget_private.pro_recurring_batches(rule_id,period_key)
       values(r.id,period) on conflict(rule_id,period_key) do nothing returning id into batch_id;
      if batch_id is null then continue; end if;
      invoice_date:=today_paris;
      amount_ht:=case when r.price_mode='flat_monthly' then r.unit_price else qty*r.unit_price end;
      amount_vat:=round(amount_ht*r.vat_rate/100);
      item_desc:=r.title||' — '||period||' ('||qty||' intervention'||case when qty>1 then 's' else '' end||')';
      insert into budget_private.pro_invoices(user_id,business_id,invoice_number,client_id,client_snapshot,seller_snapshot,issue_date,due_date,status,notes,total_ht,total_vat,total_ttc,service_date,operation_type)
      values(r.user_id,r.business_id,'DRAFT-'||replace(gen_random_uuid()::text,'-',''),r.client_id,
       budget_private.pro_client_snapshot(r.user_id,r.business_id,r.client_id),
       budget_private.pro_seller_snapshot(r.user_id,r.business_id),invoice_date,
       invoice_date+b.default_payment_days,'draft','Facturation mensuelle récurrente '||period,amount_ht,amount_vat,amount_ht+amount_vat,group_row.last_service,'services')
      returning id into inv_id;
      insert into budget_private.pro_invoice_items(invoice_id,description,quantity,unit_price,vat_rate,line_order)
       values(inv_id,item_desc,case when r.price_mode='flat_monthly' then 1 else qty end,r.unit_price,r.vat_rate,1);
      update budget_private.pro_recurring_visits set invoice_id=inv_id,invoiced_at=now(),updated_at=now()
       where rule_id=r.id and status='done' and invoiced_at is null and to_char(service_date,'YYYY-MM')=period;
      update budget_private.pro_recurring_batches set invoice_id=inv_id where id=batch_id;
      made:=made+1;batch_id:=null;
   end loop;
  end if;
 end loop;
 return made;
end $$;

create or replace function public.budget_pro_recurring_load()
returns jsonb language plpgsql security definer set search_path='' as $$
declare bid uuid := budget_private.active_business_id(auth.uid());
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 return jsonb_build_object(
  'rules',coalesce((select jsonb_agg(jsonb_build_object(
   'id',r.id,'clientId',r.client_id,'title',r.title,'frequency',r.frequency,'dayOne',r.day_one,'dayTwo',r.day_two,
   'startDate',r.start_date,'endDate',r.end_date,'billingMode',r.billing_mode,'priceMode',r.price_mode,
   'unitPrice',r.unit_price,'vatRate',r.vat_rate,'autoDraft',r.auto_draft,'status',r.status,'notes',r.notes
  ) order by r.created_at desc) from budget_private.pro_recurring_rules r where r.user_id=auth.uid() and r.business_id=bid),'[]'::jsonb),
  'visits',coalesce((select jsonb_agg(jsonb_build_object(
   'id',v.id,'ruleId',v.rule_id,'date',v.service_date,'status',v.status,
   'invoiceId',v.invoice_id,'invoiced',v.invoiced_at is not null
  ) order by v.service_date asc) from budget_private.pro_recurring_visits v
  join budget_private.pro_recurring_rules r on r.id=v.rule_id where r.user_id=auth.uid() and r.business_id=bid and v.service_date between ((now() at time zone 'Europe/Paris')::date - interval '62 days')::date and ((now() at time zone 'Europe/Paris')::date + interval '62 days')::date),'[]'::jsonb)
 );
end $$;

create or replace function public.budget_pro_recurring_save(p_rule jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bid uuid := budget_private.active_business_id(auth.uid());
 rid uuid := nullif(p_rule->>'id','')::uuid; client uuid := nullif(p_rule->>'clientId','')::uuid;
 title_text text:=trim(coalesce(p_rule->>'title',''));
 freq text:=coalesce(p_rule->>'frequency','weekly');
 mode text:=coalesce(p_rule->>'billingMode','monthly');
 price_mode_value text:=coalesce(p_rule->>'priceMode','per_visit');
 start_day date:=nullif(p_rule->>'startDate','')::date;
 end_day date:=nullif(p_rule->>'endDate','')::date;
 day1 int:=coalesce((p_rule->>'dayOne')::int,1);
 day2 int:=coalesce((p_rule->>'dayTwo')::int,15);
 price bigint:=coalesce((p_rule->>'unitPrice')::bigint,0);
 vat numeric:=coalesce((p_rule->>'vatRate')::numeric,0);
begin
 if auth.uid() is null or bid is null then raise exception 'Accès refusé'; end if;
 if client is null or not exists(select 1 from budget_private.pro_clients where id=client and user_id=auth.uid() and business_id=bid) then raise exception 'Client invalide'; end if;
 if length(title_text)<2 or length(title_text)>180 then raise exception 'Nom de prestation invalide'; end if;
 if freq not in ('weekly','biweekly','twice_monthly') or mode not in ('monthly','per_visit') or price_mode_value not in ('per_visit','flat_monthly') then raise exception 'Fréquence invalide'; end if;
 if price_mode_value='flat_monthly' and mode<>'monthly' then raise exception 'Forfait réservé à la facturation mensuelle'; end if;
 if start_day is null or end_day<start_day or day1 not between 1 and 28 or day2 not between 1 and 28 or day1=day2 then raise exception 'Dates invalides'; end if;
 if price<0 or price>1000000000 or vat<0 or vat>100 then raise exception 'Prix ou TVA invalide'; end if;
 if not (select vat_enabled from budget_private.pro_businesses where id=bid and user_id=auth.uid()) then vat:=0; end if;
 if rid is null then
  insert into budget_private.pro_recurring_rules(user_id,business_id,client_id,title,frequency,day_one,day_two,start_date,end_date,billing_mode,price_mode,unit_price,vat_rate,auto_draft,notes)
  values(auth.uid(),bid,client,title_text,freq,day1,day2,start_day,end_day,mode,price_mode_value,price,vat,coalesce((p_rule->>'autoDraft')::boolean,true),left(coalesce(p_rule->>'notes',''),1000));
 else
  update budget_private.pro_recurring_rules set client_id=client,title=title_text,frequency=freq,day_one=day1,day_two=day2,
  start_date=start_day,end_date=end_day,billing_mode=mode,price_mode=price_mode_value,unit_price=price,vat_rate=vat,
  auto_draft=coalesce((p_rule->>'autoDraft')::boolean,true),notes=left(coalesce(p_rule->>'notes',''),1000),updated_at=now()
  where id=rid and user_id=auth.uid() and business_id=bid;
  if not found then raise exception 'Récurrence introuvable'; end if;
  delete from budget_private.pro_recurring_visits where rule_id=rid and status='scheduled' and invoiced_at is null and service_date>=((now() at time zone 'Europe/Paris')::date);
 end if;
 perform budget_private.pro_recurring_sync(auth.uid());
 return public.budget_pro_recurring_load();
end $$;

create or replace function public.budget_pro_recurring_set_status(p_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_status not in ('active','paused') then raise exception 'Statut invalide'; end if;
 update budget_private.pro_recurring_rules set status=p_status,updated_at=now()
  where id=p_id and user_id=auth.uid() and business_id=budget_private.active_business_id(auth.uid());
 if not found then raise exception 'Récurrence introuvable'; end if;
 perform budget_private.pro_recurring_sync(auth.uid());
 return public.budget_pro_recurring_load();
end $$;

create or replace function public.budget_pro_recurring_visit_status(p_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare day_date date;
begin
 if auth.uid() is null or p_status not in ('done','cancelled','scheduled') then raise exception 'Statut invalide'; end if;
 select v.service_date into day_date from budget_private.pro_recurring_visits v
 join budget_private.pro_recurring_rules r on r.id=v.rule_id
 where v.id=p_id and r.user_id=auth.uid() and r.business_id=budget_private.active_business_id(auth.uid()) and v.invoiced_at is null;
 if day_date is null then raise exception 'Intervention introuvable ou déjà facturée'; end if;
 if p_status='done' and day_date>(now() at time zone 'Europe/Paris')::date then raise exception 'Une intervention future ne peut pas être déclarée effectuée'; end if;
 update budget_private.pro_recurring_visits set status=p_status,updated_at=now() where id=p_id;
 perform budget_private.pro_recurring_prepare(auth.uid(),false);
 return public.budget_pro_recurring_load();
end $$;

create or replace function public.budget_pro_recurring_refresh()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 perform budget_private.pro_recurring_sync(auth.uid());
 perform budget_private.pro_recurring_prepare(auth.uid(),false);
 return public.budget_pro_recurring_load();
end $$;

create or replace function public.budget_pro_recurring_prepare_now()
returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 return budget_private.pro_recurring_prepare(auth.uid(),true);
end $$;

revoke all on function public.budget_pro_recurring_load() from public;
revoke all on function public.budget_pro_recurring_save(jsonb) from public;
revoke all on function public.budget_pro_recurring_set_status(uuid,text) from public;
revoke all on function public.budget_pro_recurring_visit_status(uuid,text) from public;
revoke all on function public.budget_pro_recurring_refresh() from public;
revoke all on function public.budget_pro_recurring_prepare_now() from public;
grant execute on function public.budget_pro_recurring_load(),public.budget_pro_recurring_save(jsonb),
 public.budget_pro_recurring_set_status(uuid,text),public.budget_pro_recurring_visit_status(uuid,text),
 public.budget_pro_recurring_refresh(),public.budget_pro_recurring_prepare_now() to authenticated;
