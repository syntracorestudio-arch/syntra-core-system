-- ===========================================================================
-- 067 · resumen_seguimiento — el seguimiento, visible desde la cartera
--
-- QUÉ RESUELVE. 066 dejó anotar el contacto humano y agendar cuándo volver a
-- llamar, pero esos datos viven SÓLO adentro de la ficha de cada cliente. O
-- sea: una fecha agendada para el 28 no se ve en ningún lado a menos que
-- entres al cliente — y si hay que entrar de a uno para saber a quién llamar,
-- la agenda no sirve para planificar la semana, que es exactamente para lo que
-- se anotó.
--
-- POR QUÉ UNA RPC Y NO DOS CONSULTAS DESDE EL PANEL.
--
-- `seguimiento_el` sale de `subscriptions` con un select simple, pero "el
-- último contacto de cada negocio" es una agregación por grupo: desde PostgREST
-- eso obliga a traerse los contactos y reducirlos en TypeScript. Con 30 clientes
-- funcionaría, y por eso es tentador — pero es traer N filas para quedarse con
-- una por negocio, y crece con el historial, no con la cartera. `distinct on`
-- lo resuelve en una pasada usando el índice que 066 ya creó.
-- ===========================================================================

create or replace function public.resumen_seguimiento()
returns table (
  store_id        uuid,
  seguimiento_el  date,
  ultimo_contacto timestamptz,
  ultimo_canal    text,
  contactos       int
)
language plpgsql stable security definer set search_path = public as $$
begin
  /* Misma guarda que el resto de las funciones del panel: los grants ya la
     dejan sólo para service_role, y esto la deja cerrada igual si mañana
     alguien la otorga de más. */
  if auth.uid() is not null then
    raise exception 'not_allowed';
  end if;

  return query
  with ultimos as (
    /* `distinct on` + el índice (store_id, created_at desc) de 066: una fila
       por negocio, sin ordenar todo el historial. */
    select distinct on (c.store_id)
           c.store_id, c.created_at, c.canal
      from public.client_contacts c
     order by c.store_id, c.created_at desc
  ),
  totales as (
    select c.store_id, count(*)::int as n
      from public.client_contacts c
     group by c.store_id
  )
  select
    s.id,
    sub.seguimiento_el,
    u.created_at,
    u.canal,
    coalesce(t.n, 0)
  from public.stores s
  left join public.subscriptions sub on sub.store_id = s.id
  left join ultimos u on u.store_id = s.id
  left join totales t on t.store_id = s.id;
end;
$$;

revoke execute on function public.resumen_seguimiento() from public, authenticated, anon;
grant  execute on function public.resumen_seguimiento() to service_role;
