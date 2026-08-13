-- ===========================================================================
-- 049 · Identidad y acceso, bloque A — endurecimiento de auth
--
-- Plan: docs/identidad-acceso-plan.md · contratos: docs/rpc-contracts.md.
--
-- NADA DE ESTE BLOQUE TOCA EL CAMINO DE COBRO. `register_sale`,
-- `register_split_sale`, `void_sale` y `rpc_member` quedan idénticos, y el
-- aislamiento sigue colgando de `auth.uid()` exactamente igual que hoy.
--
-- Contiene cuatro cosas, en orden de gravedad:
--
--   0 · ESCALADA DE PRIVILEGIOS (crítica, encontrada al auditar 049).
--   1 · `stores.status` deja de ser decorativo.
--   2 · Cambio de contraseña obligatorio en el primer ingreso.
--   3 · Selección de negocio determinística (el helper que la ordena).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0 · CRÍTICO — cualquier usuario podía hacerse superadmin
--
-- `profiles_update_own` (002_rls_policies.sql:113-114) permite UPDATE de la
-- fila propia, y las policies de Postgres son de FILA, no de COLUMNA: el
-- recorte por columna se hace con GRANTs, y `authenticated` tenía UPDATE sobre
-- TODAS las columnas de `profiles` — incluida `is_superadmin` (001:44).
--
-- Verificado en base contra el cajero del seed: `update public.profiles set
-- is_superadmin = true where id = auth.uid()` devolvía UPDATE 1.
--
-- El alcance no es cosmético: con ese flag se entra a /super
-- (src/lib/superadmin.ts:16-32), y esa pantalla opera con service_role
-- (src/app/super/page.tsx:12) ⇒ listar TODOS los negocios de la plataforma y
-- suspender cualquiera. Un cajero de un kiosco podía apagarle la caja a otro.
--
-- El arreglo es quitar el privilegio, no acotarlo: la app NUNCA actualiza
-- `profiles` desde el cliente (los únicos usos son dos SELECT, en
-- src/app/page.tsx:20 y src/lib/superadmin.ts:22), así que esta policy no
-- tenía un solo llamador legítimo. Si algún día hace falta "cambiar mi
-- nombre", entra por una RPC security definer con lista de columnas explícita.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_update_own on public.profiles;

revoke update, insert, delete on public.profiles from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 1 · store_activa — que suspender un negocio SIGNIFIQUE algo
--
-- `getSession` filtraba `members.status` pero nunca `stores.status`
-- (src/lib/session.ts:55-64), así que un negocio suspendido desde /super
-- (src/app/super/actions.ts:118-127) seguía entrando y operando. Era el único
-- apalancamiento de cobranza del producto y no tenía efecto — señal de que el
-- ciclo de vida del negocio nunca se ejercitó de punta a punta.
--
-- Se corta en la SESIÓN y no dentro de `rpc_member`: cortar en rpc_member
-- tocaría el camino de cobro, que en este bloque no se toca. Sin sesión no se
-- llega a ninguna RPC igual.
-- ---------------------------------------------------------------------------
create or replace function public.store_activa(p_store_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'active' from public.stores where id = p_store_id), false);
$$;

revoke execute on function public.store_activa(uuid) from public;
grant  execute on function public.store_activa(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2 · must_change_password — la temporal deja de ser permanente
--
-- Hoy la contraseña de alta se genera con Math.random() sobre 6 palabras
-- (~54.000 combinaciones, src/app/super/actions.ts:31-36), se muestra una vez
-- y NO existe forma de cambiarla dentro del producto ⇒ la "temporal" es la
-- contraseña definitiva de cada cliente, para siempre. El generador pasa a
-- CSPRNG del lado de la app; acá vive el flag que obliga a cambiarla.
--
-- Va en `profiles` y no en `app_metadata` por una razón de costo verificable:
-- lo lee la MISMA query que ya hace getSession (cero round-trips nuevos),
-- mientras que leer app_metadata desde una guarda de servidor exigiría parsear
-- el JWT. Y desde el punto 0 de esta migración, `authenticated` ya no tiene
-- UPDATE sobre profiles ⇒ el usuario no puede apagarse el flag solo.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- El flag se enciende en el TRIGGER de alta y no en cada server action: no hay
-- registro público (el alta es siempre un acto de SYNTRA o del dueño), así que
-- **todo** usuario nuevo nace con una credencial que alguien más vio y tiene
-- que cambiarla. Ponerlo en las dos acciones sería duplicar la regla y dejar
-- abierta la tercera que se agregue mañana.
--
-- El `default` de la columna queda en `false` a propósito: las filas que YA
-- existen no se tocan (nadie queda encerrado fuera de su propia app por una
-- migración), y el trigger sólo afecta a las que vienen.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, must_change_password)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', true)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3 · marcar_clave_cambiada — lo ÚNICO que el usuario puede hacer sobre el flag
--
-- Sin parámetros a propósito: opera sobre `auth.uid()` y sobre nada más. No
-- hay forma de pasarle el id de otro.
-- ---------------------------------------------------------------------------
create or replace function public.marcar_clave_cambiada()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.profiles
     set must_change_password = false
   where id = auth.uid();
end;
$$;

revoke execute on function public.marcar_clave_cambiada() from public;
grant  execute on function public.marcar_clave_cambiada() to authenticated;

-- ---------------------------------------------------------------------------
-- 4 · mi_acceso — la sesión en UNA consulta, ordenada y con el negocio validado
--
-- Reemplaza al select suelto de getSession (src/lib/session.ts:55-64), que
-- tenía dos problemas: `.limit(1)` SIN `order by` ⇒ con dos membresías activas
-- el negocio lo elegía el planner (no determinístico), y no miraba
-- `stores.status`.
--
-- El orden es explicable en una frase: "tu negocio principal es el más viejo
-- donde sos dueño". `role = 'owner'` primero, después `created_at` ascendente.
--
-- Devuelve `estado` para que la pantalla pueda distinguir "credencial
-- incorrecta" de "tu cuenta está suspendida" — hoy el empleado dado de baja ve
-- el login genérico, cree que se equivocó de clave y termina llamando al dueño.
-- ---------------------------------------------------------------------------
create or replace function public.mi_acceso()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_member public.members;
  v_store  public.stores;
  v_flag   boolean;
begin
  if v_uid is null then
    return jsonb_build_object('estado', 'sin_sesion');
  end if;

  select coalesce(must_change_password, false) into v_flag
    from public.profiles where id = v_uid;

  select m.* into v_member
    from public.members m
   where m.profile_id = v_uid
     and m.status = 'active'
   order by (m.role = 'owner') desc, m.created_at asc
   limit 1;

  if not found then
    -- Distingue al que nunca tuvo acceso del que lo perdió: si tiene alguna
    -- membresía inactiva, fue una baja y el mensaje tiene que decirlo.
    if exists (select 1 from public.members where profile_id = v_uid) then
      return jsonb_build_object('estado', 'sin_acceso');
    end if;
    return jsonb_build_object('estado', 'sin_membresia');
  end if;

  select * into v_store from public.stores where id = v_member.store_id;

  if v_store.status <> 'active' then
    return jsonb_build_object('estado', 'negocio_suspendido');
  end if;

  return jsonb_build_object(
    'estado', 'ok',
    'must_change_password', v_flag,
    'member_id', v_member.id,
    'store_id', v_member.store_id
  );
end;
$$;

revoke execute on function public.mi_acceso() from public;
grant  execute on function public.mi_acceso() to authenticated;
