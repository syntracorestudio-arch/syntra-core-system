-- =============================================================================
-- StockFlow — tests de los bugs de PÉRDIDA DE PLATA (auditoría, Tanda 1)
--
-- Reproduce los escenarios exactos de H1/H2/H3/H3b como ASSERTS. Cada bloque va
-- en su propia transacción con ROLLBACK: NO ensucia el seed ni el estado local
-- (no hace falta `db reset`). Impersona al dueño con request.jwt.claim.sub
-- porque las RPC resuelven al caller con auth.uid().
--
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-money-loss.sql
-- Requiere 001..021 + seed aplicados.
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on

\set TREBOL '11111111-1111-1111-1111-111111111111'
\set DUENO  'aaaaaaaa-0000-0000-0000-000000000001'
\set COCA   'd1000000-0000-0000-0000-000000000001'

\echo ''
\echo '=== StockFlow — tests de pérdida de plata (Tanda 1) ==='

-- ---------------------------------------------------------------------------
-- H1 · La key de idempotencia NO puede reusarse para un carrito DISTINTO.
--   Escenario: se commitea la venta A con la key K (respuesta perdida). El
--   cajero vacía y cobra OTRO carrito B con la MISMA key. Hoy register_sale
--   devuelve la venta A como replayed=true → el POS muestra "Cobrado" y pierde
--   la venta B. Debe RECHAZAR con idempotency_key_reused. Un replay del MISMO
--   carrito sí es legítimo (reintento de red) y debe seguir devolviendo replayed.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_a jsonb; v_b jsonb; v_replay jsonb; v_raised boolean := false;
begin
  -- Venta A con la key K
  v_a := public.register_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    'cash', 'H1-KEY-fixed-0001', null);

  -- Mismo carrito, misma key: reintento legítimo → replayed=true, misma venta.
  v_replay := public.register_sale('11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    'cash', 'H1-KEY-fixed-0001', null);
  if (v_replay->>'replayed')::boolean is not true
     or (v_replay->>'sale_id') <> (v_a->>'sale_id') then
    raise exception 'FALLA H1a: el reintento del MISMO carrito debería devolver replayed=true de la misma venta (dio %).', v_replay;
  end if;

  -- Carrito DISTINTO, misma key: debe rechazar.
  begin
    v_b := public.register_sale('11111111-1111-1111-1111-111111111111',
      '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":2}]'::jsonb,
      'cash', 'H1-KEY-fixed-0001', null);
  exception when others then
    if sqlerrm like '%idempotency_key_reused%' then v_raised := true;
    else raise; end if;
  end;
  if not v_raised then
    raise exception 'FALLA H1b: key reusada con carrito DISTINTO no fue rechazada (dio %) — se pierde una venta bajo un toast de éxito.', v_b;
  end if;

  raise notice 'OK  H1. reintento mismo carrito=replayed; carrito distinto=rechazado';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- H3 · El monto del cobro QR se recomputa del CATÁLOGO, no se confía en el
--   número del cliente. Escenario: la caja pide un cobro por [Coca x1] pero
--   manda un p_amount MENTIROSO ($1). El intent debe quedar con el precio real
--   del catálogo, no con el $1.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_expected numeric;
  v_intent   public.payment_intents;
begin
  select price into v_expected from public.products
   where id = 'd1000000-0000-0000-0000-000000000001';

  v_intent := public.crear_intento_cobro(
    '11111111-1111-1111-1111-111111111111',
    '[{"product_id":"d1000000-0000-0000-0000-000000000001","qty":1}]'::jsonb,
    1,                              -- p_amount MENTIROSO: $1
    'H3-KEY-crear-0001', null);

  if v_intent.amount is distinct from v_expected then
    raise exception 'FALLA H3: intent.amount=% (esperado % del catálogo) — se confió en el monto del cliente.', v_intent.amount, v_expected;
  end if;
  raise notice 'OK  H3. crear_intento_cobro recomputa del catálogo (ignora el p_amount del cliente)';
end $$;
rollback;

\echo ''
\echo '=== tests de pérdida de plata: OK ==='
