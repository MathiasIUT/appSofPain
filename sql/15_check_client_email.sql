-- Fonction appelée depuis ForgotPasswordScreen (utilisateur non connecté).
-- SECURITY DEFINER permet de contourner le RLS pour vérifier si l'email
-- existe dans profiles sans exposer les données.
create or replace function public.check_client_email(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where email = lower(p_email)
      and actif = true
  );
$$;

-- Révoque l'accès par défaut et l'accorde uniquement aux utilisateurs anonymes/publics.
revoke all on function public.check_client_email(text) from public;
grant execute on function public.check_client_email(text) to anon, authenticated;
