-- ===========================================================================
-- verify-plataforma-acceso.sql — 056
--
-- Tres propiedades. Las tres se prueban en LAS DOS DIRECCIONES, porque un gate
-- que nadie vio fallar no es un gate: es una intención.
-- ===========================================================================
\set ON_ERROR_STOP on

\echo ''
\echo '== 1 · el flag de superadmin ya no se otorga a mano =='
begin;
do $$
declare
  /* Los emails importan: la RPC recibe email, no uuid. Se dejan al lado del
     uuid para que un fixture desalineado se vea de una — el primer intento de
     este test asumió otro email para este uuid y "probó" el caso equivocado. */
  v_duenio uuid := 'aaaaaaaa-0000-0000-0000-000000000001';  -- dueno@eltrebol.test
  c_yo     text := 'dueno@eltrebol.test';                   -- el actor
  c_otro   text := 'cajero@eltrebol.test';                  -- alguien más
  v_res   jsonb;
begin
  -- ---- 1.a · un DUEÑO no puede hacerse superadmin ------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_duenio), true);

  begin
    perform public.otorgar_superadmin(c_yo, 'me asciendo yo solo sin permiso');
    raise exception 'FALLO 1.a: un dueño de kiosco se otorgó superadmin';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;

  -- ---- 1.b · tampoco escribiendo la columna directo ----------------------
  /* Es el mismo agujero que 049 cerró: la policy es de FILA, el recorte por
     columna es GRANT. Si esto pasara, la RPC sería decorativa. */
  begin
    update public.profiles set is_superadmin = true where id = v_duenio;
    raise exception 'FALLO 1.b: un dueño escribió is_superadmin directo';
  exception when insufficient_privilege then null;
  end;

  -- ---- 1.c · un superadmin SÍ puede otorgarlo ---------------------------
  perform set_config('role', 'postgres', true);
  update public.profiles set is_superadmin = true where id = v_duenio;

  perform set_config('role', 'authenticated', true);
  v_res := public.otorgar_superadmin(c_otro, 'alta de un segundo operador de plataforma');
  if not (v_res->>'es_superadmin')::boolean then
    raise exception 'FALLO 1.c: el superadmin no pudo otorgar el flag';
  end if;

  -- ---- 1.d · el motivo no es opcional -----------------------------------
  begin
    perform public.otorgar_superadmin(c_otro, 'corto');
    raise exception 'FALLO 1.d: aceptó un motivo de 5 caracteres';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'reason_requerido' then raise; end if;
  end;

  -- ---- 1.e · no podés quitártelo a vos mismo ----------------------------
  /* El último superadmin sacándose el permiso deja la plataforma sin NADIE que
     pueda otorgarlo, y la única salida vuelve a ser abrir la base a mano —
     justo lo que 056 existe para evitar. */
  begin
    perform public.otorgar_superadmin(c_yo, 'me quito el permiso a mí mismo', true);
    raise exception 'FALLO 1.e: se quitó el flag a sí mismo';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'no_te_podes_quitar_a_vos_mismo' then raise; end if;
  end;

  -- ---- 1.f · pero sí puede quitárselo a OTRO ----------------------------
  v_res := public.otorgar_superadmin(c_otro, 'baja del operador de plataforma', true);
  if (v_res->>'es_superadmin')::boolean then
    raise exception 'FALLO 1.f: no pudo revocar el flag de otro';
  end if;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 1 · el dueño no puede (ni por RPC ni por UPDATE) · el superadmin sí'
\echo '       · motivo obligatorio · no se puede quitar a sí mismo · sí a otro'

\echo ''
\echo '== 2 · el dueño no puede tocar las columnas que no son suyas =='
begin;
do $$
declare
  v_duenio uuid := 'aaaaaaaa-0000-0000-0000-000000000001';  -- dueno@eltrebol.test
  v_store  uuid := '11111111-1111-1111-1111-111111111111';  -- su negocio
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_duenio), true);

  -- ---- 2.a · `status` es la guarda de acceso Y el apalancamiento de cobro --
  begin
    update public.stores set status = 'active' where id = v_store;
    raise exception 'FALLO 2.a: el dueño escribió stores.status — puede desuspenderse solo';
  exception when insufficient_privilege then null;
  end;

  -- ---- 2.b · el add-on pago no se prende solo ---------------------------
  begin
    update public.stores set ai_assistant_enabled = true where id = v_store;
    raise exception 'FALLO 2.b: el dueño se activó el Asistente IA (add-on pago)';
  exception when insufficient_privilege then null;
  end;

  -- ---- 2.c · el slug es el código con el que entran sus empleados -------
  begin
    update public.stores set slug = 'otro-slug' where id = v_store;
    raise exception 'FALLO 2.c: el dueño cambió el slug — rompe el login de su equipo';
  exception when insufficient_privilege then null;
  end;

  -- ---- 2.d · pero SÍ edita lo suyo, que es lo que la app usa ------------
  /* Si esto fallara, el recorte habría roto la pantalla de configuración: el
     gate tiene que dejar pasar el camino legítimo. */
  update public.stores set name = 'Kiosco El Trébol', timezone = 'America/Argentina/Buenos_Aires'
   where id = v_store;

  perform set_config('role', 'postgres', true);
end $$;
rollback;
\echo 'OK 2 · status, ai_assistant_enabled y slug cerrados · name y timezone siguen abiertos'

\echo ''
\echo '== 3 · create_store guarda QUIÉN dio de alta =='
begin;
do $$
declare
  v_actor  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_nuevo  uuid;
  v_store  public.stores;
  v_member public.members;
begin
  -- Un profile nuevo, sin negocio: el candidato a dueño.
  insert into auth.users (id, email, encrypted_password, email_confirmed_at,
                          instance_id, aud, role)
  values (gen_random_uuid(), 'nuevo-056@test.local', '', now(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  returning id into v_nuevo;

  v_store := public.create_store('Kiosco Test 056', 'kiosco-test-056', v_nuevo,
                                 'Dueño Test', null, v_actor);

  if v_store.created_by is distinct from v_actor then
    raise exception 'FALLO 3.a: stores.created_by quedó % en vez del actor', v_store.created_by;
  end if;

  select * into v_member from public.members
   where store_id = v_store.id and role = 'owner';
  if v_member.created_by is distinct from v_actor then
    raise exception 'FALLO 3.b: members.created_by quedó % en vez del actor', v_member.created_by;
  end if;
end $$;
rollback;
\echo 'OK 3 · stores.created_by y members.created_by dejan de ser siempre NULL'

\echo ''
\echo '========================================================================'
\echo ' verify-plataforma-acceso · TODO EN VERDE'
\echo '========================================================================'
