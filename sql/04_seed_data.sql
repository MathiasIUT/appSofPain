-- ============================================================
-- SOF PAIN - Données de test
-- Quelques produits pour avoir un catalogue non-vide
-- ============================================================
-- ⚠️ À exécuter APRÈS les blocs 1, 2 et 3.
-- Ces données peuvent être supprimées plus tard et remplacées
-- par les vrais produits via le panneau admin.
-- ============================================================

-- Récupération des IDs des catégories
do $$
declare
  cat_frais_id uuid;
  cat_surgele_id uuid;
begin
  select id into cat_frais_id from public.categories where slug = 'frais';
  select id into cat_surgele_id from public.categories where slug = 'surgele';

  -- Produits pain frais
  insert into public.products (category_id, nom, description, unites_par_carton, prix_palette_ht) values
    (cat_frais_id, 'Baguette tradition', 'Baguette tradition française, croûte dorée et mie alvéolée.', 40, 280.00),
    (cat_frais_id, 'Pain de campagne', 'Pain de campagne rustique à la mie dense et parfumée.', 24, 320.00),
    (cat_frais_id, 'Pain complet', 'Pain complet riche en fibres, idéal pour la restauration.', 30, 295.00)
  on conflict do nothing;

  -- Produits pain surgelé
  insert into public.products (category_id, nom, description, unites_par_carton, prix_palette_ht) values
    (cat_surgele_id, 'Baguette précuite surgelée', 'Baguette précuite surgelée, 10 min de cuisson pour un pain frais.', 60, 240.00),
    (cat_surgele_id, 'Pain burger surgelé', 'Pain burger surgelé, idéal pour la restauration rapide.', 80, 180.00),
    (cat_surgele_id, 'Croissant surgelé cru', 'Croissant pur beurre surgelé cru, à cuire le matin même.', 100, 210.00)
  on conflict do nothing;
end $$;

-- Vérification
select
  c.nom as categorie,
  p.nom as produit,
  p.unites_par_carton,
  p.prix_palette_ht || ' €' as prix_ht_palette,
  p.tva_pourcent || ' %' as tva
from public.products p
join public.categories c on c.id = p.category_id
where p.actif = true
order by c.ordre, p.nom;