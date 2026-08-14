-- ===========================================================================
-- 050 · Identidad del empleado (bloque B1)
--
-- Plan: docs/identidad-acceso-plan.md · contratos: docs/rpc-contracts.md.
--
-- El problema que resuelve: dar de alta a una cajera EXIGE un email
-- (equipo-client.tsx), y en un kiosco real eso es un bloqueante del
-- onboarding, no una molestia. Los empleados rotan seguido y muchos no tienen
-- casilla.
--
-- La solución NO puede esquivar auth: `members.profile_id` es NOT NULL → FK a
-- `profiles` → FK a `auth.users`, y los 4 helpers de RLS más `rpc_member`
-- (~40 RPCs, incluida register_sale) resuelven todo contra `auth.uid()`. Un
-- empleado sin usuario de auth quedaría fuera de absolutamente todo.
--
-- Por eso: el empleado SIGUE siendo un auth.users normal, pero su email lo
-- fabrica el sistema — `<usuario>.<slug>@staff.stockflow.invalid`. `.invalid`
-- es TLD reservado (RFC 2606): no puede colisionar con un dominio real y deja
-- explícito que no es un buzón.
--
-- CONSECUENCIA IMPORTANTE: RLS, rpc_member, register_sale, el split, la
-- atribución y los flags de permiso NO SE ENTERAN. `auth.uid()` es indiferente
-- al string del email. Esta migración no toca una sola línea del cobro.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · members.usuario — el nombre con el que entra
--
-- Nullable porque el dueño no tiene (entra con su email real) y porque los
-- empleados creados antes de esta migración tampoco.
--
-- El índice único NO es lo que garantiza la unicidad — eso ya lo hace
-- `auth.users.email`, que es única global y lleva el slug adentro. Existe para
-- fallar ANTES y con un mensaje del negocio ("ya hay alguien con ese usuario
-- en tu kiosco") en vez del de GoTrue ("ese email ya tiene una cuenta en
-- StockFlow"), que es desconcertante cuando nadie tipeó ningún email.
-- ---------------------------------------------------------------------------
alter table public.members
  add column if not exists usuario text;

create unique index if not exists members_usuario_idx
  on public.members (store_id, lower(usuario))
  where usuario is not null;

-- ---------------------------------------------------------------------------
-- 2 · normalizar_usuario — la MISMA transformación que corre en la app
--
-- Vive en los dos lados a propósito (`src/lib/credenciales.ts` es el espejo).
-- Si difirieran, el empleado no entraría NUNCA y el síntoma sería
-- indistinguible de una clave mal tipeada: el peor modo de falla posible para
-- soporte. Los tests atan las dos mitades.
--
-- `unaccent` no está garantizada en el proyecto, así que la translitera a mano
-- sobre el juego que aparece en nombres argentinos.
-- ---------------------------------------------------------------------------
create or replace function public.normalizar_usuario(p_v text)
returns text
language sql immutable set search_path = public as $$
  select regexp_replace(
           translate(
             lower(coalesce(p_v, '')),
             'áàäâãéèëêíìïîóòöôõúùüûñç',
             'aaaaaeeeeiiiiooooouuuunc'
           ),
           '[^a-z0-9]', '', 'g'
         );
$$;

-- ---------------------------------------------------------------------------
-- 3 · add_member — cuerpo de 010 + el usuario
-- ---------------------------------------------------------------------------
create or replace function public.add_member(
  p_store_id   uuid,
  p_profile_id uuid,
  p_name       text,
  p_can_sell_on_credit boolean default false,
  p_can_apply_discount boolean default false,
  p_can_void_sale      boolean default false,
  p_can_receive_stock  boolean default true,
  p_can_see_costs      boolean default false,
  p_usuario            text    default null
) returns public.members
language plpgsql security definer set search_path = public as $$
declare
  v_member  public.members;
  v_caller  public.members;
  v_usuario text;
begin
  v_caller := public.rpc_member(p_store_id);
  if v_caller.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  if exists (
    select 1 from public.members
     where store_id = p_store_id and profile_id = p_profile_id
  ) then
    raise exception 'already_member';
  end if;

  -- 050 · el usuario es opcional para no romper a quien llame sin él, pero si
  -- viene tiene que ser usable: es la mitad de la credencial que se dicta.
  if p_usuario is not null then
    v_usuario := public.normalizar_usuario(p_usuario);
    if length(v_usuario) < 3 or length(v_usuario) > 20 then
      raise exception 'usuario_invalido';
    end if;
    if exists (
      select 1 from public.members
       where store_id = p_store_id and lower(usuario) = v_usuario
    ) then
      raise exception 'usuario_ocupado';
    end if;
  end if;

  insert into public.members (store_id, profile_id, role, display_name,
                              can_sell_on_credit, can_apply_discount, can_void_sale,
                              can_receive_stock, can_see_costs, usuario)
  values (p_store_id, p_profile_id, 'staff', coalesce(nullif(trim(p_name), ''), 'Empleado'),
          p_can_sell_on_credit, p_can_apply_discount, p_can_void_sale,
          p_can_receive_stock, p_can_see_costs, v_usuario)
  returning * into v_member;

  return v_member;
end;
$$;

revoke execute on function public.add_member(uuid, uuid, text, boolean, boolean, boolean, boolean, boolean) from public;
grant  execute on function public.add_member(uuid, uuid, text, boolean, boolean, boolean, boolean, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4 · equipo_del_negocio — cuerpo de 013 + `usuario`
--
-- La pantalla de equipo tiene que poder decirle al dueño CON QUÉ USUARIO entra
-- cada empleado: es el dato que le dicta cuando lo da de alta y cuando le
-- resetea la clave. Para los que no tienen (el dueño, y los creados antes de
-- esta migración) va null y la UI muestra el email.
-- ---------------------------------------------------------------------------
create or replace function public.equipo_del_negocio(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_caller public.members;
  v_res    jsonb;
begin
  v_caller := public.rpc_member(p_store_id);
  if v_caller.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id,
           'rol', m.role,
           'nombre', m.display_name,
           'email', u.email,
           'usuario', m.usuario,
           'estado', m.status,
           'puede_fiar', m.can_sell_on_credit,
           'puede_descuento', m.can_apply_discount,
           'puede_anular', m.can_void_sale,
           'puede_recibir', m.can_receive_stock,
           've_costos', m.can_see_costs,
           'creado', m.created_at
         ) order by (m.role = 'owner') desc, m.created_at), '[]'::jsonb)
    into v_res
    from public.members m
    join auth.users u on u.id = m.profile_id
   where m.store_id = p_store_id;

  return v_res;
end;
$$;

revoke execute on function public.equipo_del_negocio(uuid) from public;
grant  execute on function public.equipo_del_negocio(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5 · empleado_a_resetear — el dueño resetea la clave de su gente, SOLO
--
-- Hoy no existe forma de resetear la clave de un empleado: si se la olvida, el
-- dueño no puede hacer nada y el camino termina en SYNTRA abriendo Supabase.
--
-- Esta RPC existe para que el `service_role` de la server action NUNCA confíe
-- en un `member_id` que vino del cliente: valida acá que el member sea del
-- store de quien llama y que no sea un owner. La action sólo recibe de vuelta
-- el `profile_id` sobre el que puede actuar.
-- ---------------------------------------------------------------------------
create or replace function public.empleado_a_resetear(p_store_id uuid, p_member_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_caller public.members;
  v_target public.members;
begin
  v_caller := public.rpc_member(p_store_id);
  if v_caller.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  select * into v_target from public.members
   where id = p_member_id and store_id = p_store_id and role <> 'owner';
  if not found then
    raise exception 'member_not_found';
  end if;

  return jsonb_build_object(
    'profile_id',   v_target.profile_id,
    'display_name', v_target.display_name,
    'usuario',      v_target.usuario
  );
end;
$$;

revoke execute on function public.empleado_a_resetear(uuid, uuid) from public;
grant  execute on function public.empleado_a_resetear(uuid, uuid) to authenticated;
