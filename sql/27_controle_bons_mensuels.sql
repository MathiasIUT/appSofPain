create table if not exists public.monthly_bill_adjustments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  client_uuid_snapshot uuid,
  client_name text not null,
  bill_month date not null,
  compta_type text not null check (compta_type in ('frais', 'surgele')),
  label text not null check (length(trim(label)) > 0),
  quantity numeric(10, 3) not null default 1 check (quantity > 0),
  unit_price_ht numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (extract(day from bill_month) = 1)
);

alter table public.monthly_bill_adjustments
  add column if not exists client_uuid_snapshot uuid;

create index if not exists idx_monthly_bill_adjustments_client_month
  on public.monthly_bill_adjustments(client_id, bill_month, compta_type);

create index if not exists idx_monthly_bill_adjustments_orphan_month
  on public.monthly_bill_adjustments(client_uuid_snapshot, bill_month, compta_type);

alter table public.monthly_bill_adjustments enable row level security;

drop policy if exists "Admin gere les ajustements des bons mensuels"
  on public.monthly_bill_adjustments;
create policy "Admin gere les ajustements des bons mensuels"
  on public.monthly_bill_adjustments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.monthly_bill_adjustments from public, anon;
grant select, insert, update, delete
  on public.monthly_bill_adjustments to authenticated;

create or replace function public.replace_order_items(
  p_order_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Seuls les administrateurs peuvent modifier les articles d''une commande.'
      using errcode = '42501';
  end if;

  if p_items is null then
    raise exception 'Une commande doit contenir au moins un article.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'La liste des articles est invalide.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Une commande doit contenir au moins un article.'
      using errcode = '22023';
  end if;

  perform 1
  from public.orders
  where id = p_order_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Commande introuvable ou archivée.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      product_id uuid,
      product_nom text,
      quantite integer,
      increment integer,
      prix_unitaire_ht numeric,
      tva_pourcent numeric
    )
    where item.product_nom is null
      or length(trim(item.product_nom)) = 0
      or item.quantite is null
      or item.quantite <= 0
      or item.increment is null
      or item.increment <= 0
      or item.prix_unitaire_ht is null
      or item.prix_unitaire_ht < 0
      or item.tva_pourcent is null
      or item.tva_pourcent < 0
  ) then
    raise exception 'Les articles ou leurs valeurs sont invalides.'
      using errcode = '22023';
  end if;

  delete from public.order_items
  where order_id = p_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    product_nom,
    quantite,
    increment,
    prix_unitaire_ht,
    tva_pourcent,
    sous_total_ht
  )
  select
    p_order_id,
    item.product_id,
    trim(item.product_nom),
    item.quantite,
    item.increment,
    item.prix_unitaire_ht,
    item.tva_pourcent,
    round(item.prix_unitaire_ht * item.quantite, 2)
  from jsonb_to_recordset(p_items) as item(
    product_id uuid,
    product_nom text,
    quantite integer,
    increment integer,
    prix_unitaire_ht numeric,
    tva_pourcent numeric
  );
end;
$$;

revoke all on function public.replace_order_items(uuid, jsonb) from public, anon;
grant execute on function public.replace_order_items(uuid, jsonb) to authenticated;
