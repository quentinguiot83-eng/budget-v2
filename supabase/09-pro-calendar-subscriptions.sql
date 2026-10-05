-- Abonnements à l'agenda pro. Prérequis : scripts 06 et 07 appliqués.
-- Exécuter une fois dans Supabase > SQL Editor. Le texte peut être supprimé après succès.
begin;
create table if not exists budget_private.pro_calendar_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references budget_private.pro_businesses(id) on delete cascade,
  token text not null unique check (token ~ '^[a-f0-9]{64}$'),
  primary key (user_id,business_id)
);
alter table budget_private.pro_calendar_subscriptions enable row level security;
revoke all on budget_private.pro_calendar_subscriptions from public,anon,authenticated;

create or replace function public.budget_pro_calendar_subscription(p_business_id uuid,p_action text default 'status')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare token_value text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from budget_private.pro_businesses where id=p_business_id and user_id=auth.uid()) then raise exception 'Entreprise introuvable'; end if;
  if p_action not in ('status','create','rotate','revoke') or p_action is null then raise exception 'Action inconnue'; end if;
  if p_action='revoke' then
    delete from budget_private.pro_calendar_subscriptions where user_id=auth.uid() and business_id=p_business_id;
  elsif p_action in ('create','rotate') then
    token_value := pg_catalog.replace(pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text,'-','');
    if p_action='rotate' then
      insert into budget_private.pro_calendar_subscriptions(user_id,business_id,token) values(auth.uid(),p_business_id,token_value)
      on conflict(user_id,business_id) do update set token=excluded.token;
    else
      insert into budget_private.pro_calendar_subscriptions(user_id,business_id,token) values(auth.uid(),p_business_id,token_value)
      on conflict(user_id,business_id) do nothing;
    end if;
  end if;
  select token into token_value from budget_private.pro_calendar_subscriptions where user_id=auth.uid() and business_id=p_business_id;
  return jsonb_build_object('token',token_value);
end;
$$;

create or replace function public.budget_pro_calendar_feed(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name','Wimm · ' || b.name,'events',coalesce((
    select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,'location',coalesce(e.location,''),'updatedAt',e.updated_at) order by e.starts_at,e.id)
    from budget_private.pro_events e where e.user_id=s.user_id and e.business_id=s.business_id
  ),'[]'::jsonb))
  from budget_private.pro_calendar_subscriptions s
  join budget_private.pro_businesses b on b.id=s.business_id and b.user_id=s.user_id
  where s.token=p_token and p_token ~ '^[a-f0-9]{64}$';
$$;
revoke all on function public.budget_pro_calendar_subscription(uuid,text) from public,anon,authenticated;
revoke all on function public.budget_pro_calendar_feed(text) from public,anon,authenticated;
grant execute on function public.budget_pro_calendar_subscription(uuid,text) to authenticated;
grant execute on function public.budget_pro_calendar_feed(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
