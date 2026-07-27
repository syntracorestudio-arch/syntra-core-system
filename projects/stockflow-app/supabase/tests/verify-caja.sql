-- =============================================================================
-- StockFlow — tests de la caja (auditoría Tanda 2: M1/M2)
--
-- Transaccionales con ROLLBACK: no ensucian el seed. Impersona al dueño.
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-caja.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\set DUENO 'aaaaaaaa-0000-0000-0000-000000000001'

\echo ''
\echo '=== StockFlow — tests de caja (Tanda 2) ==='

-- ---------------------------------------------------------------------------
-- M2 · Reembolso de efectivo al anular. Una venta en efectivo de OTRO día,
--   anulada HOY, saca plata del cajón hoy → el efectivo esperado de hoy debe
--   BAJAR por ese monto. (La venta anulada el MISMO día netea sola y no cuenta.)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_ef_antes numeric;
  v_ef_desp  numeric;
  v_sale     jsonb;
  v_sale_id  uuid;
  v_total    numeric;
begin
  v_ef_antes := (public.cierre_caja('11111111-1111-1111-1111-111111111111', null) ->> 'efectivo_esperado')::numeric;

  -- Venta en efectivo, pero fechada AYER (cash que entró al cajón ayer).
  v_sale := public.register_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    'cash', 'M2-KEY-ayer-0001', null);
  v_sale_id := (v_sale->>'sale_id')::uuid;
  v_total := (v_sale->>'total')::numeric;
  update public.sales set sold_at = now() - interval '1 day' where id = v_sale_id;

  -- Anulada HOY: se devuelve el efectivo hoy.
  perform public.void_sale('11111111-1111-1111-1111-111111111111', v_sale_id, 'devolución');

  v_ef_desp := (public.cierre_caja('11111111-1111-1111-1111-111111111111', null) ->> 'efectivo_esperado')::numeric;

  if v_ef_desp is distinct from (v_ef_antes - v_total) then
    raise exception 'FALLA M2: efectivo esperado no bajó por el reembolso (antes=%, después=%, esperado=%). La anulación cross-día descuadra la caja.',
      v_ef_antes, v_ef_desp, v_ef_antes - v_total;
  end if;
  raise notice 'OK  M2. anular en efectivo (venta de otro día) baja el efectivo esperado de hoy';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- Aging de fiado (Tanda 3) · fiado_resumen calcula bien "debe desde" y "último
--   pago". Cliente que entra en rojo, vuelve a CERO, y entra en rojo otra vez:
--   debe_desde debe ser el arranque del ÚLTIMO tramo, no del primero.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_cli   uuid := 'aaaac000-0000-0000-0000-0000000000a1';
  v_res   jsonb;
  v_fila  jsonb;
  v_d5    date := (now() - interval '5 days')::date;
  v_d2    date := (now() - interval '2 days')::date;
begin
  insert into public.clients (id, store_id, name)
  values (v_cli, '11111111-1111-1111-1111-111111111111', 'Test Aging');

  -- -10: debe 1000 · -8: paga 1000 (vuelve a 0) · -5: debe 500 (rojo otra vez) · -2: paga 200
  insert into public.client_ledger (store_id, client_id, delta, reason, created_by, created_at) values
    ('11111111-1111-1111-1111-111111111111', v_cli, -1000, 'sale',    'aaaa1111-0000-0000-0000-000000000001', now() - interval '10 days'),
    ('11111111-1111-1111-1111-111111111111', v_cli,  1000, 'payment', 'aaaa1111-0000-0000-0000-000000000001', now() - interval '8 days'),
    ('11111111-1111-1111-1111-111111111111', v_cli,  -500, 'sale',    'aaaa1111-0000-0000-0000-000000000001', now() - interval '5 days'),
    ('11111111-1111-1111-1111-111111111111', v_cli,   200, 'payment', 'aaaa1111-0000-0000-0000-000000000001', now() - interval '2 days');

  v_res := public.fiado_resumen('11111111-1111-1111-1111-111111111111');
  select f into v_fila from jsonb_array_elements(v_res) f where f->>'client_id' = v_cli::text;

  if v_fila is null then raise exception 'FALLA aging: el cliente no vino en fiado_resumen'; end if;
  if (v_fila->>'balance')::numeric <> -300 then
    raise exception 'FALLA aging: balance % (esperado -300)', v_fila->>'balance';
  end if;
  if (v_fila->>'debe_desde')::date <> v_d5 then
    raise exception 'FALLA aging: debe_desde % (esperado % — arranque del ÚLTIMO tramo rojo)', v_fila->>'debe_desde', v_d5;
  end if;
  if (v_fila->>'ultimo_pago')::date <> v_d2 then
    raise exception 'FALLA aging: ultimo_pago % (esperado %)', v_fila->>'ultimo_pago', v_d2;
  end if;
  raise notice 'OK  aging. debe_desde resetea tras volver a cero; ultimo_pago correcto';
end $$;
rollback;

\echo ''
\echo '=== tests de caja: OK ==='
