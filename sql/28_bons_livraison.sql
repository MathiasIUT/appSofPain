alter table public.orders
  add column if not exists delivered_at timestamptz;

create or replace function public.current_livreur_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select l.id
  from public.livreurs l
  join public.profiles p on p.id = l.user_id
  where l.user_id = auth.uid()
    and p.role = 'livreur'
    and p.actif is distinct from false
  limit 1;
$$;

create table if not exists public.delivery_notes (
  order_id uuid primary key references public.orders(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  email_sent_at timestamptz,
  email_error text
);

alter table public.delivery_notes enable row level security;

drop policy if exists "Utilisateurs autorises voient les bons de livraison"
  on public.delivery_notes;
create policy "Utilisateurs autorises voient les bons de livraison"
  on public.delivery_notes for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = delivery_notes.order_id
        and orders.deleted_at is null
        and (
          public.is_admin()
          or orders.client_id = auth.uid()
          or orders.livreur_id = public.current_livreur_id()
        )
    )
  );

revoke all on public.delivery_notes from public, anon;
grant select on public.delivery_notes to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-notes', 'delivery-notes', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Livreurs ajoutent les bons de leur commande"
  on storage.objects;
create policy "Livreurs ajoutent les bons de leur commande"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'delivery-notes'
    and exists (
      select 1
      from public.orders
      where orders.id::text = (storage.foldername(name))[1]
        and orders.livreur_id = public.current_livreur_id()
        and orders.deleted_at is null
        and orders.statut in ('nouvelle', 'traite', 'en_preparation', 'en_livraison')
    )
  );

drop policy if exists "Livreurs remplacent les bons de leur commande"
  on storage.objects;
create policy "Livreurs remplacent les bons de leur commande"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'delivery-notes'
    and exists (
      select 1
      from public.orders
      where orders.id::text = (storage.foldername(name))[1]
        and orders.livreur_id = public.current_livreur_id()
        and orders.deleted_at is null
        and orders.statut in ('nouvelle', 'traite', 'en_preparation', 'en_livraison', 'livree')
    )
  )
  with check (
    bucket_id = 'delivery-notes'
    and exists (
      select 1
      from public.orders
      where orders.id::text = (storage.foldername(name))[1]
        and orders.livreur_id = public.current_livreur_id()
        and orders.deleted_at is null
        and orders.statut in ('nouvelle', 'traite', 'en_preparation', 'en_livraison', 'livree')
    )
  );

drop policy if exists "Utilisateurs autorises lisent les bons de livraison"
  on storage.objects;
create policy "Utilisateurs autorises lisent les bons de livraison"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'delivery-notes'
    and exists (
      select 1
      from public.delivery_notes
      join public.orders on orders.id = delivery_notes.order_id
      where delivery_notes.storage_path = storage.objects.name
        and orders.deleted_at is null
        and (
          public.is_admin()
          or orders.client_id = auth.uid()
          or orders.livreur_id = public.current_livreur_id()
        )
    )
  );

drop policy if exists "Admin supprime les bons de livraison"
  on storage.objects;
create policy "Admin supprime les bons de livraison"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'delivery-notes'
    and public.is_admin()
  );

drop policy if exists "Livreurs nettoient les bons non associes"
  on storage.objects;
create policy "Livreurs nettoient les bons non associes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'delivery-notes'
    and exists (
      select 1
      from public.orders
      where orders.id::text = (storage.foldername(name))[1]
        and orders.livreur_id = public.current_livreur_id()
        and orders.deleted_at is null
        and orders.statut in ('nouvelle', 'traite', 'en_preparation', 'en_livraison')
    )
  );

drop policy if exists "Livreurs voient leurs tournees" on public.orders;
create policy "Livreurs voient leurs tournees"
  on public.orders for select
  to authenticated
  using (
    livreur_id = public.current_livreur_id()
    and deleted_at is null
  );

drop policy if exists "Livreurs valident leurs tournees" on public.orders;

drop policy if exists "Livreurs voient lignes de leurs tournees" on public.order_items;
create policy "Livreurs voient lignes de leurs tournees"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
        and orders.livreur_id = public.current_livreur_id()
        and orders.deleted_at is null
    )
  );

create or replace function public.complete_order_delivery(
  p_order_id uuid,
  p_storage_path text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  delivery_time timestamptz;
  expected_path text;
begin
  if auth.uid() is null or (
    not public.is_admin()
    and public.current_livreur_id() is null
  ) then
    raise exception 'Seuls un livreur connecté ou un administrateur peuvent valider une livraison.'
      using errcode = '42501';
  end if;

  select *
  into order_row
  from public.orders
  where id = p_order_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Commande introuvable ou archivée.'
      using errcode = '22023';
  end if;

  if not public.is_admin()
    and order_row.livreur_id is distinct from public.current_livreur_id()
  then
    raise exception 'Cette commande ne fait pas partie de votre tournée.'
      using errcode = '42501';
  end if;

  if order_row.statut = 'livree' then
    select created_at into delivery_time
    from public.delivery_notes
    where order_id = p_order_id;

    if delivery_time is not null then
      return delivery_time;
    end if;

    raise exception 'Cette commande est déjà marquée comme livrée.'
      using errcode = '22023';
  end if;

  if order_row.statut not in ('nouvelle', 'traite', 'en_preparation', 'en_livraison') then
    raise exception 'Le statut actuel de cette commande ne permet pas de valider la livraison.'
      using errcode = '22023';
  end if;

  expected_path := p_order_id::text || '/delivery-note.pdf';
  if p_storage_path is distinct from expected_path then
    raise exception 'Chemin du bon de livraison invalide.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'delivery-notes'
      and name = expected_path
  ) then
    raise exception 'Le fichier PDF du bon de livraison est introuvable.'
      using errcode = '22023';
  end if;

  delivery_time := now();
  update public.orders
  set statut = 'livree',
      date_livraison_reelle = (delivery_time at time zone 'Europe/Paris')::date,
      delivered_at = delivery_time
  where id = p_order_id;

  insert into public.delivery_notes (order_id, storage_path, created_at)
  values (p_order_id, expected_path, delivery_time);

  return delivery_time;
end;
$$;

revoke all on function public.complete_order_delivery(uuid, text) from public, anon;
grant execute on function public.complete_order_delivery(uuid, text) to authenticated;

create extension if not exists pg_cron;

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

select cron.unschedule(jobid)
from cron.job
where jobname = 'delete_old_orders_job';

select cron.schedule(
  'delete_old_orders_job',
  '0 0 * * *',
  'select public.delete_old_orders();'
);
