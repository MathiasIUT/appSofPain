-- Comptes de connexion pour les livreurs
-- Un livreur peut avoir un compte auth (email type livreur@tournee1.fr).
-- Son espace ne montre que ses tournées ; il peut valider une tournée (commandes -> livrée).

-- 1. Lien livreurs -> compte auth
alter table public.livreurs
  add column if not exists user_id uuid unique references auth.users(id) on delete set null;

-- 2. Helper : id du livreur lié à l'utilisateur connecté (null sinon)
create or replace function public.current_livreur_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select l.id from public.livreurs l where l.user_id = auth.uid() limit 1;
$$;

-- 3. RLS orders : le livreur voit et met à jour ses propres tournées
drop policy if exists "Livreurs voient leurs tournees" on public.orders;
create policy "Livreurs voient leurs tournees"
  on public.orders for select
  to authenticated
  using (livreur_id is not null and livreur_id = public.current_livreur_id());

drop policy if exists "Livreurs valident leurs tournees" on public.orders;
create policy "Livreurs valident leurs tournees"
  on public.orders for update
  to authenticated
  using (livreur_id is not null and livreur_id = public.current_livreur_id())
  with check (livreur_id is not null and livreur_id = public.current_livreur_id());

-- 4. RLS order_items : lecture des lignes des commandes de ses tournées
drop policy if exists "Livreurs voient lignes de leurs tournees" on public.order_items;
create policy "Livreurs voient lignes de leurs tournees"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.livreur_id is not null
        and orders.livreur_id = public.current_livreur_id()
    )
  );

-- 5. RLS profiles : le livreur voit les profils de ses clients (nom, adresse, tel, ordre tournée)
drop policy if exists "Livreurs voient profils de leurs clients" on public.profiles;
create policy "Livreurs voient profils de leurs clients"
  on public.profiles for select
  to authenticated
  using (
    public.current_livreur_id() is not null
    and (livreur_id = public.current_livreur_id() or livreur_surgele_id = public.current_livreur_id())
  );
