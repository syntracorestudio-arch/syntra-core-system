-- =============================================================================
-- StockFlow — verificación automatizada del esquema y la RLS (tanda 1B)
--
-- Corre las validaciones del pie de seed.sql pero como ASSERTS: si algo falla,
-- la ejecución aborta con un mensaje claro en vez de obligar a leer tablas a ojo.
--
-- Uso:  psql "$DB_URL" -f supabase/tests/verify.sql
-- Requiere: 001 + 002 + seed ya aplicados (o sea, `supabase db reset`).
--
-- El test que MÁS importa es el bloque 4: suplanta a un usuario real con
-- `request.jwt.claims` y verifica que no vea un solo registro del otro negocio.
-- =============================================================================

\set ON_ERROR_STOP on
\timing off

do $$
declare
  v_version int;
  v_count   int;
  v_num     numeric;
  v_ok      boolean;
begin
  raise notice '';
  raise notice '=== StockFlow — verificación de esquema y RLS ===';

  ---------------------------------------------------------------------------
  -- 0. Requisito de versión (security_invoker necesita PG15+)
  ---------------------------------------------------------------------------
  select current_setting('server_version_num')::int / 10000 into v_version;
  if v_version < 15 then
    raise exception 'FALLA 0: PostgreSQL % — las vistas necesitan 15+', v_version;
  end if;
  raise notice 'OK  0. PostgreSQL % (>= 15)', v_version;

  ---------------------------------------------------------------------------
  -- 1. El cache de stock lo mantiene el trigger desde el ledger
  ---------------------------------------------------------------------------
  select stock into v_num from public.products
   where id = 'd1000000-0000-0000-0000-000000000001';
  if v_num is distinct from 24 then
    raise exception 'FALLA 1: Coca-Cola deberia tener stock 24 y tiene % — el trigger no corrio', v_num;
  end if;

  select stock into v_num from public.products
   where id = 'd1000000-0000-0000-0000-000000000004';
  if v_num is distinct from 3 then
    raise exception 'FALLA 1: Marlboro deberia tener stock 3 y tiene %', v_num;
  end if;
  raise notice 'OK  1. Cache de stock sincronizado con el ledger (24 / 3)';

  ---------------------------------------------------------------------------
  -- 2. Saldos de fiado DERIVADOS (nunca un contador mutable)
  ---------------------------------------------------------------------------
  select balance into v_num from public.client_balances
   where client_id = 'c2000000-0000-0000-0000-000000000001';
  if v_num is distinct from -12400 then
    raise exception 'FALLA 2: el saldo de Marta deberia ser -12400 y es %', v_num;
  end if;
  raise notice 'OK  2. Saldos de fiado derivados del ledger (Marta -12400)';

  ---------------------------------------------------------------------------
  -- 3. Stock bajo (umbral propio o default del negocio)
  ---------------------------------------------------------------------------
  select count(*) into v_count from public.low_stock_products
   where store_id = '11111111-1111-1111-1111-111111111111';
  if v_count <> 1 then
    raise exception 'FALLA 3: El Trebol deberia tener 1 producto en stock bajo y tiene %', v_count;
  end if;
  raise notice 'OK  3. Stock bajo detectado (solo Marlboro)';

  ---------------------------------------------------------------------------
  -- 5. APPEND-ONLY: los ledgers no se pueden modificar ni borrar
  ---------------------------------------------------------------------------
  v_ok := false;
  begin
    set local role authenticated;
    update public.stock_ledger set delta = 999 where true;
    set local role postgres;
  exception when others then
    v_ok := true;
    set local role postgres;
  end;
  if not v_ok then
    raise exception 'FALLA 5: se pudo MODIFICAR stock_ledger — el append-only no protege nada';
  end if;
  raise notice 'OK  5. stock_ledger es append-only (UPDATE rechazado)';

  ---------------------------------------------------------------------------
  -- 6. El cache de stock no se puede pisar a mano, pero el precio sí se edita
  ---------------------------------------------------------------------------
  v_ok := false;
  begin
    set local role authenticated;
    update public.products set stock = 999
     where id = 'd1000000-0000-0000-0000-000000000001';
    set local role postgres;
  exception when others then
    v_ok := true;
    set local role postgres;
  end;
  if not v_ok then
    raise exception 'FALLA 6: se pudo escribir products.stock a mano — el cache queda desincronizado';
  end if;
  raise notice 'OK  6. products.stock protegido por privilegio de columna';

  raise notice '';
end $$;

---------------------------------------------------------------------------
-- 4. AISLAMIENTO CROSS-TENANT — el test que de verdad importa.
--    Fuera del bloque DO porque `set local role` + jwt.claims necesita que las
--    policies se evalúen como el usuario suplantado, no como postgres.
---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.products;
  if v_count <> 5 then
    raise exception 'FUGA: el dueno de El Trebol ve % productos (deberia ver 5). Producto de otro negocio visible.', v_count;
  end if;

  select count(*) into v_count from public.stores;
  if v_count <> 1 then
    raise exception 'FUGA: ve % negocios (deberia ver 1)', v_count;
  end if;

  -- Las dos siguientes prueban security_invoker en las vistas: sin eso
  -- devuelven filas de los DOS negocios.
  select count(*) into v_count from public.client_balances;
  if v_count <> 2 then
    raise exception 'FUGA EN VISTA client_balances: ve % clientes (deberia ver 2)', v_count;
  end if;

  select count(*) into v_count from public.low_stock_products;
  if v_count <> 1 then
    raise exception 'FUGA EN VISTA low_stock_products: ve % filas (deberia ver 1)', v_count;
  end if;

  select count(*) into v_count from public.client_ledger;
  if v_count <> 3 then
    raise exception 'FUGA EN client_ledger: ve % asientos (deberia ver 3)', v_count;
  end if;

  raise notice 'OK  4. AISLAMIENTO CROSS-TENANT — ni un registro del otro negocio';
end $$;

rollback;

\echo ''
\echo '=== TODO VERDE — esquema, RLS y aislamiento verificados ==='
