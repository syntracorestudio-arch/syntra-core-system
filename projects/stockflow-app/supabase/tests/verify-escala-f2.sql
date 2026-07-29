-- =============================================================================
-- StockFlow — tests de ESCALA · Fase 2 (search-first: el catálogo deja de viajar)
--
-- Contexto (docs/inventario-escala-audit.md): el POS precargaba 500 productos +
-- ~5000 sale_items (para rankear en el cliente) + ~1750 códigos + ~300 clientes =
-- 477 KB de documento. Fase 2 mueve ranking, búsqueda y filtro a la BASE.
--
-- Transaccionales con ROLLBACK. Impersona al dueño.
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-escala-f2.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\set DUENO 'aaaaaaaa-0000-0000-0000-000000000001'

\echo ''
\echo '=== StockFlow — tests de escala Fase 2 (búsqueda y ranking server-side) ==='

-- ---------------------------------------------------------------------------
-- 1 · Búsqueda por NOMBRE: encuentra "contiene", sin importar mayúsculas NI
--     acentos (la búsqueda en memoria era sensible a acentos: "limon" no
--     encontraba "Limón"). Y encuentra productos MÁS ALLÁ de cualquier tope de
--     precarga.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_id    uuid;
  v_res   jsonb;
  v_n     int;
begin
  -- Relleno para que el producto de la verdad quede lejos de cualquier tope.
  insert into public.products (store_id, name, price, emoji)
  select v_store, 'zz-relleno-f2-' || lpad(g::text, 4, '0'), 100, '📦'
    from generate_series(1, 600) g;

  insert into public.products (store_id, name, price, stock, emoji)
  values (v_store, 'Jugo de Limón Exprimido', 1750, 9, '🍋')
  returning id into v_id;

  -- Sin acentos y en minúsculas: tiene que encontrarlo igual.
  v_res := public.productos_buscar(v_store, 'limon exprimido', null, 50, 0);
  select count(*) into v_n
    from jsonb_array_elements(v_res->'items') e where (e->>'id')::uuid = v_id;
  if v_n <> 1 then
    raise exception 'FALLA 1: "limon exprimido" no encontró el producto con acento (items=%)', v_res->'items';
  end if;

  -- En mayúsculas y con acento: idem.
  v_res := public.productos_buscar(v_store, 'LIMÓN', null, 50, 0);
  select count(*) into v_n
    from jsonb_array_elements(v_res->'items') e where (e->>'id')::uuid = v_id;
  if v_n <> 1 then
    raise exception 'FALLA 1: "LIMÓN" no lo encontró';
  end if;

  -- Contiene (no solo empieza con): "exprimido" está en el medio del nombre.
  v_res := public.productos_buscar(v_store, 'exprimido', null, 50, 0);
  if (v_res->>'total')::int < 1 then
    raise exception 'FALLA 1: la búsqueda no es "contiene"';
  end if;
  raise notice 'OK  1. nombre: contiene + insensible a mayúsculas y acentos, más allá del tope';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2 · Búsqueda por CÓDIGO de barras (empieza con) y filtro por categoría.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_cat   uuid;
  v_id    uuid;
  v_res   jsonb;
  v_n     int;
begin
  select id into v_cat from public.categories where store_id = v_store and name = 'Bebidas' limit 1;

  insert into public.products (store_id, category_id, name, price, stock, emoji)
  values (v_store, v_cat, 'Producto con código propio', 2200, 4, '🥤')
  returning id into v_id;
  insert into public.product_barcodes (store_id, product_id, barcode)
  values (v_store, v_id, '7798888777666');

  -- Prefijo del código.
  v_res := public.productos_buscar(v_store, '779888877', null, 50, 0);
  select count(*) into v_n
    from jsonb_array_elements(v_res->'items') e where (e->>'id')::uuid = v_id;
  if v_n <> 1 then
    raise exception 'FALLA 2: no encontró por prefijo de código';
  end if;

  -- Filtro por categoría + búsqueda (determinista: el catálogo puede tener cientos
  -- de productos en la categoría y la página tiene techo).
  v_res := public.productos_buscar(v_store, 'con código propio', v_cat, 50, 0);
  select count(*) into v_n
    from jsonb_array_elements(v_res->'items') e where (e->>'id')::uuid = v_id;
  if v_n <> 1 then
    raise exception 'FALLA 2: el filtro por categoría no lo trajo';
  end if;

  -- Y con una categoría distinta, NO aparece (aunque el nombre matchee).
  select id into v_cat from public.categories where store_id = v_store and name = 'Golosinas' limit 1;
  v_res := public.productos_buscar(v_store, 'con código propio', v_cat, 50, 0);
  select count(*) into v_n
    from jsonb_array_elements(v_res->'items') e where (e->>'id')::uuid = v_id;
  if v_n <> 0 then
    raise exception 'FALLA 2: apareció en una categoría que no es la suya';
  end if;
  raise notice 'OK  2. código por prefijo + filtro por categoría';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3 · Cotas DURAS: p_limit se clampea aunque pidan 10.000, y la paginación
--     (offset) no repite ni saltea filas. `total` es el conteo REAL.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
  v_n     int;
  v_p1    jsonb;
  v_p2    jsonb;
  v_dup   int;
  v_total int;
begin
  insert into public.products (store_id, name, price, emoji)
  select v_store, 'zz-pag-' || lpad(g::text, 4, '0'), 100, '📦'
    from generate_series(1, 300) g;

  -- Pedir 10.000 no puede devolver 10.000.
  v_res := public.productos_buscar(v_store, null, null, 10000, 0);
  select count(*) into v_n from jsonb_array_elements(v_res->'items');
  if v_n > 100 then
    raise exception 'FALLA 3: devolvió % filas (el clamp de 100 no se aplicó)', v_n;
  end if;

  -- `total` refleja el catálogo real, no la página.
  v_total := (v_res->>'total')::int;
  if v_total < 300 then
    raise exception 'FALLA 3: total=% no refleja el catálogo real', v_total;
  end if;

  -- Paginación sin solapamiento.
  v_p1 := public.productos_buscar(v_store, 'zz-pag', null, 50, 0);
  v_p2 := public.productos_buscar(v_store, 'zz-pag', null, 50, 50);
  select count(*) into v_dup
    from jsonb_array_elements(v_p1->'items') a
    join jsonb_array_elements(v_p2->'items') b on (a->>'id') = (b->>'id');
  if v_dup <> 0 then
    raise exception 'FALLA 3: las páginas 1 y 2 comparten % filas', v_dup;
  end if;
  select count(*) into v_n from jsonb_array_elements(v_p2->'items');
  if v_n = 0 then
    raise exception 'FALLA 3: la página 2 vino vacía';
  end if;
  raise notice 'OK  3. clamp de limit, total real y paginación sin solapamiento';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4 · pos_destacados: rankea por ventas de 14 días EN LA BASE, viene acotado y
--     trae los códigos de cada tile (para que escanear un top-seller sea instantáneo).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store  uuid := '11111111-1111-1111-1111-111111111111';
  v_member uuid;
  v_top    uuid;
  v_flojo  uuid;
  v_sale   uuid;
  v_res    jsonb;
  v_n      int;
  v_pos_t  int;
  v_pos_f  int;
  i        int;
begin
  select id into v_member from public.members where store_id = v_store limit 1;

  insert into public.products (store_id, name, price, stock, emoji)
  values (v_store, 'zz-estrella-del-mostrador', 1000, 100, '⭐')
  returning id into v_top;
  insert into public.product_barcodes (store_id, product_id, barcode)
  values (v_store, v_top, '7791111111111');

  insert into public.products (store_id, name, price, stock, emoji)
  values (v_store, 'zz-casi-no-se-vende', 1000, 100, '🐌')
  returning id into v_flojo;

  -- La estrella se vendió 30 veces en la ventana; el flojo, 1 vez.
  for i in 1..30 loop
    insert into public.sales (store_id, member_id, total, payment_method, status, idempotency_key, sold_at)
    values (v_store, v_member, 1000, 'cash', 'completed', 'F2-TOP-' || i::text, now() - interval '2 days')
    returning id into v_sale;
    insert into public.sale_items (sale_id, store_id, product_id, product_name, qty, unit_price, line_total)
    values (v_sale, v_store, v_top, 'zz-estrella-del-mostrador', 1, 1000, 1000);
  end loop;

  insert into public.sales (store_id, member_id, total, payment_method, status, idempotency_key, sold_at)
  values (v_store, v_member, 1000, 'cash', 'completed', 'F2-FLOJO-1', now() - interval '2 days')
  returning id into v_sale;
  insert into public.sale_items (sale_id, store_id, product_id, product_name, qty, unit_price, line_total)
  values (v_sale, v_store, v_flojo, 'zz-casi-no-se-vende', 1, 1000, 1000);

  v_res := public.pos_destacados(v_store, 24);
  select count(*) into v_n from jsonb_array_elements(v_res);
  if v_n > 24 then
    raise exception 'FALLA 4: devolvió % tiles (pidió 24)', v_n;
  end if;

  -- La estrella tiene que estar, y ANTES que el flojo.
  select min(ord) into v_pos_t from (
    select row_number() over () as ord, e from jsonb_array_elements(v_res) e
  ) t where (t.e->>'id')::uuid = v_top;
  if v_pos_t is null then
    raise exception 'FALLA 4: el más vendido no está en los destacados';
  end if;
  select min(ord) into v_pos_f from (
    select row_number() over () as ord, e from jsonb_array_elements(v_res) e
  ) t where (t.e->>'id')::uuid = v_flojo;
  if v_pos_f is not null and v_pos_t > v_pos_f then
    raise exception 'FALLA 4: el ranking no ordena por ventas (top=% flojo=%)', v_pos_t, v_pos_f;
  end if;

  -- El tile trae SU código: sin esto, escanear un top-seller pagaría round-trip.
  select count(*) into v_n
    from jsonb_array_elements(v_res) e
   where (e->>'id')::uuid = v_top
     and e->'barcodes' @> '["7791111111111"]'::jsonb;
  if v_n <> 1 then
    raise exception 'FALLA 4: el destacado no trae sus códigos de barras';
  end if;

  -- Clamp duro también acá.
  v_res := public.pos_destacados(v_store, 9999);
  select count(*) into v_n from jsonb_array_elements(v_res);
  if v_n > 60 then
    raise exception 'FALLA 4: pidió 9999 y devolvió % (sin clamp)', v_n;
  end if;
  raise notice 'OK  4. destacados: ranking en la base, acotado, con códigos';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 5 · Un negocio SIN ventas igual ve tiles (kiosco nuevo): cae a productos con
--     precio y stock, alfabético. Nunca una grilla vacía.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
  v_n     int;
begin
  -- Borramos las ventas de la ventana (en la transacción, se revierte).
  delete from public.sale_items si using public.sales s
   where si.sale_id = s.id and s.store_id = v_store and s.sold_at > now() - interval '14 days';
  delete from public.sales where store_id = v_store and sold_at > now() - interval '14 days';

  v_res := public.pos_destacados(v_store, 24);
  select count(*) into v_n from jsonb_array_elements(v_res);
  if v_n = 0 then
    raise exception 'FALLA 5: sin ventas, la caja quedó sin tiles (kiosco nuevo ve grilla vacía)';
  end if;
  raise notice 'OK  5. sin ventas hay fallback: % tiles', v_n;
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 6 · Aislamiento por negocio + gate de miembro en las tres RPC nuevas.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_otro uuid := '22222222-2222-2222-2222-222222222222';
begin
  begin
    perform public.productos_buscar(v_otro, 'a', null, 10, 0);
    raise exception 'FALLA 6: productos_buscar dejó consultar un store ajeno';
  exception when others then
    if sqlerrm not like '%not_a_member%' then raise; end if;
  end;
  begin
    perform public.pos_destacados(v_otro, 10);
    raise exception 'FALLA 6: pos_destacados dejó consultar un store ajeno';
  exception when others then
    if sqlerrm not like '%not_a_member%' then raise; end if;
  end;
  begin
    perform public.clientes_buscar(v_otro, null, 10);
    raise exception 'FALLA 6: clientes_buscar dejó consultar un store ajeno';
  exception when others then
    if sqlerrm not like '%not_a_member%' then raise; end if;
  end;
  raise notice 'OK  6. las tres RPC nuevas son member-gated (not_a_member)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 7 · NO REGRESIÓN de Fase 1: el resolver de escaneo sigue encontrando un
--     producto más allá de cualquier tope de precarga.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_id    uuid;
  v_res   jsonb;
begin
  insert into public.products (store_id, name, price, stock, emoji)
  select v_store, 'zzz-fuera-de-todo-tope-' || g::text, 500, 3, '📦'
    from generate_series(1, 700) g;

  insert into public.products (store_id, name, price, stock, emoji)
  values (v_store, 'zzzz-el-ultimo-de-todos', 3300, 2, '🎯')
  returning id into v_id;
  insert into public.product_barcodes (store_id, product_id, barcode)
  values (v_store, v_id, '7790000000001');

  v_res := public.producto_por_codigo(v_store, '7790000000001');
  if v_res is null or (v_res->>'id')::uuid is distinct from v_id then
    raise exception 'FALLA 7: REGRESIÓN de Fase 1 — el escaneo ya no encuentra el producto';
  end if;
  raise notice 'OK  7. sin regresión: el escaneo de Fase 1 sigue resolviendo contra la base';
end $$;
rollback;

\echo '=== escala Fase 2 OK ==='
