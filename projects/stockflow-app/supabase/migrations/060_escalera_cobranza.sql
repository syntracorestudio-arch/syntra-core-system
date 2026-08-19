-- ===========================================================================
-- 060 · La escalera de cobranza
--
-- Plan: docs/superadmin-suscripciones-plan.md §E, con el vencimiento del día 10
-- que decidió el owner.
--
-- LA ESCALERA, y por qué cada fecha está donde está:
--
--   día  7 · "se vence el 10"        — todavía NO debe nada. Avisar el mismo
--                                      día que vence no es un recordatorio,
--                                      es un reproche.
--   día 10 · vence                   — NO PASA NADA VISIBLE. Tiene todo el día.
--   día 12 · "¿lo pagaste?"          — margen deliberado: se cobra por
--                                      transferencia y la conciliación es
--                                      MANUAL. Entre que el cliente paga y el
--                                      owner lo marca puede pasar un fin de
--                                      semana, y reclamarle a alguien que ya
--                                      pagó es peor que reclamar un día tarde.
--   día 18 · "el 25 se suspende"     — con fecha explícita. Sin sorpresas.
--   día 25 · corte                   — 15 días desde el vencimiento. Es un
--                                      servicio que el kiosco usa para vender
--                                      TODOS LOS DÍAS: cortar rápido no acelera
--                                      el cobro, convierte un atraso en una baja.
--
-- UN SOLO CRON DIARIO que mira qué día es, en vez de cuatro entradas en
-- `vercel.json`: los meses no tienen todos los mismos días, el dedupe ya
-- resuelve la repetición, y así la escalera se lee entera en un lugar.
--
-- LOS AVISOS SON DEL DUEÑO Y DE NADIE MÁS. Restricción dura del owner: un
-- cajero viendo "tu jefe debe la suscripción" es humillante para el cliente.
-- Ya está garantizado por la policy de `notifications` (el destinatario, o el
-- dueño si no hay destinatario), pero acá se devuelve el `member_id` del dueño
-- explícito para que el push tampoco salga a otros teléfonos.
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
begin
  select * into v_sub from public.subscriptions where store_id = p_store_id;
  if not found or v_sub.estado <> 'activa' then
    return jsonb_build_object('escalon', 'ninguno');
  end if;

  /* El negocio ya suspendido no recibe más avisos: ya se enteró de la peor
     manera posible, y seguir mandándole recordatorios es ensañarse. */
  if not exists (select 1 from public.stores where id = p_store_id and status = 'active') then
    return jsonb_build_object('escalon', 'ninguno');
  end if;

  v_estado := public.estado_suscripcion(p_store_id, v_hoy);

  -- El destinatario: SIEMPRE el dueño, nunca el equipo.
  select id into v_owner from public.members
   where store_id = p_store_id and role = 'owner' and status = 'active'
   limit 1;
  if v_owner is null then
    return jsonb_build_object('escalon', 'ninguno');
  end if;

  /* ---- día 7 · el aviso PREVIO -----------------------------------------
     Sólo si está al día: al que ya debe no se le anuncia un vencimiento
     futuro, se le reclama el viejo (y de eso se ocupan los escalones de
     abajo). Y al que está en prueba no se le dice nada todavía. */
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

  -- De acá para abajo, sólo importa el que efectivamente debe.
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

  return jsonb_build_object(
    'escalon',        v_escalon,
    'member_id',      v_owner,
    'periodo',        v_periodo,
    'deuda',          v_estado->'deuda',
    'meses_impagos',  v_estado->'meses_impagos',
    'desde',          v_estado->'desde',
    'parcial',        coalesce(v_estado->'parcial', 'false'::jsonb),
    'dias_de_atraso', v_estado->'dias_de_atraso',
    -- La fecha del corte, para poder decirla en el mensaje del día 18.
    'suspende_el',    (v_periodo + interval '24 days')::date
  );
end;
$$;

revoke execute on function public.cobranza_escalon(uuid, date) from public, authenticated, anon;
grant  execute on function public.cobranza_escalon(uuid, date) to service_role;
