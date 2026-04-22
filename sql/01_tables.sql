-- ============================================================
-- SOF PAIN - Schéma de base de données (BLOC 1 / 3)
-- Création des tables principales
-- ============================================================


-- ------------------------------------------------------------
-- 1. Mise à jour de la table `profiles`
-- ------------------------------------------------------------

-- Ajout des champs supplémentaires (optionnels)
alter table public.profiles
  add column if not exists telephone text,
  add column if not exists adresse text,
  add column if not exists code_postal text,
  add column if not exists ville text,
  add column if not exists siret text;

-- Mise à jour de la contrainte de rôle pour inclure 'livreur'
-- (préparation Phase C - on ne code pas la partie livreur maintenant
-- mais on prévoit la place dès maintenant pour éviter une migration plus tard)
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client', 'admin', 'livreur'));


-- ------------------------------------------------------------
-- 2. Table `categories` (Pain frais / Pain surgelé)
-- ------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  slug text not null unique,
  ordre integer not null default 0,
  created_at timestamp with time zone default now()
);

-- Insertion des 2 catégories de base
insert into public.categories (nom, slug, ordre) values
  ('Pain frais', 'frais', 1),
  ('Pain surgelé', 'surgele', 2)
on conflict (slug) do nothing;


-- ------------------------------------------------------------
-- 3. Table `products`
-- ------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  nom text not null,
  description text,
  unites_par_carton integer not null default 1,
  prix_palette_ht numeric(10, 2) not null check (prix_palette_ht >= 0),
  tva_pourcent numeric(4, 2) not null default 5.50 check (tva_pourcent >= 0),
  image_url text,
  actif boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_actif on public.products(actif);


-- ------------------------------------------------------------
-- 4. Table `orders`
-- ------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  client_id uuid not null references public.profiles(id) on delete restrict,
  -- livreur_id préparé pour la Phase C (peut rester null pour l'instant)
  livreur_id uuid references public.profiles(id) on delete set null,
  statut text not null default 'nouvelle',
  date_commande timestamp with time zone not null default now(),
  date_livraison_souhaitee date,
  date_livraison_reelle date,
  total_ht numeric(10, 2) not null default 0 check (total_ht >= 0),
  total_tva numeric(10, 2) not null default 0 check (total_tva >= 0),
  total_ttc numeric(10, 2) not null default 0 check (total_ttc >= 0),
  notes_client text,
  notes_admin text,
  adresse_livraison text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Si la table existait déjà sans la colonne livreur_id, on l'ajoute
alter table public.orders
  add column if not exists livreur_id uuid references public.profiles(id) on delete set null;

-- Contrainte sur les statuts (inclut 'en_livraison' pour la Phase C)
alter table public.orders
  drop constraint if exists orders_statut_check;

alter table public.orders
  add constraint orders_statut_check
  check (statut in ('nouvelle', 'en_preparation', 'en_livraison', 'livree', 'annulee'));

create index if not exists idx_orders_client on public.orders(client_id);
create index if not exists idx_orders_livreur on public.orders(livreur_id);
create index if not exists idx_orders_statut on public.orders(statut);
create index if not exists idx_orders_date on public.orders(date_commande desc);


-- ------------------------------------------------------------
-- 5. Table `order_items`
-- ------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  -- Snapshot du produit au moment de la commande (historique)
  product_nom text not null,
  quantite_palettes integer not null check (quantite_palettes > 0),
  cartons_par_palette integer not null default 24,
  prix_palette_ht numeric(10, 2) not null check (prix_palette_ht >= 0),
  tva_pourcent numeric(4, 2) not null,
  sous_total_ht numeric(10, 2) not null check (sous_total_ht >= 0),
  created_at timestamp with time zone default now()
);

create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);