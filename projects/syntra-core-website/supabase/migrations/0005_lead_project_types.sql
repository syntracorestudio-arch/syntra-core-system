-- ============================================================
-- SYNTRA CORE — Migración 0005: tipo(s) de proyecto del lead (MULTI-select)
-- Convierte la calificación de SINGLE (`project_type text`, 0004) a MULTI
-- (`project_types text[]`). El lead puede marcar varios tipos en el form.
-- Aditiva primero (columna + backfill), luego dropea la vieja ya respaldada.
-- Ejecutar en Supabase: SQL Editor → pegar → Run. ANTES de deployar el código.
-- ============================================================

-- 1) Nueva columna array (nullable: ausente = "no especificado").
alter table public.leads
  add column if not exists project_types text[];

-- 2) Integridad: o NULL, o al menos 1 elemento y todos dentro del enum
--    controlado (mismos valores que el enum Zod `PROJECT_TYPES`). Sin array vacío.
alter table public.leads
  drop constraint if exists leads_project_types_check;
alter table public.leads
  add constraint leads_project_types_check
    check (
      project_types is null
      or (
        array_length(project_types, 1) >= 1
        and project_types <@ array['web', 'automation', 'ai', 'unsure']::text[]
      )
    );

-- 3) Backfill desde la columna single de 0004: cada valor existente se
--    envuelve en un array de un elemento. Solo filas con dato y sin migrar aún.
update public.leads
  set project_types = array[project_type]
  where project_type is not null
    and project_types is null;

-- 4) Drop de lo viejo (datos ya respaldados en project_types).
alter table public.leads
  drop constraint if exists leads_project_type_check;
alter table public.leads
  drop column if exists project_type;
