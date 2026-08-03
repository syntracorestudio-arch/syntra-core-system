-- =============================================================================
-- 038 · MODO PUESTA EN MARCHA (onboarding F1a · PR B)
--
-- 037 declaró `products.stock_confiable` y lo mantiene correcto. Acá recién
-- EMPIEZA a consumirse: las señales de stock se apagan para los productos que
-- todavía no tienen baseline de góndola.
--
-- Por qué: un producto dado de alta en el mostrador arranca en 0 y vende hacia
-- negativo. Sin esto, el aviso de las 09:00 le dice al kiosquero "te quedaste
-- sin Coca-Cola — y otros 399 productos bajo mínimo" TODAS las mañanas. Eso no
-- es una alerta: es entrenarlo a ignorar los avisos, incluidos los urgentes.
--
-- Dos condiciones que mandan sobre todo lo demás:
--   · NADA se esconde en silencio. Lo que no alerta se puede CONTAR y LISTAR
--     (categorias_resumen + productos_buscar), y se gradúa contando.
--   · Ningún negocio existente pierde una alerta: todo lo que ya está en la
--     base es confiable por el default de 037.
--
-- OJO: esto NO vuelve confiable al stock. F1a deja un catálogo VENDIBLE, no un
-- inventario. Las señales se encienden producto por producto cuando alguien
-- mira la góndola (conteo/ajuste hoy; "total en góndola" al recibir, en F1b).
--
-- Aditiva. No toca ventas, cobros ni el corte del día.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1 · La vista: ÚNICO choke point
--
-- De `low_stock_products` comen el push de las 09:00 (store_alerts), el
-- dashboard (bloque de stock bajo + "Para reponer") y el contador de los chips
-- de categorías. Filtrando acá, los tres quedan honestos con un solo cambio y
-- no pueden desincronizarse entre sí.
--
-- Definición IDÉNTICA a la de 001 salvo la condición nueva.
-- ---------------------------------------------------------------------------
create or replace view public.low_stock_products with (security_invoker = true) as
  select p.id, p.store_id, p.name, p.emoji, p.stock,
         coalesce(p.low_stock_threshold, s.low_stock_threshold_default, 3) as threshold
    from public.products p
    left join public.store_settings s on s.store_id = p.store_id
   where p.status = 'active'
     -- Sin baseline no hay alerta posible: el número que compararíamos contra el
     -- umbral no lo respalda nadie. No es que el producto esté bien; es que no
     -- sabemos, y decir "te quedaste sin nada" sería inventar.
     and p.stock_confiable
     and p.stock <= coalesce(p.low_stock_threshold, s.low_stock_threshold_default, 3);

-- ---------------------------------------------------------------------------
-- 2 · categorias_resumen: el bucket visible de la puesta en marcha
--
-- Mismo criterio que "Sin categoría (N)": la deuda se MUESTRA, no se esconde.
-- Cuerpo idéntico al de 036 + el contador `sin_control_stock`.
-- ---------------------------------------------------------------------------
create or replace function public.categorias_resumen(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_desde timestamptz := now() - interval '14 days';
  v_cats  jsonb;
  v_sin   jsonb;
  v_ctrl  jsonb;
begin
  perform public.rpc_member(p_store_id);   -- gate → not_a_member

  with prod as (
    select p.category_id,
           count(*) as productos,
           count(*) filter (where p.cost is null) as sin_costo
      from public.products p
     where p.store_id = p_store_id and p.status = 'active'
     group by p.category_id
  ),
  bajo as (
    select p.category_id, count(*) as stock_bajo
      from public.low_stock_products l
      join public.products p on p.id = l.id
     where l.store_id = p_store_id
     group by p.category_id
  ),
  uso as (
    select p.category_id, sum(i.qty) as vendidas
      from public.sale_items i
      join public.sales s   on s.id = i.sale_id
      join public.products p on p.id = i.product_id
     where s.store_id = p_store_id
       and s.status = 'completed'
       and s.sold_at >= v_desde
     group by p.category_id
  )
  select
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
          select id, name, emoji, color, sort
            from public.categories
           where store_id = p_store_id and status = 'active'
           order by sort, name
           limit 100
        ) c
        left join prod pr on pr.category_id = c.id
        left join bajo b  on b.category_id  = c.id
        left join uso u   on u.category_id  = c.id
    ), '[]'::jsonb),
    jsonb_build_object(
      'productos',  coalesce((select productos  from prod where category_id is null), 0),
      'stock_bajo', coalesce((select stock_bajo from bajo where category_id is null), 0),
      'sin_costo',  coalesce((select sin_costo  from prod where category_id is null), 0)
    ),
    -- Puesta en marcha: cuántos productos se venden pero todavía no tienen
    -- control de stock. Es el contador que evita que apagar alertas se vuelva
    -- un agujero silencioso.
    jsonb_build_object(
      'productos', (select count(*) from public.products
                     where store_id = p_store_id and status = 'active'
                       and not stock_confiable)
    )
    into v_cats, v_sin, v_ctrl;

  return jsonb_build_object('categorias', v_cats, 'sin_categoria', v_sin,
                            'sin_control_stock', v_ctrl);
end;
$$;

grant execute on function public.categorias_resumen(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3 · productos_buscar: filtro y bandera por fila
--
-- El catálogo ya no viaja al cliente (escala Fase 2), así que "mostrame los que
-- no tienen control de stock" tiene que resolverse en la base. Cuerpo idéntico
-- al de 036 + el filtro `p_solo_sin_control` y `stock_confiable` en cada ítem
-- (para el badge de la fila).
-- ---------------------------------------------------------------------------
drop function if exists public.productos_buscar(uuid, text, uuid, int, int, boolean);

create or replace function public.productos_buscar(
  p_store_id           uuid,
  p_q                  text default null,
  p_categoria          uuid default null,
  p_limit              int  default 50,
  p_offset             int  default 0,
  p_solo_sin_categoria boolean default false,  -- el bucket "Sin categoría" como filtro
  p_solo_sin_control   boolean default false   -- el bucket "Sin control de stock"
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
           p.low_stock_threshold, p.category_id, p.stock_confiable,
           c.name as category_name
      from public.products p
      left join public.categories c on c.id = p.category_id
     where p.store_id = p_store_id
       and p.status = 'active'
       and (case
              when p_solo_sin_categoria then p.category_id is null
              else (p_categoria is null or p.category_id = p_categoria)
            end)
       and (not p_solo_sin_control or not p.stock_confiable)
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
           'stock_confiable', p.stock_confiable,
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

grant execute on function public.productos_buscar(uuid, text, uuid, int, int, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2.b · producto_por_codigo: el resolver del escaneo también lleva la bandera
--
-- Un producto escaneado va al carrito con su ficha; si no lleva el flag, la
-- pantalla tendría que adivinar. Cuerpo idéntico al de 034 + `stock_confiable`.
-- ---------------------------------------------------------------------------
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
           'stock_confiable', p.stock_confiable,
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

-- ---------------------------------------------------------------------------
-- 3.a · pos_destacados: el tile del mostrador también tiene que decir la verdad
--
-- Un producto recién dado de alta queda en 0 y la grilla lo pinta "sin stock" en
-- rojo — al cajero que lo acaba de vender le dice que no existe. Cuerpo idéntico
-- al de 035 + `stock_confiable` en cada tile.
-- ---------------------------------------------------------------------------
create or replace function public.pos_destacados(p_store_id uuid, p_limit int default 24)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit int;
  v_desde timestamptz := now() - interval '14 days';
  v_res   jsonb;
begin
  perform public.rpc_member(p_store_id);

  v_limit := least(greatest(coalesce(p_limit, 24), 1), 60);

  with ritmo as (
    select i.product_id, sum(i.qty) as vendidas
      from public.sale_items i
      join public.sales s on s.id = i.sale_id
     where s.store_id = p_store_id
       and s.status = 'completed'
       and s.sold_at >= v_desde
     group by i.product_id
  ),
  top as (
    select p.id, p.name, p.emoji, p.color, p.price, p.stock, p.stock_confiable,
           p.category_id, c.name as category_name,
           coalesce(r.vendidas, 0) as vendidas_14d
      from public.products p
      left join public.categories c on c.id = p.category_id
      left join ritmo r on r.product_id = p.id
     where p.store_id = p_store_id
       and p.status = 'active'
       -- Fallback para el kiosco nuevo: si no vendió nada todavía, al menos que
       -- los tiles muestren lo que tiene precio y stock.
       and (coalesce(r.vendidas, 0) > 0 or (p.price > 0 and p.stock > 0))
     order by coalesce(r.vendidas, 0) desc, p.name
     limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'name', t.name, 'emoji', t.emoji, 'color', t.color,
           'price', t.price, 'stock', t.stock,
           'stock_confiable', t.stock_confiable,
           'category_id', t.category_id, 'category_name', t.category_name,
           'vendidas_14d', t.vendidas_14d,
           'barcodes', coalesce(
             (select jsonb_agg(b.barcode order by b.barcode)
                from public.product_barcodes b
               where b.store_id = p_store_id and b.product_id = t.id),
             '[]'::jsonb)
         ) order by t.vendidas_14d desc, t.name), '[]'::jsonb)
    into v_res
    from top t;

  return v_res;
end;
$$;

grant execute on function public.pos_destacados(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3.b · Contar la góndola: el camino de salida del modo
--
-- `adjust_stock` pide un DELTA ("+10"), que sobre un stock que nadie respalda no
-- significa nada. Al contar se declara un TOTAL y el sistema saca la diferencia.
--
-- El caso que obliga a que esto sea una función y no un ajuste común: si contás
-- y da EXACTAMENTE lo que decía el sistema, el delta es 0 y el ledger lo rechaza
-- (`invalid_delta`, y está bien: no hubo movimiento). Pero contar sí pasó, y sin
-- esto ese producto no podría graduar NUNCA — un agujero permanente en la única
-- salida del modo puesta en marcha.
-- ---------------------------------------------------------------------------
create or replace function public.marcar_stock_contado(
  p_store_id   uuid,
  p_product_id uuid,
  p_total      numeric
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_stock  numeric(12,3);
  v_delta  numeric(12,3);
begin
  v_member := public.rpc_member(p_store_id);

  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;
  if p_total is null or p_total < 0 then
    raise exception 'total_invalido';
  end if;

  select stock into v_stock from public.products
   where id = p_product_id and store_id = p_store_id for update;
  if not found then
    raise exception 'product_not_found';
  end if;

  v_delta := p_total - v_stock;

  if v_delta <> 0 then
    -- El asiento gradúa solo, por el trigger de 037.
    insert into public.stock_ledger (store_id, product_id, delta, reason, note, created_by)
    values (p_store_id, p_product_id, v_delta, 'adjust', 'conteo de góndola', v_member.id);
  else
    -- Coincidió: no hay movimiento que asentar, pero el conteo ocurrió.
    update public.products set stock_confiable = true
     where id = p_product_id and store_id = p_store_id;
  end if;

  select stock into v_stock from public.products where id = p_product_id;
  return v_stock;
end $$;

revoke execute on function public.marcar_stock_contado(uuid, uuid, numeric) from public;
grant execute on function public.marcar_stock_contado(uuid, uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 4 · reportes_summary: el stock muerto no valúa lo que nadie contó
--
-- Es la única señal de stock que NO pasa por la vista, así que necesita su
-- propia guarda. El caso real: el producto nace en 0, recibe 30 por un ingreso
-- (que no gradúa, ver 037) y a los 30 días sin ventas el reporte diría "tenés
-- $27.000 parados" — cuando en la góndola hay "lo que ya había + 30".
--
-- Cuerpo copiado EXACTO de 034 con un solo cambio quirúrgico: `and
-- p.stock_confiable` en el subselect de stock muerto (verificado con diff).
-- ---------------------------------------------------------------------------
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
         -- Sin baseline de gondola no hay plata parada que valuar: el stock seria un
         -- delta sobre una base desconocida (docs H.5). Valuarlo es inventar un numero.
         and p.stock_confiable
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
