-- =============================================================================
-- StockFlow — 007_dashboard.sql  (tanda 1H)
--
-- "Tu negocio en una pantalla". Todo el resumen en UNA función en vez de ocho
-- queries desde la app, por tres razones:
--   1. Un solo viaje a la base para pintar la pantalla completa.
--   2. Las cotas de fecha viven acá y no se pueden olvidar (baseline).
--   3. El día se corta en la timezone DEL NEGOCIO, no del servidor: un kiosco
--      que cierra a las 2 AM no puede ver su venta partida en dos días.
-- =============================================================================

create or replace function public.dashboard_summary(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz        text;
  v_hoy       date;
  v_total     numeric(12,2);
  v_count     integer;
  v_profit    numeric(12,2);
  v_con_costo integer;
  v_lineas    integer;
  v_promedio  numeric(12,2);
  v_medios    jsonb;
  v_top       jsonb;
  v_fiado     numeric(12,2);
  v_deudores  jsonb;
  v_alerts    jsonb;
begin
  -- Membresía: la función es SECURITY DEFINER, así que el chequeo es manual.
  perform public.rpc_member(p_store_id);

  select timezone into v_tz from public.stores where id = p_store_id;
  v_tz := coalesce(v_tz, 'America/Argentina/Buenos_Aires');
  v_hoy := (now() at time zone v_tz)::date;

  ---------------------------------------------------------------------------
  -- Hoy: cuánto vendiste y cuántas ventas
  ---------------------------------------------------------------------------
  select coalesce(sum(total), 0), count(*)
    into v_total, v_count
    from public.sales
   where store_id = p_store_id
     and status = 'completed'
     and (sold_at at time zone v_tz)::date = v_hoy;

  ---------------------------------------------------------------------------
  -- Ganancia estimada + qué tan confiable es.
  -- `coverage` existe para poder DEGRADAR CON HONESTIDAD: si la mitad de las
  -- líneas no tiene costo cargado, el número miente y hay que decirlo en vez
  -- de mostrarlo como si fuera exacto (business-rules §2).
  ---------------------------------------------------------------------------
  select coalesce(sum((i.unit_price - i.unit_cost) * i.qty) filter (where i.unit_cost is not null), 0),
         count(*) filter (where i.unit_cost is not null),
         count(*)
    into v_profit, v_con_costo, v_lineas
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
   where s.store_id = p_store_id
     and s.status = 'completed'
     and (s.sold_at at time zone v_tz)::date = v_hoy
     and i.product_id is not null;   -- el monto libre no tiene costo conocido

  ---------------------------------------------------------------------------
  -- Promedio diario de los 28 días previos (sin contar hoy, que está a medias).
  -- Cota dura: nunca escanea más allá de esa ventana.
  ---------------------------------------------------------------------------
  select coalesce(avg(dia_total), 0) into v_promedio
    from (
      select sum(total) as dia_total
        from public.sales
       where store_id = p_store_id
         and status = 'completed'
         and (sold_at at time zone v_tz)::date between v_hoy - 28 and v_hoy - 1
       group by (sold_at at time zone v_tz)::date
    ) dias;

  ---------------------------------------------------------------------------
  -- Cómo te pagaron hoy
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'method', payment_method, 'total', monto, 'count', cantidad)
           order by monto desc), '[]'::jsonb)
    into v_medios
    from (
      select payment_method, sum(total) as monto, count(*) as cantidad
        from public.sales
       where store_id = p_store_id
         and status = 'completed'
         and (sold_at at time zone v_tz)::date = v_hoy
       group by payment_method
    ) m;

  ---------------------------------------------------------------------------
  -- Lo que más vendiste en los últimos 7 días, con su margen real
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_top
    from (
      select i.product_id,
             i.product_name as name,
             max(p.emoji)   as emoji,
             sum(i.qty)     as units,
             sum(i.line_total) as revenue,
             case when sum(i.line_total) filter (where i.unit_cost is not null) > 0
                  then round(
                    sum((i.unit_price - i.unit_cost) * i.qty) filter (where i.unit_cost is not null)
                    / sum(i.line_total) filter (where i.unit_cost is not null) * 100, 0)
                  else null
             end as margin_pct
        from public.sale_items i
        join public.sales s on s.id = i.sale_id
        left join public.products p on p.id = i.product_id
       where s.store_id = p_store_id
         and s.status = 'completed'
         and (s.sold_at at time zone v_tz)::date > v_hoy - 7
         and i.product_id is not null
       group by i.product_id, i.product_name
       order by sum(i.qty) desc
       limit 5
    ) t;

  ---------------------------------------------------------------------------
  -- Fiado en la calle + quiénes deben más
  ---------------------------------------------------------------------------
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

  -- Stock bajo y vencimientos salen de store_alerts: una sola definición para
  -- el push y para la pantalla. Si el aviso dice 3, la pantalla dice 3.
  v_alerts := public.store_alerts(p_store_id);

  return jsonb_build_object(
    'today', jsonb_build_object(
      'total', v_total,
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
    'top_week', v_top,
    'credit', jsonb_build_object('total', v_fiado, 'top', v_deudores),
    'low_stock', v_alerts->'low_stock',
    'expiring', v_alerts->'expiring'
  );
end;
$$;

grant execute on function public.dashboard_summary(uuid) to authenticated;

-- Índice que sirve el corte diario y el promedio de 28 días. El de 001
-- (store_id, sold_at desc) ya ayuda, pero este cubre además el filtro de estado
-- sin ir a la tabla.
create index if not exists sales_completed_date_idx
  on public.sales (store_id, sold_at desc)
  where status = 'completed';