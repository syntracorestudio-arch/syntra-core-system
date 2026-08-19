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
  /* El bloque se prepara su PROPIO estado: una suite que sólo pasa con la base
     vacía es frágil — se cae en cuanto alguien siembra un fixture de demo, que
     es exactamente lo que pasó. */
  delete from public.subscription_payments where store_id = v_store;
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, '2026-09-15', '2026-10-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = '2026-09-15', cobra_desde = '2026-10-01';

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
  delete from public.subscription_payments where store_id = v_store;
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, null, '2026-08-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = null, cobra_desde = '2026-08-01';

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
  delete from public.subscription_payments where store_id = v_store;
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, null, '2026-06-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = null, cobra_desde = '2026-06-01';

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
  delete from public.subscription_payments where store_id = v_store;
  insert into public.subscriptions (store_id, precio_mensual, cobra_desde)
  values (v_store, 60000, '2026-08-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = null, cobra_desde = '2026-08-01';

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
  values (v_store, 60000, '2026-08-01')
  on conflict (store_id) do update set precio_mensual = 60000;

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

\echo ''
\echo '== 7 · 058 · los dos ataques que midio el verificador adversarial =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
begin
  insert into public.subscriptions (store_id, precio_mensual, cobra_desde)
  values (v_store, 60000, '2026-06-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = null, cobra_desde = '2026-06-01';
  delete from public.subscription_payments where store_id = v_store;

  -- ---- 7.a · A1: UN PESO NO BORRA LA DEUDA DEL MES -----------------------
  /* Medido antes de 058: con $180.000 de deuda, marcar $0 y $1 la dejaba en
     $60.000 — un peso borraba ciento veinte mil. */
  v_res := public.estado_suscripcion(v_store, '2026-08-20');
  if (v_res->>'deuda')::numeric <> 180000 then
    raise exception 'FALLO 7.a0: la deuda base es % y deberia ser 180000', v_res->>'deuda';
  end if;

  perform public.marcar_pago_suscripcion(v_store, '2026-06-01', 1, null);
  v_res := public.estado_suscripcion(v_store, '2026-08-20');
  if (v_res->>'deuda')::numeric <> 179999 then
    raise exception 'FALLO 7.a: tras pagar $1 la deuda quedo en % (deberia bajar SOLO $1)', v_res->>'deuda';
  end if;
  if not (v_res->>'parcial')::boolean then
    raise exception 'FALLO 7.b: no marca que hay un pago PARCIAL';
  end if;

  -- ---- 7.c · y el resto SI se puede completar ----------------------------
  /* Antes era imposible: el UNIQUE mataba el segundo pago del mismo mes. */
  perform public.marcar_pago_suscripcion(v_store, '2026-06-01', 59999, null);
  v_res := public.estado_suscripcion(v_store, '2026-08-20');
  if (v_res->>'deuda')::numeric <> 120000 then
    raise exception 'FALLO 7.c: tras completar junio la deuda es % y deberia ser 120000', v_res->>'deuda';
  end if;

  -- ---- 7.d · pagar de mas se rechaza ------------------------------------
  begin
    perform public.marcar_pago_suscripcion(v_store, '2026-07-01', 90000, null);
    raise exception 'FALLO 7.d: acepto un pago mayor a lo adeudado del mes';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'monto_excede_lo_adeudado' then raise; end if;
  end;

  -- ---- 7.e · el doble click sigue bloqueado (lo que daba el UNIQUE) ------
  perform public.marcar_pago_suscripcion(v_store, '2026-07-01', 60000, null);
  begin
    perform public.marcar_pago_suscripcion(v_store, '2026-07-01', 60000, null);
    raise exception 'FALLO 7.e: se asento el mismo pago dos veces';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'periodo_ya_pagado' then raise; end if;
  end;

  -- ---- 7.f · A2: el periodo equivocado ya no entra -----------------------
  /* Medido antes de 058: 2025-06-01 y 2030-06-01 se guardaban, la UI decia
     "registrado" y la deuda no se movia. En un input type=date, errarle al
     anio es UN CLICK. */
  begin
    perform public.marcar_pago_suscripcion(v_store, '2025-06-01', 60000, null);
    raise exception 'FALLO 7.f: acepto un periodo ANTERIOR al alta';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'periodo_anterior_al_alta' then raise; end if;
  end;

  begin
    perform public.marcar_pago_suscripcion(v_store, '2030-06-01', 60000, null);
    raise exception 'FALLO 7.g: acepto un periodo FUTURO';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'periodo_futuro' then raise; end if;
  end;

  -- ---- 7.h · M1: no se paga sobre un negocio sin suscripcion -------------
  /* La condicion se CREA acá en vez de asumirla: el intento anterior daba por
     hecho que este negocio no tenia plan, y con un fixture sembrado el test
     probaba otra cosa (fallaba por `periodo_anterior_al_alta`). */
  delete from public.subscriptions where store_id = '22222222-2222-2222-2222-222222222222';
  begin
    perform public.marcar_pago_suscripcion(
      '22222222-2222-2222-2222-222222222222', '2026-08-01', 60000, null);
    raise exception 'FALLO 7.h: asento plata en un negocio SIN suscripcion';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'sin_suscripcion' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 7 · $1 baja $1 (no el mes) · se completa el resto · doble click bloqueado'
\echo '       · periodo viejo/futuro rechazado · sin suscripcion no se cobra'

\echo ''
\echo '== 8 · M3 · service_role puede leer las tablas (bomba de runtime) =='
begin;
do $$
declare v_n bigint;
begin
  /* 057 sólo revocó de authenticated/anon y el ACL por defecto dejaba a
     service_role SIN select. No se notaba porque /super lee la vista y llama
     RPCs security definer — pero la primera linea que haga
     `admin.from("subscriptions")` revienta en runtime, no en tsc. */
  perform set_config('role', 'service_role', true);
  select count(*) into v_n from public.subscriptions;
  select count(*) into v_n from public.subscription_payments;
  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 8 · service_role lee las dos tablas'

\echo ''
\echo '== 9 · 062 · el precio de cada mes queda CONGELADO =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
  v_deuda numeric;
begin
  delete from public.subscription_payments where store_id = v_store;
  delete from public.subscription_prices   where store_id = v_store;
  insert into public.subscriptions (store_id, precio_mensual, prueba_hasta, cobra_desde)
  values (v_store, 60000, null, '2026-06-01')
  on conflict (store_id) do update set precio_mensual = 60000,
    prueba_hasta = null, cobra_desde = '2026-06-01', estado = 'activa';
  insert into public.subscription_prices (store_id, desde, precio, motivo)
  values (v_store, '2026-06-01', 60000, 'inicial');

  -- Debe junio, julio y agosto a $60.000 = $180.000
  v_res := public.estado_suscripcion(v_store, '2026-08-20');
  if (v_res->>'deuda')::numeric <> 180000 then
    raise exception 'FALLO 9.a: la deuda base es %', v_res->>'deuda';
  end if;

  /* La decision del owner: "si un cliente esta moroso el valor de los meses que
     deba los vamos a dejar congelados". Antes de 062, `deuda` se calculaba como
     meses x precio ACTUAL, asi que subir la cuota le subia retroactivamente lo
     adeudado sin que nadie pagara ni dejara de pagar. */
  insert into public.subscription_prices (store_id, desde, precio, motivo)
  values (v_store, '2026-09-01', 90000, 'aumento');
  update public.subscriptions set precio_mensual = 90000 where store_id = v_store;

  v_res := public.estado_suscripcion(v_store, '2026-08-20');
  v_deuda := (v_res->>'deuda')::numeric;
  if v_deuda <> 180000 then
    raise exception 'FALLO 9.b: tras el aumento la deuda VIEJA paso a % — se re-tarifo', v_deuda;
  end if;

  -- Y septiembre, cuando venza, si vale el precio nuevo.
  v_res := public.estado_suscripcion(v_store, '2026-09-20');
  if (v_res->>'deuda')::numeric <> 270000 then
    raise exception 'FALLO 9.c: septiembre deberia sumar $90.000 (total 270000), vino %', v_res->>'deuda';
  end if;
end $$;
rollback;
\echo 'OK 9 · el aumento no toca los meses viejos · el mes nuevo si vale el precio nuevo'

\echo ''
\echo '== 10 · 062 · el alta no deja tipear fechas =='
begin;
do $$
declare
  v_store uuid := '22222222-2222-2222-2222-222222222222';
  v_sub   public.subscriptions;
  v_esp   date;
begin
  delete from public.subscription_prices   where store_id = v_store;
  delete from public.subscription_payments where store_id = v_store;
  delete from public.subscriptions         where store_id = v_store;

  /* Los dos tipeos que midio el verificador (cobra_desde con la fecha del alta,
     y prueba_hasta solapado con cobra_desde) dejan de ser posibles: el alta no
     recibe fechas. Un campo que no existe no se puede tipear mal. */
  v_sub := public.crear_suscripcion(v_store, 60000, null, true);

  -- La prueba dura UN MES desde el alta, no hasta fin de mes.
  if v_sub.prueba_hasta <> (current_date + interval '1 month')::date then
    raise exception 'FALLO 10.a: prueba_hasta = %', v_sub.prueba_hasta;
  end if;

  -- Y se cobra desde el mes SIGUIENTE al que termina la prueba.
  v_esp := (date_trunc('month', (current_date + interval '1 month')) + interval '1 month')::date;
  if v_sub.cobra_desde <> v_esp then
    raise exception 'FALLO 10.b: cobra_desde = % y deberia ser %', v_sub.cobra_desde, v_esp;
  end if;

  -- Durante la prueba no debe nada, que era el otro tipeo peligroso.
  if public.estado_suscripcion(v_store, current_date + 5)->>'estado' <> 'prueba' then
    raise exception 'FALLO 10.c: al alta con prueba ya le reclama';
  end if;

  -- ---- 10.d · no se duplica ---------------------------------------------
  begin
    perform public.crear_suscripcion(v_store, 60000, null, true);
    raise exception 'FALLO 10.d: creo una segunda suscripcion para el mismo negocio';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'ya_tiene_suscripcion' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 10 · las fechas las calcula la base · un mes de prueba real · no se duplica'

\echo ''
\echo '== 11 · 062 · el aumento rige desde el mes que viene, con motivo =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_res   jsonb;
begin
  insert into public.subscriptions (store_id, precio_mensual, cobra_desde)
  values (v_store, 60000, '2026-06-01')
  on conflict (store_id) do update set precio_mensual = 60000, estado = 'activa';

  -- ---- 11.a · sin motivo no se cambia el precio -------------------------
  begin
    perform public.cambiar_precio_suscripcion(v_store, 90000, 'corto', null);
    raise exception 'FALLO 11.a: acepto un motivo de 5 caracteres';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'motivo_requerido' then raise; end if;
  end;

  -- ---- 11.b · rige desde el mes SIGUIENTE -------------------------------
  /* Nunca desde el mes en curso: si ya pago este mes y se lo subimos a mitad,
     pasaria a deber la diferencia de un mes que ya saldo. */
  v_res := public.cambiar_precio_suscripcion(v_store, 90000, 'aumento por inflacion acumulada', null);
  if (v_res->>'desde')::date <> (date_trunc('month', current_date) + interval '1 month')::date then
    raise exception 'FALLO 11.b: el precio nuevo rige desde %', v_res->>'desde';
  end if;
end $$;
rollback;
\echo 'OK 11 · motivo obligatorio · el precio nuevo rige desde el mes que viene'
