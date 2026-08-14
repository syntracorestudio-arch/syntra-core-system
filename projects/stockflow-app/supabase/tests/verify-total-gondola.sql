-- =============================================================================
-- verify-total-gondola.sql · F1b (migración 039)
--
-- El problema que resuelve: un producto que entró vendiendo arranca en 0, vende
-- hasta -8 y recibe +30. El sistema dice 22; la góndola tiene "lo que ya había
-- + 22". El corrimiento es PERMANENTE y sus avisos seguirían mintiendo, solo que
-- con otro número. Recibir mercadería con un delta nunca crea un baseline.
--
-- La salida: al recibir, declarar cuántos quedan EN TOTAL. Es el mismo esfuerzo
-- físico (ya está parado frente al estante) y deja el producto con control real.
--
-- Correr:
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/verify-total-gondola.sql
--
-- Transaccional: termina en ROLLBACK.
-- =============================================================================
begin;

do $$
declare
  v_store  constant uuid := '11111111-1111-1111-1111-111111111111';
  v_owner  constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_cat    uuid;
  v_p      uuid;
  v_otro   uuid;
  v_json   jsonb;
  v_stock  numeric;
  v_n      int;
  v_cost   numeric;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_cat from public.categories
   where store_id = v_store and status = 'active' order by sort limit 1;

  ---------------------------------------------------------------------------
  -- 1. Recibir declarando el total: el producto queda CON control de stock
  ---------------------------------------------------------------------------
  -- Nace vendiendo: 0 y sin baseline.
  v_json := public.crear_producto_rapido(v_store, 'ZZ Gondola total', 1500, 900,
                                         null, v_cat, null);
  v_p := (v_json->>'id')::uuid;

  if (select stock_confiable from public.products where id = v_p) then
    raise exception 'FALLA 1: el alta sin contar no debería nacer confiable';
  end if;

  -- Llegaron 30 y, contando lo que ya había, quedan 41 en la góndola.
  perform public.register_purchase(v_store, jsonb_build_array(
    jsonb_build_object('product_id', v_p, 'qty', 30, 'unit_cost', 950,
                       'total_gondola', 41)));

  select stock into v_stock from public.products where id = v_p;
  if v_stock <> 41 then
    raise exception 'FALLA 1: el stock quedó en % y se declararon 41', v_stock;
  end if;
  if not (select stock_confiable from public.products where id = v_p) then
    raise exception 'FALLA 1: declarar el total no encendió el control de stock';
  end if;
  raise notice 'OK  1. Recibir declarando el total deja el stock en 41 y con control';

  ---------------------------------------------------------------------------
  -- 2. La compra sigue siendo una compra: el ajuste NO se disfraza de mercadería
  --
  --    Si los 11 de diferencia entraran como 'purchase', el reporte diría que
  --    compraste 41 cuando compraste 30, y la plata gastada quedaría inflada.
  ---------------------------------------------------------------------------
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
  select count(*) into v_n from public.stock_ledger
   where product_id = v_p and reason = 'purchase' and delta = 30 and unit_cost = 950;
  perform set_config('role', 'authenticated', true);
  if v_n <> 1 then
    raise exception 'FALLA 2: no quedó el asiento de compra por 30 con su costo';
  end if;

  select coalesce(sum(delta), 0) into v_stock from public.stock_ledger
   where product_id = v_p and reason = 'purchase';
  if v_stock <> 30 then
    raise exception 'FALLA 2: la compra suma % (debería ser 30: el ajuste va aparte)', v_stock;
  end if;

  select count(*) into v_n from public.stock_ledger
   where product_id = v_p and reason = 'adjust' and delta = 11;
  if v_n <> 1 then
    raise exception 'FALLA 2: la diferencia contra el conteo no quedó asentada como ajuste';
  end if;
  raise notice 'OK  2. Compra 30 (con costo) y ajuste 11 por separado: comprado no se infla';

  ---------------------------------------------------------------------------
  -- 3. El costo del producto sigue siendo el de la ÚLTIMA compra
  ---------------------------------------------------------------------------
  /* 051 · ídem que el assert de arriba: `products.cost` ya no es legible por
     `authenticated` (es plata del dueño). Se verifica lo que la RPC ESCRIBIÓ,
     así que se lee como `postgres`. No se relajó ningún chequeo de seguridad:
     el que se relajaría es el del PRODUCTO, y ése quedó más estricto. */
  perform set_config('role', 'postgres', true);
  select cost into v_cost from public.products where id = v_p;
  perform set_config('role', 'authenticated', true);
  if v_cost <> 950 then
    raise exception 'FALLA 3: el costo quedó en % y la última compra fue a 950', v_cost;
  end if;
  raise notice 'OK  3. El costo del producto es el de la última compra (950)';

  ---------------------------------------------------------------------------
  -- 4. REGRESIÓN: recibir SIN declarar total se comporta igual que siempre
  --
  --    Es el caso de todos los negocios que ya usan el sistema: nada cambia.
  ---------------------------------------------------------------------------
  v_json := public.crear_producto_rapido(v_store, 'ZZ Gondola sin total', 1000, 600,
                                         null, v_cat, null);
  v_otro := (v_json->>'id')::uuid;

  perform public.register_purchase(v_store, jsonb_build_array(
    jsonb_build_object('product_id', v_otro, 'qty', 12, 'unit_cost', 600)));

  select stock into v_stock from public.products where id = v_otro;
  if v_stock <> 12 then
    raise exception 'FALLA 4: sin total declarado el stock debería ser el delta (12), y es %', v_stock;
  end if;
  if (select stock_confiable from public.products where id = v_otro) then
    raise exception 'FALLA 4: recibir sin contar NO puede encender el control de stock';
  end if;
  select count(*) into v_n from public.stock_ledger
   where product_id = v_otro and reason = 'adjust';
  if v_n <> 0 then
    raise exception 'FALLA 4: se inventó un ajuste que nadie pidió';
  end if;
  raise notice 'OK  4. Sin total declarado: delta puro, sin ajuste y sin graduar (regresión)';

  ---------------------------------------------------------------------------
  -- 5. Contar y que dé JUSTO lo que ya decía el sistema también gradúa
  --
  --    Delta 0: no hay movimiento que asentar, pero el conteo ocurrió. Sin esto
  --    el producto no podría salir nunca del modo por esta vía.
  ---------------------------------------------------------------------------
  perform public.register_purchase(v_store, jsonb_build_array(
    jsonb_build_object('product_id', v_otro, 'qty', 8, 'unit_cost', 600,
                       'total_gondola', 20)));   -- 12 + 8 = 20 exactos

  if not (select stock_confiable from public.products where id = v_otro) then
    raise exception 'FALLA 5: contar y que coincida no graduó el producto';
  end if;
  select count(*) into v_n from public.stock_ledger
   where product_id = v_otro and reason = 'adjust';
  if v_n <> 0 then
    raise exception 'FALLA 5: se asentó un movimiento que no existió';
  end if;
  select stock into v_stock from public.products where id = v_otro;
  if v_stock <> 20 then
    raise exception 'FALLA 5: el stock quedó en % y debería ser 20', v_stock;
  end if;
  raise notice 'OK  5. Total que coincide: gradúa sin inventar un movimiento';

  ---------------------------------------------------------------------------
  -- 6. Un total imposible se rechaza (y no deja media compra hecha)
  ---------------------------------------------------------------------------
  begin
    perform public.register_purchase(v_store, jsonb_build_array(
      jsonb_build_object('product_id', v_p, 'qty', 5, 'unit_cost', 900,
                         'total_gondola', -3)));
    raise exception 'FALLA 6: aceptó un total negativo';
  exception when others then
    if sqlerrm not like '%total_invalido%' then
      raise exception 'FALLA 6: error inesperado: %', sqlerrm;
    end if;
  end;
  raise notice 'OK  6. Un total negativo se rechaza (transacción entera)';

  ---------------------------------------------------------------------------
  -- 7. El vencimiento sigue asociándose a lo que LLEGÓ, no al total contado
  ---------------------------------------------------------------------------
  perform public.register_purchase(v_store, jsonb_build_array(
    jsonb_build_object('product_id', v_p, 'qty', 6, 'unit_cost', 900,
                       'expiry_date', (current_date + 30)::text,
                       'total_gondola', 50)));

  select qty into v_stock from public.stock_expiries
   where product_id = v_p and expiry_date = current_date + 30;
  if v_stock <> 6 then
    raise exception 'FALLA 7: el vencimiento quedó por % unidades y llegaron 6', v_stock;
  end if;
  raise notice 'OK  7. El vencimiento cubre lo que llegó (6), no el total de la góndola';
end $$;

rollback;

\echo '=== total en góndola: OK ==='
