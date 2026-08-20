-- ===========================================================================
-- 064 · cobranza_grilla — el historial de pago, negocio por negocio y mes a mes
--
-- QUÉ RESUELVE. Hoy el panel muestra UN badge por negocio: "debe" o "al día".
-- Con eso, el cliente que se atrasó una vez en un año y el que se atrasa todos
-- los meses se ven EXACTAMENTE IGUAL, y son dos conversaciones opuestas: a uno
-- se lo llama para preguntarle si le pasó algo, al otro para decidir si sigue.
-- Un badge de estado presente borra la única información que distingue esos
-- dos casos, que es la historia.
--
-- POR QUÉ EN SQL Y NO EN TYPESCRIPT. La tentación era leer las tres tablas
-- desde el panel y armar la grilla en el cliente. Serían 6 meses × N negocios
-- de resolución de precio, o sea `precio_del_mes` llamada decenas de veces
-- (N+1, contra el baseline), o —peor— reimplementar en TS la regla de qué
-- precio rige en qué mes y cuándo vence. Esa regla YA vive acá (062) y tiene
-- que seguir viviendo en un solo lugar: el día que cambie el vencimiento, dos
-- verdades es peor que ninguna.
--
-- NO REIMPLEMENTA NADA: usa `precio_del_mes` y `subscription_payments`, las
-- mismas fuentes que `estado_suscripcion`, y repite su misma cota de
-- vencimiento (mes + 9 días) para que un mes no pueda figurar impago acá y en
-- término allá.
-- ===========================================================================

create or replace function public.cobranza_grilla(p_meses int default 6)
returns table (
  store_id uuid,
  mes      date,
  estado   text,
  pagado   numeric,
  precio   numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy    date := current_date;
  v_desde  date;
  v_meses  int;
begin
  /* GUARDA INTERNA. Es la tercera vez en este proyecto que una superficie con
     una sola cerradura se abre sola el día que alguien agrega un grant de más
     (`admin_stores`, `promo_vigente`, `cobranza_escalon`). Los grants de abajo
     ya la dejan sólo para service_role; esto la deja cerrada IGUAL si mañana
     alguien la otorga de más: si viene con sesión de usuario, no contesta. */
  if auth.uid() is not null then
    raise exception 'not_allowed';
  end if;

  /* Cota dura de la ventana: sin esto, un `p_meses` grande recorre la vida
     entera de cada negocio. 24 es más de lo que la UI muestra y sigue siendo
     barato. */
  v_meses := least(greatest(coalesce(p_meses, 6), 1), 24);
  v_desde := (date_trunc('month', v_hoy) - make_interval(months => v_meses - 1))::date;

  return query
  with meses as (
    select generate_series(v_desde, date_trunc('month', v_hoy)::date, interval '1 month')::date as mes
  ),
  base as (
    select
      s.id as store_id,
      m.mes,
      sub.cobra_desde,
      sub.prueba_hasta,
      sub.estado as estado_sub,
      sub.precio_mensual,
      coalesce((
        select sum(p.monto)
          from public.subscription_payments p
         where p.store_id = s.id and p.periodo = m.mes
      ), 0) as pagado
    from public.stores s
    cross join meses m
    left join public.subscriptions sub on sub.store_id = s.id
  )
  select
    b.store_id,
    b.mes,
    case
      /* Sin plan: no debe nada porque no se le cobra nada. Es distinto de
         "pagó" y distinto de "debe" — y es un estado que el panel necesita ver
         para saber a quién le falta asignarle precio. */
      when b.cobra_desde is null then 'sin_plan'
      when b.estado_sub = 'cancelada' then 'de_baja'
      /* Meses anteriores al alta: el negocio existía pero no se le cobraba. */
      when b.mes < date_trunc('month', b.cobra_desde)::date then
        case when b.prueba_hasta is not null and b.mes <= date_trunc('month', b.prueba_hasta)::date
             then 'prueba' else 'no_aplica' end
      else
        case
          when b.pagado >= coalesce(public.precio_del_mes(b.store_id, b.mes), b.precio_mensual)
            then 'pagado'
          when b.pagado > 0 then 'parcial'
          /* MISMA cota que `estado_suscripcion`: hasta el día 10 el mes en
             curso no está impago, está sin vencer. Marcarlo rojo el día 3
             convertiría la grilla en una alarma que suena todos los meses. */
          when v_hoy <= (b.mes + interval '9 days')::date then 'en_termino'
          else 'impago'
        end
    end as estado,
    b.pagado,
    coalesce(public.precio_del_mes(b.store_id, b.mes), b.precio_mensual) as precio
  from base b
  order by b.store_id, b.mes;
end;
$$;

revoke execute on function public.cobranza_grilla(int) from public, authenticated, anon;
grant  execute on function public.cobranza_grilla(int) to service_role;
