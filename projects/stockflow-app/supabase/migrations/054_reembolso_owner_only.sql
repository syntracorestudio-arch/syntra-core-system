-- ===========================================================================
-- 054 · El reembolso y la plata a medio cobrar son del DUEÑO
--
-- Sale del rescate de la rama `feat/stockflow-split-dos-electronicas`, que
-- estuvo 3 semanas fuera de main. No es un problema de esa rama ni de main:
-- es de la COMBINACIÓN, y por eso ningún test de ninguna de las dos lo veía.
--
--   · La rama trae la Caja con "grupos a medio cobrar" y "cobros sin venta",
--     escritas cuando /admin/caja era owner-only (requireOwner). Con esa
--     premisa, `rpc_member` alcanzaba.
--   · Mientras tanto, 052 PARTIÓ la Caja: un empleado con `can_close_register`
--     entra a contar el cajón y recibe un `cierre_caja` recortado.
--
-- Al juntarlas, la página pide esas dos RPCs para CUALQUIERA que pueda cerrar
-- turno, y ellas siguen mirando sólo membresía ⇒ el empleado ve montos de
-- grupos a medio cobrar y cobros huérfanos. Exactamente la clase de fuga que
-- cerró 051, reintroducida por un merge.
--
-- Y una peor, que no es de lectura:
--
--   `marcar_pata_reembolsada` transiciona una pata approved → refunded y sólo
--   pedía `rpc_member`. Un empleado podía marcarla reembolsada SIN que se
--   moviera un peso. No es sólo un registro falso: `reembolsarGrupo` procesa
--   únicamente las patas todavía `approved`, así que una pata marcada a mano
--   SALTEA EL REEMBOLSO REAL PARA SIEMPRE — el cliente no cobra nunca y el
--   sistema dice que sí. Además esquiva el kill switch, que vive en la server
--   action (`STOCKFLOW_REEMBOLSO_HABILITADO`) y no en la base.
--
-- Las tres pasan a owner. Los cuerpos NO se transcriben: se extrajeron con
-- `pg_get_functiondef` y se les cambió la guardia, para no introducir una
-- diferencia entre lo que dice la migración y lo que corre.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · marcar_pata_reembolsada — la máquina de estados del reembolso
--
-- Owner-only, igual que la acción que la llama (`reembolsarGrupo`, que ya es
-- `requireOwner`). Es la única RPC de las tres que ESCRIBE, y la que podía
-- dejar a un cliente sin su plata.
-- ---------------------------------------------------------------------------
create or replace function public.marcar_pata_reembolsada(p_store_id uuid, p_intent_id uuid)
 RETURNS payment_intents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_intent public.payment_intents;
begin
  -- 054 · owner, no sólo miembro. Ver la cabecera de esta migración.
  if (public.rpc_member(p_store_id)).role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  select * into v_intent from public.payment_intents
   where id = p_intent_id and store_id = p_store_id;
  if not found then
    raise exception 'intent_not_found';
  end if;

  -- Idempotente: si ya se reembolsó, devolver sin tocar (reintento del mismo reembolso).
  if v_intent.status = 'refunded' then
    return v_intent;
  end if;

  -- Solo se reembolsa una pata que efectivamente cobró plata (approved) y que no llegó
  -- a ser una venta. Una pata sin acreditar no tiene nada que devolver; una ya vendida
  -- se corrige anulando la venta (void_sale), no reembolsando la pata suelta.
  if v_intent.sale_id is not null then
    raise exception 'already_sold';
  end if;
  if v_intent.status <> 'approved' then
    raise exception 'not_refundable';
  end if;

  update public.payment_intents
     set status = 'refunded'
   where id = p_intent_id and store_id = p_store_id and status = 'approved'
  returning * into v_intent;

  return v_intent;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2 · grupos_a_medio_cobrar — cuánta plata quedó colgada, por grupo
--
-- Es el material del que se hace el reembolso: montos cobrados y pendientes de
-- ventas que no se completaron. Del dueño.
-- ---------------------------------------------------------------------------
create or replace function public.grupos_a_medio_cobrar(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_member public.members;
begin
  v_member := public.rpc_member(p_store_id);
  -- 054 · owner, no sólo miembro. Ver la cabecera de esta migración.
  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

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
$function$;

-- ---------------------------------------------------------------------------
-- 3 · cobros_sin_venta — cobros acreditados que no llegaron a ser venta
--
-- Mismo criterio: son importes acreditados en MercadoPago. Del dueño.
-- ---------------------------------------------------------------------------
create or replace function public.cobros_sin_venta(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_member public.members;
begin
  v_member := public.rpc_member(p_store_id);
  -- 054 · owner, no sólo miembro. Ver la cabecera de esta migración.
  if v_member.role <> 'owner' then
    raise exception 'not_allowed';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', pi.id,
             'monto', coalesce(
               (select sum((p->>'amount')::numeric) from jsonb_array_elements(pi.split_pagos) p),
               pi.amount),
             'items', pi.items,
             'idempotency_key', pi.idempotency_key,
             'client_id', pi.client_id,
             'split_pagos', pi.split_pagos,
             'cuando', pi.created_at
           ) order by pi.created_at desc), '[]'::jsonb)
      from public.payment_intents pi
     where pi.store_id = p_store_id
       and pi.status = 'approved'
       and pi.sale_id is null
       and pi.split_group_id is null   -- patas de grupo → banner de grupo, no acá
       and pi.created_at >= now() - interval '7 days'
  );
end;
$function$;

