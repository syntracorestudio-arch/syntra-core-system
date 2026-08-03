-- =============================================================================
-- 041 · ALTA DESDE RECIBIR MERCADERÍA
--
-- Recibir mercadería es, mirado de cerca, el MEJOR lugar de la app para dar de
-- alta un producto: no hay un cliente esperando, el costo está en la factura que
-- el dueño tiene en la mano, y la cantidad se está contando igual porque se está
-- abriendo la caja. Sin embargo era la única pantalla que, ante un código
-- desconocido, terminaba en "cargalo desde Productos y volvé".
--
-- Lo detectó el owner escaneando productos reales: en un kiosco que recién
-- arranca, CASI TODO lo que se escanea al recibir es un código que el negocio
-- todavía no tiene.
--
-- Esta migración aporta las dos piezas que faltaban:
--
--   1. `vincular_codigo` — pegarle un código a un producto que YA existe.
--   2. `productos_sin_codigo_parecidos` — encontrar a quién pegárselo.
--
-- La segunda existe para evitar un desastre silencioso: los productos cargados a
-- mano (o importados de una planilla) no tienen código. Escanearlos crearía un
-- gemelo de cada uno — con 800 filas importadas, 800 duplicados, cada uno
-- partiendo el stock de un producto real en dos fichas que ninguna refleja la
-- góndola. Es la misma pieza que va a necesitar el import de CSV.
--
-- Aditiva. No toca ventas, cobros ni el corte del día.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1 · Pegarle un código a un producto existente
--
-- Mismo permiso que recibir mercadería: quien puede meter stock puede decir
-- "este código es de este producto". No es exclusivo del dueño — al recibir
-- mercadería casi nunca está él.
-- ---------------------------------------------------------------------------
create or replace function public.vincular_codigo(
  p_store_id   uuid,
  p_product_id uuid,
  p_barcode    text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_code   text := nullif(btrim(p_barcode), '');
  v_duenio uuid;
  v_prod   public.products;
begin
  v_member := public.rpc_member(p_store_id);

  if not (v_member.role = 'owner' or v_member.can_receive_stock) then
    raise exception 'not_allowed';
  end if;
  if v_code is null then
    raise exception 'codigo_invalido';
  end if;

  select * into v_prod from public.products
   where id = p_product_id and store_id = p_store_id;
  if not found then
    raise exception 'product_not_found';
  end if;

  -- ¿De quién es ese código hoy?
  select product_id into v_duenio from public.product_barcodes
   where store_id = p_store_id and barcode = v_code;

  if v_duenio is not null then
    if v_duenio = p_product_id then
      -- Ya estaba: repetir la operación no rompe nada (doble tap, reintento).
      return jsonb_build_object('id', p_product_id, 'ya_estaba', true);
    end if;
    -- De otro producto: NO se lo robamos. Dos fichas con la misma identidad
    -- hacen que el stock de las dos mienta para siempre.
    raise exception 'codigo_en_uso';
  end if;

  insert into public.product_barcodes (store_id, product_id, barcode)
  values (p_store_id, p_product_id, v_code);

  return jsonb_build_object('id', p_product_id, 'ya_estaba', false);
end $$;

revoke execute on function public.vincular_codigo(uuid, uuid, text) from public;
grant execute on function public.vincular_codigo(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2 · ¿Este código no será de algo que ya tengo cargado sin código?
--
-- El nombre que devuelve el catálogo público es el de SEPA, tal como lo publican
-- las cadenas: "Gaseosa Cola Regular Coca Cola x 2.25 L". En el kiosco el mismo
-- producto está cargado como "Coca-Cola 2.25L". Un `like` no los une NUNCA, así
-- que se comparan PALABRAS compartidas.
--
-- Se piden 2 palabras significativas en común (>= 4 letras, para que "de", "x",
-- "cc" o "ltr" no junten cualquier cosa). Un falso positivo acá es caro —
-- pegarle el código de un vodka a la yerba hace que se vendan uno por otro— así
-- que la decisión final SIEMPRE la toma la persona: esto solo propone.
--
-- Solo mira productos SIN ningún código: los que ya tienen están resueltos.
-- ---------------------------------------------------------------------------
create or replace function public.productos_sin_codigo_parecidos(
  p_store_id uuid,
  p_nombre   text,
  p_limit    int default 5
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit  int;
  v_tokens text[];
  v_items  jsonb;
begin
  perform public.rpc_member(p_store_id);   -- gate → not_a_member

  v_limit := least(greatest(coalesce(p_limit, 5), 1), 10);

  -- Palabras significativas del nombre que vino del catálogo.
  select array_agg(distinct t) into v_tokens
    from unnest(string_to_array(
           regexp_replace(public.unaccent_simple(lower(coalesce(p_nombre, ''))),
                          '[^a-z0-9]+', ' ', 'g'), ' ')) t
   where length(t) >= 4;

  if v_tokens is null or array_length(v_tokens, 1) < 2 then
    -- Con menos de dos palabras para comparar, cualquier propuesta sería un tiro
    -- al aire: mejor no ofrecer nada y que se cree el producto.
    return jsonb_build_object('items', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'name', c.name, 'emoji', c.emoji,
           'price', c.price, 'cost', c.cost, 'stock', c.stock,
           'stock_confiable', c.stock_confiable,
           'coincidencias', c.coincidencias
         ) order by c.coincidencias desc, c.name), '[]'::jsonb)
    into v_items
    from (
      select p.id, p.name, p.emoji, p.price, p.cost, p.stock, p.stock_confiable,
             (select count(*)
                from unnest(string_to_array(
                       regexp_replace(public.unaccent_simple(lower(p.name)),
                                      '[^a-z0-9]+', ' ', 'g'), ' ')) w
               where length(w) >= 4 and w = any(v_tokens)) as coincidencias
        from public.products p
       where p.store_id = p_store_id
         and p.status = 'active'
         and not exists (select 1 from public.product_barcodes b
                          where b.store_id = p_store_id and b.product_id = p.id)
    ) c
   where c.coincidencias >= 2
   limit v_limit;

  return jsonb_build_object('items', v_items);
end $$;

revoke execute on function public.productos_sin_codigo_parecidos(uuid, text, int) from public;
grant execute on function public.productos_sin_codigo_parecidos(uuid, text, int) to authenticated;