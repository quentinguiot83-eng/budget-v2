-- Align Supabase's personal-document validation with Wimm's ability to
-- schedule personal expenses for a future bank debit date.
-- Keep all other checks, permissions and the original search_path intact.

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

    -- Future personal expenses are scheduled, but future balance adjustments are not.
    -- The actual account balance is calculated only through the requested date.
    if t->>'type' = 'adjust'
       and (t->>'date')::date > (now() at time zone 'Europe/Paris')::date
    then
      raise exception 'Un ajustement personnel ne peut pas être futur';
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
$function$;
