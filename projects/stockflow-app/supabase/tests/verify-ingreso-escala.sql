-- =============================================================================
-- verify-ingreso-escala.sql · F3 (migración 040)
--
-- "Recibir mercadería" era la última pantalla con el precargado viejo: 500
-- productos alfabéticos + 2000 códigos + 3000 asientos. Con 2000 SKUs eso deja
-- ~75% del catálogo INALCANZABLE para recibir (y con él, el conteo de F1b que
-- vive justo ahí). Además resolvía el escaneo contra un mapa en memoria: la
-- misma clase de bug que el RIESGO 0 que el POS ya cerró.
--
-- `ingreso_buscar` resuelve las dos cosas en la base, acotado.
--
-- Correr:
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/verify-ingreso-escala.sql
--
-- Transaccional: termina en ROLLBACK.
-- =============================================================================
begin;

do $$
declare
  v_store   constant uuid := '11111111-1111-1111-1111-111111111111';
  v_ajeno   constant uuid := '22222222-2222-2222-2222-222222222222';
  v_owner   constant uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_cat     uuid;
  v_p       uuid;
  v_arch    uuid;
  v_json    jsonb;
  v_item    jsonb;
  v_n       int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select id into v_cat from public.categories
   where store_id = v_store and status = 'active' order by sort limit 1;

  -- Producto con código e historial de compra.
  v_json := public.crear_producto_rapido(v_store, 'ZZ Ingreso escala', 2000, 1200,
                                         '7790001234567', v_cat, 5);
  v_p := (v_json->>'id')::uuid;

  perform public.register_purchase(v_store, jsonb_build_array(
    jsonb_build_object('product_id', v_p, 'qty', 10, 'unit_cost', 1300)));

  ---------------------------------------------------------------------------
  -- 1. Buscar por nombre: trae lo que la línea necesita, sin precargar nada
  ---------------------------------------------------------------------------
  v_json := public.ingreso_buscar(v_store, 'ingreso escala');
  select e into v_item from jsonb_array_elements(v_json->'items') e
   where (e->>'id')::uuid = v_p;

  if v_item is null then
    raise exception 'FALLA 1: la búsqueda por nombre no encuentra el producto';
  end if;
  if (v_item->>'stock')::numeric <> 15 then   -- 5 del alta + 10 de la compra
    raise exception 'FALLA 1: el stock viaja mal (%)', v_item->>'stock';
  end if;
  if not (v_item->'barcodes' ? '7790001234567') then
    raise exception 'FALLA 1: el código no viaja con el producto';
  end if;
  raise notice 'OK  1. Búsqueda por nombre: producto, stock y códigos en una sola consulta';

  ---------------------------------------------------------------------------
  -- 2. El radar de inflación viaja con la línea: última compra y su fecha
  --
  --    Es lo que hace que el aumento del proveedor se vea EN EL MOMENTO de
  --    tipear el costo nuevo, y no meses después con el margen ya comido.
  ---------------------------------------------------------------------------
  if (v_item->'ultima_compra'->>'costo')::numeric <> 1300 then
    raise exception 'FALLA 2: la última compra debería ser 1300 y es %',
      v_item->'ultima_compra'->>'costo';
  end if;
  if v_item->'ultima_compra'->>'fecha' is null then
    raise exception 'FALLA 2: la última compra viaja sin fecha';
  end if;
  raise notice 'OK  2. La última compra (1300) viaja con la línea';

  ---------------------------------------------------------------------------
  -- 3. La carga inicial TAMBIÉN cuenta como costo conocido (037)
  --
  --    El asiento `initial` congela su costo justamente para no ser invisible
  --    al radar. Un producto que solo tuvo carga inicial tiene que mostrarlo.
  ---------------------------------------------------------------------------
  v_json := public.crear_producto_rapido(v_store, 'ZZ Solo carga inicial', 900, 500,
                                         null, v_cat, 4);
  v_json := public.ingreso_buscar(v_store, 'solo carga inicial');
  select e into v_item from jsonb_array_elements(v_json->'items') e limit 1;

  if (v_item->'ultima_compra'->>'costo')::numeric <> 500 then
    raise exception 'FALLA 3: la carga inicial no aparece como costo conocido (%)',
      v_item->'ultima_compra';
  end if;
  raise notice 'OK  3. La carga inicial cuenta como último costo conocido';

  ---------------------------------------------------------------------------
  -- 4. Escaneo EXACTO: un código no puede resolver por parecido
  --
  --    Es la clase de bug que el POS ya cerró: sumarle mercadería al producto
  --    equivocado parte el stock de los dos y ninguno refleja la góndola.
  ---------------------------------------------------------------------------
  v_json := public.ingreso_buscar(v_store, '779000123', 8, true);   -- prefijo, NO el código
  if jsonb_array_length(v_json->'items') <> 0 then
    raise exception 'FALLA 4: el modo exacto resolvió un código por prefijo';
  end if;

  v_json := public.ingreso_buscar(v_store, 'ZZ Ingreso escala', 8, true);   -- nombre
  if jsonb_array_length(v_json->'items') <> 0 then
    raise exception 'FALLA 4: el modo exacto resolvió por nombre';
  end if;

  v_json := public.ingreso_buscar(v_store, '7790001234567', 8, true);
  if jsonb_array_length(v_json->'items') <> 1
     or (v_json->'items'->0->>'id')::uuid <> v_p then
    raise exception 'FALLA 4: el modo exacto no resuelve el código completo';
  end if;
  raise notice 'OK  4. Escaneo exacto: solo el código completo resuelve (ni prefijo ni nombre)';

  ---------------------------------------------------------------------------
  -- 5. Un producto archivado se resuelve pero viene MARCADO
  --
  --    Recibir mercadería de algo archivado casi siempre es un error; que no
  --    aparezca sería peor (el kiosquero cree que el código no existe).
  ---------------------------------------------------------------------------
  v_json := public.crear_producto_rapido(v_store, 'ZZ Archivado ingreso', 700, 400,
                                         '7790009999999', v_cat, null);
  v_arch := (v_json->>'id')::uuid;
  update public.products set status = 'archived' where id = v_arch;

  v_json := public.ingreso_buscar(v_store, '7790009999999', 8, true);
  if jsonb_array_length(v_json->'items') <> 1 then
    raise exception 'FALLA 5: el archivado no se resuelve por código';
  end if;
  if not (v_json->'items'->0->>'archivado')::boolean then
    raise exception 'FALLA 5: el archivado no viene marcado';
  end if;
  raise notice 'OK  5. El archivado se resuelve pero viene marcado';

  ---------------------------------------------------------------------------
  -- 6. Lectura ACOTADA: el límite se recorta, no se respeta a ciegas
  ---------------------------------------------------------------------------
  v_json := public.ingreso_buscar(v_store, 'a', 9999);
  if (v_json->>'limit')::int > 20 then
    raise exception 'FALLA 6: el límite no está acotado (%)', v_json->>'limit';
  end if;
  if jsonb_array_length(v_json->'items') > 20 then
    raise exception 'FALLA 6: devolvió más filas que el tope';
  end if;
  raise notice 'OK  6. La lectura está acotada (tope 20 por consulta)';

  ---------------------------------------------------------------------------
  -- 7. Aislamiento: el gate de membresía y nada de otros negocios
  ---------------------------------------------------------------------------
  begin
    perform public.ingreso_buscar(v_ajeno, 'coca');
    raise exception 'FALLA 7: pudo buscar en un negocio ajeno';
  exception when others then
    if sqlerrm not like '%not_a_member%' then
      raise exception 'FALLA 7: error inesperado: %', sqlerrm;
    end if;
  end;

  v_json := public.ingreso_buscar(v_store, 'a', 20);
  select count(*) into v_n
    from jsonb_array_elements(v_json->'items') e
    join public.products p on p.id = (e->>'id')::uuid
   where p.store_id <> v_store;
  if v_n <> 0 then
    raise exception 'FALLA 7: aparecieron % productos de otro negocio', v_n;
  end if;
  raise notice 'OK  7. Gate de membresía y cero filas de otros negocios';
end $$;

rollback;

\echo '=== ingreso a escala: OK ==='
