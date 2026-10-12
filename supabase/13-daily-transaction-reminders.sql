-- Wimm: per-device daily transaction entry reminder.
-- Durable versioned migration: keep this file after running.
-- No changes to financial documents, transactions, budgets, or balances.
alter table budget_private.push_devices
  add column if not exists daily_reminder boolean not null default false,
  add column if not exists reminder_time time without time zone not null default time '20:00',
  add column if not exists reminder_timezone text not null default 'Europe/Paris';

-- Browser uses its already registered device subscription; cannot change another user's device.
create or replace function public.budget_push_reminder(
  p_subscription jsonb,
  p_action text default 'status',
  p_enabled boolean default false,
  p_time text default '20:00',
  p_timezone text default 'Europe/Paris'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  endpoint_value text := p_subscription->>'endpoint';
  device budget_private.push_devices;
  parsed_time time;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_action not in ('status','save') or p_action is null then raise exception 'Action inconnue'; end if;
  if endpoint_value is null or length(endpoint_value)>2048 or endpoint_value not like 'https://%' then
    raise exception 'Abonnement invalide';
  end if;
  select * into device from budget_private.push_devices where endpoint=endpoint_value and user_id=auth.uid();
  if device.id is null then
    if p_action='status' then return jsonb_build_object('enabled',false,'dailyReminder',false,'time','20:00','timezone','Europe/Paris'); end if;
    raise exception 'Activez d’abord les notifications Wimm sur cet appareil';
  end if;
  if p_action='save' then
    if p_enabled is null or p_time is null or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or p_timezone is null or length(p_timezone)>80
        or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
      raise exception 'Heure ou fuseau horaire invalide';
    end if;
    parsed_time := p_time::time;
    update budget_private.push_devices
      set daily_reminder=p_enabled, reminder_time=parsed_time,
          reminder_timezone=p_timezone,updated_at=now()
      where id=device.id returning * into device;
  end if;
  return jsonb_build_object(
    'enabled',true,'dailyReminder',device.daily_reminder,
    'time',to_char(device.reminder_time,'HH24:MI'),'timezone',device.reminder_timezone
  );
end;
$$;
revoke all on function public.budget_push_reminder(jsonb,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.budget_push_reminder(jsonb,text,boolean,text,text) to authenticated;

-- Read-only service-role context includes each device's chosen local time.
create or replace function public.budget_push_context(p_user uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'userId',s.user_id,'subscription',s.subscription,'budgets',s.budgets,'dues',s.dues,'state',d.body,
    'dailyReminder',s.daily_reminder,'reminderTime',to_char(s.reminder_time,'HH24:MI'),'reminderTimezone',s.reminder_timezone,
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'number',i.invoice_number,'dueDate',i.due_date,'status',i.status,'businessName',b.name))
      from budget_private.pro_invoices i join budget_private.pro_businesses b on b.id=i.business_id
      where i.user_id=s.user_id and i.status in ('sent','partially_paid') and i.due_date<=current_date),'[]'::jsonb)
  )),'[]'::jsonb)
  from budget_private.push_devices s
  join budget_private.members m on m.user_id=s.user_id and m.household_id=s.household_id
  join budget_private.documents d on d.household_id=s.household_id
  where (p_user is null or s.household_id=(select household_id from budget_private.members where user_id=p_user));
$$;


notify pgrst,'reload schema';
