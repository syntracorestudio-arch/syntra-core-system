-- =============================================================================
-- StudioFlow — 015_mercadopago_and_notifications.sql  (Fase 3, Slice A)
-- Cableado de cobro online (MercadoPago, cuenta propia por estudio) + avisos in-app.
--   · studio_payment_providers — credencial del estudio (access_token CIFRADO a nivel
--     app; la columna guarda ciphertext). Acceso SOLO service-role (sin políticas para
--     authenticated → ni admin la lee desde el navegador; el server usa createAdminClient).
--   · payment_attempts — intentos de pago online (pending/approved/rejected/expired).
--   · mercadopago_webhook_events — idempotencia de webhooks (event_id único). Service-role.
--   · notifications — avisos in-app por estudio (sin n8n, sin costo). Admin/recepción leen.
-- SYNTRA no intermedia fondos: el pago va directo a la cuenta del estudio.
-- =============================================================================

-- ---------- studio_payment_providers (credencial por estudio) ----------
create table if not exists public.studio_payment_providers (
  studio_id     uuid primary key references public.studios(id) on delete cascade,
  provider      text not null default 'mercadopago' check (provider in ('mercadopago')),
  status        text not null default 'connected' check (status in ('connected','disconnected')),
  access_token  text not null,                 -- CIFRADO a nivel app (AES-GCM); nunca texto plano
  mp_user_id    text,                           -- id de la cuenta MP receptora (del token)
  mp_nickname   text,                           -- nick visible ("conectado como …")
  public_key    text,
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger studio_payment_providers_set_updated
  before update on public.studio_payment_providers
  for each row execute function public.set_updated_at();

alter table public.studio_payment_providers enable row level security;
alter table public.studio_payment_providers force row level security;
-- Sin políticas: solo service-role (bypassa RLS) puede leer/escribir → el token nunca
-- es accesible desde una sesión de usuario. Las lecturas de ESTADO para la UI van por
-- server action con createAdminClient (devuelve solo campos no-secretos).

-- ---------- payment_attempts (intentos de pago online) ----------
create table if not exists public.payment_attempts (
  id                  uuid primary key default gen_random_uuid(),
  studio_id           uuid not null references public.studios(id) on delete cascade,
  member_id           uuid not null references public.members(id) on delete cascade,
  concept             text not null check (concept in ('drop_in','pack','membership','abono')),
  amount              numeric(12,2) not null check (amount >= 0),
  currency            text not null default 'ARS',
  status              text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  provider            text not null default 'mercadopago',
  preference_id       text,                     -- id de la preferencia MP
  provider_payment_id text,                     -- id del pago MP (al confirmar)
  idempotency_key     text not null,
  pass_id             uuid references public.passes(id) on delete set null,
  membership_days     int,
  payment_id          uuid references public.payments(id) on delete set null, -- pago aplicado
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index payment_attempts_studio_idx on public.payment_attempts (studio_id, created_at);
create index payment_attempts_member_idx on public.payment_attempts (member_id, status);
create unique index payment_attempts_idem_uq on public.payment_attempts (idempotency_key);
create trigger payment_attempts_set_updated
  before update on public.payment_attempts
  for each row execute function public.set_updated_at();

alter table public.payment_attempts enable row level security;
alter table public.payment_attempts force row level security;
-- El alumno ve sus propios intentos (para mostrar "pago pendiente/aprobado").
create policy attempts_select_own on public.payment_attempts for select
  using (studio_id in (select public.auth_member_studios())
         and member_id in (select public.auth_my_member_ids()));
-- Admin/recepción ven los del estudio.
create policy attempts_select_admin on public.payment_attempts for select
  using (public.auth_has_role(studio_id, array['admin','reception']));
-- Escrituras: solo server (service-role) vía checkout/webhook.

-- ---------- mercadopago_webhook_events (idempotencia) ----------
create table if not exists public.mercadopago_webhook_events (
  event_id     text primary key,               -- id único del evento MP → insert único
  studio_id    uuid references public.studios(id) on delete set null,
  type         text,
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.mercadopago_webhook_events enable row level security;
alter table public.mercadopago_webhook_events force row level security;
-- Sin políticas: solo el webhook (service-role) escribe/lee.

-- ---------- notifications (avisos in-app por estudio) ----------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  studio_id  uuid not null references public.studios(id) on delete cascade,
  type       text not null default 'payment' check (type in ('payment','debt','expiry','system')),
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_studio_idx on public.notifications (studio_id, created_at desc);

alter table public.notifications enable row level security;
alter table public.notifications force row level security;
-- Admin/recepción del estudio: ven y marcan como leídas las de SU estudio.
create policy notifications_select_admin on public.notifications for select
  using (public.auth_has_role(studio_id, array['admin','reception']));
create policy notifications_update_admin on public.notifications for update
  using      (public.auth_has_role(studio_id, array['admin','reception']))
  with check (public.auth_has_role(studio_id, array['admin','reception']));
-- Inserción: solo server (service-role) — el webhook/RPC crea los avisos.

-- Fin 015_mercadopago_and_notifications.sql
