-- =============================================================================
-- StockFlow — tests de QR dentro del split (Cobros Paso 2)
--
-- Transaccionales con ROLLBACK. Impersona al dueño.
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-split-qr.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\set DUENO 'aaaaaaaa-0000-0000-0000-000000000001'

\echo ''
\echo '=== StockFlow — tests de QR en el split (Paso 2) ==='

-- ---------------------------------------------------------------------------
-- 1 · El intento parcial cobra SOLO la parte QR (para que el binding de monto
--     compare contra lo que MP realmente carga), pero guarda el reparto completo.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price  numeric;
  v_qr     numeric;
  v_cash   numeric;
  v_intent public.payment_intents;
  v_suma   numeric;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_qr := round(v_price / 2, 2);
  v_cash := v_price - v_qr;

  v_intent := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('method','cash','amount', v_cash),
      jsonb_build_object('method','qr','amount', v_qr)),
    'SPLITQR-0001');

  if v_intent.amount is distinct from v_qr then
    raise exception 'FALLA 1: el intento cobra % (esperado la parte QR %)', v_intent.amount, v_qr;
  end if;
  if v_intent.split_pagos is null then
    raise exception 'FALLA 1: no se guardó el reparto (split_pagos null)';
  end if;
  select sum((p->>'amount')::numeric) into v_suma from jsonb_array_elements(v_intent.split_pagos) p;
  if v_suma is distinct from v_price then
    raise exception 'FALLA 1: el reparto guardado (%) no suma el total del carrito (%)', v_suma, v_price;
  end if;
  raise notice 'OK  1. intento parcial: amount = parte QR, split_pagos suma el total';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2 · El reparto tiene que sumar el total del carrito, y tener EXACTAMENTE una
--     parte QR. Binding de integridad del split completo.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price numeric;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';

  -- Suma de menos → rechazo.
  begin
    perform public.crear_intento_cobro_split(
      '11111111-1111-1111-1111-111111111111',
      '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('method','cash','amount', 100),
        jsonb_build_object('method','qr','amount', 100)),
      'SPLITQR-0002a');
    raise exception 'FALLA 2: aceptó un reparto que no suma el total';
  exception when others then
    if sqlerrm not like '%split_sum_mismatch%' then raise; end if;
  end;

  -- Sin parte QR → rechazo (este intento es SIEMPRE para la pata QR).
  begin
    perform public.crear_intento_cobro_split(
      '11111111-1111-1111-1111-111111111111',
      '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
      jsonb_build_array(
        jsonb_build_object('method','cash','amount', round(v_price/2,2)),
        jsonb_build_object('method','card','amount', v_price - round(v_price/2,2))),
      'SPLITQR-0002b');
    raise exception 'FALLA 2: aceptó un split sin parte QR en el intento QR';
  exception when others then
    if sqlerrm not like '%split_needs_one_qr%' then raise; end if;
  end;
  raise notice 'OK  2. el intento QR exige suma == total y exactamente una parte QR';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3 · register_split_sale con parte QR + p_paid: registra la venta split, imputa
--     la parte QR al medio 'qr' y la de efectivo al efectivo esperado (la QR NO).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price numeric;
  v_qr    numeric;
  v_cash  numeric;
  v_res   jsonb;
  v_sale  uuid;
  v_ef0 numeric; v_ef1 numeric;
  v_by  jsonb;
  v_qrb numeric; v_cashb numeric;
  v_cierre jsonb;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_qr := round(v_price / 2, 2);
  v_cash := v_price - v_qr;

  v_ef0 := (public.cierre_caja('11111111-1111-1111-1111-111111111111', null) ->> 'efectivo_esperado')::numeric;

  v_res := public.register_split_sale(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('method','cash','amount', v_cash),
      jsonb_build_object('method','qr','amount', v_qr)),
    'SPLITQR-0003', true);
  v_sale := (v_res->>'sale_id')::uuid;

  if (select payment_method from public.sales where id = v_sale) is distinct from 'split' then
    raise exception 'FALLA 3: la venta no quedó split';
  end if;

  v_cierre := public.cierre_caja('11111111-1111-1111-1111-111111111111', null);
  v_ef1 := (v_cierre ->> 'efectivo_esperado')::numeric;
  v_by  := v_cierre -> 'by_method';
  v_qrb   := coalesce((select (e->>'total')::numeric from jsonb_array_elements(v_by) e where e->>'method'='qr'),0);
  v_cashb := coalesce((select (e->>'total')::numeric from jsonb_array_elements(v_by) e where e->>'method'='cash'),0);

  -- La parte QR se imputa al medio 'qr' (no a 'split').
  if exists (select 1 from jsonb_array_elements(v_by) e where e->>'method'='split') then
    raise exception 'FALLA 3: by_method tiene bucket split';
  end if;
  -- El efectivo esperado subió SOLO por la parte cash (la QR no entra al cajón).
  if v_ef1 - v_ef0 is distinct from v_cash then
    raise exception 'FALLA 3: efectivo esperado subió % (esperado solo la parte cash %)', v_ef1 - v_ef0, v_cash;
  end if;
  raise notice 'OK  3. split con QR: parte QR al medio qr, parte cash al efectivo esperado';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4 · Recuperación: un intento split acreditado SIN venta (la caja se cayó) se
--     re-arma como SPLIT desde split_pagos, no como un QR de carrito entero.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price  numeric;
  v_qr     numeric;
  v_cash   numeric;
  v_intent public.payment_intents;
  v_huerf  jsonb;
  v_este   jsonb;
  v_res    jsonb;
  v_sale   uuid;
  v_qrb    numeric;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_qr := round(v_price / 2, 2);
  v_cash := v_price - v_qr;

  -- Intento QR de un split, y "MP lo acreditó" (lo aprobamos a mano, como el webhook).
  v_intent := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('method','cash','amount', v_cash),
      jsonb_build_object('method','qr','amount', v_qr)),
    'SPLITQR-0004');
  update public.payment_intents set status = 'approved' where id = v_intent.id;

  -- El banner de "cobros sin venta" lo tiene que ver, con el reparto y el monto TOTAL.
  v_huerf := public.cobros_sin_venta('11111111-1111-1111-1111-111111111111');
  select e into v_este from jsonb_array_elements(v_huerf) e where (e->>'id')::uuid = v_intent.id;
  if v_este is null then
    raise exception 'FALLA 4: el cobro huérfano no aparece';
  end if;
  if v_este->'split_pagos' is null or (v_este->>'monto')::numeric is distinct from v_price then
    raise exception 'FALLA 4: el huérfano no expone split_pagos o el monto no es el total (%)', v_este->>'monto';
  end if;

  -- Recuperar = registrar split desde split_pagos (paid) + vincular.
  v_res := public.register_split_sale(
    '11111111-1111-1111-1111-111111111111',
    v_intent.items, v_intent.split_pagos, v_intent.idempotency_key, true);
  v_sale := (v_res->>'sale_id')::uuid;
  perform public.vincular_venta_a_cobro('11111111-1111-1111-1111-111111111111', v_intent.id, v_sale);

  -- Ya no es huérfano, y la venta es split con la parte QR imputada.
  if (select sale_id from public.payment_intents where id = v_intent.id) is distinct from v_sale then
    raise exception 'FALLA 4: el intento no quedó vinculado a la venta';
  end if;
  v_qrb := coalesce((select amount from public.sale_payments where sale_id = v_sale and method = 'qr'), 0);
  if v_qrb is distinct from v_qr then
    raise exception 'FALLA 4: la parte QR recuperada es % (esperado %)', v_qrb, v_qr;
  end if;
  raise notice 'OK  4. recuperación re-arma el split desde split_pagos y vincula el intento';
end $$;
rollback;

\echo '=== split-qr OK ==='
