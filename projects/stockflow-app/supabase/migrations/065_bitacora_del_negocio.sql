-- ===========================================================================
-- 065 · bitacora_del_negocio — que SYNTRA pueda leer su propia bitácora
--
-- EL AGUJERO. `platform_audit` la lee el CLIENTE en su pantalla de cuenta
-- (`admin/configuracion/actividad-syntra.tsx`), porque `authenticated` tiene
-- SELECT y la RLS le muestra las filas de su negocio. SYNTRA, que es quien la
-- ESCRIBE, no puede consultarla: `service_role` sólo tiene REFERENCES, TRIGGER
-- y TRUNCATE. Verificado en la base, y Postgres lo dice con todas las letras:
--
--   42501 · permission denied for table platform_audit
--   hint: GRANT SELECT ON public.platform_audit TO service_role;
--
-- O sea que hasta hoy la única forma de auditar era abrir psql. Una bitácora
-- que el responsable no puede leer no cumple su función.
--
-- POR QUÉ UNA RPC Y NO EL GRANT QUE SUGIERE EL HINT.
--
-- El hint arregla el síntoma abriendo la tabla ENTERA a `service_role` para
-- siempre. Es la tabla más sensible del sistema —es el registro de todo lo que
-- SYNTRA hizo sobre negocios ajenos— y en este proyecto ya hay tres casos de
-- una superficie que se abrió sola el día que alguien agregó un grant de más
-- (`admin_stores`, `promo_vigente`, `cobranza_escalon`). Un grant amplio "por
-- ahora" es exactamente cómo empezaron los tres.
--
-- Esta función devuelve la bitácora DE UN NEGOCIO, acotada, y nada más. El día
-- que haga falta otra vista de la auditoría, se agrega otra función con su
-- propio recorte — no se ensancha ésta.
--
-- NO TOCA LA INMUTABILIDAD: sigue sin haber update ni delete para nadie
-- (055). Esto sólo lee.
-- ===========================================================================

create or replace function public.bitacora_del_negocio(
  p_store_id uuid,
  p_limite   int default 50
)
returns table (
  accion       text,
  actor_email  text,
  motivo       text,
  ip           text,
  cuando       timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_limite int;
begin
  /* GUARDA INTERNA, además de los grants de abajo. Los grants ya la dejan sólo
     para `service_role`; esto la deja cerrada IGUAL si mañana alguien la otorga
     de más. Es la lección de las tres superficies anteriores: una sola
     cerradura se abre sola. */
  if auth.uid() is not null then
    raise exception 'not_allowed';
  end if;

  /* Cota dura. Sin esto, un negocio con años de historia trae todo a memoria
     para mostrar una lista que nadie va a scrollear entera. */
  v_limite := least(greatest(coalesce(p_limite, 50), 1), 200);

  return query
  select a.action, a.actor_email, a.reason, a.ip, a.created_at
    from public.platform_audit a
   where a.target_store = p_store_id
   order by a.created_at desc
   limit v_limite;
end;
$$;

revoke execute on function public.bitacora_del_negocio(uuid, int) from public, authenticated, anon;
grant  execute on function public.bitacora_del_negocio(uuid, int) to service_role;
