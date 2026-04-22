-- ============================================================
-- SOF PAIN - Storage Policies pour le bucket `products`
-- ============================================================
-- À exécuter APRÈS avoir créé le bucket `products` en mode public
-- via l'interface Supabase Storage.
-- ============================================================

-- Tout le monde (y compris non connecté) peut voir les images
-- (nécessaire pour que les images produits s'affichent dans le catalogue)
drop policy if exists "Images produits lisibles publiquement" on storage.objects;
create policy "Images produits lisibles publiquement"
  on storage.objects for select
  to public
  using (bucket_id = 'products');

-- Seul l'admin peut uploader des images
drop policy if exists "Admin peut uploader les images" on storage.objects;
create policy "Admin peut uploader les images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'products'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Seul l'admin peut supprimer des images
drop policy if exists "Admin peut supprimer les images" on storage.objects;
create policy "Admin peut supprimer les images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'products'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Seul l'admin peut remplacer des images
drop policy if exists "Admin peut mettre a jour les images" on storage.objects;
create policy "Admin peut mettre a jour les images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'products'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );