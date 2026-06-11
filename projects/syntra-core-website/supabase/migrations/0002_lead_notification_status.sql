-- ============================================================
-- SYNTRA CORE — Migración 0002: observabilidad de notificación (TASK-020)
-- Agrega un EJE SEPARADO del status comercial para saber, desde Supabase/panel,
-- si un lead fue notificado a n8n. App-owned (Opción B).
-- Ejecutar en Supabase: SQL Editor → pegar → Run. (Aditiva, segura sobre tabla viva.)
-- ============================================================

-- notification_status: pending | sent | failed | unknown
-- Se agrega nullable, se backfillea, y recién después se fija default + not null.
alter table public.leads
  add column if not exists notification_status text;

-- Backfill: leads previos a esta migración → 'unknown' (NO 'pending', para no
-- generar falsos positivos en el panel: nunca pasaron por el flujo nuevo).
update public.leads
  set notification_status = 'unknown'
  where notification_status is null;

alter table public.leads
  alter column notification_status set default 'pending',
  alter column notification_status set not null;

alter table public.leads
  add constraint leads_notification_status_check
    check (notification_status in ('pending', 'sent', 'failed', 'unknown'));

-- Metadatos de la notificación
alter table public.leads
  add column if not exists notified_at timestamptz,
  add column if not exists notification_attempts integer not null default 0,
  add column if not exists last_notification_error_code text;

-- last_notification_error_code: solo códigos controlados (nunca texto libre/PII/secretos)
alter table public.leads
  add constraint leads_notification_error_code_check
    check (
      last_notification_error_code is null
      or last_notification_error_code in (
        'timeout', 'network_error', 'http_error', 'unexpected_error', 'missing_webhook_url'
      )
    );

-- Índice para el detector / filtro del panel por estado de notificación
create index if not exists leads_notification_status_idx
  on public.leads (notification_status);
