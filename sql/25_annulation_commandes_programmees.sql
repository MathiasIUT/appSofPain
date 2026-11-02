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
    for update of s
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

create or replace function public.cancel_order_schedule(p_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Seuls les administrateurs peuvent annuler une programmation.'
      using errcode = '42501';
  end if;

  perform 1
  from public.order_schedules
  where id = p_schedule_id
  for update;

  if not found then
    raise exception 'Programmation introuvable.'
      using errcode = '22023';
  end if;

  update public.order_schedules
  set statut = 'annulee'
  where id = p_schedule_id;

  update public.orders
  set statut = 'annulee'
  where recurrence_id = p_schedule_id
    and statut not in ('annulee', 'livree', 'traite');
end;
$$;

update public.orders as o
set statut = 'annulee'
from public.order_schedules as s
where o.recurrence_id = s.id
  and s.statut = 'annulee'
  and o.statut not in ('annulee', 'livree', 'traite');

revoke all on function public.cancel_order_schedule(uuid) from public, anon;
grant execute on function public.cancel_order_schedule(uuid) to authenticated;
