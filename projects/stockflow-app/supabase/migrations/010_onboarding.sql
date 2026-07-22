-- =============================================================================
-- StockFlow — 010_onboarding.sql
--
-- El alta de un negocio. Hasta acá los kioscos solo existían porque los creaba
-- el seed: el producto estaba completo por dentro y no tenía puerta de entrada.
--
-- Sigue siendo un acto de SYNTRA y NO self-service (decisión de rpc-contracts):
-- `stores` no tiene policy de INSERT y `members` exige ser ya owner del negocio,
-- así que un usuario suelto no puede fabricarse un kiosco. El alta entra por
-- service_role desde el panel de superadmin.
-- =============================================================================

-- =============================================================================
-- create_store — negocio + dueño en UNA transacción.
--
-- Que sea atómico importa: un store sin owner es un negocio al que nadie puede
-- entrar, y un member huérfano es basura. O se crean los dos o no se crea nada.
-- El perfil del dueño ya tiene que existir (lo crea el trigger de auth.users
-- cuando el panel da de alta al usuario).
-- =============================================================================
create or replace function public.create_store(
  p_name           text,
  p_slug           text,
  p_owner_profile  uuid,
  p_owner_name     text default null,
  p_accent         text default null
) returns public.stores
language plpgsql security definer set search_path = public as $$
declare
  v_store public.stores;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required';
  end if;

  -- El slug identifica al negocio en URLs públicas futuras: se valida ahora para
  -- no tener que migrar datos sucios después.
  if p_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' then
    raise exception 'invalid_slug';
  end if;

  if exists (select 1 from public.stores where slug = p_slug) then
    raise exception 'slug_taken';
  end if;

  if not exists (select 1 from public.profiles where id = p_owner_profile) then
    raise exception 'owner_not_found';
  end if;

  -- Un mismo profile no puede ser dueño de dos kioscos en el MVP: la UX asume un
  -- negocio principal y tenerlo doble daría una sesión ambigua.
  if exists (
    select 1 from public.members
     where profile_id = p_owner_profile and role = 'owner' and status = 'active'
  ) then
    raise exception 'already_owner';
  end if;

  insert into public.stores (name, slug, branding)
  values (trim(p_name), p_slug,
          case when p_accent is null then '{}'::jsonb
               else jsonb_build_object('accent', p_accent) end)
  returning * into v_store;
  -- store_settings lo crea el trigger de la migración 001.

  insert into public.members (store_id, profile_id, role, display_name,
                              can_sell_on_credit, can_apply_discount,
                              can_void_sale, can_receive_stock, can_see_costs)
  values (v_store.id, p_owner_profile, 'owner', coalesce(nullif(trim(p_owner_name), ''), 'Dueño'),
          true, true, true, true, true);

  -- Categorías base: sin esto el kiosquero arranca con una pantalla vacía y
  -- tiene que inventarlas antes de poder cargar el primer producto.
  insert into public.categories (store_id, name, emoji, color, sort) values
    (v_store.id, 'Bebidas',     '🥤', '#3b82f6', 1),
    (v_store.id, 'Golosinas',   '🍫', '#ec4899', 2),
    (v_store.id, 'Cigarrillos', '🚬', '#f59e0b', 3),
    (v_store.id, 'Almacén',     '🥫', '#10b981', 4),
    (v_store.id, 'Limpieza',    '🧼', '#06b6d4', 5),
    (v_store.id, 'Fiambres',    '🧀', '#f43f5e', 6),
    (v_store.id, 'Panadería',   '🍞', '#84cc16', 7),
    (v_store.id, 'Varios',      '📦', '#8b5cf6', 8);

  return v_store;
end;
$$;

-- =============================================================================
-- add_member — sumar un empleado a un negocio existente.
-- La llama el DUEÑO desde su panel de equipo, no el superadmin.
-- =============================================================================
create or replace function public.add_member(
  p_store_id   uuid,
  p_profile_id uuid,
  p_name       text,
  p_can_sell_on_credit boolean default false,
  p_can_apply_discount boolean default false,
  p_can_void_sale      boolean default false,
  p_can_receive_stock  boolean default true,
  p_can_see_costs      boolean default false
) returns public.members
language plpgsql security definer set search_path = public as $$
declare
  v_member public.members;
  v_caller public.members;
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

  insert into public.members (store_id, profile_id, role, display_name,
                              can_sell_on_credit, can_apply_discount, can_void_sale,
                              can_receive_stock, can_see_costs)
  values (p_store_id, p_profile_id, 'staff', coalesce(nullif(trim(p_name), ''), 'Empleado'),
          p_can_sell_on_credit, p_can_apply_discount, p_can_void_sale,
          p_can_receive_stock, p_can_see_costs)
  returning * into v_member;

  return v_member;
end;
$$;

-- =============================================================================
-- Vista para el panel de superadmin: un renglón por negocio con su pulso.
-- Sin security_invoker A PROPÓSITO: es la única vista que debe cruzar tenants,
-- y por eso NO se otorga a `authenticated` — solo service_role la lee, detrás
-- del guard de superadmin.
-- =============================================================================
create or replace view public.admin_stores as
  select s.id, s.name, s.slug, s.status, s.created_at,
         (select count(*) from public.members m where m.store_id = s.id and m.status = 'active') as miembros,
         (select count(*) from public.products p where p.store_id = s.id and p.status = 'active') as productos,
         (select count(*) from public.sales v where v.store_id = s.id and v.status = 'completed') as ventas,
         (select max(v.sold_at) from public.sales v where v.store_id = s.id) as ultima_venta,
         (select m.display_name from public.members m
           where m.store_id = s.id and m.role = 'owner' and m.status = 'active' limit 1) as dueno
    from public.stores s;

revoke all on public.admin_stores from authenticated, anon;
grant select on public.admin_stores to service_role;

grant execute on function public.create_store(text, text, uuid, text, text) to service_role;
grant execute on function public.add_member(uuid, uuid, text, boolean, boolean, boolean, boolean, boolean) to authenticated;