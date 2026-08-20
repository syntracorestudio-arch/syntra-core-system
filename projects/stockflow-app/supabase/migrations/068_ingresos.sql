-- ===========================================================================
-- 068 · Los ingresos de SYNTRA — comprometido vs cobrado, mes a mes
--
-- QUÉ RESUELVE. El panel contesta "quién me debe" (cartera) y "quién viene
-- arrastrando" (grilla), pero no contesta "¿cuánto entró?" ni "¿estoy
-- creciendo?". Son preguntas de OTRA cadencia: la cartera se mira los lunes
-- para decidir a quién llamar; esto se mira una vez por mes para decidir si el
-- negocio va para algún lado.
--
-- ---------------------------------------------------------------------------
-- LA DECISIÓN QUE ORDENA TODO: DOS SERIES, NO UNA
-- ---------------------------------------------------------------------------
--
-- Un gráfico de "ingresos por mes" con una sola barra miente por omisión: un
-- mes con $120.000 cobrados se ve igual de bien si eso era todo lo que había
-- que cobrar que si había $300.000 y entró menos de la mitad.
--
-- Por eso cada mes devuelve DOS números: lo COMPROMETIDO (lo que el plan de
-- cada cliente decía que se iba a cobrar ese mes) y lo COBRADO (lo que
-- realmente entró). El hueco entre los dos ES la mora, y se lee sin leyenda:
-- barra llena = mes cobrado, barra a medias = mes con agujero.
--
-- El comprometido usa `precio_del_mes` (062), o sea el precio que regía EN ESE
-- MES: si a alguien se le subió la cuota en julio, junio no se reescribe. Un
-- gráfico histórico que cambia cuando cambiás un precio no es un histórico.
--
-- El mes en curso se devuelve igual, pero el que lo dibuje tiene que saber que
-- está incompleto — por eso viaja `en_curso`, y no se deja que la UI lo deduzca
-- comparando fechas (que es donde se cuelan los errores de timezone).
-- ===========================================================================

-- VENTANA Y NO AÑO. La primera versión recibía `p_anio` y había que llamarla
-- una vez por año del selector. Con una ventana de N meses alcanza UNA llamada:
-- el cliente agrupa por año y por mes sin volver al servidor, así que cambiar
-- de mes o de año es instantáneo. Y el techo es explícito — 36 meses — en vez
-- de depender de cuántos años ofrezca el desplegable.
create or replace function public.ingresos_mensuales(p_meses int default 36)
returns table (
  mes          date,
  comprometido numeric,
  cobrado      numeric,
  pagaron      int,
  en_curso     boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_desde date;
  v_hasta date;
begin
  if auth.uid() is not null then
    raise exception 'not_allowed';
  end if;

  /* Cota dura: 36 meses. El argumento no puede pedir "toda la historia". */
  v_hasta := date_trunc('month', current_date)::date;
  v_desde := (v_hasta - make_interval(months => least(greatest(coalesce(p_meses, 36), 1), 36) - 1))::date;

  return query
  with meses as (
    select generate_series(v_desde, v_hasta, interval '1 month')::date as mes
  ),
  comprometidos as (
    select
      m.mes,
      coalesce(sum(
        case
          /* Sólo cuenta el mes si al cliente le correspondía pagarlo: después
             del alta, fuera de la prueba y antes de la baja. Contar meses que
             nunca se le iban a cobrar inflaría la mora contra nosotros.

             Y NUNCA meses FUTUROS. La primera versión los proyectaba: octubre
             aparecía con $120.000 comprometidos y $0 cobrados, o sea con toda
             la cuota como agujero, cuando todavía ni siquiera se emitió. El
             gráfico mostraba una mora gigante que no existe. Un mes que no
             llegó no es un mes impago: no es nada todavía. */
          when m.mes > date_trunc('month', current_date)::date then 0
          when sub.cobra_desde is not null
           and m.mes >= date_trunc('month', sub.cobra_desde)::date
           and (sub.estado <> 'cancelada' or sub.cancelada_el is null
                or m.mes <= date_trunc('month', sub.cancelada_el)::date)
          then coalesce(public.precio_del_mes(sub.store_id, m.mes), sub.precio_mensual)
          else 0
        end
      ), 0) as total
    from meses m
    left join public.subscriptions sub on true
    group by m.mes
  ),
  cobrados as (
    select
      p.periodo as mes,
      sum(p.monto) as total,
      count(distinct p.store_id)::int as clientes
    from public.subscription_payments p
    where p.periodo between v_desde and v_hasta
    group by p.periodo
  )
  select
    m.mes,
    c.total,
    coalesce(k.total, 0),
    coalesce(k.clientes, 0),
    m.mes = date_trunc('month', current_date)::date
  from meses m
  join comprometidos c on c.mes = m.mes
  left join cobrados k on k.mes = m.mes
  order by m.mes;
end;
$$;

revoke execute on function public.ingresos_mensuales(int) from public, authenticated, anon;
grant  execute on function public.ingresos_mensuales(int) to service_role;

-- ---------------------------------------------------------------------------
-- 2 · cobrado_por_cliente_mes — de dónde viene la plata, mes a mes
--
-- Devuelve el detalle por (cliente, mes) en vez de un total por rango, y eso es
-- deliberado: con el total, cambiar el filtro de mes obligaría a volver al
-- servidor. Con el detalle, el panel arma "cobrado por cliente" de cualquier
-- mes o del año entero sumando lo que ya tiene en memoria.
--
-- El volumen está acotado por construcción: clientes × 36 meses, y sólo filas
-- con pago. A 30 clientes son 1080 filas en el peor caso imaginable.
-- ---------------------------------------------------------------------------
create or replace function public.cobrado_por_cliente_mes(p_meses int default 36)
returns table (
  store_id uuid,
  nombre   text,
  mes      date,
  cobrado  numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_desde date;
begin
  if auth.uid() is not null then
    raise exception 'not_allowed';
  end if;

  v_desde := (date_trunc('month', current_date)
              - make_interval(months => least(greatest(coalesce(p_meses, 36), 1), 36) - 1))::date;

  return query
  select s.id, s.name, p.periodo, sum(p.monto)
    from public.stores s
    join public.subscription_payments p on p.store_id = s.id
   where p.periodo >= v_desde
   group by s.id, s.name, p.periodo
   order by s.name, p.periodo;
end;
$$;

revoke execute on function public.cobrado_por_cliente_mes(int) from public, authenticated, anon;
grant  execute on function public.cobrado_por_cliente_mes(int) to service_role;

-- ---------------------------------------------------------------------------
-- 3 · anios_con_datos — qué años ofrecer en el selector
--
-- Para no ofrecer un desplegable de 2020 a 2030 donde nueve opciones están
-- vacías. Sale de lo que realmente hay: pagos asentados y altas de plan.
-- ---------------------------------------------------------------------------
create or replace function public.anios_con_datos()
returns int[]
language sql stable security definer set search_path = public as $$
  select coalesce(
    array_agg(distinct a order by a desc),
    array[extract(year from current_date)::int]
  )
  from (
    select extract(year from periodo)::int as a from public.subscription_payments
    union
    select extract(year from cobra_desde)::int from public.subscriptions where cobra_desde is not null
    union
    select extract(year from current_date)::int
  ) t;
$$;

revoke execute on function public.anios_con_datos() from public, authenticated, anon;
grant  execute on function public.anios_con_datos() to service_role;
