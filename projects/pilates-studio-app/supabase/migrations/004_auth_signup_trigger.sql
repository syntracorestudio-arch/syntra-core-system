-- =============================================================================
-- StudioFlow — 004_auth_signup_trigger.sql  (Fase 1C-1)
-- Crea public.profiles automáticamente cuando se registra un usuario en auth.users.
-- ESTADO: escrita, NO validada ejecutándose (Docker/Supabase local no disponible).
-- Fuente: supabase/README.md (pendientes) + docs/technical/schema-draft.md.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nota: el vínculo a un estudio (members) NO se crea acá; se hace por invitación/código
-- del estudio (decisión Fase 0B) vía un flujo admin/RPC posterior. Este trigger solo
-- garantiza que cada usuario de auth tenga su profile (resuelve la FK de members/profiles).

-- Fin 004_auth_signup_trigger.sql
