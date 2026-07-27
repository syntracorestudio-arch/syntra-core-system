-- =============================================================================
-- StockFlow — tests de DOS patas electrónicas en el split (tarjeta + QR)
--
-- Una venta con DOS cobros MP asíncronos (tarjeta al posnet + QR), ligados por un
-- `split_group_id`. La venta se registra RECIÉN cuando las DOS patas acreditan, vía
-- `register_split_group` (verifica el grupo completo + registra atómico + vincula las
-- dos patas). El núcleo de riesgo: nunca registrar una venta con una pata sin cobrar.
--
-- Transaccionales con ROLLBACK. Impersona al dueño.
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-split-dos.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\set DUENO 'aaaaaaaa-0000-0000-0000-000000000001'

\echo ''
\echo '=== StockFlow — tests de dos electrónicas en el split (tarjeta + QR) ==='

-- ---------------------------------------------------------------------------
-- 1 · Dos patas (tarjeta + QR) con el MISMO group_id, ambas acreditadas →
--     register_split_group registra UNA venta split, imputa las tres partes
--     (cash/card/qr) y vincula LAS DOS patas a la venta (sale_id).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price numeric;
  v_card  numeric;
  v_qr    numeric;
  v_cash  numeric;
  v_pagos jsonb;
  v_group uuid := gen_random_uuid();
  v_legc  public.payment_intents;
  v_legq  public.payment_intents;
  v_res   jsonb;
  v_sale  uuid;
  v_cardb numeric; v_qrb numeric; v_cashb numeric;
  v_linked int;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_card := round(v_price / 3, 2);
  v_qr   := round(v_price / 3, 2);
  v_cash := v_price - v_card - v_qr;
  v_pagos := jsonb_build_array(
    jsonb_build_object('method','cash','amount', v_cash),
    jsonb_build_object('method','card','amount', v_card),
    jsonb_build_object('method','qr','amount', v_qr));

  -- Pata 1: tarjeta (posnet). Pata 2: QR. Mismo grupo, claves distintas.
  v_legc := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_card, 'SPLIT2-C-0001', null, v_group);
  v_legq := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_qr, 'SPLIT2-Q-0001', null, v_group);

  if v_legc.split_group_id is distinct from v_group or v_legq.split_group_id is distinct from v_group then
    raise exception 'FALLA 1: las patas no quedaron en el grupo';
  end if;
  if v_legc.amount is distinct from v_card or v_legq.amount is distinct from v_qr then
    raise exception 'FALLA 1: el binding de monto por pata se rompió (card=% qr=%)', v_legc.amount, v_legq.amount;
  end if;

  -- MP acreditó las DOS (como el poll/webhook).
  update public.payment_intents set status = 'approved' where id in (v_legc.id, v_legq.id);

  v_res := public.register_split_group(
    '11111111-1111-1111-1111-111111111111', v_group,
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, 'SPLIT2-S-0001');
  v_sale := (v_res->>'sale_id')::uuid;

  if (select payment_method from public.sales where id = v_sale) is distinct from 'split' then
    raise exception 'FALLA 1: la venta no quedó split';
  end if;

  select coalesce(sum(case when method='card' then amount end),0),
         coalesce(sum(case when method='qr'   then amount end),0),
         coalesce(sum(case when method='cash' then amount end),0)
    into v_cardb, v_qrb, v_cashb
    from public.sale_payments where sale_id = v_sale;
  if v_cardb is distinct from v_card or v_qrb is distinct from v_qr or v_cashb is distinct from v_cash then
    raise exception 'FALLA 1: imputación equivocada (card=% qr=% cash=%)', v_cardb, v_qrb, v_cashb;
  end if;

  -- Las DOS patas quedaron vinculadas a la venta.
  select count(*) into v_linked from public.payment_intents
   where split_group_id = v_group and sale_id = v_sale;
  if v_linked <> 2 then
    raise exception 'FALLA 1: se vincularon % patas a la venta (esperado 2)', v_linked;
  end if;
  raise notice 'OK  1. dos patas acreditadas → una venta split, imputada y con ambas patas vinculadas';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2 · group_incomplete: si una pata NO está acreditada, register_split_group
--     NO registra la venta (nunca una venta con una pata sin cobrar).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price numeric;
  v_card  numeric;
  v_qr    numeric;
  v_cash  numeric;
  v_pagos jsonb;
  v_group uuid := gen_random_uuid();
  v_legc  public.payment_intents;
  v_legq  public.payment_intents;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_card := round(v_price / 3, 2);
  v_qr   := round(v_price / 3, 2);
  v_cash := v_price - v_card - v_qr;
  v_pagos := jsonb_build_array(
    jsonb_build_object('method','cash','amount', v_cash),
    jsonb_build_object('method','card','amount', v_card),
    jsonb_build_object('method','qr','amount', v_qr));

  v_legc := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_card, 'SPLIT2-C-0002', null, v_group);
  v_legq := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_qr, 'SPLIT2-Q-0002', null, v_group);

  -- SOLO la tarjeta acreditó; el QR sigue pendiente.
  update public.payment_intents set status = 'approved' where id = v_legc.id;

  begin
    perform public.register_split_group(
      '11111111-1111-1111-1111-111111111111', v_group,
      '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
      v_pagos, 'SPLIT2-S-0002');
    raise exception 'FALLA 2: registró la venta con una pata sin acreditar';
  exception when others then
    if sqlerrm not like '%group_incomplete%' then raise; end if;
  end;

  if exists (select 1 from public.payment_intents
             where split_group_id = v_group and sale_id is not null) then
    raise exception 'FALLA 2: quedó una venta a pesar del grupo incompleto';
  end if;
  raise notice 'OK  2. grupo incompleto → group_incomplete, sin venta';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3 · Idempotencia: register_split_group dos veces con la MISMA clave → la
--     MISMA venta (no duplica el cobro ni la venta).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price numeric;
  v_card  numeric;
  v_qr    numeric;
  v_cash  numeric;
  v_pagos jsonb;
  v_group uuid := gen_random_uuid();
  v_legc  public.payment_intents;
  v_legq  public.payment_intents;
  v_sale1 uuid; v_sale2 uuid;
  v_res2  jsonb;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_card := round(v_price / 3, 2);
  v_qr   := round(v_price / 3, 2);
  v_cash := v_price - v_card - v_qr;
  v_pagos := jsonb_build_array(
    jsonb_build_object('method','cash','amount', v_cash),
    jsonb_build_object('method','card','amount', v_card),
    jsonb_build_object('method','qr','amount', v_qr));

  v_legc := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_card, 'SPLIT2-C-0003', null, v_group);
  v_legq := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_qr, 'SPLIT2-Q-0003', null, v_group);
  update public.payment_intents set status = 'approved' where id in (v_legc.id, v_legq.id);

  v_sale1 := (public.register_split_group(
    '11111111-1111-1111-1111-111111111111', v_group,
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, 'SPLIT2-S-0003')->>'sale_id')::uuid;
  v_res2 := public.register_split_group(
    '11111111-1111-1111-1111-111111111111', v_group,
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, 'SPLIT2-S-0003');
  v_sale2 := (v_res2->>'sale_id')::uuid;

  if v_sale1 is distinct from v_sale2 then
    raise exception 'FALLA 3: la segunda llamada creó otra venta (% vs %)', v_sale1, v_sale2;
  end if;
  if (v_res2->>'replayed')::boolean is distinct from true then
    raise exception 'FALLA 3: la segunda llamada no se marcó replayed';
  end if;
  raise notice 'OK  3. idempotente: misma clave → misma venta';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4 · Guarda de monto: si el monto acreditado de una pata no coincide con su
--     parte del reparto, register_split_group rechaza (group_amount_mismatch).
--     Simula una manipulación del intent.amount tras crearlo.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price numeric;
  v_card  numeric;
  v_qr    numeric;
  v_cash  numeric;
  v_pagos jsonb;
  v_group uuid := gen_random_uuid();
  v_legc  public.payment_intents;
  v_legq  public.payment_intents;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_card := round(v_price / 3, 2);
  v_qr   := round(v_price / 3, 2);
  v_cash := v_price - v_card - v_qr;
  v_pagos := jsonb_build_array(
    jsonb_build_object('method','cash','amount', v_cash),
    jsonb_build_object('method','card','amount', v_card),
    jsonb_build_object('method','qr','amount', v_qr));

  v_legc := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_card, 'SPLIT2-C-0004', null, v_group);
  v_legq := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_qr, 'SPLIT2-Q-0004', null, v_group);
  update public.payment_intents set status = 'approved' where id in (v_legc.id, v_legq.id);
  -- Manipulación: la pata QR "acreditó" un monto distinto al de su parte.
  update public.payment_intents set amount = v_qr + 500 where id = v_legq.id;

  begin
    perform public.register_split_group(
      '11111111-1111-1111-1111-111111111111', v_group,
      '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
      v_pagos, 'SPLIT2-S-0004');
    raise exception 'FALLA 4: registró con montos de pata que no coinciden';
  exception when others then
    if sqlerrm not like '%group_amount_mismatch%' then raise; end if;
  end;
  raise notice 'OK  4. monto de pata que no coincide → group_amount_mismatch';
end $$;
rollback;

\echo '=== split-dos OK ==='
