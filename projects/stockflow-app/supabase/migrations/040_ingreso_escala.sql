-- =============================================================================
-- 040 · RECIBIR MERCADERÍA A ESCALA (F3)
--
-- "Recibir mercadería" quedó como la última pantalla con el precargado viejo:
-- 500 productos alfabéticos + 2000 códigos + 3000 asientos de ledger por request.
-- Con 2000 SKUs eso significa que ~75% del catálogo es INALCANZABLE para recibir
-- — y con él, el conteo de góndola de F1b, que vive justo en esa pantalla.
--
-- Además resolvía el escaneo contra un mapa en memoria armado con esos 2000
-- códigos truncados: un código que existía podía "no existir" según el orden en
-- que Postgres devolviera las filas. Es la misma clase de bug que el POS cerró
-- en la Fase 1 de escala, y acá duele igual: sumarle mercadería al producto
-- equivocado parte el stock de dos fichas y ninguna refleja la góndola.
--
-- `ingreso_buscar` reemplaza los tres precargados por una consulta acotada que
-- trae exactamente lo que la línea necesita — incluido el costo de la última
-- compra, que es el radar de inflación en el punto donde entra el dato.
--
-- Aditiva. No toca ventas, cobros ni el corte del día.
-- =============================================================================

create or replace function public.ingreso_buscar(
  p_store_id uuid,
  p_q        text,
  p_limit    int     default 8,
  p_exacto   boolean default false   -- true = solo código completo (escaneo)
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit int;
  v_q     text;
  v_items jsonb;
begin
  perform public.rpc_member(p_store_id);   -- gate → not_a_member

  -- Tope duro: esta consulta alimenta un buscador que dispara con cada tecla.
  v_limit := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_q     := nullif(btrim(coalesce(p_q, '')), '');

  if v_q is null then
    return jsonb_build_object('items', '[]'::jsonb, 'limit', v_limit);
  end if;

  with candidatos as (
    select p.id, p.name, p.emoji, p.price, p.cost, p.stock, p.stock_confiable,
           (p.status <> 'active') as archivado
      from public.products p
     where p.store_id = p_store_id
       and (
         case when p_exacto then
           -- ESCANEO: únicamente el código completo. Ni prefijo ni nombre — un
           -- parecido acá le suma la mercadería al producto equivocado.
           exists (select 1 from public.product_barcodes b
                    where b.store_id = p_store_id
                      and b.product_id = p.id
                      and b.barcode = v_q)
         else
           -- TIPEADO: nombre sin acentos o código por prefijo (mismo criterio
           -- que el buscador de Productos, para que no haya dos "buscar").
           p.status = 'active'
           and (
             public.unaccent_simple(p.name) like '%' || public.unaccent_simple(v_q) || '%'
             or exists (select 1 from public.product_barcodes b
                         where b.store_id = p_store_id
                           and b.product_id = p.id
                           and b.barcode like v_q || '%')
           )
         end
       )
     order by p.name
     limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'name', c.name,
           'emoji', c.emoji,
           'price', c.price,
           'cost', c.cost,
           'stock', c.stock,
           'stock_confiable', c.stock_confiable,
           'archivado', c.archivado,
           'barcodes', coalesce(
             (select jsonb_agg(b.barcode order by b.barcode)
                from public.product_barcodes b
               where b.store_id = p_store_id and b.product_id = c.id),
             '[]'::jsonb),
           /* Radar de inflación: lo que pagaste la vez pasada por esta misma
              cosa. Incluye `initial` a propósito — desde 037 la carga inicial
              congela su costo justamente para no ser invisible acá.
              Va por `stock_ledger_costos_idx`, que existe desde 015. */
           'ultima_compra', (
             select jsonb_build_object('costo', l.unit_cost, 'fecha', l.created_at)
               from public.stock_ledger l
              where l.product_id = c.id
                and l.reason in ('purchase', 'initial')
                and l.unit_cost is not null
              /* Desempate DETERMINISTA: dos asientos del mismo instante (misma
                 transacción) empataban y el "último costo" salía al azar. Ante
                 empate manda la compra: la carga inicial es el punto de partida,
                 una compra del mismo momento es información más nueva. */
              order by l.created_at desc, (l.reason = 'purchase') desc, l.id desc
              limit 1)
         ) order by c.name), '[]'::jsonb)
    into v_items
    from candidatos c;

  return jsonb_build_object('items', v_items, 'limit', v_limit);
end;
$$;

revoke execute on function public.ingreso_buscar(uuid, text, int, boolean) from public;
grant execute on function public.ingreso_buscar(uuid, text, int, boolean) to authenticated;