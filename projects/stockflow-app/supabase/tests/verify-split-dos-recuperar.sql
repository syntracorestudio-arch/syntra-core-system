-- =============================================================================
-- StockFlow — tests de recuperación "a medio cobrar" (split de dos electrónicas)
--
-- El estado que abre el Paso 1: una pata acreditada y la otra no (la caja se cayó
-- entre las dos). `grupos_a_medio_cobrar` lo expone por grupo (qué se cobró, qué falta)
-- y la caja lo resuelve resumiendo la pata pendiente. Las patas de un grupo NO aparecen
-- en el banner de huérfanos simple (`cobros_sin_venta`): las maneja el banner de grupo.
--
-- Transaccionales con ROLLBACK. Impersona al dueño.
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-split-dos-recuperar.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\set DUENO 'aaaaaaaa-0000-0000-0000-000000000001'

\echo ''
\echo '=== StockFlow — tests de recuperación a medio cobrar (split dos electrónicas) ==='

-- ---------------------------------------------------------------------------
-- 1 · Crash tras la pata 1: tarjeta acreditada, QR sin acreditar. El grupo
--     aparece en grupos_a_medio_cobrar (cobrado=tarjeta, falta=QR) y NO en el
--     banner de huérfanos simple (cobros_sin_venta).
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
  v_medio jsonb;
  v_este  jsonb;
  v_cob   jsonb;
  v_pend  jsonb;
  v_huerf jsonb;
begin
  select price into v_price from public.products where id = 'd1000000-0000-0000-0000-000000000001';
  v_card := round(v_price / 3, 2);
  v_qr   := round(v_price / 3, 2) + 5;  -- distinto de card, para chequear el binding por método aparte del monto
  v_cash := v_price - v_card - v_qr;
  v_pagos := jsonb_build_array(
    jsonb_build_object('method','cash','amount', v_cash),
    jsonb_build_object('method','card','amount', v_card),
    jsonb_build_object('method','qr','amount', v_qr));

  v_legc := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_card, 'SPLIT2R-C-0001', null, v_group, 'card');
  v_legq := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_qr, 'SPLIT2R-Q-0001', null, v_group, 'qr');

  -- SOLO la tarjeta acreditó.
  update public.payment_intents set status = 'approved' where id = v_legc.id;

  v_medio := public.grupos_a_medio_cobrar('11111111-1111-1111-1111-111111111111');
  select e into v_este from jsonb_array_elements(v_medio) e where (e->>'group_id')::uuid = v_group;
  if v_este is null then
    raise exception 'FALLA 1: el grupo a medio cobrar no aparece';
  end if;

  -- Cobrado = tarjeta por su monto.
  v_cob := v_este->'cobrado';
  if (select count(*) from jsonb_array_elements(v_cob) e
       where e->>'method'='card' and (e->>'amount')::numeric = v_card) <> 1 then
    raise exception 'FALLA 1: cobrado no muestra la tarjeta por su monto (%)', v_cob;
  end if;
  -- Pendiente = QR por su monto.
  v_pend := v_este->'pendiente';
  if (select count(*) from jsonb_array_elements(v_pend) e
       where e->>'method'='qr' and (e->>'amount')::numeric = v_qr) <> 1 then
    raise exception 'FALLA 1: pendiente no muestra el QR por su monto (%)', v_pend;
  end if;
  if (v_este->>'total')::numeric is distinct from v_price then
    raise exception 'FALLA 1: el total del grupo (%) no es el del carrito (%)', v_este->>'total', v_price;
  end if;

  -- La pata acreditada NO aparece en el banner de huérfanos simple.
  v_huerf := public.cobros_sin_venta('11111111-1111-1111-1111-111111111111');
  if exists (select 1 from jsonb_array_elements(v_huerf) e where (e->>'id')::uuid = v_legc.id) then
    raise exception 'FALLA 1: la pata del grupo aparece como huérfano simple (debería excluirse)';
  end if;
  raise notice 'OK  1. grupo a medio cobrar: cobrado=tarjeta, falta=QR; excluido del huérfano simple';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2 · Resumir: se acredita la pata que faltaba y register_split_group cierra la
--     venta. El grupo deja de estar "a medio cobrar".
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
    v_pagos, v_card, 'SPLIT2R-C-0002', null, v_group, 'card');
  v_legq := public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_qr, 'SPLIT2R-Q-0002', null, v_group, 'qr');
  update public.payment_intents set status = 'approved' where id = v_legc.id;

  -- Resumir: la pata QR acredita (como el poll cuando el cliente por fin paga).
  update public.payment_intents set status = 'approved' where id = v_legq.id;

  v_res := public.register_split_group(
    '11111111-1111-1111-1111-111111111111', v_group,
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, 'SPLIT2R-S-0002');
  v_sale := (v_res->>'sale_id')::uuid;
  if (select payment_method from public.sales where id = v_sale) is distinct from 'split' then
    raise exception 'FALLA 2: resumir no registró la venta split';
  end if;

  -- Ya no está a medio cobrar.
  v_medio := public.grupos_a_medio_cobrar('11111111-1111-1111-1111-111111111111');
  if exists (select 1 from jsonb_array_elements(v_medio) e where (e->>'group_id')::uuid = v_group) then
    raise exception 'FALLA 2: el grupo sigue apareciendo a medio cobrar tras registrar';
  end if;
  raise notice 'OK  2. resumir: acredita la pata que faltaba → registra y sale del banner';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3 · Un grupo sin ninguna pata acreditada NO aparece (no hay plata en juego):
--     solo se recupera lo que ya se cobró.
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

  perform public.crear_intento_cobro_split(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    v_pagos, v_card, 'SPLIT2R-C-0003', null, v_group, 'card');
  -- Ninguna acreditó.

  v_medio := public.grupos_a_medio_cobrar('11111111-1111-1111-1111-111111111111');
  if exists (select 1 from jsonb_array_elements(v_medio) e where (e->>'group_id')::uuid = v_group) then
    raise exception 'FALLA 3: un grupo sin plata cobrada aparece a medio cobrar';
  end if;
  raise notice 'OK  3. grupo sin pata acreditada no aparece (nada que recuperar)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4 · Un cobro QR de split SIN grupo (Paso 2) sigue en el banner de huérfanos
--     simple (la exclusión es solo para patas de grupo).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_price numeric;
  v_qr    numeric;
  v_cash  numeric;
  v_intent public.payment_intents;
  v_huerf  jsonb;
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
    v_qr, 'SPLIT2R-Q-0004');  -- sin group_id: split QR de una sola pata (Paso 2)
  update public.payment_intents set status = 'approved' where id = v_intent.id;

  v_huerf := public.cobros_sin_venta('11111111-1111-1111-1111-111111111111');
  if not exists (select 1 from jsonb_array_elements(v_huerf) e where (e->>'id')::uuid = v_intent.id) then
    raise exception 'FALLA 4: el split QR sin grupo dejó de aparecer en el huérfano simple';
  end if;
  raise notice 'OK  4. split QR sin grupo (Paso 2) sigue en el banner de huérfanos simple';
end $$;
rollback;

\echo '=== split-dos-recuperar OK ==='
