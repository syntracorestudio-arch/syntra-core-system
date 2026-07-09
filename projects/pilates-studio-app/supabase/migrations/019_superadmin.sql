-- =============================================================================
-- StudioFlow — 019_superadmin.sql  (Fase 5, Slice A)
-- Flag de superadmin (SYNTRA) a nivel perfil. El panel /super valida este flag
-- en el server y opera vía service-role (bypassa RLS) → NO se agregan políticas
-- nuevas ni se tocan las existentes. Aditiva y no destructiva.
--
-- Tras aplicar, marcá tu usuario SYNTRA (una vez):
--   update public.profiles set is_superadmin = true where email = 'tu-email';
-- =============================================================================

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- Fin 019_superadmin.sql
