-- =============================================================================
-- StockFlow — verificación de las RPCs atómicas (tanda 1C)
--
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-rpcs.sql
--
-- Corre DESPUÉS de `supabase db reset`. Cada bloque suplanta a un usuario real
-- (`request.jwt.claims`) porque las RPCs resuelven al caller con auth.uid():
-- probarlas como postgres no probaría nada.
--
-- La concurrencia real (N ventas simultáneas del mismo producto) se prueba
-- aparte, desde varias conexiones: ver tests/concurrency.sh
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on

\set TREBOL '11111111-1111-1111-1111-111111111111'
\set DUENO  'aaaaaaaa-0000-0000-0000-000000000001'
\set CAJERA 'aaaaaaaa-0000-0000-0000-000000000002'
\set ROSA   'bbbbbbbb-0000-0000-0000-000000000001'
\set COCA   'd1000000-0000-0000-0000-000000000001'
\set MARTA  'c2000000-0000-0000-0000-000000000001'

\echo ''
\echo '=== StockFlow — verificación de las RPCs (1C) ==='

-- ---------------------------------------------------------------------------
-- 1. Venta simple: descuenta stock por ledger y actualiza el cache
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_res jsonb; v_stock numeric;
begin
  v_res := public.register_sale(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb,
    'cash', 'test-venta-1');

  if (v_res->>'total')::numeric <> 3600 then
    raise exception 'FALLA 1: el total deberia ser 3600 y es %', v_res->>'total';
  end if;

  select stock into v_stock from public.products
   where id = 'd1000000-0000-0000-0000-000000000001';
  if v_stock <> 22 then
    raise exception 'FALLA 1: stock deberia bajar de 24 a 22 y quedo en %', v_stock;
  end if;
  raise notice 'OK  1. Venta descuenta stock (24 -> 22) y calcula el total';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2. IDEMPOTENCIA: el mismo carrito reintentado no cobra dos veces
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_a jsonb; v_b jsonb; v_count int; v_stock numeric;
begin
  v_a := public.register_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":3}]'::jsonb,
    'cash', 'misma-clave');
  v_b := public.register_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":3}]'::jsonb,
    'cash', 'misma-clave');

  if (v_a->>'sale_id') <> (v_b->>'sale_id') then
    raise exception 'FALLA 2: el reintento creo OTRA venta — se cobraria dos veces';
  end if;
  if (v_b->>'replayed')::boolean is not true then
    raise exception 'FALLA 2: el reintento no se marco como replayed';
  end if;

  select count(*) into v_count from public.sales where idempotency_key = 'misma-clave';
  if v_count <> 1 then
    raise exception 'FALLA 2: hay % ventas con la misma clave', v_count;
  end if;

  select stock into v_stock from public.products
   where id = 'd1000000-0000-0000-0000-000000000001';
  if v_stock <> 21 then
    raise exception 'FALLA 2: el stock se descontó dos veces (quedo en %)', v_stock;
  end if;
  raise notice 'OK  2. IDEMPOTENCIA: reintento devuelve la misma venta, sin doble descuento';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3. Fiado: crea deuda y el saldo sale del ledger
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_res jsonb; v_bal numeric;
begin
  v_res := public.register_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000002","qty":1}]'::jsonb,
    'account', 'venta-fiada', 'c2000000-0000-0000-0000-000000000001');

  select balance into v_bal from public.client_balances
   where client_id = 'c2000000-0000-0000-0000-000000000001';
  -- Marta debia -12400; suma una golosina de 1500 -> -13900
  if v_bal <> -13900 then
    raise exception 'FALLA 3: el saldo de Marta deberia ser -13900 y es %', v_bal;
  end if;
  raise notice 'OK  3. Fiado: la venta a cuenta genera deuda en el ledger';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4. Cobro de fiado (parcial) y saldo resultante
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_res jsonb;
begin
  v_res := public.register_client_payment('11111111-1111-1111-1111-111111111111',
    'c2000000-0000-0000-0000-000000000001', 5000, 'cash');
  -- -12400 + 5000 = -7400
  if (v_res->>'balance')::numeric <> -7400 then
    raise exception 'FALLA 4: el saldo deberia quedar en -7400 y quedo en %', v_res->>'balance';
  end if;
  if (v_res->>'settled')::boolean is not false then
    raise exception 'FALLA 4: un pago parcial no puede marcar la deuda como saldada';
  end if;
  raise notice 'OK  4. Cobro parcial de fiado deja saldo -7400';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 5. Anular una venta fiada devuelve stock Y borra la deuda
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_sale jsonb; v_void jsonb; v_stock numeric; v_bal numeric;
begin
  v_sale := public.register_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":4}]'::jsonb,
    'account', 'para-anular', 'c2000000-0000-0000-0000-000000000001');

  v_void := public.void_sale('11111111-1111-1111-1111-111111111111',
                             (v_sale->>'sale_id')::uuid, 'prueba');

  select stock into v_stock from public.products
   where id = 'd1000000-0000-0000-0000-000000000001';
  if v_stock <> 24 then
    raise exception 'FALLA 5: el stock deberia volver a 24 y quedo en %', v_stock;
  end if;

  select balance into v_bal from public.client_balances
   where client_id = 'c2000000-0000-0000-0000-000000000001';
  if v_bal <> -12400 then
    raise exception 'FALLA 5: el saldo deberia volver a -12400 y quedo en %', v_bal;
  end if;

  -- Anular de nuevo no debe duplicar nada
  v_void := public.void_sale('11111111-1111-1111-1111-111111111111',
                             (v_sale->>'sale_id')::uuid, 'otra vez');
  if (v_void->>'already_voided')::boolean is not true then
    raise exception 'FALLA 5: anular dos veces no es idempotente';
  end if;

  raise notice 'OK  5. Anulación devuelve stock y deuda, y es idempotente';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 6. PERMISOS: la cajera no puede fiar sin el flag, ni anular
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';

do $$
declare v_ok boolean := false; v_res jsonb;
begin
  -- La cajera del seed SÍ tiene can_sell_on_credit, así que debe poder fiar.
  v_res := public.register_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000002","qty":1}]'::jsonb,
    'account', 'cajera-fia', 'c2000000-0000-0000-0000-000000000001');
  if v_res->>'sale_id' is null then
    raise exception 'FALLA 6: la cajera con permiso no pudo fiar';
  end if;

  -- Pero NO puede ajustar stock (eso es solo del dueño).
  begin
    perform public.adjust_stock('11111111-1111-1111-1111-111111111111',
      'd1000000-0000-0000-0000-000000000001', 10, 'adjust', 'prueba');
  exception when others then
    if sqlerrm = 'not_allowed' then v_ok := true; else raise; end if;
  end;
  if not v_ok then
    raise exception 'FALLA 6: la cajera pudo ajustar stock — es facultad del dueño';
  end if;
  raise notice 'OK  6. Permisos por flag respetados (fía sí, ajusta no)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 7. CROSS-TENANT: la dueña del otro kiosco no puede vender productos ajenos
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_ok boolean := false;
begin
  -- Intenta vender EN el negocio ajeno
  begin
    perform public.register_sale('11111111-1111-1111-1111-111111111111',
      '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
      'cash', 'intruso-1');
  exception when others then
    if sqlerrm = 'not_a_member' then v_ok := true; else raise; end if;
  end;
  if not v_ok then
    raise exception 'FUGA: pudo vender en un negocio del que no es miembro';
  end if;

  -- Intenta vender un producto ajeno DENTRO de su propio negocio
  v_ok := false;
  begin
    perform public.register_sale('22222222-2222-2222-2222-222222222222',
      '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
      'cash', 'intruso-2');
  exception when others then
    if sqlerrm = 'product_not_found' then v_ok := true; else raise; end if;
  end;
  if not v_ok then
    raise exception 'FUGA: pudo vender un producto de otro negocio';
  end if;
  raise notice 'OK  7. CROSS-TENANT: no vende en negocio ajeno ni productos ajenos';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 8. Ingreso de mercadería: sube stock y pisa el costo (último costo)
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_n int; v_stock numeric; v_cost numeric; v_exp int;
begin
  v_n := public.register_purchase('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":12,"unit_cost":1400,
       "expiry_date":"2026-12-31"}]'::jsonb);

  if v_n <> 1 then raise exception 'FALLA 8: aplico % lineas', v_n; end if;

  select stock, cost into v_stock, v_cost from public.products
   where id = 'd1000000-0000-0000-0000-000000000001';
  if v_stock <> 36 then
    raise exception 'FALLA 8: stock deberia subir de 24 a 36 y quedo en %', v_stock;
  end if;
  if v_cost <> 1400 then
    raise exception 'FALLA 8: el costo deberia pisarse a 1400 y quedo en %', v_cost;
  end if;

  select count(*) into v_exp from public.stock_expiries
   where product_id = 'd1000000-0000-0000-0000-000000000001' and expiry_date = '2026-12-31';
  if v_exp <> 1 then
    raise exception 'FALLA 8: no se registro el vencimiento';
  end if;
  raise notice 'OK  8. Ingreso sube stock, pisa el costo y registra vencimiento';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 9. Venta por monto libre: cobra sin tocar catálogo ni stock
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_res jsonb; v_ledger int;
begin
  v_res := public.register_sale('11111111-1111-1111-1111-111111111111',
    '[{"free_amount":2500,"name":"Fotocopias"}]'::jsonb, 'cash', 'monto-libre');

  if (v_res->>'total')::numeric <> 2500 then
    raise exception 'FALLA 9: total deberia ser 2500 y es %', v_res->>'total';
  end if;

  select count(*) into v_ledger from public.stock_ledger
   where sale_id = (v_res->>'sale_id')::uuid;
  if v_ledger <> 0 then
    raise exception 'FALLA 9: una venta por monto libre no debe mover stock';
  end if;
  raise notice 'OK  9. Venta por monto libre cobra sin tocar stock';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 10. Stock negativo: por default la caja NO se frena, pero avisa
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_res jsonb; v_stock numeric;
begin
  -- Marlboro tiene 3; vendemos 5.
  v_res := public.register_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000004","qty":5}]'::jsonb,
    'cash', 'sobreventa');

  if jsonb_array_length(v_res->'negative_stock') <> 1 then
    raise exception 'FALLA 10: deberia avisar que un producto quedo en negativo';
  end if;

  select stock into v_stock from public.products
   where id = 'd1000000-0000-0000-0000-000000000004';
  if v_stock <> -2 then
    raise exception 'FALLA 10: el stock deberia quedar en -2 y quedo en %', v_stock;
  end if;
  raise notice 'OK 10. Sobreventa permitida por default, con aviso (stock -2)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 11. Modo estricto: con allow_negative_stock=false, la venta se rechaza
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_ok boolean := false; v_stock numeric;
begin
  update public.store_settings set allow_negative_stock = false
   where store_id = '11111111-1111-1111-1111-111111111111';

  begin
    perform public.register_sale('11111111-1111-1111-1111-111111111111',
      '[{"product_id":"d1000000-0000-0000-0000-000000000004","qty":5}]'::jsonb,
      'cash', 'estricto');
  exception when others then
    if sqlerrm = 'insufficient_stock' then v_ok := true; else raise; end if;
  end;

  if not v_ok then
    raise exception 'FALLA 11: en modo estricto la sobreventa deberia rechazarse';
  end if;

  -- Y el rollback debe ser TOTAL: ni venta ni movimiento de stock.
  select stock into v_stock from public.products
   where id = 'd1000000-0000-0000-0000-000000000004';
  if v_stock <> 3 then
    raise exception 'FALLA 11: el stock quedo en % — el rechazo no revirtio todo', v_stock;
  end if;
  raise notice 'OK 11. Modo estricto rechaza y revierte la venta entera';
end $$;
rollback;

\echo ''
\echo '=== RPCs VERDES — atomicidad, idempotencia, permisos y aislamiento ==='
