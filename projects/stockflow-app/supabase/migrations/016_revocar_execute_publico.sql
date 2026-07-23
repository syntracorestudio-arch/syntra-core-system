-- =============================================================================
-- StockFlow — 016_revocar_execute_publico.sql
-- Cierra un agujero real: `create_store` era ejecutable por cualquier usuario.
--
-- Postgres otorga EXECUTE a PUBLIC en TODA función nueva. Un `grant execute … to
-- service_role` no quita ese permiso: lo suma. La 010 asumió que otorgarle la
-- función solo a service_role alcanzaba para que fuese de superadmin — y no.
--
-- Verificado contra la base antes del arreglo: con la sesión de un cajero,
--   select public.create_store('Kiosco Trucho', 'kiosco-trucho', <su profile_id>, …)
-- devolvía el negocio creado, con él mismo de dueño. Cualquiera con una cuenta
-- podía fabricarse tenants sin límite.
--
-- El resto de las RPC no está en este problema: todas empiezan con `rpc_member()`,
-- que revienta con `not_a_member` cuando quien llama no pertenece al negocio. Ahí
-- la protección es la lógica, no el grant. `create_store` era la excepción porque,
-- por definición, se llama cuando el negocio todavía no existe.
-- =============================================================================

revoke execute on function public.create_store(text, text, uuid, text, text) from public;
grant  execute on function public.create_store(text, text, uuid, text, text) to service_role;

-- Lo mismo para la vista de superadmin: sin esto, PUBLIC conserva lo que Postgres
-- le dio al crearla.
revoke all on public.admin_stores from public;
grant select on public.admin_stores to service_role;

/* Que no vuelva a pasar.

   A partir de acá, toda función nueva creada por `postgres` en este esquema nace
   SIN permiso para PUBLIC y hay que otorgarla explícitamente. El modo de fallar
   pasa a ser "permission denied" bien ruidoso en vez de una función sensible
   abierta a cualquiera en silencio, que es exactamente como se nos escapó esta. */
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
