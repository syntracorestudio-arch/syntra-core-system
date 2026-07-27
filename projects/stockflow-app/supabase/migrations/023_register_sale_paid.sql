-- =============================================================================
-- StockFlow — 023_register_sale_paid.sql  (auditoría Tanda 2 · M4)
--
-- Una venta cobrada por QR cuya plata YA se acreditó no puede quedar sin
-- registrar. Antes, si entre armar el carrito y cobrar el producto se archivaba
-- (product_archived) o el negocio estaba en modo estricto y el stock no alcanzaba
-- (insufficient_stock), register_sale RECHAZABA — y la recuperación desde Caja
-- reintentaba los MISMOS ítems y fallaba igual: plata adentro, venta imposible.
--
-- Fix: parámetro `p_paid` (default false). Cuando es true —solo lo pasan los
-- caminos donde el pago YA entró (recuperarVenta y el registro post-cobro-QR)— la
-- venta se registra igual: el archivado no frena y el stock negativo no se rechaza
-- (se informa en `negative_stock` como siempre). La venta es un HECHO, no una
-- intención. La venta normal (efectivo, sin p_paid) sigue validando estricto.
--
-- Se DROPEA la firma de 5 args y se crea la de 6 (p_paid default false): los
-- callers que pasan 5 args nombrados siguen andando (p_paid toma su default).
-- Aditiva respecto de datos. Aplicar DESPUÉS de 022. La corre el owner.
-- =============================================================================

drop function if exists public.register_sale(uuid, jsonb, text, text, uuid);

create or replace function public.register_sale(
  p_store_id        uuid,
  p_items           jsonb,
  p_payment_method  text,
  p_idempotency_key text,
  p_client_id       uuid default null,
  p_paid            boolean default false
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

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_items';
  end if;

  -- Huella del carrito (H1): estable e independiente del orden + medio + cliente.
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

  -- Idempotencia atada al carrito (H1): replay del mismo carrito ok; key reusada
  -- para otro carrito ⇒ error, nunca éxito silencioso.
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

  -- Lockeo de productos ORDENADO POR ID (anti-deadlock).
  select coalesce(array_agg(distinct (i->>'product_id')::uuid), '{}')
    into v_product_ids
    from jsonb_array_elements(p_items) i
   where i->>'product_id' is not null;

  if array_length(v_product_ids, 1) > 0 then
    perform 1 from public.products
     where id = any(v_product_ids) order by id for update;
  end if;

  insert into public.sales (store_id, member_id, client_id, total, payment_method,
                            idempotency_key, cart_fingerprint)
  values (p_store_id, v_member.id,
          case when p_payment_method = 'account' then p_client_id else null end,
          0, p_payment_method, p_idempotency_key, v_fingerprint)
  returning * into v_sale;

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
      -- M4: un cobro YA PAGADO registra aunque el producto esté archivado.
      if v_product.status <> 'active' and not p_paid then
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

  -- Stock negativo (informa; con allow_negative_stock=false rechaza... salvo que la
  -- plata YA haya entrado: un cobro pagado no se rechaza por stock — M4).
  if array_length(v_product_ids, 1) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('product_id', id, 'name', name, 'stock', stock)), '[]'::jsonb)
      into v_negative
      from public.products
     where id = any(v_product_ids) and stock < 0;

    if not p_paid
       and coalesce(v_settings.allow_negative_stock, true) = false
       and jsonb_array_length(v_negative) > 0 then
      raise exception 'insufficient_stock';
    end if;
  end if;

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

grant execute on function public.register_sale(uuid, jsonb, text, text, uuid, boolean) to authenticated;