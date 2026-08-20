-- ===========================================================================
-- 070 · Vencimientos — la plata en pantalla y la merma que no miente
--
-- Tres cosas, y las tres son precondición de la UI:
--   1. la vista trae el valor en venta del lote (hoy no hay un solo peso);
--   2. `resolve_expiry` acepta merma PARCIAL sin cerrar el lote;
--   3. la cota `waste_qty <= qty`, que hoy no existe.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · pending_expiries + valor en venta
--
-- POR QUÉ `price` Y NUNCA `cost`. La 051 revocó el SELECT de tabla en
-- `products` y lo re-otorgó por lista de columnas: `price` está, `cost` NO.
-- Esta vista es `security_invoker`, así que corre con los permisos de quien
-- consulta: meter `p.cost` haría que la consulta ENTERA falle con
-- `permission denied` para cualquier empleado. La sección no se degradaría —
-- se rompería del todo, y el síntoma (pantalla en blanco para el cajero) no
-- se parece en nada a la causa.
--
-- QUÉ SIGNIFICA EL NÚMERO, con precisión. `qty * price` es lo que ese lote
-- DEJA DE VENDERSE, no lo que se pierde: si se tira, lo que se pierde es el
-- COSTO. El número está bien elegido —motiva, y es seguro para el staff— pero
-- la UI tiene que etiquetarlo como "en venta" / "en riesgo" y jamás como
-- "perdés $X". Misma regla de honestidad que se aplicó a la ganancia neta y al
-- stock.
-- ---------------------------------------------------------------------------
create or replace view public.pending_expiries with (security_invoker = true) as
  select e.id,
         e.store_id,
         e.product_id,
         p.name  as product_name,
         p.emoji as product_emoji,
         e.expiry_date,
         e.qty,
         (e.expiry_date - current_date) as days_left,
         p.price,
         /* Se calcula acá y no en el cliente para poder ORDENAR y SUMAR en
            SQL: el arquetipo de la pantalla es "cola ordenada por plata en
            juego", y ordenar en memoria sólo funciona mientras la lista entre
            entera en la página. */
         (e.qty * p.price)::numeric(12,2) as valor_venta
    from public.stock_expiries e
    join public.products p on p.id = e.product_id
   where e.resolved_at is null;

grant select on public.pending_expiries to authenticated;

-- ---------------------------------------------------------------------------
-- 2 · resolve_expiry — merma parcial, y la cota que faltaba
--
-- EL PROBLEMA QUE RESUELVE. Vencen 6 yogures, se vendieron 4 y tiraste 2. Hoy
-- el dueño elige entre dos datos FALSOS:
--
--   · "Se vendió"        → la pérdida de 2 nunca se registra, y el motor de
--                          promos decide con datos inflados;
--   · "Tuve que tirarlo" → asiento de -6, el stock queda 4 corto y la app
--                          empieza a avisar faltante de algo que está en la
--                          góndola.
--
-- La función YA aceptaba `p_waste_qty` desde 006, pero cerraba el lote entero
-- igual, así que el parcial no era representable ni aunque la UI lo mandara.
--
-- LA REGLA NUEVA, y depende de si el lote venció:
--
--   · Lote VENCIDO y merma parcial → el resto se cierra como 'sold'. Nunca se
--     deja medio lote vencido colgado: reaparece mañana como alerta muerta, y
--     el día que el dueño empieza a ignorar la lista, la sección dejó de
--     funcionar.
--   · Lote POR VENCER y merma parcial → el lote SIGUE ABIERTO con `qty`
--     decrementada y su fecha original. Se rompió un paquete o se cortó la
--     cadena de frío; las otras 4 siguen en venta y siguen necesitando su
--     alerta.
--
-- La cota `p_waste_qty <= qty` no existía: un tipeo de 60 en un lote de 6
-- metía -60 irreversibles en un ledger append-only (`001:538` revoca update y
-- delete). Es la clase de error que no se puede arreglar después, sólo
-- compensar — y un asiento compensatorio ensucia el reporte de mermas para
-- siempre.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_expiry(
  p_store_id   uuid,
  p_expiry_id  uuid,
  p_resolution text,
  p_waste_qty  numeric default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member  public.members;
  v_exp     public.stock_expiries;
  v_qty     numeric(12,3);
  v_cost    numeric(12,2);
  v_promos  int := 0;
  v_parcial boolean := false;
  v_vencido boolean;
begin
  v_member := public.rpc_member(p_store_id);

  /* Mismo permiso que anotar una fecha (`addExpiry` se alinea a esto en la
     misma tanda). Antes había una INVERSIÓN del gradiente de riesgo: anotar
     una fecha —un INSERT sin consecuencia— exigía ser dueño, mientras que
     escribir una pérdida irreversible bastaba con `can_receive_stock`. */
  if not (v_member.role = 'owner' or v_member.can_receive_stock) then
    raise exception 'not_allowed';
  end if;
  if p_resolution not in ('sold','wasted') then
    raise exception 'invalid_resolution';
  end if;

  select * into v_exp from public.stock_expiries
   where id = p_expiry_id and store_id = p_store_id
   for update;
  if not found then
    raise exception 'expiry_not_found';
  end if;

  if v_exp.resolved_at is not null then
    return jsonb_build_object('already_resolved', true);
  end if;

  v_vencido := v_exp.expiry_date < current_date;

  if p_resolution = 'wasted' then
    v_qty := coalesce(p_waste_qty, v_exp.qty);

    if v_qty <= 0 then
      raise exception 'waste_qty_invalida';
    end if;
    /* LA COTA QUE FALTABA, y va en el SERVIDOR porque el input se puede
       saltear: un tipeo de 60 en un lote de 6 metía -60 irreversibles en un
       ledger append-only (001:538 revoca update y delete). Ese error no se
       arregla, sólo se compensa — y el asiento compensatorio ensucia el
       reporte de mermas para siempre. */
    if v_qty > v_exp.qty then
      raise exception 'waste_qty_excede_lote';
    end if;

    v_parcial := v_qty < v_exp.qty;

    /* `unit_cost` viene de 008 y NO se toca: sin él, el reporte de pérdidas
       muestra unidades sin plata. Es owner-only por GRANT en la lectura, pero
       escribirlo acá corre como definer. */
    select cost into v_cost from public.products where id = v_exp.product_id;
    insert into public.stock_ledger (store_id, product_id, delta, reason, unit_cost,
                                     note, created_by)
    values (p_store_id, v_exp.product_id, -v_qty, 'waste', v_cost,
            format('vencido %s', v_exp.expiry_date), v_member.id);
  end if;

  /* PARCIAL SOBRE UN LOTE QUE TODAVÍA NO VENCIÓ ⇒ el lote sigue vivo.
     Se rompió un paquete o se cortó la cadena de frío; las otras unidades
     siguen en venta y siguen necesitando su alerta. Es el ÚNICO camino que no
     cierra el lote, y por eso tampoco cierra la promo: todavía queda
     mercadería que liquidar. */
  if v_parcial and not v_vencido then
    update public.stock_expiries
       set qty = qty - v_qty
     where id = p_expiry_id;

    return jsonb_build_object('already_resolved', false,
                              'resolution', 'wasted_parcial',
                              'restante', (v_exp.qty - v_qty),
                              'promos_terminadas', 0);
  end if;

  /* Parcial sobre un lote VENCIDO: lo tirado quedó asentado arriba y el resto
     se da por cerrado. Nunca se deja medio lote vencido colgado — reaparece
     mañana como alerta muerta, y el día que el dueño empieza a ignorar la
     lista, la sección dejó de funcionar. */
  update public.stock_expiries
     set resolved_at = now(), resolution = p_resolution
   where id = p_expiry_id;

  -- 045 · el vencimiento se resolvió ⇒ la promo que lo liquidaba ya no tiene
  -- razón de existir.
  with cerradas as (
    update public.promos
       set ended_at = now(), ended_reason = 'vencimiento'
     where store_id  = p_store_id
       and expiry_id = p_expiry_id
       and ended_at is null
    returning 1
  )
  select count(*) into v_promos from cerradas;

  return jsonb_build_object('already_resolved', false,
                            'resolution', p_resolution,
                            'parcial', v_parcial,
                            'restante', 0,
                            'promos_terminadas', v_promos);
end;
$$;
