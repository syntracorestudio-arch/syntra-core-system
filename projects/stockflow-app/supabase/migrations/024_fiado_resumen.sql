-- =============================================================================
-- StockFlow — 024_fiado_resumen.sql  (auditoría Tanda 3: aging de fiado)
--
-- Las etiquetas "Debe desde" y "Último pago" de la pantalla de Fiado se calculaban
-- en el cliente con una query frágil: traía el ledger STORE-WIDE con `gte(365 días)`
-- + `order asc limit(3000)`. En un negocio activo eso tira los movimientos RECIENTES
-- (el cap de 3000 ascendente se queda con los más viejos) e ignora la deuda de más
-- de un año → el aging mentía. La plata (el saldo) estaba bien; las etiquetas que el
-- dueño usa para decidir a quién cobrar, no.
--
-- Fix: una RPC que calcula el aging CORRECTO por cliente con una window function
-- sobre el ledger del negocio (una pasada, particionada por cliente), acotada al
-- negocio (el fiado es chico por naturaleza). Owner-only (la pantalla ya lo es).
--
--   · balance      = suma del ledger (nunca un contador).
--   · ultimo_pago  = fecha del último movimiento 'payment'.
--   · debe_desde   = arranque del tramo ACTUAL en rojo: el primer movimiento
--                    posterior a la última vez que el saldo corrido volvió a >= 0.
--                    (Si nunca estuvo en cero, el primer movimiento de todos.)
--
-- Additiva. Aplicar DESPUÉS de 023. La corre el owner.
-- =============================================================================
create or replace function public.fiado_resumen(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
begin
  v_member := public.rpc_member(p_store_id);
  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  return (
    with led as (
      select client_id, created_at, id, reason, delta,
             sum(delta) over (partition by client_id order by created_at, id) as run
        from public.client_ledger
       where store_id = p_store_id
    ),
    marks as (
      select client_id,
             sum(delta)                                          as balance,
             max(created_at) filter (where reason = 'payment')   as ultimo_pago,
             max(created_at) filter (where run >= 0)             as ultimo_no_rojo
        from led
       group by client_id
    ),
    aging as (
      select l.client_id,
             min(l.created_at) filter (
               where l.created_at > coalesce(m.ultimo_no_rojo, '-infinity'::timestamptz)
             ) as debe_desde
        from led l
        join marks m on m.client_id = l.client_id
       group by l.client_id
    ),
    filas as (
      select c.id as client_id, c.name, c.credit_limit,
             coalesce(m.balance, 0)::numeric(12,2) as balance,
             case when coalesce(m.balance, 0) < 0 then a.debe_desde else null end as debe_desde,
             m.ultimo_pago
        from public.clients c
        left join marks m on m.client_id = c.id
        left join aging a on a.client_id = c.id
       where c.store_id = p_store_id
       order by coalesce(m.balance, 0)   -- más deudor primero (saldo negativo)
       limit 500
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'client_id', client_id, 'name', name, 'credit_limit', credit_limit,
             'balance', balance, 'debe_desde', debe_desde, 'ultimo_pago', ultimo_pago
           )), '[]'::jsonb)
      from filas
  );
end;
$$;

grant execute on function public.fiado_resumen(uuid) to authenticated;