-- =============================================================================
-- StockFlow — 032_split_dos_reembolso.sql  (Reembolso de un split a medio cobrar)
--
-- El caso que cierra el feature: el cliente se fue con una pata cobrada y la otra sin
-- cobrar. La salida es DEVOLVER la pata cobrada y anular el grupo (sin venta). La plata
-- la devuelve MercadoPago (lib `mpReembolsarOrden` + acción `reembolsarGrupo`, owner-only);
-- esta migración es la parte de base:
--
--   · payment_intents.status admite 'refunded' (la pata cuya plata se devolvió).
--   · marcar_pata_reembolsada — transiciona una pata approved → refunded. Idempotente
--     (si ya está refunded, no hace nada). Solo sobre una pata ACREDITADA y SIN venta:
--     una pata sin acreditar no tiene nada que devolver (not_refundable), y una que ya
--     es parte de una venta se corrige anulando la venta, no reembolsando la pata
--     (already_sold). Una vez refunded, el grupo deja de estar "a medio cobrar".
--
-- Money-critical: el reembolso mueve plata real por una API nueva de MP. Se habilita
-- SOLO después de validarlo en el sandbox de MercadoPago (ver el plan). Esta migración
-- (idempotencia + guardas de estado) es segura de aplicar antes; el gate está en la
-- acción/lib que llama a MP.
--
-- Aditivo. Aplicar DESPUÉS de 031. La corre el owner.
-- =============================================================================

-- 1) La pata cuya plata se devolvió.
alter table public.payment_intents drop constraint if exists payment_intents_status_check;
alter table public.payment_intents
  add constraint payment_intents_status_check
  check (status in ('pending','approved','rejected','expired','cancelled','refunded'));

-- 2) Transición approved → refunded de UNA pata. Idempotente y con guardas de estado.
--    (La plata ya la devolvió MP cuando se llama a esto; acá se asienta el estado.)
create or replace function public.marcar_pata_reembolsada(
  p_store_id  uuid,
  p_intent_id uuid
) returns public.payment_intents
language plpgsql security definer set search_path = public as $$
declare
  v_intent public.payment_intents;
begin
  perform public.rpc_member(p_store_id);

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
$$;

grant execute on function public.marcar_pata_reembolsada(uuid, uuid) to authenticated;