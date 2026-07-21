-- =============================================================================
-- StockFlow — seed.sql  (tanda 1B: mínimo operable + test de aislamiento)
-- Correr DESPUÉS de 001 y 002, desde el SQL Editor (rol postgres/service_role).
--
-- Dos tenants a propósito:
--   · "Kiosco El Trébol" (1111…) → el que se usa para desarrollar y demostrar.
--   · "Kiosco Doña Rosa" (2222…) → existe SOLO para probar el aislamiento
--     cross-tenant: ningún usuario del Trébol debe ver un solo registro de acá.
--
-- El seed comercial RICO (120 productos con EAN reales, 30 días de ventas,
-- fiado con saldos dispares) llega en la tanda 1I. Esto es el piso para trabajar.
--
-- Contraseña de todos los usuarios demo: stockflow123
-- =============================================================================

-- ---------- Usuarios (workaround GoTrue: los tokens van en '' y no NULL) ----------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'dueno@eltrebol.test',
   extensions.crypt('stockflow123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '',
   '{"provider":"email","providers":["email"]}', '{"full_name":"Mati (dueño)"}'),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'cajero@eltrebol.test',
   extensions.crypt('stockflow123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '',
   '{"provider":"email","providers":["email"]}', '{"full_name":"Luci (cajera)"}'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'duena@donarosa.test',
   extensions.crypt('stockflow123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '',
   '{"provider":"email","providers":["email"]}', '{"full_name":"Rosa (otro negocio)"}')
on conflict (id) do nothing;

-- El trigger handle_new_user ya creó los profiles.

-- ---------- Negocios ----------
insert into public.stores (id, name, slug, branding) values
  ('11111111-1111-1111-1111-111111111111', 'Kiosco El Trébol', 'el-trebol',
   '{"accent":"#2e6bff","subtitle":"Abierto de 8 a 22"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'Kiosco Doña Rosa', 'dona-rosa',
   '{"accent":"#e0603a"}'::jsonb)
on conflict (id) do nothing;

insert into public.store_settings (store_id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222')
on conflict (store_id) do nothing;

-- ---------- Miembros ----------
-- La cajera lleva los permisos típicos de un kiosco: vende, fía y repone,
-- pero NO ve costos ni márgenes (business-rules §6).
insert into public.members (id, store_id, profile_id, role, display_name,
                            can_sell_on_credit, can_receive_stock, can_void_sale, can_see_costs)
values
  ('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', 'owner', 'Mati', true, true, true, true),
  ('aaaa1111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000002', 'staff', 'Luci', true, true, false, false),
  ('bbbb2222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'bbbbbbbb-0000-0000-0000-000000000001', 'owner', 'Rosa', true, true, true, true)
on conflict (id) do nothing;

-- ---------- Categorías (El Trébol) ----------
insert into public.categories (id, store_id, name, emoji, color, sort) values
  ('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bebidas',     '🥤', '#3b82f6', 1),
  ('c1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Golosinas',   '🍫', '#ec4899', 2),
  ('c1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Cigarrillos', '🚬', '#f59e0b', 3),
  ('c1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Almacén',     '📦', '#10b981', 4)
on conflict (id) do nothing;

-- ---------- Productos ----------
-- OJO: `stock` NO se escribe a mano; lo pone el trigger desde stock_ledger.
insert into public.products (id, store_id, category_id, name, emoji, cost, price, low_stock_threshold) values
  ('d1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Coca-Cola 500ml',  '🥤', 1250, 1800, 5),
  ('d1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Agua Villa 1.5L',  '💧',  950, 1500, null),
  ('d1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000002', 'Alfajor Jorgito',  '🍫',  520,  900, null),
  ('d1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000003', 'Marlboro box',     '🚬', 4000, 4500, 4),
  ('d1000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000004', 'Yerba Playadito 1k','🧉', 3900, 5200, null)
on conflict (id) do nothing;

-- Producto del OTRO negocio: si un usuario del Trébol lo ve, la RLS está rota.
insert into public.products (id, store_id, name, emoji, cost, price) values
  ('d2000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Producto de Doña Rosa', '🔒', 100, 200)
on conflict (id) do nothing;

-- ---------- Códigos de barras (EAN reales del mercado argentino) ----------
insert into public.product_barcodes (store_id, product_id, barcode) values
  ('11111111-1111-1111-1111-111111111111', 'd1000000-0000-0000-0000-000000000001', '7790895000997'),
  ('11111111-1111-1111-1111-111111111111', 'd1000000-0000-0000-0000-000000000002', '7790036000123'),
  ('11111111-1111-1111-1111-111111111111', 'd1000000-0000-0000-0000-000000000003', '7790040999015')
on conflict (store_id, barcode) do nothing;

-- ---------- Stock inicial (por ledger, que es la verdad) ----------
-- IDs fijos + on conflict: los ledgers son append-only y con DELETE revocado, así que
-- una segunda corrida del seed duplicaría el stock sin forma limpia de volver atrás.
insert into public.stock_ledger (id, store_id, product_id, delta, reason, unit_cost, created_by) values
  ('e1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'd1000000-0000-0000-0000-000000000001', 24, 'initial', 1250, 'aaaa1111-0000-0000-0000-000000000001'),
  ('e1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'd1000000-0000-0000-0000-000000000002', 30, 'initial',  950, 'aaaa1111-0000-0000-0000-000000000001'),
  ('e1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'd1000000-0000-0000-0000-000000000003', 48, 'initial',  520, 'aaaa1111-0000-0000-0000-000000000001'),
  ('e1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'd1000000-0000-0000-0000-000000000004',  3, 'initial', 4000, 'aaaa1111-0000-0000-0000-000000000001'),
  ('e1000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'd1000000-0000-0000-0000-000000000005',  9, 'initial', 3900, 'aaaa1111-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- Marlboro queda en 3 con umbral 4 → dispara "stock bajo" para probar la alerta.

-- ---------- Vencimiento próximo (para probar la alerta) ----------
insert into public.stock_expiries (id, store_id, product_id, expiry_date, qty, created_by) values
  ('e3000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'd1000000-0000-0000-0000-000000000003',
   (now() + interval '3 days')::date, 6, 'aaaa1111-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- ---------- Clientes de fiado ----------
insert into public.clients (id, store_id, name, phone, credit_limit) values
  ('c2000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Marta G.', '1150001111', 20000),
  ('c2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Ruben P.', '1150002222', null)
on conflict (id) do nothing;

-- Saldo por asientos (nunca un contador): Marta debe 12.400, Ruben debe 5.000.
insert into public.client_ledger (id, store_id, client_id, delta, reason, payment_method, created_by) values
  ('e2000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c2000000-0000-0000-0000-000000000001', -15000, 'sale',    null,   'aaaa1111-0000-0000-0000-000000000001'),
  ('e2000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'c2000000-0000-0000-0000-000000000001',   2600, 'payment', 'cash', 'aaaa1111-0000-0000-0000-000000000001'),
  ('e2000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'c2000000-0000-0000-0000-000000000002',  -5000, 'sale',    null,   'aaaa1111-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- =============================================================================
-- Validaciones después de aplicar (tanda 1B) — CORRER EN ESTE ORDEN
--
-- OJO: el SQL Editor corre como `postgres`, que BYPASSA RLS. Las pruebas 1-3 valen
-- tal cual; las 4-6 (aislamiento y append-only) NO prueban nada si las corrés así:
-- hay que suplantar a un usuario autenticado con `set local role` + su claim de JWT.
-- =============================================================================

-- 0. Requisito de las vistas: security_invoker necesita PG15+.
--      show server_version;

-- 1. Cache de stock (lo mantiene el trigger, no se escribe a mano): 24/30/48/3/9.
--      select name, stock from public.products
--       where store_id = '11111111-1111-1111-1111-111111111111' order by name;

-- 2. Saldos derivados: Marta -12400, Ruben -5000.
--      select name, balance from public.client_balances
--       where store_id = '11111111-1111-1111-1111-111111111111';

-- 3. Stock bajo: SOLO Marlboro del Trébol (3 <= 4).
--      select name, stock, threshold from public.low_stock_products
--       where store_id = '11111111-1111-1111-1111-111111111111';

-- ---------------------------------------------------------------------------
-- 4. AISLAMIENTO CROSS-TENANT — el test que de verdad importa.
--    Suplantamos al dueño de El Trébol dentro de una transacción:
--
--      begin;
--      set local role authenticated;
--      set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
--
--      select count(*) from public.products;   -- 5  (si da 6, la RLS está rota)
--      select count(*) from public.stores;     -- 1
--      select count(*) from public.client_balances;  -- 2 (nunca clientes ajenos)
--      select count(*) from public.low_stock_products; -- 1 (nunca el producto de Rosa)
--
--      rollback;
--
--    Ver "Producto de Doña Rosa" en cualquiera de esas consultas = fuga. No seguir.
--    Las dos últimas prueban específicamente que las vistas quedaron con
--    security_invoker: sin eso devuelven filas de los dos negocios.
-- ---------------------------------------------------------------------------

-- 5. APPEND-ONLY: en la misma transacción suplantada, esto debe FALLAR:
--      update public.stock_ledger  set delta = 999 where true;
--      delete from public.client_ledger where true;

-- 6. CACHE PROTEGIDO: también debe FALLAR (privilegio de columna sobre products):
--      update public.products set stock = 999
--       where id = 'd1000000-0000-0000-0000-000000000001';
--    Pero SÍ debe funcionar editar el resto del producto:
--      update public.products set price = 1900
--       where id = 'd1000000-0000-0000-0000-000000000001';
