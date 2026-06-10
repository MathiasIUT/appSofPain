-- Ajout du code comptable Sage 50 sur les profils clients
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS code_sage TEXT;
