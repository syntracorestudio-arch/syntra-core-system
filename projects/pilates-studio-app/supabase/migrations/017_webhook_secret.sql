-- =============================================================================
-- StudioFlow — 017_webhook_secret.sql  (Fase 3, Slice A2)
-- Clave secreta del webhook de MercadoPago por estudio, para validar la firma
-- 'x-signature' de las notificaciones. Se guarda CIFRADA a nivel app (igual que
-- access_token) y es OPCIONAL: si el estudio no la configura, el webhook igual
-- protege el cobro re-consultando el pago en MP + binding de intento/monto (016/#75).
-- Aditiva y no destructiva: solo agrega una columna nullable.
-- =============================================================================

alter table public.studio_payment_providers
  add column if not exists webhook_secret text;  -- ciphertext AES-GCM; NULL = sin firma

-- Fin 017_webhook_secret.sql
