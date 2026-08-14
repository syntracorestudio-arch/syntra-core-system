-- StockFlow — VERIFY: permisos del empleado (auditoría + migración 051)
--
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/verify-permisos.sql
--
-- Prerequisitos: supabase db reset (001..051) + seed.sql.
--
-- QUÉ PRUEBA Y POR QUÉ
--
-- Cada permiso se afirma en LAS DOS DIRECCIONES. Un test que sólo prueba
-- "con el permiso funciona" no detecta el bug que esta auditoría encontró:
-- todo funcionaba, y de más. El que importa es el que dice "SIN el permiso NO
-- llega el dato" — por eso la mitad de los bloques de acá abajo son negativos.
--
--   1  estanqueidad de columnas: cost / unit_cost (B-1, B-2, B-3)
--   2  el libro de fiado exige can_sell_on_credit (B-4)
--   3  las tres RPCs de tablero exigen ROL, no membresía (B-5, B-6, B-7)
--   4  can_sell_on_credit ON/OFF sobre register_sale con 'account'
--   5  can_apply_discount ON/OFF sobre el unit_price manual
--   6  can_void_sale ON/OFF sobre void_sale
--   7  can_receive_stock ON/OFF sobre register_purchase
--   8  can_see_costs ON/OFF sobre margenes_erosionados
--   9  cross-tenant: todo lo anterior contra el negocio ajeno
--  10  ANTI-REGRESIÓN: el dueño no perdió NADA con el arreglo
--
-- NOTA SOBRE EL MÉTODO. Los bloques que prueban "permission denied" no pueden
-- vivir dentro de un `do $$` con `exception when others`: un error de
-- privilegio aborta la transacción igual. Por eso cada afirmación negativa de
-- columna corre en su propia transacción y se verifica con `has_column_privilege`,
-- que es la fuente de verdad de Postgres y no aborta nada.

\set ON_ERROR_STOP on
\timing off

\set store  '11111111-1111-1111-1111-111111111111'
\set store2 '22222222-2222-2222-2222-222222222222'
\set store3 '33333333-3333-3333-3333-333333333333'

-- Luci: staff del negocio 1. can_sell_on_credit = true, can_see_costs = false.
\set luci  'aaaaaaaa-0000-0000-0000-000000000002'
-- Mati: owner del negocio 1.
\set mati  'aaaaaaaa-0000-0000-0000-000000000001'
-- Sofía: staff del negocio 3, SIN can_sell_on_credit.
\set sofia '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b'

\echo ''
\echo '========================================================================'
\echo ' 1 · ESTANQUEIDAD DE COLUMNAS — la plata no se lee ni con SQL crudo'
\echo '========================================================================'

-- El rol `authenticated` es UNO SOLO para dueños y empleados: Supabase mapea
-- todos los JWT ahí. Por eso el recorte de columna se afirma sobre el ROL, y lo
-- que separa al dueño del empleado es que el dueño lee sus costos por RPCs
-- `security definer` (que corren como el dueño de la función, ver bloque 10).
do $$
begin
  if has_column_privilege('authenticated', 'public.products', 'cost', 'select') then
    raise exception 'FALLO 1.a: `authenticated` todavía puede leer products.cost (fuga B-1)';
  end if;
  if has_column_privilege('authenticated', 'public.sale_items', 'unit_cost', 'select') then
    raise exception 'FALLO 1.b: `authenticated` todavía puede leer sale_items.unit_cost (fuga B-2)';
  end if;
  if has_column_privilege('authenticated', 'public.stock_ledger', 'unit_cost', 'select') then
    raise exception 'FALLO 1.c: `authenticated` todavía puede leer stock_ledger.unit_cost (fuga B-3)';
  end if;

  -- La otra mitad: el recorte no puede haberse comido lo que el POS necesita.
  -- Sin esto, "arreglar" la fuga sería romper la caja.
  if not has_column_privilege('authenticated', 'public.products', 'price', 'select') then
    raise exception 'FALLO 1.d: el POS se quedó sin products.price';
  end if;
  if not has_column_privilege('authenticated', 'public.products', 'stock', 'select') then
    raise exception 'FALLO 1.e: el POS se quedó sin products.stock';
  end if;
  if not has_column_privilege('authenticated', 'public.products', 'name', 'select') then
    raise exception 'FALLO 1.f: el POS se quedó sin products.name';
  end if;
  if not has_column_privilege('authenticated', 'public.sale_items', 'unit_price', 'select') then
    raise exception 'FALLO 1.g: se perdió sale_items.unit_price';
  end if;
  if not has_column_privilege('authenticated', 'public.products', 'cost', 'insert') then
    raise exception 'FALLO 1.h: el alta de producto ya no puede escribir el costo';
  end if;
end $$;
\echo 'OK 1 · cost/unit_cost cerrados; precio, stock y nombre intactos'

\echo ''
\echo '========================================================================'
\echo ' 2 · EL LIBRO DE FIADO EXIGE can_sell_on_credit'
\echo '========================================================================'

-- 2.a · SIN el permiso (Sofía) no ve NADA: ni el ledger ni los clientes.
--
-- El flag se apaga ACÁ ADENTRO en vez de confiar en cómo vino el fixture: una
-- sesión de pruebas manuales se lo dejó prendido y este bloque se puso rojo
-- por una razón que no tenía nada que ver con lo que afirma. Un test que
-- depende del estado ambiente reporta el ruido de al lado, no su propio
-- invariante. Todo dentro de la transacción que se revierte.
begin;
update public.members set can_sell_on_credit = false
 where profile_id = '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';
set local role authenticated;
set local request.jwt.claims = '{"sub":"22b9e8aa-7e92-4af5-b193-b94c4bfbed8b","role":"authenticated"}';
do $$
declare v_led int; v_cli int;
begin
  select count(*) into v_led from public.client_ledger;
  select count(*) into v_cli from public.clients;
  if v_led <> 0 then
    raise exception 'FALLO 2.a: staff sin can_sell_on_credit lee % movimientos de fiado (B-4)', v_led;
  end if;
  if v_cli <> 0 then
    raise exception 'FALLO 2.b: staff sin can_sell_on_credit lee % clientes', v_cli;
  end if;
end $$;
rollback;

-- 2.c · CON el permiso (Luci) sí ve — el arreglo no puede romper el mostrador.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
declare v_led int;
begin
  select count(*) into v_led from public.client_ledger;
  if v_led = 0 then
    raise exception 'FALLO 2.c: staff CON can_sell_on_credit se quedó sin ver el fiado';
  end if;
end $$;
rollback;
\echo 'OK 2 · fiado cerrado sin el flag, abierto con el flag'

\echo ''
\echo '========================================================================'
\echo ' 3 · LAS RPCs DE TABLERO EXIGEN ROL, NO MEMBRESÍA'
\echo '========================================================================'

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
declare v_ok boolean;
begin
  begin
    perform public.dashboard_summary('11111111-1111-1111-1111-111111111111');
    raise exception 'FALLO 3.a: un empleado leyó dashboard_summary (profit, cash_in) — fuga B-5';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;

  begin
    perform public.reportes_summary('11111111-1111-1111-1111-111111111111',
                                    current_date - 30, current_date);
    raise exception 'FALLO 3.b: un empleado leyó reportes_summary (money, top_profit) — fuga B-6';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;

  begin
    perform public.cierre_caja('11111111-1111-1111-1111-111111111111');
    raise exception 'FALLO 3.c: un empleado leyó cierre_caja (la recaudación) — fuga B-7';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 3 · dashboard, reportes y cierre de caja devuelven not_allowed al empleado'

\echo ''
\echo '========================================================================'
\echo ' 4-8 · CADA FLAG, EN LAS DOS DIRECCIONES'
\echo '========================================================================'

-- Se usa a Sofía (negocio 3) porque arranca sin permisos y se le prenden y
-- apagan dentro de la transacción, sin ensuciar el fixture del negocio 1.
-- El `set local role postgres` intercalado es para poder tocar `members`
-- (el empleado no puede editarse los permisos, que es justo lo correcto).

-- ---- 4 · can_sell_on_credit sobre register_sale('account') --------------
begin;
do $$
declare v_prod uuid; v_cli uuid;
begin
  select id into v_prod from public.products where store_id = '33333333-3333-3333-3333-333333333333' limit 1;
  select id into v_cli  from public.clients  where store_id = '33333333-3333-3333-3333-333333333333' limit 1;
  if v_prod is null or v_cli is null then
    raise notice 'SALTEADO 4: el negocio 3 no tiene producto o cliente en el fixture';
    return;
  end if;

  update public.members set can_sell_on_credit = false
   where profile_id = '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"22b9e8aa-7e92-4af5-b193-b94c4bfbed8b","role":"authenticated"}', true);
  begin
    perform public.register_sale(
      '33333333-3333-3333-3333-333333333333'::uuid,
      jsonb_build_array(jsonb_build_object('product_id', v_prod, 'qty', 1)),
      'account'::text, gen_random_uuid()::text, v_cli);
    raise exception 'FALLO 4.a: fió sin can_sell_on_credit';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 4 · sin can_sell_on_credit, register_sale(account) levanta not_allowed'

-- ---- 5 · can_apply_discount sobre el unit_price manual ------------------
begin;
do $$
declare v_prod uuid;
begin
  select id into v_prod from public.products where store_id = '33333333-3333-3333-3333-333333333333' limit 1;
  if v_prod is null then raise notice 'SALTEADO 5'; return; end if;

  update public.members set can_apply_discount = false
   where profile_id = '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"22b9e8aa-7e92-4af5-b193-b94c4bfbed8b","role":"authenticated"}', true);
  begin
    perform public.register_sale(
      '33333333-3333-3333-3333-333333333333'::uuid,
      jsonb_build_array(jsonb_build_object('product_id', v_prod, 'qty', 1, 'unit_price', 1)),
      'cash'::text, gen_random_uuid()::text);
    raise exception 'FALLO 5.a: puso precio a mano sin can_apply_discount';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 5 · sin can_apply_discount, el unit_price manual levanta not_allowed'

-- ---- 6 · can_void_sale sobre void_sale ---------------------------------
begin;
do $$
declare v_sale uuid;
begin
  select id into v_sale from public.sales
   where store_id = '33333333-3333-3333-3333-333333333333' and status = 'completed' limit 1;
  if v_sale is null then raise notice 'SALTEADO 6: el negocio 3 no tiene ventas'; return; end if;

  update public.members set can_void_sale = false
   where profile_id = '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"22b9e8aa-7e92-4af5-b193-b94c4bfbed8b","role":"authenticated"}', true);
  begin
    perform public.void_sale('33333333-3333-3333-3333-333333333333'::uuid, v_sale, 'test'::text);
    raise exception 'FALLO 6.a: anuló sin can_void_sale';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 6 · sin can_void_sale, void_sale levanta not_allowed'

-- ---- 7 · can_receive_stock sobre register_purchase ----------------------
begin;
do $$
declare v_prod uuid;
begin
  select id into v_prod from public.products where store_id = '33333333-3333-3333-3333-333333333333' limit 1;
  if v_prod is null then raise notice 'SALTEADO 7'; return; end if;

  update public.members set can_receive_stock = false
   where profile_id = '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"22b9e8aa-7e92-4af5-b193-b94c4bfbed8b","role":"authenticated"}', true);
  begin
    perform public.register_purchase(
      '33333333-3333-3333-3333-333333333333'::uuid,
      jsonb_build_array(jsonb_build_object('product_id', v_prod, 'qty', 1, 'unit_cost', 100)));
    raise exception 'FALLO 7.a: cargó mercadería sin can_receive_stock';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;

  -- Y CON el permiso, entra. Sin esta mitad, "arreglar" sería apagar todo.
  perform set_config('role', 'postgres', true);
  update public.members set can_receive_stock = true
   where profile_id = '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"22b9e8aa-7e92-4af5-b193-b94c4bfbed8b","role":"authenticated"}', true);
  perform public.register_purchase(
    '33333333-3333-3333-3333-333333333333'::uuid,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'qty', 1, 'unit_cost', 100)));
end $$;
rollback;
\echo 'OK 7 · can_receive_stock corta sin el flag y deja pasar con el flag'

-- ---- 8 · can_see_costs sobre margenes_erosionados -----------------------
begin;
do $$
begin
  update public.members set can_see_costs = false
   where profile_id = '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"22b9e8aa-7e92-4af5-b193-b94c4bfbed8b","role":"authenticated"}', true);
  begin
    perform public.margenes_erosionados('33333333-3333-3333-3333-333333333333'::uuid);
    raise exception 'FALLO 8.a: leyó márgenes sin can_see_costs';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 8 · sin can_see_costs, margenes_erosionados levanta not_allowed'

\echo ''
\echo '========================================================================'
\echo ' 9 · CROSS-TENANT — nada de esto se cruza entre negocios'
\echo '========================================================================'

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
declare v_n int;
begin
  select count(*) into v_n from public.products
   where store_id = '22222222-2222-2222-2222-222222222222';
  if v_n <> 0 then raise exception 'FALLO 9.a: vio % productos del negocio vecino', v_n; end if;

  begin
    perform public.dashboard_summary('22222222-2222-2222-2222-222222222222');
    raise exception 'FALLO 9.b: leyó el tablero del negocio vecino';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_a_member' then raise; end if;
  end;

  begin
    perform public.cierre_caja('22222222-2222-2222-2222-222222222222');
    raise exception 'FALLO 9.c: leyó la caja del negocio vecino';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_a_member' then raise; end if;
  end;
end $$;
rollback;

-- El OWNER de un negocio tampoco cruza: no es un privilegio de plataforma.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
begin
  begin
    perform public.reportes_summary('22222222-2222-2222-2222-222222222222',
                                    current_date - 30, current_date);
    raise exception 'FALLO 9.d: un DUEÑO leyó los reportes de otro negocio';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_a_member' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 9 · aislamiento entre negocios intacto, para staff y para owner'

\echo ''
\echo '========================================================================'
\echo ' 10 · ANTI-REGRESIÓN — el dueño no perdió NADA'
\echo '========================================================================'

-- Este bloque es el que impide "arreglar" la fuga apagando la app. Si mañana
-- alguien endurece de más, se cae acá y no en producción.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := public.dashboard_summary('11111111-1111-1111-1111-111111111111');
  if v is null or not (v ? 'today') then
    raise exception 'FALLO 10.a: el dueño perdió dashboard_summary';
  end if;

  v := public.reportes_summary('11111111-1111-1111-1111-111111111111',
                               current_date - 30, current_date);
  if v is null or not (v ? 'money') then
    raise exception 'FALLO 10.b: el dueño perdió reportes_summary';
  end if;

  v := public.cierre_caja('11111111-1111-1111-1111-111111111111');
  if v is null or not (v ? 'efectivo_esperado') then
    raise exception 'FALLO 10.c: el dueño perdió cierre_caja';
  end if;

  -- Y sus costos: los lee por RPC `security definer`, que es inmune al
  -- recorte de columna del bloque 1. Ésta es la mitad que hace que el
  -- arreglo sea un arreglo y no una amputación.
  if public.margenes_erosionados('11111111-1111-1111-1111-111111111111') is null then
    raise exception 'FALLO 10.d: el dueño perdió sus márgenes';
  end if;
end $$;
rollback;
\echo 'OK 10 · el dueño conserva tablero, reportes, caja y márgenes'


\echo ''
\echo '========================================================================'
\echo ' 11 · REGRESIÓN CRÍTICA — la caja del EMPLEADO sigue funcionando entera'
\echo '========================================================================'

-- ESTE ES EL BLOQUE QUE IMPORTA. Revocar `cost` / `unit_cost` es la clase de
-- arreglo que rompe justo donde no se mira: `register_sale` ESCRIBE
-- `sale_items.unit_cost` en cada venta (003:162,191) tomándolo de
-- `products.cost` — las dos columnas que el cajero ya no puede leer.
--
-- Que funcione no es obvio, es una propiedad: las RPCs son `security definer`,
-- así que corren como el DUEÑO DE LA FUNCIÓN y no como `authenticated`. Si
-- alguna dejara de serlo, o si alguien "simplificara" una a `security invoker`,
-- la caja se cae para todos los empleados y este bloque es el que lo canta.
--
-- Se prueba el camino COMPLETO con el JWT de una cajera: vender, vender con
-- promo, monto libre, alta rápida, split y anular.

begin;
do $$
declare
  v_store uuid := '33333333-3333-3333-3333-333333333333';
  v_sofia uuid := '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';
  v_prod  uuid;
  v_prod2 uuid;
  v_cli   uuid;
  v_sale  uuid;
  v_res   jsonb;
  v_cost  numeric;
  v_promo uuid;
begin
  select id into v_prod  from public.products where store_id = v_store and cost is not null order by id limit 1;
  select id into v_prod2 from public.products where store_id = v_store and id <> v_prod order by id limit 1;
  select id into v_cli   from public.clients  where store_id = v_store limit 1;
  if v_prod is null or v_prod2 is null then
    raise exception 'FALLO 11: el fixture de escala no tiene productos con costo';
  end if;

  -- Cajera con el juego de permisos de un turno real.
  update public.members
     set can_sell_on_credit = true, can_apply_discount = true,
         can_void_sale = true, can_receive_stock = true, can_see_costs = true
   where profile_id = v_sofia;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_sofia), true);

  -- 11.a · VENTA SIMPLE. La que escribe unit_cost desde products.cost.
  v_res := public.register_sale(v_store,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'qty', 2)),
    'cash'::text, gen_random_uuid()::text);
  v_sale := (v_res->>'sale_id')::uuid;
  if v_sale is null then raise exception 'FALLO 11.a: la cajera no pudo vender'; end if;

  -- Y el costo QUEDÓ GUARDADO, aunque ella no pueda leerlo. Se verifica como
  -- postgres justamente porque el punto es que ella no lo ve.
  perform set_config('role', 'postgres', true);
  select unit_cost into v_cost from public.sale_items where sale_id = v_sale limit 1;
  if v_cost is null then
    raise exception 'FALLO 11.a: register_sale dejó de snapshotear unit_cost — el reporte de ganancia queda ciego';
  end if;
  perform set_config('role', 'authenticated', true);

  -- 11.b · PRECIO MANUAL (can_apply_discount).
  perform public.register_sale(v_store,
    jsonb_build_array(jsonb_build_object('product_id', v_prod, 'qty', 1, 'unit_price', 10)),
    'cash'::text, gen_random_uuid()::text);

  -- 11.c · FIADO (can_sell_on_credit).
  if v_cli is not null then
    perform public.register_sale(v_store,
      jsonb_build_array(jsonb_build_object('product_id', v_prod2, 'qty', 1)),
      'account'::text, gen_random_uuid()::text, v_cli);
  end if;

  -- 11.d · ANULAR (can_void_sale) — toca stock y ledger.
  perform public.void_sale(v_store, v_sale, 'test de regresión'::text);

  -- 11.e · ALTA RÁPIDA (can_receive_stock): inserta en products CON costo.
  --        Es el otro lado del recorte: escribir sí, leer no.
  perform public.crear_producto_rapido(
    v_store, 'Producto de regresión 051'::text, 100::numeric, 60::numeric);

  -- 11.e2 · MONTO LIBRE: venta sin product_id (el "algo suelto" del mostrador).
  perform public.register_sale(v_store,
    jsonb_build_array(jsonb_build_object('name', 'Suelto', 'qty', 1, 'free_amount', 250)),
    'cash'::text, gen_random_uuid()::text);

  -- 11.e3 · SPLIT: dos medios de pago en una venta.
  -- Monto libre de $100 para que los dos pagos sumen EXACTO sin depender del
  -- precio del fixture (register_split_sale exige el cuadre).
  perform public.register_split_sale(v_store,
    jsonb_build_array(jsonb_build_object('name', 'Suelto split', 'qty', 1, 'free_amount', 100)),
    jsonb_build_array(
      jsonb_build_object('method', 'cash',     'amount', 60),
      jsonb_build_object('method', 'transfer', 'amount', 40)),
    gen_random_uuid()::text);

  -- 11.f · LOS MÁRGENES que necesita esa alta rápida siguen llegando.
  if (public.margenes_del_negocio(v_store)->>'margen_default_pct') is null then
    raise exception 'FALLO 11.f: el alta rápida se quedó sin margen para proponer precio';
  end if;

  -- 11.g · Y LO QUE NO DEBE VER, sigue sin verlo — con todos los permisos
  --        de cajera puestos, que es el caso más permisivo posible.
  begin
    perform public.dashboard_summary(v_store);
    raise exception 'FALLO 11.g: una cajera con todos los flags leyó el tablero';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 11 · vender · precio manual · fiar · anular · alta rápida · monto libre · split'
\echo '        · unit_cost se sigue snapshoteando · el tablero sigue cerrado'

\echo ''
\echo '========================================================================'
\echo ' 12 · BARRIDO AUTOMÁTICO — que no aparezca una fuga NUEVA de esta clase'
\echo '========================================================================'

-- Los seis agujeros de la primera tanda no se encontraron leyendo código: se
-- encontraron preguntándole a Postgres qué columnas de plata alcanza un
-- empleado. La segunda tanda apareció igual. Por eso el barrido queda como
-- TEST y no como anécdota del documento: es la única forma de que una tabla
-- nueva —o una columna agregada a una vieja— no reabra la fuga en silencio.
--
-- CÓMO ESTÁ ESCRITO, Y POR QUÉ ASÍ. La primera versión de este bloque filtraba
-- por `has_table_privilege(..., 'select')`, y eso lo volvía CIEGO justo en las
-- tablas arregladas: cuando el permiso pasa a ser por columna, esa función
-- devuelve false y la tabla desaparecía del barrido. Se descubrió reintroduciendo
-- una fuga a propósito y viendo que el test seguía verde.
--
--   Regla que queda: un detector que descarta candidatos por una condición que
--   el propio arreglo vuelve falsa no detecta regresiones — sólo se felicita.
--
-- Por eso ahora NO se pregunta por privilegios sino por el DATO: se impersona a
-- una cajera y se cuenta cuántas filas puede traer de verdad. Eso cubre las dos
-- formas de cerrar (grant por columna y RLS por fila) y las dos de reabrir.
begin;
do $$
declare
  r record;
  v_n     bigint;
  v_fugas text := '';
begin
  /* Se corre contra el negocio 1, que es el que TIENE datos (si la tabla está
     vacía el conteo da 0 y el test se felicita solo), y con TODOS los permisos
     de Luci apagados: el piso es "una cajera que sólo cobra". Con un permiso
     puesto el resultado sería otro y no mediría nada — pasó en la primera
     corrida de este bloque, que daba verde porque Luci sí puede fiar y por eso
     `client_balances` le devolvía filas legítimamente. Todo dentro de una
     transacción que se revierte. */
  update public.members
     set can_sell_on_credit = false, can_apply_discount = false,
         can_void_sale = false, can_receive_stock = false, can_see_costs = false
   where profile_id = 'aaaaaaaa-0000-0000-0000-000000000002';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);

  for r in
    select c.relname as tabla, string_agg(a.attname, ', ' order by a.attname) as cols
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     where n.nspname = 'public'
       and c.relkind in ('r','v','m','p')
       and has_column_privilege('authenticated', c.oid, a.attname, 'select')
       and (a.attname ~* 'cost|costo|margen|margin|profit|ganancia|proveedor|supplier'
            or a.attname in ('net','neto','deuda','recaudacion','gasto','expense',
                             'total','line_total','amount','balance','owed'))
       -- ---- lista blanca, con el motivo de cada una ----------------------
       and not (c.relname = 'members' and a.attname = 'can_see_costs')
       -- ^ es un FLAG de permiso, no plata: el empleado tiene que poder saber
       --   qué puede hacer, y `getSession` lo lee en cada request.
       and not (c.relname = 'promos' and a.attname = 'below_cost_ok')
       -- ^ booleano de "el dueño aceptó vender bajo costo". No revela ningún
       --   número; sin el costo al lado no dice nada explotable.
       and not (c.relname = 'payment_intents' and a.attname = 'amount')
       -- ^ es el importe del cobro que el cajero ESTÁ generando en ese momento
       --   (lo tipeó él). Gatearlo rompería el QR y el posnet sin proteger nada
       --   que él no haya visto ya en su propia pantalla.
     group by c.relname
    loop
      execute format('select count(*) from public.%I', r.tabla) into v_n;
      if v_n > 0 then
        v_fugas := v_fugas || format(E'\n  · %s (%s) — %s filas alcanzables', r.tabla, r.cols, v_n);
      end if;
    end loop;

  perform set_config('role', 'postgres', true);

  if v_fugas <> '' then
    raise exception E'FALLO 12: una cajera alcanza columnas de plata:%s\n\n  Si el dato es del dueño: revocá la columna (patrón de 051) o cerrá las filas con RLS, o servilo por una RPC security definer que mire el flag.\n  Si NO lo es: agregalo a la lista blanca de este bloque CON el motivo escrito.', v_fugas;
  end if;
end $$;
rollback;
\echo 'OK 12 · ninguna columna de plata quedó alcanzable por una cajera sin permisos'

\echo ''
\echo '========================================================================'
\echo ' 13 · can_close_register — cierra el turno SIN ver la recaudación'
\echo '========================================================================'

-- La condición dura del owner: el permiso no sirve si otorgarlo entrega el
-- margen. Por eso el test no comprueba "puede entrar": comprueba QUÉ RECIBE.
begin;
do $$
declare
  v_store uuid := '33333333-3333-3333-3333-333333333333';
  v_sofia uuid := '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';
  v_res   jsonb;
  k       text;
begin
  -- 13.a · SIN el flag no entra (el default es false, mínimo privilegio).
  update public.members set can_close_register = false where profile_id = v_sofia;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_sofia), true);
  begin
    perform public.cierre_caja(v_store);
    raise exception 'FALLO 13.a: cerró la caja sin can_close_register';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;

  -- 13.b · CON el flag entra…
  perform set_config('role', 'postgres', true);
  update public.members set can_close_register = true where profile_id = v_sofia;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_sofia), true);
  v_res := public.cierre_caja(v_store);

  -- …y recibe lo que necesita para contar el cajón.
  if not (v_res ? 'efectivo_esperado') then
    raise exception 'FALLO 13.b: sin efectivo_esperado no puede cerrar nada';
  end if;
  if not (v_res ? 'ventas_del_turno') or not (v_res ? 'anuladas') then
    raise exception 'FALLO 13.c: le falta el conteo del turno';
  end if;

  -- 13.d · LA AFIRMACIÓN QUE IMPORTA: ninguna clave de plata del dueño.
  --        Se enumeran una por una y a propósito: si alguien agrega una clave
  --        nueva al return del dueño y se olvida del recorte, cae acá.
  foreach k in array array['facturado','entro_en_caja','fiado','cobros_fiado',
                           'by_method','ventas','profit','ganancia','margen']
  loop
    if v_res ? k then
      raise exception 'FALLO 13.d: el cajero recibió `%` — eso es plata del dueño', k;
    end if;
  end loop;

  -- 13.e · y el dueño NO perdió nada con el recorte.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);
  v_res := public.cierre_caja(v_store);
  if not (v_res ? 'facturado') or not (v_res ? 'by_method') or not (v_res ? 'ventas') then
    raise exception 'FALLO 13.e: el dueño perdió el cierre completo';
  end if;
end $$;
rollback;
\echo 'OK 13 · cierra el turno con efectivo esperado; sin facturado, by_method ni el detalle'

\echo ''
\echo '========================================================================'
\echo ' 14 · can_see_reports — qué se vende y qué falta, sin un peso'
\echo '========================================================================'

begin;
do $$
declare
  v_store uuid := '33333333-3333-3333-3333-333333333333';
  v_sofia uuid := '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';
  v_res   jsonb;
  v_txt   text;
  k       text;
begin
  -- 14.a · SIN el flag, nada.
  update public.members set can_see_reports = false where profile_id = v_sofia;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_sofia), true);
  begin
    perform public.reportes_reposicion(v_store, current_date - 30, current_date);
    raise exception 'FALLO 14.a: vio el reporte sin can_see_reports';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;

  -- 14.b · CON el flag, recibe lo suyo.
  perform set_config('role', 'postgres', true);
  update public.members set can_see_reports = true where profile_id = v_sofia;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_sofia), true);
  v_res := public.reportes_reposicion(v_store, current_date - 30, current_date);

  foreach k in array array['top_units','low_stock','expiring','by_slot','volumen']
  loop
    if not (v_res ? k) then
      raise exception 'FALLO 14.b: le falta `%` — sin eso el reporte no sirve para reponer', k;
    end if;
  end loop;

  -- 14.c · NI UNA CLAVE DE PLATA, en NINGÚN nivel del jsonb.
  --        No se enumeran claves: se busca el nombre en TODO el árbol. Si
  --        alguien agrega `revenue` adentro de `top_units` dentro de seis
  --        meses, cae acá aunque nadie se acuerde de este test.
  foreach k in array array['sold','profit','margin_pct','revenue','total',
                           'line_total','cost','purchased','shelf_value',
                           'prev_sold','money','credit','waste']
  loop
    if exists (
      select 1 from jsonb_path_query(v_res, ('$.**.' || k)::jsonpath) limit 1
    ) then
      raise exception 'FALLO 14.c: el reporte del empleado trae `%` — es plata', k;
    end if;
  end loop;

  -- 14.d · y no hay números de plata escondidos con otro nombre: el reporte
  --        entero no puede mencionar ninguna de las columnas monetarias.
  v_txt := v_res::text;
  if v_txt ~* '"(facturado|ganancia|margen|recaudacion)"' then
    raise exception 'FALLO 14.d: apareció una clave de plata en el payload';
  end if;

  -- 14.e · el reporte COMPLETO del dueño sigue cerrado para ella.
  begin
    perform public.reportes_summary(v_store, current_date - 30, current_date);
    raise exception 'FALLO 14.e: can_see_reports le abrió el reporte del dueño';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 14 · unidades, ritmo, faltantes y vencimientos — cero plata, en todo el árbol'
\echo '        · y reportes_summary sigue siendo del dueño'

\echo ''
\echo '========================================================================'
\echo ' TODOS LOS BLOQUES EN VERDE'
\echo '========================================================================'
