-- ===========================================================================
-- 061 · El corte no se dispara por un peso, y la RPC se defiende sola
--
-- Sale de la verificación adversarial de la escalera (060).
--
-- ALTO 3 · UN PESO DE DIFERENCIA APAGABA EL KIOSCO.
--   `parcial` viajaba en el payload y no lo miraba nadie. Medido: un cliente
--   al que le falta $1 de $60.000 recibe `escalon: corte`, exactamente el mismo
--   trato que uno que debe $180.000.
--   El caso no es hipotético: una transferencia de $59.900 por una comisión
--   bancaria, o un monto mal tipeado al marcar el pago, dejan al cliente
--   "debiendo" centavos. Cortarle la caja por eso es indefendible.
--
-- LA REGLA: el corte automático exige deber AL MENOS UN MES COMPLETO.
--   Debajo de eso hay un humano mirando, no un cron. Es fácil de explicar por
--   teléfono ("te cortamos porque debés dos meses") y no depende de calibrar
--   un porcentaje arbitrario.
--
-- BAJO · LA RPC NO TENÍA COTA PROPIA.
--   Toda su defensa era el `revoke`. El verificador lo probó reintroduciendo el
--   grant: con EXECUTE, cualquier usuario leía la deuda de cualquier cliente.
--   Es la TERCERA vez que aparece el mismo patrón en este proyecto
--   (`admin_stores`, `promo_vigente`, y ahora ésta): una superficie con UNA
--   sola cerradura se abre sola el día que alguien agrega un grant distraído.
-- ===========================================================================

create or replace function public.cobranza_escalon(p_store_id uuid, p_hoy date default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_hoy      date := coalesce(p_hoy, current_date);
  v_dia      int  := extract(day from v_hoy)::int;
  v_estado   jsonb;
  v_sub      public.subscriptions;
  v_owner    uuid;
  v_escalon  text;
  v_periodo  date := date_trunc('month', v_hoy)::date;
  v_deuda    numeric;
begin
  /* 061 · segunda cerradura. La RPC es de plataforma: sólo `service_role` la
     tiene otorgada. Si alguien re-otorga el permiso por error, esto sigue
     frenando — y si la llama el cron (sin JWT), pasa. */
  if auth.uid() is not null then
    raise exception 'not_allowed';
  end if;

  select * into v_sub from public.subscriptions where store_id = p_store_id;
  if not found or v_sub.estado <> 'activa' then
    return jsonb_build_object('escalon', 'ninguno');
  end if;

  if not exists (select 1 from public.stores where id = p_store_id and status = 'active') then
    return jsonb_build_object('escalon', 'ninguno');
  end if;

  v_estado := public.estado_suscripcion(p_store_id, v_hoy);

  /* El destinatario: SIEMPRE el dueño. `order by created_at` porque nada impide
     dos owners activos y el reclamo no puede ir a uno distinto cada día. */
  select id into v_owner from public.members
   where store_id = p_store_id and role = 'owner' and status = 'active'
   order by created_at
   limit 1;
  if v_owner is null then
    return jsonb_build_object('escalon', 'ninguno');
  end if;

  if v_dia = 7 and v_estado->>'estado' = 'al_dia'
     and v_hoy >= date_trunc('month', v_sub.cobra_desde)::date then
    return jsonb_build_object(
      'escalon',   'aviso_previo',
      'member_id', v_owner,
      'periodo',   v_periodo,
      'monto',     v_sub.precio_mensual,
      'vence',     (v_periodo + interval '9 days')::date
    );
  end if;

  if v_estado->>'estado' <> 'debe' then
    return jsonb_build_object('escalon', 'ninguno');
  end if;

  v_escalon := case
    when v_dia = 12 then 'recordatorio'
    when v_dia = 18 then 'escalada'
    when v_dia >= 25 then 'corte'
    else 'ninguno'
  end;

  if v_escalon = 'ninguno' then
    return jsonb_build_object('escalon', 'ninguno');
  end if;

  v_deuda := (v_estado->>'deuda')::numeric;

  return jsonb_build_object(
    'escalon',        v_escalon,
    'member_id',      v_owner,
    'periodo',        v_periodo,
    'deuda',          v_deuda,
    'precio',         v_sub.precio_mensual,
    'meses_impagos',  v_estado->'meses_impagos',
    'desde',          v_estado->'desde',
    'parcial',        coalesce(v_estado->'parcial', 'false'::jsonb),
    'dias_de_atraso', v_estado->'dias_de_atraso',
    'suspende_el',    (v_periodo + interval '24 days')::date,
    /* 061 · el cron NO corta por menos de un mes completo. Debajo de eso lo
       mira una persona: puede ser una comisión bancaria, un monto mal tipeado
       o un redondeo, y ninguna de esas cosas justifica apagarle la caja a un
       comercio que está abierto. */
    'corte_seguro',   (v_deuda >= v_sub.precio_mensual)
  );
end;
$$;

revoke execute on function public.cobranza_escalon(uuid, date) from public, authenticated, anon;
grant  execute on function public.cobranza_escalon(uuid, date) to service_role;
