-- 1. On corrige le déclencheur pour qu'il ne plante pas si les métadonnées sont vides (création depuis le Dashboard)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
begin
  -- Sécurité : si le dashboard ne fournit pas de metadata, on met un objet vide
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  insert into public.profiles (
    id,
    email,
    nom,
    prenom,
    nom_societe,
    telephone,
    role,
    actif
  ) values (
    new.id,
    new.email,
    meta->>'nom',
    meta->>'prenom',
    meta->>'nom_societe',
    meta->>'telephone',
    'client', -- On le met client par défaut pour la sécurité
    true
  );
  return new;
end;
$$;

-- 2. Une fois votre compte créé dans Authentication > Add user, 
-- exécutez CETTE REQUÊTE ci-dessous en remplaçant l'email 
-- pour vous transformer en Administrateur :

-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'votre-email@exemple.com';
