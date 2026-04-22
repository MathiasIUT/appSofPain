-- ============================================================
-- SOF PAIN - Reset des produits avec les vrais produits
-- ============================================================
-- Ce script :
-- 1. Supprime les produits de test précédents
-- 2. Insère les 3 vrais produits de Sof Pain (pain frais uniquement)
-- ============================================================

-- Suppression des anciens produits de test
-- (on ne supprime pas les catégories, on les garde au cas où
-- le surgelé reviendrait plus tard)
delete from public.products;

-- Insertion des 3 vrais produits
do $$
declare
  cat_frais_id uuid;
begin
  select id into cat_frais_id from public.categories where slug = 'frais';

  -- ⚠️ Adapte les prix_palette_ht et unites_par_carton selon les vraies valeurs
  -- (demande à ton client ses tarifs exacts)
  insert into public.products (category_id, nom, description, unites_par_carton, prix_palette_ht) values
    (cat_frais_id, 'Pain rond', 'Pain rond traditionnel.', 1, 0.00),
    (cat_frais_id, 'Pain kebab', 'Pain kebab pour sandwichs et kebabs.', 1, 0.00),
    (cat_frais_id, 'Lahmacun', 'Lahmacun (pizza turque) garnie.', 1, 0.00);
end $$;

-- Vérification
select
  c.nom as categorie,
  p.nom as produit,
  p.unites_par_carton,
  p.prix_palette_ht || ' €' as prix_ht_palette,
  p.tva_pourcent || ' %' as tva,
  case when p.actif then 'Oui' else 'Non' end as actif
from public.products p
join public.categories c on c.id = p.category_id
order by p.nom;