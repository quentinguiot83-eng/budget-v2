-- Wimm Pro : charges périodiques par entreprise, avec paiement à confirmer.
-- Aucun prélèvement automatique : les transactions n'existent qu'après validation.
create table if not exists budget_private.pro_recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references budget_private.pro_businesses(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 160),
  category text not null default 'Charges professionnelles',
  amount bigint not null check (amount > 0),
  vat_amount bigint not null default 0 check (vat_amount >= 0 and vat_amount <= amount),
  frequency text not null check (frequency in ('monthly','quarterly','yearly')),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pro_recurring_expenses_end_check check (end_date is null or end_date >= start_date)
);
create index if not exists pro_recurring_expenses_owner_idx
  on budget_private.pro_recurring_expenses(user_id,business_id,status);

create table if not exists budget_private.pro_recurring_expense_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references budget_private.pro_businesses(id) on delete cascade,
  rule_id uuid not null references budget_private.pro_recurring_expenses(id) on delete cascade,
  period_month date not null check (extract(day from period_month) = 1),
  transaction_id uuid not null unique references budget_private.pro_transactions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (rule_id,period_month)
);
create index if not exists pro_recurring_expense_payments_owner_idx
  on budget_private.pro_recurring_expense_payments(user_id,business_id,period_month);

alter table budget_private.pro_recurring_expenses enable row level security;
alter table budget_private.pro_recurring_expense_payments enable row level security;
-- Aucun accès direct : les RPC vérifient l'utilisateur et l'entreprise active.
revoke all on budget_private.pro_recurring_expenses from public,anon,authenticated;
revoke all on budget_private.pro_recurring_expense_payments from public,anon,authenticated;

create or replace function public.budget_pro_recurring_expense_list()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  bid := budget_private.active_business_id(auth.uid());
  if bid is null then return jsonb_build_object('rules','[]'::jsonb,'payments','[]'::jsonb); end if;
  return jsonb_build_object(
    'rules',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'label',r.label,'category',r.category,'amount',r.amount,
        'vatAmount',r.vat_amount,'frequency',r.frequency,'startDate',r.start_date,
        'endDate',r.end_date,'status',r.status
      ) order by r.status,lower(r.label))
      from budget_private.pro_recurring_expenses r
      where r.user_id=auth.uid() and r.business_id=bid
    ),'[]'::jsonb),
    'payments',coalesce((
      select jsonb_agg(jsonb_build_object(
        'ruleId',p.rule_id,'periodMonth',to_char(p.period_month,'YYYY-MM'),
        'transactionId',p.transaction_id
      ))
      from budget_private.pro_recurring_expense_payments p
      where p.user_id=auth.uid() and p.business_id=bid
    ),'[]'::jsonb)
  );
end $$;

create or replace function public.budget_pro_recurring_expense_save(p_rule jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid;
  rule_id uuid := nullif(p_rule->>'id','')::uuid;
  name_value text := btrim(coalesce(p_rule->>'label',''));
  category_value text := btrim(coalesce(p_rule->>'category',''));
  amount_value bigint := coalesce(nullif(p_rule->>'amount','')::bigint,0);
  vat_value bigint := coalesce(nullif(p_rule->>'vatAmount','')::bigint,0);
  frequency_value text := p_rule->>'frequency';
  start_value date := nullif(p_rule->>'startDate','')::date;
  end_value date := nullif(p_rule->>'endDate','')::date;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  bid := budget_private.active_business_id(auth.uid());
  if bid is null then raise exception 'Entreprise introuvable'; end if;
  if length(name_value) not between 1 and 160 or length(category_value)>100
     or amount_value <= 0 or vat_value < 0 or vat_value > amount_value
     or frequency_value not in ('monthly','quarterly','yearly') or start_value is null
     or (end_value is not null and end_value < start_value)
  then raise exception 'Charge récurrente invalide'; end if;
  if category_value='' then category_value:='Charges professionnelles'; end if;
  if rule_id is null then
    insert into budget_private.pro_recurring_expenses(
      user_id,business_id,label,category,amount,vat_amount,frequency,start_date,end_date
    ) values (auth.uid(),bid,name_value,category_value,amount_value,vat_value,frequency_value,start_value,end_value);
  else
    update budget_private.pro_recurring_expenses
       set label=name_value,category=category_value,amount=amount_value,
           vat_amount=vat_value,frequency=frequency_value,start_date=start_value,
           end_date=end_value,updated_at=now()
     where id=rule_id and user_id=auth.uid() and business_id=bid;
    if not found then raise exception 'Charge introuvable'; end if;
  end if;
  return public.budget_pro_recurring_expense_list();
end $$;

create or replace function public.budget_pro_recurring_expense_status(p_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_status not in ('active','paused') then raise exception 'Statut invalide'; end if;
  bid:=budget_private.active_business_id(auth.uid());
  update budget_private.pro_recurring_expenses
     set status=p_status,updated_at=now()
   where id=p_id and user_id=auth.uid() and business_id=bid;
  if not found then raise exception 'Charge introuvable'; end if;
  return public.budget_pro_recurring_expense_list();
end $$;

create or replace function public.budget_pro_recurring_expense_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  bid:=budget_private.active_business_id(auth.uid());
  delete from budget_private.pro_recurring_expenses
   where id=p_id and user_id=auth.uid() and business_id=bid;
  if not found then raise exception 'Charge introuvable'; end if;
  -- Les transactions déjà comptabilisées sont conservées.
  return public.budget_pro_recurring_expense_list();
end $$;

create or replace function public.budget_pro_recurring_expense_pay(
  p_id uuid,p_period_month date,p_paid_date date default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  bid uuid;
  r budget_private.pro_recurring_expenses%rowtype;
  account_value uuid;
  tx_id uuid;
  period_value date := date_trunc('month',p_period_month)::date;
  payment_date_value date := coalesce(p_paid_date,(now() at time zone 'Europe/Paris')::date);
  current_date_value date := (now() at time zone 'Europe/Paris')::date;
  months_diff integer;
  step_months integer;
  due_date date;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_period_month is null or p_period_month<>period_value then raise exception 'Mois invalide'; end if;
  if payment_date_value>current_date_value then raise exception 'Paiement futur non autorisé'; end if;
  bid:=budget_private.active_business_id(auth.uid());
  select * into r from budget_private.pro_recurring_expenses
    where id=p_id and user_id=auth.uid() and business_id=bid for update;
  if r.id is null then raise exception 'Charge introuvable'; end if;
  if exists(select 1 from budget_private.pro_recurring_expense_payments
     where rule_id=r.id and user_id=auth.uid() and business_id=bid and period_month=period_value)
  then return public.budget_pro_recurring_expense_list(); end if;
  if r.status<>'active' then raise exception 'Cette charge est en pause'; end if;
  months_diff := (extract(year from period_value)::integer-extract(year from r.start_date)::integer)*12
     + extract(month from period_value)::integer-extract(month from r.start_date)::integer;
  step_months := case r.frequency when 'quarterly' then 3 when 'yearly' then 12 else 1 end;
  due_date := make_date(extract(year from period_value)::integer,extract(month from period_value)::integer,
    least(extract(day from r.start_date)::integer,
      extract(day from (period_value+interval '1 month - 1 day'))::integer));
  if months_diff<0 or mod(months_diff,step_months)<>0
     or period_value>date_trunc('month',current_date_value)::date
     or (r.end_date is not null and due_date>r.end_date)
  then raise exception 'Aucune échéance pour cette période'; end if;
  select id into account_value from budget_private.pro_accounts where user_id=auth.uid();
  if account_value is null then
    insert into budget_private.pro_accounts(user_id) values(auth.uid()) returning id into account_value;
  end if;
  insert into budget_private.pro_transactions(
    user_id,business_id,kind,label,amount,transaction_date,category,
    account_id,vat_amount,paid,notes
  ) values (
    auth.uid(),bid,'expense',r.label,r.amount,payment_date_value,r.category,
    account_value,r.vat_amount,true,'Charge récurrente · échéance '||to_char(period_value,'MM/YYYY')
  ) returning id into tx_id;
  insert into budget_private.pro_recurring_expense_payments(
    user_id,business_id,rule_id,period_month,transaction_id
  ) values(auth.uid(),bid,r.id,period_value,tx_id);
  return public.budget_pro_recurring_expense_list();
end $$;

revoke all on function public.budget_pro_recurring_expense_list() from public,anon,authenticated;
revoke all on function public.budget_pro_recurring_expense_save(jsonb) from public,anon,authenticated;
revoke all on function public.budget_pro_recurring_expense_status(uuid,text) from public,anon,authenticated;
revoke all on function public.budget_pro_recurring_expense_delete(uuid) from public,anon,authenticated;
revoke all on function public.budget_pro_recurring_expense_pay(uuid,date,date) from public,anon,authenticated;
grant execute on function public.budget_pro_recurring_expense_list() to authenticated;
grant execute on function public.budget_pro_recurring_expense_save(jsonb) to authenticated;
grant execute on function public.budget_pro_recurring_expense_status(uuid,text) to authenticated;
grant execute on function public.budget_pro_recurring_expense_delete(uuid) to authenticated;
grant execute on function public.budget_pro_recurring_expense_pay(uuid,date,date) to authenticated;
