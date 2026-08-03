-- =============================================================================
-- StockFlow — tests de CAPTURA ORGÁNICA (F1a · PR A, migración 037)
--
-- Contexto (docs/onboarding-catalogo-plan.md §H): el kiosco cero-datos onboardea
-- VENDIENDO. Cada scan-miss en la caja da de alta el producto. Para que eso no
-- ensucie los datos:
--
--   · el alta tiene que poder dejar el asiento inicial CON su costo (hoy
--     `initial` lo omitía → la compra era invisible para el radar de costos);
--   · un producto dado de alta SIN contar la góndola nace `stock_confiable=false`
--     (sus alertas de stock mentirían: stock 0 → negativo);
--   · los productos que YA EXISTEN quedan `stock_confiable=true` (condición dura:
--     ningún negocio real pierde alertas que hoy recibe);
--   · un producto gradúa SOLO cuando le llega un asiento de stock real.
--
-- Transaccionales con ROLLBACK. Impersonan al dueño del fixture.
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-captura-organica.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\set DUENO 'aaaaaaaa-0000-0000-0000-000000000001'
\set CAJERO 'aaaaaaaa-0000-0000-0000-000000000002'

\echo ''
\echo '=== StockFlow — tests de captura orgánica (F1a · PR A) ==='

-- ---------------------------------------------------------------------------
-- 1 · Alta rápida SIN contar: producto vendible, pero declarado NO confiable.
--     Es el caso del mostrador: hay un cliente esperando, nadie cuenta la góndola.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store constant uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
  v_id    uuid;
  v_prod  public.products;
  v_asientos int;
begin
  v_res := public.crear_producto_rapido(
    p_store_id => v_store,
    p_nombre   => 'Producto organico sin contar',
    p_precio   => 1500,
    p_costo    => 900,
    p_barcode  => '7791111000001',
    p_category_id => null,
    p_cantidad => null
  );

  if (v_res->>'existing')::boolean is not false then
    raise exception 'FALLA 1: debería ser un alta nueva, no un existente';
  end if;

  v_id := (v_res->>'id')::uuid;
  select * into v_prod from public.products where id = v_id;

  if v_prod.stock is distinct from 0 then
    raise exception 'FALLA 1: sin contar, el stock arranca en 0 (dio %)', v_prod.stock;
  end if;
  if v_prod.cost is distinct from 900 then
    raise exception 'FALLA 1: el costo dictado en la caja tiene que quedar guardado (dio %)', v_prod.cost;
  end if;
  if v_prod.stock_confiable is not false then
    raise exception 'FALLA 1: sin baseline de góndola el producto NO puede nacer confiable';
  end if;

  select count(*) into v_asientos from public.stock_ledger where product_id = v_id;
  if v_asientos <> 0 then
    raise exception 'FALLA 1: sin cantidad no se inventa ningún asiento (hubo %)', v_asientos;
  end if;

  -- El código queda vinculado: es lo que hace que el próximo escaneo lo encuentre.
  if not exists (select 1 from public.product_barcodes
                  where product_id = v_id and barcode = '7791111000001') then
    raise exception 'FALLA 1: el código escaneado no quedó vinculado al producto';
  end if;

  raise notice 'OK  1. Alta sin contar: vendible, con costo, stock 0 y NO confiable';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2 · Alta rápida CONTANDO: asiento inicial CON unit_cost + producto confiable.
--     El asiento con costo es lo que hace visible la compra en el radar de costos.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store constant uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
  v_id    uuid;
  v_prod  public.products;
  v_asiento public.stock_ledger;
begin
  v_res := public.crear_producto_rapido(
    p_store_id => v_store,
    p_nombre   => 'Producto organico contado',
    p_precio   => 2000,
    p_costo    => 1200,
    p_barcode  => '7791111000002',
    p_category_id => null,
    p_cantidad => 12
  );
  v_id := (v_res->>'id')::uuid;

  select * into v_prod from public.products where id = v_id;
  if v_prod.stock is distinct from 12 then
    raise exception 'FALLA 2: el stock contado tiene que quedar en la ficha (dio %)', v_prod.stock;
  end if;
  if v_prod.stock_confiable is not true then
    raise exception 'FALLA 2: contar la góndola ES el baseline: el producto tiene que quedar confiable';
  end if;

  select * into v_asiento from public.stock_ledger where product_id = v_id;
  if not found then
    raise exception 'FALLA 2: contar tiene que dejar asiento en el ledger';
  end if;
  if v_asiento.reason is distinct from 'initial' then
    raise exception 'FALLA 2: el asiento tiene que ser initial (dio %)', v_asiento.reason;
  end if;
  if v_asiento.delta is distinct from 12 then
    raise exception 'FALLA 2: el asiento tiene que llevar la cantidad contada (dio %)', v_asiento.delta;
  end if;
  -- EL fix: antes `initial` guardaba unit_cost NULL y la compra no existía para
  -- el radar de costos ni para "comprado" en reportes.
  if v_asiento.unit_cost is distinct from 1200 then
    raise exception 'FALLA 2: el asiento initial tiene que congelar el unit_cost (dio %)', v_asiento.unit_cost;
  end if;

  raise notice 'OK  2. Alta contando: asiento initial CON unit_cost y producto confiable';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3 · CONDICIÓN DURA: los productos que ya existían son confiables.
--     Ningún negocio real puede perder, por esta migración, una alerta que hoy recibe.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_no_confiables int;
begin
  select count(*) into v_no_confiables
    from public.products
   where stock_confiable = false
     and store_id in ('11111111-1111-1111-1111-111111111111',
                      '22222222-2222-2222-2222-222222222222');
  if v_no_confiables <> 0 then
    raise exception 'FALLA 3: la migración dejó % productos preexistentes como NO confiables', v_no_confiables;
  end if;
  raise notice 'OK  3. Productos preexistentes: todos confiables (no se pierde ninguna alerta)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4 · Graduación: SOLO cuando alguien miró la góndola.
--     Recibir mercadería NO alcanza — es un delta sobre una base desconocida y
--     el corrimiento queda para siempre (docs §H.5). Contar/ajustar, sí.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store constant uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
  v_id    uuid;
  v_conf  boolean;
begin
  v_res := public.crear_producto_rapido(
    p_store_id => v_store,
    p_nombre   => 'Producto que va a graduarse',
    p_precio   => 800,
    p_costo    => null,
    p_barcode  => null,
    p_category_id => null,
    p_cantidad => null
  );
  v_id := (v_res->>'id')::uuid;

  select stock_confiable into v_conf from public.products where id = v_id;
  if v_conf is not false then
    raise exception 'FALLA 4: precondición — tenía que nacer no confiable';
  end if;

  -- Le llega mercadería: sube el stock, pero NADIE contó la góndola.
  perform public.register_purchase(
    v_store,
    jsonb_build_array(jsonb_build_object('product_id', v_id, 'qty', 6, 'unit_cost', 500))
  );

  select stock_confiable into v_conf from public.products where id = v_id;
  if v_conf is not false then
    raise exception 'FALLA 4: un ingreso es un DELTA sobre una base desconocida — no puede graduar solo';
  end if;

  -- Ahora sí: alguien contó y corrigió el stock.
  perform public.adjust_stock(v_store, v_id, 3, 'adjust', 'conteo de góndola');

  select stock_confiable into v_conf from public.products where id = v_id;
  if v_conf is not true then
    raise exception 'FALLA 4: contar/ajustar SÍ tiene que graduar el producto';
  end if;

  raise notice 'OK  4. Gradúa el conteo, no el ingreso (el delta no crea baseline)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4b · El alta sella price_updated_at: sin esto todo el catálogo orgánico nacía
--      marcado "precio viejo" en la salud de datos.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_res jsonb;
  v_ts  timestamptz;
begin
  v_res := public.crear_producto_rapido(
    p_store_id => '11111111-1111-1111-1111-111111111111',
    p_nombre => 'Producto con precio fresco', p_precio => 500,
    p_costo => null, p_barcode => null, p_category_id => null, p_cantidad => null);

  select price_updated_at into v_ts from public.products where id = (v_res->>'id')::uuid;
  if v_ts is null then
    raise exception 'FALLA 4b: el alta tiene que sellar price_updated_at';
  end if;
  raise notice 'OK  4b. El alta sella price_updated_at (no nace con "precio viejo")';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 5 · Dedup: el código ya existe → devuelve ESE producto, no crea otro.
--     (La clase RIESGO 0: duplicados con stock 0 que parten el inventario.)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store constant uuid := '11111111-1111-1111-1111-111111111111';
  v_coca  constant uuid := 'd1000000-0000-0000-0000-000000000001';
  v_code  text;
  v_res   jsonb;
  v_antes int;
  v_despues int;
begin
  select barcode into v_code from public.product_barcodes where product_id = v_coca limit 1;
  if v_code is null then
    raise exception 'SETUP: el fixture no tiene código para la Coca';
  end if;
  select count(*) into v_antes from public.products where store_id = v_store;

  v_res := public.crear_producto_rapido(
    p_store_id => v_store,
    p_nombre   => 'Coca trucha duplicada',
    p_precio   => 9999,
    p_costo    => null,
    p_barcode  => v_code,
    p_category_id => null,
    p_cantidad => null
  );

  if (v_res->>'existing')::boolean is not true then
    raise exception 'FALLA 5: tenía que devolver el producto existente';
  end if;
  if (v_res->>'id')::uuid is distinct from v_coca then
    raise exception 'FALLA 5: devolvió otro producto (%)', v_res->>'id';
  end if;

  select count(*) into v_despues from public.products where store_id = v_store;
  if v_despues <> v_antes then
    raise exception 'FALLA 5: creó un duplicado igual (% → %)', v_antes, v_despues;
  end if;

  raise notice 'OK  5. Código existente: devuelve el producto real, no duplica';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 6 · Permisos: el cajero CON can_receive_stock puede dar de alta (es el modelo
--     orgánico: quien atiende no siempre es el dueño). Un ajeno, no.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'CAJERO', true);
do $$
declare
  v_store constant uuid := '11111111-1111-1111-1111-111111111111';
  v_puede boolean;
  v_res   jsonb;
begin
  select can_receive_stock into v_puede from public.members
   where profile_id = 'aaaaaaaa-0000-0000-0000-000000000002' and store_id = v_store;
  if v_puede is not true then
    raise notice 'SKIP 6: el cajero del fixture no tiene can_receive_stock';
    return;
  end if;

  v_res := public.crear_producto_rapido(
    p_store_id => v_store,
    p_nombre   => 'Alta hecha por la cajera',
    p_precio   => 700,
    p_costo    => null,
    p_barcode  => null,
    p_category_id => null,
    p_cantidad => null
  );
  if (v_res->>'id') is null then
    raise exception 'FALLA 6: la cajera con permiso tiene que poder dar de alta';
  end if;
  raise notice 'OK  6. La cajera con can_receive_stock da de alta (modelo orgánico)';
end $$;
rollback;

begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ff', true);
do $$
declare
  v_store constant uuid := '11111111-1111-1111-1111-111111111111';
begin
  begin
    perform public.crear_producto_rapido(
      p_store_id => v_store, p_nombre => 'Intruso', p_precio => 1,
      p_costo => null, p_barcode => null, p_category_id => null, p_cantidad => null);
    raise exception 'FALLA 6b: un ajeno pudo dar de alta en un negocio que no es suyo';
  exception
    when sqlstate 'P0001' then
      if sqlerrm not in ('not_a_member', 'not_allowed') then
        raise exception 'FALLA 6b: error inesperado: %', sqlerrm;
      end if;
  end;
  raise notice 'OK  6b. Un ajeno no puede dar de alta (gate de membresía)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 7 · Margen global: el ajuste existe, tiene default y no se confunde con
--     min_margin_pct (que es el umbral de EROSIÓN, otra cosa).
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_margen numeric;
  v_min    numeric;
begin
  select margen_default_pct, min_margin_pct into v_margen, v_min
    from public.store_settings
   where store_id = '11111111-1111-1111-1111-111111111111';

  if v_margen is null then
    raise exception 'FALLA 7: falta margen_default_pct en store_settings';
  end if;
  if v_margen <= 0 or v_margen >= 100 then
    raise exception 'FALLA 7: el margen default quedó fuera de rango (%)', v_margen;
  end if;
  if v_min is null then
    raise exception 'FALLA 7: min_margin_pct desapareció (son ajustes distintos)';
  end if;

  raise notice 'OK  7. margen_default_pct % convive con min_margin_pct % (umbral de erosión)', v_margen, v_min;
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 8 · `adjust_stock` con reason 'initial' congela el costo; 'adjust' no inventa
--     ninguno. (El fix del asiento sin costo aplica también al alta del panel.)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store constant uuid := '11111111-1111-1111-1111-111111111111';
  v_id    uuid;
  v_costo numeric;
begin
  insert into public.products (store_id, name, price, cost, emoji)
  values (v_store, 'Producto del panel con costo', 1000, 640, '📦')
  returning id into v_id;

  perform public.adjust_stock(v_store, v_id, 5, 'initial', 'carga inicial', 640);
  select unit_cost into v_costo from public.stock_ledger
   where product_id = v_id and reason = 'initial';
  if v_costo is distinct from 640 then
    raise exception 'FALLA 8: initial tiene que guardar el unit_cost (dio %)', v_costo;
  end if;

  perform public.adjust_stock(v_store, v_id, 2, 'adjust', 'conteo');
  select unit_cost into v_costo from public.stock_ledger
   where product_id = v_id and reason = 'adjust';
  if v_costo is not null then
    raise exception 'FALLA 8: un ajuste no compra nada: unit_cost tiene que ser null (dio %)', v_costo;
  end if;

  raise notice 'OK  8. adjust_stock: initial congela costo, adjust no inventa ninguno';
end $$;
rollback;

\echo '=== captura orgánica: OK ==='
\echo ''
