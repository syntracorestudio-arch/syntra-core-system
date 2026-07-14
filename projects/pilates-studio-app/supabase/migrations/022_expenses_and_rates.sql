-- =============================================================================
-- StudioFlow — 022_expenses_and_rates.sql  (Egresos + Rentabilidad, S1+S3)
-- Libro de egresos del estudio + tarifas del staff.
--   · expenses — ÚNICA fuente de verdad de plata que sale (sueldos, alquiler,
--     servicios, etc.). Editable/borrable por admin (a diferencia del
--     credit_ledger no hay entidades derivadas → corregir = editar).
--   · staff_rates — modalidad de pago por miembro del equipo (pedido owner):
--     por_clase dada / fijo semanal / fijo mensual. Vigencia por valid_to null;
--     cambiar tarifa = cerrar la vieja y abrir una nueva (histórico gratis).
-- RLS: SOLO admin (más estricto que payments — los sueldos del equipo son lo
-- más sensible del sistema; recepción no los ve ni a nivel de base).
-- Aditiva y no destructiva.
-- =============================================================================

-- ---------- expenses (libro de egresos) ----------
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  studio_id    uuid not null references public.studios(id) on delete cascade,
  category     text not null check (category in
                 ('staff','rent','utilities','equipment','supplies','marketing','software','other')),
  member_id    uuid references public.members(id) on delete set null,  -- beneficiario (solo staff)
  amount       numeric(12,2) not null check (amount > 0),
  currency     text not null default 'ARS',
  method       text not null default 'transfer' check (method in ('cash','transfer','other')),
  note         text,
  period_start date,   -- período que cubre (sueldos); null en gastos puntuales
  period_end   date,
  paid_at      timestamptz not null default now(),
  recorded_by  uuid references public.members(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index expenses_studio_paid_idx on public.expenses (studio_id, paid_at);
create index expenses_member_idx on public.expenses (member_id) where member_id is not null;

alter table public.expenses enable row level security;
alter table public.expenses force row level security;
create policy expenses_admin_only on public.expenses for all
  using      (public.auth_has_role(studio_id, array['admin']))
  with check (public.auth_has_role(studio_id, array['admin']));

-- ---------- staff_rates (modalidad de pago por miembro) ----------
create table if not exists public.staff_rates (
  id         uuid primary key default gen_random_uuid(),
  studio_id  uuid not null references public.studios(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  mode       text not null check (mode in ('per_class','fixed_weekly','fixed_monthly')),
  amount     numeric(12,2) not null check (amount >= 0),
  valid_from date not null default current_date,
  valid_to   date,
  created_at timestamptz not null default now()
);
-- una sola tarifa VIGENTE por miembro
create unique index staff_rates_active_uq on public.staff_rates (member_id) where valid_to is null;

alter table public.staff_rates enable row level security;
alter table public.staff_rates force row level security;
create policy staff_rates_admin_only on public.staff_rates for all
  using      (public.auth_has_role(studio_id, array['admin']))
  with check (public.auth_has_role(studio_id, array['admin']));

-- Fin 022_expenses_and_rates.sql
