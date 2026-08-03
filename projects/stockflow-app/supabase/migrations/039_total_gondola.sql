-- =============================================================================
-- 039 · "¿CUÁNTOS TENÉS EN TOTAL?" AL RECIBIR (onboarding F1b)
--
-- Es la pieza que hace converger el modelo de onboarding orgánico (docs §H.5).
--
-- El problema: recibir mercadería asienta un DELTA. Un producto que entró
-- vendiendo nace en 0, vende hasta -8 y recibe +30 → el sistema dice 22 mientras
-- la góndola tiene "lo que ya había + 22". El corrimiento es permanente: sus
-- avisos de faltante seguirían mintiendo, solo que con otro número. Por eso 037
-- decidió que `purchase` NO gradúa.
--
-- La salida: al recibir, poder declarar cuántos quedan EN TOTAL. Es el mismo
-- esfuerzo físico (el dueño ya está parado frente al estante reponiendo) y es lo
-- único que convierte un número sin respaldo en un stock real.
--
-- Decisión de diseño que sostiene los reportes: la diferencia contra el conteo
-- NO se suma a la compra. Van dos asientos separados —`purchase` por lo que
-- llegó (con su costo) y `adjust` por la diferencia— porque si el conteo entrara
-- como compra, "comprado" y la plata gastada quedarían inflados por un ajuste de
-- inventario. Comprar y contar son dos hechos distintos.
--
-- Aditiva y compatible: sin `total_gondola` la función se comporta exactamente
-- como antes. No toca ventas, cobros ni el corte del día.
-- =============================================================================

-- Cuerpo copiado de 003 con dos cambios quirúrgicos: la lectura de
-- `total_gondola` y el bloque de conteo al final de cada línea.
create or replace function public.register_purchase(
  p_store_id uuid,
  p_items    jsonb  -- [{product_id, qty>0, unit_cost>=0, expiry_date?, total_gondola?}]
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_member    public.members;
  v_item      jsonb;
  v_product   public.products;
  v_qty       numeric(12,3);
  v_cost      numeric(12,2);
  v_expiry    date;
  v_total     numeric(12,3);
  v_stock     numeric(12,3);
  v_applied   integer := 0;
begin
  v_member := public.rpc_member(p_store_id);

  if not (v_member.role = 'owner' or v_member.can_receive_stock) then
    raise exception 'not_allowed';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_items';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := (v_item->>'qty')::numeric;
    v_cost := (v_item->>'unit_cost')::numeric;
    v_expiry := nullif(v_item->>'expiry_date','')::date;
    -- Opcional: cuántas unidades quedan en la góndola contando lo que llegó.
    v_total := nullif(v_item->>'total_gondola','')::numeric;

    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid_qty';
    end if;
    if v_cost is not null and v_cost < 0 then
      raise exception 'invalid_amount';
    end if;
    if v_total is not null and v_total < 0 then
      raise exception 'total_invalido';
    end if;

    select * into v_product from public.products
     where id = (v_item->>'product_id')::uuid and store_id = p_store_id
     for update;
    if not found then
      raise exception 'product_not_found';
    end if;

    insert into public.stock_ledger (store_id, product_id, delta, reason, unit_cost,
                                     created_by)
    values (p_store_id, v_product.id, v_qty, 'purchase', v_cost, v_member.id);

    if v_cost is not null then
      update public.products set cost = v_cost where id = v_product.id;
    end if;

    if v_expiry is not null then
      -- El vencimiento cubre lo que LLEGÓ, nunca el total contado: de lo viejo
      -- que ya estaba en la góndola no sabemos la fecha.
      insert into public.stock_expiries (store_id, product_id, expiry_date, qty,
                                         created_by)
      values (p_store_id, v_product.id, v_expiry, v_qty, v_member.id);
    end if;

    -- CONTEO AL RECIBIR (039). Se lee el stock DESPUÉS de asentar la compra: el
    -- trigger del ledger ya actualizó el cache, así que la diferencia que queda
    -- es exactamente lo que el conteo corrige.
    if v_total is not null then
      select stock into v_stock from public.products where id = v_product.id;

      if v_total <> v_stock then
        insert into public.stock_ledger (store_id, product_id, delta, reason,
                                         note, created_by)
        values (p_store_id, v_product.id, v_total - v_stock, 'adjust',
                'conteo al recibir', v_member.id);
        -- El trigger de 037 lo gradúa solo al ver el asiento 'adjust'.
      else
        -- Contó y dio justo: no hay movimiento que asentar, pero el conteo
        -- ocurrió. Sin esto, el producto no podría salir del modo por esta vía.
        update public.products set stock_confiable = true
         where id = v_product.id and not stock_confiable;
      end if;
    end if;

    v_applied := v_applied + 1;
  end loop;

  return v_applied;
end;
$$;

grant execute on function public.register_purchase(uuid, jsonb) to authenticated;