-- =============================================================================
-- StockFlow — 027_pago_dividido.sql  (Cobros Paso 1: pago dividido offline)
--
-- Una venta puede cobrarse en varias partes (ej. mitad efectivo, mitad tarjeta).
-- Paso 1 = medios INMEDIATOS: efectivo / tarjeta / transferencia. QR queda para el
-- Paso 2 (es asíncrono) y fiado queda AFUERA a propósito (es deuda, descuadraría el
-- cierre). El discriminador `sales.payment_method` sigue existiendo: una venta
-- dividida se marca `'split'` y el reparto vive en `sale_payments`.
--
-- Diseño clave por seguridad de la plata: NO un setter posterior (dejaría una venta
-- 'split' HUÉRFANA sin reparto si algo falla → plata sin imputar). En su lugar,
-- `register_split_sale` envuelve la RPC reina + inserta el reparto en la MISMA
-- transacción: si el reparto no suma el total, rollback total, cero venta huérfana.
--
-- Los 3 reportes de medios (dashboard, cierre, reportes_medios) dejan de bucketear
-- el total bajo 'split' y lo IMPUTAN a cada medio real desde `sale_payments`. El
-- cierre de caja suma la parte en efectivo del split al efectivo esperado.
--
-- Todo aditivo salvo el CHECK de payment_method (se amplía, no se restringe).
-- Aplicar DESPUÉS de 026. La corre el owner.
-- =============================================================================

-- 1) Permitir 'split' como medio de la venta (amplía el CHECK, nada se rompe).
alter table public.sales drop constraint sales_payment_method_check;
alter table public.sales add constraint sales_payment_method_check
  check (payment_method in ('cash', 'qr', 'card', 'transfer', 'account', 'split'));

-- 2) El reparto de una venta dividida. Una fila por parte cobrada.
create table if not exists public.sale_payments (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  sale_id    uuid not null references public.sales(id) on delete cascade,
  -- 'qr' se admite en el modelo para el Paso 2; la RPC v1 solo acepta los inmediatos.
  method     text not null check (method in ('cash', 'card', 'transfer', 'qr')),
  amount     numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists sale_payments_sale_idx on public.sale_payments(sale_id);
create index if not exists sale_payments_store_idx on public.sale_payments(store_id);

-- Sin acceso directo del cliente: se escribe por RPC (security definer, bypassa RLS)
-- y se lee por los reportes (también definer). RLS activa sin policy = deny-all directo.
alter table public.sale_payments enable row level security;

-- 3) register_sale: sumar 'split' al whitelist. Copia VERBATIM de 023 con ese único
--    cambio (línea del whitelist). 'split' no toca la rama de 'account': no escribe
--    client_ledger ni exige cliente — es plata que entró, repartida.
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

  if p_payment_method not in ('cash','qr','card','transfer','account','split') then
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

-- 4) register_split_sale: la venta dividida, ATÓMICA. Reusa register_sale (todos sus
--    invariantes probados: sobreventa, idempotencia, fingerprint) y agrega el reparto
--    en la misma transacción. Si el reparto no suma el total → rollback, sin huérfana.
create or replace function public.register_split_sale(
  p_store_id        uuid,
  p_items           jsonb,
  p_pagos           jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res   jsonb;
  v_sale  uuid;
  v_total numeric(12,2);
  v_suma  numeric(12,2);
begin
  perform public.rpc_member(p_store_id);

  -- Un split necesita al menos dos partes y solo medios inmediatos (v1: sin QR ni fiado).
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) < 2 then
    raise exception 'split_needs_two';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_pagos) as x(method text, amount numeric)
     where x.method is null or x.method not in ('cash','card','transfer')
        or x.amount is null or x.amount <= 0
  ) then
    raise exception 'invalid_split_payment';
  end if;

  -- Registrar la venta como 'split' reusando la RPC reina.
  v_res := public.register_sale(
             p_store_id := p_store_id,
             p_items := p_items,
             p_payment_method := 'split',
             p_idempotency_key := p_idempotency_key
           );
  v_sale  := (v_res->>'sale_id')::uuid;
  v_total := (v_res->>'total')::numeric;

  -- El reparto debe sumar el total REAL (server-side), no el que dijo el cliente.
  select coalesce(sum(amount), 0) into v_suma
    from jsonb_to_recordset(p_pagos) as x(method text, amount numeric);
  if abs(v_suma - v_total) > 0.01 then
    raise exception 'split_sum_mismatch';
  end if;

  -- Idempotente ante replay del mismo carrito (register_sale devolvió la venta previa).
  delete from public.sale_payments where sale_id = v_sale and store_id = p_store_id;
  insert into public.sale_payments (store_id, sale_id, method, amount)
  select p_store_id, v_sale, x.method, x.amount
    from jsonb_to_recordset(p_pagos) as x(method text, amount numeric);

  return v_res;
end;
$$;

grant execute on function public.register_split_sale(uuid, jsonb, jsonb, text) to authenticated;

-- 5) Reportes: imputar el split a su medio real. En los 3, la venta 'split' sale del
--    grupo por payment_method y entra por sale_payments. Copia verbatim de cada RPC
--    con: (a) el filtro `not in ('account','split')` y (b) el union del split.

-- 5a) dashboard_summary (008): by_method del día.
create or replace function public.dashboard_summary(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz         text;
  v_hoy        date;
  v_total      numeric(12,2);
  v_count      integer;
  v_fiado_hoy  numeric(12,2);
  v_cobros     numeric(12,2);
  v_profit     numeric(12,2);
  v_con_costo  integer;
  v_lineas     integer;
  v_promedio   numeric(12,2);
  v_medios     jsonb;
  v_reponer    jsonb;
  v_fiado      numeric(12,2);
  v_deudores   jsonb;
  v_alerts     jsonb;
begin
  perform public.rpc_member(p_store_id);

  select timezone into v_tz from public.stores where id = p_store_id;
  v_tz := coalesce(v_tz, 'America/Argentina/Buenos_Aires');
  v_hoy := (now() at time zone v_tz)::date;

  -- Facturado y cuánto de eso fue fiado
  select coalesce(sum(total), 0),
         count(*),
         coalesce(sum(total) filter (where payment_method = 'account'), 0)
    into v_total, v_count, v_fiado_hoy
    from public.sales
   where store_id = p_store_id
     and status = 'completed'
     and (sold_at at time zone v_tz)::date = v_hoy;

  -- Cobros de deudas viejas: ESTO es plata que entró hoy y antes no se veía.
  select coalesce(sum(delta), 0) into v_cobros
    from public.client_ledger
   where store_id = p_store_id
     and reason = 'payment'
     and (created_at at time zone v_tz)::date = v_hoy;

  -- Ganancia + cobertura de costos (para degradar con honestidad)
  select coalesce(sum((i.unit_price - i.unit_cost) * i.qty) filter (where i.unit_cost is not null), 0),
         count(*) filter (where i.unit_cost is not null),
         count(*)
    into v_profit, v_con_costo, v_lineas
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
   where s.store_id = p_store_id
     and s.status = 'completed'
     and (s.sold_at at time zone v_tz)::date = v_hoy
     and i.product_id is not null;

  -- Promedio de los 28 días previos (cota dura)
  select coalesce(avg(dia_total), 0) into v_promedio
    from (
      select sum(total) as dia_total
        from public.sales
       where store_id = p_store_id
         and status = 'completed'
         and (sold_at at time zone v_tz)::date between v_hoy - 28 and v_hoy - 1
       group by (sold_at at time zone v_tz)::date
    ) dias;

  -- Medios de COBRO reales: sin 'account', con los cobros de fiado sumados a su medio,
  -- y con las ventas divididas imputadas parte por parte desde sale_payments.
  select coalesce(jsonb_agg(jsonb_build_object(
           'method', metodo, 'total', monto, 'count', cantidad)
           order by monto desc), '[]'::jsonb)
    into v_medios
    from (
      select metodo, sum(monto) as monto, sum(cantidad) as cantidad
        from (
          select payment_method as metodo, sum(total) as monto, count(*) as cantidad
            from public.sales
           where store_id = p_store_id
             and status = 'completed'
             and payment_method not in ('account','split')
             and (sold_at at time zone v_tz)::date = v_hoy
           group by payment_method
          union all
          select payment_method, sum(delta), count(*)
            from public.client_ledger
           where store_id = p_store_id
             and reason = 'payment'
             and payment_method is not null
             and (created_at at time zone v_tz)::date = v_hoy
           group by payment_method
          union all
          select sp.method, sum(sp.amount), count(*)
            from public.sale_payments sp
            join public.sales s2 on s2.id = sp.sale_id
           where s2.store_id = p_store_id and s2.status = 'completed'
             and (s2.sold_at at time zone v_tz)::date = v_hoy
           group by sp.method
        ) u
       group by metodo
    ) m;

  -- "Para reponer": stock bajo ordenado por ROTACIÓN de los últimos 7 días.
  select coalesce(jsonb_agg(r order by r.velocidad desc nulls last), '[]'::jsonb)
    into v_reponer
    from (
      select l.id as product_id, l.name, l.emoji, l.stock, l.threshold,
             coalesce(v.unidades, 0) as vendidas_7d,
             case when coalesce(v.unidades, 0) > 0
                  then round(l.stock / (v.unidades / 7.0), 1)
                  else null
             end as dias_restantes,
             coalesce(v.unidades, 0) / 7.0 as velocidad
        from public.low_stock_products l
        left join (
          select i.product_id, sum(i.qty) as unidades
            from public.sale_items i
            join public.sales s on s.id = i.sale_id
           where s.store_id = p_store_id
             and s.status = 'completed'
             and (s.sold_at at time zone v_tz)::date > v_hoy - 7
           group by i.product_id
        ) v on v.product_id = l.id
       where l.store_id = p_store_id
    ) r;

  select coalesce(sum(-balance), 0) into v_fiado
    from public.client_balances
   where store_id = p_store_id and balance < 0;

  select coalesce(jsonb_agg(d), '[]'::jsonb) into v_deudores
    from (
      select client_id, name, -balance as owed, credit_limit
        from public.client_balances
       where store_id = p_store_id and balance < 0
       order by balance
       limit 3
    ) d;

  v_alerts := public.store_alerts(p_store_id);

  return jsonb_build_object(
    'today', jsonb_build_object(
      'total', v_total,
      'cash_in', v_total - v_fiado_hoy + v_cobros,
      'credit_given', v_fiado_hoy,
      'credit_collected', v_cobros,
      'count', v_count,
      'profit', v_profit,
      'profit_coverage', case when v_lineas = 0 then null
                              else round(v_con_costo::numeric / v_lineas * 100, 0) end,
      'avg_previous', round(v_promedio, 2),
      'vs_avg_pct', case when v_promedio > 0
                         then round((v_total - v_promedio) / v_promedio * 100, 0)
                         else null end
    ),
    'by_method', v_medios,
    'restock', v_reponer,
    'credit', jsonb_build_object('total', v_fiado, 'top', v_deudores),
    'low_stock', v_alerts->'low_stock',
    'expiring', v_alerts->'expiring'
  );
end;
$$;

grant execute on function public.dashboard_summary(uuid) to authenticated;

-- 5b) cierre_caja (022): by_method + efectivo_esperado. El efectivo de un split suma
--     al efectivo esperado (la parte cash entró a la caja física).
create or replace function public.cierre_caja(
  p_store_id uuid,
  p_fecha    date default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz        text;
  v_dia       date;
  v_ini       timestamptz;
  v_fin       timestamptz;
  v_medios    jsonb;
  v_ventas    jsonb;
  v_total     numeric(12,2);
  v_fiado     numeric(12,2);
  v_cobros    numeric(12,2);
  v_efectivo  numeric(12,2);
  v_reembolso numeric(12,2);
  v_anuladas  integer;
begin
  perform public.rpc_member(p_store_id);

  select timezone into v_tz from public.stores where id = p_store_id;
  v_tz := coalesce(v_tz, 'America/Argentina/Buenos_Aires');
  v_dia := coalesce(p_fecha, (now() at time zone v_tz)::date);
  v_ini := (v_dia::timestamp) at time zone v_tz;
  v_fin := ((v_dia + 1)::timestamp) at time zone v_tz;

  select coalesce(sum(total) filter (where status = 'completed'), 0),
         coalesce(sum(total) filter (where status = 'completed' and payment_method = 'account'), 0),
         count(*) filter (where status = 'voided')
    into v_total, v_fiado, v_anuladas
    from public.sales
   where store_id = p_store_id
     and sold_at >= v_ini and sold_at < v_fin;

  select coalesce(sum(delta), 0) into v_cobros
    from public.client_ledger
   where store_id = p_store_id and reason = 'payment'
     and created_at >= v_ini and created_at < v_fin;

  -- Medios de COBRO reales (fiado no es medio; cobros de deuda a su medio real; y las
  -- ventas divididas imputadas parte por parte).
  select coalesce(jsonb_agg(jsonb_build_object(
           'method', metodo, 'total', monto, 'count', cantidad) order by monto desc),
         '[]'::jsonb)
    into v_medios
    from (
      select metodo, sum(monto) as monto, sum(cantidad) as cantidad
        from (
          select payment_method as metodo, sum(total) as monto, count(*) as cantidad
            from public.sales
           where store_id = p_store_id and status = 'completed'
             and payment_method not in ('account','split')
             and sold_at >= v_ini and sold_at < v_fin
           group by payment_method
          union all
          select payment_method, sum(delta), count(*)
            from public.client_ledger
           where store_id = p_store_id and reason = 'payment'
             and payment_method is not null
             and created_at >= v_ini and created_at < v_fin
           group by payment_method
          union all
          select sp.method, sum(sp.amount), count(*)
            from public.sale_payments sp
            join public.sales s2 on s2.id = sp.sale_id
           where s2.store_id = p_store_id and s2.status = 'completed'
             and s2.sold_at >= v_ini and s2.sold_at < v_fin
           group by sp.method
        ) u
       group by metodo
    ) m;

  -- Efectivo que ENTRÓ hoy: ventas en efectivo + parte en efectivo de las divididas +
  -- cobros de fiado en efectivo.
  select coalesce(sum(total), 0) into v_efectivo
    from (
      select sum(total) as total from public.sales
       where store_id = p_store_id and status = 'completed'
         and payment_method = 'cash'
         and sold_at >= v_ini and sold_at < v_fin
      union all
      select sum(sp.amount) from public.sale_payments sp
        join public.sales s2 on s2.id = sp.sale_id
       where s2.store_id = p_store_id and s2.status = 'completed' and sp.method = 'cash'
         and s2.sold_at >= v_ini and s2.sold_at < v_fin
      union all
      select sum(delta) from public.client_ledger
       where store_id = p_store_id and reason = 'payment' and payment_method = 'cash'
         and created_at >= v_ini and created_at < v_fin
    ) e;

  -- Efectivo que SALIÓ hoy por reembolsos (ventas cash anuladas hoy vendidas antes).
  select coalesce(sum(total), 0) into v_reembolso
    from public.sales
   where store_id = p_store_id and status = 'voided'
     and payment_method = 'cash'
     and voided_at >= v_ini and voided_at < v_fin
     and sold_at < v_ini;

  -- Detalle del día (cota dura de 300).
  select coalesce(jsonb_agg(v order by v.sold_at desc), '[]'::jsonb) into v_ventas
    from (
      select s.id, s.total, s.payment_method, s.status, s.sold_at,
             m.display_name as vendedor,
             c.name as cliente,
             (select count(*) from public.sale_items i where i.sale_id = s.id) as items,
             (select string_agg(i.product_name, ', ' order by i.id)
                from public.sale_items i where i.sale_id = s.id) as detalle
        from public.sales s
        left join public.members m on m.id = s.member_id
        left join public.clients c on c.id = s.client_id
       where s.store_id = p_store_id
         and s.sold_at >= v_ini and s.sold_at < v_fin
       order by s.sold_at desc
       limit 300
    ) v;

  return jsonb_build_object(
    'fecha', v_dia,
    'facturado', v_total,
    'entro_en_caja', v_total - v_fiado + v_cobros,
    'fiado', v_fiado,
    'cobros_fiado', v_cobros,
    'efectivo_esperado', v_efectivo - v_reembolso,
    'anuladas', v_anuladas,
    'by_method', v_medios,
    'ventas', v_ventas
  );
end;
$$;

grant execute on function public.cierre_caja(uuid, date) to authenticated;

-- 5c) reportes_medios (017): by_method del período.
create or replace function public.reportes_medios(
  p_store_id uuid,
  p_from     date,
  p_to       date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz     text;
  v_medios jsonb;
  v_fiado  numeric(12,2);
begin
  perform public.rpc_member(p_store_id);

  select timezone into v_tz from public.stores where id = p_store_id;
  v_tz := coalesce(v_tz, 'America/Argentina/Buenos_Aires');

  p_from := greatest(p_from, (now() at time zone v_tz)::date - 730);

  select coalesce(jsonb_agg(jsonb_build_object(
           'method', metodo, 'total', monto, 'count', cantidad) order by monto desc),
         '[]'::jsonb)
    into v_medios
    from (
      select metodo, sum(monto) as monto, sum(cantidad) as cantidad
        from (
          -- Ventas cobradas en el acto (el fiado y el split se excluyen del grupo directo)
          select s.payment_method as metodo, sum(s.total) as monto, count(*) as cantidad
            from public.sales s
           where s.store_id = p_store_id and s.status = 'completed'
             and s.payment_method not in ('account','split')
             and (s.sold_at at time zone v_tz)::date between p_from and p_to
           group by s.payment_method
          union all
          -- Cobros de fiado viejo: entraron en este período, por este medio
          select l.payment_method, sum(l.delta), count(*)
            from public.client_ledger l
           where l.store_id = p_store_id and l.reason = 'payment'
             and l.payment_method is not null
             and (l.created_at at time zone v_tz)::date between p_from and p_to
           group by l.payment_method
          union all
          -- Ventas divididas: cada parte a su medio real
          select sp.method, sum(sp.amount), count(*)
            from public.sale_payments sp
            join public.sales s2 on s2.id = sp.sale_id
           where s2.store_id = p_store_id and s2.status = 'completed'
             and (s2.sold_at at time zone v_tz)::date between p_from and p_to
           group by sp.method
        ) u
       group by metodo
    ) m;

  -- Lo fiado en el período va aparte: es venta, pero todavía no es plata.
  select coalesce(sum(s.total), 0) into v_fiado
    from public.sales s
   where s.store_id = p_store_id and s.status = 'completed'
     and s.payment_method = 'account'
     and (s.sold_at at time zone v_tz)::date between p_from and p_to;

  return jsonb_build_object('by_method', v_medios, 'on_credit', v_fiado);
end;
$$;

grant execute on function public.reportes_medios(uuid, date, date) to authenticated;

-- NOTA: la vista `daily_totals` (001) agrupa por payment_method y bucketearía un split
-- bajo 'split'. No la usa ninguna página (verificado) → se deja como está; si algún día
-- se consume, se le aplica el mismo criterio de imputación.