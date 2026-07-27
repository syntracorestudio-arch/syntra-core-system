-- =============================================================================
-- StockFlow — 026_cobro_point.sql  (Cobros Fase 2: terminal Point de MercadoPago)
--
-- Soporte de datos para cobrar con TARJETA en una terminal Point integrada: el
-- sistema empuja el monto a la terminal (misma Orders API que el QR, con
-- type='point') → elimina el mismatch de monto de tarjeta. TODO aditivo.
--
--   · store_settings.has_posnet   — ¿el negocio tiene terminal Point? Lo prende el
--                                   dueño en Ajustes. Si está en false, la caja no
--                                   pregunta nada (cero fricción para el que no la
--                                   tiene) y el QR sigue como hoy.
--   · store_payment_providers.mp_terminal_id — el id de la terminal Point vinculada
--                                   a la cuenta MP del negocio (de GET /terminals/v1/
--                                   list). service_role only, junto al token cifrado.
--
-- El cobro por Point NO necesita tabla nueva: reusa `payment_intents` (guarda el
-- `mp_order_id` de la orden Point igual que la del QR) y `register_sale` (la venta
-- se registra como 'card', que es lo que es). by_method/reportes/cierre sin cambios.
--
-- Aplicar DESPUÉS de 025. La corre el owner.
-- =============================================================================

alter table public.store_settings
  add column if not exists has_posnet boolean not null default false;

alter table public.store_payment_providers
  add column if not exists mp_terminal_id text;