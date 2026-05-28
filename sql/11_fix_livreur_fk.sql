-- 1. Supprimer l'ancienne FK de profiles.livreur_id (quelle qu'elle soit)
do $$
declare
  _constraint_name text;
begin
  select tc.constraint_name into _constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
  where tc.table_name = 'profiles'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'livreur_id'
  limit 1;

  if _constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', _constraint_name);
    raise notice 'Dropped constraint: %', _constraint_name;
  else
    raise notice 'No FK constraint found on profiles.livreur_id';
  end if;
end $$;

-- 2. Recréer la FK vers la table livreurs
alter table public.profiles
  add constraint profiles_livreur_id_fkey
  foreign key (livreur_id) references public.livreurs(id) on delete set null;
