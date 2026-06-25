-- =============================================================================
-- StudioFlow — 001_initial_schema.sql  (Fase 1C-0)
-- Schema MVP: tablas + constraints + índices + vista member_financial_status.
-- Motor: PostgreSQL (Supabase). NO aplicar todavía (requiere aprobación del owner).
-- Fuente: docs/technical/schema-draft.md
-- Convenciones: uuid PK · studio_id en toda tabla de negocio · timestamptz UTC ·
--               enums por CHECK · dinero numeric(12,2) · soft-delete.
-- =============================================================================

-- gen_random_uuid() es nativo en PG13+ (Supabase lo provee).

-- ---------- util: updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- studios (tenant) ----------
create table public.studios (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  timezone    text not null default 'America/Argentina/Buenos_Aires',
  branding    jsonb not null default '{}'::jsonb,
  status      text not null default 'active' check (status in ('active','suspended')),
  created_at  timestamptz not null default now()
);

-- ---------- profiles (1:1 con auth.users; sin studio_id) ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text,
  email       text,
  created_at  timestamptz not null default now()
);

-- ---------- members (usuario ↔ estudio + rol) ----------
create table public.members (
  id          uuid primary key default gen_random_uuid(),
  studio_id   uuid not null references public.studios(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'client'
                check (role in ('client','admin','reception','instructor')),
  status      text not null default 'active'
                check (status in ('active','inactive','invited')),
  joined_at   timestamptz not null default now(),
  unique (studio_id, profile_id)
);
create index members_studio_role_idx on public.members (studio_id, role);
create index members_profile_idx     on public.members (profile_id, studio_id);

-- ---------- studio_settings (1:1) ----------
create table public.studio_settings (
  studio_id                 uuid primary key references public.studios(id) on delete cascade,
  cancellation_window_hours int     not null default 24  check (cancellation_window_hours >= 0),
  reservation_policy        text    not null default 'require_credit_or_membership'
    check (reservation_policy in
      ('require_credit_or_membership','allow_with_warning','allow_grace_n','block_if_debt')),
  grace_n                   int     not null default 0   check (grace_n >= 0),
  refund_on_late_cancel     boolean not null default false,
  default_capacity          int     not null default 8   check (default_capacity > 0),
  waitlist_enabled          boolean not null default true,
  expiry_warning_days       int     not null default 7   check (expiry_warning_days >= 0),
  updated_at                timestamptz not null default now()
);
create trigger studio_settings_set_updated
  before update on public.studio_settings
  for each row execute function public.set_updated_at();

-- ---------- classes (definición / plantilla) ----------
create table public.classes (
  id               uuid primary key default gen_random_uuid(),
  studio_id        uuid not null references public.studios(id) on delete cascade,
  name             text not null,
  type             text,
  default_capacity int  not null check (default_capacity > 0),
  duration_min     int  not null check (duration_min > 0),
  instructor_id    uuid,                 -- MVP: sin FK (instructors llega en Fase 1.1)
  instructor_name  text,                 -- MVP: nombre informativo, sin login
  status           text not null default 'active' check (status in ('active','archived')),
  created_at       timestamptz not null default now()
);
create index classes_studio_status_idx on public.classes (studio_id, status);

-- ---------- class_schedules (regla de recurrencia) ----------
create table public.class_schedules (
  id          uuid primary key default gen_random_uuid(),
  studio_id   uuid not null references public.studios(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete cascade,
  weekday     int  not null check (weekday between 0 and 6),  -- 0 = domingo
  start_time  time not null,                                  -- hora local del estudio
  capacity    int  not null check (capacity > 0),
  valid_from  date not null,
  valid_to    date,
  created_at  timestamptz not null default now()
);
create index class_schedules_lookup_idx on public.class_schedules (studio_id, class_id, weekday);

-- ---------- class_occurrences (instancia concreta; fuente de cupo) ----------
create table public.class_occurrences (
  id           uuid primary key default gen_random_uuid(),
  studio_id    uuid not null references public.studios(id) on delete cascade,
  class_id     uuid not null references public.classes(id) on delete cascade,
  schedule_id  uuid references public.class_schedules(id) on delete set null,
  starts_at    timestamptz not null,           -- UTC
  ends_at      timestamptz not null,
  capacity     int  not null check (capacity > 0),
  booked_count int  not null default 0,
  status       text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  created_at   timestamptz not null default now(),
  constraint occ_booked_within_capacity check (booked_count between 0 and capacity),
  unique (class_id, starts_at)               -- idempotencia de recurrencias
);
create index class_occurrences_agenda_idx on public.class_occurrences (studio_id, starts_at);

-- ---------- passes (catálogo de packs por estudio) ----------
create table public.passes (
  id            uuid primary key default gen_random_uuid(),
  studio_id     uuid not null references public.studios(id) on delete cascade,
  name          text not null,
  credits       int  not null check (credits > 0),
  validity_days int  not null check (validity_days > 0),
  price         numeric(12,2) not null check (price >= 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index passes_studio_active_idx on public.passes (studio_id, active);

-- ---------- payments (cobro confirmado; manual MVP, online Fase 3) ----------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  studio_id           uuid not null references public.studios(id) on delete cascade,
  member_id           uuid not null references public.members(id) on delete restrict,
  amount              numeric(12,2) not null check (amount >= 0),
  currency            text not null default 'ARS',
  concept             text not null check (concept in ('drop_in','pack','membership','abono')),
  method              text not null check (method in ('cash','transfer','card_manual','mercadopago')),
  status              text not null default 'confirmed' check (status in ('confirmed','pending','rejected')),
  paid_at             timestamptz not null default now(),
  recorded_by         uuid references public.members(id) on delete set null,
  provider            text,                 -- Fase 3
  provider_payment_id text,                 -- Fase 3
  created_at          timestamptz not null default now()
);
create index payments_income_idx on public.payments (studio_id, paid_at);
create unique index payments_provider_uq
  on public.payments (provider, provider_payment_id)
  where provider is not null;

-- ---------- member_passes (pack comprado; instancia congelada) ----------
create table public.member_passes (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios(id) on delete cascade,
  member_id         uuid not null references public.members(id) on delete cascade,
  pass_id           uuid references public.passes(id) on delete set null,
  credits_total     int  not null check (credits_total > 0),
  expires_at        timestamptz not null,
  source_payment_id uuid references public.payments(id) on delete set null,
  status            text not null default 'active' check (status in ('active','expired','depleted')),
  created_at        timestamptz not null default now()
);
create index member_passes_member_idx  on public.member_passes (member_id);
create index member_passes_expiry_idx  on public.member_passes (studio_id, expires_at);

-- ---------- memberships (abono temporal / ilimitado) ----------
create table public.memberships (
  id                uuid primary key default gen_random_uuid(),
  studio_id         uuid not null references public.studios(id) on delete cascade,
  member_id         uuid not null references public.members(id) on delete cascade,
  type              text not null,
  valid_from        date not null,
  valid_to          date not null,
  status            text not null default 'active' check (status in ('active','expired','cancelled')),
  source_payment_id uuid references public.payments(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index memberships_member_idx on public.memberships (member_id);
create index memberships_valid_idx  on public.memberships (studio_id, valid_to);

-- ---------- class_reservations (FK a credit_ledger se agrega al final) ----------
create table public.class_reservations (
  id               uuid primary key default gen_random_uuid(),
  studio_id        uuid not null references public.studios(id) on delete cascade,
  occurrence_id    uuid not null references public.class_occurrences(id) on delete cascade,
  member_id        uuid not null references public.members(id) on delete cascade,
  status           text not null default 'booked'
                     check (status in ('booked','cancelled','attended','no_show')),
  consumed_credit  boolean not null default false,
  credit_ledger_id uuid,                    -- FK añadida tras crear credit_ledger
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz
);
create unique index reservations_active_uq
  on public.class_reservations (occurrence_id, member_id)
  where status = 'booked';
create index reservations_occurrence_idx on public.class_reservations (occurrence_id);
create index reservations_member_idx     on public.class_reservations (member_id, status);

-- ---------- waitlist ----------
create table public.waitlist (
  id            uuid primary key default gen_random_uuid(),
  studio_id     uuid not null references public.studios(id) on delete cascade,
  occurrence_id uuid not null references public.class_occurrences(id) on delete cascade,
  member_id     uuid not null references public.members(id) on delete cascade,
  position      int  not null,
  status        text not null default 'waiting' check (status in ('waiting','promoted','cancelled')),
  created_at    timestamptz not null default now()
);
create unique index waitlist_active_uq
  on public.waitlist (occurrence_id, member_id) where status = 'waiting';
create index waitlist_order_idx on public.waitlist (occurrence_id, position);

-- ---------- credit_ledger (append-only; fuente de verdad del saldo) ----------
create table public.credit_ledger (
  id             uuid primary key default gen_random_uuid(),
  studio_id      uuid not null references public.studios(id) on delete cascade,
  member_id      uuid not null references public.members(id) on delete cascade,
  member_pass_id uuid references public.member_passes(id) on delete set null,
  delta          int  not null check (delta <> 0),
  reason         text not null check (reason in ('purchase','booking','refund','expire','adjust')),
  reservation_id uuid references public.class_reservations(id) on delete set null,
  note           text,
  created_by     uuid references public.members(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index credit_ledger_member_idx on public.credit_ledger (member_id);
create index credit_ledger_pass_idx   on public.credit_ledger (member_pass_id);
create index credit_ledger_studio_idx on public.credit_ledger (studio_id, created_at);

-- cerrar el FK circular reservation → ledger
alter table public.class_reservations
  add constraint reservations_ledger_fk
  foreign key (credit_ledger_id) references public.credit_ledger(id) on delete set null;

-- ---------- attendance (check-in / no-show) ----------
create table public.attendance (
  id             uuid primary key default gen_random_uuid(),
  studio_id      uuid not null references public.studios(id) on delete cascade,
  reservation_id uuid not null unique references public.class_reservations(id) on delete cascade,
  status         text not null check (status in ('checked_in','no_show')),
  checked_in_at  timestamptz,
  created_at     timestamptz not null default now()
);

-- =============================================================================
-- Vista: member_financial_status (derivada; estados MVP)
-- saldo = SUM(credit_ledger.delta) de packs NO vencidos.
-- =============================================================================
create or replace view public.member_financial_status as
with credits as (
  select mp.member_id,
         coalesce(sum(cl.delta), 0) as credits_available
  from public.member_passes mp
  join public.credit_ledger cl on cl.member_pass_id = mp.id
  where mp.expires_at > now()
  group by mp.member_id
),
next_expiry as (
  select member_id, min(expires_at) as next_pass_expiry
  from public.member_passes where expires_at > now() group by member_id
),
membership as (
  select member_id,
         bool_or(status = 'active' and now()::date between valid_from and valid_to) as has_active,
         bool_or(status <> 'cancelled' and valid_to < now()::date) as has_expired,
         min(valid_to) filter (where status = 'active' and valid_to >= now()::date) as next_membership_end
  from public.memberships group by member_id
)
select
  m.id            as member_id,
  m.studio_id,
  coalesce(c.credits_available, 0)       as credits_available,
  coalesce(ms.has_active, false)         as has_active_membership,
  ne.next_pass_expiry,
  ms.next_membership_end,
  case
    when coalesce(ms.has_active, false) then 'al_dia'
    when coalesce(c.credits_available, 0) > 0 then 'al_dia'
    when coalesce(ms.has_expired, false) then 'membresia_vencida'
    when exists (select 1 from public.member_passes mp
                 where mp.member_id = m.id and mp.expires_at > now()) then 'pack_sin_saldo'
    else 'debe_pago'
  end as financial_status
from public.members m
left join credits     c  on c.member_id = m.id
left join next_expiry ne on ne.member_id = m.id
left join membership  ms on ms.member_id = m.id;

-- Fin 001_initial_schema.sql
