-- =============================================================================
-- StockFlow — 029_split_leg_generico.sql  (Cobros Paso 3: la pata electrónica del
-- split puede ser TARJETA al posnet, no solo QR)
--
-- Hasta el Paso 2, el tramo asíncrono de un split era siempre QR (una parte QR
-- obligatoria). El Paso 3 enruta la parte electrónica por TODA la config de posnet:
-- una parte tarjeta va a la terminal Point (con débito/crédito), o una parte QR va a
-- la terminal o a la pantalla. En los tres casos es UN solo tramo asíncrono (dos
-- electrónicas en una venta = análisis aparte, `docs/split-dos-electronicas-plan.md`).
--
-- Por eso `crear_intento_cobro_split` se generaliza: en vez de exigir "exactamente una
-- parte QR", recibe `p_leg_amount` = el monto de la pata electrónica que se cobra AHORA
-- por MP (tarjeta o QR). El intent.amount = ese monto (binding contra lo que MP carga),
-- y se sigue validando que el reparto complete sume el total del carrito server-side.
--
-- Cambia la firma (se agrega p_leg_amount) → drop + create. Aditivo respecto de datos.
-- Aplicar DESPUÉS de 028. La corre el owner.
-- =============================================================================

drop function if exists public.crear_intento_cobro_split(uuid, jsonb, jsonb, text, uuid);

create or replace function public.crear_intento_cobro_split(
  p_store_id        uuid,
  p_items           jsonb,
  p_pagos           jsonb,
  p_leg_amount      numeric,  -- monto de la pata electrónica (tarjeta o QR) que cobra MP
  p_idempotency_key text,
  p_client_id       uuid default null
) returns public.payment_intents
language plpgsql security definer set search_path = public as $$
declare
  v_member     public.members;
  v_intent     public.payment_intents;
  v_item       jsonb;
  v_product    public.products;
  v_qty        numeric(12,3);
  v_unit_price numeric(12,2);
  v_total      numeric(12,2) := 0;
  v_is_free    boolean;
  v_suma       numeric(12,2);
begin
  v_member := public.rpc_member(p_store_id);

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_items';
  end if;

  -- Reintento del mismo cobro (la caja perdió la respuesta): devolver el que hay.
  select * into v_intent from public.payment_intents
   where store_id = p_store_id and idempotency_key = p_idempotency_key;
  if found then
    return v_intent;
  end if;

  -- Total AUTORITATIVO del carrito (mismo cálculo que crear_intento_cobro / register_sale).
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_is_free := (v_item->>'product_id') is null;
    v_qty := coalesce((v_item->>'qty')::numeric, 1);
    if v_qty <= 0 then
      raise exception 'invalid_qty';
    end if;

    if v_is_free then
      v_unit_price := (v_item->>'free_amount')::numeric;
      if v_unit_price is null or v_unit_price <= 0 then
        raise exception 'invalid_amount';
      end if;
    else
      select * into v_product from public.products
       where id = (v_item->>'product_id')::uuid and store_id = p_store_id;
      if not found then
        raise exception 'product_not_found';
      end if;
      if v_product.status <> 'active' then
        raise exception 'product_archived';
      end if;
      if (v_item->>'unit_price') is not null then
        if not (v_member.role = 'owner' or v_member.can_apply_discount) then
          raise exception 'not_allowed';
        end if;
        v_unit_price := (v_item->>'unit_price')::numeric;
        if v_unit_price < 0 then
          raise exception 'invalid_amount';
        end if;
      else
        v_unit_price := v_product.price;
      end if;
    end if;

    v_total := v_total + (v_unit_price * v_qty);
  end loop;

  if v_total <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- Reparto válido: ≥2 partes, métodos permitidos, todo > 0, y que sume el total.
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) < 2 then
    raise exception 'split_needs_two';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_pagos) as x(method text, amount numeric)
     where x.method is null or x.method not in ('cash','card','transfer','qr')
        or x.amount is null or x.amount <= 0
  ) then
    raise exception 'invalid_split_payment';
  end if;

  select coalesce(sum(x.amount), 0) into v_suma
    from jsonb_to_recordset(p_pagos) as x(method text, amount numeric);
  if abs(v_suma - v_total) > 0.01 then
    raise exception 'split_sum_mismatch';
  end if;

  -- La pata electrónica es PARCIAL (el split tiene ≥2 partes >0): 0 < leg < total.
  if p_leg_amount is null or p_leg_amount <= 0 or p_leg_amount > v_total + 0.01 then
    raise exception 'invalid_leg_amount';
  end if;

  -- El intento cobra SOLO la pata electrónica (lo que MP carga). `estadoCobro` compara
  -- el acreditado contra este `amount`. El reparto completo queda guardado para
  -- registrar la venta split al acreditar (o recuperarla si la caja se cae).
  insert into public.payment_intents (
    store_id, member_id, amount, items, client_id, idempotency_key, split_pagos
  ) values (
    p_store_id, v_member.id, p_leg_amount, p_items, p_client_id, p_idempotency_key, p_pagos
  ) returning * into v_intent;

  return v_intent;
end;
$$;

grant execute on function public.crear_intento_cobro_split(uuid, jsonb, jsonb, numeric, text, uuid) to authenticated;