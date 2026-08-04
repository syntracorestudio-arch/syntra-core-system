-- =============================================================================
-- StockFlow — 042_asistente_narrativa.sql  (Asistente IA · Fase 2, narrativa)
--
-- El reporte mensual suma un párrafo redactado por un modelo de lenguaje SOBRE
-- los números ya calculados (el modelo no calcula: ver src/lib/asistente/hechos.ts).
-- Esta migración solo agrega el LIBRO de esa capa a report_deliveries (020):
-- qué se dijo, con qué modelo y cuántos tokens costó.
--
-- Para qué sirve el registro:
--   · costo real del add-on por negocio/mes (se factura por valor, pero hay que
--     saber qué cuesta),
--   · auditoría: si el dueño pregunta "¿de dónde sacó eso?", el texto está guardado,
--   · salud de la verificación: `narrativa_estado = 'rechazada'` cuenta las veces
--     que el modelo intentó una cifra que nadie computó. Si eso sube, se revisa
--     el prompt — no se afloja el verificador.
--
-- Additiva y opcional: si no se corre, el reporte sale igual (el UPDATE del
-- registro falla solo y queda logueado). Sin cambios de permisos: la tabla sigue
-- siendo service_role únicamente (RLS forzada sin policies, desde 020).
-- =============================================================================

alter table public.report_deliveries
  add column if not exists narrativa            text,
  add column if not exists narrativa_estado     text,
  add column if not exists narrativa_motivo     text,
  add column if not exists narrativa_modelo     text,
  add column if not exists narrativa_tokens_in  int,
  add column if not exists narrativa_tokens_out int;

-- Estados posibles: 'ok' (se usó), 'rechazada' (no pasó la verificación de
-- cifras), 'fallida' (API caída/timeout/respuesta rara). 'desactivada' (sin API
-- key) no se registra: no hubo llamada ni costo.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'report_deliveries_narrativa_estado_check'
  ) then
    alter table public.report_deliveries
      add constraint report_deliveries_narrativa_estado_check
      check (narrativa_estado is null or narrativa_estado in ('ok', 'rechazada', 'fallida'));
  end if;
end $$;

comment on column public.report_deliveries.narrativa is
  'Párrafo del asistente efectivamente enviado (null si no se usó ninguno).';
comment on column public.report_deliveries.narrativa_estado is
  'ok | rechazada (cifra no verificable) | fallida (API). Sin fila = sin llamada.';