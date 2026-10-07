-- Wimm — Notifications sur téléphone
-- Prérequis : module Pro et Facturation V2 (script 08).
-- Réexécutable. Ne supprime aucune donnée budgétaire.
-- Après succès, OUI : le texte peut être supprimé du SQL Editor.
begin;
create table if not exists budget_private.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references budget_private.households(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  budgets boolean not null default true,
  dues boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists budget_private.push_deliveries (
  device_id uuid not null references budget_private.push_devices(id) on delete cascade,
  alert_key text not null,
  delivered boolean not null default false,
  lease_until timestamptz not null default now(),
  attempts int not null default 0,
  primary key(device_id,alert_key)
);
alter table budget_private.push_devices enable row level security;
alter table budget_private.push_deliveries enable row level security;
revoke all on budget_private.push_devices,budget_private.push_deliveries from public,anon,authenticated;

create or replace function public.budget_push_device(p_subscription jsonb, p_action text default 'save', p_budgets boolean default true, p_dues boolean default true, p_baseline text[] default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid; device budget_private.push_devices; endpoint_value text:=p_subscription->>'endpoint';
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select household_id into h from budget_private.members where user_id=auth.uid();
  if h is null then raise exception 'Accès refusé'; end if;
  if p_action not in ('save','status','delete') or p_action is null then raise exception 'Action inconnue'; end if;
  if endpoint_value is null or length(endpoint_value)>2048 or endpoint_value not like 'https://%' then raise exception 'Abonnement invalide'; end if;
  if p_action='delete' then
    delete from budget_private.push_devices where endpoint=endpoint_value and user_id=auth.uid();
    return jsonb_build_object('enabled',false);
  end if;
  select * into device from budget_private.push_devices where endpoint=endpoint_value;
  if device.id is not null and device.user_id<>auth.uid() then
    raise exception 'Les notifications de cet appareil sont liées à un autre compte. Désactivez-les depuis ce compte avant de changer.';
  end if;
  if p_action='status' then
    return jsonb_build_object('id',device.id,'enabled',device.id is not null and device.household_id=h,'budgets',device.budgets,'dues',device.dues);
  end if;
  if p_budgets is null or p_dues is null or jsonb_typeof(p_subscription->'keys')<>'object'
    or coalesce(p_subscription->'keys'->>'p256dh','') !~ '^[A-Za-z0-9_-]{80,120}={0,2}$'
    or coalesce(p_subscription->'keys'->>'auth','') !~ '^[A-Za-z0-9_-]{20,30}={0,2}$' then
    raise exception 'Clés d’abonnement invalides';
  end if;
  if device.id is not null and device.household_id<>h then
    delete from budget_private.push_deliveries where device_id=device.id;
  end if;
  insert into budget_private.push_devices(user_id,household_id,endpoint,subscription,budgets,dues)
  values(auth.uid(),h,endpoint_value,p_subscription,p_budgets,p_dues)
  on conflict(endpoint) do update set household_id=excluded.household_id,subscription=excluded.subscription,budgets=excluded.budgets,dues=excluded.dues,updated_at=now()
  where budget_private.push_devices.user_id=auth.uid() returning * into device;
  if device.id is null then raise exception 'Abonnement indisponible'; end if;
  -- Ne pas envoyer les anciens dépassements au moment de l'activation.
  insert into budget_private.push_deliveries(device_id,alert_key,delivered)
  select device.id,k,true from unnest(p_baseline[1:200]) k where k like 'budget:%' and length(k)<200
  on conflict do nothing;
  return jsonb_build_object('id',device.id,'enabled',true,'budgets',device.budgets,'dues',device.dues);
end $$;

-- Ces fonctions sont réservées au serveur, jamais au navigateur.
create or replace function public.budget_push_context(p_user uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'userId',s.user_id,'subscription',s.subscription,'budgets',s.budgets,'dues',s.dues,'state',d.body,
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'number',i.invoice_number,'dueDate',i.due_date,'status',i.status,'businessName',b.name))
      from budget_private.pro_invoices i join budget_private.pro_businesses b on b.id=i.business_id
      where i.user_id=s.user_id and i.status in ('sent','partially_paid') and i.due_date<=current_date),'[]'::jsonb)
  )),'[]'::jsonb)
  from budget_private.push_devices s
  join budget_private.members m on m.user_id=s.user_id and m.household_id=s.household_id
  join budget_private.documents d on d.household_id=s.household_id
  where (p_user is null or s.household_id=(select household_id from budget_private.members where user_id=p_user));
$$;

create or replace function public.budget_push_claim(p_id uuid,p_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare claimed boolean;
begin
  if length(p_key)>200 or p_key is null then return false; end if;
  if not exists(select 1 from budget_private.push_devices where id=p_id) then return false; end if;
  insert into budget_private.push_deliveries(device_id,alert_key,lease_until,attempts)
  values(p_id,p_key,now()+interval '5 minutes',1)
  on conflict(device_id,alert_key) do update set lease_until=now()+interval '5 minutes',attempts=budget_private.push_deliveries.attempts+1
  where not budget_private.push_deliveries.delivered and budget_private.push_deliveries.lease_until<now() and budget_private.push_deliveries.attempts<5
  returning true into claimed;
  return coalesce(claimed,false);
end $$;
create or replace function public.budget_push_finish(p_id uuid,p_keys text[],p_success boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  update budget_private.push_deliveries set delivered=p_success,lease_until=now()+interval '5 minutes'
  where device_id=p_id and alert_key=any(p_keys) and not delivered;
  return '{}'::jsonb;
end $$;
create or replace function public.budget_push_expire(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  delete from budget_private.push_devices where id=p_id;
  return '{}'::jsonb;
end $$;
revoke all on function public.budget_push_device(jsonb,text,boolean,boolean,text[]) from public,anon,authenticated;
grant execute on function public.budget_push_device(jsonb,text,boolean,boolean,text[]) to authenticated;
revoke all on function public.budget_push_context(uuid),public.budget_push_claim(uuid,text),public.budget_push_finish(uuid,text[],boolean),public.budget_push_expire(uuid) from public,anon,authenticated;
grant execute on function public.budget_push_context(uuid),public.budget_push_claim(uuid,text),public.budget_push_finish(uuid,text[],boolean),public.budget_push_expire(uuid) to service_role;
notify pgrst,'reload schema';
commit;
