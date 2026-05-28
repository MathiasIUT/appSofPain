-- Suppression des produits précédents
delete from public.products;

-- Insertion des 10 vrais produits (tous en catégorie "frais")
do $$
declare
  cat_frais_id uuid;
begin
  select id into cat_frais_id from public.categories where slug = 'frais';

  insert into public.products (category_id, nom, description, unites_par_carton, prix_palette_ht) values
    (cat_frais_id, 'Pain sandwich',  'Pain sandwich.',       1, 0.00),
    (cat_frais_id, 'Pide',           'Pide.',                1, 0.00),
    (cat_frais_id, 'Lahmacun',       'Lahmacun.',            1, 0.00),
    (cat_frais_id, 'Buns',           'Buns.',                1, 0.00),
    (cat_frais_id, 'Burger',         'Pain burger.',         1, 0.00),
    (cat_frais_id, 'Pain panini',    'Pain panini.',         1, 0.00),
    (cat_frais_id, 'Pain berliner',  'Pain berliner.',       1, 0.00),
    (cat_frais_id, 'Mini pide',      'Mini pide.',           1, 0.00),
    (cat_frais_id, 'Baguette',       'Baguette.',            1, 0.00),
    (cat_frais_id, 'Sommun',         'Sommun.',              1, 0.00);
end $$;

-- Vérification
select
  p.nom                         as produit,
  p.unites_par_carton           as unites_par_carton,
  p.prix_palette_ht || ' EUR HT'  as prix_palette,
  case when p.actif then 'Oui' else 'Non' end as actif
from public.products p
order by p.created_at;