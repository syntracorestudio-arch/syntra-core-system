-- =============================================================================
-- StudioFlow — 002_rls_policies.sql  (Fase 1C-0)
-- Helpers + enable/force RLS + policies por rol. NO aplicar todavía.
-- Fuente: docs/technical/rls-draft.md
-- Nota: las funciones SECURITY DEFINER (helpers y RPC del 003) son propiedad de
-- `postgres` (rol con BYPASSRLS en Supabase) → operan por encima de RLS de forma
-- controlada. El `service_role` también bypassa RLS y se usa solo server-side.
-- =============================================================================

-- ---------- Helpers (SECURITY DEFINER, search_path fijo → anti-recursión/hijack) ----------
create or replace function public.auth_member_studios()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select studio_id from public.members
  where profile_id = auth.uid() and status = 'active'
$$;

create or replace function public.auth_has_role(p_studio uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where profile_id = auth.uid()
      and studio_id  = p_studio
      and status     = 'active'
      and role = any(p_roles)
  )
$$;

-- helper: ids de members del usuario actual (para "solo lo propio")
create or replace function public.auth_my_member_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where profile_id = auth.uid() and status = 'active'
$$;

-- ---------- enable + force RLS en todas las tablas de negocio ----------
alter table public.studios            enable row level security;
alter table public.profiles           enable row level security;
alter table public.members            enable row level security;
alter table public.studio_settings    enable row level security;
alter table public.classes            enable row level security;
alter table public.class_schedules    enable row level security;
alter table public.class_occurrences  enable row level security;
alter table public.passes             enable row level security;
alter table public.payments           enable row level security;
alter table public.member_passes      enable row level security;
alter table public.memberships        enable row level security;
alter table public.class_reservations enable row level security;
alter table public.waitlist           enable row level security;
alter table public.credit_ledger      enable row level security;
alter table public.attendance         enable row level security;

alter table public.studios            force row level security;
alter table public.profiles           force row level security;
alter table public.members            force row level security;
alter table public.studio_settings    force row level security;
alter table public.classes            force row level security;
alter table public.class_schedules    force row level security;
alter table public.class_occurrences  force row level security;
alter table public.passes             force row level security;
alter table public.payments           force row level security;
alter table public.member_passes      force row level security;
alter table public.memberships        force row level security;
alter table public.class_reservations force row level security;
alter table public.waitlist           force row level security;
alter table public.credit_ledger      force row level security;
alter table public.attendance         force row level security;

-- ============================ studios ============================
create policy studios_select on public.studios for select
  using (id in (select public.auth_member_studios()));
create policy studios_update_admin on public.studios for update
  using      (public.auth_has_role(id, array['admin']))
  with check (public.auth_has_role(id, array['admin']));

-- ============================ profiles ============================
create policy profiles_select_own on public.profiles for select
  using (id = auth.uid());
-- admin/reception ven los profiles de los members de SUS estudios
create policy profiles_select_admin on public.profiles for select
  using (exists (
    select 1 from public.members me
    join public.members them on them.studio_id = me.studio_id
    where me.profile_id = auth.uid() and me.status = 'active'
      and me.role in ('admin','reception')
      and them.profile_id = public.profiles.id
  ));
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ============================ members ============================
create policy members_select_own on public.members for select
  using (profile_id = auth.uid());
create policy members_select_admin on public.members for select
  using (public.auth_has_role(studio_id, array['admin','reception']));
create policy members_write_admin on public.members for all
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));

-- ============================ studio_settings ============================
create policy settings_select_admin on public.studio_settings for select
  using (public.auth_has_role(studio_id, array['admin','reception']));
create policy settings_write_admin on public.studio_settings for all
  using      (public.auth_has_role(studio_id, array['admin']))      -- solo admin (no reception)
  with check (public.auth_has_role(studio_id, array['admin']));

-- ============================ classes / schedules / occurrences (tenant read, admin write) ============================
create policy classes_select on public.classes for select
  using (studio_id in (select public.auth_member_studios()));
create policy classes_write_admin on public.classes for all
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));

create policy schedules_select on public.class_schedules for select
  using (studio_id in (select public.auth_member_studios()));
create policy schedules_write_admin on public.class_schedules for all
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));

create policy occurrences_select on public.class_occurrences for select
  using (studio_id in (select public.auth_member_studios()));
create policy occurrences_write_admin on public.class_occurrences for all
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));
-- Nota: booked_count lo gestiona SOLO la RPC (definer). El admin no debería
-- editarlo a mano; si lo hace, el CHECK occ_booked_within_capacity lo protege.

-- ============================ passes (tenant read, admin write) ============================
create policy passes_select on public.passes for select
  using (studio_id in (select public.auth_member_studios()));
create policy passes_write_admin on public.passes for all
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));

-- ============================ class_reservations ============================
-- client: ve solo las suyas. Crear/cancelar = vía RPC (no insert/update directo).
create policy reservations_select_own on public.class_reservations for select
  using (studio_id in (select public.auth_member_studios())
         and member_id in (select public.auth_my_member_ids()));
create policy reservations_select_admin on public.class_reservations for select
  using (public.auth_has_role(studio_id, array['admin','reception','instructor']));
create policy reservations_manage_admin on public.class_reservations for update
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));

-- ============================ waitlist ============================
create policy waitlist_select_own on public.waitlist for select
  using (studio_id in (select public.auth_member_studios())
         and member_id in (select public.auth_my_member_ids()));
create policy waitlist_select_admin on public.waitlist for select
  using (public.auth_has_role(studio_id, array['admin','reception']));
create policy waitlist_manage_admin on public.waitlist for update
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));

-- ============================ payments (financiero) ============================
create policy payments_select_own on public.payments for select
  using (studio_id in (select public.auth_member_studios())
         and member_id in (select public.auth_my_member_ids()));
create policy payments_select_admin on public.payments for select
  using (public.auth_has_role(studio_id, array['admin','reception']));
create policy payments_write_admin on public.payments for all
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));

-- ============================ member_passes ============================
create policy member_passes_select_own on public.member_passes for select
  using (studio_id in (select public.auth_member_studios())
         and member_id in (select public.auth_my_member_ids()));
create policy member_passes_select_admin on public.member_passes for select
  using (public.auth_has_role(studio_id, array['admin','reception']));
create policy member_passes_write_admin on public.member_passes for all
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));

-- ============================ memberships ============================
create policy memberships_select_own on public.memberships for select
  using (studio_id in (select public.auth_member_studios())
         and member_id in (select public.auth_my_member_ids()));
create policy memberships_select_admin on public.memberships for select
  using (public.auth_has_role(studio_id, array['admin','reception']));
create policy memberships_write_admin on public.memberships for all
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));

-- ============================ credit_ledger (APPEND-ONLY) ============================
-- read: propio + admin. insert: admin (para 'adjust'/'purchase' manual) y RPC (definer).
-- NO se definen policies de UPDATE/DELETE → denegados por RLS. Además se revoca a nivel grant.
create policy ledger_select_own on public.credit_ledger for select
  using (studio_id in (select public.auth_member_studios())
         and member_id in (select public.auth_my_member_ids()));
create policy ledger_select_admin on public.credit_ledger for select
  using (public.auth_has_role(studio_id, array['admin','reception']));
create policy ledger_insert_admin on public.credit_ledger for insert
  with check (public.auth_has_role(studio_id, array['admin','reception']));
-- append-only duro: nadie (salvo service_role) actualiza/borra asientos
revoke update, delete on public.credit_ledger from authenticated, anon;

-- ============================ attendance ============================
create policy attendance_select_own on public.attendance for select
  using (studio_id in (select public.auth_member_studios())
         and reservation_id in (
           select id from public.class_reservations
           where member_id in (select public.auth_my_member_ids())));
create policy attendance_manage_admin on public.attendance for all
  using      (public.auth_has_role(studio_id, array['admin','reception','instructor']))
  with check (public.auth_has_role(studio_id, array['admin','reception','instructor']));

-- Fin 002_rls_policies.sql
