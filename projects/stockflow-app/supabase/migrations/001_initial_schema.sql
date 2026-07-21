-- =============================================================================
-- StockFlow — 001_initial_schema.sql  (tanda 1B)
-- Modelo completo: tenancy, catálogo, ledgers append-only, ventas, fiado,
-- vencimientos, notificaciones/push y rate limiting. Con índices y triggers.
-- Fuente de verdad: docs/database.md · reglas: docs/business-rules.md
--
-- Aplicar ANTES que 002_rls_policies.sql. Lo corre el owner en el SQL Editor.
--
-- Convenciones (heredadas de StudioFlow): uuid PK, `store_id` en toda tabla de
-- negocio, timestamptz en UTC, dinero numeric(12,2), cantidades numeric(12,3)
-- (numeric y no int: deja gratis la venta a granel de dietética), enums por CHECK.
--
-- Baseline `syntra-scale-security-baseline`: los índices y el rate limiting
-- nacen ACÁ, no en una migración correctiva posterior.
-- =============================================================================

create extension if not exists pgcrypto;

-- =============================================================================
-- 1. Tenancy e identidad
-- =============================================================================

-- Tenant. `branding` guarda la marca del negocio (white-label):
-- { accent, logo_url, logo_path, subtitle, whatsapp, address }
-- `cuit` y `fiscal` son HOOKS de AFIP: existen para no migrar después, sin lógica en MVP.
create table public.stores (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  timezone    text not null default 'America/Argentina/Buenos_Aires',
  branding    jsonb not null default '{}'::jsonb,
  status      text not null default 'active' check (status in ('active', 'suspended')),
  cuit        text,
  fiscal      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 1:1 con auth.users. SIN store_id: la pertenencia vive en `members` (N:N).
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  is_superadmin boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Pertenencia + rol POR NEGOCIO. Los flags recortan al empleado.
-- `can_see_costs` en false por default: el empleado ve precio de venta, nunca el costo.
create table public.members (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references public.stores(id) on delete cascade,
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  role               text not null check (role in ('owner', 'staff')),
  display_name       text,
  status             text not null default 'active' check (status in ('active', 'inactive')),
  can_sell_on_credit boolean not null default false,
  can_apply_discount boolean not null default false,
  can_void_sale      boolean not null default false,
  can_receive_stock  boolean not null default false,
  can_see_costs      boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (store_id, profile_id)
);

create index members_store_role_idx on public.members (store_id, role) where status = 'active';
create index members_profile_idx    on public.members (profile_id);

-- Ajustes por negocio. `allow_negative_stock` en TRUE a propósito: la caja nunca
-- se frena por un número del sistema (docs/business-rules.md §1).
create table public.store_settings (
  store_id                   uuid primary key references public.stores(id) on delete cascade,
  allow_negative_stock       boolean not null default true,
  low_stock_threshold_default int    not null default 3 check (low_stock_threshold_default >= 0),
  expiry_warning_days        int     not null default 7 check (expiry_warning_days >= 0),
  reprice_rounding           numeric(12,2) not null default 50 check (reprice_rounding >= 0),
  updated_at                 timestamptz not null default now()
);

-- =============================================================================
-- 2. Catálogo
-- =============================================================================

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  name       text not null,
  emoji      text,
  color      text,
  sort       int not null default 0,
  status     text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create index categories_store_idx on public.categories (store_id, sort) where status = 'active';

-- `stock` es un CACHE denormalizado que mantiene el trigger sobre stock_ledger.
-- La verdad es el ledger; el cache existe para que el POS y la query de stock bajo
-- sean instantáneos (mismo criterio que `booked_count` en StudioFlow).
-- `cost` = ÚLTIMO costo de compra (cada ingreso lo pisa), explicable al kiosquero.
-- `sale_unit` y `attrs` son hooks de granel / multi-rubro, sin lógica en MVP.
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid not null references public.stores(id) on delete cascade,
  category_id         uuid references public.categories(id) on delete set null,
  name                text not null,
  emoji               text,
  color               text,
  cost                numeric(12,2) check (cost >= 0),
  price               numeric(12,2) not null check (price >= 0),
  low_stock_threshold int check (low_stock_threshold >= 0),
  stock               numeric(12,3) not null default 0,
  sale_unit           text not null default 'unit' check (sale_unit in ('unit', 'kg', 'lt')),
  attrs               jsonb not null default '{}'::jsonb,
  status              text not null default 'active' check (status in ('active', 'archived')),
  price_updated_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index products_store_status_idx on public.products (store_id, status);
create index products_category_idx     on public.products (store_id, category_id) where status = 'active';
create index products_name_idx         on public.products (store_id, lower(name)) where status = 'active';
-- Sirve el dashboard y el cron de alertas sin escanear el catálogo entero.
create index products_low_stock_idx     on public.products (store_id, stock) where status = 'active';

-- N códigos por producto: multi-presentación, re-etiquetado, códigos internos.
-- El EAN NUNCA es PK (docs/database.md §2).
create table public.product_barcodes (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  barcode    text not null,
  created_at timestamptz not null default now(),
  unique (store_id, barcode)
);

create index product_barcodes_product_idx on public.product_barcodes (product_id);

-- =============================================================================
-- 3. Clientes y fiado
-- =============================================================================

create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  name         text not null,
  phone        text,
  note         text,
  credit_limit numeric(12,2) check (credit_limit >= 0),
  status       text not null default 'active' check (status in ('active', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index clients_store_idx on public.clients (store_id, status);
create index clients_name_idx  on public.clients (store_id, lower(name)) where status = 'active';

-- =============================================================================
-- 4. Ventas
-- =============================================================================

-- `idempotency_key`: el cliente lo genera al armar el carrito. Un reintento por
-- corte de red devuelve la MISMA venta, nunca dos (docs/rpc-contracts.md).
-- Anular = status 'voided' + contra-asientos. Nunca DELETE.
create table public.sales (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  member_id       uuid references public.members(id) on delete set null,
  client_id       uuid references public.clients(id) on delete set null,
  total           numeric(12,2) not null check (total >= 0),
  payment_method  text not null check (payment_method in ('cash', 'qr', 'card', 'transfer', 'account')),
  status          text not null default 'completed' check (status in ('completed', 'voided')),
  idempotency_key text not null,
  sold_at         timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references public.members(id) on delete set null,
  void_reason     text,
  fiscal          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (store_id, idempotency_key),
  -- Fiar exige cliente: sin cliente no hay a quién cobrarle después.
  constraint sales_account_needs_client check (payment_method <> 'account' or client_id is not null)
);

-- TODA lista de ventas se consulta por rango de fecha (cota obligatoria del baseline).
create index sales_store_date_idx on public.sales (store_id, sold_at desc);
create index sales_client_idx     on public.sales (client_id, sold_at desc) where client_id is not null;
create index sales_member_idx     on public.sales (member_id, sold_at desc);

-- Snapshots de nombre/precio/costo: el margen histórico queda exacto aunque el
-- producto cambie de precio o se archive. `product_id` null = venta por monto libre.
create table public.sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales(id) on delete cascade,
  store_id     uuid not null references public.stores(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  qty          numeric(12,3) not null check (qty > 0),
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  unit_cost    numeric(12,2) check (unit_cost >= 0),
  line_total   numeric(12,2) not null check (line_total >= 0)
);

create index sale_items_sale_idx    on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (store_id, product_id);

-- Índices de FK "de mantenimiento": sin ellos, dar de baja un member escanea los
-- ledgers enteros (el baseline pide índice en TODA FK — Postgres no los crea solo).
create index sales_voided_by_idx        on public.sales (voided_by) where voided_by is not null;
create index products_category_fk_idx   on public.products (category_id) where category_id is not null;

-- =============================================================================
-- 5. Ledgers append-only  (patrón credit_ledger de StudioFlow)
-- =============================================================================

-- Movimientos de stock. La VERDAD del stock. Sin update ni delete: sólo asientos.
create table public.stock_ledger (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  delta      numeric(12,3) not null check (delta <> 0),
  reason     text not null check (reason in ('sale', 'purchase', 'adjust', 'waste', 'return', 'initial')),
  sale_id    uuid references public.sales(id) on delete set null,
  unit_cost  numeric(12,2) check (unit_cost >= 0),
  note       text,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

create index stock_ledger_product_idx on public.stock_ledger (product_id, created_at desc);
create index stock_ledger_store_idx   on public.stock_ledger (store_id, created_at desc);
create index stock_ledger_sale_idx    on public.stock_ledger (sale_id) where sale_id is not null;
create index stock_ledger_author_idx  on public.stock_ledger (created_by) where created_by is not null;

-- Cuenta corriente del fiado. Negativo = debe; positivo = pago.
create table public.client_ledger (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  delta          numeric(12,2) not null check (delta <> 0),
  reason         text not null check (reason in ('sale', 'payment', 'adjust')),
  sale_id        uuid references public.sales(id) on delete set null,
  payment_method text check (payment_method in ('cash', 'qr', 'card', 'transfer')),
  note           text,
  created_by     uuid references public.members(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index client_ledger_client_idx on public.client_ledger (client_id, created_at desc);
create index client_ledger_store_idx  on public.client_ledger (store_id, created_at desc);
create index client_ledger_author_idx on public.client_ledger (created_by) where created_by is not null;

-- =============================================================================
-- 6. Vencimientos (informativos, SIN gestión de lotes)
-- =============================================================================

-- Se carga opcionalmente al ingresar mercadería. Alimenta las alertas.
-- Cero fricción si no se carga; valor completo si se carga (business-rules §5).
create table public.stock_expiries (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  expiry_date date not null,
  qty         numeric(12,3) not null check (qty > 0),
  note        text,
  resolved_at timestamptz,
  resolution  text check (resolution in ('sold', 'wasted')),
  created_by  uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index stock_expiries_pending_idx on public.stock_expiries (store_id, expiry_date)
  where resolved_at is null;
create index stock_expiries_product_idx on public.stock_expiries (product_id);

-- =============================================================================
-- 7. Notificaciones y Web Push
-- =============================================================================

-- `dedupe_key` evita el spam diario ("stock-bajo:<product_id>:<fecha>").
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  member_id  uuid references public.members(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  url        text,
  dedupe_key text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create unique index notifications_dedupe_uq on public.notifications (store_id, dedupe_key)
  where dedupe_key is not null;
create index notifications_unread_idx on public.notifications (store_id, member_id, created_at desc)
  where read_at is null;

-- Suscripciones Web Push, por member + device. StudioFlow no tuvo esto hasta muy tarde.
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  failed_count int not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index push_subscriptions_member_idx on public.push_subscriptions (member_id);
create index push_subscriptions_store_idx  on public.push_subscriptions (store_id);

-- =============================================================================
-- 8. Rate limiting  (baseline, desde el día 1)
-- =============================================================================

create table public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 1
);

-- Contador de ventana fija en Postgres: cero servicios nuevos y funciona igual en
-- serverless (un contador en memoria muere con cada instancia).
-- true = permitido (y cuenta el intento); false = frenado.
-- El FAIL-OPEN vive en la capa app (src/lib/rate-limit.ts): si esto no responde,
-- se deja pasar. Un rate limiter caído no puede tirar abajo la caja de un kiosco.
-- NOTA: el `as rl` no es cosmético — Postgres no acepta referencias calificadas por
-- esquema dentro de ON CONFLICT DO UPDATE.
create or replace function public.check_rate_limit(
  p_key            text,
  p_max            integer,
  p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limits;
begin
  -- higiene oportunista: barrer ventanas viejas de vez en cuando (la tabla queda chica)
  if random() < 0.02 then
    delete from public.rate_limits where window_start < v_now - interval '1 day';
  end if;

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count        = case when rl.window_start < v_now - make_interval(secs => p_window_seconds)
                            then 1 else rl.count + 1 end,
        window_start = case when rl.window_start < v_now - make_interval(secs => p_window_seconds)
                            then v_now else rl.window_start end
  returning * into v_row;

  return v_row.count <= p_max;
end $$;

-- SOLO service_role. Se invoca server-side desde src/lib/rate-limit.ts.
-- Si se expusiera a anon/authenticated, el caller controla `p_key` y la ventana:
-- podría resetear su propio contador (bypass del freno anti fuerza-bruta) o inflar
-- el de otra persona para dejarla afuera. StudioFlow 033 tiene ese grant de más.
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant  execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- =============================================================================
-- 9. Triggers
-- =============================================================================

-- `updated_at` genérico.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stores_touch    before update on public.stores         for each row execute function public.touch_updated_at();
create trigger members_touch   before update on public.members        for each row execute function public.touch_updated_at();
create trigger products_touch  before update on public.products       for each row execute function public.touch_updated_at();
create trigger clients_touch   before update on public.clients        for each row execute function public.touch_updated_at();
create trigger settings_touch  before update on public.store_settings for each row execute function public.touch_updated_at();

-- Todo negocio nace con su fila de settings: sin ella se perderían las alertas
-- de stock bajo en silencio.
create or replace function public.create_default_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.store_settings (store_id) values (new.id)
  on conflict (store_id) do nothing;
  return new;
end;
$$;

create trigger stores_default_settings after insert on public.stores
  for each row execute function public.create_default_settings();

-- Cache de stock: ÚNICA vía de escritura de products.stock.
create or replace function public.apply_stock_delta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.products
     set stock = stock + new.delta
   where id = new.product_id;
  return new;
end;
$$;

create trigger stock_ledger_apply after insert on public.stock_ledger
  for each row execute function public.apply_stock_delta();

-- Alta de usuario → profile (StudioFlow lo agregó recién en su 004).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 10. Vistas derivadas
--
-- `security_invoker = true` NO ES OPCIONAL. Por default una vista de Postgres corre
-- con los permisos de su CREADOR (postgres, que bypassa RLS) → cualquier usuario
-- logueado vería los saldos de fiado y la facturación de TODOS los negocios.
-- StudioFlow tuvo que parchear exactamente esto en su 007; acá nace bien.
-- Requiere PG15+ (todo proyecto nuevo de Supabase lo es).
-- =============================================================================

-- Saldo de fiado por cliente. Derivado, NUNCA un contador mutable.
create view public.client_balances with (security_invoker = true) as
  select c.id as client_id,
         c.store_id,
         c.name,
         c.credit_limit,
         coalesce(sum(l.delta), 0)::numeric(12,2) as balance
    from public.clients c
    left join public.client_ledger l on l.client_id = c.id
   group by c.id, c.store_id, c.name, c.credit_limit;

-- Cierre de caja DERIVADO (sin tabla de arqueo en MVP, business-rules §7).
-- El día se corta en la timezone DEL NEGOCIO, no en una fija: un local en otra
-- provincia agruparía mal su cierre.
create view public.daily_totals with (security_invoker = true) as
  select s.store_id,
         (s.sold_at at time zone st.timezone)::date as day,
         s.payment_method,
         count(*)                  as sales_count,
         sum(s.total)::numeric(12,2) as total,
         sum(case when s.payment_method = 'account' then s.total else 0 end)::numeric(12,2)
           as fiado_otorgado
    from public.sales s
    join public.stores st on st.id = s.store_id
   where s.status = 'completed'
   group by s.store_id, day, s.payment_method;

-- Productos en o bajo su umbral (umbral propio, o el default del negocio).
-- LEFT JOIN a propósito: si a un negocio le falta la fila de settings, no puede
-- perder TODAS sus alertas en silencio — cae al default duro.
create view public.low_stock_products with (security_invoker = true) as
  select p.id, p.store_id, p.name, p.emoji, p.stock,
         coalesce(p.low_stock_threshold, s.low_stock_threshold_default, 3) as threshold
    from public.products p
    left join public.store_settings s on s.store_id = p.store_id
   where p.status = 'active'
     and p.stock <= coalesce(p.low_stock_threshold, s.low_stock_threshold_default, 3);

-- =============================================================================
-- 11. Append-only duro: revocar UPDATE/DELETE en los ledgers
--     (las policies de 002 tampoco los permiten; esto es el cinturón además del tirante)
-- =============================================================================

revoke update, delete on public.stock_ledger  from authenticated, anon;
revoke update, delete on public.client_ledger from authenticated, anon;
revoke update, delete on public.sale_items    from authenticated, anon;

-- `products.stock` es un CACHE del ledger: si se pudiera escribir a mano, un
-- `update products set stock = 99` lo desincronizaría para siempre. Privilegio por
-- columna: el dueño edita el producto, pero el stock lo mueve SOLO el trigger
-- (que es SECURITY DEFINER y no pasa por estos grants).
revoke update on public.products from authenticated, anon;
grant  update (name, emoji, color, category_id, cost, price, low_stock_threshold,
               sale_unit, attrs, status, price_updated_at)
  on public.products to authenticated;
