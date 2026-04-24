-- RLS sur la table profiles
-- Permet à chaque user de voir/modifier son propre profil
-- et à l'admin de voir/modifier tous les profils

alter table public.profiles enable row level security;

-- SELECT : user voit son propre profil, admin voit tout
drop policy if exists "Profiles visibles par le proprietaire et l admin" on public.profiles;
create policy "Profiles visibles par le proprietaire et l admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- UPDATE : user modifie son propre profil, admin modifie tous les profils
drop policy if exists "Profiles modifiables par le proprietaire et l admin" on public.profiles;
create policy "Profiles modifiables par le proprietaire et l admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
