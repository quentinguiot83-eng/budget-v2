-- Defense-in-depth for internal SECURITY DEFINER scheduling helpers.
revoke all on function budget_private.pro_recurring_sync(uuid) from public,anon,authenticated;
revoke all on function budget_private.pro_recurring_prepare(uuid,boolean) from public,anon,authenticated;
-- Pausing stops future unbilled visits while retaining completed history.
create or replace function public.budget_pro_recurring_set_status(p_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_status not in ('active','paused') then raise exception 'Statut invalide'; end if;
 update budget_private.pro_recurring_rules set status=p_status,updated_at=now()
  where id=p_id and user_id=auth.uid() and business_id=budget_private.active_business_id(auth.uid());
 if not found then raise exception 'Récurrence introuvable'; end if;
 if p_status='paused' then
   delete from budget_private.pro_recurring_visits
   where rule_id=p_id and status='scheduled' and invoiced_at is null
     and service_date >= (now() at time zone 'Europe/Paris')::date;
 else
   perform budget_private.pro_recurring_sync(auth.uid());
 end if;
 return public.budget_pro_recurring_load();
end $$;
revoke all on function public.budget_pro_recurring_set_status(uuid,text) from public;
grant execute on function public.budget_pro_recurring_set_status(uuid,text) to authenticated;