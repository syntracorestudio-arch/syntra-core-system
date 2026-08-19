-- ===========================================================================
-- verify-aviso-suscripcion.sql — 063
--
-- El banner existe porque el push es efímero: si al dueño se le pasa la
-- burbuja, hasta ahora no tenía forma de enterarse de que debía, y el 25 se le
-- suspendía el negocio.
--
-- Lo que hay que probar no es que aparezca: es QUIÉN lo ve. Que un cajero se
-- entere de que su jefe debe la suscripción es humillante para el cliente, y es
-- una restricción dura del owner.
-- ===========================================================================
\set ON_ERROR_STOP on

\echo ''
\echo '== 1 · el DUENO ve su deuda =='
begin;
do $$
declare
  v_store  uuid := '11111111-1111-1111-1111-111111111111';
  v_duenio uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_res    jsonb;
begin
  delete from public.subscription_payments where store_id = v_store;
  delete from public.subscription_prices   where store_id = v_store;
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, null, '2026-06-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = null, cobra_desde = '2026-06-01', estado = 'activa';
  insert into public.subscription_prices (store_id, desde, precio, motivo)
  values (v_store, '2026-06-01', 60000, 'test');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_duenio), true);

  v_res := public.mi_suscripcion();
  if v_res->>'estado' <> 'debe' then
    raise exception 'FALLO 1.a: el dueno no ve su propia deuda ("%")', v_res->>'estado';
  end if;
  if (v_res->>'deuda')::numeric <= 0 then
    raise exception 'FALLO 1.b: la deuda que ve es %', v_res->>'deuda';
  end if;
  /* El dato accionable: sin fecha, el aviso es una amenaza vaga. */
  if (v_res->>'suspende_el') is null then
    raise exception 'FALLO 1.c: no dice cuando se suspende';
  end if;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 1 · el dueno ve cuanto debe y desde cuando, con la fecha del corte'

\echo ''
\echo '== 2 · el EMPLEADO no ve nada — restriccion dura =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_luci  uuid := 'aaaaaaaa-0000-0000-0000-000000000002';  -- cajera del MISMO negocio
  v_sofia uuid := '22b9e8aa-7e92-4af5-b193-b94c4bfbed8b';  -- empleada de OTRO
  v_res   jsonb;
begin
  delete from public.subscription_payments where store_id = v_store;
  delete from public.subscription_prices   where store_id = v_store;
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, null, '2026-06-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = null, cobra_desde = '2026-06-01', estado = 'activa';
  insert into public.subscription_prices (store_id, desde, precio, motivo)
  values (v_store, '2026-06-01', 60000, 'test');

  -- ---- 2.a · la cajera del propio negocio --------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_luci), true);

  v_res := public.mi_suscripcion();
  if v_res->>'estado' <> 'no_corresponde' then
    raise exception 'FALLO 2.a: una CAJERA vio el estado de cobranza de su jefe ("%") — es humillante para el cliente', v_res->>'estado';
  end if;
  if v_res ? 'deuda' then
    raise exception 'FALLO 2.b: el payload le filtra el monto adeudado a la cajera';
  end if;

  -- ---- 2.c · una empleada de otro negocio --------------------------------
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_sofia), true);
  v_res := public.mi_suscripcion();
  if v_res ? 'deuda' then
    raise exception 'FALLO 2.c: una empleada de otro negocio ve deuda ajena';
  end if;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 2 · ni la cajera del propio negocio ni la de otro ven nada'

\echo ''
\echo '== 3 · se apaga solo al pagar =='
begin;
do $$
declare
  v_store  uuid := '11111111-1111-1111-1111-111111111111';
  v_duenio uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_res    jsonb;
  v_mes    date;
begin
  delete from public.subscription_payments where store_id = v_store;
  delete from public.subscription_prices   where store_id = v_store;
  v_mes := (date_trunc('month', current_date) - interval '1 month')::date;
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, null, v_mes)
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = null, cobra_desde = v_mes, estado = 'activa';
  insert into public.subscription_prices (store_id, desde, precio, motivo)
  values (v_store, v_mes, 60000, 'test');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_duenio), true);
  if public.mi_suscripcion()->>'estado' <> 'debe' then
    raise exception 'FALLO 3.a: no arranca debiendo';
  end if;

  /* El estado se DERIVA de los pagos, no de un flag: por eso el banner se apaga
     solo. Un aviso que hay que acordarse de borrar termina mintiendo.

     Se saldan TODOS los meses vencidos, no sólo el primero: con `cobra_desde`
     el mes pasado y hoy despues del dia 10, hay DOS vencidos. El primer intento
     de este test pagaba uno solo y daba rojo — el fixture estaba mal, no el
     codigo. */
  perform set_config('role', 'postgres', true);
  perform public.marcar_pago_suscripcion(v_store, v_mes, 60000, null);
  if extract(day from current_date) > 10 then
    perform public.marcar_pago_suscripcion(
      v_store, date_trunc('month', current_date)::date, 60000, null);
  end if;

  perform set_config('role', 'authenticated', true);
  v_res := public.mi_suscripcion();
  if v_res->>'estado' <> 'al_dia' then
    raise exception 'FALLO 3.b: pago y el aviso sigue diciendo que debe ("%")', v_res->>'estado';
  end if;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 3 · al saldar, el aviso desaparece sin que nadie lo apague'

\echo ''
\echo '========================================================================'
\echo ' verify-aviso-suscripcion · TODO EN VERDE'
\echo '========================================================================'
