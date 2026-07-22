-- =============================================================================
-- StockFlow — 003_sale_rpcs.sql  (tanda 1C)
--
-- Las RPCs atómicas: la ÚNICA vía de escritura sobre sales, sale_items y los
-- ledgers (esas tablas no tienen policy de INSERT ni privilegio de escritura).
--
-- Todas son SECURITY DEFINER con search_path fijo → bypassan RLS a propósito,
-- así que CADA UNA valida la membresía del caller a mano antes de tocar nada.
-- Ese chequeo es lo único que separa un kiosco de otro: no se saltea nunca.
--
-- Contratos: docs/rpc-contracts.md. Los errores se lanzan con un código de texto
-- estable (`not_a_member`, `insufficient_stock`, …) que la UI traduce.
-- =============================================================================

-- =============================================================================
-- Helper interno: resuelve el member activo del caller en el negocio.
-- Devuelve la fila entera porque casi todas las RPCs necesitan los flags.
-- =============================================================================
create or replace function public.rpc_member(p_store_id uuid)
returns public.members
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
begin
  select * into v_member
    from public.members
   where store_id = p_store_id
     and profile_id = auth.uid()
     and status = 'active';
  if not found then
    raise exception 'not_a_member';
  end if;
  return v_member;
end;
$$;

-- =============================================================================
-- register_sale — la RPC reina.
--
-- Una transacción: valida, congela snapshots, inserta la venta, sus líneas y los
-- asientos de stock (el trigger actualiza el cache), y si es fiado el asiento del
-- cliente. O pasa todo, o no pasa nada.
--
-- Idempotencia: el POS genera `p_idempotency_key` al armar el carrito. Si la red
-- se corta y el cajero reintenta, devuelve LA MISMA venta en vez de cobrar dos
-- veces. Es la garantía más importante para una caja.
--
-- p_items: [{product_id, qty, unit_price?, free_amount?, name?}]
--   · product_id null + free_amount → "venta por monto libre" (sin stock).
--   · unit_price → override de precio; exige can_apply_discount u owner.
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
begin
  v_member := public.rpc_member(p_store_id);

  ---------------------------------------------------------------------------
  -- Idempotencia primero: si ya existe esa venta, devolverla sin efectos.
  ---------------------------------------------------------------------------
  select * into v_existing from public.sales
   where store_id = p_store_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'sale_id', v_existing.id, 'total', v_existing.total,
      'replayed', true, 'over_limit', false, 'negative_stock', '[]'::jsonb
    );
  end if;

  ---------------------------------------------------------------------------
  -- Validaciones de entrada
  ---------------------------------------------------------------------------
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_items';
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

  ---------------------------------------------------------------------------
  -- Lockeo de productos ORDENADO POR ID: dos cajeros vendiendo carritos que se
  -- solapan toman los locks en el mismo orden y no se abrazan (deadlock).
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
  -- Cabecera de la venta (total se completa al final)
  ---------------------------------------------------------------------------
  insert into public.sales (store_id, member_id, client_id, total, payment_method,
                            idempotency_key)
  values (p_store_id, v_member.id,
          case when p_payment_method = 'account' then p_client_id else null end,
          0, p_payment_method, p_idempotency_key)
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
      -- Venta por monto libre: no toca stock ni catálogo. Es la válvula de
      -- escape del mostrador (business-rules §3) para que la caja nunca frene.
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

      -- Override de precio: solo con permiso explícito.
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

      -- Snapshots: el margen histórico queda exacto aunque el producto cambie.
      insert into public.sale_items (sale_id, store_id, product_id, product_name,
                                     qty, unit_price, unit_cost, line_total)
      values (v_sale.id, p_store_id, v_product.id, v_product.name,
              v_qty, v_unit_price, v_product.cost, v_unit_price * v_qty);

      -- El asiento mueve el stock; el trigger actualiza products.stock.
      insert into public.stock_ledger (store_id, product_id, delta, reason,
                                       sale_id, created_by)
      values (p_store_id, v_product.id, -v_qty, 'sale', v_sale.id, v_member.id);
    end if;

    v_total := v_total + (v_unit_price * v_qty);
  end loop;

  update public.sales set total = v_total where id = v_sale.id returning * into v_sale;

  ---------------------------------------------------------------------------
  -- Stock negativo: por default la caja NO se frena (el sistema arranca con el
  -- stock incompleto y la realidad del mostrador manda). Se informa para que el
  -- POS avise y el dueño ajuste. Con allow_negative_stock=false, se rechaza.
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
  -- Fiado: asiento del cliente. El límite AVISA, no bloquea (business-rules §4).
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
-- register_purchase — ingreso de mercadería.
-- Sube stock, pisa el costo (regla "último costo", business-rules §2) y,
-- si viene fecha, deja el vencimiento informativo.
-- =============================================================================
create or replace function public.register_purchase(
  p_store_id uuid,
  p_items    jsonb  -- [{product_id, qty>0, unit_cost>=0, expiry_date?}]
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_member    public.members;
  v_item      jsonb;
  v_product   public.products;
  v_qty       numeric(12,3);
  v_cost      numeric(12,2);
  v_expiry    date;
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

    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid_qty';
    end if;
    if v_cost is not null and v_cost < 0 then
      raise exception 'invalid_amount';
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
      insert into public.stock_expiries (store_id, product_id, expiry_date, qty,
                                         created_by)
      values (p_store_id, v_product.id, v_expiry, v_qty, v_member.id);
    end if;

    v_applied := v_applied + 1;
  end loop;

  return v_applied;
end;
$$;

-- =============================================================================
-- void_sale — anular. NUNCA borra: genera contra-asientos y marca la venta.
-- Idempotente: anular dos veces devuelve lo mismo sin duplicar devoluciones.
-- =============================================================================
create or replace function public.void_sale(
  p_store_id uuid,
  p_sale_id  uuid,
  p_reason   text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_sale   public.sales;
  v_item   public.sale_items;
begin
  v_member := public.rpc_member(p_store_id);

  if not (v_member.role = 'owner' or v_member.can_void_sale) then
    raise exception 'not_allowed';
  end if;

  select * into v_sale from public.sales
   where id = p_sale_id and store_id = p_store_id
   for update;
  if not found then
    raise exception 'sale_not_found';
  end if;

  if v_sale.status = 'voided' then
    return jsonb_build_object('sale_id', v_sale.id, 'already_voided', true);
  end if;

  -- Devolver el stock de cada línea con producto.
  for v_item in
    select * from public.sale_items where sale_id = v_sale.id and product_id is not null
  loop
    insert into public.stock_ledger (store_id, product_id, delta, reason, sale_id,
                                     note, created_by)
    values (p_store_id, v_item.product_id, v_item.qty, 'return', v_sale.id,
            'anulación de venta', v_member.id);
  end loop;

  -- Si era fiado, revertir la deuda del cliente.
  if v_sale.payment_method = 'account' and v_sale.client_id is not null then
    insert into public.client_ledger (store_id, client_id, delta, reason, sale_id,
                                      note, created_by)
    values (p_store_id, v_sale.client_id, v_sale.total, 'adjust', v_sale.id,
            'anulación de venta', v_member.id);
  end if;

  update public.sales
     set status = 'voided', voided_at = now(), voided_by = v_member.id,
         void_reason = p_reason
   where id = v_sale.id;

  return jsonb_build_object('sale_id', v_sale.id, 'already_voided', false);
end;
$$;

-- =============================================================================
-- adjust_stock — corrección manual del dueño (conteo, merma, carga inicial).
-- =============================================================================
create or replace function public.adjust_stock(
  p_store_id   uuid,
  p_product_id uuid,
  p_delta      numeric,
  p_reason     text,
  p_note       text default null
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_stock  numeric(12,3);
begin
  v_member := public.rpc_member(p_store_id);

  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;
  if p_reason not in ('adjust','waste','initial') then
    raise exception 'invalid_reason';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_delta';
  end if;
  -- Una merma sólo puede restar: si suma, es un ajuste, no una pérdida.
  if p_reason = 'waste' and p_delta > 0 then
    raise exception 'invalid_delta';
  end if;

  perform 1 from public.products
   where id = p_product_id and store_id = p_store_id for update;
  if not found then
    raise exception 'product_not_found';
  end if;

  insert into public.stock_ledger (store_id, product_id, delta, reason, note, created_by)
  values (p_store_id, p_product_id, p_delta, p_reason, p_note, v_member.id);

  select stock into v_stock from public.products where id = p_product_id;
  return v_stock;
end;
$$;

-- =============================================================================
-- Grants: las RPCs son la puerta de entrada de la app autenticada.
-- `rpc_member` es interna (la usan las otras) pero es inofensiva: devuelve
-- únicamente la fila del propio caller.
-- =============================================================================
grant execute on function public.rpc_member(uuid) to authenticated;
grant execute on function public.register_sale(uuid, jsonb, text, text, uuid) to authenticated;
grant execute on function public.register_purchase(uuid, jsonb) to authenticated;
grant execute on function public.void_sale(uuid, uuid, text) to authenticated;
grant execute on function public.adjust_stock(uuid, uuid, numeric, text, text) to authenticated;
