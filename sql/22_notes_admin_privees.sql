create table if not exists public.order_admin_notes (
  order_id uuid primary key references public.orders(id) on delete cascade,
  note text not null check (length(btrim(note)) > 0),
  updated_at timestamp with time zone not null default now()
);

alter table public.order_admin_notes enable row level security;

drop policy if exists "Admin peut gerer les notes internes" on public.order_admin_notes;
create policy "Admin peut gerer les notes internes"
  on public.order_admin_notes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.order_admin_notes to authenticated;

create or replace function public.copy_profile_admin_note_to_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_note text;
begin
  select nullif(btrim(note_interne_admin), '')
  into profile_note
  from public.profiles
  where id = new.client_id;

  if profile_note is not null then
    insert into public.order_admin_notes (order_id, note)
    values (new.id, profile_note);
  end if;

  return new;
end;
$$;

drop trigger if exists copy_profile_admin_note_to_order on public.orders;
create trigger copy_profile_admin_note_to_order
  after insert on public.orders
  for each row execute function public.copy_profile_admin_note_to_order();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'notes_admin'
  ) then
    execute $migration$
      insert into public.order_admin_notes (order_id, note)
      select id, btrim(notes_admin)
      from public.orders
      where nullif(btrim(notes_admin), '') is not null
      on conflict (order_id) do update set note = excluded.note
    $migration$;

    alter table public.orders drop column notes_admin;
  end if;
end
$$;
