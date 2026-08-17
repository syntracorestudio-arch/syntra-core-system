-- ===========================================================================
-- verify-trazabilidad.sql — 055
--
-- Prueba las tres propiedades que hacen que esta tabla signifique algo. Si
-- alguna se cae, la bitácora sigue existiendo pero deja de ser una prueba.
-- ===========================================================================
\set ON_ERROR_STOP on

\echo ''
\echo '== 1 · APPEND-ONLY: nadie edita ni borra, tampoco el que escribe =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_duena uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_id    uuid;
begin
  insert into public.platform_audit (actor_id, actor_email, action, reason, target_store)
  values (v_duena, 'syntra@test', 'negocio_suspendido', 'motivo de prueba largo', v_store)
  returning id into v_id;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_duena), true);

  /* El DUEÑO la LEE (punto 3), pero no puede reescribir su historia.
     El rechazo llega como `insufficient_privilege` y no como "0 filas": la
     tabla no tiene GRANT de update/delete para nadie, que es más fuerte que
     no tener policy — sin grant no hay forma de llegar siquiera a evaluarla. */
  begin
    update public.platform_audit set reason = 'otro motivo' where id = v_id;
    raise exception 'FALLO 1.a: el dueño pudo EDITAR una fila de auditoría';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.platform_audit where id = v_id;
    raise exception 'FALLO 1.b: el dueño pudo BORRAR una fila de auditoría';
  exception when insufficient_privilege then null;
  end;

  -- Y tampoco puede fabricar una.
  begin
    insert into public.platform_audit (actor_id, actor_email, action, reason, target_store)
    values (v_duena, 'falso@test', 'negocio_reactivado', 'me reactivo yo solo', v_store);
    raise exception 'FALLO 1.c: el dueño pudo INSERTAR una fila de auditoría';
  exception when insufficient_privilege then null;
  end;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 1 · ni editar, ni borrar, ni insertar'

\echo ''
\echo '== 2 · el MOTIVO no es opcional ni decorativo =='
begin;
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_duena uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  -- Vacío.
  begin
    perform public.registrar_accion_plataforma(v_duena, 'syntra@test', 'negocio_suspendido', '', v_store);
    raise exception 'FALLO 2.a: aceptó un motivo vacío';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'reason_requerido' then raise; end if;
  end;

  -- Corto: "test" no le explica a nadie por qué se quedó sin caja.
  begin
    perform public.registrar_accion_plataforma(v_duena, 'syntra@test', 'negocio_suspendido', 'test', v_store);
    raise exception 'FALLO 2.b: aceptó un motivo de 4 caracteres';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'reason_requerido' then raise; end if;
  end;

  -- Espacios: el check mira el trim, no el largo crudo.
  begin
    perform public.registrar_accion_plataforma(v_duena, 'syntra@test', 'negocio_suspendido', '              ', v_store);
    raise exception 'FALLO 2.c: aceptó 14 espacios como motivo';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'reason_requerido' then raise; end if;
  end;
end $$;
rollback;
\echo 'OK 2 · vacío, corto y espacios rechazados'

\echo ''
\echo '== 3 · el DUEÑO ve lo suyo y NADA del negocio de al lado =='
begin;
do $$
declare
  v_store1 uuid := '11111111-1111-1111-1111-111111111111';
  v_store2 uuid := '22222222-2222-2222-2222-222222222222';
  v_duena1 uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_luci   uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_n      bigint;
begin
  insert into public.platform_audit (actor_id, actor_email, action, reason, target_store)
  values (null, 'syntra@test', 'negocio_suspendido', 'falta de pago de agosto', v_store1),
         (null, 'syntra@test', 'negocio_suspendido', 'falta de pago del vecino', v_store2);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_duena1), true);

  select count(*) into v_n from public.platform_audit;
  if v_n <> 1 then
    raise exception 'FALLO 3.a: la dueña ve % filas y debería ver SOLO la suya', v_n;
  end if;

  -- La CAJERA no ve ninguna: es la relación de SYNTRA con el dueño.
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_luci), true);
  select count(*) into v_n from public.platform_audit;
  if v_n <> 0 then
    raise exception 'FALLO 3.b: una cajera leyó % filas de auditoría', v_n;
  end if;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 3 · la dueña ve la suya, no la del vecino; la cajera no ve ninguna'

\echo ''
\echo '========================================================================'
\echo ' verify-trazabilidad · TODO EN VERDE'
\echo '========================================================================'
