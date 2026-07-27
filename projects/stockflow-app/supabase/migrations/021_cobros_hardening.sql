-- =============================================================================
-- StockFlow — 021_cobros_hardening.sql  (auditoría Tanda 1: pérdida de plata)
--
-- Endurece la ruta de venta/cobro contra tres agujeros de plata que la auditoría
-- encontró. Additiva: recrea funciones (create or replace) y suma UNA columna
-- nullable. NO borra ni migra dato. Aplicar DESPUÉS de 020. La corre el owner.
--
--   H1 · register_sale ataba la key de idempotencia a la venta pero NO al carrito:
--        reusar una key con un carrito DISTINTO devolvía la venta vieja como
--        replayed=true, y el POS mostraba "Cobrado" perdiendo la venta nueva.
--        Fix: fingerprint del carrito en `sales`; replay con carrito distinto ⇒
--        raise 'idempotency_key_reused'. El reintento del MISMO carrito sigue
--        siendo replay legítimo.
--
--   H3 · crear_intento_cobro decía validar el monto contra el carrito pero
--        guardaba p_amount verbatim (número que viaja por la red). Fix: recomputa
--        el total del CATÁLOGO server-side con la misma lógica que register_sale
--        (precio de catálogo / override con permiso / monto libre) e ignora el
--        p_amount del cliente → intent.amount autoritativo y consistente con la
--        venta que después registra register_sale.
-- =============================================================================

-- =============================================================================
-- 1. Fingerprint del carrito en sales (H1). Nullable: las ventas viejas quedan
--    en null y el replay las trata como legítimas (no hay con qué comparar).
-- =============================================================================
alter table public.sales add column if not exists cart_fingerprint text;

-- =============================================================================
-- 2. register_sale — igual que 003 + fingerprint del carrito.
-- =============================================================================
create or replace function public.register_sale(
  p_store_id        uuid,
  p_items           jsonb,
  p_payment_method  text,
  p_idempotency_key text,
  p_client_id       uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member      public.members;
  v_settings    public.store_settings;
  v_sale        public.sales;
  v_existing    public.sales;
  v_item        jsonb;
  v_product     public.products;
  v_client      public.clients;
  v_product_ids uuid[] := '{}';
  v_qty         numeric(12,3);
  v_unit_price  numeric(12,2);
  v_total       numeric(12,2) := 0;
  v_negative    jsonb := '[]'::jsonb;
  v_balance     numeric(12,2);
  v_over_limit  boolean := false;
  v_is_free     boolean;
  v_fingerprint text;
begin
  v_member := public.rpc_member(p_store_id);

  ---------------------------------------------------------------------------
  -- Validación de entrada mínima antes de todo: se necesita el carrito para el
  -- fingerprint (H1), así que sube acá (antes iba después de la idempotencia).
  ---------------------------------------------------------------------------
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_items';
  end if;

  -- Huella del carrito: serialización estable e independiente del ORDEN de los
  -- ítems (dos carritos iguales dan la misma huella) + medio de pago + cliente.
  select md5(
           coalesce(string_agg(
             coalesce(i->>'product_id', 'libre') || ':' ||
             coalesce(i->>'qty', '1') || ':' ||
             coalesce(i->>'unit_price', i->>'free_amount', ''),
             '|' order by coalesce(i->>'product_id', ''),
                          coalesce(i->>'free_amount', ''),
                          coalesce(i->>'unit_price', ''),
                          coalesce(i->>'qty', '')
           ), '')
           || '#' || p_payment_method || '#' || coalesce(p_client_id::text, '')
         )
    into v_fingerprint
    from jsonb_array_elements(p_items) i;

  ---------------------------------------------------------------------------
  -- Idempotencia: si ya existe esa venta, devolverla sin efectos... PERO solo
  -- si es el MISMO carrito. Una key reusada para otro carrito es un bug/tamper
  -- del cliente y jamás debe devolverse como éxito (H1).
  ---------------------------------------------------------------------------
  select * into v_existing from public.sales
   where store_id = p_store_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.cart_fingerprint is not null
       and v_existing.cart_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_key_reused';
    end if;
    return jsonb_build_object(
      'sale_id', v_existing.id, 'total', v_existing.total,
      'replayed', true, 'over_limit', false, 'negative_stock', '[]'::jsonb
    );
  end if;

  ---------------------------------------------------------------------------
  -- Validaciones de entrada
  ---------------------------------------------------------------------------
  if p_payment_method not in ('cash','qr','card','transfer','account') then
    raise exception 'invalid_payment_method';
  end if;

  if p_payment_method = 'account' then
    if not (v_member.role = 'owner' or v_member.can_sell_on_credit) then
      raise exception 'not_allowed';
    end if;
    if p_client_id is null then
      raise exception 'client_required';
    end if;
    select * into v_client from public.clients
     where id = p_client_id and store_id = p_store_id;
    if not found then
      raise exception 'client_not_found';
    end if;
  end if;

  select * into v_settings from public.store_settings where store_id = p_store_id;

  ---------------------------------------------------------------------------
  -- Lockeo de productos ORDENADO POR ID (anti-deadlock).
  ---------------------------------------------------------------------------
  select coalesce(array_agg(distinct (i->>'product_id')::uuid), '{}')
    into v_product_ids
    from jsonb_array_elements(p_items) i
   where i->>'product_id' is not null;

  if array_length(v_product_ids, 1) > 0 then
    perform 1 from public.products
     where id = any(v_product_ids) order by id for update;
  end if;

  ---------------------------------------------------------------------------
  -- Cabecera de la venta (total se completa al final). Guarda el fingerprint.
  ---------------------------------------------------------------------------
  insert into public.sales (store_id, member_id, client_id, total, payment_method,
                            idempotency_key, cart_fingerprint)
  values (p_store_id, v_member.id,
          case when p_payment_method = 'account' then p_client_id else null end,
          0, p_payment_method, p_idempotency_key, v_fingerprint)
  returning * into v_sale;

  ---------------------------------------------------------------------------
  -- Líneas
  ---------------------------------------------------------------------------
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

      insert into public.sale_items (sale_id, store_id, product_id, product_name,
                                     qty, unit_price, unit_cost, line_total)
      values (v_sale.id, p_store_id, null,
              coalesce(nullif(v_item->>'name',''), 'Venta rápida'),
              v_qty, v_unit_price, null, v_unit_price * v_qty);
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

      insert into public.sale_items (sale_id, store_id, product_id, product_name,
                                     qty, unit_price, unit_cost, line_total)
      values (v_sale.id, p_store_id, v_product.id, v_product.name,
              v_qty, v_unit_price, v_product.cost, v_unit_price * v_qty);

      insert into public.stock_ledger (store_id, product_id, delta, reason,
                                       sale_id, created_by)
      values (p_store_id, v_product.id, -v_qty, 'sale', v_sale.id, v_member.id);
    end if;

    v_total := v_total + (v_unit_price * v_qty);
  end loop;

  update public.sales set total = v_total where id = v_sale.id returning * into v_sale;

  ---------------------------------------------------------------------------
  -- Stock negativo (informa; con allow_negative_stock=false, rechaza).
  ---------------------------------------------------------------------------
  if array_length(v_product_ids, 1) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('product_id', id, 'name', name, 'stock', stock)), '[]'::jsonb)
      into v_negative
      from public.products
     where id = any(v_product_ids) and stock < 0;

    if coalesce(v_settings.allow_negative_stock, true) = false
       and jsonb_array_length(v_negative) > 0 then
      raise exception 'insufficient_stock';
    end if;
  end if;

  ---------------------------------------------------------------------------
  -- Fiado: asiento del cliente. El límite AVISA, no bloquea.
  ---------------------------------------------------------------------------
  if p_payment_method = 'account' then
    insert into public.client_ledger (store_id, client_id, delta, reason, sale_id,
                                      created_by)
    values (p_store_id, p_client_id, -v_total, 'sale', v_sale.id, v_member.id);

    select coalesce(sum(delta), 0) into v_balance
      from public.client_ledger where client_id = p_client_id;

    v_over_limit := v_client.credit_limit is not null
                    and (-v_balance) > v_client.credit_limit;
  end if;

  return jsonb_build_object(
    'sale_id', v_sale.id,
    'total', v_sale.total,
    'replayed', false,
    'over_limit', v_over_limit,
    'client_balance', v_balance,
    'negative_stock', v_negative
  );
end;
$$;

-- =============================================================================
-- 3. crear_intento_cobro — el monto lo pone el SERVIDOR desde el catálogo (H3).
--
-- Recomputa el total con la MISMA lógica de precios que register_sale (catálogo /
-- override con permiso / monto libre) → el monto del QR es autoritativo y coincide
-- con la venta que register_sale registrará después. `p_amount` se conserva en la
-- firma por compatibilidad pero se IGNORA: el número del cliente no fija plata.
-- =============================================================================
create or replace function public.crear_intento_cobro(
  p_store_id        uuid,
  p_items           jsonb,
  p_amount          numeric,
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

  -- Monto AUTORITATIVO desde el catálogo (ignora p_amount del cliente).
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

  insert into public.payment_intents (
    store_id, member_id, amount, items, client_id, idempotency_key
  ) values (
    p_store_id, v_member.id, v_total, p_items, p_client_id, p_idempotency_key
  ) returning * into v_intent;

  return v_intent;
end;
$$;
