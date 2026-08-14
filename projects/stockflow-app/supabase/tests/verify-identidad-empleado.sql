-- StockFlow — VERIFY: identidad del empleado (migración 050)
--
--   docker exec -i supabase_db_stockflow-app psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/verify-identidad-empleado.sql
--
-- Prerequisitos: supabase db reset (001..050) + seed.sql.
--
-- Qué se prueba, y por qué:
--   1  normalizar_usuario coincide EXACTAMENTE con la de TS (si divergen, el
--      empleado no entra nunca y parece que erró la clave)
--   2  add_member guarda el usuario normalizado
--   3  usuario_invalido (fuera de 3-20 tras normalizar)
--   4  usuario_ocupado en el MISMO negocio
--   5  el mismo usuario en OTRO negocio es válido (el alcance es por kiosco)
--   6  equipo_del_negocio expone `usuario`
--   7  empleado_a_resetear: owner-only, no toca owners, no cruza de negocio
--   8  EL EMPLEADO SINTÉTICO ES UN EMPLEADO NORMAL: mismo RLS, mismos flags,
--      y puede VENDER — la promesa central de la migración
--   9  el usuario no se puede robar entre negocios (aislamiento)

\set ON_ERROR_STOP on
\timing off

begin;

\set store  '11111111-1111-1111-1111-111111111111'
\set store2 '22222222-2222-2222-2222-222222222222'

-- ===========================================================================
-- 1 · La normalización tiene que ser IDÉNTICA a la de src/lib/credenciales.ts
--
-- Los mismos casos que afirma `credenciales.test.ts`. Si alguien toca un lado,
-- una de las dos suites se cae. Esa es toda la razón de este bloque.
-- ===========================================================================
do $$
begin
  if public.normalizar_usuario('Martín')    <> 'martin'   then raise exception 'FALLO 1.a'; end if;
  if public.normalizar_usuario('José Luis') <> 'joseluis' then raise exception 'FALLO 1.b'; end if;
  if public.normalizar_usuario('  ANA  ')   <> 'ana'      then raise exception 'FALLO 1.c'; end if;
  if public.normalizar_usuario('caja-1')    <> 'caja1'    then raise exception 'FALLO 1.d'; end if;
  if public.normalizar_usuario('Ñandú')     <> 'nandu'    then raise exception 'FALLO 1.e'; end if;
  if public.normalizar_usuario(null)        <> ''         then raise exception 'FALLO 1.f'; end if;
  -- Idempotencia: crear y entrar tienen que dar lo mismo.
  if public.normalizar_usuario(public.normalizar_usuario('José Luis')) <> 'joseluis' then
    raise exception 'FALLO 1.g: la normalización no es idempotente';
  end if;
end $$;

-- ===========================================================================
-- FIXTURES · dos usuarios de auth con email SINTÉTICO (rol postgres)
-- ===========================================================================
\set uid1 'e0000000-0000-0000-0000-0000000000a1'
\set uid2 'e0000000-0000-0000-0000-0000000000a2'
\set uid3 'e0000000-0000-0000-0000-0000000000a3'

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  (:'uid1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'luciana.el-trebol@staff.stockflow.invalid', crypt('x', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{"full_name":"Luciana"}'::jsonb),
  (:'uid2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'luciana.dona-rosa@staff.stockflow.invalid', crypt('x', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{"full_name":"Luciana II"}'::jsonb),
  (:'uid3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pedro.el-trebol@staff.stockflow.invalid', crypt('x', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{"full_name":"Pedro"}'::jsonb);

-- ===========================================================================
-- 2, 3, 4, 6 · alta con usuario (rol authenticated · OWNER de El Trébol)
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_uid1  uuid := 'e0000000-0000-0000-0000-0000000000a1';
  v_uid3  uuid := 'e0000000-0000-0000-0000-0000000000a3';
  v_m     public.members;
  v_it    jsonb;
begin
  -- ---- 2 · guarda el usuario normalizado ---------------------------------
  v_m := public.add_member(v_store, v_uid1, 'Luciana',
                           false, false, false, true, false, '  Lucíana  ');
  if v_m.usuario <> 'luciana' then
    raise exception 'FALLO 2: guardó "%" en vez de "luciana"', v_m.usuario;
  end if;
  if v_m.role <> 'staff' then
    raise exception 'FALLO 2.b: el rol dejó de estar forzado a staff';
  end if;

  -- ---- 3 · usuario demasiado corto ---------------------------------------
  begin
    perform public.add_member(v_store, v_uid3, 'Pedro',
                              false, false, false, true, false, 'pe');
    raise exception 'FALLO 3: aceptó un usuario de 2 caracteres';
  exception when others then
    if sqlerrm <> 'usuario_invalido' then raise; end if;
  end;

  -- ---- 4 · usuario ocupado EN ESTE negocio -------------------------------
  begin
    perform public.add_member(v_store, v_uid3, 'Pedro',
                              false, false, false, true, false, 'LUCIANA');
    raise exception 'FALLO 4: dejó repetir el usuario dentro del mismo kiosco';
  exception when others then
    if sqlerrm <> 'usuario_ocupado' then raise; end if;
  end;

  -- ---- 6 · equipo_del_negocio expone el usuario --------------------------
  select value into v_it
    from jsonb_array_elements(public.equipo_del_negocio(v_store)) t(value)
   where (value->>'id')::uuid = v_m.id;
  if v_it->>'usuario' <> 'luciana' then
    raise exception 'FALLO 6: la pantalla de equipo no puede decir con qué usuario entra';
  end if;
  -- El dueño no tiene usuario: entra con su email real.
  select value into v_it
    from jsonb_array_elements(public.equipo_del_negocio(v_store)) t(value)
   where (value->>'rol') = 'owner';
  if v_it->>'usuario' is not null then
    raise exception 'FALLO 6.b: el dueño no debería tener usuario de kiosco';
  end if;
end $$;

reset role;

-- ===========================================================================
-- 5 · el MISMO usuario en OTRO negocio es válido
--
-- El alcance de la unicidad es POR KIOSCO, no global: "luciana" tiene que
-- poder existir en dos negocios distintos. Lo garantiza el slug dentro del
-- email sintético.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_store2 uuid := '22222222-2222-2222-2222-222222222222';
  v_uid2   uuid := 'e0000000-0000-0000-0000-0000000000a2';
  v_m      public.members;
begin
  v_m := public.add_member(v_store2, v_uid2, 'Luciana II',
                           false, false, false, true, false, 'luciana');
  if v_m.usuario <> 'luciana' then
    raise exception 'FALLO 5: el mismo usuario debe poder existir en otro kiosco';
  end if;
end $$;

reset role;

-- ===========================================================================
-- 7 · empleado_a_resetear — el service_role nunca confía en el cliente
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare
  v_store  uuid := '11111111-1111-1111-1111-111111111111';
  v_store2 uuid := '22222222-2222-2222-2222-222222222222';
  v_res    jsonb;
  v_luci   uuid;
  v_owner  uuid;
  v_ajeno  uuid;
begin
  select id into v_luci from public.members
   where store_id = v_store and usuario = 'luciana';
  select id into v_owner from public.members
   where store_id = v_store and role = 'owner';
  select id into v_ajeno from public.members
   where store_id = v_store2 and usuario = 'luciana';

  -- ---- 7.a · el caso feliz ------------------------------------------------
  v_res := public.empleado_a_resetear(v_store, v_luci);
  if (v_res->>'profile_id')::uuid <> 'e0000000-0000-0000-0000-0000000000a1' then
    raise exception 'FALLO 7.a: devolvió el profile equivocado';
  end if;
  if v_res->>'usuario' <> 'luciana' then
    raise exception 'FALLO 7.b: no devuelve el usuario (el dueño lo necesita para dictarlo)';
  end if;

  -- ---- 7.c · no se puede resetear a un OWNER -----------------------------
  begin
    perform public.empleado_a_resetear(v_store, v_owner);
    raise exception 'FALLO 7.c: dejó resetear la clave de un dueño';
  exception when others then
    if sqlerrm <> 'member_not_found' then raise; end if;
  end;

  -- ---- 7.d · no se puede cruzar de negocio -------------------------------
  begin
    perform public.empleado_a_resetear(v_store, v_ajeno);
    raise exception 'FALLO 7.d: reseteó a alguien de OTRO negocio';
  exception when others then
    if sqlerrm <> 'member_not_found' then raise; end if;
  end;
end $$;

reset role;

-- ---- 7.e · un empleado NO puede resetear a nadie --------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_otro  uuid;
begin
  select id into v_otro from public.members
   where store_id = v_store and role = 'owner';
  begin
    perform public.empleado_a_resetear(v_store, v_otro);
    raise exception 'FALLO 7.e: un empleado pudo pedir el reset de otra persona';
  exception when others then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;

-- ===========================================================================
-- 8 · LA PROMESA DE LA MIGRACIÓN: el empleado sintético es un empleado NORMAL
--
-- Sigue con la sesión de Luciana (email sintético). Si algo de esto fallara,
-- el modelo entero no sirve: significaría que el string del email SÍ afecta al
-- aislamiento, y habría que rehacerlo.
-- ===========================================================================
do $$
declare
  v_store uuid := '11111111-1111-1111-1111-111111111111';
  v_m     public.members;
  v_res   jsonb;
  v_n     int;
begin
  -- ---- 8.a · rpc_member la resuelve --------------------------------------
  v_m := public.rpc_member(v_store);
  if v_m.usuario <> 'luciana' or v_m.role <> 'staff' then
    raise exception 'FALLO 8.a: rpc_member no resuelve al empleado sintético';
  end if;

  -- ---- 8.b · RLS le da SU negocio y nada más ------------------------------
  select count(*) into v_n from public.products;
  if v_n = 0 then
    raise exception 'FALLO 8.b: no ve los productos de su propio negocio';
  end if;
  if exists (select 1 from public.products where store_id <> v_store) then
    raise exception 'FALLO 8.c: VE PRODUCTOS DE OTRO NEGOCIO — el aislamiento se rompió';
  end if;

  -- ---- 8.d · PUEDE VENDER -------------------------------------------------
  v_res := public.register_sale(
             v_store,
             jsonb_build_array(jsonb_build_object(
               'product_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 1)),
             'cash', 'sintetico-vende-050');
  if (v_res->>'sale_id') is null then
    raise exception 'FALLO 8.d: el empleado sintético no puede vender';
  end if;

  -- ---- 8.e · la venta queda ATRIBUIDA a él --------------------------------
  /* 051 · este assert se lee como `postgres` a propósito, y NO porque se haya
     aflojado nada: desde la migración 051 la tabla `sales` es owner-only (un
     empleado sumando `total` leía la recaudación del negocio). Lo que se está
     verificando acá es QUÉ ESCRIBIÓ `register_sale` —que la venta quedó a
     nombre del cajero— y eso es un hecho de la base, no algo que el cajero
     tenga que poder mirar. Subir el privilegio del ASSERT es lo correcto;
     bajarlo del PRODUCTO habría sido el error. Mismo criterio que
     verify-rpcs / verify-promos / verify-total-gondola. */
  perform set_config('role', 'postgres', true);
  if not exists (
    select 1 from public.sales
     where id = (v_res->>'sale_id')::uuid and member_id = v_m.id
  ) then
    perform set_config('role', 'authenticated', true);
    raise exception 'FALLO 8.e: la venta no quedó atribuida al empleado';
  end if;
  -- Se vuelve al rol del empleado: 8.f prueba que sus flags SIGUEN aplicando,
  -- y eso sólo significa algo si corre como él.
  perform set_config('role', 'authenticated', true);

  -- ---- 8.f · los flags siguen valiendo (no tiene can_sell_on_credit) ------
  begin
    perform public.register_sale(
      v_store,
      jsonb_build_array(jsonb_build_object(
        'product_id', 'd1000000-0000-0000-0000-000000000001', 'qty', 1)),
      'account', 'sintetico-fiado-050', 'c2000000-0000-0000-0000-000000000001');
    raise exception 'FALLO 8.f: vendió fiado SIN el permiso — los flags dejaron de aplicar';
  exception when others then
    if sqlerrm <> 'not_allowed' then raise; end if;
  end;
end $$;

reset role;

-- ===========================================================================
-- 9 · aislamiento: la de OTRO negocio no ve nada de éste
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

do $$
declare v_store uuid := '11111111-1111-1111-1111-111111111111';
begin
  if exists (select 1 from public.products where store_id = v_store) then
    raise exception 'FALLO 9.a: una empleada de otro kiosco ve los productos de éste';
  end if;
  begin
    perform public.rpc_member(v_store);
    raise exception 'FALLO 9.b: rpc_member la aceptó en un negocio que no es el suyo';
  exception when others then
    if sqlerrm <> 'not_a_member' then raise; end if;
  end;
end $$;

reset role;

rollback;

\echo '════════════════════════════════════════════'
\echo ' verify-identidad-empleado.sql — TODO VERDE'
\echo '════════════════════════════════════════════'
