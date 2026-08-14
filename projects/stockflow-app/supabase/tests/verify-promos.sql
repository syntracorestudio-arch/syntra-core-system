-- StockFlow — VERIFY: Promociones (migración 045)
--
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/verify-promos.sql
--
-- Prerequisitos: supabase db reset (001..045) + seed.sql.
-- Fixtures del seed: store El Trébol 11111111-…, owner aaaaaaaa-…0001,
-- cajero aaaaaaaa-…0002, otro tenant 22222222-… / bbbbbbbb-…0001.
--
-- Qué se prueba, y por qué cada cosa:
--   1  promo_precio devuelve el efectivo (y vuelve solo pasada la fecha)
--   2  create_promo: owner-only, rangos, piso de costo, solapamiento
--   3  end_promo: idempotente, dice a cuánto vuelve
--   4  register_sale cobra el precio de promo SIN que el cliente lo mande
--   5  el cajero sin can_apply_discount PUEDE vender en promo  ← el bug que evitamos
--   6  sale_items snapshotea promo_id + list_price (atribución veraz)
--   7  el override manual gana sobre la promo y NO se registra como promo
--   8  promo terminada / futura / vencida-por-fecha NO se aplica
--   9  void de una venta con promo revierte limpio
--  10  resolve_expiry termina la promo ligada (agujero de máquina de estados)
--  11  las 3 RPCs de catálogo exponen el precio efectivo
--  12  aislamiento entre negocios
--  13  monto libre nunca lleva promo
--  14  índices exigidos por el baseline de escala
--  15  el motor NO sugiere sobre lo que se agota solo (no regalar margen)
--
-- NOTA DE PRIVILEGIOS: `promos` es deny-all para `authenticated` (todo entra por
-- RPC), así que los fixtures que la tocan directo van como `postgres`. Cada
-- bloque declara con qué rol corre — mezclarlos es lo que hace ilegibles a estos
-- scripts.
--
-- FECHAS (fix 048): todas las fechas de negocio usan store_hoy(), NUNCA
-- public.store_hoy('11111111-1111-1111-1111-111111111111'). `public.store_hoy('11111111-1111-1111-1111-111111111111')` es la fecha UTC del servidor y entre las 21:00
-- y las 24:00 hora argentina ya es "mañana": un fixture armado con
-- public.store_hoy('11111111-1111-1111-1111-111111111111')-1 creaba una promo "vencida"... que en la zona del negocio
-- seguía viva, y el test fallaba tres horas por día sin ningún bug.

\set ON_ERROR_STOP on
\timing off

begin;

\set store '11111111-1111-1111-1111-111111111111'
\set prod  'd9000000-0000-0000-0000-00000000000a'
\set prod2 'd9000000-0000-0000-0000-00000000000b'

-- ===========================================================================
-- FIXTURES (rol postgres) — productos propios para no ensuciar los del seed.
-- ===========================================================================
insert into public.products (id, store_id, name, emoji, cost, price, stock, status)
values (:'prod',  :'store', 'Alfajor Test', '🍫', 600, 1000, 10, 'active'),
       (:'prod2', :'store', 'Galleta Test', '🍪', 400,  800, 10, 'active')
on conflict (id) do update set cost = excluded.cost, price = excluded.price,
                               stock = excluded.stock, status = 'active';

insert into public.product_barcodes (store_id, product_id, barcode)
values (:'store', :'prod', '7790000000009')
on conflict do nothing;

insert into public.stock_expiries (store_id, product_id, expiry_date, qty)
values (:'store', :'prod', public.store_hoy('11111111-1111-1111-1111-111111111111') + 3, 5);

-- 8.c · una promo YA VENCIDA por fecha, con ended_at null: nadie la marcó y no
-- hay cron. Si el diseño es correcto, no aplica igual — y tampoco bloquea crear
-- una nueva por solapamiento.
insert into public.promos (store_id, product_id, promo_price, list_price,
                           cost_at_start, starts_on, ends_on, origin)
values (:'store', :'prod', 700, 1000, 600,
        public.store_hoy('11111111-1111-1111-1111-111111111111') - 10, public.store_hoy('11111111-1111-1111-1111-111111111111') - 1, 'manual');

-- ===========================================================================
-- BLOQUE A (rol authenticated · OWNER) — 1, 2, 3, 4, 6, 7, 8, 9, 10, 13
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_promo  uuid;
  v_res    jsonb;
  v_precio numeric;
  v_sale   uuid;
  v_n      numeric;
  v_lp     numeric;
  v_up     numeric;
  v_pid    uuid;
  v_stock0 numeric;
  v_stock1 numeric;
  v_exp    uuid;
  v_store  uuid := '11111111-1111-1111-1111-111111111111';
  v_prod   uuid := 'd9000000-0000-0000-0000-00000000000a';
  v_prod2  uuid := 'd9000000-0000-0000-0000-00000000000b';
begin

  -- 8.c · la promo vencida del fixture no descuenta (auto-fin SIN cron)
  v_precio := public.promo_precio(v_store, v_prod);
  if v_precio <> 1000 then
    raise exception 'FALLO 8.c: una promo con ends_on pasado seguía viva (%)', v_precio;
  end if;

  -- ---- 2 · validaciones de create_promo, antes de crear nada --------------
  begin
    perform public.create_promo(v_store, v_prod, 700, public.store_hoy('11111111-1111-1111-1111-111111111111'), public.store_hoy('11111111-1111-1111-1111-111111111111') - 1);
    raise exception 'FALLO 2.a: aceptó un rango invertido';
  exception when others then
    if sqlerrm not like '%invalid_range%' then
      raise exception 'FALLO 2.a: esperaba invalid_range, vino: %', sqlerrm;
    end if;
  end;

  begin
    perform public.create_promo(v_store, v_prod, 1000, public.store_hoy('11111111-1111-1111-1111-111111111111'), public.store_hoy('11111111-1111-1111-1111-111111111111') + 3);
    raise exception 'FALLO 2.b: aceptó promo_price = list_price';
  exception when others then
    if sqlerrm not like '%invalid_amount%' then
      raise exception 'FALLO 2.b: esperaba invalid_amount, vino: %', sqlerrm;
    end if;
  end;

  -- piso de costo (costo 600) SIN opt-in
  begin
    perform public.create_promo(v_store, v_prod, 500, public.store_hoy('11111111-1111-1111-1111-111111111111'), public.store_hoy('11111111-1111-1111-1111-111111111111') + 3);
    raise exception 'FALLO 2.c: dejó bajar del costo sin opt-in';
  exception when others then
    if sqlerrm not like '%below_cost%' then
      raise exception 'FALLO 2.c: esperaba below_cost, vino: %', sqlerrm;
    end if;
  end;

  -- bajo costo CON opt-in explícito del owner → permitido
  v_res := public.create_promo(v_store, v_prod2, 300, public.store_hoy('11111111-1111-1111-1111-111111111111'), public.store_hoy('11111111-1111-1111-1111-111111111111') + 3,
                               null, 'manual', true);
  if (v_res->>'promo_id') is null then
    raise exception 'FALLO 2.d: el opt-in de bajo costo no creó la promo';
  end if;
  perform public.end_promo(v_store, (v_res->>'promo_id')::uuid);

  -- ---- 1 · promo_precio ---------------------------------------------------
  v_res   := public.create_promo(v_store, v_prod, 700, public.store_hoy('11111111-1111-1111-1111-111111111111'), public.store_hoy('11111111-1111-1111-1111-111111111111') + 3);
  v_promo := (v_res->>'promo_id')::uuid;

  v_precio := public.promo_precio(v_store, v_prod);
  if v_precio <> 700 then
    raise exception 'FALLO 1: con promo activa esperaba 700, vino %', v_precio;
  end if;

  -- 2.e · una viva por producto
  begin
    perform public.create_promo(v_store, v_prod, 650, public.store_hoy('11111111-1111-1111-1111-111111111111') + 1, public.store_hoy('11111111-1111-1111-1111-111111111111') + 5);
    raise exception 'FALLO 2.e: permitió dos promos solapadas';
  exception when others then
    if sqlerrm not like '%promo_overlap%' then
      raise exception 'FALLO 2.e: esperaba promo_overlap, vino: %', sqlerrm;
    end if;
  end;

  -- ---- 4 + 6 · la caja cobra la promo y sale_items la snapshotea ----------
  select stock into v_stock0 from public.products where id = v_prod;

  v_res := public.register_sale(
             v_store,
             jsonb_build_array(jsonb_build_object('product_id', v_prod, 'qty', 2)),
             'cash', 'promo-test-1');
  v_sale := (v_res->>'sale_id')::uuid;

  if (v_res->>'total')::numeric <> 1400 then
    raise exception 'FALLO 4: esperaba total 1400 (2 x 700), vino %', v_res->>'total';
  end if;

  select unit_price, list_price, promo_id into v_up, v_lp, v_pid
    from public.sale_items where sale_id = v_sale and product_id = v_prod;

  if v_up <> 700 then raise exception 'FALLO 6.a: unit_price esperaba 700, vino %', v_up; end if;
  if v_lp <> 1000 then raise exception 'FALLO 6.b: list_price esperaba 1000, vino %', v_lp; end if;
  if v_pid is distinct from v_promo then
    raise exception 'FALLO 6.c: promo_id no quedó atado a la promo';
  end if;

  -- atribución: 2 u. · ganancia (700-600)*2 = 200 · costó (1000-700)*2 = 600
  /* 051 · POR QUÉ ESTE ASSERT CORRE COMO `postgres` (no es que se haya
     relajado un test de seguridad — es exactamente lo contrario).

     La migración 051 revocó las columnas de COSTO para `authenticated`:
     un cajero leía el costo de cada producto y la ganancia de cada venta.
     Este assert no verifica qué puede VER un cajero: verifica QUÉ ESCRIBIÓ
     LA RPC. Que la RPC guarde bien el costo es un hecho de la base, y
     comprobarlo requiere poder leerlo.

     Las dos salidas eran: subir el privilegio del ASSERT, o bajar el del
     PRODUCTO para que el test siguiera pasando. Se hizo la primera. La
     segunda habría sido reabrir la fuga para no tocar un test.
     Mismo criterio que el assert de `sale_payments` en verify-split.sql. */
  perform set_config('role', 'postgres', true);
  select sum(qty), sum((unit_price - unit_cost) * qty), sum((list_price - unit_price) * qty)
    into v_n, v_precio, v_lp
    from public.sale_items where promo_id = v_promo;
  perform set_config('role', 'authenticated', true);
  if v_n <> 2 or v_precio <> 200 or v_lp <> 600 then
    raise exception 'FALLO 6.d: atribución esperaba 2/200/600, vino %/%/%', v_n, v_precio, v_lp;
  end if;

  -- ---- 7 · el override manual del owner gana y NO es promo ----------------
  v_res := public.register_sale(
             v_store,
             jsonb_build_array(jsonb_build_object(
               'product_id', v_prod, 'qty', 1, 'unit_price', 900)),
             'cash', 'promo-test-override');

  select unit_price, promo_id into v_up, v_pid
    from public.sale_items
   where sale_id = (v_res->>'sale_id')::uuid and product_id = v_prod;
  if v_up <> 900 then raise exception 'FALLO 7.a: el override manual no ganó (%)', v_up; end if;
  if v_pid is not null then
    raise exception 'FALLO 7.b: un descuento manual quedó registrado como promo';
  end if;

  -- ---- 9 · void revierte limpio ------------------------------------------
  -- Se mide el DELTA del void (la venta con override sigue viva y también
  -- descontó): anular 2 unidades tiene que devolver exactamente 2.
  select stock into v_stock0 from public.products where id = v_prod;
  perform public.void_sale(v_store, v_sale, 'test');
  select stock into v_stock1 from public.products where id = v_prod;
  if v_stock1 <> v_stock0 + 2 then
    raise exception 'FALLO 9.a: el void devolvió % unidades, esperaba 2', v_stock1 - v_stock0;
  end if;
  select coalesce(sum(i.qty), 0) into v_n
    from public.sale_items i join public.sales s on s.id = i.sale_id
   where i.promo_id = v_promo and s.status = 'completed';
  if v_n <> 0 then
    raise exception 'FALLO 9.b: la venta anulada sigue sumando en la promo (% u.)', v_n;
  end if;

  -- ---- 3 · end_promo ------------------------------------------------------
  v_res := public.end_promo(v_store, v_promo);
  if (v_res->>'vuelve_a')::numeric <> 1000 then
    raise exception 'FALLO 3.a: vuelve_a esperaba 1000, vino %', v_res->>'vuelve_a';
  end if;
  v_res := public.end_promo(v_store, v_promo);   -- idempotente
  if coalesce((v_res->>'ya_terminada')::boolean, false) is not true then
    raise exception 'FALLO 3.b: end_promo no es idempotente';
  end if;

  -- ---- 8.a · terminada no aplica -----------------------------------------
  if public.promo_precio(v_store, v_prod) <> 1000 then
    raise exception 'FALLO 8.a: tras terminarla seguía descontando';
  end if;

  -- ---- 8.b · programada no aplica todavía --------------------------------
  v_res   := public.create_promo(v_store, v_prod, 700, public.store_hoy('11111111-1111-1111-1111-111111111111') + 5, public.store_hoy('11111111-1111-1111-1111-111111111111') + 9);
  v_promo := (v_res->>'promo_id')::uuid;
  if public.promo_precio(v_store, v_prod) <> 1000 then
    raise exception 'FALLO 8.b: una promo programada ya descontaba';
  end if;
  perform public.end_promo(v_store, v_promo);

  -- ---- 10 · resolver el vencimiento termina la promo ligada ---------------
  select id into v_exp from public.stock_expiries
   where store_id = v_store and product_id = v_prod and resolved_at is null
   order by created_at desc limit 1;

  v_res   := public.create_promo(v_store, v_prod, 700,
                                 public.store_hoy('11111111-1111-1111-1111-111111111111'), public.store_hoy('11111111-1111-1111-1111-111111111111') + 3, v_exp);
  v_promo := (v_res->>'promo_id')::uuid;

  perform public.resolve_expiry(v_store, v_exp, 'sold');

  if (select ended_at from public.promos where id = v_promo) is null then
    raise exception 'FALLO 10.a: resolver el vencimiento no terminó la promo ligada';
  end if;
  if (select ended_reason from public.promos where id = v_promo) <> 'vencimiento' then
    raise exception 'FALLO 10.b: ended_reason esperaba vencimiento';
  end if;
  if public.promo_precio(v_store, v_prod) <> 1000 then
    raise exception 'FALLO 10.c: seguía descontando tras resolver el vencimiento';
  end if;

  -- ---- 13 · monto libre nunca lleva promo --------------------------------
  v_res := public.register_sale(
             v_store,
             jsonb_build_array(jsonb_build_object(
               'product_id', null, 'qty', 1, 'free_amount', 500, 'name', 'Suelto')),
             'cash', 'promo-test-libre');
  select promo_id, list_price into v_pid, v_lp
    from public.sale_items where sale_id = (v_res->>'sale_id')::uuid;
  if v_pid is not null or v_lp is not null then
    raise exception 'FALLO 13: una línea de monto libre quedó marcada como promo';
  end if;

  raise notice 'OK · bloque A — owner (1, 2, 3, 4, 6, 7, 8, 9, 10, 13)';
end $$;

-- ===========================================================================
-- BLOQUE B (rol authenticated · CAJERO) — 5 y 2.f
--
-- EL BUG QUE ESTO EVITA: si la promo viajara como `unit_price` desde el
-- cliente, `register_sale` exigiría can_apply_discount y la caja quedaría
-- trabada para todo empleado sin ese permiso.
-- ===========================================================================
do $$
declare
  v_promo uuid;
  v_res   jsonb;
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_prod  uuid := 'd9000000-0000-0000-0000-00000000000a';
begin
  perform set_config('request.jwt.claims',
                     '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
  v_promo := (public.create_promo(v_store, v_prod, 700,
                                  public.store_hoy('11111111-1111-1111-1111-111111111111'), public.store_hoy('11111111-1111-1111-1111-111111111111') + 3)->>'promo_id')::uuid;

  perform set_config('request.jwt.claims',
                     '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);

  if (select coalesce(can_apply_discount, false) from public.members
       where store_id = v_store
         and profile_id = 'aaaaaaaa-0000-0000-0000-000000000002') then
    raise exception 'FIXTURE: el cajero del seed tiene can_apply_discount; el test 5 no prueba nada';
  end if;

  v_res := public.register_sale(
             v_store,
             jsonb_build_array(jsonb_build_object('product_id', v_prod, 'qty', 1)),
             'cash', 'promo-test-cajero');
  if (v_res->>'total')::numeric <> 700 then
    raise exception 'FALLO 5: el cajero no cobró el precio de promo (vino %)', v_res->>'total';
  end if;

  begin
    perform public.create_promo(v_store, v_prod, 600, public.store_hoy('11111111-1111-1111-1111-111111111111') + 10, public.store_hoy('11111111-1111-1111-1111-111111111111') + 12);
    raise exception 'FALLO 2.f: un cajero pudo crear una promo';
  exception when others then
    if sqlerrm not like '%not_allowed%' then
      raise exception 'FALLO 2.f: esperaba not_allowed, vino: %', sqlerrm;
    end if;
  end;

  perform set_config('request.jwt.claims',
                     '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
  perform public.end_promo(v_store, v_promo);

  raise notice 'OK · bloque B — cajero (5, 2.f)';
end $$;

-- ===========================================================================
-- BLOQUE C (rol authenticated · OWNER) — 11 · el catálogo dice el precio real
-- ===========================================================================
do $$
declare
  v_promo uuid;
  v_res   jsonb;
  v_p     jsonb;
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_prod  uuid := 'd9000000-0000-0000-0000-00000000000a';
begin
  perform set_config('request.jwt.claims',
                     '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
  v_promo := (public.create_promo(v_store, v_prod, 700,
                                  public.store_hoy('11111111-1111-1111-1111-111111111111'), public.store_hoy('11111111-1111-1111-1111-111111111111') + 3)->>'promo_id')::uuid;

  -- 11.a escaneo
  v_p := public.producto_por_codigo(v_store, '7790000000009');
  if (v_p->>'price')::numeric <> 700 then
    raise exception 'FALLO 11.a: producto_por_codigo devolvió % (esperaba 700)', v_p->>'price';
  end if;
  if (v_p->>'list_price')::numeric <> 1000 then
    raise exception 'FALLO 11.a2: falta list_price para el tachado';
  end if;

  -- 11.b búsqueda
  v_res := public.productos_buscar(v_store, 'Alfajor Test');
  select i into v_p from jsonb_array_elements(v_res->'items') i
   where (i->>'id')::uuid = v_prod;
  if v_p is null then
    raise exception 'FALLO 11.b0: productos_buscar no encontró el producto';
  end if;
  if (v_p->>'price')::numeric <> 700 then
    raise exception 'FALLO 11.b: productos_buscar devolvió % (esperaba 700)', v_p->>'price';
  end if;

  -- 11.c tiles (puede no estar entre los destacados; si está, tiene que decir 700)
  v_res := public.pos_destacados(v_store, 60);
  select i into v_p from jsonb_array_elements(v_res) i
   where (i->>'id')::uuid = v_prod;
  if v_p is not null and (v_p->>'price')::numeric <> 700 then
    raise exception 'FALLO 11.c: pos_destacados devolvió % (esperaba 700)', v_p->>'price';
  end if;

  perform public.end_promo(v_store, v_promo);
  raise notice 'OK · bloque C — catálogo (11)';
end $$;

-- ===========================================================================
-- BLOQUE D (rol authenticated · OTRO TENANT) — 12 · aislamiento
-- ===========================================================================
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_prod  uuid := 'd9000000-0000-0000-0000-00000000000a';
begin
  perform set_config('request.jwt.claims',
                     '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);

  begin
    perform public.create_promo(v_store, v_prod, 700, public.store_hoy('11111111-1111-1111-1111-111111111111'), public.store_hoy('11111111-1111-1111-1111-111111111111') + 3);
    raise exception 'FALLO 12.a: cross-tenant pudo crear una promo';
  exception when others then
    if sqlerrm not like '%not_a_member%' then
      raise exception 'FALLO 12.a: esperaba not_a_member, vino: %', sqlerrm;
    end if;
  end;

  if (select count(*) from public.promos where store_id = v_store) <> 0 then
    raise exception 'FALLO 12.b: un tenant ajeno ve promos que no son suyas';
  end if;

  raise notice 'OK · bloque D — aislamiento (12)';
end $$;

-- ===========================================================================
-- BLOQUE E' (rol authenticated · OWNER) — 15 · el corazón del motor
--
-- La regla que evita regalar margen: si al ritmo actual el stock se agota ANTES
-- del vencimiento, NO se sugiere nada. Se prueba con dos productos idénticos
-- salvo por el ritmo de venta.
-- ===========================================================================
reset role;

-- Fixture (postgres): dos productos, mismo stock y misma fecha de vencimiento.
insert into public.products (id, store_id, name, emoji, cost, price, stock, status)
values ('d9000000-0000-0000-0000-00000000000c', :'store', 'Lento Test',  '🐢', 600, 1000, 10, 'active'),
       ('d9000000-0000-0000-0000-00000000000d', :'store', 'Rapido Test', '🐇', 600, 1000, 10, 'active')
on conflict (id) do update set cost = excluded.cost, price = excluded.price,
                               stock = excluded.stock, status = 'active';

insert into public.stock_expiries (store_id, product_id, expiry_date, qty)
values (:'store', 'd9000000-0000-0000-0000-00000000000c', public.store_hoy('11111111-1111-1111-1111-111111111111') + 5, 10),
       (:'store', 'd9000000-0000-0000-0000-00000000000d', public.store_hoy('11111111-1111-1111-1111-111111111111') + 5, 10);

-- Al "rápido" se le fabrica ritmo: 28 unidades en 14 días = 2/día. Con 10 de
-- stock y 5 días por delante necesita 2/día ⇒ se agota justo: no hay que tocarlo.
insert into public.sales (id, store_id, member_id, total, payment_method,
                          idempotency_key, sold_at, status)
select 'e9000000-0000-0000-0000-00000000000d', :'store', m.id, 28000, 'cash',
       'fixture-ritmo', now() - interval '7 days', 'completed'
  from public.members m
 where m.store_id = :'store' and m.role = 'owner' limit 1;

insert into public.sale_items (sale_id, store_id, product_id, product_name,
                               qty, unit_price, unit_cost, line_total)
values ('e9000000-0000-0000-0000-00000000000d', :'store',
        'd9000000-0000-0000-0000-00000000000d', 'Rapido Test',
        28, 1000, 600, 28000);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_sug   jsonb;
  v_lento jsonb;
  v_rapido jsonb;
  v_store uuid := '11111111-1111-1111-1111-111111111111';
begin
  v_sug := public.promos_sugeridas(v_store);

  select e into v_lento from jsonb_array_elements(v_sug) e
   where (e->>'product_id')::uuid = 'd9000000-0000-0000-0000-00000000000c';
  select e into v_rapido from jsonb_array_elements(v_sug) e
   where (e->>'product_id')::uuid = 'd9000000-0000-0000-0000-00000000000d';

  if v_lento is null then
    raise exception 'FALLO 15.a: no sugirió sobre un producto que NO llega a venderse';
  end if;
  if v_rapido is not null then
    raise exception 'FALLO 15.b: sugirió descuento sobre algo que se agota solo (regalar margen)';
  end if;

  -- 5 días ⇒ escalón −25 %; y nunca por debajo del costo (600).
  if (v_lento->>'pct')::int <> 25 then
    raise exception 'FALLO 15.c: a 5 días esperaba −25%%, vino −%%%', v_lento->>'pct';
  end if;
  if (v_lento->>'sugerido')::numeric < 600 then
    raise exception 'FALLO 15.d: sugirió bajo el costo sin opt-in (%)', v_lento->>'sugerido';
  end if;
  -- La honestidad del motor: informa el ritmo que HARÍA FALTA, no una promesa.
  if (v_lento->>'ritmo_necesario') is null or (v_lento->>'ritmo_actual') is null then
    raise exception 'FALLO 15.e: falta el ritmo — la UI no puede prometer sin él';
  end if;

  raise notice 'OK · bloque E'' — motor determinista (15)';
end $$;

-- ===========================================================================
-- BLOQUE F (rol postgres) — 14 · el baseline de escala
-- ===========================================================================
reset role;

do $$
begin
  if not exists (select 1 from pg_indexes
                  where tablename = 'promos'
                    and indexdef like '%product_id%' and indexdef like '%ended_at%') then
    raise exception 'FALLO 14.a: falta el índice parcial de promos por producto';
  end if;
  if not exists (select 1 from pg_indexes
                  where tablename = 'sale_items' and indexdef like '%promo_id%') then
    raise exception 'FALLO 14.b: FK sale_items.promo_id sin índice (Postgres no lo crea solo)';
  end if;
  raise notice 'OK · bloque F — escala (14)';
end $$;

rollback;

\echo '════════════════════════════════════════════'
\echo ' verify-promos.sql — TODO VERDE'
\echo '════════════════════════════════════════════'
