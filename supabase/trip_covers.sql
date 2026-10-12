-- Wimm · Couvertures des voyages
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor.
-- Après exécution, le texte de la requête dans SQL Editor peut être supprimé.
-- Conserver ce fichier de migration dans GitHub pour référence et audit.
-- Repose sur la fonction public.budget_load() déjà utilisée par Wimm.
-- Cette fonction retourne le foyer accessible par l'utilisateur connecté.

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) VALUES (
  'wimm-trip-covers',
  'wimm-trip-covers',
  false,
  2097152,
  ARRAY['image/webp', 'image/jpeg']::text[]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Format des chemins :
-- <household-id>/<trip-id>/<unique-name>.webp
--
-- Chaque utilisateur authentifié ne peut agir que sur les photos du foyer
-- que public.budget_load() lui autorise déjà à consulter.
-- Aucun accès public aux fichiers ni aux autres foyers.

DROP POLICY IF EXISTS "wimm_trip_covers_select" ON storage.objects;
CREATE POLICY "wimm_trip_covers_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'wimm-trip-covers'
  AND (storage.foldername(name))[1] =
      (public.budget_load() -> 'household' ->> 'id')
);

DROP POLICY IF EXISTS "wimm_trip_covers_insert" ON storage.objects;
CREATE POLICY "wimm_trip_covers_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'wimm-trip-covers'
  AND (storage.foldername(name))[1] =
      (public.budget_load() -> 'household' ->> 'id')
);

DROP POLICY IF EXISTS "wimm_trip_covers_delete" ON storage.objects;
CREATE POLICY "wimm_trip_covers_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'wimm-trip-covers'
  AND (storage.foldername(name))[1] =
      (public.budget_load() -> 'household' ->> 'id')
);
