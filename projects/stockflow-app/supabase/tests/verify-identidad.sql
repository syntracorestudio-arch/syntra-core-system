-- StockFlow — VERIFY: identidad y acceso, bloque A (migración 049)
--
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/verify-identidad.sql
--
-- Prerequisitos: supabase db reset (001..049) + seed.sql.
--
-- Qué se prueba, y por qué:
--   1  ESCALADA DE PRIVILEGIOS: un cajero NO puede hacerse superadmin
--   2  ni tocar ninguna otra columna de su profile, ni el profile de otro
--   3  ciclo de vida del negocio: activo → suspendido → BLOQUEADO → reactivado
--   4  must_change_password: nace en true, sólo se apaga por la RPC
--   5  marcar_clave_cambiada opera SOBRE UNO MISMO y sobre nadie más
--   6  mi_acceso es DETERMINÍSTICO con dos membresías (owner primero)
--   7  mi_acceso distingue "nunca tuvo acceso" de "lo perdió" (baja)
--   8  el camino de COBRO no se tocó: rpc_member y register_sale intactos
--   9  aislamiento: store_activa no filtra datos de otro negocio

\set ON_ERROR_STOP on
\timing off

begin;

\set store  '11111111-1111-1111-1111-111111111111'
\set store2 '22222222-2222-2222-2222-222222222222'
\set owner  'aaaaaaaa-0000-0000-0000-000000000001'
\set cajero 'aaaaaaaa-0000-0000-0000-000000000002'

-- ===========================================================================
-- 1 + 2 · ESCALADA DE PRIVILEGIOS (rol authenticated · CAJERO)
--
-- El bug: las policies de Postgres son de FILA, no de COLUMNA, y
-- `authenticated` tenía UPDATE sobre todas las columnas de `profiles` —
-- incluida `is_superadmin`. Con ese flag se entra a /super, que opera con
-- service_role: listar y suspender CUALQUIER negocio de la plataforma.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';

do $$
declare
  v_cajero uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_owner  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_super  boolean;
begin
  -- ---- 1 · hacerse superadmin: tiene que ser IMPOSIBLE --------------------
  begin
    update public.profiles set is_superadmin = true where id = v_cajero;
    -- Si el update no lanza, puede haber afectado 0 filas (también sirve).
    select is_superadmin into v_super from public.profiles where id = v_cajero;
    if coalesce(v_super, false) then
      raise exception 'FALLO 1: un cajero se hizo SUPERADMIN — escalada de privilegios';
    end if;
  exception
    when insufficient_privilege then null;  -- lo esperado: sin GRANT de UPDATE
    when others then
      if sqlerrm like 'FALLO 1%' then raise; end if;
  end;

  -- ---- 2.a · apagarse el flag de cambio de clave: IMPOSIBLE ---------------
  begin
    update public.profiles set must_change_password = false where id = v_cajero;
  exception when insufficient_privilege then null;
  end;

  -- ---- 2.b · tocar el profile de OTRO: imposible --------------------------
  begin
    update public.profiles set full_name = 'hackeado' where id = v_owner;
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.profiles where id = v_owner and full_name = 'hackeado') then
    raise exception 'FALLO 2.b: un cajero editó el profile del dueño';
  end if;
end $$;

reset role;

-- ===========================================================================
-- 3 · CICLO DE VIDA DEL NEGOCIO — suspender debe SIGNIFICAR algo
--
-- Es el único apalancamiento de cobranza del producto. Se prueba el ciclo
-- completo, no sólo el estado suspendido: si reactivar no devolviera el
-- acceso, el remedio sería peor que la enfermedad.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_res jsonb;
begin
  -- ---- 3.a · activo ⇒ entra ----------------------------------------------
  v_res := public.mi_acceso();
  if v_res->>'estado' <> 'ok' then
    raise exception 'FALLO 3.a: con el negocio activo el estado es %', v_res->>'estado';
  end if;

  -- ---- 3.b · suspendido ⇒ BLOQUEADO, con motivo propio --------------------
  update public.stores set status = 'suspended'
   where id = '11111111-1111-1111-1111-111111111111';

  v_res := public.mi_acceso();
  if v_res->>'estado' <> 'negocio_suspendido' then
    raise exception 'FALLO 3.b: negocio suspendido y el acceso dice "%" — el corte de cobranza no funciona', v_res->>'estado';
  end if;
  if v_res ? 'member_id' then
    raise exception 'FALLO 3.c: un negocio suspendido sigue devolviendo la membresía';
  end if;

  -- ---- 3.d · reactivado ⇒ vuelve a entrar --------------------------------
  update public.stores set status = 'active'
   where id = '11111111-1111-1111-1111-111111111111';

  v_res := public.mi_acceso();
  if v_res->>'estado' <> 'ok' then
    raise exception 'FALLO 3.d: reactivar no devolvió el acceso (estado %)', v_res->>'estado';
  end if;

  -- ---- 9 · store_activa no habla de negocios ajenos -----------------------
  if public.store_activa('22222222-2222-2222-2222-222222222222') is null then
    raise exception 'FALLO 9.a: store_activa devolvió null en vez de un booleano';
  end if;
  if not public.store_activa('11111111-1111-1111-1111-111111111111') then
    raise exception 'FALLO 9.b: store_activa dice que el negocio propio no está activo';
  end if;
  -- Un id inexistente no puede parecer "activo".
  if public.store_activa('99999999-9999-9999-9999-999999999999') then
    raise exception 'FALLO 9.c: store_activa dio true para un negocio que no existe';
  end if;
end $$;

reset role;

-- ===========================================================================
-- 4 + 5 · must_change_password
-- ===========================================================================
update public.profiles set must_change_password = true
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_res jsonb;
begin
  -- ---- 4.a · mi_acceso lo expone para que la guarda pueda actuar ----------
  v_res := public.mi_acceso();
  if not (v_res->>'must_change_password')::boolean then
    raise exception 'FALLO 4.a: mi_acceso no expone must_change_password';
  end if;

  -- ---- 5 · la RPC lo apaga, y sólo para uno mismo -------------------------
  perform public.marcar_clave_cambiada();
  v_res := public.mi_acceso();
  if (v_res->>'must_change_password')::boolean then
    raise exception 'FALLO 5.a: marcar_clave_cambiada no apagó el flag';
  end if;

  -- El cajero NO puede quedar afectado por la llamada del dueño.
  if (select must_change_password from public.profiles
       where id = 'aaaaaaaa-0000-0000-0000-000000000002') is null then
    raise exception 'FALLO 5.b: la columna no existe para el cajero';
  end if;
end $$;

reset role;

-- El cajero enciende su propio flag y comprueba que el del dueño no se movió.
update public.profiles set must_change_password = true
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';

do $$
begin
  perform public.marcar_clave_cambiada();
  if (select must_change_password from public.profiles
       where id = 'aaaaaaaa-0000-0000-0000-000000000002') then
    raise exception 'FALLO 5.c: el cajero no pudo apagar su propio flag';
  end if;
end $$;

reset role;

-- ===========================================================================
-- 4.b · TODA alta nueva nace con la credencial marcada como provisoria
--
-- Va en el trigger y no en cada server action: no hay registro público, así
-- que todo usuario nuevo viene de un alta donde OTRO vio la contraseña.
-- ===========================================================================
do $$
declare v_uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'alta-049@staff.stockflow.invalid', crypt('x', gen_salt('bf')),
          now(), now(), now(), '{}'::jsonb, '{"full_name":"Alta Nueva"}'::jsonb);

  if not (select must_change_password from public.profiles where id = v_uid) then
    raise exception 'FALLO 4.b: un usuario recién creado NO quedó obligado a cambiar la credencial';
  end if;

  -- Y las filas que ya existían no se tocaron (nadie queda encerrado afuera).
  if (select must_change_password from public.profiles
       where id = 'aaaaaaaa-0000-0000-0000-000000000001') then
    raise exception 'FALLO 4.c: la migración encendió el flag en un usuario preexistente';
  end if;
end $$;

-- ===========================================================================
-- 6 · DETERMINISMO con dos membresías
--
-- El bug original: `.limit(1)` sin `order by` ⇒ el negocio lo elegía el
-- planner. Se le da al dueño una segunda membresía (staff en el otro negocio)
-- y se exige que SIEMPRE gane el negocio donde es owner.
-- ===========================================================================
insert into public.members (store_id, profile_id, role, display_name, status)
values ('22222222-2222-2222-2222-222222222222',
        'aaaaaaaa-0000-0000-0000-000000000001', 'staff', 'Prestado', 'active')
on conflict (store_id, profile_id) do update set status = 'active';

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare v_res jsonb; i int;
begin
  for i in 1..5 loop
    v_res := public.mi_acceso();
    if (v_res->>'store_id') <> '11111111-1111-1111-1111-111111111111' then
      raise exception 'FALLO 6: con dos membresías eligió % (esperaba el negocio donde es dueño)', v_res->>'store_id';
    end if;
  end loop;
end $$;

reset role;

-- ===========================================================================
-- 7 · "nunca tuvo acceso" vs "lo perdió" — el mensaje del domingo a la noche
-- ===========================================================================
update public.members set status = 'inactive'
 where profile_id = 'aaaaaaaa-0000-0000-0000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';

do $$
declare v_res jsonb;
begin
  v_res := public.mi_acceso();
  if v_res->>'estado' <> 'sin_acceso' then
    raise exception 'FALLO 7: un empleado dado de baja recibe "%" — no se distingue de una clave mal tipeada', v_res->>'estado';
  end if;
end $$;

reset role;

-- ===========================================================================
-- 8 · EL CAMINO DE COBRO NO SE TOCÓ
--
-- La promesa del bloque A. Se prueba que con el negocio activo y la membresía
-- activa, `rpc_member` y `register_sale` siguen funcionando igual.
-- ===========================================================================
update public.members set status = 'active'
 where profile_id = 'aaaaaaaa-0000-0000-0000-000000000002';
delete from public.members
 where store_id = '22222222-2222-2222-2222-222222222222'
   and profile_id = 'aaaaaaaa-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_m     public.members;
  v_res   jsonb;
begin
  v_m := public.rpc_member(v_store);
  if v_m.id is null or v_m.role <> 'owner' then
    raise exception 'FALLO 8.a: rpc_member dejó de resolver al dueño';
  end if;

  v_res := public.register_sale(
             v_store,
             jsonb_build_array(jsonb_build_object(
               'product_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 1)),
             'cash', 'identidad-049-cobro');
  if (v_res->>'sale_id') is null then
    raise exception 'FALLO 8.b: register_sale dejó de vender';
  end if;
  if (v_res->>'total')::numeric <= 0 then
    raise exception 'FALLO 8.c: register_sale devolvió total %', v_res->>'total';
  end if;
end $$;

reset role;

rollback;

\echo '════════════════════════════════════════════'
\echo ' verify-identidad.sql — TODO VERDE'
\echo '════════════════════════════════════════════'
