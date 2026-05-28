-- 1. Table `livreurs` — Entité séparée (pas de compte auth)

create table if not exists public.livreurs (
  id uuid primary key default gen_random_uuid(),
  nom text,
  prenom text,
  telephone text,
  actif boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Trigger updated_at
drop trigger if exists set_updated_at_livreurs on public.livreurs;
create trigger set_updated_at_livreurs
  before update on public.livreurs
  for each row execute procedure public.handle_updated_at();

-- RLS
alter table public.livreurs enable row level security;

drop policy if exists "Admins full access on livreurs" on public.livreurs;
create policy "Admins full access on livreurs"
  on public.livreurs
  for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Les clients peuvent voir les livreurs (pour l'affichage)
drop policy if exists "Clients can view livreurs" on public.livreurs;
create policy "Clients can view livreurs"
  on public.livreurs
  for select
  using (auth.uid() is not null);


-- 2. Colonne `livreur_id` sur `profiles` -> référence livreurs

alter table public.profiles
  add column if not exists livreur_id uuid references public.livreurs(id) on delete set null;


 
-- 3. Table `client_prices` — Prix personnalisés par client

create table if not exists public.client_prices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  prix_palette_ht numeric(10, 2) not null check (prix_palette_ht >= 0),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(client_id, product_id)
);

create index if not exists idx_client_prices_client on public.client_prices(client_id);
create index if not exists idx_client_prices_product on public.client_prices(product_id);

drop trigger if exists set_updated_at_client_prices on public.client_prices;
create trigger set_updated_at_client_prices
  before update on public.client_prices
  for each row execute procedure public.handle_updated_at();

-- RLS
alter table public.client_prices enable row level security;

drop policy if exists "Admins full access on client_prices" on public.client_prices;
create policy "Admins full access on client_prices"
  on public.client_prices
  for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Clients can view own prices" on public.client_prices;
create policy "Clients can view own prices"
  on public.client_prices
  for select
  using (client_id = auth.uid());


-- 4. Mise à jour de orders.livreur_id → référence livreurs

-- Si la colonne existe déjà et pointe vers profiles, on la corrige.
-- Sinon on la crée.

-- Supprimer l'ancienne contrainte FK si elle existe
do $$
begin

  if exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
    where tc.table_name = 'orders'
      and tc.constraint_type = 'FOREIGN KEY'
      and ccu.column_name = 'livreur_id'
      and ccu.table_name = 'profiles'
  ) then
    execute (
      select 'alter table public.orders drop constraint ' || tc.constraint_name
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
      where tc.table_name = 'orders'
        and tc.constraint_type = 'FOREIGN KEY'
        and ccu.column_name = 'livreur_id'
        and ccu.table_name = 'profiles'
      limit 1
    );
  end if;
end $$;

-- Ajouter la nouvelle FK vers livreurs
alter table public.orders
  drop constraint if exists orders_livreur_id_fkey_livreurs;

alter table public.orders
  add constraint orders_livreur_id_fkey_livreurs
  foreign key (livreur_id) references public.livreurs(id) on delete set null;
