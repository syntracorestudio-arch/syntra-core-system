-- ===========================================================================
-- 059 · Fuga cross-tenant en las RPCs de promociones
--
-- LA FUGA, medida en la base antes de escribir esto:
--
--   Luci es cajera del negocio 1. Consultando la tabla `promos` del negocio 3
--   ve 0 filas — la RLS funciona. Pero llamando a la RPC:
--
--     promo_vigente('<negocio 3>', '<producto ajeno>')  →  la fila ENTERA
--     promo_precio ('<negocio 3>', '<producto ajeno>')  →  500.00
--
--   El `store_id` lo elige quien llama, las funciones son `security definer` y
--   NO chequean membresía. Son la excepción: las otras cuatro RPCs de promos
--   (047) sí llaman a `rpc_member`.
--
-- ES PEOR QUE SALTEARSE LA RLS: también saltea el recorte de COLUMNA de 051.
-- `security definer` corre como el dueño de la función, así que ni las policies
-- de fila ni los grants de columna aplican. Verificado poniéndole
-- `cost_at_start = 333.33` a una promo del negocio 3 y leyéndolo desde la
-- sesión de una cajera del negocio 1: salió el costo.
--
-- EL ARREGLO ES QUITAR EL PERMISO, NO ACOTARLO.
--
-- `authenticated` no necesita ejecutarlas: NINGÚN código de la app las llama
-- directo (verificado en `src/`, `scripts/` y las rutas de cron). Los únicos
-- llamadores son otras funciones SQL —`pos_destacados`, `productos_buscar`,
-- `register_sale` y compañía—, que son `security definer` y corren como
-- `postgres`, así que no dependen de este grant.
--
-- Y ADEMÁS SE LES PONE GUARDA PROPIA. La lección del hallazgo de `admin_stores`
-- en la verificación adversarial: una superficie con UNA sola cerradura es la
-- que se abre sola el día que alguien agrega un `grant` de más. Con la guarda
-- adentro, re-otorgar el permiso por error no vuelve a abrir la fuga.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · promo_vigente — con guarda, y en plpgsql
--
-- Pasa de `language sql` a `plpgsql` porque el chequeo necesita un `if`. La
-- firma, el tipo de retorno y la lógica de selección no cambian: hay ~60 usos
-- de esta función en las migraciones 045-048 y ninguno se entera.
--
-- LA REGLA DE LA GUARDA, y por qué no es `rpc_member` a secas:
--
--   `rpc_member` levanta `not_a_member` cuando `auth.uid()` es null, y eso
--   rompería a cualquier cron o server action que la alcance con el cliente
--   admin (sin JWT). Por eso la condición es: si HAY un usuario autenticado,
--   tiene que ser miembro de ese negocio; si no hay JWT, es una llamada
--   server-side y ya está del lado confiable de la puerta.
-- ---------------------------------------------------------------------------
create or replace function public.promo_vigente(p_store_id uuid, p_product_id uuid)
returns public.promos
language plpgsql stable security definer set search_path = public as $$
declare
  v_promo public.promos;
begin
  if auth.uid() is not null
     and not exists (
       select 1 from public.members
        where profile_id = auth.uid()
          and store_id   = p_store_id
          and status     = 'active'
     )
  then
    raise exception 'not_a_member';
  end if;

  select * into v_promo
    from public.promos
   where store_id   = p_store_id
     and product_id = p_product_id
     and ended_at is null
     and starts_on <= public.store_hoy(p_store_id)
     and ends_on   >= public.store_hoy(p_store_id)
   order by created_at desc
   limit 1;

  return v_promo;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2 · promo_precio — misma guarda
--
-- Sin ella, seguiría siendo un oráculo de precios ajenos por su rama de
-- fallback: `select price from products where id = ... and store_id = ...`
-- devuelve el precio de cualquier producto de cualquier kiosco.
-- ---------------------------------------------------------------------------
create or replace function public.promo_precio(p_store_id uuid, p_product_id uuid)
returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  v_precio numeric;
begin
  if auth.uid() is not null
     and not exists (
       select 1 from public.members
        where profile_id = auth.uid()
          and store_id   = p_store_id
          and status     = 'active'
     )
  then
    raise exception 'not_a_member';
  end if;

  select coalesce(
           (public.promo_vigente(p_store_id, p_product_id)).promo_price,
           (select price from public.products
             where id = p_product_id and store_id = p_store_id)
         )
    into v_precio;

  return v_precio;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3 · Fuera el grant que no hacía falta
--
-- La segunda cerradura. `service_role` conserva el suyo en `promo_vigente`
-- (es el lado confiable y la guarda de arriba lo deja pasar).
-- ---------------------------------------------------------------------------
revoke execute on function public.promo_vigente(uuid, uuid) from authenticated, anon, public;
revoke execute on function public.promo_precio(uuid, uuid)  from authenticated, anon, public;

grant execute on function public.promo_vigente(uuid, uuid) to service_role;
grant execute on function public.promo_precio(uuid, uuid)  to service_role;
