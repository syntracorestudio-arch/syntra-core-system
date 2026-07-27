-- =============================================================================
-- StockFlow — 028_pago_dividido_qr.sql  (Cobros Paso 2: QR dentro del split)
--
-- Ahora una parte del pago dividido puede ser QR (ej. mitad efectivo, mitad QR con
-- la cuenta del cliente). El QR es ASÍNCRONO: se cobra la parte QR por MercadoPago
-- y la venta split se registra RECIÉN cuando esa parte se acredita (misma disciplina
-- "sin venta fantasma" del QR normal).
--
-- Tensión central (resuelta): `estadoCobro` bindea el monto acreditado en MP contra
-- `payment_intents.amount`. Para un QR PARCIAL, ese `amount` tiene que ser la parte
-- QR (lo que MP realmente cobra), NO el total del carrito. Pero el binding de
-- integridad del split completo se mantiene: el reparto entero debe sumar el total
-- recomputado del carrito server-side.
--
--   · payment_intents.split_pagos jsonb — el reparto completo [{method,amount}…]
--     cuando el intento es la pata QR de un split. null = intento normal.
--   · crear_intento_cobro_split — intento cuyo `amount` = la parte QR, valida que el
--     reparto sume el total del carrito, y guarda split_pagos. NO toca el
--     crear_intento_cobro normal (H3 intacto para el QR de venta entera).
--   · register_split_sale — ahora acepta 'qr' y `p_paid` (la venta split se registra
--     como hecho una vez acreditada la parte QR).
--   · cobros_sin_venta — expone split_pagos y el monto TOTAL para que la recuperación
--     de un cobro huérfano re-arme el split (no una venta QR de carrito entero).
--
-- Aditivo. Aplicar DESPUÉS de 027. La corre el owner.
-- =============================================================================

-- 1) El reparto completo, guardado en la pata QR del split.
alter table public.payment_intents
  add column if not exists split_pagos jsonb;

-- 2) Intento de cobro para un split con QR: cobra SOLO la parte QR, pero valida el
--    reparto completo contra el total del carrito (recomputado server-side).
create or replace function public.crear_intento_cobro_split(
  p_store_id        uuid,
  p_items           jsonb,
  p_pagos           jsonb,
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
  v_qr         numeric(12,2);
  v_suma       numeric(12,2);
  v_qr_count   integer;
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

  -- Reparto válido: ≥2 partes, métodos permitidos, EXACTAMENTE una parte QR (un solo
  -- tramo asíncrono por venta), y que el TOTAL del reparto == total del carrito.
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

  select count(*) filter (where x.method = 'qr'),
         coalesce(sum(x.amount), 0),
         coalesce(sum(x.amount) filter (where x.method = 'qr'), 0)
    into v_qr_count, v_suma, v_qr
    from jsonb_to_recordset(p_pagos) as x(method text, amount numeric);

  if v_qr_count <> 1 then
    raise exception 'split_needs_one_qr';
  end if;
  if abs(v_suma - v_total) > 0.01 then
    raise exception 'split_sum_mismatch';
  end if;

  -- El intento cobra SOLO la parte QR (lo que MP carga). `estadoCobro` compara el
  -- acreditado contra este `amount`. El reparto completo queda guardado para registrar
  -- la venta split al acreditar (o recuperarla si la caja se cae en el medio).
  insert into public.payment_intents (
    store_id, member_id, amount, items, client_id, idempotency_key, split_pagos
  ) values (
    p_store_id, v_member.id, v_qr, p_items, p_client_id, p_idempotency_key, p_pagos
  ) returning * into v_intent;

  return v_intent;
end;
$$;

grant execute on function public.crear_intento_cobro_split(uuid, jsonb, jsonb, text, uuid) to authenticated;

-- 3) register_split_sale: ahora acepta 'qr' y `p_paid`. Se cambia la firma (se agrega
--    p_paid) → drop + create. El caller de 4 args (Paso 1 offline) sigue andando: sus
--    argumentos son nombrados y p_paid toma su default false.
drop function if exists public.register_split_sale(uuid, jsonb, jsonb, text);

create or replace function public.register_split_sale(
  p_store_id        uuid,
  p_items           jsonb,
  p_pagos           jsonb,
  p_idempotency_key text,
  p_paid            boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res   jsonb;
  v_sale  uuid;
  v_total numeric(12,2);
  v_suma  numeric(12,2);
begin
  perform public.rpc_member(p_store_id);

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

  -- Registrar la venta como 'split' reusando la RPC reina. `p_paid` cuando la parte
  -- QR ya se acreditó: la venta es un hecho (no la frena stock/archivado — M4).
  v_res := public.register_sale(
             p_store_id := p_store_id,
             p_items := p_items,
             p_payment_method := 'split',
             p_idempotency_key := p_idempotency_key,
             p_paid := p_paid
           );
  v_sale  := (v_res->>'sale_id')::uuid;
  v_total := (v_res->>'total')::numeric;

  select coalesce(sum(amount), 0) into v_suma
    from jsonb_to_recordset(p_pagos) as x(method text, amount numeric);
  if abs(v_suma - v_total) > 0.01 then
    raise exception 'split_sum_mismatch';
  end if;

  delete from public.sale_payments where sale_id = v_sale and store_id = p_store_id;
  insert into public.sale_payments (store_id, sale_id, method, amount)
  select p_store_id, v_sale, x.method, x.amount
    from jsonb_to_recordset(p_pagos) as x(method text, amount numeric);

  return v_res;
end;
$$;

grant execute on function public.register_split_sale(uuid, jsonb, jsonb, text, boolean) to authenticated;

-- 4) cobros_sin_venta: expone split_pagos y, para un split, el monto TOTAL (suma del
--    reparto) en vez del parcial QR — así el banner de recuperación muestra la venta
--    entera y la re-arma como split.
create or replace function public.cobros_sin_venta(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
begin
  v_member := public.rpc_member(p_store_id);

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', pi.id,
             'monto', coalesce(
               (select sum((p->>'amount')::numeric) from jsonb_array_elements(pi.split_pagos) p),
               pi.amount),
             'items', pi.items,
             'idempotency_key', pi.idempotency_key,
             'client_id', pi.client_id,
             'split_pagos', pi.split_pagos,
             'cuando', pi.created_at
           ) order by pi.created_at desc), '[]'::jsonb)
      from public.payment_intents pi
     where pi.store_id = p_store_id
       and pi.status = 'approved'
       and pi.sale_id is null
       and pi.created_at >= now() - interval '7 days'
  );
end;
$$;

grant execute on function public.cobros_sin_venta(uuid) to authenticated;