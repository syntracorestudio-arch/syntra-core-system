-- ============================================================
-- SYNTRA CORE — Migración 0003: normalización + índice de email (TASK-022)
-- Calidad de datos del pipeline de leads. Aditiva y segura.
-- NO agrega UNIQUE: un lead es una consulta/evento, no una persona. El mismo
-- cliente puede consultar legítimamente más de una vez. La detección de
-- duplicados es OBSERVABLE (panel), nunca bloqueante.
-- Ejecutar en Supabase: SQL Editor → pegar → Run.
-- ============================================================

-- Backfill: normalizar emails legacy a minúsculas (mismo buzón, cambio seguro).
-- Mantiene consistencia con la normalización nueva en leadSchema (trim+lowercase).
update public.leads
  set email = lower(email)
  where email <> lower(email);

-- Índice NO único sobre email: habilita detección/consulta de repetidos sin
-- forzar unicidad. La columna ya llega normalizada desde la app (no hace falta
-- functional index lower(email)).
create index if not exists leads_email_idx on public.leads (email);
