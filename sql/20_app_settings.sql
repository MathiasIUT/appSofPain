-- Réglages applicatifs (horaires de commande, etc.)
-- Lisible par tous les connectés, modifiable uniquement par l'admin.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default now()
);

drop trigger if exists set_updated_at_app_settings on public.app_settings;
create trigger set_updated_at_app_settings
  before update on public.app_settings
  for each row execute procedure public.handle_updated_at();

alter table public.app_settings enable row level security;

drop policy if exists "Settings lisibles par tous les connectes" on public.app_settings;
create policy "Settings lisibles par tous les connectes"
  on public.app_settings for select
  to authenticated
  using (true);

drop policy if exists "Admin peut gerer les settings" on public.app_settings;
create policy "Admin peut gerer les settings"
  on public.app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Horaires de commande par défaut : 9h - 20h
insert into public.app_settings (key, value)
values ('horaires_commande', '{"ouverture": 9, "fermeture": 20}'::jsonb)
on conflict (key) do nothing;
