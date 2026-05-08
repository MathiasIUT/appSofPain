-- ============================================================
-- SOF PAIN - Ajout des champs notes internes pour les profils
-- ============================================================

alter table public.profiles
  add column if not exists note_interne_client text,
  add column if not exists note_interne_admin text;
