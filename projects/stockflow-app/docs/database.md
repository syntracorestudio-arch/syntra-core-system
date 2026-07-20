# StockFlow — Diseño de base de datos (lógico)

> **Estado:** Fase 0 · Diseño lógico sin SQL. El SQL vive en `supabase/migrations/`
> (tanda 1B en adelante) y lo aplica el owner en el SQL Editor. Convenciones
> heredadas de StudioFlow: uuid PK, `store_id` en toda tabla de negocio, timestamptz
> UTC, dinero `numeric(12,2)`, cantidades `numeric(12,3)`, enums por CHECK,
> migraciones `NNN_*.sql` aditivas.

---

## 1. Identidad y tenancy (clon del patrón StudioFlow 001)

- **stores** — tenant. `name`, `slug` (unique, `^[a-z0-9-]+$`), `timezone` (default
  America/Argentina/Buenos_Aires), `branding jsonb` (accent, logo_url, logo_path,
  subtitle, whatsapp), `status` (active/suspended), `cuit text null` + `fiscal jsonb
  default '{}'` (**hooks AFIP**, sin lógica en MVP).
- **profiles** — 1:1 con `auth.users` (trigger de alta). Sin store_id.
  `is_superadmin bool default false` **desde 001** (StudioFlow lo parchó en 019).
- **members** — pertenencia: `store_id` + `profile_id` (unique par), `role` CHECK
  `('owner','staff')`, `status`, y flags de permiso: `can_sell_on_credit`,
  `can_apply_discount`, `can_void_sale`, `can_receive_stock`, `can_see_costs`
  (bool, defaults conservadores). Extensible a más roles sin migración dolorosa.
- **store_settings** — 1:1 con stores: `allow_negative_stock` (default true),
  `low_stock_threshold_default` (default 3), `expiry_warning_days` (default 7),
  `reprice_rounding` (default 50), `updated_at`.

## 2. Catálogo

- **categories** — `name`, `emoji`, `color`, `sort`, `status`.
- **products** — `category_id null`, `name`, `emoji`, `color`, `cost numeric(12,2)
  null` (último costo), `price numeric(12,2)`, `low_stock_threshold int null` (null
  → default del negocio), **`stock numeric(12,3) not null default 0` = cache
  denormalizado mantenido por trigger sobre `stock_ledger`** (análogo a
  `booked_count`; el ledger es la verdad), `sale_unit text default 'unit'` (hook
  granel), `attrs jsonb default '{}'` (hook dietética/pet shop), `status`
  (active/archived), `price_updated_at` (para "precio sin tocar" en F2), timestamps.
- **product_barcodes** — `product_id`, `store_id`, `barcode text`,
  `unique(store_id, barcode)`. N códigos por producto; productos sin código valen;
  códigos internos valen. **Nunca el EAN como PK** (multi-presentación,
  re-etiquetado, prefijos de balanza futuros).

## 3. Movimientos (append-only, patrón credit_ledger)

- **stock_ledger** — `store_id`, `product_id`, `delta numeric(12,3) CHECK (<> 0)`,
  `reason` CHECK `('sale','purchase','adjust','waste','return','initial')`,
  `sale_id null`, `unit_cost numeric null` (en purchase), `note`, `created_by`
  (member), `created_at`. **Solo INSERT**: sin policies de update/delete + REVOKE
  update/delete (patrón credit_ledger). Trigger actualiza `products.stock`.
- **sales** — `store_id`, `member_id` (sold_by), `client_id null`, `total`,
  `payment_method` CHECK `('cash','qr','card','transfer','account')`, `status`
  CHECK `('completed','voided')` + `voided_at`/`void_reason`/`voided_by`,
  **`idempotency_key text` + `unique(store_id, idempotency_key)`**, `sold_at`,
  `fiscal jsonb default '{}'` (hook AFIP), `created_at`.
- **sale_items** — `sale_id`, `store_id`, `product_id null` (on delete set null;
  null también para venta por monto libre), **snapshots**: `product_name`,
  `qty numeric > 0`, `unit_price`, `unit_cost null`, `line_total`.
- **clients** — `store_id`, `name`, `phone null`, `note`, `credit_limit null`,
  `status`.
- **client_ledger** — fiado: `store_id`, `client_id`, `delta numeric(12,2) CHECK
  (<> 0)` (negativo = debe, positivo = pago), `reason` CHECK
  `('sale','payment','adjust')`, `sale_id null`, `payment_method null` (del pago),
  `note`, `created_by`, `created_at`. Solo INSERT + REVOKE, como stock_ledger.
- **stock_expiries** — vencimientos SIN lotes: `store_id`, `product_id`,
  `expiry_date date`, `qty numeric`, `note`, `resolved_at null`,
  `resolution null` CHECK `('sold','wasted')`, `created_by`, `created_at`.
  Informativa: sin FK desde el ledger, sin FEFO.

## 4. Notificaciones y push

- **notifications** — in-app: `store_id`, `member_id null` (null = para todos los
  owner), `type`, `title`, `body`, `url null` (deep-link), `read_at`,
  **`dedupe_key text null` + unique parcial (store_id, dedupe_key)** — anti-spam
  diario ("stock-bajo:‹product_id›:‹fecha›").
- **push_subscriptions** — Web Push real (patrón StudioFlow 029): `store_id`,
  `member_id`, `endpoint text unique`, `p256dh`, `auth`, `user_agent`,
  `last_seen_at`, `failed_count int default 0`. 404/410 al enviar → borrar fila.

## 5. Infraestructura

- **rate_limits** — contador por ventana (patrón StudioFlow 033 + RPC
  `check_rate_limit(key, max, window)` fail-open). **Desde 001**, no como parche.
  Sin policies: solo service_role/RPC.
- (Fase 2) **store_payment_providers**, **payment_attempts**,
  **mp_webhook_events** — clon del circuito MercadoPago de StudioFlow 015–017
  (token AES-256-GCM con `SF_MP_ENC_KEY`, webhook HMAC, idempotencia doble,
  binding monto/tenant).

## 6. Vistas

- **client_balances** — saldo de fiado por cliente = SUM(client_ledger.delta).
- **daily_totals** — cierre derivado: por store + fecha (tz del negocio): total y
  cantidad por payment_method, fiado otorgado, pagos de fiado recibidos.
- **low_stock_products** — products activos con `stock <= coalesce(umbral propio,
  default del negocio)` (sirve dashboard y cron de alertas).

## 7. RLS (patrón StudioFlow 002)

- `enable` + **`force row level security`** en TODAS las tablas.
- Helpers SECURITY DEFINER anti-recursión (search_path fijo):
  `auth_member_stores()`, `auth_has_role(store, roles[])`, `auth_my_member_ids()`.
- **stores**: select member; update owner. **profiles**: propio (+ trigger alta).
  **members**: select tenant; write owner. **store_settings**: select tenant;
  write owner.
- **categories, products, product_barcodes**: select tenant; write owner (+ staff
  con `can_receive_stock` puede insertar producto — alta rápida desde POS — vía
  RPC/action, no policy directa de update de precios).
- **clients**: select tenant; insert/update también staff (crea cliente al fiar).
- **sales, sale_items, stock_ledger, client_ledger**: **select tenant; CERO
  policies de escritura** — toda escritura pasa por RPCs SECURITY DEFINER. Nadie
  inserta un asiento suelto; es la garantía de integridad más fuerte del diseño y
  evita el churn de policies correctivas que StudioFlow sufrió (007).
- **stock_expiries**: select tenant; insert staff con permiso; resolve vía RPC.
- **notifications**: select/update(read_at) del member propio (o owner si
  member_id null). **push_subscriptions**: insert/select/delete propias; envío
  server-side por admin client.
- **rate_limits** (y tablas MP en F2): sin policies — solo service_role.
- Nota asumida: costo/margen se oculta al staff **en UI + guards de página**, no
  por RLS (RLS no oculta columnas). Escapatoria futura documentada: partir tabla
  de costos si un cliente lo exige.

## 8. Índices (en la MISMA migración que las tablas — baseline)

- Lookup POS: `product_barcodes (store_id, barcode)` unique · `products
  (store_id, status)` · `products (store_id, category_id)`.
- Stock bajo: parcial sobre products activos.
- Ledger: `stock_ledger (product_id, created_at)` · `(store_id, created_at)` ·
  `client_ledger (client_id, created_at)` · `(store_id, created_at)`.
- Ventas: `sales (store_id, sold_at desc)` — TODA lista de ventas consulta por
  rango de fecha (cota obligatoria, baseline) · `sale_items (sale_id)` ·
  `sale_items (store_id, product_id)` (top productos).
- Fiado: `clients (store_id, status)`. Vencimientos: `stock_expiries (store_id,
  expiry_date) where resolved_at is null`.
- Notificaciones: parcial por member no-leídas; `push_subscriptions (store_id)`.
- Toda FK nueva con índice (Postgres no los crea solo — baseline).

## 9. Triggers

- `stock_ledger` AFTER INSERT → `products.stock += delta` (la única vía de
  escritura del cache).
- `updated_at` genérico en tablas mutables.
- Alta de usuario (`handle_new_user`) → profiles, clon StudioFlow 004.

## 10. Seed (tanda 1I, patrón StudioFlow)

Dos tenants con UUIDs fijos: **"Kiosco El Trébol"** (demo comercial) y **"Kiosco
B"** (test de aislamiento cross-tenant). ~120 productos con EAN reales argentinos
+ emoji/color por categoría, 30 días de ventas con curva creíble
(`generate_series`, picos fin de semana), costos cargados, 5-6 productos en stock
bajo, 4 vencimientos (2 críticos), 8 clientes de fiado con saldos dispares y pagos
parciales, cierres previos con una diferencia chica. Validaciones sugeridas al pie
(concurrencia de register_sale, idempotencia, aislamiento RLS).
