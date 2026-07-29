-- =============================================================================
-- StockFlow — 034_escala_fase1.sql  (Escala Fase 1: cerrar el RIESGO 0 y poner
-- cota a las lecturas sin techo)
--
-- Fuente: `docs/inventario-escala-audit.md`. La UI se construyó con ~6 productos;
-- un kiosco real tiene 800-2000+. Esta migración ataca lo que ROMPE DATOS, no lo
-- que se ve feo:
--
--   1) `producto_por_codigo` — el escaneo deja de depender del catálogo precargado.
--      Hoy el POS precarga `products` con `.limit(500)` ordenado por NOMBRE y arma el
--      índice de códigos SOLO con ese array. Un producto más allá del corte NO se
--      encontraba al escanear → el cajero caía en "alta rápida" → PRODUCTO DUPLICADO
--      con stock 0 (y encima el insert del código fallaba en silencio contra el
--      UNIQUE, dejando el duplicado sin código). Eso corrompe stock, alertas y
--      reportes. Con esta función, escanear resuelve contra la BASE.
--
--   2) Cotas del baseline en las tres lecturas sin techo detectadas
--      (`store_alerts.low_stock` / `expiring`, `dashboard_summary.restock`,
--      `reportes_summary.by_category`). Se serializaban listas completas para pintar
--      4, 5 y 9 filas — y el cron las corre para TODOS los negocios.
--
--      **Se recorta el array PERO se devuelve el TOTAL real** (`*_total`): los
--      consumidores usan `.length` para decir "y otros N productos bajo mínimo"
--      (cron) y para el badge del dashboard. Recortar sin el total convertiría una
--      lectura pesada en un número MENTIROSO — justo lo que esta tanda combate.
--      Las claves nuevas son ADITIVAS: el cliente viejo sigue funcionando.
--
-- No toca `sales`, `sale_payments`, `payment_intents` ni ninguna RPC de cobro.
-- Aditiva e idempotente (create or replace). Aplicar DESPUÉS de 029.
-- NOTA DE NUMERACIÓN: 030-033 están RESERVADAS por la branch de pagos parkeada
-- (`feat/stockflow-split-dos-electronicas`); por eso esta tanda arranca en 034.
-- La corre el owner.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) producto_por_codigo — resolver de escaneo server-side (mata el RIESGO 0)
--
-- Índice: NO se crea ninguno. El lookup va por `product_barcodes (store_id, barcode)`,
-- que ya es UNIQUE desde 001 (`unique (store_id, barcode)`, 001:136) — esa constraint
-- ya materializa el índice único que sirve esta consulta.
--
-- Devuelve UNA fila o null (acotada por construcción). No filtra por `status`: un
-- producto archivado se resuelve igual, marcado `archivado`, porque "no lo encuentro"
-- es justo lo que empujaba al cajero a crear un duplicado.
-- -----------------------------------------------------------------------------
create or replace function public.producto_por_codigo(
  p_store_id uuid,
  p_codigo   text
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_codigo text;
  v_res    jsonb;
begin
  perform public.rpc_member(p_store_id);   -- gate de miembro → not_a_member

  v_codigo := nullif(btrim(coalesce(p_codigo, '')), '');
  if v_codigo is null then
    return null;
  end if;

  select jsonb_build_object(
           'id', p.id,
           'name', p.name,
           'emoji', p.emoji,
           'color', p.color,
           'price', p.price,
           'stock', p.stock,
           'category_id', p.category_id,
           'category_name', c.name,
           'archivado', (p.status <> 'active'),
           'barcodes', coalesce(
             (select jsonb_agg(b2.barcode order by b2.barcode)
                from public.product_barcodes b2
               where b2.store_id = p_store_id and b2.product_id = p.id),
             '[]'::jsonb)
         )
    into v_res
    from public.product_barcodes b
    join public.products p
      on p.id = b.product_id and p.store_id = b.store_id
    left join public.categories c on c.id = p.category_id
   where b.store_id = p_store_id
     and b.barcode  = v_codigo;

  return v_res;   -- null si no hay match (la caja recién ahí ofrece alta rápida)
end;
$$;

grant execute on function public.producto_por_codigo(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) store_alerts — cota en low_stock y expiring + totales reales
--    (redefine la de 006; misma firma, claves nuevas aditivas)
-- -----------------------------------------------------------------------------
create or replace function public.store_alerts(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_days     integer;
  v_low      jsonb;
  v_expiry   jsonb;
  v_low_t    integer;
  v_expiry_t integer;
begin
  -- Gate de miembro (ESCALA F1, hallazgo del baseline): esta función es
  -- SECURITY DEFINER y tiene GRANT a `authenticated`, pero NO validaba al caller
  -- — cualquier usuario logueado podía leer por PostgREST el stock bajo y los
  -- vencimientos de OTRO negocio. Se valida SOLO cuando hay usuario autenticado:
  -- los crons la invocan con service_role (auth.uid() null) y deben seguir pasando.
  if auth.uid() is not null then
    perform public.rpc_member(p_store_id);
  end if;

  select expiry_warning_days into v_days
    from public.store_settings where store_id = p_store_id;
  v_days := coalesce(v_days, 7);

  -- Total REAL antes de recortar: el cron dice "y otros N bajo mínimo" y el
  -- dashboard pinta un badge con ese número. Recortar sin el total lo volvería mentira.
  select count(*) into v_low_t
    from public.low_stock_products
   where store_id = p_store_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', id, 'name', name, 'emoji', emoji,
           'stock', stock, 'threshold', threshold) order by stock), '[]'::jsonb)
    into v_low
    from (
      select id, name, emoji, stock, threshold
        from public.low_stock_products
       where store_id = p_store_id
       order by stock
       limit 50
    ) t;

  select count(*) into v_expiry_t
    from public.pending_expiries
   where store_id = p_store_id
     and expiry_date <= current_date + v_days;

  select coalesce(jsonb_agg(jsonb_build_object(
           'expiry_id', id, 'product_id', product_id, 'name', product_name,
           'emoji', product_emoji, 'expiry_date', expiry_date,
           'days_left', days_left, 'qty', qty) order by expiry_date), '[]'::jsonb)
    into v_expiry
    from (
      select id, product_id, product_name, product_emoji, expiry_date, days_left, qty
        from public.pending_expiries
       where store_id = p_store_id
         and expiry_date <= current_date + v_days
       order by expiry_date
       limit 50
    ) t;

  return jsonb_build_object(
    'low_stock', v_low,
    'expiring', v_expiry,
    'warning_days', v_days,
    -- Totales reales (aditivos): el array va recortado, el conteo NO miente.
    'low_stock_total', v_low_t,
    'expiring_total', v_expiry_t
  );
end;
$$;

grant execute on function public.store_alerts(uuid) to authenticated;
grant execute on function public.store_alerts(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 3) dashboard_summary — cota en restock + totales reales.
--    Copia EXACTA de la versión vigente (027:311-473) con 4 parches quirúrgicos:
--    declaración de v_reponer_t, count(*) del total real, `limit 50` en el
--    subselect de restock, y las 3 claves *_total en el return. Nada más cambia.
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
  v_reponer_t  integer;
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
  -- ESCALA F1: total REAL primero (los conteos de la UI no pueden mentir) y el array
  -- recortado abajo. Antes serializaba TODOS los productos bajo mínimo para pintar 5
  -- filas; con 2000 SKUs son cientos por request, y el cron lo corre por cada negocio.
  select count(*) into v_reponer_t
    from public.low_stock_products l
   where l.store_id = p_store_id;

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
       order by velocidad desc nulls last
       limit 50
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
    'restock_total', v_reponer_t,
    'credit', jsonb_build_object('total', v_fiado, 'top', v_deudores),
    'low_stock', v_alerts->'low_stock',
    'low_stock_total', v_alerts->'low_stock_total',
    'expiring', v_alerts->'expiring',
    'expiring_total', v_alerts->'expiring_total'
  );
end;
$$;

grant execute on function public.dashboard_summary(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) reportes_summary — cota en by_category + total real.
--    Copia EXACTA de 009:16-331 con 4 parches: declaración de v_categoria_t,
--    count(*) de categorías con ventas, `order by revenue desc limit 30` en el
--    subselect, y la clave by_category_total en el return.
-- -----------------------------------------------------------------------------
create or replace function public.reportes_summary(
  p_store_id uuid,
  p_from     date,
  p_to       date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz        text;
  v_dias      integer;
  v_prev_from date;
  v_prev_to   date;
  v_primer    date;
  v_dias_uso  integer;
  v_vendido   numeric(12,2);
  v_tickets   integer;
  v_unidades  numeric(12,3);
  v_ganancia  numeric(12,2);
  v_base_cost numeric(12,2);
  v_cobertura numeric;
  v_prev_vend numeric(12,2);
  v_prev_unid numeric(12,3);
  v_comprado  numeric(12,2);
  v_gondola   numeric(12,2);
  v_por_dia   jsonb;
  v_top_unid  jsonb;
  v_top_gan   jsonb;
  v_categoria jsonb;
  v_categoria_t integer;
  v_semana    jsonb;
  v_franja    jsonb;
  v_muerto    jsonb;
  v_muerto_t  numeric(12,2);
  v_merma     numeric(12,2);
  v_merma_top jsonb;
  v_fiado_dad numeric(12,2);
  v_fiado_cob numeric(12,2);
  v_fiado_old jsonb;
  v_sin_costo integer;
  v_precio_vj integer;
begin
  perform public.rpc_member(p_store_id);

  select timezone into v_tz from public.stores where id = p_store_id;
  v_tz := coalesce(v_tz, 'America/Argentina/Buenos_Aires');

  -- Cota dura de lectura: 24 meses hacia atrás, como StudioFlow (baseline).
  p_from := greatest(p_from, (now() at time zone v_tz)::date - 730);
  v_dias := greatest((p_to - p_from) + 1, 1);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - (v_dias - 1);

  -- Cuántos días de uso real tiene el negocio: define qué métricas se prenden.
  select min((sold_at at time zone v_tz)::date) into v_primer
    from public.sales where store_id = p_store_id and status = 'completed';
  v_dias_uso := coalesce((now() at time zone v_tz)::date - v_primer, 0);

  ---------------------------------------------------------------------------
  -- A. LA PLATA
  ---------------------------------------------------------------------------
  select coalesce(sum(s.total), 0), count(*)
    into v_vendido, v_tickets
    from public.sales s
   where s.store_id = p_store_id and s.status = 'completed'
     and (s.sold_at at time zone v_tz)::date between p_from and p_to;

  select coalesce(sum(i.qty), 0),
         coalesce(sum((i.unit_price - i.unit_cost) * i.qty) filter (where i.unit_cost is not null), 0),
         coalesce(sum(i.line_total) filter (where i.unit_cost is not null), 0),
         case when count(*) = 0 then null
              else round(count(*) filter (where i.unit_cost is not null)::numeric / count(*) * 100, 0)
         end
    into v_unidades, v_ganancia, v_base_cost, v_cobertura
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
   where s.store_id = p_store_id and s.status = 'completed'
     and (s.sold_at at time zone v_tz)::date between p_from and p_to
     and i.product_id is not null;

  -- Período anterior: en PESOS solo sirve si está pegado (inflación).
  select coalesce(sum(s.total), 0) into v_prev_vend
    from public.sales s
   where s.store_id = p_store_id and s.status = 'completed'
     and (s.sold_at at time zone v_tz)::date between v_prev_from and v_prev_to;

  select coalesce(sum(i.qty), 0) into v_prev_unid
    from public.sale_items i
    join public.sales s on s.id = i.sale_id
   where s.store_id = p_store_id and s.status = 'completed'
     and (s.sold_at at time zone v_tz)::date between v_prev_from and v_prev_to
     and i.product_id is not null;

  -- Cuánto pusiste en mercadería: responde "vendí bien, ¿por qué no tengo plata?"
  select coalesce(sum(delta * unit_cost), 0) into v_comprado
    from public.stock_ledger
   where store_id = p_store_id and reason = 'purchase' and unit_cost is not null
     and (created_at at time zone v_tz)::date between p_from and p_to;

  -- Plata inmovilizada en la góndola, valuada a costo
  select coalesce(sum(stock * cost), 0) into v_gondola
    from public.products
   where store_id = p_store_id and status = 'active'
     and cost is not null and stock > 0;

  -- Evolución diaria (o mensual si el período es largo)
  select coalesce(jsonb_agg(d order by d.fecha), '[]'::jsonb) into v_por_dia
    from (
      select case when v_dias > 92
                  then to_char(date_trunc('month', (s.sold_at at time zone v_tz)), 'YYYY-MM')
                  else to_char((s.sold_at at time zone v_tz)::date, 'YYYY-MM-DD')
             end as fecha,
             sum(s.total) as total
        from public.sales s
       where s.store_id = p_store_id and s.status = 'completed'
         and (s.sold_at at time zone v_tz)::date between p_from and p_to
       group by 1
    ) d;

  ---------------------------------------------------------------------------
  -- B. QUÉ CONVIENE VENDER — los dos rankings que revelan lo que el kiosquero
  --    no calcula solo: lo que más rota NO es lo que más deja.
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(t order by t.units desc), '[]'::jsonb) into v_top_unid
    from (
      select i.product_id, i.product_name as name, max(p.emoji) as emoji,
             sum(i.qty) as units, sum(i.line_total) as revenue
        from public.sale_items i
        join public.sales s on s.id = i.sale_id
        left join public.products p on p.id = i.product_id
       where s.store_id = p_store_id and s.status = 'completed'
         and (s.sold_at at time zone v_tz)::date between p_from and p_to
         and i.product_id is not null
       group by i.product_id, i.product_name
       order by sum(i.qty) desc limit 8
    ) t;

  -- Ordenado por $ DE GANANCIA, no por margen %: un producto con 70% de margen
  -- que vende 3 unidades no paga el alquiler.
  select coalesce(jsonb_agg(t order by t.profit desc), '[]'::jsonb) into v_top_gan
    from (
      select i.product_id, i.product_name as name, max(p.emoji) as emoji,
             sum((i.unit_price - i.unit_cost) * i.qty) as profit,
             sum(i.qty) as units,
             round(sum((i.unit_price - i.unit_cost) * i.qty) / nullif(sum(i.line_total), 0) * 100, 0) as margin_pct
        from public.sale_items i
        join public.sales s on s.id = i.sale_id
        left join public.products p on p.id = i.product_id
       where s.store_id = p_store_id and s.status = 'completed'
         and (s.sold_at at time zone v_tz)::date between p_from and p_to
         and i.product_id is not null and i.unit_cost is not null
       group by i.product_id, i.product_name
       order by sum((i.unit_price - i.unit_cost) * i.qty) desc limit 8
    ) t;

  -- ESCALA F1: cota. Un kiosco puede tener 60-80 categorías con ventas; el cliente
  -- dibujaba una barra por cada una. Se recortan a las 30 de mayor facturación y el
  -- total real viaja aparte para poder decir "y N más" sin mentir.
  select count(*) into v_categoria_t
    from (
      select 1
        from public.sale_items i
        join public.sales s on s.id = i.sale_id
        left join public.products p on p.id = i.product_id
        left join public.categories cat on cat.id = p.category_id
       where s.store_id = p_store_id and s.status = 'completed'
         and (s.sold_at at time zone v_tz)::date between p_from and p_to
         and i.product_id is not null
       group by coalesce(cat.name, 'Sin categoría')
    ) ct;

  select coalesce(jsonb_agg(c order by c.revenue desc), '[]'::jsonb) into v_categoria
    from (
      select coalesce(cat.name, 'Sin categoría') as name,
             max(cat.color) as color,
             sum(i.line_total) as revenue,
             coalesce(sum((i.unit_price - i.unit_cost) * i.qty) filter (where i.unit_cost is not null), 0) as profit
        from public.sale_items i
        join public.sales s on s.id = i.sale_id
        left join public.products p on p.id = i.product_id
        left join public.categories cat on cat.id = p.category_id
       where s.store_id = p_store_id and s.status = 'completed'
         and (s.sold_at at time zone v_tz)::date between p_from and p_to
         and i.product_id is not null
       group by coalesce(cat.name, 'Sin categoría')
       order by sum(i.line_total) desc
       limit 30
    ) c;

  ---------------------------------------------------------------------------
  -- C. CUÁNDO VENDÉS
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(d order by d.dow), '[]'::jsonb) into v_semana
    from (
      select extract(dow from (s.sold_at at time zone v_tz))::int as dow,
             sum(s.total) as total,
             count(distinct (s.sold_at at time zone v_tz)::date) as dias
        from public.sales s
       where s.store_id = p_store_id and s.status = 'completed'
         and (s.sold_at at time zone v_tz)::date between p_from and p_to
       group by 1
    ) d;

  -- Franjas y no 24 barras: en un teléfono 24 columnas son ilegibles, y con
  -- poco volumen el ruido tapa la señal.
  select coalesce(jsonb_agg(f order by f.orden), '[]'::jsonb) into v_franja
    from (
      select case
               when extract(hour from (s.sold_at at time zone v_tz)) < 12 then 1
               when extract(hour from (s.sold_at at time zone v_tz)) < 15 then 2
               when extract(hour from (s.sold_at at time zone v_tz)) < 20 then 3
               else 4
             end as orden,
             case
               when extract(hour from (s.sold_at at time zone v_tz)) < 12 then 'Mañana'
               when extract(hour from (s.sold_at at time zone v_tz)) < 15 then 'Mediodía'
               when extract(hour from (s.sold_at at time zone v_tz)) < 20 then 'Tarde'
               else 'Noche'
             end as name,
             sum(s.total) as total,
             count(*) as tickets
        from public.sales s
       where s.store_id = p_store_id and s.status = 'completed'
         and (s.sold_at at time zone v_tz)::date between p_from and p_to
       group by 1, 2
    ) f;

  ---------------------------------------------------------------------------
  -- D. DÓNDE SE TE ESCAPA LA PLATA
  ---------------------------------------------------------------------------
  -- Stock muerto: con stock, sin ventas en 30 días, y creado hace más de 30
  -- (si no, todo catálogo nuevo aparecería "muerto" y el reporte sería ridículo).
  select coalesce(jsonb_agg(m order by m.parado desc), '[]'::jsonb),
         coalesce(sum(m.parado), 0)
    into v_muerto, v_muerto_t
    from (
      select p.id as product_id, p.name, p.emoji, p.stock,
             round(p.stock * p.cost, 2) as parado
        from public.products p
       where p.store_id = p_store_id and p.status = 'active'
         and p.stock > 0 and p.cost is not null
         and p.created_at < now() - interval '30 days'
         and not exists (
           select 1 from public.sale_items i
             join public.sales s on s.id = i.sale_id
            where i.product_id = p.id and s.status = 'completed'
              and (s.sold_at at time zone v_tz)::date > (now() at time zone v_tz)::date - 30
         )
       order by p.stock * p.cost desc
       limit 10
    ) m;

  -- Merma valuada a COSTO: es lo que perdiste, no lo que dejaste de ganar.
  select coalesce(sum(-delta * unit_cost), 0) into v_merma
    from public.stock_ledger
   where store_id = p_store_id and reason = 'waste' and unit_cost is not null
     and (created_at at time zone v_tz)::date between p_from and p_to;

  select coalesce(jsonb_agg(w order by w.perdido desc), '[]'::jsonb) into v_merma_top
    from (
      select p.name, p.emoji, sum(-l.delta) as unidades,
             round(sum(-l.delta * l.unit_cost), 2) as perdido
        from public.stock_ledger l
        join public.products p on p.id = l.product_id
       where l.store_id = p_store_id and l.reason = 'waste' and l.unit_cost is not null
         and (l.created_at at time zone v_tz)::date between p_from and p_to
       group by p.name, p.emoji
       order by sum(-l.delta * l.unit_cost) desc limit 5
    ) w;

  select coalesce(sum(-delta) filter (where reason = 'sale'), 0),
         coalesce(sum(delta) filter (where reason = 'payment'), 0)
    into v_fiado_dad, v_fiado_cob
    from public.client_ledger
   where store_id = p_store_id
     and (created_at at time zone v_tz)::date between p_from and p_to;

  -- Antigüedad de la deuda: el bucket de +30 días es el que sirve para decidir
  -- a quién dejar de fiarle.
  select coalesce(jsonb_agg(a order by a.dias desc), '[]'::jsonb) into v_fiado_old
    from (
      select b.client_id, b.name, -b.balance as owed,
             ((now() at time zone v_tz)::date - (max(l.created_at) at time zone v_tz)::date) as dias
        from public.client_balances b
        join public.client_ledger l on l.client_id = b.client_id
       where b.store_id = p_store_id and b.balance < 0
       group by b.client_id, b.name, b.balance
      having ((now() at time zone v_tz)::date - (max(l.created_at) at time zone v_tz)::date) >= 30
       limit 10
    ) a;

  ---------------------------------------------------------------------------
  -- E. SALUD DE LOS DATOS — no es una métrica de negocio: es lo que habilita
  --    que las otras sean verdad.
  ---------------------------------------------------------------------------
  select count(*) into v_sin_costo
    from public.products
   where store_id = p_store_id and status = 'active' and cost is null;

  select count(*) into v_precio_vj
    from public.products
   where store_id = p_store_id and status = 'active'
     and (price_updated_at is null or price_updated_at < now() - interval '60 days');

  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_dias,
                                 'days_of_use', v_dias_uso),
    'money', jsonb_build_object(
      'sold', v_vendido, 'tickets', v_tickets, 'units', v_unidades,
      'profit', v_ganancia,
      'margin_pct', case when v_base_cost > 0
                         then round(v_ganancia / v_base_cost * 100, 0) else null end,
      'cost_coverage', v_cobertura,
      'purchased', v_comprado,
      'shelf_value', v_gondola,
      'prev_sold', v_prev_vend,
      'prev_units', v_prev_unid,
      'vs_prev_pct', case when v_prev_vend > 0
                          then round((v_vendido - v_prev_vend) / v_prev_vend * 100, 0)
                          else null end
    ),
    'by_date', v_por_dia,
    'top_units', v_top_unid,
    'top_profit', v_top_gan,
    'by_category', v_categoria,
    'by_category_total', v_categoria_t,
    'by_weekday', v_semana,
    'by_slot', v_franja,
    'dead_stock', jsonb_build_object('total', v_muerto_t, 'items', v_muerto),
    'waste', jsonb_build_object('total', v_merma, 'items', v_merma_top),
    'credit', jsonb_build_object('given', v_fiado_dad, 'collected', v_fiado_cob,
                                 'overdue', v_fiado_old),
    'data_health', jsonb_build_object('cost_coverage', v_cobertura,
                                      'products_without_cost', v_sin_costo,
                                      'stale_prices', v_precio_vj)
  );
end;
$$;

grant execute on function public.reportes_summary(uuid, date, date) to authenticated;
