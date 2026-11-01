-- Commandes quotidiennes programmees par les administrateurs depuis l'application.
create table if not exists public.order_schedules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  livreur_id uuid references public.livreurs(id) on delete set null,
  client_nom text,
  adresse_livraison text,
  type_commande text not null check (type_commande in ('frais', 'surgele')),
  starts_on date not null,
  ends_on date not null,
  statut text not null default 'active' check (statut in ('active', 'annulee')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_schedules_dates_check check (ends_on >= starts_on)
);

alter table public.order_schedules
  drop constraint if exists order_schedules_max_one_week;

alter table public.order_schedules
  drop constraint if exists order_schedules_dates_check;

alter table public.order_schedules
  add constraint order_schedules_dates_check check (ends_on >= starts_on);

create or replace function public.validate_order_schedule_dates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.starts_on < (now() at time zone 'Europe/Paris')::date then
    raise exception 'La programmation doit commencer aujourd''hui ou plus tard.'
      using errcode = '22023';
  end if;

  if new.ends_on < new.starts_on then
    raise exception 'La date de fin doit être égale ou ultérieure à la date de début.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_order_schedule_dates on public.order_schedules;
create trigger validate_order_schedule_dates
  before insert or update of starts_on, ends_on on public.order_schedules
  for each row execute procedure public.validate_order_schedule_dates();

create table if not exists public.order_schedule_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.order_schedules(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_nom text not null,
  quantite integer not null check (quantite > 0),
  increment integer not null default 1,
  prix_unitaire_ht numeric(10, 2) not null check (prix_unitaire_ht >= 0),
  tva_pourcent numeric(4, 2) not null check (tva_pourcent >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_order_schedules_client on public.order_schedules(client_id);
create index if not exists idx_order_schedules_active_dates
  on public.order_schedules(starts_on, ends_on) where statut = 'active';
create index if not exists idx_order_schedule_items_schedule on public.order_schedule_items(schedule_id);

drop trigger if exists set_updated_at_order_schedules on public.order_schedules;
create trigger set_updated_at_order_schedules
  before update on public.order_schedules
  for each row execute procedure public.handle_updated_at();

alter table public.order_schedules enable row level security;
drop policy if exists "Admins gerent les programmations" on public.order_schedules;
create policy "Admins gerent les programmations"
  on public.order_schedules for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.order_schedule_items enable row level security;
drop policy if exists "Admins gerent les lignes programmees" on public.order_schedule_items;
create policy "Admins gerent les lignes programmees"
  on public.order_schedule_items for all
  to authenticated
  using (
    exists (
      select 1 from public.order_schedules
      where id = order_schedule_items.schedule_id and public.is_admin()
    )
  )
  with check (
    exists (
      select 1 from public.order_schedules
      where id = order_schedule_items.schedule_id and public.is_admin()
    )
  );

create or replace function public.create_order_schedule(
  p_client_id uuid,
  p_livreur_id uuid,
  p_client_nom text,
  p_adresse_livraison text,
  p_type_commande text,
  p_starts_on date,
  p_ends_on date,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Seuls les administrateurs peuvent programmer une commande.'
      using errcode = '42501';
  end if;

  if p_starts_on < (now() at time zone 'Europe/Paris')::date
    or p_ends_on < p_starts_on then
    raise exception 'La période doit commencer aujourd''hui ou plus tard et sa date de fin doit être postérieure ou égale à la date de début.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La commande programmée doit contenir au moins un article.'
      using errcode = '22023';
  end if;

  insert into public.order_schedules (
    client_id, livreur_id, client_nom, adresse_livraison,
    type_commande, starts_on, ends_on, created_by
  )
  values (
    p_client_id, p_livreur_id, p_client_nom, p_adresse_livraison,
    p_type_commande, p_starts_on, p_ends_on, auth.uid()
  )
  returning id into schedule_id;

  insert into public.order_schedule_items (
    schedule_id, product_id, product_nom, quantite, increment,
    prix_unitaire_ht, tva_pourcent
  )
  select
    schedule_id,
    nullif(item->>'product_id', '')::uuid,
    item->>'product_nom',
    (item->>'quantite')::integer,
    (item->>'increment')::integer,
    (item->>'prix_unitaire_ht')::numeric,
    (item->>'tva_pourcent')::numeric
  from jsonb_array_elements(p_items) as item;

  return schedule_id;
end;
$$;

revoke all on function public.create_order_schedule(uuid, uuid, text, text, text, date, date, jsonb) from public, anon;
grant execute on function public.create_order_schedule(uuid, uuid, text, text, text, date, date, jsonb) to authenticated;

alter table public.orders
  add column if not exists recurrence_id uuid references public.order_schedules(id) on delete set null;

create unique index if not exists idx_orders_recurrence_delivery
  on public.orders(recurrence_id, date_livraison_souhaitee)
  where recurrence_id is not null;

create or replace function public.create_scheduled_orders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_date date := (now() at time zone 'Europe/Paris')::date;
  schedule record;
  new_order_id uuid;
begin
  for schedule in
    select s.*
    from public.order_schedules s
    where s.statut = 'active'
      and delivery_date between s.starts_on and s.ends_on
      and not exists (
        select 1 from public.orders o
        where o.recurrence_id = s.id
          and o.date_livraison_souhaitee = delivery_date
      )
  loop
    insert into public.orders (
      numero, client_id, livreur_id, statut, date_commande,
      date_livraison_souhaitee, adresse_livraison, client_nom,
      type_commande, recurrence_id
    )
    values (
      '', schedule.client_id, schedule.livreur_id, 'nouvelle', now(),
      delivery_date, schedule.adresse_livraison, schedule.client_nom,
      schedule.type_commande, schedule.id
    )
    returning id into new_order_id;

    insert into public.order_items (
      order_id, product_id, product_nom, quantite, increment,
      prix_unitaire_ht, tva_pourcent, sous_total_ht
    )
    select
      new_order_id, i.product_id, i.product_nom, i.quantite, i.increment,
      i.prix_unitaire_ht, i.tva_pourcent, i.prix_unitaire_ht * i.quantite
    from public.order_schedule_items i
    where i.schedule_id = schedule.id;
  end loop;
end;
$$;

revoke all on function public.create_scheduled_orders() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'create_scheduled_orders_job';

select cron.schedule(
  'create_scheduled_orders_job',
  '*/5 * * * *',
  'select public.create_scheduled_orders();'
);
