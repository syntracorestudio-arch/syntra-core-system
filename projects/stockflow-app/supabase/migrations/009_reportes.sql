-- =============================================================================
-- StockFlow — 009_reportes.sql
--
-- "¿Cómo viene el negocio?" — la pantalla que responde lo que el Resumen no:
-- tendencia, comparación y las decisiones que duran semanas.
--
-- Todo agregado EN SQL. StudioFlow trae 24 meses de filas crudas y agrega en
-- JavaScript; con un kiosco de 60 ventas diarias eso son ~22.000 ventas y 60.000
-- líneas por año viajando al browser. Acá vuelve solo el resultado.
--
-- Cada métrica trae su propio umbral de datos: una métrica que necesita 30 días
-- no se muestra a los 3 con un número inventado, se muestra apagada diciendo
-- cuánto falta.
-- =============================================================================

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