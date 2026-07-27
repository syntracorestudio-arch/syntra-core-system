-- =============================================================================
-- StockFlow — tests del reembolso de un split a medio cobrar (Paso 3)
--
-- Cuando el cliente se fue con una pata cobrada y la otra sin cobrar, la salida es
-- REEMBOLSAR la pata cobrada y anular el grupo (sin venta). `marcar_pata_reembolsada`
-- transiciona la pata approved → refunded (la plata la devuelve MP desde la lib/acción;
-- esta RPC es la parte de base: idempotente, solo sobre una pata cobrada sin venta).
--
-- Transaccionales con ROLLBACK. Impersona al dueño.
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-split-dos-reembolso.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\set DUENO 'aaaaaaaa-0000-0000-0000-000000000001'

\echo ''
\echo '=== StockFlow — tests del reembolso de un split a medio cobrar (Paso 3) ==='

-- ---------------------------------------------------------------------------
-- 1 · Reembolsar la pata cobrada de un grupo a medio cobrar: approved → refunded,
--     idempotente, y el grupo desaparece del banner (ya no hay plata retenida).
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
  v_st    text;
  v_medio jsonb;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_card := round(v_price / 3, 2);
  v_qr   := round(v_price / 3, 2) + 5;
  v_cash := v_price - v_card - v_qr;
  v_pagos := jsonb_build_array(
    jsonb_build_object('method','cash','amount', v_cash),
    jsonb_build_object('method','card','amount', v_card),
    jsonb_build_object('method','qr','amount', v_qr));

  v_legc := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_card, 'SPLIT2X-C-0001', null, v_group, 'card');
  v_legq := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_qr, 'SPLIT2X-Q-0001', null, v_group, 'qr');
  -- Solo la tarjeta acreditó (a medio cobrar).
  update public.payment_intents set status = 'approved' where id = v_legc.id;

  -- Reembolsar la pata cobrada.
  perform public.marcar_pata_reembolsada('11111111-1111-1111-1111-111111111111', v_legc.id);
  select status into v_st from public.payment_intents where id = v_legc.id;
  if v_st is distinct from 'refunded' then
    raise exception 'FALLA 1: la pata no quedó refunded (es %)', v_st;
  end if;

  -- Idempotente: reembolsar de nuevo no rompe ni cambia el estado.
  perform public.marcar_pata_reembolsada('11111111-1111-1111-1111-111111111111', v_legc.id);
  select status into v_st from public.payment_intents where id = v_legc.id;
  if v_st is distinct from 'refunded' then
    raise exception 'FALLA 1: el segundo reembolso cambió el estado (%)', v_st;
  end if;

  -- El grupo ya no está a medio cobrar (no queda plata retenida).
  v_medio := public.grupos_a_medio_cobrar('11111111-1111-1111-1111-111111111111');
  if exists (select 1 from jsonb_array_elements(v_medio) e where (e->>'group_id')::uuid = v_group) then
    raise exception 'FALLA 1: el grupo sigue a medio cobrar tras el reembolso';
  end if;
  raise notice 'OK  1. reembolso: approved→refunded, idempotente, sale del banner';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2 · No se puede reembolsar una pata que no está acreditada (nada que devolver).
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
  v_legq  public.payment_intents;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_card := round(v_price / 3, 2);
  v_qr   := round(v_price / 3, 2) + 5;
  v_cash := v_price - v_card - v_qr;
  v_pagos := jsonb_build_array(
    jsonb_build_object('method','cash','amount', v_cash),
    jsonb_build_object('method','card','amount', v_card),
    jsonb_build_object('method','qr','amount', v_qr));

  v_legq := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_qr, 'SPLIT2X-Q-0002', null, v_group, 'qr');
  -- Sigue pending (nunca acreditó).

  begin
    perform public.marcar_pata_reembolsada('11111111-1111-1111-1111-111111111111', v_legq.id);
    raise exception 'FALLA 2: reembolsó una pata sin acreditar';
  exception when others then
    if sqlerrm not like '%not_refundable%' then raise; end if;
  end;
  raise notice 'OK  2. pata sin acreditar → not_refundable';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3 · No se puede reembolsar una pata que YA es parte de una venta registrada
--     (para eso está la anulación de la venta, no el reembolso de la pata).
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
  v_qr   := round(v_price / 3, 2) + 5;
  v_cash := v_price - v_card - v_qr;
  v_pagos := jsonb_build_array(
    jsonb_build_object('method','cash','amount', v_cash),
    jsonb_build_object('method','card','amount', v_card),
    jsonb_build_object('method','qr','amount', v_qr));

  v_legc := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_card, 'SPLIT2X-C-0003', null, v_group, 'card');
  v_legq := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_qr, 'SPLIT2X-Q-0003', null, v_group, 'qr');
  -- Las dos acreditan y se registra la venta.
  update public.payment_intents set status = 'approved' where id in (v_legc.id, v_legq.id);
  perform public.register_split_group(
    '11111111-1111-1111-1111-111111111111', v_group,
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, 'SPLIT2X-S-0003');

  begin
    perform public.marcar_pata_reembolsada('11111111-1111-1111-1111-111111111111', v_legc.id);
    raise exception 'FALLA 3: reembolsó una pata ya vendida';
  exception when others then
    if sqlerrm not like '%already_sold%' then raise; end if;
  end;
  raise notice 'OK  3. pata ya vendida → already_sold (para eso está anular la venta)';
end $$;
rollback;

\echo '=== split-dos-reembolso OK ==='
