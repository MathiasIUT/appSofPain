alter table public.products
  add column if not exists ordre integer;

with ranked_products as (
  select
    id,
    row_number() over (
      partition by category_id
      order by nom, created_at, id
    )::integer as ordre
  from public.products
  where ordre is null
)
update public.products as product
set ordre = ranked_products.ordre
from ranked_products
where product.id = ranked_products.id;

alter table public.products
  alter column ordre set default 0,
  alter column ordre set not null;

create index if not exists idx_products_category_ordre
  on public.products(category_id, ordre);

create or replace function public.move_product_order(
  p_product_id uuid,
  p_direction integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_product record;
  adjacent_product record;
begin
  if not public.is_admin() then
    raise exception 'Seuls les administrateurs peuvent réordonner les produits.'
      using errcode = '42501';
  end if;

  if p_direction not in (-1, 1) then
    raise exception 'La direction doit être -1 (haut) ou 1 (bas).'
      using errcode = '22023';
  end if;

  select id, category_id, ordre
  into current_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Produit introuvable.'
      using errcode = '22023';
  end if;

  if p_direction = -1 then
    select id, ordre
    into adjacent_product
    from public.products
    where category_id = current_product.category_id
      and actif
      and (ordre, id) < (current_product.ordre, current_product.id)
    order by ordre desc, id desc
    limit 1
    for update;
  else
    select id, ordre
    into adjacent_product
    from public.products
    where category_id = current_product.category_id
      and actif
      and (ordre, id) > (current_product.ordre, current_product.id)
    order by ordre, id
    limit 1
    for update;
  end if;

  if not found then
    raise exception 'Le produit est déjà à cette extrémité de la liste.'
      using errcode = '22023';
  end if;

  update public.products
  set ordre = case
    when id = current_product.id then adjacent_product.ordre
    else current_product.ordre
  end
  where id in (current_product.id, adjacent_product.id);
end;
$$;

revoke all on function public.move_product_order(uuid, integer) from public, anon;
grant execute on function public.move_product_order(uuid, integer) to authenticated;
