-- ============================================================
-- SYNTRA CORE — Migración 0004: tipo de proyecto del lead (WEB-013B)
-- Calificación OPCIONAL del lead, capturada en el formulario de contacto.
-- Aditiva, nullable, segura sobre tabla viva. Sin backfill: los leads previos
-- quedan en NULL ("no especificado"), que es semánticamente correcto.
-- Ejecutar en Supabase: SQL Editor → pegar → Run.
-- ============================================================

alter table public.leads
  add column if not exists project_type text;

-- Solo valores controlados (mismos que el enum Zod `PROJECT_TYPES`).
alter table public.leads
  add constraint leads_project_type_check
    check (
      project_type is null
      or project_type in ('web', 'automation', 'ai', 'unsure')
    );
