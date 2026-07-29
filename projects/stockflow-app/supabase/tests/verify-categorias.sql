-- =============================================================================
-- StockFlow — tests de categorias_resumen (chips + drill-down, migración 036)
--
-- La única fuente de verdad de los contadores de categoría. Antes cada pantalla
-- contaba sobre el subset que tenía cargado (con catálogo grande = números falsos).
-- Acá se verifica: conteos correctos por categoría, el bucket "Sin categoría",
-- stock_bajo con la MISMA definición que la vista low_stock_products, ventana de
-- 14 días para el uso, cota de categorías, gate de miembro, y el filtro
-- p_solo_sin_categoria de productos_buscar.
--
-- Transaccionales con ROLLBACK. Impersona al dueño del fixture (El Trébol).
-- Uso: docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 < supabase/tests/verify-categorias.sql
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\set DUENO 'aaaaaaaa-0000-0000-0000-000000000001'

\echo ''
\echo '=== StockFlow — tests de categorias_resumen ==='

-- ---------------------------------------------------------------------------
-- 1 · Conteos por categoría del fixture + bucket "Sin categoría" con la deuda
--     completa (productos / stock_bajo / sin_costo).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
  v_beb   jsonb;
  v_cig   jsonb;
  v_sin   jsonb;
begin
  -- Deuda: un producto SIN categoría, SIN costo y con stock 0 (también es stock bajo).
  insert into public.products (store_id, name, price, stock, emoji)
  values (v_store, 'Producto suelto sin rubro', 700, 0, '📦');

  v_res := public.categorias_resumen(v_store);

  select e into v_beb from jsonb_array_elements(v_res->'categorias') e where e->>'name' = 'Bebidas';
  if v_beb is null or (v_beb->>'productos')::int <> 2 then
    raise exception 'FALLA 1: Bebidas debería tener 2 productos y tiene % (%)', v_beb->>'productos', v_beb;
  end if;
  if (v_beb->>'stock_bajo')::int <> 0 then
    raise exception 'FALLA 1: Bebidas no tiene stock bajo en el fixture (%)', v_beb->>'stock_bajo';
  end if;

  -- Cigarrillos: Marlboro está en 3 con umbral 4 → stock_bajo = 1, la MISMA
  -- definición que la vista de alertas.
  select e into v_cig from jsonb_array_elements(v_res->'categorias') e where e->>'name' = 'Cigarrillos';
  if (v_cig->>'productos')::int <> 1 or (v_cig->>'stock_bajo')::int <> 1 then
    raise exception 'FALLA 1: Cigarrillos esperaba 1 producto / 1 stock_bajo (%)', v_cig;
  end if;

  -- El bucket de la deuda: 1 producto, 1 stock bajo, 1 sin costo.
  v_sin := v_res->'sin_categoria';
  if (v_sin->>'productos')::int <> 1
     or (v_sin->>'stock_bajo')::int <> 1
     or (v_sin->>'sin_costo')::int <> 1 then
    raise exception 'FALLA 1: sin_categoria esperaba 1/1/1 y vino %', v_sin;
  end if;
  raise notice 'OK  1. conteos por categoría + bucket Sin categoría (productos/stock_bajo/sin_costo)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 2 · vendidas_14d: cuenta SOLO la ventana de 14 días (cota de fecha).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store  uuid := '11111111-1111-1111-1111-111111111111';
  v_member uuid;
  v_sale   uuid;
  v_res    jsonb;
  v_beb    jsonb;
  v_base   numeric;
begin
  select id into v_member from public.members where store_id = v_store limit 1;

  -- Base ANTES de insertar (el fixture ya tiene ventas propias): se afirma el DELTA.
  v_res := public.categorias_resumen(v_store);
  select coalesce((e->>'vendidas_14d')::numeric, 0) into v_base
    from jsonb_array_elements(v_res->'categorias') e where e->>'name' = 'Bebidas';

  -- Venta ADENTRO de la ventana: 3 Coca-Colas hace 2 días.
  insert into public.sales (store_id, member_id, total, payment_method, status, idempotency_key, sold_at)
  values (v_store, v_member, 5400, 'cash', 'completed', 'CAT-14D-IN', now() - interval '2 days')
  returning id into v_sale;
  insert into public.sale_items (sale_id, store_id, product_id, product_name, qty, unit_price, line_total)
  values (v_sale, v_store, 'd1000000-0000-0000-0000-000000000001', 'Coca-Cola 500ml', 3, 1800, 5400);

  -- Venta FUERA de la ventana: 5 más hace 20 días (no deben contar).
  insert into public.sales (store_id, member_id, total, payment_method, status, idempotency_key, sold_at)
  values (v_store, v_member, 9000, 'cash', 'completed', 'CAT-14D-OUT', now() - interval '20 days')
  returning id into v_sale;
  insert into public.sale_items (sale_id, store_id, product_id, product_name, qty, unit_price, line_total)
  values (v_sale, v_store, 'd1000000-0000-0000-0000-000000000001', 'Coca-Cola 500ml', 5, 1800, 9000);

  v_res := public.categorias_resumen(v_store);
  select e into v_beb from jsonb_array_elements(v_res->'categorias') e where e->>'name' = 'Bebidas';
  -- Delta = +3 (la venta de adentro) y NO +8 (la de hace 20 días no puede contar).
  if (v_beb->>'vendidas_14d')::numeric - v_base is distinct from 3 then
    raise exception 'FALLA 2: delta de vendidas_14d = % (esperado +3: la venta de hace 20 días no cuenta)',
      (v_beb->>'vendidas_14d')::numeric - v_base;
  end if;
  raise notice 'OK  2. vendidas_14d respeta la ventana de 14 días (delta +3, base %)', v_base;
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 3 · Cota dura: nunca más de 100 categorías en la respuesta.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
  v_n     int;
begin
  insert into public.categories (store_id, name, sort)
  select v_store, 'cat-relleno-' || g, 100 + g from generate_series(1, 150) g;

  v_res := public.categorias_resumen(v_store);
  select count(*) into v_n from jsonb_array_elements(v_res->'categorias');
  if v_n > 100 then
    raise exception 'FALLA 3: devolvió % categorías (cota: 100)', v_n;
  end if;
  raise notice 'OK  3. cota de 100 categorías aplicada (con 154 en la base devolvió %)', v_n;
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 4 · Gate de miembro: un store ajeno → not_a_member.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
begin
  begin
    perform public.categorias_resumen('22222222-2222-2222-2222-222222222222');
    raise exception 'FALLA 4: dejó consultar un store ajeno';
  exception when others then
    if sqlerrm not like '%not_a_member%' then raise; end if;
  end;
  raise notice 'OK  4. member-gated (not_a_member)';
end $$;
rollback;

-- ---------------------------------------------------------------------------
-- 5 · productos_buscar con p_solo_sin_categoria: devuelve SOLO los sin categoría
--     (la deuda es seleccionable), combina con búsqueda, e ignora p_categoria.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claim.sub', :'DUENO', true);
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_cat   uuid;
  v_res   jsonb;
  v_n     int;
  v_malos int;
begin
  insert into public.products (store_id, name, price, stock, emoji)
  values (v_store, 'Huerfano uno', 500, 5, '📦'),
         (v_store, 'Huerfano dos', 800, 5, '📦');

  -- Solo sin categoría: 2 filas, ninguna con category_id.
  v_res := public.productos_buscar(v_store, null, null, 50, 0, true);
  select count(*),
         count(*) filter (where (e->>'category_id') is not null)
    into v_n, v_malos
    from jsonb_array_elements(v_res->'items') e;
  if v_n <> 2 or v_malos <> 0 then
    raise exception 'FALLA 5: solo_sin_categoria devolvió % filas (% con categoría)', v_n, v_malos;
  end if;

  -- Combinado con búsqueda.
  v_res := public.productos_buscar(v_store, 'huerfano uno', null, 50, 0, true);
  if (v_res->>'total')::int <> 1 then
    raise exception 'FALLA 5: con búsqueda esperaba 1 y vino %', v_res->>'total';
  end if;

  -- p_categoria se ignora cuando el flag está prendido.
  select id into v_cat from public.categories where store_id = v_store and name = 'Bebidas' limit 1;
  v_res := public.productos_buscar(v_store, null, v_cat, 50, 0, true);
  if (v_res->>'total')::int <> 2 then
    raise exception 'FALLA 5: con flag prendido p_categoria debería ignorarse (total=%)', v_res->>'total';
  end if;

  -- Y con el flag apagado, la firma vieja sigue intacta (Bebidas: 2 del fixture).
  v_res := public.productos_buscar(v_store, null, v_cat, 50, 0);
  if (v_res->>'total')::int <> 2 then
    raise exception 'FALLA 5: la firma de 5 args cambió de comportamiento (total=%)', v_res->>'total';
  end if;
  raise notice 'OK  5. p_solo_sin_categoria: solo la deuda, combina con q, ignora p_categoria, firma vieja intacta';
end $$;
rollback;

\echo '=== categorias_resumen OK ==='
