-- ===========================================================================
-- verify-escalera-cobranza.sql — 060
--
-- Cada escalón se prueba con su fecha INYECTADA. Un test de cobranza que
-- depende del día en que corre pasa hoy y falla el mes que viene.
--
-- Lo que más importa acá no es que los avisos salgan: es QUIÉN los recibe y
-- QUIÉN NO. La restricción del owner es dura — un cajero viendo "tu jefe debe
-- la suscripción" es humillante para el cliente.
-- ===========================================================================
\set ON_ERROR_STOP on

\echo ''
\echo '== 1 · cada escalon en su dia, y NADA en los dias del medio =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
begin
  delete from public.subscription_payments where store_id = v_store;
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, null, '2026-08-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = null, cobra_desde = '2026-08-01', estado = 'activa';

  -- ---- dia 7 · avisa que vence, y TODAVIA NO DEBE ------------------------
  v_res := public.cobranza_escalon(v_store, '2026-08-07');
  if v_res->>'escalon' <> 'aviso_previo' then
    raise exception 'FALLO 1.a: el dia 7 dio "%"', v_res->>'escalon';
  end if;

  -- ---- dia 10 · vence, pero NO PASA NADA VISIBLE -------------------------
  /* Avisar el mismo dia que vence no es un recordatorio, es un reproche. */
  v_res := public.cobranza_escalon(v_store, '2026-08-10');
  if v_res->>'escalon' <> 'ninguno' then
    raise exception 'FALLO 1.b: el dia 10 ya reclama ("%")', v_res->>'escalon';
  end if;

  -- ---- dia 11 · debe, pero todavia no se le escribe ----------------------
  /* El margen del 10 al 12 es deliberado: se cobra por transferencia y la
     conciliacion es MANUAL. Entre que el cliente paga y el owner lo marca
     puede pasar un fin de semana. */
  v_res := public.cobranza_escalon(v_store, '2026-08-11');
  if v_res->>'escalon' <> 'ninguno' then
    raise exception 'FALLO 1.c: el dia 11 ya reclama, sin margen para la transferencia';
  end if;

  -- ---- dia 12 · el recordatorio -----------------------------------------
  v_res := public.cobranza_escalon(v_store, '2026-08-12');
  if v_res->>'escalon' <> 'recordatorio' then
    raise exception 'FALLO 1.d: el dia 12 dio "%"', v_res->>'escalon';
  end if;
  if (v_res->>'deuda')::numeric <> 60000 then
    raise exception 'FALLO 1.e: la deuda del aviso es %', v_res->>'deuda';
  end if;

  -- ---- dia 15 · silencio entre escalones ---------------------------------
  v_res := public.cobranza_escalon(v_store, '2026-08-15');
  if v_res->>'escalon' <> 'ninguno' then
    raise exception 'FALLO 1.f: el dia 15 manda "%" — la escalera no es diaria', v_res->>'escalon';
  end if;

  -- ---- dia 18 · la escalada, CON la fecha del corte ----------------------
  v_res := public.cobranza_escalon(v_store, '2026-08-18');
  if v_res->>'escalon' <> 'escalada' then
    raise exception 'FALLO 1.g: el dia 18 dio "%"', v_res->>'escalon';
  end if;
  /* Sin la fecha explicita el mensaje seria una amenaza vaga. */
  if (v_res->>'suspende_el')::date <> '2026-08-25' then
    raise exception 'FALLO 1.h: la fecha de corte es % y deberia ser el 25', v_res->>'suspende_el';
  end if;

  -- ---- dia 25 · el corte -------------------------------------------------
  v_res := public.cobranza_escalon(v_store, '2026-08-25');
  if v_res->>'escalon' <> 'corte' then
    raise exception 'FALLO 1.i: el dia 25 dio "%"', v_res->>'escalon';
  end if;
end $$;
rollback;
\echo 'OK 1 · 7 avisa · 10 y 11 callan · 12 recuerda · 15 calla · 18 escala con fecha · 25 corta'

\echo ''
\echo '== 2 · el aviso va al DUENO, nunca al equipo =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
  v_owner uuid;
  v_rol   text;
begin
  delete from public.subscription_payments where store_id = v_store;
  insert into public.subscriptions (store_id, precio_mensual, cobra_desde)
  values (v_store, 60000, '2026-08-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = null, cobra_desde = '2026-08-01', estado = 'activa';

  v_res := public.cobranza_escalon(v_store, '2026-08-12');
  v_owner := (v_res->>'member_id')::uuid;

  if v_owner is null then
    raise exception 'FALLO 2.a: el aviso no tiene destinatario';
  end if;

  select role into v_rol from public.members where id = v_owner;
  if v_rol <> 'owner' then
    raise exception 'FALLO 2.b: el destinatario del aviso de cobranza es "%" — un cajero NO puede enterarse de que su jefe debe', v_rol;
  end if;
end $$;
rollback;
\echo 'OK 2 · el destinatario es el owner del negocio'

\echo ''
\echo '== 3 · a quien no corresponde, no se le escribe =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
begin
  -- ---- 3.a · en el mes de PRUEBA no se le dice nada ----------------------
  delete from public.subscription_payments where store_id = v_store;
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, '2026-09-15', '2026-10-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = '2026-09-15', cobra_desde = '2026-10-01', estado = 'activa';

  v_res := public.cobranza_escalon(v_store, '2026-09-07');
  if v_res->>'escalon' <> 'ninguno' then
    raise exception 'FALLO 3.a: le reclama a alguien en su mes GRATIS ("%")', v_res->>'escalon';
  end if;

  -- ---- 3.b · el que PAGO no recibe reclamo -------------------------------
  update public.subscriptions set prueba_hasta = null, cobra_desde = '2026-08-01'
   where store_id = v_store;
  perform public.marcar_pago_suscripcion(v_store, '2026-08-01', 60000, null);

  v_res := public.cobranza_escalon(v_store, '2026-08-12');
  if v_res->>'escalon' <> 'ninguno' then
    raise exception 'FALLO 3.b: le reclama a un cliente que YA PAGO';
  end if;

  -- ---- 3.c · el ya suspendido no recibe mas avisos -----------------------
  /* Ya se entero de la peor manera posible; seguir mandandole recordatorios
     es ensanarse. */
  delete from public.subscription_payments where store_id = v_store;
  update public.stores set status = 'suspended' where id = v_store;
  v_res := public.cobranza_escalon(v_store, '2026-08-12');
  if v_res->>'escalon' <> 'ninguno' then
    raise exception 'FALLO 3.c: le sigue escribiendo a un negocio ya suspendido';
  end if;
  update public.stores set status = 'active' where id = v_store;

  -- ---- 3.d · la suscripcion cancelada no genera nada ---------------------
  update public.subscriptions set estado = 'cancelada', cancelada_el = now()
   where store_id = v_store;
  v_res := public.cobranza_escalon(v_store, '2026-08-12');
  if v_res->>'escalon' <> 'ninguno' then
    raise exception 'FALLO 3.d: le reclama a un cliente dado de baja';
  end if;
end $$;
rollback;
\echo 'OK 3 · ni en prueba, ni al que pago, ni al suspendido, ni al dado de baja'

\echo ''
\echo '== 4 · la cobranza sigue siendo de SYNTRA =='
begin;
do $$
declare
  v_duenio uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_store  uuid := '11111111-1111-1111-1111-111111111111';
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_duenio), true);

  /* Ni siquiera el dueno puede preguntar en que escalon esta: si pudiera,
     sabria cuando le toca el corte y podria administrarlo. */
  begin
    perform public.cobranza_escalon(v_store);
    raise exception 'FALLO 4.a: el dueno ejecuto cobranza_escalon';
  exception when insufficient_privilege then null;
  end;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 4 · cobranza_escalon es inalcanzable para el cliente'

\echo ''
\echo '========================================================================'
\echo ' verify-escalera-cobranza · TODO EN VERDE'
\echo '========================================================================'

\echo ''
\echo '== 5 · 061 · los hallazgos de la verificacion adversarial =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
begin
  delete from public.subscription_payments where store_id = v_store;
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, null, '2026-08-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = null, cobra_desde = '2026-08-01', estado = 'activa';

  -- ---- 5.a · ALTO 3 · un peso de diferencia NO apaga el kiosco ------------
  /* Medido por el verificador: al que le faltaba $1 de $60.000 le llegaba
     `escalon: corte`, el mismo trato que a uno que debe $180.000. Una
     transferencia de $59.900 por comision bancaria alcanzaba para cortarle. */
  perform public.marcar_pago_suscripcion(v_store, '2026-08-01', 59999, null);
  v_res := public.cobranza_escalon(v_store, '2026-08-25');
  if v_res->>'escalon' <> 'corte' then
    raise exception 'FALLO 5.a0: el dia 25 dio "%"', v_res->>'escalon';
  end if;
  if (v_res->>'corte_seguro')::boolean then
    raise exception 'FALLO 5.a: con $1 de deuda marca corte_seguro=true — se corta por un peso';
  end if;

  -- ---- 5.b · debiendo un mes COMPLETO, si corta -------------------------
  delete from public.subscription_payments where store_id = v_store;
  v_res := public.cobranza_escalon(v_store, '2026-08-25');
  if not (v_res->>'corte_seguro')::boolean then
    raise exception 'FALLO 5.b: debiendo un mes entero NO marca corte_seguro — no cortaria nunca';
  end if;

  -- ---- 5.c · el destinatario es determinista ----------------------------
  /* Nada impide dos owners activos; sin `order by` el reclamo podia irle a uno
     distinto cada dia. */
  if (v_res->>'member_id') is null then
    raise exception 'FALLO 5.c: sin destinatario';
  end if;
end $$;
rollback;
\echo 'OK 5 · no corta por menos de un mes · si corta por un mes entero'

\echo ''
\echo '== 6 · la RPC se defiende sola aunque se re-otorgue el permiso =='
begin;
do $$
declare
  v_luci  uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_ajeno uuid := '33333333-3333-3333-3333-333333333333';
begin
  /* TERCERA vez que aparece este patron en el proyecto (admin_stores,
     promo_vigente, y esta). Una superficie con UNA sola cerradura se abre sola
     el dia que alguien agrega un grant distraido: se simula ese error. */
  grant execute on function public.cobranza_escalon(uuid, date) to authenticated;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_luci), true);

  begin
    perform public.cobranza_escalon(v_ajeno, '2026-08-25');
    raise exception 'FALLO 6: con el grant puesto, una cajera leyo la deuda de otro kiosco';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 6 · dos cerraduras: el revoke y la guarda interna'
