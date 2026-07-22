-- =============================================================================
-- StockFlow — 008_caja_real_y_merma.sql
--
-- Dos correcciones de HONESTIDAD de los números. Ninguna cambia el esquema:
-- cambian lo que el dueño ve, que es lo que importa.
--
-- 1) "Cómo te pagaron" mostraba el FIADO como si fuera un cobro, y no mostraba
--    los cobros de fiado del día. O sea: sumaba plata que no entró y escondía
--    plata que sí. Es el número más visible del producto; si el kiosquero lo
--    descubre una vez, no vuelve a creer en ningún número de la app.
--
-- 2) Las mermas no guardaban el costo del momento. Valuar la pérdida con el
--    costo ACTUAL hace que el número cambie solo cuando sube el costo — un
--    reporte que se mueve sin que pase nada es un reporte que miente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Snapshot de costo en las mermas
-- -----------------------------------------------------------------------------
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
  v_cost   numeric(12,2);
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
  if p_reason = 'waste' and p_delta > 0 then
    raise exception 'invalid_delta';
  end if;

  select cost into v_cost from public.products
   where id = p_product_id and store_id = p_store_id for update;
  if not found then
    raise exception 'product_not_found';
  end if;

  -- El costo se congela SOLO en las mermas: es lo que perdiste ese día.
  insert into public.stock_ledger (store_id, product_id, delta, reason, unit_cost,
                                   note, created_by)
  values (p_store_id, p_product_id, p_delta, p_reason,
          case when p_reason = 'waste' then v_cost else null end,
          p_note, v_member.id);

  select stock into v_stock from public.products where id = p_product_id;
  return v_stock;
end;
$$;

create or replace function public.resolve_expiry(
  p_store_id   uuid,
  p_expiry_id  uuid,
  p_resolution text,
  p_waste_qty  numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_exp    public.stock_expiries;
  v_qty    numeric(12,3);
  v_cost   numeric(12,2);
begin
  v_member := public.rpc_member(p_store_id);

  if not (v_member.role = 'owner' or v_member.can_receive_stock) then
    raise exception 'not_allowed';
  end if;
  if p_resolution not in ('sold','wasted') then
    raise exception 'invalid_resolution';
  end if;

  select * into v_exp from public.stock_expiries
   where id = p_expiry_id and store_id = p_store_id
   for update;
  if not found then
    raise exception 'expiry_not_found';
  end if;

  if v_exp.resolved_at is not null then
    return jsonb_build_object('already_resolved', true);
  end if;

  if p_resolution = 'wasted' then
    v_qty := coalesce(p_waste_qty, v_exp.qty);
    if v_qty > 0 then
      select cost into v_cost from public.products where id = v_exp.product_id;
      insert into public.stock_ledger (store_id, product_id, delta, reason, unit_cost,
                                       note, created_by)
      values (p_store_id, v_exp.product_id, -v_qty, 'waste', v_cost,
              format('vencido %s', v_exp.expiry_date), v_member.id);
    end if;
  end if;

  update public.stock_expiries
     set resolved_at = now(), resolution = p_resolution
   where id = p_expiry_id;

  return jsonb_build_object('already_resolved', false, 'resolution', p_resolution);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Caja real en el dashboard
--
-- Distinción que antes no existía:
--   · facturado  = todo lo que vendiste (incluye lo que fiaste)
--   · entró      = lo que realmente cobraste hoy (ventas no fiadas + cobros de
--                  deudas viejas)
--   · fiaste     = lo que se llevaron sin pagar hoy
-- `by_method` deja de mezclar el fiado con los medios de cobro y ahora suma los
-- cobros de fiado a su medio real: así el cierre de caja cierra de verdad.
-- -----------------------------------------------------------------------------
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

  -- Medios de COBRO reales: sin 'account', y con los cobros de fiado sumados
  -- al medio en que se cobraron.
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
             and payment_method <> 'account'
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
        ) u
       group by metodo
    ) m;

  -- "Para reponer": stock bajo ordenado por ROTACIÓN de los últimos 7 días.
  -- La decisión de la mañana no es "qué está bajo" sino "qué se me acaba
  -- primero": el chicle que vende 40 por día no es lo mismo que el producto
  -- que vende 1 por mes.
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
      'total', v_total,                       -- facturado
      'cash_in', v_total - v_fiado_hoy + v_cobros,  -- lo que ENTRÓ
      'credit_given', v_fiado_hoy,            -- lo que fiaste
      'credit_collected', v_cobros,           -- deudas viejas cobradas hoy
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
grant execute on function public.adjust_stock(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.resolve_expiry(uuid, uuid, text, numeric) to authenticated;