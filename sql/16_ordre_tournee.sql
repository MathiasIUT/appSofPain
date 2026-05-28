-- 1. Ajout de la colonne 'ordre_tournee' sur les profils
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ordre_tournee INTEGER DEFAULT 0;

-- 2. Création d'un index pour optimiser les requêtes de tri
CREATE INDEX IF NOT EXISTS idx_profiles_ordre_tournee ON public.profiles(ordre_tournee);
