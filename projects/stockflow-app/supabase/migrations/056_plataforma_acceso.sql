-- ===========================================================================
-- 056 · Acceso de plataforma — el flag deja de otorgarse a mano
--
-- Plan: docs/superadmin-suscripciones-plan.md §A y §B.
--
-- EL PROBLEMA. `is_superadmin` es la llave de toda la plataforma —controla
-- todos los negocios de todos los clientes— y hasta hoy se otorgaba con un
-- `update` a mano contra la base. Eso tiene una consecuencia que ya se cobró:
-- cualquier limpieza de datos, reset o descuido deja al owner AFUERA de su
-- propio panel, sin ningún camino de vuelta dentro del producto.
--
-- Pasó el 2026-08-18: se le quitó el flag al limpiar un estado de prueba y el
-- owner no pudo entrar a /super.
--
-- LO QUE NO CAMBIA. Sigue sin haber UI para que un dueño de kiosco se lo
-- otorgue — ese era el motivo original de no tener nada (superadmin.ts:12-14) y
-- es correcto. Lo que cambia es QUIÉN puede otorgarlo: un superadmin existente,
-- por una RPC que deja rastro, en vez de cualquiera con acceso a la base.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · otorgar_superadmin — sólo un superadmin suma a otro
--
-- `security definer` porque desde la 049 `authenticated` no tiene UPDATE sobre
-- `profiles` (era por donde cualquiera se hacía superadmin). La RPC es el único
-- camino, y exige motivo por la misma razón que las acciones de /super: sin
-- motivo, dentro de seis meses nadie sabe por qué esa persona tiene la llave.
-- ---------------------------------------------------------------------------
create or replace function public.otorgar_superadmin(
  p_email  text,
  p_motivo text,
  p_quitar boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor   uuid := auth.uid();
  v_actor_p public.profiles;
  v_target  public.profiles;
begin
  if v_actor is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_actor_p from public.profiles where id = v_actor;
  if not coalesce(v_actor_p.is_superadmin, false) then
    raise exception 'not_allowed';
  end if;

  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'reason_requerido';
  end if;

  select * into v_target from public.profiles
   where lower(email) = lower(trim(p_email));
  if not found then
    raise exception 'profile_not_found';
  end if;

  /* No podés sacarte el flag a vos mismo. No es paternalismo: es que el último
     superadmin quitándose el permiso deja la plataforma sin NADIE que pueda
     otorgarlo, y la única salida vuelve a ser abrir la base a mano — justo lo
     que esta migración existe para evitar. */
  if p_quitar and v_target.id = v_actor then
    raise exception 'no_te_podes_quitar_a_vos_mismo';
  end if;

  update public.profiles
     set is_superadmin = not p_quitar
   where id = v_target.id;

  return jsonb_build_object(
    'profile_id', v_target.id,
    'email',      v_target.email,
    'es_superadmin', not p_quitar
  );
end;
$$;

revoke execute on function public.otorgar_superadmin(text, text, boolean) from public, anon;
grant  execute on function public.otorgar_superadmin(text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2 · El primer superadmin — bootstrap idempotente
--
-- La RPC de arriba exige que YA exista uno, así que alguien tiene que ser el
-- primero. Se siembra acá, en la migración, y no a mano: así el acceso del
-- owner sobrevive a un reset de la base y queda escrito en el repo quién lo
-- tiene y desde cuándo.
--
-- Idempotente y sin fallar si el perfil no existe todavía (en un entorno nuevo
-- las migraciones corren antes de que nadie se registre): el `update` no matchea
-- y listo. Cuando ese usuario se cree, se vuelve a correr esta línea o se usa la
-- RPC desde otro superadmin.
-- ---------------------------------------------------------------------------
update public.profiles
   set is_superadmin = true
 where lower(email) = lower('syntracore.studio@gmail.com')
   and is_superadmin = false;

-- ---------------------------------------------------------------------------
-- 3 · create_store acepta `created_by`
--
-- 055 agregó `stores.created_by` y `members.created_by`, pero `create_store`
-- nunca los aceptó: en el camino real quedaban SIEMPRE en NULL. Una columna que
-- siempre es null no es un dato incompleto, es una columna que miente sobre lo
-- que guarda.
--
-- El cuerpo es el de 010 con dos cambios: el parámetro nuevo y su uso en los dos
-- inserts. `default null` para no romper a ningún llamador viejo.
-- ---------------------------------------------------------------------------
create or replace function public.create_store(
  p_name           text,
  p_slug           text,
  p_owner_profile  uuid,
  p_owner_name     text default null,
  p_accent         text default null,
  p_created_by     uuid default null
) returns public.stores
language plpgsql security definer set search_path = public as $$
declare
  v_store public.stores;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;

  if p_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' then
    raise exception 'invalid_slug';
  end if;

  if exists (select 1 from public.stores where slug = p_slug) then
    raise exception 'slug_taken';
  end if;

  if not exists (select 1 from public.profiles where id = p_owner_profile) then
    raise exception 'owner_not_found';
  end if;

  if exists (
    select 1 from public.members
     where profile_id = p_owner_profile and role = 'owner' and status = 'active'
  ) then
    raise exception 'already_owner';
  end if;

  insert into public.stores (name, slug, branding, created_by)
  values (trim(p_name), p_slug,
          case when p_accent is null then '{}'::jsonb
               else jsonb_build_object('accent', p_accent) end,
          p_created_by)
  returning * into v_store;

  insert into public.members (store_id, profile_id, role, display_name,
                              can_sell_on_credit, can_apply_discount,
                              can_void_sale, can_receive_stock, can_see_costs,
                              created_by)
  values (v_store.id, p_owner_profile, 'owner', coalesce(nullif(trim(p_owner_name), ''), 'Dueño'),
          true, true, true, true, true, p_created_by);

  insert into public.categories (store_id, name, emoji, color, sort) values
    (v_store.id, 'Bebidas',     '🥤', '#3b82f6', 1),
    (v_store.id, 'Golosinas',   '🍫', '#ec4899', 2),
    (v_store.id, 'Cigarrillos', '🚬', '#f59e0b', 3),
    (v_store.id, 'Almacén',     '🥫', '#10b981', 4),
    (v_store.id, 'Limpieza',    '🧼', '#06b6d4', 5),
    (v_store.id, 'Fiambres',    '🧀', '#f43f5e', 6),
    (v_store.id, 'Varios',      '📦', '#64748b', 7);

  return v_store;
end;
$$;

revoke execute on function public.create_store(text, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.create_store(text, text, uuid, text, text, uuid) from public, anon, authenticated;
grant  execute on function public.create_store(text, text, uuid, text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4 · `stores` deja de ser editable columna-libre por su dueño
--
-- `stores_update_owner` (002:98-100) es una policy de FILA, y `001:518` da
-- `grant update on stores to authenticated`. Juntos, el dueño puede escribir
-- CUALQUIER columna de su negocio — incluidas `status` (la guarda de acceso y
-- el único apalancamiento de cobranza) y `ai_assistant_enabled` (el add-on
-- pago).
--
-- Es exactamente la clase de escalada que 049 arregló en `profiles`: las
-- policies son de FILA, el recorte por columna se hace con GRANTs. Y la propia
-- 019 lo dejó anticipado por escrito (019:21-24) sin actuar.
--
-- El recorte deja lo que la app SÍ edita desde la pantalla de configuración del
-- dueño, y saca las tres que no le corresponden: `status`, `ai_assistant_enabled`
-- y `created_by`. `slug` también sale: cambiarlo rompe el código de negocio con
-- el que entran los empleados.
-- ---------------------------------------------------------------------------
revoke update on public.stores from authenticated, anon;
grant update (name, timezone, branding, cuit, fiscal, vertical, updated_at)
  on public.stores to authenticated;
