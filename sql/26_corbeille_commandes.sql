alter table public.orders
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_orders_deleted_at
  on public.orders(deleted_at);

drop policy if exists "Clients voient leurs commandes" on public.orders;
create policy "Clients voient leurs commandes"
  on public.orders for select
  to authenticated
  using (
    public.is_admin()
    or (client_id = auth.uid() and deleted_at is null)
  );

drop policy if exists "Admin peut modifier les commandes" on public.orders;
create policy "Admin peut modifier les commandes"
  on public.orders for update
  to authenticated
  using (public.is_admin() and deleted_at is null)
  with check (public.is_admin() and deleted_at is null);

drop policy if exists "Clients peuvent creer leurs commandes" on public.orders;
create policy "Clients peuvent creer leurs commandes"
  on public.orders for insert
  to authenticated
  with check (
    deleted_at is null
    and (client_id = auth.uid() or public.is_admin())
  );

drop policy if exists "Admin peut supprimer les commandes" on public.orders;

drop policy if exists "Clients voient leurs lignes de commande" on public.order_items;
create policy "Clients voient leurs lignes de commande"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and (
          public.is_admin()
          or (orders.client_id = auth.uid() and orders.deleted_at is null)
        )
    )
  );

drop policy if exists "Clients peuvent creer lignes dans leurs commandes" on public.order_items;
create policy "Clients peuvent creer lignes dans leurs commandes"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and orders.deleted_at is null
        and (orders.client_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Admin peut modifier lignes de commande" on public.order_items;
create policy "Admin peut modifier lignes de commande"
  on public.order_items for update
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and public.is_admin()
        and orders.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and public.is_admin()
        and orders.deleted_at is null
    )
  );

drop policy if exists "Admin peut supprimer lignes de commande" on public.order_items;
create policy "Admin peut supprimer lignes de commande"
  on public.order_items for delete
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and public.is_admin()
        and orders.deleted_at is null
    )
  );

create or replace function public.trash_orders(p_order_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  if not public.is_admin() then
    raise exception 'Seuls les administrateurs peuvent placer des commandes dans la corbeille.'
      using errcode = '42501';
  end if;

  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    raise exception 'Sélectionnez au moins une commande.'
      using errcode = '22023';
  end if;

  update public.orders
  set deleted_at = now(),
      deleted_by = auth.uid()
  where id = any(p_order_ids)
    and deleted_at is null;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

create or replace function public.trash_my_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Vous devez être connecté pour supprimer cette commande.'
      using errcode = '42501';
  end if;

  update public.orders
  set deleted_at = now(),
      deleted_by = auth.uid()
  where id = p_order_id
    and client_id = auth.uid()
    and statut = 'nouvelle'
    and deleted_at is null;

  if not found then
    raise exception 'Cette commande ne peut plus être supprimée.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.restore_orders(p_order_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  if not public.is_admin() then
    raise exception 'Seuls les administrateurs peuvent restaurer des commandes.'
      using errcode = '42501';
  end if;

  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    raise exception 'Sélectionnez au moins une commande.'
      using errcode = '22023';
  end if;

  update public.orders
  set deleted_at = null,
      deleted_by = null
  where id = any(p_order_ids)
    and deleted_at is not null;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

revoke all on function public.trash_orders(uuid[]) from public, anon;
revoke all on function public.trash_my_order(uuid) from public, anon;
revoke all on function public.restore_orders(uuid[]) from public, anon;
grant execute on function public.trash_orders(uuid[]) to authenticated;
grant execute on function public.trash_my_order(uuid) to authenticated;
grant execute on function public.restore_orders(uuid[]) to authenticated;

create or replace function public.delete_old_orders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.orders
  where deleted_at < now() - interval '7 days'
    or (
      deleted_at is null
      and date_commande < now() - interval '45 days'
    );
end;
$$;

revoke all on function public.delete_old_orders() from public, anon, authenticated;
