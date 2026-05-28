-- Garantit que le rôle est TOUJOURS 'client' à la création
-- d'un compte, même si un attaquant passe "role":"admin"
-- dans les options.data de signUp().


create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
    new.raw_user_meta_data->>'nom',
    new.raw_user_meta_data->>'prenom',
    new.raw_user_meta_data->>'nom_societe',
    new.raw_user_meta_data->>'telephone',
    'client',   -- hardcodé : jamais lu depuis raw_user_meta_data
    true
  );
  return new;
end;
$$;

-- Recréer le trigger sur auth.users (au cas où il n'existait pas)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
