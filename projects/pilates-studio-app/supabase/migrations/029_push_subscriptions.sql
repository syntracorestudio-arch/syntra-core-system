-- =============================================================================
-- StudioFlow — 029_push_subscriptions.sql  (Web Push: avisos como burbuja al teléfono)
-- Tabla de suscripciones push por member (un usuario puede tener varios equipos:
-- teléfono + computadora). El envío lo hace el servidor (service role) desde
-- /api/push/dispatch cuando se inserta una notificación; el alumno solo alta/baja
-- SU suscripción (RLS por member propio).
-- Aditiva y no destructiva.
-- =============================================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  studio_id   uuid not null references public.studios(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_member_idx
  on public.push_subscriptions (member_id);

alter table public.push_subscriptions enable row level security;

-- el usuario ve/da de alta/da de baja SOLO sus suscripciones
create policy push_select_own on public.push_subscriptions for select
  using (member_id in (select public.auth_my_member_ids()));
create policy push_insert_own on public.push_subscriptions for insert
  with check (
    member_id in (select public.auth_my_member_ids())
    and studio_id in (select public.auth_member_studios())
  );
create policy push_delete_own on public.push_subscriptions for delete
  using (member_id in (select public.auth_my_member_ids()));

-- Fin 029_push_subscriptions.sql
