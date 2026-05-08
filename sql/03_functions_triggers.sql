-- ============================================================
-- SOF PAIN - Schéma de base de données (BLOC 3 / 3)
-- Fonctions et triggers automatiques
-- ============================================================


-- ------------------------------------------------------------
-- 1. Trigger : mise à jour automatique du champ `updated_at`
-- ------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Appliqué sur products et orders
drop trigger if exists set_updated_at_products on public.products;
create trigger set_updated_at_products
  before update on public.products
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_updated_at_orders on public.orders;
create trigger set_updated_at_orders
  before update on public.orders
  for each row execute procedure public.handle_updated_at();


-- ------------------------------------------------------------
-- 2. Génération automatique du numéro de commande
-- ------------------------------------------------------------
-- Format : CMD-2026-00001 (incrémenté chaque année)
-- ------------------------------------------------------------

-- Séquence pour le compteur de commandes
create sequence if not exists public.order_number_seq;

create or replace function public.generate_order_number()
returns trigger
language plpgsql
as $$
declare
  current_year text;
  next_num integer;
begin
  current_year := to_char(now(), 'YYYY');
  next_num := nextval('public.order_number_seq');
  new.numero := 'CMD-' || current_year || '-' || lpad(next_num::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists set_order_number on public.orders;
create trigger set_order_number
  before insert on public.orders
  for each row
  when (new.numero is null or new.numero = '')
  execute procedure public.generate_order_number();


-- ------------------------------------------------------------
-- 3. Calcul automatique des totaux de la commande
-- ------------------------------------------------------------
-- À chaque ajout/modif/suppression d'une ligne, on recalcule
-- total_ht, total_tva et total_ttc de la commande parent.
-- ------------------------------------------------------------
create or replace function public.recalculate_order_totals()
returns trigger
language plpgsql
as $$
declare
  target_order_id uuid;
  new_total_ht numeric(10, 2);
  new_total_tva numeric(10, 2);
begin
  -- Récupérer l'order_id concerné (selon INSERT/UPDATE/DELETE)
  if (tg_op = 'DELETE') then
    target_order_id := old.order_id;
  else
    target_order_id := new.order_id;
  end if;

  -- Calculer les totaux depuis toutes les lignes de la commande
  select
    coalesce(sum(sous_total_ht), 0),
    coalesce(sum(sous_total_ht * tva_pourcent / 100), 0)
  into new_total_ht, new_total_tva
  from public.order_items
  where order_id = target_order_id;

  -- Mettre à jour la commande
  update public.orders
  set
    total_ht = new_total_ht,
    total_tva = new_total_tva,
    total_ttc = new_total_ht + new_total_tva
  where id = target_order_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists update_order_totals_on_item_change on public.order_items;
create trigger update_order_totals_on_item_change
  after insert or update or delete on public.order_items
  for each row execute procedure public.recalculate_order_totals();