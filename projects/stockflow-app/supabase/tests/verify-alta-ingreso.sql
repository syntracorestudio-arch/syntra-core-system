-- =============================================================================
-- verify-alta-ingreso.sql · Alta desde Recibir mercadería (migración 041)
--
-- Recibir mercadería era la pantalla donde el kiosco en onboarding MÁS escanea
-- códigos que todavía no tiene: ahí no hay cliente esperando, el costo está en
-- la factura en la mano y la cantidad se está contando igual. Que fuera un
-- callejón sin salida ("cargalo desde Productos y volvé") era el mayor freno
-- del modelo — lo detectó el owner escaneando productos reales.
--
-- Las dos piezas nuevas:
--   · `vincular_codigo`  — pegarle el código a un producto que YA existe.
--   · `productos_sin_codigo_parecidos` — encontrar a quién pegárselo.
--
-- La segunda es la que evita el desastre silencioso: si el negocio cargó sus
-- productos a mano (o los importó de una planilla) quedaron SIN código, y
-- escanearlos crearía un gemelo de cada uno. Con 800 filas importadas, 800
-- duplicados.
--
-- Correr:
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/verify-alta-ingreso.sql
-- =============================================================================
begin;

do $$
declare
  v_store   constant uuid := '11111111-1111-1111-1111-111111111111';
  v_ajeno   constant uuid := '22222222-2222-2222-2222-222222222222';
  v_owner   constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_cajera  constant uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_cat     uuid;
  v_sincod  uuid;
  v_concod  uuid;
  v_json    jsonb;
  v_n       int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_cat from public.categories
   where store_id = v_store and status = 'active' order by sort limit 1;

  -- Cargado a mano / importado de planilla: vendible, pero sin código.
  insert into public.products (store_id, name, price, cost, category_id)
  values (v_store, 'Coca-Cola 2.25L', 3500, 2400, v_cat)
  returning id into v_sincod;

  -- Este ya tiene código: no debería aparecer nunca como candidato.
  v_json := public.crear_producto_rapido(v_store, 'Agua Villa 1.5L', 1500, 900,
                                         '7790001111111', v_cat, null);
  v_concod := (v_json->>'id')::uuid;

  ---------------------------------------------------------------------------
  -- 1. Encontrar al dueño del código: el nombre de SEPA no se parece al tuyo
  --
  --    SEPA devuelve "Gaseosa Cola Regular Coca Cola x 2.25 L" y en el kiosco
  --    está cargado como "Coca-Cola 2.25L". Un `like` no los une nunca: hay que
  --    comparar por palabras compartidas.
  ---------------------------------------------------------------------------
  v_json := public.productos_sin_codigo_parecidos(
              v_store, 'Gaseosa Cola Regular Coca Cola x 2.25 L');

  if not exists (select 1 from jsonb_array_elements(v_json->'items') e
                  where (e->>'id')::uuid = v_sincod) then
    raise exception 'FALLA 1: no encontró el producto sin código que corresponde';
  end if;
  raise notice 'OK  1. Encuentra el producto sin código aunque el nombre de SEPA sea otro';

  ---------------------------------------------------------------------------
  -- 2. Los que YA tienen código no son candidatos (ya están resueltos)
  ---------------------------------------------------------------------------
  v_json := public.productos_sin_codigo_parecidos(v_store, 'Agua Villa 1.5 L');
  if exists (select 1 from jsonb_array_elements(v_json->'items') e
              where (e->>'id')::uuid = v_concod) then
    raise exception 'FALLA 2: propuso un producto que ya tiene código';
  end if;
  raise notice 'OK  2. Un producto que ya tiene código no se ofrece como candidato';

  ---------------------------------------------------------------------------
  -- 3. Nombres que no tienen nada que ver no se proponen
  --
  --    Un falso positivo acá es caro: pegarle el código de un vodka a la yerba
  --    hace que a partir de ahí se venda uno por el otro.
  ---------------------------------------------------------------------------
  v_json := public.productos_sin_codigo_parecidos(v_store, 'Lavandina Ayudin 1 Litro');
  if exists (select 1 from jsonb_array_elements(v_json->'items') e
              where (e->>'id')::uuid = v_sincod) then
    raise exception 'FALLA 3: propuso la Coca para una lavandina';
  end if;
  raise notice 'OK  3. No propone productos que no tienen nada que ver';

  ---------------------------------------------------------------------------
  -- 4. Pegar el código: el producto pasa a ser escaneable
  ---------------------------------------------------------------------------
  perform public.vincular_codigo(v_store, v_sincod, '7790895777333');

  select count(*) into v_n from public.product_barcodes
   where store_id = v_store and barcode = '7790895777333' and product_id = v_sincod;
  if v_n <> 1 then
    raise exception 'FALLA 4: el código no quedó pegado al producto';
  end if;

  -- Y desde ahora el escaneo lo resuelve como cualquier otro.
  v_json := public.ingreso_buscar(v_store, '7790895777333', 8, true);
  if (v_json->'items'->0->>'id')::uuid is distinct from v_sincod then
    raise exception 'FALLA 4: el escaneo no resuelve el producto recién vinculado';
  end if;
  raise notice 'OK  4. Pegado el código, el producto se resuelve escaneando';

  ---------------------------------------------------------------------------
  -- 5. Idempotente: volver a pegar el MISMO código al MISMO producto no rompe
  ---------------------------------------------------------------------------
  perform public.vincular_codigo(v_store, v_sincod, '7790895777333');
  select count(*) into v_n from public.product_barcodes
   where store_id = v_store and barcode = '7790895777333';
  if v_n <> 1 then
    raise exception 'FALLA 5: se duplicó el código';
  end if;
  raise notice 'OK  5. Vincular dos veces el mismo código no duplica nada';

  ---------------------------------------------------------------------------
  -- 6. Un código que ya es de OTRO producto se rechaza
  --
  --    Sin esto, dos fichas comparten identidad y el stock de las dos miente.
  ---------------------------------------------------------------------------
  begin
    perform public.vincular_codigo(v_store, v_concod, '7790895777333');
    raise exception 'FALLA 6: dejó robarle el código a otro producto';
  exception when others then
    if sqlerrm not like '%codigo_en_uso%' then
      raise exception 'FALLA 6: error inesperado: %', sqlerrm;
    end if;
  end;
  raise notice 'OK  6. Un código que ya es de otro producto se rechaza';

  ---------------------------------------------------------------------------
  -- 7. Permisos: es la misma puerta que recibir mercadería
  ---------------------------------------------------------------------------
  update public.members set can_receive_stock = false
   where store_id = v_store and profile_id = v_cajera;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_cajera, 'role', 'authenticated')::text, true);

  begin
    perform public.vincular_codigo(v_store, v_sincod, '7790009998888');
    raise exception 'FALLA 7: una cajera sin permiso de stock pudo vincular';
  exception when others then
    if sqlerrm not like '%not_allowed%' then
      raise exception 'FALLA 7: error inesperado: %', sqlerrm;
    end if;
  end;
  raise notice 'OK  7. Sin permiso de recibir mercadería no se puede vincular';

  ---------------------------------------------------------------------------
  -- 8. Aislamiento y cotas
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  begin
    perform public.productos_sin_codigo_parecidos(v_ajeno, 'coca cola');
    raise exception 'FALLA 8: pudo buscar candidatos en un negocio ajeno';
  exception when others then
    if sqlerrm not like '%not_a_member%' then
      raise exception 'FALLA 8: error inesperado: %', sqlerrm;
    end if;
  end;

  v_json := public.productos_sin_codigo_parecidos(v_store, 'coca cola regular', 9999);
  if jsonb_array_length(v_json->'items') > 10 then
    raise exception 'FALLA 8: la lectura no está acotada';
  end if;
  raise notice 'OK  8. Gate de membresía y lectura acotada';
end $$;

rollback;

\echo '=== alta desde ingreso: OK ==='
