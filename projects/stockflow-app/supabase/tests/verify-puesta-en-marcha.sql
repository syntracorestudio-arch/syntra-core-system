-- =============================================================================
-- verify-puesta-en-marcha.sql · F1a PR B (migración 038)
--
-- Un producto dado de alta en el mostrador arranca sin baseline de góndola:
-- stock 0 que vende hacia negativo. Sus alertas de stock MIENTEN. Esta suite
-- prueba que se apagan SOLO para esos productos, que se ven (no desaparecen en
-- silencio), y sobre todo que un negocio que ya venía funcionando NO pierde ni
-- una alerta.
--
-- Correr:
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/verify-puesta-en-marcha.sql
--
-- Transaccional: termina en ROLLBACK, no deja rastro.
-- =============================================================================
begin;

do $$
declare
  v_store   constant uuid := '11111111-1111-1111-1111-111111111111';
  v_owner   constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_cat     uuid;
  v_organico uuid;   -- alta de mostrador, sin contar  → NO confiable
  v_contado  uuid;   -- alta de mostrador, contando    → confiable
  v_viejo    uuid;   -- producto preexistente          → confiable (default)
  v_n        int;
  v_total    int;
  v_json     jsonb;
  v_antes    int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_cat from public.categories
   where store_id = v_store and status = 'active' order by sort limit 1;

  ---------------------------------------------------------------------------
  -- Preparación: los tres casos que conviven en un negocio en puesta en marcha
  ---------------------------------------------------------------------------
  -- Preexistente con stock bajo REAL: es el que no se puede perder.
  insert into public.products (store_id, name, price, cost, low_stock_threshold)
  values (v_store, 'ZZ Preexistente bajo', 1000, 600, 5)
  returning id into v_viejo;

  -- Alta de mostrador sin contar: vendible, pero su stock es un número sin respaldo.
  v_json := public.crear_producto_rapido(v_store, 'ZZ Orgánico sin contar', 1500, 900,
                                         null, v_cat, null);
  v_organico := (v_json->>'id')::uuid;

  -- Alta de mostrador contando: tiene baseline, sus alertas valen desde el minuto uno.
  v_json := public.crear_producto_rapido(v_store, 'ZZ Orgánico contado', 1500, 900,
                                         null, v_cat, 2);
  v_contado := (v_json->>'id')::uuid;

  ---------------------------------------------------------------------------
  -- 1. La vista low_stock_products deja de contar lo que no tiene baseline
  --    (es el ÚNICO choke point: de acá comen el cron, el dashboard y los chips)
  ---------------------------------------------------------------------------
  select count(*) into v_n from public.low_stock_products
   where id = v_organico;
  if v_n <> 0 then
    raise exception 'FALLA 1: el producto sin baseline sigue en low_stock_products';
  end if;

  select count(*) into v_n from public.low_stock_products where id = v_contado;
  if v_n <> 1 then
    raise exception 'FALLA 1: el producto CONTADO (stock 2 <= umbral 3) debería alertar y no aparece';
  end if;

  select count(*) into v_n from public.low_stock_products where id = v_viejo;
  if v_n <> 1 then
    raise exception 'FALLA 1: el producto preexistente perdió su alerta de stock bajo';
  end if;
  raise notice 'OK  1. La vista solo alerta lo que tiene baseline (preexistente y contado sí, orgánico no)';

  ---------------------------------------------------------------------------
  -- 2. El push de las 09:00 (store_alerts): ni en la lista ni en el contador
  --
  --    Sin esto el aviso diario dice "te quedaste sin X — y otros 399 productos
  --    bajo mínimo" todas las mañanas: entrena al dueño a ignorar TODOS los
  --    avisos, incluidos los que sí son urgentes.
  ---------------------------------------------------------------------------
  v_json := public.store_alerts(v_store);

  if exists (select 1 from jsonb_array_elements(v_json->'low_stock') e
              where (e->>'product_id')::uuid = v_organico) then
    raise exception 'FALLA 2: el producto sin baseline viaja en el push de stock bajo';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_json->'low_stock') e
                  where (e->>'product_id')::uuid = v_viejo) then
    raise exception 'FALLA 2: el preexistente NO viaja en el push (regresión de tienda real)';
  end if;
  -- El contador del "y otros N bajo mínimo" también tiene que dejar de inflarse.
  if (v_json->>'low_stock_total')::int
     <> (select count(*) from public.low_stock_products where store_id = v_store) then
    raise exception 'FALLA 2: low_stock_total no coincide con la vista (el contador del push miente)';
  end if;
  raise notice 'OK  2. store_alerts: el orgánico no viaja ni suma al contador; el preexistente sí alerta';

  ---------------------------------------------------------------------------
  -- 3. Dashboard: "Para reponer" no manda a comprar lo que nadie contó
  ---------------------------------------------------------------------------
  v_json := public.dashboard_summary(v_store);

  if exists (select 1 from jsonb_array_elements(v_json->'restock') e
              where (e->>'product_id')::uuid = v_organico) then
    raise exception 'FALLA 3: el producto sin baseline aparece en "Para reponer"';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_json->'restock') e
                  where (e->>'product_id')::uuid = v_viejo) then
    raise exception 'FALLA 3: el preexistente desapareció de "Para reponer" (regresión)';
  end if;
  if (v_json->>'restock_total')::int
     <> (select count(*) from public.low_stock_products where store_id = v_store) then
    raise exception 'FALLA 3: restock_total no coincide con la vista';
  end if;
  raise notice 'OK  3. Dashboard: el orgánico no aparece en "Para reponer"; el preexistente sí';

  ---------------------------------------------------------------------------
  -- 4. Stock muerto: un delta sobre base desconocida NO es plata parada
  --
  --    El caso real: nace en 0, recibe 30 por ingreso (que NO gradúa), pasan 30
  --    días sin venderse. El sistema diría "tenés $27.000 parados" cuando en la
  --    góndola hay "lo que ya había + 30". Es un número inventado.
  ---------------------------------------------------------------------------
  -- Por el camino REAL (recibir mercadería), que es justamente el que NO gradúa.
  perform public.register_purchase(v_store, jsonb_build_array(
    jsonb_build_object('product_id', v_organico, 'qty', 30, 'unit_cost', 900)));

  if (select stock_confiable from public.products where id = v_organico) then
    raise exception 'FALLA 4: recibir mercadería graduó el producto (un delta no es un baseline)';
  end if;

  -- Envejecer los productos requiere privilegio (los grants por columna de 001
  -- no dejan tocar created_at desde la app, y está bien que así sea).
  perform set_config('role', 'postgres', true);
  update public.products set created_at = now() - interval '90 days'
   where id in (v_organico, v_viejo);
  perform set_config('role', 'authenticated', true);

  v_json := public.reportes_summary(v_store,
              (now() - interval '30 days')::date, now()::date);

  if exists (select 1 from jsonb_array_elements(v_json->'dead_stock'->'items') e
              where (e->>'product_id')::uuid = v_organico) then
    raise exception 'FALLA 4: stock muerto valúa un producto sin baseline (plata inventada)';
  end if;
  raise notice 'OK  4. Stock muerto ignora lo que no tiene baseline (el ingreso no lo volvió confiable)';

  ---------------------------------------------------------------------------
  -- 5. NADA se esconde en silencio: el negocio puede VER qué quedó sin control
  ---------------------------------------------------------------------------
  v_json := public.categorias_resumen(v_store);
  if (v_json->'sin_control_stock'->>'productos')::int < 1 then
    raise exception 'FALLA 5: categorias_resumen no reporta los productos sin control de stock';
  end if;

  select (public.productos_buscar(v_store, null, null, 50, 0, false, true)->>'total')::int
    into v_total;
  if v_total < 1 then
    raise exception 'FALLA 5: no se puede LISTAR los productos sin control de stock';
  end if;
  if exists (
    select 1 from jsonb_array_elements(
      public.productos_buscar(v_store, null, null, 50, 0, false, true)->'items') e
     where (e->>'id')::uuid = v_viejo) then
    raise exception 'FALLA 5: el filtro de "sin control" trae productos que SÍ tienen baseline';
  end if;
  raise notice 'OK  5. Los productos sin control se cuentan y se listan (no hay silencio)';

  ---------------------------------------------------------------------------
  -- 6. Graduación: contar la góndola devuelve las alertas
  ---------------------------------------------------------------------------
  -- Quedó en 30 por el ingreso; el dueño cuenta la góndola y hay 2.
  perform public.adjust_stock(v_store, v_organico, -28, 'adjust', 'conteo de estante');

  if not (select stock_confiable from public.products where id = v_organico) then
    raise exception 'FALLA 6: contar el estante no graduó el producto';
  end if;

  select count(*) into v_n from public.low_stock_products where id = v_organico;
  if v_n <> 1 then
    raise exception 'FALLA 6: después de contar, el producto sigue sin alertar';
  end if;
  raise notice 'OK  6. Contar el estante gradúa el producto y le enciende las alertas';

  ---------------------------------------------------------------------------
  -- 6b. Contar y que COINCIDA también gradúa
  --
  --     Es el caso que obliga a tener `marcar_stock_contado`: delta 0, el ledger
  --     lo rechaza, y sin esto el producto quedaría fuera del modo para siempre.
  ---------------------------------------------------------------------------
  v_json := public.crear_producto_rapido(v_store, 'ZZ Coincide al contar', 800, 500,
                                         null, v_cat, null);
  v_organico := (v_json->>'id')::uuid;   -- nace en 0 y no confiable

  perform public.marcar_stock_contado(v_store, v_organico, 0);   -- contó: hay 0

  if not (select stock_confiable from public.products where id = v_organico) then
    raise exception 'FALLA 6b: contar un total que coincide no graduó el producto';
  end if;
  if exists (select 1 from public.stock_ledger
              where product_id = v_organico and reason = 'adjust') then
    raise exception 'FALLA 6b: se asentó un movimiento que no existió';
  end if;
  raise notice 'OK  6b. Contar y que coincida gradúa sin inventar un movimiento';

  ---------------------------------------------------------------------------
  -- 7. REGRESIÓN DURA: una tienda que ya venía funcionando no cambia en NADA
  --
  --    Todos sus productos son confiables por default (037), así que el conteo
  --    de alertas antes y después de esta migración tiene que ser idéntico.
  ---------------------------------------------------------------------------
  -- A esta altura ya se contó todo (test 6), así que el negocio salió del modo:
  -- no queda ni un producto sin baseline.
  select count(*) into v_n from public.products
   where store_id = v_store and status = 'active' and not stock_confiable;
  if v_n <> 0 then
    raise exception 'FALLA 7: quedaron % productos sin baseline después de contarlos', v_n;
  end if;

  -- Y con todo contado, la vista tiene que dar EXACTAMENTE lo mismo que su
  -- definición vieja (la de 001, sin el filtro): para un negocio que ya venía
  -- funcionando, esta migración es un no-op.
  select count(*) into v_antes
    from public.products p
    left join public.store_settings s on s.store_id = p.store_id
   where p.store_id = v_store and p.status = 'active'
     and p.stock <= coalesce(p.low_stock_threshold, s.low_stock_threshold_default, 3);

  select count(*) into v_n from public.low_stock_products where store_id = v_store;
  if v_n <> v_antes then
    raise exception 'FALLA 7: con todo contado la vista difiere de la definición vieja (% vs %)',
      v_n, v_antes;
  end if;
  raise notice 'OK  7. Con el stock contado, la vista da idéntico a antes: no-op para un negocio en marcha';
end $$;

rollback;

\echo '=== puesta en marcha: OK ==='
