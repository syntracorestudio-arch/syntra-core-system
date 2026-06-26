-- =============================================================================
-- StudioFlow — 007_fix_member_financial_status_rls.sql  (Fase 1E)
-- FIX DE SEGURIDAD: la vista member_financial_status (creada en 001) era
-- security_definer por default → corría con privilegios del owner y BYPASSABA RLS,
-- exponiendo el estado financiero de TODOS los alumnos a cualquier usuario.
-- Con security_invoker = true, la vista respeta la RLS del usuario que consulta:
-- el alumno ve solo su fila; el admin/reception, solo las de su estudio.
-- No se modifica la definición de la vista (no se pierden grants). PG15+.
-- =============================================================================

alter view public.member_financial_status set (security_invoker = true);

-- Fin 007_fix_member_financial_status_rls.sql
