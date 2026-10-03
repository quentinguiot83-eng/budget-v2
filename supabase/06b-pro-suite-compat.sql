-- Wimm / budget-v2 — Compatibilité du module Pro V3
-- À exécuter juste APRÈS 06-pro-business-suite.sql.
-- Réexécutable et sans suppression de données.
-- Après succès, OUI : le texte peut être supprimé du SQL Editor.

begin;

-- Les anciennes fonctions Pro (compte, profil, virements, cotisations, impôts,
-- suppressions...) appellent encore budget_pro_load(). On le fait désormais
-- pointer vers le chargeur V3 afin qu'elles renvoient toutes le même état complet.
create or replace function public.budget_pro_load()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  return public.budget_pro_suite_load();
end $$;

revoke execute on function public.budget_pro_load() from public,anon,authenticated;
grant usage on schema public to authenticated;
grant execute on function public.budget_pro_load() to authenticated;

notify pgrst,'reload schema';
commit;
