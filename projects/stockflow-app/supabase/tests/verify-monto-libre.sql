-- =============================================================================
-- StockFlow — tests de MONTO LIBRE (venta sin producto)
--
-- La válvula de escape del mostrador: cobrar un importe SIN crear un producto.
-- Es lo que evita la patología del RIESGO 0 — un cajero apurado que, si no
-- encuentra algo, termina fabricando un producto basura o duplicado para poder
-- cobrar. La línea libre cierra la venta sin ensuciar el catálogo.
--
-- GARANTÍA que verifican estos tests: la venta se registra por la MISMA maquinaria
-- (register_sale / idempotencia / split), suma al total, NO mueve stock, NO crea
-- productos, y NO contamina las métricas de producto (unidades, margen, rankings,
-- dead_stock) — pero su plata SÍ entra en los totales y en los medios de pago.
--
-- Transaccionales con ROLLBACK. Impersona al dueño.
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-monto-libre.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\set DUENO 'aaaaaaaa-0000-0000-0000-000000000001'

\echo ''
\echo '=== StockFlow — tests de monto libre (venta sin producto) ==='

-- ---------------------------------------------------------------------------
-- 1 · Venta SOLO de monto libre: se registra con el total correcto, NO crea
--     ningún producto y NO genera un solo asiento de stock.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store  uuid := '11111111-1111-1111-1111-111111111111';
  v_prod0  int;
  v_prod1  int;
  v_led0   int;
  v_led1   int;
  v_res    jsonb;
  v_sale   uuid;
  v_lineas int;
begin
  select count(*) into v_prod0 from public.products where store_id = v_store;
  select count(*) into v_led0  from public.stock_ledger where store_id = v_store;

  v_res := public.register_sale(
    p_store_id := v_store,
    p_items := '[{"product_id": null, "qty": 1, "free_amount": 2500, "name": "Fotocopias"}]'::jsonb,
    p_payment_method := 'cash',
    p_idempotency_key := 'ML-SOLO-0001');
  v_sale := (v_res->>'sale_id')::uuid;

  if (v_res->>'total')::numeric is distinct from 2500 then
    raise exception 'FALLA 1: total % (esperado 2500)', v_res->>'total';
  end if;

  -- NO se creó ningún producto.
  select count(*) into v_prod1 from public.products where store_id = v_store;
  if v_prod1 <> v_prod0 then
    raise exception 'FALLA 1: se crearon % productos (la línea libre ensució el catálogo)', v_prod1 - v_prod0;
  end if;

  -- NO se movió stock.
  select count(*) into v_led1 from public.stock_ledger where store_id = v_store;
  if v_led1 <> v_led0 then
    raise exception 'FALLA 1: se generaron % asientos de stock', v_led1 - v_led0;
  end if;

  -- La línea existe, sin producto y sin costo, con su etiqueta.
  select count(*) into v_lineas from public.sale_items
   where sale_id = v_sale and product_id is null
     and product_name = 'Fotocopias' and unit_cost is null and line_total = 2500;
  if v_lineas <> 1 then
    raise exception 'FALLA 1: la línea libre no quedó como corresponde';
  end if;
  raise notice 'OK  1. venta solo monto libre: total correcto, 0 productos, 0 asientos de stock';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2 · Carrito MIXTO (producto + monto libre): total correcto y el stock se mueve
--     SOLO por la línea de producto.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store  uuid := '11111111-1111-1111-1111-111111111111';
  v_pid    uuid := 'd1000000-0000-0000-0000-000000000001';
  v_precio numeric;
  v_stock0 numeric;
  v_stock1 numeric;
  v_res    jsonb;
  v_sale   uuid;
  v_n      int;
begin
  select price, stock into v_precio, v_stock0 from public.products where id = v_pid;

  v_res := public.register_sale(
    p_store_id := v_store,
    p_items := jsonb_build_array(
      jsonb_build_object('product_id', v_pid, 'qty', 2),
      jsonb_build_object('product_id', null, 'qty', 1, 'free_amount', 1800, 'name', 'Cargador')),
    p_payment_method := 'cash',
    p_idempotency_key := 'ML-MIXTO-0001');
  v_sale := (v_res->>'sale_id')::uuid;

  if (v_res->>'total')::numeric is distinct from (v_precio * 2 + 1800) then
    raise exception 'FALLA 2: total % (esperado %)', v_res->>'total', v_precio * 2 + 1800;
  end if;

  -- El stock bajó SOLO por las 2 unidades del producto.
  select stock into v_stock1 from public.products where id = v_pid;
  if v_stock1 is distinct from v_stock0 - 2 then
    raise exception 'FALLA 2: stock % (esperado %)', v_stock1, v_stock0 - 2;
  end if;

  -- Un solo asiento de stock en esta venta (el del producto).
  select count(*) into v_n from public.stock_ledger where sale_id = v_sale;
  if v_n <> 1 then
    raise exception 'FALLA 2: % asientos de stock (esperado 1)', v_n;
  end if;

  -- Dos líneas: una con producto, una sin.
  select count(*) into v_n from public.sale_items where sale_id = v_sale;
  if v_n <> 2 then
    raise exception 'FALLA 2: % líneas (esperado 2)', v_n;
  end if;
  raise notice 'OK  2. carrito mixto: total correcto, el stock se mueve solo por el producto';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3 · Idempotencia: reintentar la MISMA venta con monto libre no duplica nada.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_r1    jsonb;
  v_r2    jsonb;
  v_n     int;
begin
  v_r1 := public.register_sale(
    p_store_id := v_store,
    p_items := '[{"product_id": null, "qty": 1, "free_amount": 900, "name": "Varios"}]'::jsonb,
    p_payment_method := 'cash', p_idempotency_key := 'ML-IDEM-0001');
  v_r2 := public.register_sale(
    p_store_id := v_store,
    p_items := '[{"product_id": null, "qty": 1, "free_amount": 900, "name": "Varios"}]'::jsonb,
    p_payment_method := 'cash', p_idempotency_key := 'ML-IDEM-0001');

  if (v_r1->>'sale_id') is distinct from (v_r2->>'sale_id') then
    raise exception 'FALLA 3: la segunda llamada creó otra venta';
  end if;
  if (v_r2->>'replayed')::boolean is distinct from true then
    raise exception 'FALLA 3: la segunda no vino marcada replayed';
  end if;
  select count(*) into v_n from public.sale_items where sale_id = (v_r1->>'sale_id')::uuid;
  if v_n <> 1 then
    raise exception 'FALLA 3: quedaron % líneas (se duplicó la línea libre)', v_n;
  end if;
  raise notice 'OK  3. idempotente: misma clave → misma venta, sin líneas duplicadas';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4 · SPLIT de un carrito mixto: el reparto se valida contra el total que
--     incluye la línea libre, y cada parte se imputa a su medio.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store  uuid := '11111111-1111-1111-1111-111111111111';
  v_pid    uuid := 'd1000000-0000-0000-0000-000000000001';
  v_precio numeric;
  v_total  numeric;
  v_items  jsonb;
  v_res    jsonb;
  v_sale   uuid;
  v_cash   numeric;
  v_card   numeric;
begin
  select price into v_precio from public.products where id = v_pid;
  v_total := v_precio + 2000;                 -- 1 producto + monto libre
  v_items := jsonb_build_array(
    jsonb_build_object('product_id', v_pid, 'qty', 1),
    jsonb_build_object('product_id', null, 'qty', 1, 'free_amount', 2000, 'name', 'Servicio'));

  v_cash := round(v_total / 2, 2);
  v_card := v_total - v_cash;

  v_res := public.register_split_sale(
    v_store, v_items,
    jsonb_build_array(
      jsonb_build_object('method','cash','amount', v_cash),
      jsonb_build_object('method','card','amount', v_card)),
    'ML-SPLIT-0001');
  v_sale := (v_res->>'sale_id')::uuid;

  if (v_res->>'total')::numeric is distinct from v_total then
    raise exception 'FALLA 4: total del split % (esperado %)', v_res->>'total', v_total;
  end if;
  if (select payment_method from public.sales where id = v_sale) is distinct from 'split' then
    raise exception 'FALLA 4: la venta no quedó split';
  end if;
  if (select coalesce(sum(amount),0) from public.sale_payments where sale_id = v_sale)
     is distinct from v_total then
    raise exception 'FALLA 4: el reparto no suma el total con la línea libre';
  end if;

  -- Un reparto que NO contempla la línea libre tiene que ser rechazado.
  begin
    perform public.register_split_sale(
      v_store, v_items,
      jsonb_build_array(
        jsonb_build_object('method','cash','amount', round(v_precio/2,2)),
        jsonb_build_object('method','card','amount', v_precio - round(v_precio/2,2))),
      'ML-SPLIT-0002');
    raise exception 'FALLA 4: aceptó un reparto que ignora la línea libre';
  exception when others then
    if sqlerrm not like '%split_sum_mismatch%' then raise; end if;
  end;
  raise notice 'OK  4. split de carrito mixto: suma con la línea libre, y rechaza el reparto que la ignora';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 5 · REPORTES: la plata del monto libre entra en los totales y en los medios,
--     pero NO contamina unidades, margen, rankings ni categorías.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store   uuid := '11111111-1111-1111-1111-111111111111';
  v_hoy     date;
  v_tz      text;
  v_r0      jsonb;
  v_r1      jsonb;
  v_vend0   numeric; v_vend1 numeric;
  v_unid0   numeric; v_unid1 numeric;
  v_gan0    numeric; v_gan1  numeric;
  v_top     int;
  v_cierre  jsonb;
  v_ef0     numeric; v_ef1 numeric;
begin
  select coalesce(timezone,'America/Argentina/Buenos_Aires') into v_tz from public.stores where id = v_store;
  v_hoy := (now() at time zone v_tz)::date;

  v_r0 := public.reportes_summary(v_store, v_hoy, v_hoy);
  v_vend0 := (v_r0->'money'->>'sold')::numeric;
  v_unid0 := (v_r0->'money'->>'units')::numeric;
  v_gan0  := (v_r0->'money'->>'profit')::numeric;
  v_ef0   := (public.cierre_caja(v_store, null) ->> 'efectivo_esperado')::numeric;

  perform public.register_sale(
    p_store_id := v_store,
    p_items := '[{"product_id": null, "qty": 1, "free_amount": 5000, "name": "Flete"}]'::jsonb,
    p_payment_method := 'cash', p_idempotency_key := 'ML-REP-0001');

  v_r1 := public.reportes_summary(v_store, v_hoy, v_hoy);
  v_vend1 := (v_r1->'money'->>'sold')::numeric;
  v_unid1 := (v_r1->'money'->>'units')::numeric;
  v_gan1  := (v_r1->'money'->>'profit')::numeric;

  -- La PLATA sí entra.
  if v_vend1 - v_vend0 is distinct from 5000 then
    raise exception 'FALLA 5: lo vendido subió % (esperado 5000)', v_vend1 - v_vend0;
  end if;
  -- Las UNIDADES de producto NO se contaminan.
  if v_unid1 is distinct from v_unid0 then
    raise exception 'FALLA 5: las unidades cambiaron (% → %) por una línea libre', v_unid0, v_unid1;
  end if;
  -- La GANANCIA tampoco (no hay costo que inventar).
  if v_gan1 is distinct from v_gan0 then
    raise exception 'FALLA 5: la ganancia cambió (% → %) por una línea libre', v_gan0, v_gan1;
  end if;
  -- No aparece en el ranking de productos ni en categorías.
  select count(*) into v_top from jsonb_array_elements(v_r1->'top_units') e
   where e->>'name' = 'Flete';
  if v_top <> 0 then
    raise exception 'FALLA 5: la línea libre apareció en el ranking de productos';
  end if;
  select count(*) into v_top from jsonb_array_elements(v_r1->'by_category') e
   where e->>'name' = 'Flete';
  if v_top <> 0 then
    raise exception 'FALLA 5: la línea libre apareció en by_category';
  end if;

  -- Y el efectivo esperado del cierre SÍ la cuenta (entró plata al cajón).
  v_ef1 := (public.cierre_caja(v_store, null) ->> 'efectivo_esperado')::numeric;
  if v_ef1 - v_ef0 is distinct from 5000 then
    raise exception 'FALLA 5: el efectivo esperado subió % (esperado 5000)', v_ef1 - v_ef0;
  end if;
  raise notice 'OK  5. reportes: la plata entra en totales y caja; unidades/margen/rankings intactos';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 6 · Guardas: un monto libre inválido (0, negativo o ausente) se rechaza, y
--     una línea libre NO puede colarse como producto inexistente.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
begin
  begin
    perform public.register_sale(
      p_store_id := v_store,
      p_items := '[{"product_id": null, "qty": 1, "free_amount": 0}]'::jsonb,
      p_payment_method := 'cash', p_idempotency_key := 'ML-BAD-0001');
    raise exception 'FALLA 6: aceptó un monto libre de 0';
  exception when others then
    if sqlerrm not like '%invalid_amount%' then raise; end if;
  end;

  begin
    perform public.register_sale(
      p_store_id := v_store,
      p_items := '[{"product_id": null, "qty": 1, "free_amount": -500}]'::jsonb,
      p_payment_method := 'cash', p_idempotency_key := 'ML-BAD-0002');
    raise exception 'FALLA 6: aceptó un monto libre negativo';
  exception when others then
    if sqlerrm not like '%invalid_amount%' then raise; end if;
  end;

  begin
    perform public.register_sale(
      p_store_id := v_store,
      p_items := '[{"product_id": null, "qty": 1}]'::jsonb,
      p_payment_method := 'cash', p_idempotency_key := 'ML-BAD-0003');
    raise exception 'FALLA 6: aceptó una línea libre sin monto';
  exception when others then
    if sqlerrm not like '%invalid_amount%' then raise; end if;
  end;
  raise notice 'OK  6. monto libre inválido (0 / negativo / ausente) se rechaza';
end $$;
rollback;

\echo '=== monto libre OK ==='
