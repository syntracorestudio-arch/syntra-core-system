-- =============================================================================
-- StockFlow — 033_split_dos_grupo_vencido.sql  (Cota: grupo a medio cobrar vencido →
-- marcar para revisión del dueño)
--
-- Una venta a medio cobrar es plata capturada sin venta cerrada. Si queda olvidada, el
-- dueño tiene que enterarse. `grupos_a_medio_cobrar` ahora marca `vencido = true` cuando
-- el grupo lleva más de 6 horas a medio cobrar (bien fuera de cualquier transacción en
-- curso; incluye el caso "se cayó al cierre, aparece al otro día"). El banner le da
-- tratamiento de revisión.
--
-- Además, la ventana de lectura pasa de 7 a 30 días SOLO para esta consulta: un grupo
-- vencido con plata retenida no puede desaparecer del banner en una semana. Sigue acotada
-- (baseline) y los grupos a medio cobrar son rarísimos, así que el costo es trivial.
--
-- Aditivo (solo redefine la función). Aplicar DESPUÉS de 032. La corre el owner.
-- =============================================================================

create or replace function public.grupos_a_medio_cobrar(p_store_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_member public.members;
begin
  v_member := public.rpc_member(p_store_id);

  return (
    with grupos as (
      select pi.split_group_id as group_id,
             (array_agg(pi.split_pagos order by pi.created_at))[1]   as split_pagos,
             (array_agg(pi.items order by pi.created_at))[1]         as items,
             (array_agg(pi.client_id order by pi.created_at))[1]     as client_id,
             min(pi.created_at)                                      as cuando,
             count(*) filter (where pi.status = 'approved')          as n_approved
        from public.payment_intents pi
       where pi.store_id = p_store_id
         and pi.split_group_id is not null
         and pi.sale_id is null
         -- 30 días: un grupo vencido con plata retenida no puede caerse del banner en
         -- una semana. Sigue acotado; los grupos a medio cobrar son excepcionales.
         and pi.created_at >= now() - interval '30 days'
       group by pi.split_group_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'group_id', g.group_id,
             'items', g.items,
             'split_pagos', g.split_pagos,
             'total', (select coalesce(sum((p->>'amount')::numeric), 0)
                         from jsonb_array_elements(g.split_pagos) p),
             'client_id', g.client_id,
             'cuando', g.cuando,
             -- Vencido: a medio cobrar hace más de 6 horas → revisión del dueño.
             'vencido', (g.cuando < now() - interval '6 hours'),
             'cobrado', (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'method', pi.split_leg_method, 'amount', pi.amount)
                        order by pi.created_at), '[]'::jsonb)
                 from public.payment_intents pi
                where pi.store_id = p_store_id
                  and pi.split_group_id = g.group_id
                  and pi.status = 'approved'
             ),
             'pendiente', (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'method', x.method, 'amount', x.amount)), '[]'::jsonb)
                 from jsonb_to_recordset(g.split_pagos) as x(method text, amount numeric)
                where x.method in ('card', 'qr')
                  and not exists (
                    select 1 from public.payment_intents pi
                     where pi.store_id = p_store_id
                       and pi.split_group_id = g.group_id
                       and pi.status = 'approved'
                       and pi.split_leg_method = x.method
                  )
             )
           ) order by g.cuando desc), '[]'::jsonb)
      from grupos g
     where g.n_approved >= 1
  );
end;
$$;

grant execute on function public.grupos_a_medio_cobrar(uuid) to authenticated;