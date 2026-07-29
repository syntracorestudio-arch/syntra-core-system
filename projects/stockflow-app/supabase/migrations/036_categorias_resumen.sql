-- =============================================================================
-- StockFlow — 036_categorias_resumen.sql  (Chips con contador real + base del
-- drill-down de Productos — Fase 2 visual del audit de escala, §C1-C3)
--
-- El contador de un chip ("Golosinas 34") y el índice del drill-down necesitan
-- números REALES. Hasta ahora cada pantalla contaba sobre el subset que tenía
-- cargado en el cliente — con el catálogo acotado server-side (Fase 2), eso
-- garantizaba contadores falsos. Esta migración crea la única fuente de verdad:
--
--   · categorias_resumen(store) — por categoría: productos activos, stock bajo
--     (MISMA definición que la vista low_stock_products: umbral propio o default
--     del negocio), sin costo, y vendidas en 14 días (para ordenar por uso en el
--     POS). Más el bucket "Sin categoría": la deuda de catálogo, siempre visible.
--   · productos_buscar + p_solo_sin_categoria — el bucket es SELECCIONABLE como
--     filtro (category_id is null), no solo un número.
--
-- NO toca ventas, cobros ni el corte del día. Aditiva e idempotente.
-- NUMERACIÓN: 030-033 reservadas (branch de pagos parkeada) · 034/035 = escala
-- Fase 1/2. Aplicar DESPUÉS de 035. La corre el owner.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) categorias_resumen — el agregado, acotado y con gate.
-- -----------------------------------------------------------------------------
create or replace function public.categorias_resumen(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_desde timestamptz := now() - interval '14 days';
  v_cats  jsonb;
  v_sin   jsonb;
begin
  perform public.rpc_member(p_store_id);   -- gate → not_a_member

  with prod as (
    -- Conteos por categoría en UNA pasada sobre los productos activos del negocio.
    select p.category_id,
           count(*) as productos,
           count(*) filter (where p.cost is null) as sin_costo
      from public.products p
     where p.store_id = p_store_id and p.status = 'active'
     group by p.category_id
  ),
  bajo as (
    -- Stock bajo A TRAVÉS de la vista de alertas: si el umbral cambia de definición,
    -- este contador cambia con él. Un contador que no coincide con la alerta miente.
    select p.category_id, count(*) as stock_bajo
      from public.low_stock_products l
      join public.products p on p.id = l.id
     where l.store_id = p_store_id
     group by p.category_id
  ),
  uso as (
    -- Rotación de 14 días por categoría (ordena los chips del POS). Cota de fecha fija.
    select p.category_id, sum(i.qty) as vendidas
      from public.sale_items i
      join public.sales s on s.id = i.sale_id
      join public.products p on p.id = i.product_id
     where s.store_id = p_store_id
       and s.status = 'completed'
       and s.sold_at >= v_desde
       and i.product_id is not null
     group by p.category_id
  )
  select
    -- Las categorías (acotadas a 100, por sort — el orden de USO lo aplica el caller).
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'emoji', c.emoji, 'color', c.color,
               'sort', c.sort,
               'productos',    coalesce(pr.productos, 0),
               'stock_bajo',   coalesce(b.stock_bajo, 0),
               'sin_costo',    coalesce(pr.sin_costo, 0),
               'vendidas_14d', coalesce(u.vendidas, 0)
             ) order by c.sort, c.name)
        from (
          select * from public.categories
           where store_id = p_store_id and status = 'active'
           order by sort, name
           limit 100
        ) c
        left join prod pr on pr.category_id = c.id
        left join bajo b  on b.category_id  = c.id
        left join uso u   on u.category_id  = c.id
    ), '[]'::jsonb),
    -- El bucket de la deuda: lo que quedó sin categoría.
    jsonb_build_object(
      'productos',  coalesce((select productos  from prod where category_id is null), 0),
      'stock_bajo', coalesce((select stock_bajo from bajo where category_id is null), 0),
      'sin_costo',  coalesce((select sin_costo  from prod where category_id is null), 0)
    )
    into v_cats, v_sin;

  return jsonb_build_object('categorias', v_cats, 'sin_categoria', v_sin);
end;
$$;

grant execute on function public.categorias_resumen(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) productos_buscar + p_solo_sin_categoria (drop + create por cambio de firma;
--    los callers usan argumentos nombrados y el default mantiene el comportamiento).
--    Cuerpo idéntico al de 035 salvo el filtro nuevo.
-- -----------------------------------------------------------------------------
drop function if exists public.productos_buscar(uuid, text, uuid, int, int);

create or replace function public.productos_buscar(
  p_store_id           uuid,
  p_q                  text default null,
  p_categoria          uuid default null,
  p_limit              int  default 50,
  p_offset             int  default 0,
  p_solo_sin_categoria boolean default false   -- el bucket "Sin categoría" como filtro
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit  int;
  v_offset int;
  v_q      text;
  v_desde  timestamptz := now() - interval '14 days';
  v_items  jsonb;
  v_total  int;
begin
  perform public.rpc_member(p_store_id);

  v_limit  := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_q      := nullif(btrim(coalesce(p_q, '')), '');

  with filtrados as (
    select p.id, p.name, p.emoji, p.color, p.price, p.cost, p.stock,
           p.low_stock_threshold, p.category_id, c.name as category_name
      from public.products p
      left join public.categories c on c.id = p.category_id
     where p.store_id = p_store_id
       and p.status = 'active'
       and (case
              when p_solo_sin_categoria then p.category_id is null
              else (p_categoria is null or p.category_id = p_categoria)
            end)
       and (
         v_q is null
         or public.unaccent_simple(p.name) like '%' || public.unaccent_simple(v_q) || '%'
         or exists (
           select 1 from public.product_barcodes b
            where b.store_id = p_store_id
              and b.product_id = p.id
              and b.barcode like v_q || '%'
         )
       )
  ),
  ritmo as (
    select i.product_id, sum(i.qty) as vendidas
      from public.sale_items i
      join public.sales s on s.id = i.sale_id
     where s.store_id = p_store_id
       and s.status = 'completed'
       and s.sold_at >= v_desde
       and i.product_id in (select id from filtrados)
     group by i.product_id
  ),
  pagina as (
    select f.*, coalesce(r.vendidas, 0) as vendidas_14d
      from filtrados f
      left join ritmo r on r.product_id = f.id
     order by coalesce(r.vendidas, 0) desc, f.name
     limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'emoji', p.emoji, 'color', p.color,
           'price', p.price, 'cost', p.cost, 'stock', p.stock,
           'low_stock_threshold', p.low_stock_threshold,
           'category_id', p.category_id, 'category_name', p.category_name,
           'vendidas_14d', p.vendidas_14d,
           'vendidas_30d', coalesce((
             select sum(i.qty)
               from public.sale_items i
               join public.sales s on s.id = i.sale_id
              where s.store_id = p_store_id
                and s.status = 'completed'
                and s.sold_at >= now() - interval '30 days'
                and i.product_id = p.id
           ), 0)
         ) order by p.vendidas_14d desc, p.name), '[]'::jsonb),
         (select count(*) from filtrados)
    into v_items, v_total
    from pagina p;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

grant execute on function public.productos_buscar(uuid, text, uuid, int, int, boolean) to authenticated;