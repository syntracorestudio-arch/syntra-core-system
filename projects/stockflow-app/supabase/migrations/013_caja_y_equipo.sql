-- =============================================================================
-- StockFlow — 013_caja_y_equipo.sql
--
-- Cierra los tres huecos que quedaban del MVP definido en el PRD:
--   · anular una venta (la RPC existía desde 1C, sin pantalla que la usara)
--   · cierre de caja del día (journey del PRD, vista lista, sin pantalla)
--   · alta de empleados (add_member existía, sin pantalla)
--
-- Los dos primeros viven juntos porque son el MISMO momento: el kiosquero cierra
-- el día, repasa lo que vendió y ahí corrige lo que esté mal.
-- =============================================================================

-- =============================================================================
-- cierre_caja — cuánto entró hoy y en qué, más el detalle para revisar.
--
-- El día se corta en la timezone DEL NEGOCIO, no del servidor: un kiosco que
-- cierra a las 2 AM no puede ver su noche partida en dos días.
--
-- Distingue FACTURADO de ENTRÓ EN CAJA, igual que el Resumen: fiar es vender
-- sin cobrar, y el kiosquero necesita saber cuánto debería haber en el cajón.
-- =============================================================================
create or replace function public.cierre_caja(
  p_store_id uuid,
  p_fecha    date default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz      text;
  v_dia     date;
  v_medios  jsonb;
  v_ventas  jsonb;
  v_total   numeric(12,2);
  v_fiado   numeric(12,2);
  v_cobros  numeric(12,2);
  v_efectivo numeric(12,2);
  v_anuladas integer;
begin
  perform public.rpc_member(p_store_id);

  select timezone into v_tz from public.stores where id = p_store_id;
  v_tz := coalesce(v_tz, 'America/Argentina/Buenos_Aires');
  v_dia := coalesce(p_fecha, (now() at time zone v_tz)::date);

  select coalesce(sum(total) filter (where status = 'completed'), 0),
         coalesce(sum(total) filter (where status = 'completed' and payment_method = 'account'), 0),
         count(*) filter (where status = 'voided')
    into v_total, v_fiado, v_anuladas
    from public.sales
   where store_id = p_store_id
     and (sold_at at time zone v_tz)::date = v_dia;

  select coalesce(sum(delta), 0) into v_cobros
    from public.client_ledger
   where store_id = p_store_id and reason = 'payment'
     and (created_at at time zone v_tz)::date = v_dia;

  -- Medios de COBRO reales: el fiado no es un medio de pago (nadie pagó), y los
  -- cobros de deudas viejas suman al medio en que se cobraron.
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
             and (sold_at at time zone v_tz)::date = v_dia
           group by payment_method
          union all
          select payment_method, sum(delta), count(*)
            from public.client_ledger
           where store_id = p_store_id and reason = 'payment'
             and payment_method is not null
             and (created_at at time zone v_tz)::date = v_dia
           group by payment_method
        ) u
       group by metodo
    ) m;

  -- Efectivo esperado en el cajón: ventas en efectivo + cobros de fiado en
  -- efectivo. Es contra este número que el kiosquero cuenta la plata.
  select coalesce(sum(total), 0) into v_efectivo
    from (
      select sum(total) as total from public.sales
       where store_id = p_store_id and status = 'completed'
         and payment_method = 'cash'
         and (sold_at at time zone v_tz)::date = v_dia
      union all
      select sum(delta) from public.client_ledger
       where store_id = p_store_id and reason = 'payment' and payment_method = 'cash'
         and (created_at at time zone v_tz)::date = v_dia
    ) e;

  -- Detalle del día para poder revisar y anular. Cota dura: 300 ventas es más de
  -- lo que hace un kiosco en un día; si las supera, se pagina.
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
         and (s.sold_at at time zone v_tz)::date = v_dia
       order by s.sold_at desc
       limit 300
    ) v;

  return jsonb_build_object(
    'fecha', v_dia,
    'facturado', v_total,
    'entro_en_caja', v_total - v_fiado + v_cobros,
    'fiado', v_fiado,
    'cobros_fiado', v_cobros,
    'efectivo_esperado', v_efectivo,
    'anuladas', v_anuladas,
    'by_method', v_medios,
    'ventas', v_ventas
  );
end;
$$;

grant execute on function public.cierre_caja(uuid, date) to authenticated;

-- =============================================================================
-- equipo_del_negocio — los miembros con sus permisos, para la pantalla de equipo.
-- Incluye el email, que vive en auth.users y no es accesible por RLS directa.
-- =============================================================================
create or replace function public.equipo_del_negocio(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_caller public.members;
begin
  v_caller := public.rpc_member(p_store_id);
  if v_caller.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', m.id, 'nombre', m.display_name, 'rol', m.role,
             'email', u.email, 'estado', m.status,
             'puede_fiar', m.can_sell_on_credit,
             'puede_descuento', m.can_apply_discount,
             'puede_anular', m.can_void_sale,
             'puede_recibir', m.can_receive_stock,
             've_costos', m.can_see_costs,
             'desde', m.created_at
           ) order by m.role, m.created_at), '[]'::jsonb)
      from public.members m
      join auth.users u on u.id = m.profile_id
     where m.store_id = p_store_id
  );
end;
$$;

grant execute on function public.equipo_del_negocio(uuid) to authenticated;

-- =============================================================================
-- actualizar_permisos — el dueño ajusta qué puede hacer cada empleado.
-- El rol NO se cambia acá: promover a alguien a dueño es una decisión de otra
-- naturaleza y hoy el modelo asume un solo owner por negocio.
-- =============================================================================
create or replace function public.actualizar_permisos(
  p_store_id  uuid,
  p_member_id uuid,
  p_fiar      boolean,
  p_descuento boolean,
  p_anular    boolean,
  p_recibir   boolean,
  p_costos    boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller public.members;
  v_objetivo public.members;
begin
  v_caller := public.rpc_member(p_store_id);
  if v_caller.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  select * into v_objetivo from public.members
   where id = p_member_id and store_id = p_store_id;
  if not found then
    raise exception 'member_not_found';
  end if;

  -- Un dueño no puede recortarse permisos a sí mismo y quedar sin poder operar
  -- su propio negocio.
  if v_objetivo.role = 'owner' then
    raise exception 'not_allowed';
  end if;

  update public.members
     set can_sell_on_credit = p_fiar,
         can_apply_discount = p_descuento,
         can_void_sale      = p_anular,
         can_receive_stock  = p_recibir,
         can_see_costs      = p_costos
   where id = p_member_id;
end;
$$;

grant execute on function public.actualizar_permisos(uuid, uuid, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- =============================================================================
-- cambiar_estado_miembro — dar de baja a un empleado que se fue.
-- No se borra: sus ventas tienen que seguir contando su historia.
-- =============================================================================
create or replace function public.cambiar_estado_miembro(
  p_store_id  uuid,
  p_member_id uuid,
  p_estado    text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller public.members;
begin
  v_caller := public.rpc_member(p_store_id);
  if v_caller.role <> 'owner' then
    raise exception 'not_allowed';
  end if;
  if p_estado not in ('active', 'inactive') then
    raise exception 'invalid_status';
  end if;
  if p_member_id = v_caller.id then
    raise exception 'not_allowed';  -- no darse de baja a uno mismo
  end if;

  update public.members set status = p_estado
   where id = p_member_id and store_id = p_store_id and role <> 'owner';
end;
$$;

grant execute on function public.cambiar_estado_miembro(uuid, uuid, text) to authenticated;