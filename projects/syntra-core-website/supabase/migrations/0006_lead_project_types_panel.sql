-- ============================================================
-- SYNTRA CORE — Migración 0006: agregar 'panel' al enum de project_types
-- BUGFIX de pérdida de leads. El formulario ofrece 5 opciones y el enum Zod
-- (`PROJECT_TYPES`, lead-shared.ts) tiene 5, pero el CHECK de 0005 solo listó
-- 4: quedó afuera 'panel' ("Panel de gestión"). Todo lead que marcaba esa
-- opción violaba la constraint ⇒ el INSERT fallaba ⇒ el lead SE PERDÍA con el
-- mensaje "No pudimos guardar tu mensaje".
-- Aditiva y segura sobre tabla viva: solo AMPLÍA el conjunto permitido (ningún
-- dato existente puede violar la constraint nueva).
-- Ejecutar en Supabase: SQL Editor → pegar → Run.
-- ============================================================

alter table public.leads
  drop constraint if exists leads_project_types_check;

alter table public.leads
  add constraint leads_project_types_check
    check (
      project_types is null
      or (
        array_length(project_types, 1) >= 1
        -- Fuente de verdad: PROJECT_TYPES en src/lib/validations/lead-shared.ts.
        -- Si se agrega un tipo allá, agregarlo ACÁ en la misma tanda.
        and project_types <@ array['web', 'automation', 'ai', 'panel', 'unsure']::text[]
      )
    );
