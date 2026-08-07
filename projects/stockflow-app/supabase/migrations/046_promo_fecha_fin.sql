-- StockFlow — Migración 046: la fecha de fin viaja con la promo
--
-- Cierra un hueco que se vio recién al diseñar la pantalla: el cajero puede
-- decir "está en promo", pero no HASTA CUÁNDO. Sin la fecha, la frase es una
-- excusa; con la fecha ("en promo hasta el vie 14") es una explicación que el
-- cliente acepta y el cajero no tiene que interpretar.
--
-- Costo real: una clave más sobre la MISMA llamada a promo_vigente() que las
-- tres RPCs ya hacían. Cero queries nuevas.
--
-- Cuerpos idénticos a los de 045 + 'promo_ends_on'. Se recrean enteras porque es
-- como este repo versiona RPCs (027 copió 023, 038 copió 035): el archivo de la
-- migración es la definición completa y vigente, no un parche.

create or replace function public.productos_buscar(
  p_store_id           uuid,
  p_q                  text default null,
  p_categoria          uuid default null,
  p_limit              int  default 50,
  p_offset             int  default 0,
  p_solo_sin_categoria boolean default false,
  p_solo_sin_control   boolean default false
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
           -- 045 · precio EFECTIVO; list_price/promo_id sólo si hay promo.
           'price', coalesce((public.promo_vigente(p_store_id, p.id)).promo_price, p.price),
           'list_price', (public.promo_vigente(p_store_id, p.id)).list_price,
           'promo_id',   (public.promo_vigente(p_store_id, p.id)).id,
           'promo_ends_on', (public.promo_vigente(p_store_id, p.id)).ends_on,
           'cost', p.cost, 'stock', p.stock,
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
           -- 045 · el escaneo trae el precio de promo YA resuelto, siempre fresco.
           'price', coalesce((public.promo_vigente(p_store_id, p.id)).promo_price, p.price),
           'list_price', (public.promo_vigente(p_store_id, p.id)).list_price,
           'promo_id',   (public.promo_vigente(p_store_id, p.id)).id,
           'promo_ends_on', (public.promo_vigente(p_store_id, p.id)).ends_on,
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
           -- 045 · el tile dice el precio que la caja va a cobrar.
           'price', coalesce((public.promo_vigente(p_store_id, t.id)).promo_price, t.price),
           'list_price', (public.promo_vigente(p_store_id, t.id)).list_price,
           'promo_id',   (public.promo_vigente(p_store_id, t.id)).id,
           'promo_ends_on', (public.promo_vigente(p_store_id, t.id)).ends_on,
           'stock', t.stock,
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
