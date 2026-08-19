-- ===========================================================================
-- 063 · El dueño puede ver que debe, sin ver la cobranza de nadie
--
-- EL AGUJERO: hoy `notifications` NO LA LEE NADIE en la app. El cron de
-- cobranza escribe filas y manda push, pero el push es efímero — si al dueño se
-- le pasa la burbuja, o la descarta, no tiene NINGUNA forma dentro del producto
-- de enterarse de que debe. Y el día 25 se le suspende el negocio.
--
-- Avisarle por un canal que se puede perder, y después cortarle la caja por no
-- haber reaccionado, es exactamente el tipo de cosa que rompe la relación con
-- un cliente que quizás sólo no vio una notificación.
--
-- POR QUÉ UNA RPC NUEVA Y NO LEER `notifications` NI LA TABLA.
--
--   · La tabla de suscripciones es de SYNTRA y sigue siéndolo (057): darle
--     acceso al dueño expone el precio de los demás el día que haya más de un
--     plan. Esta RPC devuelve SÓLO lo suyo y sólo lo que necesita saber — ni el
--     precio de otros, ni en qué escalón de la escalera está.
--
--   · Leer `notifications` habría sido más barato (esas filas ya son suyas por
--     RLS), pero un aviso es una foto del momento: si paga, la fila vieja sigue
--     ahí y el banner seguiría diciendo que debe. El estado se DERIVA de los
--     pagos, así que se apaga solo cuando salda. Un banner que hay que
--     acordarse de borrar termina mintiendo.
-- ===========================================================================

create or replace function public.mi_suscripcion()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_store uuid;
  v_est   jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('estado', 'sin_sesion');
  end if;

  /* SÓLO el dueño, y sólo de SU negocio. El empleado no tiene nada que ver con
     la relación comercial entre SYNTRA y su jefe: que un cajero se entere de
     que el negocio debe la suscripción es humillante para el cliente, y ésa es
     una restricción dura del owner. */
  select m.store_id into v_store
    from public.members m
   where m.profile_id = v_uid and m.role = 'owner' and m.status = 'active'
   order by m.created_at
   limit 1;

  if v_store is null then
    return jsonb_build_object('estado', 'no_corresponde');
  end if;

  v_est := public.estado_suscripcion(v_store);

  /* Se devuelve un subconjunto ESTRECHO a propósito. El dueño necesita saber
     tres cosas: si debe, cuánto, y hasta cuándo tiene. No necesita saber en qué
     escalón de la escalera está —eso le permitiría administrar el atraso— ni
     nada de los otros negocios. */
  if v_est->>'estado' <> 'debe' then
    return jsonb_build_object('estado', 'al_dia');
  end if;

  return jsonb_build_object(
    'estado',        'debe',
    'deuda',         v_est->'deuda',
    'meses_impagos', v_est->'meses_impagos',
    'desde',         v_est->'desde',
    'parcial',       coalesce(v_est->'parcial', 'false'::jsonb),
    /* La fecha del corte, que es el dato accionable: sin ella el aviso es una
       amenaza vaga y con ella es una fecha en la agenda. */
    'suspende_el',   (date_trunc('month', current_date) + interval '24 days')::date
  );
end;
$$;

revoke execute on function public.mi_suscripcion() from public, anon;
grant  execute on function public.mi_suscripcion() to authenticated;
