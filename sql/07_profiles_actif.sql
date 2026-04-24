-- Ajout de la colonne actif sur profiles
-- Tous les comptes existants restent actifs par défaut
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true;
