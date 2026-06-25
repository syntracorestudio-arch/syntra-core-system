-- =============================================================================
-- StudioFlow — 006_studio_join_codes.sql  (Fase 1D-1B)
-- Códigos de alta de alumno por estudio (onboarding por código).
-- Se guarda SOLO el hash (sha256) del código, nunca el texto plano.
-- Fuente: business-rules.md (alta por invitación/código).
-- =============================================================================

create table public.studio_join_codes (
  id          uuid primary key default gen_random_uuid(),
  studio_id   uuid not null references public.studios(id) on delete cascade,
  code_hash   text not null,                 -- sha256 hex del código NORMALIZADO (upper+trim)
  label       text,
  is_active   boolean not null default true,
  max_uses    int,                           -- null = ilimitado
  uses_count  int not null default 0 check (uses_count >= 0),
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (studio_id, code_hash)
);
create index studio_join_codes_hash_idx on public.studio_join_codes (code_hash);

create trigger studio_join_codes_set_updated
  before update on public.studio_join_codes
  for each row execute function public.set_updated_at();

alter table public.studio_join_codes enable row level security;
alter table public.studio_join_codes force row level security;

-- Solo admin/reception del estudio gestionan/ven sus códigos.
-- (anon/client NO leen códigos; el alta usa la RPC SECURITY DEFINER de abajo.)
create policy join_codes_admin on public.studio_join_codes for all
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));

-- =============================================================================
-- RPC redeem_join_code: valida el código y vincula al alumno como 'client'.
-- SECURITY DEFINER (corre como postgres) → la llama el server action con el
-- service_role. Atómica: revalida + inserta member + incrementa uses_count.
-- =============================================================================
create or replace function public.redeem_join_code(p_code text, p_profile_id uuid)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text;
  v_code public.studio_join_codes;
begin
  v_hash := encode(digest(upper(trim(p_code)), 'sha256'), 'hex');

  select * into v_code
    from public.studio_join_codes
   where code_hash = v_hash
     and is_active
     and (expires_at is null or expires_at > now())
     and (max_uses is null or uses_count < max_uses)
   for update;

  if not found then
    raise exception 'invalid_code';
  end if;

  -- vincular como alumno (idempotente si ya estaba vinculado)
  insert into public.members (studio_id, profile_id, role, status)
  values (v_code.studio_id, p_profile_id, 'client', 'active')
  on conflict (studio_id, profile_id) do nothing;

  update public.studio_join_codes
     set uses_count = uses_count + 1, updated_at = now()
   where id = v_code.id;

  return v_code.studio_id;
end $$;

-- la ejecuta el server action (service_role bypassa); authenticated por si se reusa.
grant execute on function public.redeem_join_code(text, uuid) to service_role, authenticated;

-- Fin 006_studio_join_codes.sql
