-- ===========================================================================
-- verify-suscripciones.sql — 057
--
-- Todo se prueba con FECHA INYECTADA (`p_hoy`), nunca con `current_date`: un
-- test de cobranza que depende del día en que se corre pasa en agosto y falla
-- en septiembre, y nadie entiende por qué. Ya nos pasó con `verify-promos` y
-- las fechas en UTC.
-- ===========================================================================
\set ON_ERROR_STOP on

\echo ''
\echo '== 1 · el MES DE PRUEBA no debe nada =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
begin
  -- Alta el 15 de agosto: prueba hasta el 15 de septiembre, cobra desde octubre.
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, '2026-09-15', '2026-10-01');

  -- Durante la prueba: nada que cobrar, ni siquiera pasado un día 10.
  v_res := public.estado_suscripcion(v_store, '2026-09-12');
  if v_res->>'estado' <> 'prueba' then
    raise exception 'FALLO 1.a: en el mes de prueba el estado es "%"', v_res->>'estado';
  end if;

  -- El día que termina la prueba, todavía es prueba (el <= importa).
  v_res := public.estado_suscripcion(v_store, '2026-09-15');
  if v_res->>'estado' <> 'prueba' then
    raise exception 'FALLO 1.b: el último día de prueba ya cobra';
  end if;

  /* Al día siguiente se sale de la prueba, pero OCTUBRE todavía no venció:
     no debe nada. Es el hueco entre "se terminó la prueba" y "hay algo
     impago", y confundirlo haría que el cliente reciba un reclamo el mismo
     día que empieza a pagar. */
  v_res := public.estado_suscripcion(v_store, '2026-09-16');
  if v_res->>'estado' <> 'al_dia' then
    raise exception 'FALLO 1.c: recién terminada la prueba el estado es "%" y debería ser al_dia', v_res->>'estado';
  end if;
end $$;
rollback;
\echo 'OK 1 · durante la prueba no debe · el último día tampoco · al salir queda al día'

\echo ''
\echo '== 2 · la regla del DÍA 10 =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
begin
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, null, '2026-08-01');

  -- ---- 2.a · el día 10 TODAVÍA no debe: tiene todo el día para pagar ------
  v_res := public.estado_suscripcion(v_store, '2026-08-10');
  if v_res->>'estado' <> 'al_dia' then
    raise exception 'FALLO 2.a: el día 10 ya lo marca deudor — le come el último día de plazo';
  end if;

  -- ---- 2.b · el 11 sí ----------------------------------------------------
  v_res := public.estado_suscripcion(v_store, '2026-08-11');
  if v_res->>'estado' <> 'debe' then
    raise exception 'FALLO 2.b: el 11 no lo marca deudor (estado "%")', v_res->>'estado';
  end if;
  if (v_res->>'dias_de_atraso')::int <> 1 then
    raise exception 'FALLO 2.c: el 11 el atraso es % y debería ser 1', v_res->>'dias_de_atraso';
  end if;
  if (v_res->>'deuda')::numeric <> 60000 then
    raise exception 'FALLO 2.d: la deuda es % y debería ser 60000', v_res->>'deuda';
  end if;
end $$;
rollback;
\echo 'OK 2 · el día 10 tiene plazo · el 11 debe, con 1 día de atraso y $60.000'

\echo ''
\echo '== 3 · varios meses impagos: cuántos y DESDE CUÁNDO =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
begin
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, null, '2026-06-01');

  -- Pagó junio, no pagó julio ni agosto.
  perform public.marcar_pago_suscripcion(v_store, '2026-06-01', 60000, null);

  v_res := public.estado_suscripcion(v_store, '2026-08-20');
  if v_res->>'estado' <> 'debe' then
    raise exception 'FALLO 3.a: estado "%"', v_res->>'estado';
  end if;
  if (v_res->>'meses_impagos')::int <> 2 then
    raise exception 'FALLO 3.b: cuenta % meses impagos y son 2 (julio y agosto)', v_res->>'meses_impagos';
  end if;
  -- La pregunta que importa cuando hay que cortar el servicio.
  if (v_res->>'desde')::date <> '2026-07-01' then
    raise exception 'FALLO 3.c: dice que debe desde % y es desde julio', v_res->>'desde';
  end if;
  if (v_res->>'deuda')::numeric <> 120000 then
    raise exception 'FALLO 3.d: la deuda es % y son 120000', v_res->>'deuda';
  end if;

  -- ---- 3.e · pagar el mes viejo mueve el "desde" -------------------------
  perform public.marcar_pago_suscripcion(v_store, '2026-07-01', 60000, null);
  v_res := public.estado_suscripcion(v_store, '2026-08-20');
  if (v_res->>'meses_impagos')::int <> 1 or (v_res->>'desde')::date <> '2026-08-01' then
    raise exception 'FALLO 3.e: tras pagar julio quedan % meses desde %',
      v_res->>'meses_impagos', v_res->>'desde';
  end if;

  -- ---- 3.f · al pagar todo, vuelve a al_dia ------------------------------
  perform public.marcar_pago_suscripcion(v_store, '2026-08-01', 60000, null);
  v_res := public.estado_suscripcion(v_store, '2026-08-20');
  if v_res->>'estado' <> 'al_dia' then
    raise exception 'FALLO 3.f: pagó todo y sigue en "%"', v_res->>'estado';
  end if;
end $$;
rollback;
\echo 'OK 3 · cuenta los meses, dice desde cuándo, y saldar limpia el estado'

\echo ''
\echo '== 4 · un mes no se puede pagar dos veces =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
begin
  insert into public.subscriptions (store_id, precio_mensual, cobra_desde)
  values (v_store, 60000, '2026-08-01');

  perform public.marcar_pago_suscripcion(v_store, '2026-08-01', 60000, null);

  /* Sin esto, un doble click deja al cliente "al día" por partida doble y la
     suma de ingresos del mes miente hacia arriba. */
  begin
    perform public.marcar_pago_suscripcion(v_store, '2026-08-01', 60000, null);
    raise exception 'FALLO 4.a: marcó el mismo mes dos veces';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'periodo_ya_pagado' then raise; end if;
  end;

  -- Y da igual qué día del mes se mande: se normaliza al 1.
  begin
    perform public.marcar_pago_suscripcion(v_store, '2026-08-23', 60000, null);
    raise exception 'FALLO 4.b: el 23 de agosto entró como un período distinto';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'periodo_ya_pagado' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 4 · el UNIQUE corta el doble cobro · cualquier día del mes es el mismo período'

\echo ''
\echo '== 5 · la cobranza es de SYNTRA: el cliente no la ve =='
begin;
do $$
declare
  v_duenio uuid := 'aaaaaaaa-0000-0000-0000-000000000001';  -- dueno@eltrebol.test
  v_store  uuid := '11111111-1111-1111-1111-111111111111';
  v_n      bigint;
begin
  insert into public.subscriptions (store_id, precio_mensual, cobra_desde)
  values (v_store, 60000, '2026-08-01');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_duenio), true);

  /* El dueño NO lee su propia suscripción. Lo que él tiene que saber —"debés
     agosto"— le llega por su aviso, redactado para él. Darle la tabla expone
     el precio de los demás el día que haya más de un plan. */
  begin
    select count(*) into v_n from public.subscriptions;
    raise exception 'FALLO 5.a: el dueño leyó la tabla de suscripciones (% filas)', v_n;
  exception when insufficient_privilege then null;
  end;

  begin
    select count(*) into v_n from public.subscription_payments;
    raise exception 'FALLO 5.b: el dueño leyó los pagos de suscripción';
  exception when insufficient_privilege then null;
  end;

  -- Tampoco puede preguntar por la RPC.
  begin
    perform public.estado_suscripcion(v_store);
    raise exception 'FALLO 5.c: el dueño ejecutó estado_suscripcion';
  exception when insufficient_privilege then null;
  end;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 5 · ni las tablas ni la RPC son alcanzables por el cliente'

\echo ''
\echo '== 6 · la vista del panel arregla las dos señales de salud =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_ult   timestamptz;
  v_30d   bigint;
begin
  -- Una venta ANULADA no puede contar como pulso de uso: "última venta" es
  -- justamente la señal de abandono (019:50 no filtraba por estado).
  update public.sales set status = 'voided'
   where store_id = v_store
     and sold_at = (select max(sold_at) from public.sales where store_id = v_store);

  select ultima_venta, ventas_30d into v_ult, v_30d
    from public.admin_stores where id = v_store;

  if exists (
    select 1 from public.sales
     where store_id = v_store and status = 'voided' and sold_at = v_ult
  ) then
    raise exception 'FALLO 6.a: ultima_venta apunta a una venta ANULADA';
  end if;

  if v_30d is null then
    raise exception 'FALLO 6.b: falta la ventana de 30 días';
  end if;
end $$;
rollback;
\echo 'OK 6 · ultima_venta ignora las anuladas · existe la ventana de 30 días'

\echo ''
\echo '========================================================================'
\echo ' verify-suscripciones · TODO EN VERDE'
\echo '========================================================================'
