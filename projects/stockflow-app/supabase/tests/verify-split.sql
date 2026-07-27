-- =============================================================================
-- StockFlow — tests de pago dividido (Cobros Paso 1)
--
-- Transaccionales con ROLLBACK: no ensucian el seed. Impersona al dueño.
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-split.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\set DUENO 'aaaaaaaa-0000-0000-0000-000000000001'
\set STORE '11111111-1111-1111-1111-111111111111'
\set PROD  'd1000000-0000-0000-0000-000000000001'

\echo ''
\echo '=== StockFlow — tests de pago dividido (Paso 1) ==='

-- Helper repetido inline: total de un método dentro del jsonb `by_method`.
-- (no se puede declarar función en un test transaccional sin ensuciar; se inlinea)

-- ---------------------------------------------------------------------------
-- 1 · Una venta dividida se registra como 'split', el reparto se guarda y SUMA
--     el total. Invariante base de la plata.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price  numeric;
  v_cash   numeric;
  v_card   numeric;
  v_res    jsonb;
  v_sale   uuid;
  v_metodo text;
  v_suma   numeric;
  v_filas  integer;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_cash := round(v_price / 2, 2);
  v_card := v_price - v_cash;

  v_res := public.register_split_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('method','cash','amount', v_cash),
      jsonb_build_object('method','card','amount', v_card)),
    'SPLIT-KEY-0001');
  v_sale := (v_res->>'sale_id')::uuid;

  select payment_method into v_metodo from public.sales where id = v_sale;
  if v_metodo is distinct from 'split' then
    raise exception 'FALLA 1: la venta no quedó marcada split (es %)', v_metodo;
  end if;

  select count(*), coalesce(sum(amount),0) into v_filas, v_suma
    from public.sale_payments where sale_id = v_sale;
  if v_filas <> 2 then
    raise exception 'FALLA 1: se esperaban 2 partes, hay %', v_filas;
  end if;
  if v_suma is distinct from v_price then
    raise exception 'FALLA 1: el reparto (%) no suma el total de la venta (%)', v_suma, v_price;
  end if;
  raise notice 'OK  1. split se registra, marca split y el reparto suma el total';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2 · El cierre de caja IMPUTA cada parte a su medio real (no a 'split') y la
--     parte en efectivo suma al efectivo esperado. Lo más caro de romper.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price   numeric;
  v_cash    numeric;
  v_card    numeric;
  v_by0     jsonb;
  v_by1     jsonb;
  v_ef0     numeric;
  v_ef1     numeric;
  v_fact0   numeric;
  v_fact1   numeric;
  v_cash0   numeric; v_cash1 numeric;
  v_card0   numeric; v_card1 numeric;
  v_cierre  jsonb;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_cash := round(v_price / 2, 2);
  v_card := v_price - v_cash;

  v_cierre := public.cierre_caja('11111111-1111-1111-1111-111111111111', null);
  v_by0  := v_cierre->'by_method';
  v_ef0  := (v_cierre->>'efectivo_esperado')::numeric;
  v_fact0:= (v_cierre->>'facturado')::numeric;
  v_cash0:= coalesce((select (e->>'total')::numeric from jsonb_array_elements(v_by0) e where e->>'method'='cash'),0);
  v_card0:= coalesce((select (e->>'total')::numeric from jsonb_array_elements(v_by0) e where e->>'method'='card'),0);

  perform public.register_split_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('method','cash','amount', v_cash),
      jsonb_build_object('method','card','amount', v_card)),
    'SPLIT-KEY-0002');

  v_cierre := public.cierre_caja('11111111-1111-1111-1111-111111111111', null);
  v_by1  := v_cierre->'by_method';
  v_ef1  := (v_cierre->>'efectivo_esperado')::numeric;
  v_fact1:= (v_cierre->>'facturado')::numeric;
  v_cash1:= coalesce((select (e->>'total')::numeric from jsonb_array_elements(v_by1) e where e->>'method'='cash'),0);
  v_card1:= coalesce((select (e->>'total')::numeric from jsonb_array_elements(v_by1) e where e->>'method'='card'),0);

  -- No debe aparecer un bucket 'split'.
  if exists (select 1 from jsonb_array_elements(v_by1) e where e->>'method'='split') then
    raise exception 'FALLA 2: by_method tiene un bucket split (debería imputarse a cada medio)';
  end if;
  -- Cada medio subió por su parte.
  if v_cash1 - v_cash0 is distinct from v_cash then
    raise exception 'FALLA 2: efectivo en by_method subió % (esperado %)', v_cash1 - v_cash0, v_cash;
  end if;
  if v_card1 - v_card0 is distinct from v_card then
    raise exception 'FALLA 2: tarjeta en by_method subió % (esperado %)', v_card1 - v_card0, v_card;
  end if;
  -- El efectivo esperado subió SOLO por la parte cash.
  if v_ef1 - v_ef0 is distinct from v_cash then
    raise exception 'FALLA 2: efectivo esperado subió % (esperado %)', v_ef1 - v_ef0, v_cash;
  end if;
  -- El facturado subió por el total (split es venta cobrada).
  if v_fact1 - v_fact0 is distinct from v_price then
    raise exception 'FALLA 2: facturado subió % (esperado %)', v_fact1 - v_fact0, v_price;
  end if;
  raise notice 'OK  2. cierre_caja imputa el split a cada medio y suma la parte cash al efectivo esperado';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3 · Atomicidad: si el reparto NO suma el total, se rechaza y NO queda una
--     venta 'split' huérfana (rollback total). El bug más caro posible.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price numeric;
  v_huerf integer;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';

  begin
    perform public.register_split_sale('11111111-1111-1111-1111-111111111111',
      '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('method','cash','amount', v_price),
        jsonb_build_object('method','card','amount', 100)),  -- suma de MÁS
      'SPLIT-KEY-0003');
    raise exception 'FALLA 3: aceptó un reparto que no suma el total';
  exception when others then
    if sqlerrm not like '%split_sum_mismatch%' then raise; end if;
  end;

  select count(*) into v_huerf from public.sales where idempotency_key = 'SPLIT-KEY-0003';
  if v_huerf <> 0 then
    raise exception 'FALLA 3: quedó una venta huérfana tras el rechazo (% filas)', v_huerf;
  end if;
  raise notice 'OK  3. reparto que no suma → rechazado y sin venta huérfana (atómico)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4 · Fiado nunca entra en un split (es deuda, descuadraría el cierre) → rechazo,
--     sin venta. (Desde el Paso 2, 'qr' SÍ se admite en la RPC — ver verify-split-qr.)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price numeric;
  v_n     integer;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';

  begin
    perform public.register_split_sale('11111111-1111-1111-1111-111111111111',
      '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('method','cash','amount', round(v_price/2,2)),
        jsonb_build_object('method','account','amount', v_price - round(v_price/2,2))),
      'SPLIT-KEY-0004');
    raise exception 'FALLA 4: aceptó fiado dentro del split';
  exception when others then
    if sqlerrm not like '%invalid_split_payment%' then raise; end if;
  end;

  select count(*) into v_n from public.sales where idempotency_key = 'SPLIT-KEY-0004';
  if v_n <> 0 then
    raise exception 'FALLA 4: quedó venta pese al método inválido (%)', v_n;
  end if;
  raise notice 'OK  4. fiado en el split se rechaza sin dejar venta';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 5 · Idempotencia: reintentar el MISMO split (misma key + carrito) no duplica
--     ni la venta ni el reparto.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price numeric;
  v_cash  numeric;
  v_card  numeric;
  v_r1    jsonb;
  v_r2    jsonb;
  v_sale  uuid;
  v_filas integer;
  v_ventas integer;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_cash := round(v_price/2,2);
  v_card := v_price - v_cash;

  v_r1 := public.register_split_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('method','cash','amount', v_cash),
      jsonb_build_object('method','card','amount', v_card)),
    'SPLIT-KEY-0005');
  v_r2 := public.register_split_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('method','cash','amount', v_cash),
      jsonb_build_object('method','card','amount', v_card)),
    'SPLIT-KEY-0005');

  if (v_r2->>'replayed')::boolean is not true then
    raise exception 'FALLA 5: el segundo intento no se marcó replay';
  end if;
  if (v_r1->>'sale_id') is distinct from (v_r2->>'sale_id') then
    raise exception 'FALLA 5: el replay devolvió otra venta';
  end if;

  v_sale := (v_r1->>'sale_id')::uuid;
  select count(*) into v_filas from public.sale_payments where sale_id = v_sale;
  if v_filas <> 2 then
    raise exception 'FALLA 5: el reparto se duplicó (% filas, esperado 2)', v_filas;
  end if;
  select count(*) into v_ventas from public.sales where idempotency_key = 'SPLIT-KEY-0005';
  if v_ventas <> 1 then
    raise exception 'FALLA 5: se duplicó la venta (% filas)', v_ventas;
  end if;
  raise notice 'OK  5. replay del mismo split no duplica venta ni reparto';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 6 · reportes_medios (período) también imputa el split a cada medio.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price numeric;
  v_cash  numeric;
  v_card  numeric;
  v_hoy   date;
  v_by0   jsonb; v_by1 jsonb;
  v_cash0 numeric; v_cash1 numeric;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  select (now() at time zone coalesce((select timezone from public.stores where id = '11111111-1111-1111-1111-111111111111'),'America/Argentina/Buenos_Aires'))::date into v_hoy;
  v_cash := round(v_price/2,2);
  v_card := v_price - v_cash;

  v_by0 := public.reportes_medios('11111111-1111-1111-1111-111111111111', v_hoy, v_hoy)->'by_method';
  v_cash0 := coalesce((select (e->>'total')::numeric from jsonb_array_elements(v_by0) e where e->>'method'='cash'),0);

  perform public.register_split_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('method','cash','amount', v_cash),
      jsonb_build_object('method','card','amount', v_card)),
    'SPLIT-KEY-0006');

  v_by1 := public.reportes_medios('11111111-1111-1111-1111-111111111111', v_hoy, v_hoy)->'by_method';
  v_cash1 := coalesce((select (e->>'total')::numeric from jsonb_array_elements(v_by1) e where e->>'method'='cash'),0);

  if exists (select 1 from jsonb_array_elements(v_by1) e where e->>'method'='split') then
    raise exception 'FALLA 6: reportes_medios tiene bucket split';
  end if;
  if v_cash1 - v_cash0 is distinct from v_cash then
    raise exception 'FALLA 6: efectivo del período subió % (esperado %)', v_cash1 - v_cash0, v_cash;
  end if;
  raise notice 'OK  6. reportes_medios imputa el split a cada medio del período';
end $$;
rollback;

\echo '=== split OK ==='
