-- Snapshot of four user-data-free function definitions fetched read-only
-- from Wimm production pg_get_functiondef on 2026-10-21.
-- FOR LOCAL PGLITE ISOLATION TESTS ONLY. NEVER APPLY THIS FIXTURE TO PRODUCTION.
-- All identities, personal budgets and account contents are generated in the test.
-- Re-check the functions against production when deploying new migrations.

CREATE OR REPLACE FUNCTION budget_private.check_personal_document(b jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  t jsonb;
  r jsonb;
begin

  if jsonb_typeof(b) <> 'object'
     or coalesce((b->>'schema')::int, 0) <> 1
     or octet_length(b::text) > 5000000
  then
    raise exception 'Format du compte personnel invalide';
  end if;

  if b->'account' is not null
     and b->'account' <> 'null'::jsonb
     and jsonb_typeof(b->'account') <> 'object'
  then
    raise exception 'Compte personnel invalide';
  end if;

  if jsonb_typeof(b->'transactions') is distinct from 'array' then
    raise exception 'Transactions personnelles manquantes';
  end if;

  if jsonb_typeof(b->'rules') is distinct from 'array' then
    raise exception 'Échéanciers personnels manquants';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(b->'transactions') x
    where coalesce(x->>'id', '') = ''
  )
  then
    raise exception 'Identifiant de transaction personnelle invalide';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(b->'transactions')
  ) <> (
    select count(distinct x->>'id')
    from jsonb_array_elements(b->'transactions') x
  )
  then
    raise exception 'Transaction personnelle dupliquée';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(b->'rules') x
    where coalesce(x->>'id', '') = ''
  )
  then
    raise exception 'Identifiant d’échéancier personnel invalide';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(b->'rules')
  ) <> (
    select count(distinct x->>'id')
    from jsonb_array_elements(b->'rules') x
  )
  then
    raise exception 'Échéancier personnel dupliqué';
  end if;

  for t in
    select *
    from jsonb_array_elements(b->'transactions')
  loop

    if t->>'type' not in ('expense', 'adjust') then
      raise exception 'Type de transaction personnelle invalide';
    end if;

    if coalesce(t->>'amount', '') !~ '^-?[0-9]+$' then
      raise exception 'Montant personnel invalide';
    end if;

    if abs((t->>'amount')::numeric) > 1000000000000 then
      raise exception 'Montant personnel trop élevé';
    end if;

    if t->>'type' = 'expense'
       and (t->>'amount')::numeric <= 0
    then
      raise exception 'Dépense personnelle invalide';
    end if;

    if coalesce(t->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Date personnelle invalide';
    end if;

    if (t->>'date')::date >
       (now() at time zone 'Europe/Paris')::date
    then
      raise exception 'Une dépense personnelle ne peut pas être future';
    end if;

  end loop;

  for r in
    select *
    from jsonb_array_elements(b->'rules')
  loop

    if coalesce(r->>'name', '') = '' then
      raise exception 'Description de mensualité manquante';
    end if;

    if coalesce(r->>'amount', '') !~ '^[0-9]+$'
       or (r->>'amount')::numeric <= 0
    then
      raise exception 'Montant de mensualité invalide';
    end if;

    if coalesce(r->>'count', '') !~ '^[0-9]+$'
       or (r->>'count')::int <= 0
       or (r->>'count')::int > 1200
    then
      raise exception 'Nombre de mensualités invalide';
    end if;

    if coalesce(r->>'start', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Date de mensualité invalide';
    end if;

  end loop;

end;
$function$
;

CREATE OR REPLACE FUNCTION budget_private.empty_personal_document()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select '{
    "schema": 1,
    "account": null,
    "transactions": [],
    "rules": []
  }'::jsonb;
$function$
;

CREATE OR REPLACE FUNCTION public.budget_personal_load()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h uuid;
  result jsonb;
begin

  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  select household_id
  into h
  from budget_private.members
  where user_id = auth.uid();

  if h is null then
    raise exception 'Aucun foyer';
  end if;

  insert into budget_private.personal_documents(
    user_id,
    household_id,
    body
  )
  values (
    auth.uid(),
    h,
    budget_private.empty_personal_document()
  )
  on conflict (user_id, household_id) do nothing;

  select jsonb_build_object(
    'state', p.body,
    'revision', p.revision
  )
  into result
  from budget_private.personal_documents p
  where p.user_id = auth.uid()
    and p.household_id = h;

  return result;

end;
$function$
;

CREATE OR REPLACE FUNCTION public.budget_personal_save(p_state jsonb, p_revision integer, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h uuid;
  r integer;
begin

  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  select household_id
  into h
  from budget_private.members
  where user_id = auth.uid()
  for share;

  if h is null then
    raise exception 'Accès refusé';
  end if;

  perform budget_private.check_personal_document(p_state);

  insert into budget_private.personal_documents(
    user_id,
    household_id,
    body,
    revision,
    updated_at
  )
  values (
    auth.uid(),
    h,
    p_state,
    1,
    now()
  )
  on conflict (user_id, household_id) do nothing
  returning revision into r;

  if r is null then

    update budget_private.personal_documents
    set
      body = p_state,
      revision = revision + 1,
      updated_at = now()
    where user_id = auth.uid()
      and household_id = h
      and revision = p_revision
    returning revision into r;

  end if;

  if r is null then
    raise exception
      'CONFLICT: données personnelles modifiées sur un autre appareil. Actualisez avant de réessayer.';
  end if;

  insert into budget_private.audit(
    household_id,
    user_id,
    revision,
    action
  )
  values (
    h,
    auth.uid(),
    r,
    left('Compte perso : ' || coalesce(p_action, 'Modification'), 160)
  );

  return jsonb_build_object('revision', r);

end;
$function$
;
