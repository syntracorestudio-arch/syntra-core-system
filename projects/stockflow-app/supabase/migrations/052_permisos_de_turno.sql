-- ===========================================================================
-- 052 · Permisos de turno — cerrar la caja y ver qué se vende, SIN ver la plata
--
-- Auditoría: docs/permisos-audit.md §D (fase 3). Contratos: docs/rpc-contracts.md.
--
-- La 051 cerró las fugas y dejó `cierre_caja` y `reportes_summary` owner-only.
-- Eso era correcto por defecto, pero deja afuera dos cosas que en un kiosco
-- real hace el empleado:
--
--   · CERRAR EL TURNO. El del turno noche cierra; el dueño no está. Hoy no
--     puede, porque "cerrar" y "ver la recaudación" viajaban en el mismo jsonb.
--   · SABER QUÉ SE ESTÁ POR ACABAR. Es reposición, o sea su trabajo.
--
-- LA CONDICIÓN DURA DEL OWNER: el permiso no sirve si otorgarlo entrega el
-- margen. Por eso acá no se abre nada: se PARTE el payload. Un empleado que
-- cierra la caja no puede ver ganancia ni margen, y si esa partición no
-- saliera limpia, el flag no se shipea.
--
-- Dos flags, no seis. Se evaluaron y se DESCARTARON explícitamente:
-- `can_see_promos` (ya lo cubre la lectura de promos), `can_load_expiries` y
-- `can_count_stock` (los cubre `can_receive_stock`, que ya significa "esta
-- persona maneja la mercadería"), y registrar gastos (queda del dueño: es la
-- única forma de sacar plata sin dejar anomalía). Un dueño de kiosco piensa en
-- "confío en esta persona para X", no en una matriz de 11 casillas.
--
-- NADA DE ESTA MIGRACIÓN TOCA EL CAMINO DE COBRO.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · Los dos flags. Default FALSE, como los otros cinco (mínimo privilegio).
-- ---------------------------------------------------------------------------
alter table public.members
  add column if not exists can_close_register boolean not null default false,
  add column if not exists can_see_reports    boolean not null default false;

comment on column public.members.can_close_register is
  'Cierra el turno: efectivo esperado vs contado y la diferencia. NUNCA ganancia ni margen (052).';
comment on column public.members.can_see_reports is
  'Ve qué se vende y qué se está por acabar, en unidades. Sin un solo número de plata (052).';

-- ---------------------------------------------------------------------------
-- 2 · El dueño otorga los dos flags nuevos
--
-- `add_member` NO se toca a propósito: los dos nacen en `false` por el default
-- de la columna, así que el alta sigue teniendo los campos de siempre y el
-- dueño los otorga después, cuando ya decidió que confía. Un permiso que se
-- tilda en el apuro del alta no es una decisión.
--
-- Los dos parámetros van al final y con default para no romper llamadores.
-- ---------------------------------------------------------------------------
create or replace function public.actualizar_permisos(
  p_store_id  uuid,
  p_member_id uuid,
  p_fiar      boolean,
  p_descuento boolean,
  p_anular    boolean,
  p_recibir   boolean,
  p_costos    boolean,
  p_cerrar    boolean default false,
  p_reportes  boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_caller public.members;
begin
  v_caller := public.rpc_member(p_store_id);
  if v_caller.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  update public.members
     set can_sell_on_credit = p_fiar,
         can_apply_discount = p_descuento,
         can_void_sale      = p_anular,
         can_receive_stock  = p_recibir,
         can_see_costs      = p_costos,
         can_close_register = p_cerrar,
         can_see_reports    = p_reportes
   where id = p_member_id and store_id = p_store_id and role <> 'owner';

  if not found then
    raise exception 'member_not_found';
  end if;
end;
$$;

grant execute on function public.actualizar_permisos(uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3 · equipo_del_negocio expone los dos flags nuevos
--
-- ⚠️ NOTA DE MERGE. Esta definición es la de `013` + los dos flags. La rama de
-- identidad del empleado (bloque B1, todavía sin mergear) redefine esta misma
-- función para agregarle `usuario`. La que se mergee segunda tiene que llevar
-- las dos cosas: `usuario` Y `puede_cerrar`/`ve_reportes`.
-- ---------------------------------------------------------------------------
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
             'puede_cerrar', m.can_close_register,
             've_reportes', m.can_see_reports,
             'desde', m.created_at
           ) order by m.role, m.created_at), '[]'::jsonb)
      from public.members m
      join auth.users u on u.id = m.profile_id
     where m.store_id = p_store_id
  );
end;
$$;

grant execute on function public.equipo_del_negocio(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4 · cierre_caja — el turno se cierra sin ver la recaudación
--
-- El cuerpo se extrajo de la BASE con `pg_get_functiondef` (no se transcribió)
-- y los cambios son dos: el gate admite `can_close_register`, y el return se
-- parte. El detalle de qué se recorta y por qué está escrito adentro.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cierre_caja(p_store_id uuid, p_fecha date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_member    public.members;
  v_completo  boolean;
  v_tz        text;
  v_dia       date;
  v_ini       timestamptz;
  v_fin       timestamptz;
  v_medios    jsonb;
  v_ventas    jsonb;
  v_total     numeric(12,2);
  v_fiado     numeric(12,2);
  v_cobros    numeric(12,2);
  v_efectivo  numeric(12,2);
  v_reembolso numeric(12,2);
  v_anuladas  integer;
begin
  /* 051 · gate de ROL. Antes era solo `perform public.rpc_member(...)`:
     validaba la MEMBRESIA y nada mas, asi que cualquier cajero del negocio
     leia la ganancia. Ver docs/permisos-audit.md B-5/B-6/B-7. */
  v_member := public.rpc_member(p_store_id);
  /* 052 · antes esto era owner-only duro (051). Ahora entra también quien tenga
     `can_close_register` — pero NO ve lo mismo: ver el recorte del return. */
  if not (v_member.role = 'owner' or v_member.can_close_register) then
    raise exception 'not_allowed';
  end if;
  v_completo := (v_member.role = 'owner');

  select timezone into v_tz from public.stores where id = p_store_id;
  v_tz := coalesce(v_tz, 'America/Argentina/Buenos_Aires');
  v_dia := coalesce(p_fecha, (now() at time zone v_tz)::date);
  v_ini := (v_dia::timestamp) at time zone v_tz;
  v_fin := ((v_dia + 1)::timestamp) at time zone v_tz;

  select coalesce(sum(total) filter (where status = 'completed'), 0),
         coalesce(sum(total) filter (where status = 'completed' and payment_method = 'account'), 0),
         count(*) filter (where status = 'voided')
    into v_total, v_fiado, v_anuladas
    from public.sales
   where store_id = p_store_id
     and sold_at >= v_ini and sold_at < v_fin;

  select coalesce(sum(delta), 0) into v_cobros
    from public.client_ledger
   where store_id = p_store_id and reason = 'payment'
     and created_at >= v_ini and created_at < v_fin;

  -- Medios de COBRO reales (fiado no es medio; cobros de deuda a su medio real; y las
  -- ventas divididas imputadas parte por parte).
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
             and payment_method not in ('account','split')
             and sold_at >= v_ini and sold_at < v_fin
           group by payment_method
          union all
          select payment_method, sum(delta), count(*)
            from public.client_ledger
           where store_id = p_store_id and reason = 'payment'
             and payment_method is not null
             and created_at >= v_ini and created_at < v_fin
           group by payment_method
          union all
          select sp.method, sum(sp.amount), count(*)
            from public.sale_payments sp
            join public.sales s2 on s2.id = sp.sale_id
           where s2.store_id = p_store_id and s2.status = 'completed'
             and s2.sold_at >= v_ini and s2.sold_at < v_fin
           group by sp.method
        ) u
       group by metodo
    ) m;

  -- Efectivo que ENTRÓ hoy: ventas en efectivo + parte en efectivo de las divididas +
  -- cobros de fiado en efectivo.
  select coalesce(sum(total), 0) into v_efectivo
    from (
      select sum(total) as total from public.sales
       where store_id = p_store_id and status = 'completed'
         and payment_method = 'cash'
         and sold_at >= v_ini and sold_at < v_fin
      union all
      select sum(sp.amount) from public.sale_payments sp
        join public.sales s2 on s2.id = sp.sale_id
       where s2.store_id = p_store_id and s2.status = 'completed' and sp.method = 'cash'
         and s2.sold_at >= v_ini and s2.sold_at < v_fin
      union all
      select sum(delta) from public.client_ledger
       where store_id = p_store_id and reason = 'payment' and payment_method = 'cash'
         and created_at >= v_ini and created_at < v_fin
    ) e;

  -- Efectivo que SALIÓ hoy por reembolsos (ventas cash anuladas hoy vendidas antes).
  select coalesce(sum(total), 0) into v_reembolso
    from public.sales
   where store_id = p_store_id and status = 'voided'
     and payment_method = 'cash'
     and voided_at >= v_ini and voided_at < v_fin
     and sold_at < v_ini;

  -- Detalle del día (cota dura de 300).
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
         and s.sold_at >= v_ini and s.sold_at < v_fin
       order by s.sold_at desc
       limit 300
    ) v;

  /* -----------------------------------------------------------------------
     052 · EL RECORTE. Cerrar el turno y ver cuánto se hizo son dos cosas
     distintas, y venían pegadas en este mismo jsonb — por eso la sección
     terminó siendo owner-only entera.

     Quien cierra necesita EXACTAMENTE tres números: cuánto efectivo tendría
     que haber en el cajón, cuántas ventas hubo y cuántas se anularon. Contra
     el primero cuenta la plata; la diferencia la calcula la pantalla.

     Lo que NO viaja, y el motivo de cada uno:
       · facturado / entro_en_caja → es la recaudación del día
       · fiado / cobros_fiado      → deuda de clientes
       · by_method                 → el desglose por canal SUMA la recaudación
       · ventas (300 filas)        → cada venta con su monto, su vendedor y su
                                     cliente; sumarlas da lo mismo que facturado
     ----------------------------------------------------------------------- */
  if not v_completo then
    return jsonb_build_object(
      'fecha', v_dia,
      'efectivo_esperado', v_efectivo - v_reembolso,
      'ventas_del_turno', jsonb_array_length(v_ventas),
      'anuladas', v_anuladas,
      'parcial', true
    );
  end if;

  return jsonb_build_object(
    'fecha', v_dia,
    'facturado', v_total,
    'entro_en_caja', v_total - v_fiado + v_cobros,
    'fiado', v_fiado,
    'cobros_fiado', v_cobros,
    'efectivo_esperado', v_efectivo - v_reembolso,
    'anuladas', v_anuladas,
    'by_method', v_medios,
    'ventas', v_ventas,
    'parcial', false
  );
end;
$function$;


grant execute on function public.cierre_caja(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 5 · reportes_reposicion — el reporte del empleado, SIN un solo número de plata
--
-- POR QUÉ UNA RPC NUEVA Y NO UN RECORTE DE `reportes_summary`.
--
-- Se intentó primero el recorte, como en `cierre_caja`, y NO sale limpio:
-- `by_date`, `by_weekday` y `by_category` son `sum(s.total)` / `sum(line_total)`
-- — son plata y NADA MÁS que plata. Censurarlas deja al empleado con un
-- reporte lleno de agujeros donde antes había gráficos, y al dueño con una
-- función llena de `if v_completo` alrededor de cada bloque: dos formas de
-- empeorar las dos pantallas a la vez.
--
-- El reporte del empleado no es el del dueño tachado: es OTRA COSA, más chica y
-- con otra pregunta. La suya es "¿qué repongo y a qué hora se llena esto?".
-- Por eso `reportes_summary` queda intacta y owner-only (051), y esto se
-- calcula aparte. Cero riesgo de regresión sobre el reporte del dueño.
--
-- Ninguna columna de plata entra siquiera al cálculo: se cuentan UNIDADES
-- (`sum(qty)`) y TICKETS (`count(*)`), nunca `total`, `line_total` ni `cost`.
-- ---------------------------------------------------------------------------
create or replace function public.reportes_reposicion(
  p_store_id uuid,
  p_from     date,
  p_to       date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member    public.members;
  v_tz        text;
  v_dias      integer;
  v_unidades  numeric(12,3);
  v_tickets   integer;
  v_prev_unid numeric(12,3);
  v_top       jsonb;
  v_por_dia   jsonb;
  v_franja    jsonb;
  v_faltantes jsonb;
  v_vencen    jsonb;
begin
  v_member := public.rpc_member(p_store_id);
  if not (v_member.role = 'owner' or v_member.can_see_reports) then
    raise exception 'not_allowed';
  end if;

  select timezone into v_tz from public.stores where id = p_store_id;
  v_tz := coalesce(v_tz, 'America/Argentina/Buenos_Aires');
  v_dias := greatest((p_to - p_from) + 1, 1);

  -- A · Volumen: unidades y tickets. Ni un peso.
  select coalesce(sum(i.qty), 0), count(distinct s.id)
    into v_unidades, v_tickets
    from public.sales s
    join public.sale_items i on i.sale_id = s.id
   where s.store_id = p_store_id and s.status = 'completed'
     and (s.sold_at at time zone v_tz)::date between p_from and p_to;

  -- Período anterior, del mismo largo, para poder decir "más" o "menos".
  select coalesce(sum(i.qty), 0) into v_prev_unid
    from public.sales s
    join public.sale_items i on i.sale_id = s.id
   where s.store_id = p_store_id and s.status = 'completed'
     and (s.sold_at at time zone v_tz)::date
         between p_from - v_dias and p_from - 1;

  -- B · Lo que más sale, en unidades. Es la lista con la que se repone.
  select coalesce(jsonb_agg(t order by t.units desc), '[]'::jsonb) into v_top
    from (
      select i.product_name as name, max(p.emoji) as emoji, sum(i.qty) as units
        from public.sales s
        join public.sale_items i on i.sale_id = s.id
        left join public.products p on p.id = i.product_id
       where s.store_id = p_store_id and s.status = 'completed'
         and (s.sold_at at time zone v_tz)::date between p_from and p_to
       group by i.product_name
       order by sum(i.qty) desc
       limit 15
    ) t;

  -- C · Ritmo por día, en tickets y unidades (nunca facturación).
  select coalesce(jsonb_agg(d order by d.fecha), '[]'::jsonb) into v_por_dia
    from (
      select (s.sold_at at time zone v_tz)::date as fecha,
             count(distinct s.id) as tickets,
             sum(i.qty) as units
        from public.sales s
        join public.sale_items i on i.sale_id = s.id
       where s.store_id = p_store_id and s.status = 'completed'
         and (s.sold_at at time zone v_tz)::date between p_from and p_to
       group by 1
    ) d;

  -- D · A qué hora se llena. Mismas franjas que el reporte del dueño, para que
  --     los dos hablen del mismo "Mediodía".
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
             count(*) as tickets
        from public.sales s
       where s.store_id = p_store_id and s.status = 'completed'
         and (s.sold_at at time zone v_tz)::date between p_from and p_to
       group by 1, 2
    ) f;

  -- E · QUÉ SE ESTÁ POR ACABAR. Es el motivo de existir de esta pantalla.
  --     `stock` y el umbral no son plata: son cantidades de góndola.
  /* Sólo lo que SE VENDE y está bajo. Sin el filtro de rotación esta lista
     devuelve el catálogo entero en cero —todo lo que se cargó una vez y nunca
     se repuso— y deja de ser una lista de reposición para ser ruido: 50 filas
     en 0 no le dicen a nadie qué comprar. Se vio en la primera corrida contra
     el catálogo real de 2.007 productos.

     El orden es por VENTAS, no por stock: lo que más sale y está bajo es lo
     primero que hay que reponer, aunque le queden 2 y a otro le quede 0. */
  select coalesce(jsonb_agg(l order by l.vendidas desc, l.stock), '[]'::jsonb)
    into v_faltantes
    from (
      select p.name, p.emoji, p.stock, p.stock_confiable,
             sum(i.qty) as vendidas
        from public.products p
        join public.sale_items i on i.product_id = p.id
        join public.sales s on s.id = i.sale_id and s.status = 'completed'
        left join public.store_settings st on st.store_id = p.store_id
       where p.store_id = p_store_id and p.status = 'active'
         and (s.sold_at at time zone v_tz)::date between p_from and p_to
         and p.stock <= coalesce(p.low_stock_threshold,
                                 st.low_stock_threshold_default, 3)
       group by p.id, p.name, p.emoji, p.stock, p.stock_confiable
       order by sum(i.qty) desc, p.stock
       limit 20
    ) l;

  -- F · Y qué vence pronto — quien repone la góndola es quien mira la fecha.
  select coalesce(jsonb_agg(v order by v.expiry_date), '[]'::jsonb) into v_vencen
    from (
      select e.product_name as name, e.product_emoji as emoji,
             e.expiry_date, e.qty, e.days_left
        from public.pending_expiries e
       where e.store_id = p_store_id and e.days_left <= 30
       order by e.expiry_date
       limit 30
    ) v;

  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_dias),
    'volumen', jsonb_build_object(
      'units', v_unidades,
      'tickets', v_tickets,
      'prev_units', v_prev_unid,
      /* Piso de 10 unidades para comparar. Con `> 0` a secas, un período
         anterior de 3 unidades producía "+72.667%", que no es un dato: es
         ruido con signo. Null ⇒ la pantalla no muestra la comparación. */
      'vs_prev_pct', case when v_prev_unid >= 10
                          then round((v_unidades - v_prev_unid) / v_prev_unid * 100, 0)
                          else null end
    ),
    'top_units', v_top,
    'by_date', v_por_dia,
    'by_slot', v_franja,
    'low_stock', v_faltantes,
    'expiring', v_vencen
  );
end;
$$;

revoke execute on function public.reportes_reposicion(uuid, date, date) from public;
grant  execute on function public.reportes_reposicion(uuid, date, date) to authenticated;
