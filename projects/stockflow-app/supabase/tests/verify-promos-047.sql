-- StockFlow — VERIFY: Promociones, sección (migración 047)
--
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/verify-promos-047.sql
--
-- Prerequisitos: supabase db reset (001..047) + seed.sql.
-- `verify-promos.sql` (045) tiene que seguir VERDE: esto se suma, no reemplaza.
--
-- Qué se prueba, y por qué:
--   1  el día se corta en la tz DEL NEGOCIO (B5) — una promo "hasta el viernes"
--      seguía aplicando el viernes a las 22:00 hora local
--   2  duración mínima: 3 días sin vencimiento ligado (B2)
--   3  el borde que pidió el owner: vence en 2 días ⇒ 2 días vale
--   4  techo: una promo atada no puede sobrevivir al lote
--   5  el SEGUNDO ESCALÓN se sugiere (B1) — sin esto, "el sistema vuelve a
--      avisar" era inejecutable
--   6  no se re-sugiere sobre una promo de hoy (no contradecirse al otro día)
--   7  la escalera se calcula sobre el precio de LISTA, no sobre el vigente
--      (si no, los descuentos se componen solos)
--   8  el reemplazo hereda el precio de lista (si no, el tachado del POS
--      mostraría una rebaja más chica de la que hubo)
--   9  la medición NO cuenta ventas anuladas (B3)
--  10  la medición dice qué había en juego: lote y costo (B4)
--  11  carteles: sólo lo activo hoy, sin programadas, con "termina hoy"
--  12  carteles: aislamiento entre negocios
--
-- NOTA DE PRIVILEGIOS: `promos` es deny-all para `authenticated` (todo entra
-- por RPC), así que los fixtures que la tocan directo van como `postgres`.

\set ON_ERROR_STOP on
\timing off

begin;

\set store  '11111111-1111-1111-1111-111111111111'
\set store2 '22222222-2222-2222-2222-222222222222'
\set pa 'd7000000-0000-0000-0000-0000000000a1'
\set pb 'd7000000-0000-0000-0000-0000000000a2'
\set pc 'd7000000-0000-0000-0000-0000000000a3'
\set pd 'd7000000-0000-0000-0000-0000000000a4'
\set pe 'd7000000-0000-0000-0000-0000000000a5'

-- ===========================================================================
-- FIXTURES (rol postgres)
-- ===========================================================================
insert into public.products (id, store_id, name, emoji, cost, price, stock, status)
values (:'pa', :'store', 'Turrón 047',  '🍬', 200, 1000, 10, 'active'),
       (:'pb', :'store', 'Budín 047',   '🍞', 600, 1000, 10, 'active'),
       (:'pc', :'store', 'Yogur 047',   '🥛', 200, 1000, 10, 'active'),
       (:'pd', :'store', 'Queso 047',   '🧀', 600, 1000, 10, 'active'),
       (:'pe', :'store', 'Flan 047',    '🍮', 200, 1000, 10, 'active')
on conflict (id) do update set cost = excluded.cost, price = excluded.price,
                               stock = excluded.stock, status = 'active';

-- ===========================================================================
-- 1 · B5 · el día se corta en la timezone DEL NEGOCIO
--
-- El bug de 045: `current_date` es la fecha UTC del servidor. En Argentina se
-- adelanta a las 21:00 hora local, así que una promo con `ends_on` = hoy dejaba
-- de aplicar tres horas antes de que cerrara el kiosco, con el cartel puesto.
--
-- Se prueba con dos husos extremos (UTC−12 y UTC+14, separados por 26 h): en
-- cualquier instante del día al menos uno tiene una fecha local distinta de la
-- del servidor. Bajo el código viejo, ese es exactamente el caso que fallaba.
-- ===========================================================================
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_prod  uuid := 'd7000000-0000-0000-0000-0000000000a1';
  v_tz    text;
  v_hoy   date;
  v_dif   int := 0;
  v_found uuid;
  v_orig  text;
begin
  select timezone into v_orig from public.stores where id = v_store;

  foreach v_tz in array array['Etc/GMT+12', 'Pacific/Kiritimati'] loop
    update public.stores set timezone = v_tz where id = v_store;
    v_hoy := public.store_hoy(v_store);

    if v_hoy <> current_date then
      v_dif := v_dif + 1;
    end if;

    delete from public.promos where product_id = v_prod;
    insert into public.promos (store_id, product_id, promo_price, list_price,
                               cost_at_start, starts_on, ends_on, origin)
    values (v_store, v_prod, 800, 1000, 200, v_hoy, v_hoy, 'manual');

    select id into v_found from public.promo_vigente(v_store, v_prod);
    if v_found is null then
      raise exception 'FALLO 1.a: en % la promo de HOY (%) no aplica; el día se está cortando en UTC (%)',
        v_tz, v_hoy, current_date;
    end if;
  end loop;

  if v_dif = 0 then
    raise exception 'FALLO 1.b: ni UTC-12 ni UTC+14 dieron una fecha distinta de la del servidor — el test no probó nada';
  end if;

  update public.stores set timezone = v_orig where id = v_store;
  delete from public.promos where product_id = v_prod;
end $$;

-- ===========================================================================
-- BLOQUE OWNER (rol authenticated) — 2, 3, 4, 8
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_pa    uuid := 'd7000000-0000-0000-0000-0000000000a1';
  v_pb    uuid := 'd7000000-0000-0000-0000-0000000000a2';
  v_hoy   date;
  v_exp   uuid;
  v_res   jsonb;
  v_lp    numeric;
begin
  v_hoy := public.store_hoy(v_store);

  -- ---- 2 · duración mínima sin vencimiento ligado: 3 días ----------------
  begin
    perform public.create_promo(v_store, v_pa, 800, v_hoy, v_hoy);
    raise exception 'FALLO 2.a: aceptó una promo de UN día (latigazo de precio)';
  exception when others then
    if sqlerrm <> 'promo_too_short' then raise; end if;
  end;

  begin
    perform public.create_promo(v_store, v_pa, 800, v_hoy, v_hoy + 1);
    raise exception 'FALLO 2.b: aceptó una promo de DOS días sin vencimiento ligado';
  exception when others then
    if sqlerrm <> 'promo_too_short' then raise; end if;
  end;

  v_res := public.create_promo(v_store, v_pa, 800, v_hoy, v_hoy + 2);
  if v_res->>'promo_id' is null then
    raise exception 'FALLO 2.c: rechazó una promo de TRES días, que es el mínimo';
  end if;
  perform public.end_promo(v_store, (v_res->>'promo_id')::uuid);

  -- ---- 3 · el borde del owner: vence en 2 días ⇒ 2 días vale -------------
  -- "Mínimo 3 días O hasta el vencimiento, lo que sea MÁS CORTO." Liquidar
  -- algo que vence pasado mañana es medio motivo de la feature: si el piso de
  -- 3 días no cediera, el caso más urgente sería el único imposible.
  insert into public.stock_expiries (store_id, product_id, expiry_date, qty)
  values (v_store, v_pa, v_hoy + 1, 6)
  returning id into v_exp;

  v_res := public.create_promo(v_store, v_pa, 800, v_hoy, v_hoy + 1, v_exp);
  if v_res->>'promo_id' is null then
    raise exception 'FALLO 3.a: rechazó una promo de 2 días sobre un lote que vence en 2 días';
  end if;
  perform public.end_promo(v_store, (v_res->>'promo_id')::uuid);

  -- Un día MENOS que el vencimiento sigue siendo demasiado corto: el piso cede
  -- hasta el vencimiento, no más allá.
  begin
    perform public.create_promo(v_store, v_pa, 800, v_hoy, v_hoy, v_exp);
    raise exception 'FALLO 3.b: aceptó 1 día sobre un lote que vence en 2';
  exception when others then
    if sqlerrm <> 'promo_too_short' then raise; end if;
  end;

  -- El caso extremo legítimo: vence HOY ⇒ una promo de un día tiene que poder.
  insert into public.stock_expiries (store_id, product_id, expiry_date, qty)
  values (v_store, v_pb, v_hoy, 4)
  returning id into v_exp;

  v_res := public.create_promo(v_store, v_pb, 800, v_hoy, v_hoy, v_exp);
  if v_res->>'promo_id' is null then
    raise exception 'FALLO 3.c: rechazó una promo de un día sobre un lote que vence HOY';
  end if;
  perform public.end_promo(v_store, (v_res->>'promo_id')::uuid);

  -- ---- 4 · techo: la promo no sobrevive al lote --------------------------
  -- Atar el lote ES decir "esta promo es por este lote". Si durara más, pasado
  -- el vencimiento estaría liquidando la mercadería NUEVA al precio de la vieja.
  begin
    perform public.create_promo(v_store, v_pb, 800, v_hoy, v_hoy + 20, v_exp);
    raise exception 'FALLO 4: aceptó una promo que dura más que el lote al que está atada';
  exception when others then
    if sqlerrm <> 'promo_after_expiry' then raise; end if;
  end;

  -- ---- 8 · el reemplazo hereda el precio de lista ------------------------
  -- Sin esto, el segundo escalón congelaría como "lista" el precio YA rebajado:
  -- el POS tacharía $850 en vez de $1.000 y el cliente vería una rebaja más
  -- chica de la que realmente hubo.
  v_res := public.create_promo(v_store, v_pa, 850, v_hoy, v_hoy + 5);
  v_res := public.create_promo(v_store, v_pa, 700, v_hoy, v_hoy + 5,
                               null, 'sugerida', false, true);
  if v_res->>'replaced_promo_id' is null then
    raise exception 'FALLO 8.a: el reemplazo no cerró la promo anterior';
  end if;
  select list_price into v_lp from public.promos where id = (v_res->>'promo_id')::uuid;
  if v_lp <> 1000 then
    raise exception 'FALLO 8.b: el segundo escalón heredó % como precio de lista, esperaba 1000', v_lp;
  end if;
  perform public.end_promo(v_store, (v_res->>'promo_id')::uuid);
end $$;

reset role;

-- ===========================================================================
-- FIXTURES del re-escalón (rol postgres) — hacen falta promos con `starts_on`
-- en el pasado, que `create_promo` no permite crear.
-- ===========================================================================
delete from public.promos where product_id in (:'pa', :'pb', :'pc', :'pd', :'pe');
delete from public.stock_expiries where product_id in (:'pa', :'pb', :'pc', :'pd', :'pe');

-- pc · promo arrancada hace 3 días que NO alcanza el ritmo → re-escalón.
--      Vence en 5 días ⇒ escalón −25%. Costo bajo (200) para que el piso de
--      margen no tape la cuenta y se pueda ver sobre qué base se calculó.
insert into public.stock_expiries (store_id, product_id, expiry_date, qty)
values (:'store', :'pc', public.store_hoy(:'store') + 5, 10);
insert into public.promos (store_id, product_id, promo_price, list_price,
                           cost_at_start, starts_on, ends_on, origin)
values (:'store', :'pc', 850, 1000, 200,
        public.store_hoy(:'store') - 3, public.store_hoy(:'store') + 5, 'sugerida');

-- pe · promo de hace 3 días que SÍ alcanza el ritmo: 8 vendidas en 3 días
--      (~2,7/día) contra las 2/día que exige el lote (10 u. / 5 días). El
--      motor no re-sugiere lo que ya funciona — el gate es la MISMA regla
--      determinista de siempre, no una regla nueva para promos.
insert into public.stock_expiries (store_id, product_id, expiry_date, qty)
values (:'store', :'pe', public.store_hoy(:'store') + 5, 10);
insert into public.promos (store_id, product_id, promo_price, list_price,
                           cost_at_start, starts_on, ends_on, origin)
values (:'store', :'pe', 850, 1000, 200,
        public.store_hoy(:'store') - 3, public.store_hoy(:'store') + 5, 'sugerida');
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_pe    uuid := 'd7000000-0000-0000-0000-0000000000a5';
  v_promo uuid;
  v_owner uuid;
  v_sale  uuid;
begin
  select id into v_promo from public.promos where product_id = v_pe and ended_at is null;
  select id into v_owner from public.members where store_id = v_store and role = 'owner' limit 1;
  for i in 1..4 loop
    insert into public.sales (store_id, member_id, total, payment_method, status,
                              idempotency_key, sold_at)
    values (v_store, v_owner, 1700, 'cash', 'completed',
            'p047-pe-' || i, now() - ((i % 3) || ' days')::interval)
    returning id into v_sale;
    insert into public.sale_items (sale_id, store_id, product_id, product_name, qty,
                                   unit_price, unit_cost, line_total, promo_id, list_price)
    values (v_sale, v_store, v_pe, 'Flan 047', 2, 850, 200, 1700, v_promo, 1000);
  end loop;
end $$;

-- pd · misma situación pero la promo arrancó HOY → todavía no se re-sugiere.
insert into public.stock_expiries (store_id, product_id, expiry_date, qty)
values (:'store', :'pd', public.store_hoy(:'store') + 5, 10);
insert into public.promos (store_id, product_id, promo_price, list_price,
                           cost_at_start, starts_on, ends_on, origin)
values (:'store', :'pd', 850, 1000, 600,
        public.store_hoy(:'store'), public.store_hoy(:'store') + 5, 'sugerida');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_pc    uuid := 'd7000000-0000-0000-0000-0000000000a3';
  v_pd    uuid := 'd7000000-0000-0000-0000-0000000000a4';
  v_pe    uuid := 'd7000000-0000-0000-0000-0000000000a5';
  v_sug   jsonb;
  v_it    jsonb;
  v_red   numeric;
begin
  v_sug := public.promos_sugeridas(v_store);

  -- ---- 5 · el segundo escalón EXISTE ------------------------------------
  select value into v_it from jsonb_array_elements(v_sug) t(value)
   where (value->>'product_id')::uuid = v_pc;
  if v_it is null then
    raise exception 'FALLO 5.a: no se sugiere re-escalón sobre una promo que no alcanza el ritmo — "el sistema vuelve a avisar" no funciona';
  end if;
  if not (v_it->>'es_reescalon')::boolean then
    raise exception 'FALLO 5.b: la sugerencia no se identifica como re-escalón';
  end if;
  if v_it->>'promo_vigente_id' is null or v_it->>'promo_starts_on' is null then
    raise exception 'FALLO 5.c: falta el contexto de la promo vigente; la UI no puede nombrar lo que el dueño ya decidió';
  end if;
  if (v_it->>'sugerido')::numeric >= 850 then
    raise exception 'FALLO 5.d: el re-escalón (%) no mejora el precio vigente (850)', v_it->>'sugerido';
  end if;

  -- ---- 7 · la escalera se calcula sobre el precio de LISTA ---------------
  -- Sobre el vigente daría 850*0,75 = 637: los descuentos se compondrían solos
  -- y en dos escalones estaría vendiendo bajo costo sin que nadie lo decidiera.
  select public.round_price(1000 * 0.75, coalesce(reprice_rounding, 0))
    into v_red from public.store_settings where store_id = v_store;
  if (v_it->>'sugerido')::numeric <> v_red then
    raise exception 'FALLO 7: sugerido % — esperaba % (25%% sobre el precio de LISTA, no sobre el vigente)',
      v_it->>'sugerido', v_red;
  end if;
  if (v_it->>'list_price')::numeric <> 1000 then
    raise exception 'FALLO 7.b: list_price vino %, esperaba el de lista real (1000)', v_it->>'list_price';
  end if;

  -- ---- 6 · no re-sugerir sobre una promo de HOY --------------------------
  -- Un sistema que al día siguiente se desdice del precio que él mismo propuso
  -- pierde autoridad, y encima mide sobre una muestra de un día.
  select value into v_it from jsonb_array_elements(v_sug) t(value)
   where (value->>'product_id')::uuid = v_pd;
  if v_it is not null then
    raise exception 'FALLO 6: re-sugirió sobre una promo que arrancó hoy';
  end if;

  -- ---- 6.b · el escalón vigente ALCANZA el ritmo → no se propone bajar más --
  -- Sin este gate, todo lo que ya está en promo recibiría rebajas cada vez más
  -- profundas por el solo hecho de estar en promo — el sistema se volvería una
  -- máquina de erosionar el margen que el dueño ya aceptó resignar.
  select value into v_it from jsonb_array_elements(v_sug) t(value)
   where (value->>'product_id')::uuid = v_pe;
  if v_it is not null then
    raise exception 'FALLO 6.b: propuso profundizar una promo que ya vende al ritmo necesario (sugerido %)', v_it->>'sugerido';
  end if;
end $$;

reset role;

-- ===========================================================================
-- 9 + 10 · la medición (rol authenticated · owner)
-- ===========================================================================
delete from public.sale_items where product_id = :'pe';
delete from public.sales where idempotency_key like 'p047-pe-%';
delete from public.promos where product_id in (:'pa', :'pb', :'pc', :'pd', :'pe');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_pb    uuid := 'd7000000-0000-0000-0000-0000000000a2';
  v_hoy   date;
  v_exp   uuid;
  v_res   jsonb;
  v_promo uuid;
  v_sale  uuid;
  v_it    jsonb;
begin
  v_hoy := public.store_hoy(v_store);

  insert into public.stock_expiries (store_id, product_id, expiry_date, qty)
  values (v_store, v_pb, v_hoy + 4, 8)
  returning id into v_exp;

  v_res   := public.create_promo(v_store, v_pb, 800, v_hoy, v_hoy + 4, v_exp);
  v_promo := (v_res->>'promo_id')::uuid;

  v_res  := public.register_sale(
              v_store,
              jsonb_build_array(jsonb_build_object('product_id', v_pb, 'qty', 3)),
              'cash', 'promo047-medicion');
  v_sale := (v_res->>'sale_id')::uuid;

  select value into v_it from jsonb_array_elements(public.promos_listado(v_store)) t(value)
   where (value->>'id')::uuid = v_promo;
  if (v_it->>'unidades')::numeric <> 3 then
    raise exception 'FALLO 9.a: esperaba 3 unidades medidas, vino %', v_it->>'unidades';
  end if;
  if (v_it->>'cobrado')::numeric <> 2400 then
    raise exception 'FALLO 9.b: esperaba $2400 cobrados, vino %', v_it->>'cobrado';
  end if;
  -- resignado: (1000 - 800) * 3
  if (v_it->>'costo_promo')::numeric <> 600 then
    raise exception 'FALLO 9.c: esperaba 600 de margen resignado, vino %', v_it->>'costo_promo';
  end if;

  -- ---- 10 · qué había en juego (B4) --------------------------------------
  -- El lote NO se cruza con las unidades vendidas: sin FIFO por lote, "vendiste
  -- 3 de las 8 del lote" sería una atribución que el dato no tiene.
  if (v_it->>'lote_qty')::numeric <> 8 then
    raise exception 'FALLO 10.a: lote_qty vino %, esperaba 8', v_it->>'lote_qty';
  end if;
  if (v_it->>'lote_al_costo')::numeric <> 4800 then
    raise exception 'FALLO 10.b: lote_al_costo vino %, esperaba 4800 (8 x 600)', v_it->>'lote_al_costo';
  end if;

  -- ---- 9 · B3 · la venta ANULADA no puede seguir contando ----------------
  -- El bug: los predicados `status` y `sold_at` vivían en el `on` de un
  -- `left join`, así que al anular la venta la fila de `sale_items` sobrevivía
  -- con su `qty` y el `sum` la sumaba igual. Una promo cuya única venta se
  -- anuló declaraba unidades vendidas y plata cobrada.
  perform public.void_sale(v_store, v_sale, 'test 047');

  select value into v_it from jsonb_array_elements(public.promos_listado(v_store)) t(value)
   where (value->>'id')::uuid = v_promo;
  if (v_it->>'unidades')::numeric <> 0 then
    raise exception 'FALLO 9.d: tras anular la venta la promo sigue declarando % unidades', v_it->>'unidades';
  end if;
  if (v_it->>'cobrado')::numeric <> 0 then
    raise exception 'FALLO 9.e: tras anular la venta la promo sigue declarando % cobrados', v_it->>'cobrado';
  end if;
  if (v_it->>'costo_promo')::numeric <> 0 then
    raise exception 'FALLO 9.f: tras anular la venta la promo sigue declarando % resignados', v_it->>'costo_promo';
  end if;

  perform public.end_promo(v_store, v_promo);
end $$;

reset role;

-- ===========================================================================
-- 11 + 12 · carteles de hoy
-- ===========================================================================
delete from public.promos where product_id in (:'pa', :'pb', :'pc', :'pd', :'pe');

-- pa · activa y termina HOY · pb · activa · pc · PROGRAMADA (arranca mañana)
insert into public.promos (store_id, product_id, promo_price, list_price,
                           cost_at_start, starts_on, ends_on, origin)
values (:'store', :'pa', 800, 1000, 200,
        public.store_hoy(:'store') - 2, public.store_hoy(:'store'), 'manual'),
       (:'store', :'pb', 700, 1000, 600,
        public.store_hoy(:'store'), public.store_hoy(:'store') + 4, 'manual'),
       (:'store', :'pc', 900, 1000, 200,
        public.store_hoy(:'store') + 1, public.store_hoy(:'store') + 6, 'manual');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_pa    uuid := 'd7000000-0000-0000-0000-0000000000a1';
  v_pc    uuid := 'd7000000-0000-0000-0000-0000000000a3';
  v_cart  jsonb;
  v_it    jsonb;
  v_txt   text;
begin
  v_cart := public.promos_carteles(v_store);

  select value into v_it from jsonb_array_elements(v_cart) t(value)
   where (value->>'name') = 'Turrón 047';
  if v_it is null then
    raise exception 'FALLO 11.a: una promo activa no aparece en los carteles';
  end if;
  if not (v_it->>'termina_hoy')::boolean then
    raise exception 'FALLO 11.b: la promo que termina hoy no está marcada — el cartel se queda pegado a la góndola';
  end if;
  if (v_it->>'antes')::numeric <> 1000 or (v_it->>'precio')::numeric <> 800 then
    raise exception 'FALLO 11.c: el cartel no trae los dos precios';
  end if;

  -- Una PROGRAMADA no va: un cartel puesto hoy con el precio de mañana es
  -- exactamente el desfasaje cartel↔caja que la feature existe para evitar.
  if exists (select 1 from jsonb_array_elements(v_cart) t(value)
              where (value->>'name') = 'Yogur 047') then
    raise exception 'FALLO 11.d: una promo PROGRAMADA salió en los carteles de hoy';
  end if;

  -- El cartel no puede filtrar nada que el cliente final no deba ver.
  v_txt := v_cart::text;
  if v_txt like '%cost%' or v_txt like '%margen%' or v_txt like '%stock%'
     or v_txt like '%venc%' then
    raise exception 'FALLO 11.e: los carteles exponen costo/margen/stock/vencimiento';
  end if;
end $$;

reset role;

-- 12 · aislamiento: el otro negocio no ve estos carteles.
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_store2 uuid := '22222222-2222-2222-2222-222222222222';
  v_cart   jsonb;
begin
  v_cart := public.promos_carteles(v_store2);
  if exists (select 1 from jsonb_array_elements(v_cart) t(value)
              where (value->>'name') like '%047') then
    raise exception 'FALLO 12.a: los carteles cruzaron de negocio';
  end if;

  begin
    perform public.promos_carteles('11111111-1111-1111-1111-111111111111');
    raise exception 'FALLO 12.b: pudo leer los carteles de OTRO negocio';
  exception when others then
    if sqlerrm not in ('not_a_member', 'not_allowed') then raise; end if;
  end;
end $$;

reset role;

rollback;

\echo '════════════════════════════════════════════'
\echo ' verify-promos-047.sql — TODO VERDE'
\echo '════════════════════════════════════════════'
