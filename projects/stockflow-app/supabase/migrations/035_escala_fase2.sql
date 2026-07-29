-- =============================================================================
-- StockFlow — 035_escala_fase2.sql  (Escala Fase 2: search-first — el catálogo
-- deja de viajar al cliente)
--
-- Fuente: `docs/inventario-escala-audit.md`. El objetivo es el PAYLOAD, medido con
-- el seed de 2005 productos:
--   · POS        → 477 KB de documento (500 productos + ~5000 sale_items para
--                  rankear en el cliente + ~1750 códigos + ~300 clientes), 500 tiles
--                  en el DOM, 2678 nodos.
--   · Productos  → 772 KB de documento (500 productos + ~8000 sale_items).
--
-- Esta migración mueve BÚSQUEDA, FILTRO y RANKING a Postgres:
--   1) productos_buscar  — una página de resultados, por nombre o por código.
--   2) pos_destacados    — el set chico y ya rankeado que la caja pinta como tiles.
--   3) clientes_buscar   — el fiado deja de precargar ~300 clientes.
--
-- Índices: NO se crea ninguno. Los dos que hacen falta ya existen desde 001:
--   · products_name_idx (store_id, lower(name)) where status='active'   (001:124)
--   · product_barcodes unique (store_id, barcode)                        (001:136)
--
-- NO toca `sales`, `sale_payments`, `payment_intents` ni ninguna RPC de cobro.
-- NO cambia el corte del día (las ventanas de fecha son las mismas que ya se usaban).
-- Aditiva e idempotente (create or replace). Aplicar DESPUÉS de 034.
-- NUMERACIÓN: 030-033 reservadas por la branch de pagos parkeada; 034 = Fase 1.
-- La corre el owner.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) productos_buscar — búsqueda + filtro + paginación server-side.
--
-- Semántica (deliberada, define qué índice sirve):
--   · nombre: CONTIENE, insensible a mayúsculas y ACENTOS (`unaccent_simple`).
--     Mantiene el comportamiento que ya tenía el filtro en memoria (`includes`) y
--     de paso arregla que era sensible a acentos ("limon" no encontraba "Limón").
--     Un like '%…%' no usa índice, pero el scan queda acotado al catálogo de UN
--     negocio (~10³ filas) — barato. Si algún día no alcanza: pg_trgm (Fase 4).
--   · código: EMPIEZA CON, que sí usa el índice único de barcodes. Es lo que hace
--     un cajero cuando tipea un código. El escaneo exacto va por producto_por_codigo.
-- -----------------------------------------------------------------------------
create or replace function public.productos_buscar(
  p_store_id  uuid,
  p_q         text default null,
  p_categoria uuid default null,
  p_limit     int  default 50,
  p_offset    int  default 0
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
  perform public.rpc_member(p_store_id);   -- gate → not_a_member

  -- Cotas DURAS: pase lo que pase por el parámetro, la página tiene techo.
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
       and (p_categoria is null or p.category_id = p_categoria)
       and (
         v_q is null
         or public.unaccent_simple(p.name) like '%' || public.unaccent_simple(v_q) || '%'
         or exists (
           select 1 from public.product_barcodes b
            where b.store_id = p_store_id
              and b.product_id = p.id
              and b.barcode like v_q || '%'      -- prefijo: usa el índice único
         )
       )
  ),
  -- Ritmo de venta de 14 días SOLO de los productos que pasaron el filtro.
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
           -- Ritmo de 30 días para la cobertura del listado del dueño ("te dura 6
           -- días"). Se calcula SOLO sobre la página ya recortada (≤100 filas), no
           -- sobre todo el filtro: el orden lo define la ventana de 14d de arriba.
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

grant execute on function public.productos_buscar(uuid, text, uuid, int, int) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) pos_destacados — los tiles curados de la caja, RANKEADOS EN LA BASE.
--
-- Reemplaza el precargado de 500 productos + ~5000 sale_items: el ranking por
-- ventas de 14 días se calcula acá y viaja un set chico. Cada tile trae SUS códigos
-- para que escanear un top-seller siga siendo instantáneo (cobro <15 s intacto);
-- todo lo demás lo resuelve `producto_por_codigo` (Fase 1, sin tocar).
--
-- Fallback: un kiosco NUEVO (sin ventas) no puede ver una grilla vacía → cae a los
-- productos con precio y stock, alfabético.
-- -----------------------------------------------------------------------------
create or replace function public.pos_destacados(
  p_store_id uuid,
  p_limit    int default 24
) returns jsonb
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
    select p.id, p.name, p.emoji, p.color, p.price, p.stock,
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

-- -----------------------------------------------------------------------------
-- 3) clientes_buscar — el fiado deja de precargar ~300 clientes.
--    La lista se pide recién cuando el cajero elige "Fiado".
-- -----------------------------------------------------------------------------
create or replace function public.clientes_buscar(
  p_store_id uuid,
  p_q        text default null,
  p_limit    int  default 20
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit int;
  v_q     text;
  v_res   jsonb;
begin
  perform public.rpc_member(p_store_id);

  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_q     := nullif(btrim(coalesce(p_q, '')), '');

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.client_id, 'name', t.name,
           'owed', greatest(0, -t.balance),
           'credit_limit', t.credit_limit
         ) order by t.name), '[]'::jsonb)
    into v_res
    from (
      select cb.client_id, cb.name, cb.balance, cb.credit_limit
        from public.client_balances cb
       where cb.store_id = p_store_id
         and (v_q is null
              or public.unaccent_simple(cb.name) like '%' || public.unaccent_simple(v_q) || '%')
       order by cb.name
       limit v_limit
    ) t;

  return v_res;
end;
$$;

grant execute on function public.clientes_buscar(uuid, text, int) to authenticated;