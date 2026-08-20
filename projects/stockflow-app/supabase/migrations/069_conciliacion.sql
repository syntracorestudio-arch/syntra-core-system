-- ===========================================================================
-- 069 · Conciliación — cruzar lo asentado contra el resumen del banco
--
-- EL PROBLEMA. Hoy no hay forma de verificar que lo marcado en el panel coincide
-- con las transferencias que realmente entraron. El panel dice "cobré $120.000";
-- si eso está bien o mal, no lo sabe nadie hasta que haya un problema.
--
-- ---------------------------------------------------------------------------
-- LA FECHA CORRECTA — y el agujero que había
-- ---------------------------------------------------------------------------
--
-- `subscription_payments` tiene TRES fechas y significan cosas distintas:
--
--   · `periodo`    — qué mes salda el pago (julio)
--   · `pagado_el`  — cuándo el cliente pagó de verdad
--   · `created_at` — cuándo lo asentamos nosotros
--
-- Para conciliar contra el banco la única que sirve es `pagado_el`: el resumen
-- bancario está ordenado por el día en que se movió la plata, no por el mes que
-- esa plata salda ni por el día que nos acordamos de cargarla.
--
-- PERO `pagado_el` NUNCA SE SETEABA. Existe desde 057 —con un comentario que
-- dice, textual, "`pagado_el` dice CUÁNDO lo hizo"— y `marcar_pago_suscripcion`
-- no lo recibe, así que siempre quedaba en `now()`, o sea igual a `created_at`.
-- Un pago transferido el viernes y cargado el lunes figuraba como del lunes, y
-- al cruzar contra el banco no matcheaba ninguna fila.
--
-- Acá se agrega el parámetro. Es opcional y por defecto sigue siendo `now()`:
-- los pagos ya asentados no cambian de significado, y quien cargue uno el mismo
-- día no tiene que tipear nada.
-- ===========================================================================

/* La firma vieja se BORRA, no se deja conviviendo. `create or replace` con un
   parámetro nuevo no reemplaza: crea una SEGUNDA función sobrecargada, y la
   anterior conserva su grant. O sea que la cota de `pagado_el_futuro` se
   saltearía llamando a la de seis argumentos — una validación que se puede
   esquivar eligiendo la otra puerta no es una validación. */
drop function if exists public.marcar_pago_suscripcion(uuid, date, numeric, uuid, text, text);

create or replace function public.marcar_pago_suscripcion(
  p_store_id uuid,
  p_periodo  date,
  p_monto    numeric,
  p_actor    uuid,
  p_medio    text default 'transferencia',
  p_nota     text default null,
  /* Cuándo entró la plata. Null = ahora, que es el caso normal. */
  p_pagado_el date default null
) returns public.subscription_payments
language plpgsql security definer set search_path = public as $$
declare
  v_sub    public.subscriptions;
  v_mes    date := date_trunc('month', p_periodo)::date;
  v_pagado numeric;
  v_falta  numeric;
  v_pago   public.subscription_payments;
begin
  select * into v_sub from public.subscriptions where store_id = p_store_id;
  if not found then
    raise exception 'sin_suscripcion';
  end if;

  if p_monto <= 0 then
    raise exception 'monto_invalido';
  end if;

  if v_mes < date_trunc('month', v_sub.cobra_desde)::date then
    raise exception 'periodo_anterior_al_alta';
  end if;

  if v_mes > date_trunc('month', current_date)::date then
    raise exception 'periodo_futuro';
  end if;

  /* La plata no puede haber entrado mañana. Sin esta cota, un tipeo de año
     (2027 en vez de 2026) mete el pago en un período de conciliación que
     todavía no existe y desaparece de todos los cruces. */
  if p_pagado_el is not null and p_pagado_el > current_date then
    raise exception 'pagado_el_futuro';
  end if;

  select coalesce(sum(monto), 0) into v_pagado
    from public.subscription_payments
   where store_id = p_store_id and periodo = v_mes;

  v_falta := v_sub.precio_mensual - v_pagado;

  if v_falta <= 0 then
    raise exception 'periodo_ya_pagado';
  end if;

  if p_monto > v_falta then
    raise exception 'monto_excede_lo_adeudado';
  end if;

  insert into public.subscription_payments
    (store_id, periodo, monto, marcado_por, medio, nota, pagado_el)
  values
    (p_store_id, v_mes, p_monto, p_actor, p_medio, p_nota,
     /* MEDIODÍA y no medianoche. `pagado_el` es timestamptz, así que una fecha
        guardada como 2026-06-14 00:00 UTC se muestra en Argentina (UTC-3) como
        el 13 de junio: el operador tipea 14 y la tabla le dice 13. Para una
        conciliación contra el extracto, un día de corrimiento arruina el cruce.
        Al mediodía UTC la fecha se lee igual en cualquier huso de UTC-11 a
        UTC+12. */
     coalesce((p_pagado_el + time '12:00')::timestamptz, now()))
  returning * into v_pago;

  return v_pago;
end;
$$;

revoke execute on function public.marcar_pago_suscripcion(uuid, date, numeric, uuid, text, text, date)
  from public, authenticated, anon;
grant  execute on function public.marcar_pago_suscripcion(uuid, date, numeric, uuid, text, text, date)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2 · pagos_asentados — la lista plana, para cruzar renglón por renglón
--
-- Devuelve pagos INDIVIDUALES y no sumas: para conciliar hay que poder tildar
-- cada movimiento del banco contra su fila. Una suma mensual dice que falta
-- plata pero no cuál.
--
-- Ordenado por `pagado_el` descendente, que es el orden del resumen bancario.
-- ---------------------------------------------------------------------------
create or replace function public.pagos_asentados(p_desde date, p_hasta date)
returns table (
  id          uuid,
  store_id    uuid,
  negocio     text,
  periodo     date,
  monto       numeric,
  medio       text,
  nota        text,
  pagado_el   timestamptz,
  cargado_el  timestamptz,
  /* Si se cargó un día distinto del que entró la plata, el que concilia
     necesita verlo: explica por qué una fila no aparece donde la busca. */
  a_destiempo boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    raise exception 'not_allowed';
  end if;

  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'rango_invalido';
  end if;
  /* 36 y no 24: es la MISMA ventana que `ingresos_mensuales` y
     `cobrado_por_cliente_mes`. Con 24, el panel —que pide 36— recibía
     `rango_demasiado_largo`, y como el error viajaba en `data: null` la tabla
     se veía vacía SIN decir por qué. Dos cotas distintas para la misma ventana
     es una trampa, no una defensa. */
  if p_hasta > (p_desde + interval '36 months')::date then
    raise exception 'rango_demasiado_largo';
  end if;

  return query
  select
    p.id,
    s.id,
    s.name,
    p.periodo,
    p.monto,
    p.medio,
    p.nota,
    p.pagado_el,
    p.created_at,
    p.pagado_el::date <> p.created_at::date
  from public.subscription_payments p
  join public.stores s on s.id = p.store_id
  where p.pagado_el::date between p_desde and p_hasta
  order by p.pagado_el desc;
end;
$$;

revoke execute on function public.pagos_asentados(date, date) from public, authenticated, anon;
grant  execute on function public.pagos_asentados(date, date) to service_role;
