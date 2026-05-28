-- RLS et autorisations des users

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


-- TABLE : categories
alter table public.categories enable row level security;

-- Tout le monde (connecté) peut lire les catégories
drop policy if exists "Categories lisibles par tous les connectes" on public.categories;
create policy "Categories lisibles par tous les connectes"
  on public.categories for select
  to authenticated
  using (true);

-- Seul l'admin peut modifier les catégories
drop policy if exists "Admin peut modifier les categories" on public.categories;
create policy "Admin peut modifier les categories"
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- TABLE : products
alter table public.products enable row level security;

-- Les clients voient seulement les produits actifs
drop policy if exists "Clients voient produits actifs" on public.products;
create policy "Clients voient produits actifs"
  on public.products for select
  to authenticated
  using (actif = true or public.is_admin());

-- Seul l'admin peut créer/modifier/supprimer des produits
drop policy if exists "Admin peut gerer les produits" on public.products;
create policy "Admin peut gerer les produits"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- TABLE : orders
alter table public.orders enable row level security;

-- Un client voit ses propres commandes, l'admin voit tout
drop policy if exists "Clients voient leurs commandes" on public.orders;
create policy "Clients voient leurs commandes"
  on public.orders for select
  to authenticated
  using (client_id = auth.uid() or public.is_admin());

-- Un client peut créer une commande pour lui-même , l'admin peut créer pour n'importe quel client
drop policy if exists "Clients peuvent creer leurs commandes" on public.orders;
create policy "Clients peuvent creer leurs commandes"
  on public.orders for insert
  to authenticated
  with check (client_id = auth.uid() or public.is_admin());

-- Seul l'admin peut modifier les commandes (statut, notes, etc...)
drop policy if exists "Admin peut modifier les commandes" on public.orders;
create policy "Admin peut modifier les commandes"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Seul l'admin peut supprimer une commande
drop policy if exists "Admin peut supprimer les commandes" on public.orders;
create policy "Admin peut supprimer les commandes"
  on public.orders for delete
  to authenticated
  using (public.is_admin());


-- TABLE : order_items

alter table public.order_items enable row level security;

-- Un client voit les lignes de ses commandes, l'admin voit tout
drop policy if exists "Clients voient leurs lignes de commande" on public.order_items;
create policy "Clients voient leurs lignes de commande"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and (orders.client_id = auth.uid() or public.is_admin())
    )
  );

-- Un client peut créer des lignes dans ses propres commandes, l'admin peut créer dans n'importe quelle commande
drop policy if exists "Clients peuvent creer lignes dans leurs commandes" on public.order_items;
create policy "Clients peuvent creer lignes dans leurs commandes"
  on public.order_items for insert
  to authenticated
  with check (
    public.is_admin() or
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.client_id = auth.uid()
    )
  );

-- Seul l'admin peut modifier/supprimer les lignes de commande
drop policy if exists "Admin peut modifier lignes de commande" on public.order_items;
create policy "Admin peut modifier lignes de commande"
  on public.order_items for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin peut supprimer lignes de commande" on public.order_items;
create policy "Admin peut supprimer lignes de commande"
  on public.order_items for delete
  to authenticated
  using (public.is_admin());