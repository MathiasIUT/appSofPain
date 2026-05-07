-- Migration : ajout de client_uuid_snapshot sur orders
-- Permet de retrouver les commandes d'un client supprimé même si deux clients ont le même nom

ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_uuid_snapshot UUID;

-- Index pour les requêtes de comptabilité des clients supprimés
CREATE INDEX IF NOT EXISTS idx_orders_client_uuid_snapshot ON orders(client_uuid_snapshot);

-- Commentaire explicatif
COMMENT ON COLUMN orders.client_uuid_snapshot IS
  'UUID du profil client snapshoté au moment de la suppression du compte. Permet de retrouver les commandes orphelines par identifiant unique même si client_id est NULL.';
