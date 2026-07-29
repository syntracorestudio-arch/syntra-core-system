-- =============================================================================
-- StockFlow — tests de ESCALA · Fase 1 (RIESGO 0: el escaneo no puede depender
-- del catálogo precargado)
--
-- Contexto (docs/inventario-escala-audit.md): el POS precarga `products` con
-- `.limit(500)` ordenado por NOMBRE. Con 800-2000 SKUs, todo lo alfabéticamente
-- tardío queda afuera; el índice de escaneo del cliente se arma SOLO con ese array,
-- así que escanear un producto que EXISTE fallaba y el cajero terminaba dando de
-- alta un DUPLICADO con stock 0.
--
-- `producto_por_codigo` resuelve el código contra la BASE, no contra el precargado.
--
-- Transaccionales con ROLLBACK. Impersona al dueño.
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-escala.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\set DUENO 'aaaaaaaa-0000-0000-0000-000000000001'
\set AJENO 'aaaaaaaa-0000-0000-0000-000000000003'

\echo ''
\echo '=== StockFlow — tests de escala (Fase 1: resolver de escaneo) ==='

-- ---------------------------------------------------------------------------
-- 1 · RIESGO 0: un producto MÁS ALLÁ del corte de 500 (alfabéticamente último)
--     se encuentra por su código. Es el test que reproduce la corrupción:
--     antes, la caja no lo veía y ofrecía alta rápida → producto duplicado.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_id    uuid;
  v_res   jsonb;
  v_pos   int;
begin
  -- Sembramos 600 productos con nombres que ordenan DESPUÉS de todo lo existente
  -- ("zz-relleno-000"…), de modo que el catálogo del store supere holgadamente 500.
  insert into public.products (store_id, name, price, emoji)
  select v_store, 'zz-relleno-' || lpad(g::text, 4, '0'), 100, '📦'
    from generate_series(1, 600) g;

  -- Y el producto de la verdad: el ÚLTIMO de todos por orden alfabético.
  insert into public.products (store_id, name, price, stock, emoji)
  values (v_store, 'zzz-ultimo-del-catalogo', 1500, 7, '🥤')
  returning id into v_id;

  insert into public.product_barcodes (store_id, product_id, barcode)
  values (v_store, v_id, '7790999888777');

  -- Sanity: con el precargado de la caja (order by name, limit 500) este producto
  -- NO entra. Ese es exactamente el agujero que cerramos.
  select count(*) into v_pos
    from (select id from public.products
           where store_id = v_store and status = 'active'
           order by name limit 500) top500
   where top500.id = v_id;
  if v_pos <> 0 then
    raise exception 'FALLA 1 (setup): el producto quedó DENTRO del top 500; el test no prueba nada';
  end if;

  -- La prueba: por código, la base lo encuentra igual.
  v_res := public.producto_por_codigo(v_store, '7790999888777');
  if v_res is null then
    raise exception 'FALLA 1: producto fuera del corte de 500 NO se encontró por código (RIESGO 0 vivo)';
  end if;
  if (v_res->>'id')::uuid is distinct from v_id then
    raise exception 'FALLA 1: devolvió otro producto (%)', v_res->>'id';
  end if;
  if (v_res->>'name') is distinct from 'zzz-ultimo-del-catalogo' then
    raise exception 'FALLA 1: nombre equivocado (%)', v_res->>'name';
  end if;
  if (v_res->>'price')::numeric is distinct from 1500 or (v_res->>'stock')::numeric is distinct from 7 then
    raise exception 'FALLA 1: precio/stock equivocados (% / %)', v_res->>'price', v_res->>'stock';
  end if;
  raise notice 'OK  1. producto fuera del corte de 500 se encuentra por código (RIESGO 0 cerrado)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2 · Código inexistente → null (y NO excepción): la caja distingue "no está"
--     para recién ahí ofrecer el alta rápida.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_res jsonb;
begin
  v_res := public.producto_por_codigo('11111111-1111-1111-1111-111111111111', '0000000000000');
  if v_res is not null then
    raise exception 'FALLA 2: devolvió algo para un código inexistente (%)', v_res;
  end if;
  raise notice 'OK  2. código inexistente → null (la caja puede ofrecer alta rápida)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3 · Un producto ARCHIVADO se resuelve igual, marcado `archivado`. Antes caía
--     en "no existe" → alta rápida → duplicado del mismo producto dado de baja.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_id    uuid;
  v_res   jsonb;
begin
  insert into public.products (store_id, name, price, emoji, status)
  values (v_store, 'Producto dado de baja', 900, '📦', 'archived')
  returning id into v_id;
  insert into public.product_barcodes (store_id, product_id, barcode)
  values (v_store, v_id, '7791111222333');

  v_res := public.producto_por_codigo(v_store, '7791111222333');
  if v_res is null then
    raise exception 'FALLA 3: un producto archivado no se resolvió (caería en alta rápida → duplicado)';
  end if;
  if (v_res->>'archivado')::boolean is distinct from true then
    raise exception 'FALLA 3: no vino marcado como archivado (%)', v_res->>'archivado';
  end if;
  raise notice 'OK  3. producto archivado se resuelve y viene marcado (no se duplica)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4 · Aislamiento por negocio: el código de OTRO store no se resuelve, y un
--     miembro ajeno no puede consultar este store (gate de miembro).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_otro  uuid := '22222222-2222-2222-2222-222222222222';
  v_id    uuid;
  v_res   jsonb;
begin
  -- Código que vive en el OTRO negocio.
  insert into public.products (store_id, name, price, emoji)
  values (v_otro, 'Producto del otro kiosco', 500, '📦')
  returning id into v_id;
  insert into public.product_barcodes (store_id, product_id, barcode)
  values (v_otro, v_id, '7795555444333');

  -- Desde MI store, ese código no existe.
  v_res := public.producto_por_codigo(v_store, '7795555444333');
  if v_res is not null then
    raise exception 'FALLA 4: resolvió un código de otro negocio (cross-tenant)';
  end if;

  -- Y consultar el store ajeno explícitamente → not_a_member.
  begin
    perform public.producto_por_codigo(v_otro, '7795555444333');
    raise exception 'FALLA 4: un no-miembro pudo consultar el store ajeno';
  exception when others then
    if sqlerrm not like '%not_a_member%' then raise; end if;
  end;
  raise notice 'OK  4. aislado por negocio + gate de miembro (not_a_member)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 5 · Cotas del baseline: las funciones que serializaban listas sin techo ahora
--     tienen LIMIT. Se siembra stock bajo masivo y se verifica que el JSON no
--     crezca sin control (antes: cientos de filas para pintar 4 y 5).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_al    jsonb;
  v_dash  jsonb;
  v_nlow  int;
  v_nrep  int;
begin
  -- 300 productos con stock 0 → todos caen en low_stock / restock.
  insert into public.products (store_id, name, price, stock, emoji)
  select v_store, 'zz-bajo-' || lpad(g::text, 4, '0'), 100, 0, '📦'
    from generate_series(1, 300) g;

  v_al := public.store_alerts(v_store);
  select count(*) into v_nlow from jsonb_array_elements(v_al->'low_stock');
  if v_nlow > 50 then
    raise exception 'FALLA 5: store_alerts.low_stock devolvió % filas (sin cota)', v_nlow;
  end if;

  v_dash := public.dashboard_summary(v_store);
  select count(*) into v_nrep from jsonb_array_elements(v_dash->'restock');
  if v_nrep > 50 then
    raise exception 'FALLA 5: dashboard_summary.restock devolvió % filas (sin cota)', v_nrep;
  end if;
  raise notice 'OK  5. cotas aplicadas: low_stock=% restock=% (con 300 productos en cero)', v_nlow, v_nrep;
end $$;
rollback;

\echo '=== escala OK ==='
