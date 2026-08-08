-- StockFlow — VERIFY: Promociones Fase 2, precio por cantidad (migración 048)
--
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/verify-promos-cantidad.sql
--
-- Prerequisitos: supabase db reset (001..048) + seed.sql.
-- `verify-promos.sql` y `verify-promos-047.sql` tienen que seguir VERDES.
--
-- Éstas son las COSTURAS DE PLATA (TDD primero, pedido del owner):
--   1  create_promo acepta min_qty y rechaza fuera de rango (invalid_qty)
--   2  catálogo: con min_qty>1 el `price` expuesto es LISTA (a 1 unidad no hay
--      rebaja — un tachado sería mentira) + promo_min_qty/promo_unit_price
--   3  LA CUENTA: "2 x $1.000" llevando 3 cobra $1.600 EXACTOS, en dos filas
--      exactas (2×500 con promo · 1×600 sin promo)
--   4  qty < min_qty ⇒ todo a lista, sin promo_id (el que lleva 1 paga $600)
--   5  qty = múltiplo exacto ⇒ una sola fila, toda en promo
--   6  carrito mixto (cantidad + monto libre + producto común) pagado con
--      SPLIT: la suma cierra al centavo contra el total del server
--   7  void revierte stock y atribución exactos (las DOS filas)
--   8  idempotencia: replay ⇒ misma venta, sin duplicar stock ni filas
--   9  medición: la promo declara SOLO las unidades rebajadas, y el resignado
--      es (lista − unitario)·unidades_promo
--  10  una promo viva por producto DE CUALQUIER TIPO: precio + cantidad no
--      coexisten (promo_overlap); con p_reemplazar, reemplazo atómico con
--      herencia de list_price
--  11  below_cost evaluado sobre el UNITARIO del grupo
--  12  el motor de sugerencias NO toca productos con promo de cantidad viva
--  13  carteles exponen min_qty
--
-- NOTA DE PRIVILEGIOS: fixtures directos a `promos` como postgres; el resto
-- como authenticated (las RPCs resuelven al caller con auth.uid()).

\set ON_ERROR_STOP on
\timing off

begin;

\set store '11111111-1111-1111-1111-111111111111'
\set gas  'd8000000-0000-0000-0000-0000000000b1'
\set caro 'd8000000-0000-0000-0000-0000000000b2'
\set doble 'd8000000-0000-0000-0000-0000000000b3'
\set otro 'd8000000-0000-0000-0000-0000000000b4'

-- ===========================================================================
-- FIXTURES (rol postgres)
-- ===========================================================================
insert into public.products (id, store_id, name, emoji, cost, price, stock, status)
values (:'gas',  :'store', 'Gaseosa 048',   '🥤', 300, 600,  40, 'active'),
       (:'caro', :'store', 'Fernet 048',    '🍾', 550, 600,  10, 'active'),
       (:'doble',:'store', 'Alfajor 048',   '🍫', 200, 600,  30, 'active'),
       (:'otro', :'store', 'Chicle 048',    '🍬', 100, 200,  50, 'active')
on conflict (id) do update set cost = excluded.cost, price = excluded.price,
                               stock = excluded.stock, status = 'active';

insert into public.product_barcodes (store_id, product_id, barcode)
values (:'store', :'gas', '7790000000048')
on conflict do nothing;

-- ===========================================================================
-- BLOQUE OWNER — 1, 2, 3, 4, 5, 9 (creación, catálogo, la cuenta, medición)
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_gas   uuid := 'd8000000-0000-0000-0000-0000000000b1';
  v_hoy   date;
  v_res   jsonb;
  v_promo uuid;
  v_sale  uuid;
  v_it    jsonb;
  v_n     int;
  v_stock0 numeric;
  v_stock1 numeric;
begin
  v_hoy := public.store_hoy(v_store);

  -- ---- 1 · alta con min_qty; rangos ---------------------------------------
  begin
    perform public.create_promo(v_store, v_gas, 500, v_hoy, v_hoy + 5,
                                null, 'manual', false, false, 0);
    raise exception 'FALLO 1.a: aceptó min_qty 0';
  exception when others then
    if sqlerrm <> 'invalid_qty' then raise; end if;
  end;
  begin
    perform public.create_promo(v_store, v_gas, 500, v_hoy, v_hoy + 5,
                                null, 'manual', false, false, 25);
    raise exception 'FALLO 1.b: aceptó min_qty 25 (tope 24)';
  exception when others then
    if sqlerrm <> 'invalid_qty' then raise; end if;
  end;

  -- "2 x $1.000" = min_qty 2, unitario 500 (lista 600).
  v_res := public.create_promo(v_store, v_gas, 500, v_hoy, v_hoy + 5,
                               null, 'manual', false, false, 2);
  v_promo := (v_res->>'promo_id')::uuid;
  if v_promo is null then
    raise exception 'FALLO 1.c: no creó la promo de cantidad';
  end if;

  -- ---- 2 · catálogo: price = LISTA, claves nuevas -------------------------
  select value into v_it
    from jsonb_array_elements((public.productos_buscar(v_store, 'Gaseosa 048', null, 5, 0, false, false))->'items') t(value);
  if (v_it->>'price')::numeric <> 600 then
    raise exception 'FALLO 2.a: el catálogo expone % como precio — con min_qty>1 va la LISTA (600): a 1 unidad no hay rebaja', v_it->>'price';
  end if;
  if (v_it->>'promo_min_qty')::int <> 2 or (v_it->>'promo_unit_price')::numeric <> 500 then
    raise exception 'FALLO 2.b: faltan promo_min_qty/promo_unit_price (%/%)',
      v_it->>'promo_min_qty', v_it->>'promo_unit_price';
  end if;
  if v_it->>'promo_id' is null then
    raise exception 'FALLO 2.c: el catálogo no expone promo_id — la pantalla no puede decir "2 x $1.000"';
  end if;

  -- ídem por código de barras (el camino real del cajero).
  v_it := public.producto_por_codigo(v_store, '7790000000048');
  if (v_it->>'price')::numeric <> 600 or (v_it->>'promo_min_qty')::int <> 2 then
    raise exception 'FALLO 2.d: el escaneo no trae lista + min_qty (%/%)',
      v_it->>'price', v_it->>'promo_min_qty';
  end if;

  -- ---- 3 · LA CUENTA: 2 x $1.000 llevando 3 = $1.600 exactos --------------
  select stock into v_stock0 from public.products where id = v_gas;

  v_res := public.register_sale(
             v_store,
             jsonb_build_array(jsonb_build_object('product_id', v_gas, 'qty', 3)),
             'cash', 'qty-test-3u');
  v_sale := (v_res->>'sale_id')::uuid;

  if (v_res->>'total')::numeric <> 1600 then
    raise exception 'FALLO 3.a: esperaba total 1600 (2x500 + 1x600), vino %', v_res->>'total';
  end if;

  select count(*) into v_n from public.sale_items where sale_id = v_sale;
  if v_n <> 2 then
    raise exception 'FALLO 3.b: esperaba DOS filas (grupo + resto), hay %', v_n;
  end if;

  -- la fila del grupo: 2 × 500, con promo_id y list_price.
  if not exists (select 1 from public.sale_items
                  where sale_id = v_sale and qty = 2 and unit_price = 500
                    and line_total = 1000 and promo_id = v_promo and list_price = 600) then
    raise exception 'FALLO 3.c: la fila del grupo no es (2 × 500, promo, lista 600)';
  end if;
  -- la fila del resto: 1 × 600, SIN promo (invariante promo_id ⟺ list_price).
  if not exists (select 1 from public.sale_items
                  where sale_id = v_sale and qty = 1 and unit_price = 600
                    and line_total = 600 and promo_id is null and list_price is null) then
    raise exception 'FALLO 3.d: la fila del resto no es (1 × 600, sin promo)';
  end if;

  select stock into v_stock1 from public.products where id = v_gas;
  if v_stock1 <> v_stock0 - 3 then
    raise exception 'FALLO 3.e: el stock bajó % (esperaba 3)', v_stock0 - v_stock1;
  end if;

  -- ---- 4 · qty 1 < min_qty ⇒ paga lista, sin promo ------------------------
  v_res := public.register_sale(
             v_store,
             jsonb_build_array(jsonb_build_object('product_id', v_gas, 'qty', 1)),
             'cash', 'qty-test-1u');
  if (v_res->>'total')::numeric <> 600 then
    raise exception 'FALLO 4.a: el que lleva 1 pagó % — la promo es llevando 2, va 600', v_res->>'total';
  end if;
  select count(*) into v_n from public.sale_items
   where sale_id = (v_res->>'sale_id')::uuid;
  if v_n <> 1 then
    raise exception 'FALLO 4.b: una unidad generó % filas', v_n;
  end if;
  if exists (select 1 from public.sale_items
              where sale_id = (v_res->>'sale_id')::uuid and promo_id is not null) then
    raise exception 'FALLO 4.c: una venta bajo el umbral quedó atribuida a la promo';
  end if;

  -- ---- 5 · qty 4 = dos grupos exactos ⇒ UNA fila, toda en promo -----------
  v_res := public.register_sale(
             v_store,
             jsonb_build_array(jsonb_build_object('product_id', v_gas, 'qty', 4)),
             'cash', 'qty-test-4u');
  if (v_res->>'total')::numeric <> 2000 then
    raise exception 'FALLO 5.a: esperaba 2000 (4 × 500), vino %', v_res->>'total';
  end if;
  select count(*) into v_n from public.sale_items
   where sale_id = (v_res->>'sale_id')::uuid;
  if v_n <> 1 then
    raise exception 'FALLO 5.b: múltiplo exacto generó % filas (esperaba 1, sin resto)', v_n;
  end if;

  -- ---- 9 · medición: SOLO las unidades rebajadas --------------------------
  -- Vendidas hasta acá: 3 (2 en promo) + 1 (0 en promo) + 4 (4 en promo) = 6 en promo.
  -- Resignado: (600−500)·6 = 600.
  select value into v_it from jsonb_array_elements(public.promos_listado(v_store)) t(value)
   where (value->>'id')::uuid = v_promo;
  if (v_it->>'unidades')::numeric <> 6 then
    raise exception 'FALLO 9.a: la medición declara % unidades — las rebajadas son 6 (la suelta a lista NO cuenta)', v_it->>'unidades';
  end if;
  if (v_it->>'costo_promo')::numeric <> 600 then
    raise exception 'FALLO 9.b: resignado % — esperaba 600 = (600−500)·6', v_it->>'costo_promo';
  end if;
  if (v_it->>'min_qty')::int <> 2 then
    raise exception 'FALLO 9.c: promos_listado no expone min_qty';
  end if;
  if (v_it->>'cobrado')::numeric <> 3000 then
    raise exception 'FALLO 9.d: cobrado en promo % — esperaba 3000 (6 × 500)', v_it->>'cobrado';
  end if;
end $$;

-- ===========================================================================
-- 6 · carrito mixto con SPLIT — la suma cierra al centavo
-- ===========================================================================
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_gas   uuid := 'd8000000-0000-0000-0000-0000000000b1';
  v_otro  uuid := 'd8000000-0000-0000-0000-0000000000b4';
  v_res   jsonb;
  v_sale  uuid;
begin
  -- 3 gaseosas (2x1000 + 600 = 1600) + 2 chicles (400) + monto libre 500 = 2500.
  v_res := public.register_split_sale(
             v_store,
             jsonb_build_array(
               jsonb_build_object('product_id', v_gas, 'qty', 3),
               jsonb_build_object('product_id', v_otro, 'qty', 2),
               jsonb_build_object('free_amount', 500, 'name', 'Suelto', 'qty', 1)),
             jsonb_build_array(
               jsonb_build_object('method', 'cash', 'amount', 1500),
               jsonb_build_object('method', 'transfer', 'amount', 1000)),
             'qty-split-1');
  v_sale := (v_res->>'sale_id')::uuid;

  if (v_res->>'total')::numeric <> 2500 then
    raise exception 'FALLO 6.a: total del split % — esperaba 2500', v_res->>'total';
  end if;
  if (select count(*) from public.sale_items where sale_id = v_sale) <> 4 then
    raise exception 'FALLO 6.b: esperaba 4 filas (grupo + resto + chicles + libre)';
  end if;
  if (select sum(line_total) from public.sale_items where sale_id = v_sale) <> 2500 then
    raise exception 'FALLO 6.c: la suma de line_total no cierra con el total';
  end if;
end $$;

-- 6.d corre como postgres: `sale_payments` es deny-all directo POR DISEÑO
-- (se escribe y se lee sólo vía RPCs definer) y el test no debe aflojarlo.
reset role;
do $$
declare v_suma numeric;
begin
  select sum(p.amount) into v_suma
    from public.sale_payments p
    join public.sales s on s.id = p.sale_id
   where s.idempotency_key = 'qty-split-1';
  if v_suma <> 2500 then
    raise exception 'FALLO 6.d: los pagos del split suman % (esperaba 2500)', v_suma;
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- 7 + 8 · void exacto e idempotencia
-- ===========================================================================
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_gas   uuid := 'd8000000-0000-0000-0000-0000000000b1';
  v_res   jsonb;
  v_res2  jsonb;
  v_sale  uuid;
  v_promo uuid;
  v_stock0 numeric;
  v_stock1 numeric;
  v_u0    numeric;
  v_u1    numeric;
begin
  select id into v_promo from public.promos
   where product_id = v_gas and ended_at is null;

  -- ---- 8 · idempotencia: replay del MISMO carrito -------------------------
  select stock into v_stock0 from public.products where id = v_gas;
  v_res  := public.register_sale(
              v_store,
              jsonb_build_array(jsonb_build_object('product_id', v_gas, 'qty', 3)),
              'cash', 'qty-idem-1');
  v_res2 := public.register_sale(
              v_store,
              jsonb_build_array(jsonb_build_object('product_id', v_gas, 'qty', 3)),
              'cash', 'qty-idem-1');
  if (v_res->>'sale_id') <> (v_res2->>'sale_id') then
    raise exception 'FALLO 8.a: el replay creó OTRA venta';
  end if;
  if not (v_res2->>'replayed')::boolean then
    raise exception 'FALLO 8.b: el replay no se declaró como tal';
  end if;
  select stock into v_stock1 from public.products where id = v_gas;
  if v_stock1 <> v_stock0 - 3 then
    raise exception 'FALLO 8.c: el replay descontó stock dos veces (bajó %)', v_stock0 - v_stock1;
  end if;

  -- ---- 7 · void: revierte las DOS filas y la atribución -------------------
  v_sale := (v_res->>'sale_id')::uuid;
  select coalesce(sum(i.qty), 0) into v_u0
    from public.sale_items i join public.sales s on s.id = i.sale_id
   where i.promo_id = v_promo and s.status = 'completed';

  select stock into v_stock0 from public.products where id = v_gas;
  perform public.void_sale(v_store, v_sale, 'test cantidad');
  select stock into v_stock1 from public.products where id = v_gas;
  if v_stock1 <> v_stock0 + 3 then
    raise exception 'FALLO 7.a: el void devolvió % unidades (esperaba 3: las dos filas)', v_stock1 - v_stock0;
  end if;

  select coalesce(sum(i.qty), 0) into v_u1
    from public.sale_items i join public.sales s on s.id = i.sale_id
   where i.promo_id = v_promo and s.status = 'completed';
  if v_u1 <> v_u0 - 2 then
    raise exception 'FALLO 7.b: la anulación no restó las 2 unidades atribuidas (antes %, ahora %)', v_u0, v_u1;
  end if;
end $$;

-- ===========================================================================
-- 10 · una promo viva por producto, DE CUALQUIER TIPO
-- ===========================================================================
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_doble uuid := 'd8000000-0000-0000-0000-0000000000b3';
  v_hoy   date;
  v_res   jsonb;
  v_lp    numeric;
  v_mq    int;
begin
  v_hoy := public.store_hoy(v_store);

  -- promo de PRECIO viva…
  v_res := public.create_promo(v_store, v_doble, 450, v_hoy, v_hoy + 5);

  -- …una de CANTIDAD encima ⇒ overlap.
  begin
    perform public.create_promo(v_store, v_doble, 400, v_hoy, v_hoy + 5,
                                null, 'manual', false, false, 3);
    raise exception 'FALLO 10.a: precio y cantidad conviven sobre el mismo producto';
  exception when others then
    if sqlerrm <> 'promo_overlap' then raise; end if;
  end;

  -- …con p_reemplazar: reemplazo atómico + herencia del precio de lista.
  v_res := public.create_promo(v_store, v_doble, 400, v_hoy, v_hoy + 5,
                               null, 'manual', false, true, 3);
  if v_res->>'replaced_promo_id' is null then
    raise exception 'FALLO 10.b: el reemplazo no cerró la promo de precio';
  end if;
  select list_price, min_qty into v_lp, v_mq
    from public.promos where id = (v_res->>'promo_id')::uuid;
  if v_lp <> 600 or v_mq <> 3 then
    raise exception 'FALLO 10.c: esperaba lista heredada 600 y min_qty 3, vino %/%', v_lp, v_mq;
  end if;
  if not exists (select 1 from public.promos
                  where product_id = v_doble and ended_reason = 'reemplazo') then
    raise exception 'FALLO 10.d: la promo reemplazada no quedó marcada';
  end if;
  perform public.end_promo(v_store, (v_res->>'promo_id')::uuid);
end $$;

-- ===========================================================================
-- 11 · below_cost sobre el UNITARIO del grupo
-- ===========================================================================
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_caro  uuid := 'd8000000-0000-0000-0000-0000000000b2';
  v_hoy   date;
  v_res   jsonb;
begin
  v_hoy := public.store_hoy(v_store);
  -- "2 x $1.000" con costo 550: unitario 500 < 550 ⇒ opt-in obligatorio.
  begin
    perform public.create_promo(v_store, v_caro, 500, v_hoy, v_hoy + 5,
                                null, 'manual', false, false, 2);
    raise exception 'FALLO 11.a: dejó vender bajo costo sin opt-in (unitario 500 < costo 550)';
  exception when others then
    if sqlerrm <> 'below_cost' then raise; end if;
  end;
  v_res := public.create_promo(v_store, v_caro, 500, v_hoy, v_hoy + 5,
                               null, 'manual', true, false, 2);
  if v_res->>'promo_id' is null then
    raise exception 'FALLO 11.b: con opt-in explícito tiene que poder';
  end if;
  perform public.end_promo(v_store, (v_res->>'promo_id')::uuid);
end $$;

reset role;

-- ===========================================================================
-- 12 · el motor NO toca promos de cantidad (fixture postgres + test owner)
-- ===========================================================================
-- Un lote por vencer del producto con promo de cantidad viva: el motor tiene
-- que IGNORARLO por completo (decisión del owner: las de cantidad son 100%
-- manuales; un re-escalón sobre "2 x $1.000" exigiría matemática que el motor
-- no tiene).
insert into public.stock_expiries (store_id, product_id, expiry_date, qty)
values (:'store', :'gas', public.store_hoy(:'store') + 3, 10);
-- Y la promo lleva 3 días corriendo (cota de gracia superada), para que la
-- única razón de exclusión posible sea el min_qty.
update public.promos set starts_on = public.store_hoy(:'store') - 3
 where product_id = :'gas' and ended_at is null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_gas   uuid := 'd8000000-0000-0000-0000-0000000000b1';
  v_cart  jsonb;
  v_it    jsonb;
begin
  select value into v_it
    from jsonb_array_elements(public.promos_sugeridas(v_store)) t(value)
   where (value->>'product_id')::uuid = v_gas;
  if v_it is not null then
    raise exception 'FALLO 12: el motor sugirió sobre un producto con promo de CANTIDAD viva';
  end if;

  -- ---- 13 · carteles exponen min_qty --------------------------------------
  select value into v_it
    from jsonb_array_elements(public.promos_carteles(v_store)) t(value)
   where (value->>'name') = 'Gaseosa 048';
  if v_it is null then
    raise exception 'FALLO 13.a: la promo de cantidad no aparece en los carteles';
  end if;
  if (v_it->>'min_qty')::int <> 2 or (v_it->>'precio')::numeric <> 500 then
    raise exception 'FALLO 13.b: el cartel no trae min_qty 2 + unitario 500 (%/%)',
      v_it->>'min_qty', v_it->>'precio';
  end if;
end $$;

reset role;

rollback;

\echo '════════════════════════════════════════════'
\echo ' verify-promos-cantidad.sql — TODO VERDE'
\echo '════════════════════════════════════════════'
