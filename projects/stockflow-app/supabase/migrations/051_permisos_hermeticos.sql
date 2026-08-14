-- ===========================================================================
-- 051 · Permisos herméticos — la plata del dueño deja de ser legible por su
--       propio empleado
--
-- Auditoría: docs/permisos-audit.md · contratos: docs/rpc-contracts.md.
--
-- EL HALLAZGO, EN UNA FRASE: el aislamiento entre NEGOCIOS está bien; el que no
-- existía era el aislamiento entre el DUEÑO y su empleado.
--
-- Verificado en vivo antes de escribir esto, con el JWT de una cajera sin
-- ningún permiso (`can_see_costs = false`): leía `products.cost` de todo el
-- catálogo, la ganancia acumulada de 394 líneas de venta ($308.530 en el
-- fixture), el libro de fiado completo y las tres RPCs de tablero. Del negocio
-- vecino, en cambio, no leía absolutamente nada (`0 filas`, `not_a_member`).
--
-- LA CAUSA es la MISMA que la escalada de privilegios del bloque A (049):
-- **las policies de Postgres son de FILA, no de COLUMNA.** `002:136-137` dice
-- textual "Editar precios/costos y archivar: solo el dueño" — y es cierto para
-- ESCRIBIR. Para LEER, `products_select` le da al equipo la fila entera, `cost`
-- incluido. La intención escrita en `001:49` ("el empleado ve precio de venta,
-- nunca el costo") nunca se implementó.
--
-- Y no es teórico: `src/lib/supabase/browser.ts:9-11` publica la anon key en el
-- bundle y el empleado logueado tiene un JWT válido en sus cookies, así que
-- llega a PostgREST por su cuenta. `requireOwner()` en la página era una
-- cortina sobre una API abierta.
--
-- NADA DE ESTA MIGRACIÓN TOCA EL CAMINO DE COBRO: `register_sale`,
-- `register_split_sale`, `void_sale` y `rpc_member` quedan idénticos, y ningún
-- flag existente cambia de significado.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · Estanqueidad por COLUMNA (B-1, B-2, B-3)
--
-- Postgres no deja "restar" una columna de un grant de tabla: hay que revocar
-- el SELECT de tabla y volver a otorgarlo por lista. Por eso se enumeran.
--
-- CONSECUENCIA QUE HAY QUE SABER: una columna NUEVA en estas tres tablas nace
-- SIN grant ⇒ invisible para la app hasta que se la agregue acá. Es molesto y
-- es a propósito: falla del lado seguro. Si mañana alguien agrega
-- `products.costo_reposicion` y "no aparece", el motivo es esta lista.
--
-- El patrón NO es nuevo en este proyecto: `products` ya tenía grants por
-- columna para UPDATE (lista curada que excluye id/store_id/stock). Se copia.
--
-- Radio de impacto verificado: CERO consultas de la app leen estas columnas
-- directamente — todas pasan por RPCs `security definer`, que corren como el
-- dueño de la función y son INMUNES al grant de `authenticated`. Por eso el
-- dueño sigue viendo sus costos con esto puesto.
-- ---------------------------------------------------------------------------

revoke select on public.products from authenticated, anon;
grant select (
  id, store_id, category_id, name, emoji, color, price, low_stock_threshold,
  stock, sale_unit, attrs, status, price_updated_at, created_at, updated_at,
  stock_confiable
) on public.products to authenticated;

revoke select on public.sale_items from authenticated, anon;
grant select (
  id, sale_id, store_id, product_id, product_name, qty, unit_price,
  line_total, promo_id, list_price
) on public.sale_items to authenticated;

revoke select on public.stock_ledger from authenticated, anon;
grant select (
  id, store_id, product_id, delta, reason, sale_id, note, created_by, created_at
) on public.stock_ledger to authenticated;

-- ---------------------------------------------------------------------------
-- 2 · El libro de fiado deja de ser público dentro del negocio (B-4)
--
-- `client_ledger_select` y `clients_select` (002:177-201) daban lectura a todo
-- el equipo: un cajero SIN `can_sell_on_credit` leía cuánto debe cada cliente
-- del negocio. Acá sí alcanza RLS, porque el recorte es de FILAS.
--
-- `auth_can` incluye al owner por definición (002:44-58), así que el dueño no
-- pierde nada. La pantalla que el empleado sí usa —la cuenta del cliente que
-- está atendiendo, `/admin/fiado/[id]`— exige el mismo flag, así que sigue
-- funcionando igual.
-- ---------------------------------------------------------------------------
drop policy if exists client_ledger_select on public.client_ledger;
create policy client_ledger_select on public.client_ledger for select
  using (public.auth_can(store_id, 'can_sell_on_credit'));

drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select
  using (public.auth_can(store_id, 'can_sell_on_credit'));

-- ---------------------------------------------------------------------------
-- 3 · Las tres RPCs de tablero miran el ROL, no sólo la membresía (B-5/6/7)
--
-- `dashboard_summary` (007:31 y su redefinición en 008:129), `reportes_summary`
-- (009:55) y `cierre_caja` (013:38) hacían `perform public.rpc_member(...)` y
-- nada más: membresía. Las tres son `security definer` y están otorgadas a
-- `authenticated`, así que cualquier empleado las llamaba y recibía `profit`,
-- `cash_in`, `credit_given`, `top_profit`, `dead_stock` y la recaudación.
--
-- Los cuerpos de acá abajo se extrajeron de la BASE con `pg_get_functiondef`
-- (no se transcribieron a mano) y el ÚNICO cambio es reemplazar esa línea por
-- el gate de rol. `rpc_member` se sigue llamando, así que el corte
-- cross-tenant (`not_a_member`) queda intacto.
--
-- Owner-only por ahora: los flags `can_close_register` / `can_see_reports` que
-- permitirían abrir esto con recorte de payload son la fase 3 de la auditoría
-- y esperan la decisión del owner.
--
-- El patrón correcto ya existía en la casa y esto lo empareja:
-- `margenes_erosionados` (015:219) y `promos_sugeridas` (045:937) ya lo hacían.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cierre_caja(p_store_id uuid, p_fecha date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
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
  if (public.rpc_member(p_store_id)).role <> 'owner' then
    raise exception 'not_allowed';
  end if;

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

  return jsonb_build_object(
    'fecha', v_dia,
    'facturado', v_total,
    'entro_en_caja', v_total - v_fiado + v_cobros,
    'fiado', v_fiado,
    'cobros_fiado', v_cobros,
    'efectivo_esperado', v_efectivo - v_reembolso,
    'anuladas', v_anuladas,
    'by_method', v_medios,
    'ventas', v_ventas
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_summary(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  /* 051 · gate de ROL. Antes era solo `perform public.rpc_member(...)`:
     validaba la MEMBRESIA y nada mas, asi que cualquier cajero del negocio
     leia la ganancia. Ver docs/permisos-audit.md B-5/B-6/B-7. */
  if (public.rpc_member(p_store_id)).role <> 'owner' then
    raise exception 'not_allowed';
  end if;

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
$function$
;

CREATE OR REPLACE FUNCTION public.reportes_summary(p_store_id uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  /* 051 · gate de ROL. Antes era solo `perform public.rpc_member(...)`:
     validaba la MEMBRESIA y nada mas, asi que cualquier cajero del negocio
     leia la ganancia. Ver docs/permisos-audit.md B-5/B-6/B-7. */
  if (public.rpc_member(p_store_id)).role <> 'owner' then
    raise exception 'not_allowed';
  end if;

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
$function$
;


-- Los grants se re-declaran porque `create or replace function` no los pierde,
-- pero dejarlos escritos hace que la migración sea legible sola.
grant execute on function public.dashboard_summary(uuid) to authenticated;
grant execute on function public.reportes_summary(uuid, date, date) to authenticated;
grant execute on function public.cierre_caja(uuid, date) to authenticated;

-- ===========================================================================
-- SEGUNDA TANDA — el barrido completo de la clase "fila vs columna"
--
-- Tras cerrar las seis fugas de arriba corrí el barrido exhaustivo que pidió el
-- owner: TODA tabla o vista legible por `authenticated` con columnas de plata.
-- Aparecieron cuatro más. Dos de las candidatas ya estaban bien y quedan acá
-- anotadas para que nadie las vuelva a auditar:
--
--   · `expenses`  → 0 filas para un empleado. Ya era owner-only. ✔
--   · `client_balances` (vista) → 0 filas. Es `security_invoker`, así que SIGUIÓ
--     al arreglo de `clients`/`client_ledger` de arriba sin tocarla. ✔
--
-- Las cuatro que sí fugaban van abajo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 4 · La recaudación: `sales`, `sale_items` y la vista que las suma
--
-- Un empleado leía `select sum(total) from sales` = la recaudación histórica
-- del negocio ($11.836.620 en el fixture de escala), y la vista `daily_totals`
-- se la servía ya agrupada por día ($11.829.220 en 21 días). Es exactamente el
-- dato por el que `/admin/caja` se hizo `requireOwner`.
--
-- Acá alcanza RLS porque el recorte es de FILAS: la fila entera es del dueño.
-- Y `daily_totals` es `security_invoker = true` (001:454), así que hereda esta
-- policy sin tocarla — por eso no hay una línea para la vista.
--
-- Radio de impacto: CERO. Ninguna consulta de la app lee `sales` ni
-- `sale_items` directamente (verificado en todo `src/`); el POS vende, anula y
-- deshace por RPCs `security definer`, que son inmunes a RLS. El bloque 11 de
-- verify-permisos.sql prueba el camino de venta completo con JWT de cajera.
-- ---------------------------------------------------------------------------
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select
  using (public.auth_has_role(store_id, array['owner']));

drop policy if exists sale_items_select on public.sale_items;
create policy sale_items_select on public.sale_items for select
  using (public.auth_has_role(store_id, array['owner']));

-- ---------------------------------------------------------------------------
-- 5 · `promos.cost_at_start` — el costo, congelado y servido
--
-- La promo guarda el costo del producto al momento de crearla (para poder
-- avisar si se está vendiendo bajo costo). La policy `promos_select` (045:78)
-- da lectura a todo el equipo porque el POS necesita saber qué está en promo
-- — pero se llevaba puesta esa columna: 5 de 6 promos del fixture exponían el
-- costo. Recorte por columna, que es lo que corresponde: las FILAS sí las
-- necesita el equipo.
-- ---------------------------------------------------------------------------
revoke select on public.promos from authenticated, anon;
grant select (
  id, store_id, product_id, promo_price, list_price, min_qty, starts_on,
  ends_on, expiry_id, origin, ended_at, ended_reason, created_by, created_at
) on public.promos to authenticated;

-- ---------------------------------------------------------------------------
-- 6 · `store_settings` — los márgenes, que son el costo por la puerta de atrás
--
-- Ésta es la que hace que todo lo anterior valga: con `products.price` visible
-- (y tiene que serlo: es lo que cobra la caja) más el margen del negocio, el
-- costo de CADA producto se despeja de memoria. Cerrar `products.cost` y dejar
-- `margen_default_pct` a la vista es cerrar la puerta y dejar la ventana.
--
-- No alcanza con sacarlos del payload del POS (eso ya se hizo, fuga B-8): la
-- tabla se lee directo con el JWT del empleado.
--
-- Se revocan las dos columnas y quien las necesita de verdad las pide por
-- `margenes_del_negocio()`, que sí mira el permiso. El resto de la tabla
-- (alias de transferencia, redondeo, días de aviso) no es plata del dueño y se
-- sigue leyendo igual.
-- ---------------------------------------------------------------------------
revoke select on public.store_settings from authenticated, anon;
grant select (
  store_id, expiry_warning_days, low_stock_threshold_default, reprice_rounding,
  allow_negative_stock, transfer_alias, confirm_methods, has_posnet, updated_at
) on public.store_settings to authenticated;

-- `can_receive_stock` y no el rol: el que carga mercadería NECESITA el margen
-- para que el alta le proponga un precio de venta desde el costo. Es la misma
-- gente que ya ve costos (051 derivó `can_see_costs` de este flag), así que no
-- abre nada nuevo — sólo deja de abrírselo a quien únicamente cobra.
create or replace function public.margenes_del_negocio(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
  v_res    jsonb;
begin
  v_member := public.rpc_member(p_store_id);
  if not (v_member.role = 'owner' or v_member.can_receive_stock) then
    raise exception 'not_allowed';
  end if;

  select jsonb_build_object(
           'margen_default_pct', coalesce(margen_default_pct, 35),
           'min_margin_pct',     coalesce(min_margin_pct, 25)
         )
    into v_res
    from public.store_settings
   where store_id = p_store_id;

  -- Un negocio sin fila de settings todavía no es un error: son los defaults.
  return coalesce(v_res, jsonb_build_object('margen_default_pct', 35,
                                            'min_margin_pct', 25));
end;
$$;

revoke execute on function public.margenes_del_negocio(uuid) from public;
grant  execute on function public.margenes_del_negocio(uuid) to authenticated;
