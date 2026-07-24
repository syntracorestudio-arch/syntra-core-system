-- =============================================================================
-- StockFlow — 017_reportes_medios.sql
-- "Cómo te pagan" en Reportes.
--
-- Caja ya muestra el desglose por medio de pago, pero SOLO del día. Para
-- decidir cosas que importan —si conviene bancar el costo del posnet, si el QR
-- creció lo suficiente como para pedir la cuenta de MercadoPago, cuánto del mes
-- se fue en fiado— hace falta verlo por período, y eso no existía en ningún
-- lado.
--
-- Va como función APARTE en vez de sumarle un campo a `reportes_summary`:
-- redefinir esa función obliga a copiar sus ~300 líneas en esta migración, y a
-- partir de ahí conviven dos versiones del mismo cuerpo que se desincronizan en
-- el primer cambio. La página llama a las dos en paralelo.
--
-- Mismo criterio que el cierre de caja (013): el fiado NO es un medio de pago
-- —nadie pagó— así que se reporta aparte, y los cobros de deuda vieja suman al
-- medio en que se cobraron. Sin eso "cómo te pagan" mezcla plata que entró con
-- plata que solo se prometió.
-- =============================================================================

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

  -- Cota dura de lectura: 24 meses, igual que `reportes_summary` (baseline).
  p_from := greatest(p_from, (now() at time zone v_tz)::date - 730);

  select coalesce(jsonb_agg(jsonb_build_object(
           'method', metodo, 'total', monto, 'count', cantidad) order by monto desc),
         '[]'::jsonb)
    into v_medios
    from (
      select metodo, sum(monto) as monto, sum(cantidad) as cantidad
        from (
          -- Ventas cobradas en el acto (el fiado se excluye: no entró nada)
          select s.payment_method as metodo, sum(s.total) as monto, count(*) as cantidad
            from public.sales s
           where s.store_id = p_store_id and s.status = 'completed'
             and s.payment_method <> 'account'
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