-- ============================================================
-- Ajout du livreur surgelé sur la table profiles
-- Exécuter dans le SQL Editor Supabase
-- ============================================================

-- 1. Ajouter la colonne livreur_surgele_id s'il n'existe pas
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS livreur_surgele_id UUID REFERENCES public.livreurs(id) ON DELETE SET NULL;

-- 2. Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_profiles_livreur_surgele ON public.profiles(livreur_surgele_id);
