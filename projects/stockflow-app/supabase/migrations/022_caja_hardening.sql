-- =============================================================================
-- StockFlow — 022_caja_hardening.sql  (auditoría Tanda 2: cierre de caja)
--
-- Recrea cierre_caja (create or replace, aditivo) con dos arreglos:
--
--   M1 · Cota de fecha SARGABLE. Antes filtraba con `(sold_at at time zone tz)::date
--        = v_dia`: el cast envuelve la columna y ANULA el índice
--        (sales_store_date_idx), así que el cierre escaneaba toda la historia de
--        ventas del negocio en cada apertura y se degradaba con los meses. Ahora
--        usa el rango `>= v_ini and < v_fin` (los instantes UTC que acotan el día
--        del negocio) → el planner usa el índice. Mismos números, sin el escaneo.
--
--   M2 · Reembolso de efectivo al anular. Antes una venta en efectivo de OTRO día
--        anulada hoy sacaba plata del cajón HOY pero no aparecía en ningún lado
--        (las anuladas se excluyen de todo por `status='completed'`), y el cierre
--        cantaba un "faltante" fantasma. Ahora `efectivo_esperado` RESTA esos
--        reembolsos (efectivo, anulado hoy, vendido antes de hoy). La venta
--        anulada el MISMO día netea sola (nunca entró como cash) y no se toca.
--
-- Additiva: aplicar DESPUÉS de 021. La corre el owner.
-- =============================================================================

-- Índice para el término de reembolsos (y futuras analíticas de anulación):
-- las anuladas son una fracción chica, pero el filtro por voided_at sin índice
-- volvería a escanear. Parcial sobre las anuladas.
create index if not exists sales_voided_idx on public.sales (store_id, voided_at)
  where status = 'voided';

create or replace function public.cierre_caja(
  p_store_id uuid,
  p_fecha    date default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz        text;
  v_dia       date;
  v_ini       timestamptz;  -- inicio del día del negocio, en UTC (sargable)
  v_fin       timestamptz;  -- inicio del día siguiente
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
  -- Instantes UTC que acotan el día del negocio. `(fecha::timestamp) at time zone tz`
  -- interpreta la medianoche local y la devuelve como timestamptz → filtro sargable.
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

  -- Medios de COBRO reales (el fiado no es un medio; los cobros de deuda suman a
  -- su medio real).
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
             and payment_method <> 'account'
             and sold_at >= v_ini and sold_at < v_fin
           group by payment_method
          union all
          select payment_method, sum(delta), count(*)
            from public.client_ledger
           where store_id = p_store_id and reason = 'payment'
             and payment_method is not null
             and created_at >= v_ini and created_at < v_fin
           group by payment_method
        ) u
       group by metodo
    ) m;

  -- Efectivo que ENTRÓ hoy: ventas en efectivo + cobros de fiado en efectivo.
  select coalesce(sum(total), 0) into v_efectivo
    from (
      select sum(total) as total from public.sales
       where store_id = p_store_id and status = 'completed'
         and payment_method = 'cash'
         and sold_at >= v_ini and sold_at < v_fin
      union all
      select sum(delta) from public.client_ledger
       where store_id = p_store_id and reason = 'payment' and payment_method = 'cash'
         and created_at >= v_ini and created_at < v_fin
    ) e;

  -- Efectivo que SALIÓ hoy por reembolsos: ventas en efectivo anuladas HOY que se
  -- vendieron ANTES de hoy (su cash se contó en un cierre anterior; hoy se devolvió).
  -- Las anuladas el mismo día no entran: nunca se contaron como cash-in.
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