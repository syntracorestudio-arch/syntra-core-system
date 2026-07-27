-- =============================================================================
-- StockFlow — 025_cobro_fase1.sql  (Cobro · Fase 1: confirmación + vuelto + alias)
--
-- Soporte de datos para el paso de confirmación de cobro y sus mejoras. TODO
-- aditivo: dos columnas nullable, una con default, y un setter chico. NO recrea
-- register_sale (la RPC reina queda intacta → cero riesgo de regresión en el
-- corazón transaccional). `by_method`/`reportes_medios`/`cierre_caja` NO cambian:
-- el discriminador sigue siendo `sales.payment_method`.
--
--   · sales.cash_tendered   — con cuánto pagó el cliente en efectivo. Nullable
--                             (solo se llena en ventas de efectivo con vuelto). El
--                             vuelto se deriva; guardarlo deja reconciliar la caja.
--   · store_settings.transfer_alias   — alias/CVU del negocio para transferencias,
--                             que el dueño carga en Ajustes. Dato operativo.
--   · store_settings.confirm_methods  — perilla por método del "confirmar antes de
--                             cobrar". Default TODOS en true (uniforme). El QR no
--                             entra: su diálogo YA es la confirmación.
--
-- Aplicar DESPUÉS de 024. La corre el owner.
-- =============================================================================

alter table public.sales
  add column if not exists cash_tendered numeric(12,2) check (cash_tendered >= 0);

alter table public.store_settings
  add column if not exists transfer_alias text;

alter table public.store_settings
  add column if not exists confirm_methods jsonb not null
    default '{"cash": true, "card": true, "transfer": true, "account": true}'::jsonb;

-- =============================================================================
-- guardar_efectivo_entregado — setter chico para persistir cash_tendered SIN
-- tocar register_sale. El action lo llama server-side después de registrar la
-- venta (un solo round-trip del cliente). Idempotente y acotado: solo pisa una
-- venta de efectivo, completada, del propio negocio.
-- =============================================================================
create or replace function public.guardar_efectivo_entregado(
  p_store_id uuid,
  p_sale_id  uuid,
  p_tendered numeric
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.rpc_member(p_store_id);
  if p_tendered is null or p_tendered < 0 then
    return;
  end if;

  update public.sales
     set cash_tendered = p_tendered
   where id = p_sale_id
     and store_id = p_store_id
     and payment_method = 'cash'
     and status = 'completed';
end;
$$;

grant execute on function public.guardar_efectivo_entregado(uuid, uuid, numeric) to authenticated;