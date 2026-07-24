-- =============================================================================
-- StockFlow — 020_reporte_mensual.sql  (Asistente IA · motor del reporte mensual)
--
-- Backend del reporte que el cron manda por email el 1° de cada mes a los negocios
-- con `ai_assistant_enabled = true` (flag de 019). DOS objetos, ambos SOLO
-- service_role (nadie los toca desde el browser):
--
--   1. report_deliveries — libro retry-safe de entregas. Separa "intentado" de
--      "enviado con éxito" (`sent_at`): si Resend falla DESPUÉS de reclamar el mes,
--      el próximo run reintenta en vez de saltear el mes en silencio. El unique
--      (store_id, period) evita doble-envío.
--
--   2. asistente_datos_mensuales — junta en un solo jsonb los datos del reporte
--      REUSANDO las RPCs existentes (reportes_summary/medios/expenses), sin
--      recalcular nada: los números salen IDÉNTICOS a la página de Reportes.
--      Problema que resuelve: esas RPCs gatean por `rpc_member` (= auth.uid()) y
--      el cron corre como service_role SIN auth.uid(). La función impersona al
--      DUEÑO del negocio —y solo a él, y solo para SU negocio— seteando el claim
--      JWT LOCAL a la transacción (auth.uid() lo lee de request.jwt.claim.sub).
--      store_alerts y margenes_erosionados_core ya son service-role y se llaman
--      directo desde el cron (igual que el cron de alertas).
--
-- Additiva: aplicar DESPUÉS de 019. La corre el owner en el SQL Editor.
-- =============================================================================

-- =============================================================================
-- 1. report_deliveries — una fila por (negocio, mes). Retry-safe.
--    RLS forzada SIN policies → solo service_role (bypass) la lee/escribe. El
--    dueño no tiene por qué ver la mecánica de entrega.
-- =============================================================================
create table if not exists public.report_deliveries (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  period      text not null check (period ~ '^\d{4}-\d{2}$'),  -- 'YYYY-MM'
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts    int  not null default 0,
  last_error  text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (store_id, period)
);

alter table public.report_deliveries enable row level security;
alter table public.report_deliveries force row level security;
revoke all on public.report_deliveries from anon, authenticated;
-- Sin policies a propósito: service_role bypassa RLS; el resto ve 0 filas.
-- El bypass de RLS NO alcanza: hay que otorgar los privilegios de tabla al rol
-- (bypassrls solo saltea las policies, no reemplaza el GRANT). El cron corre como
-- service_role y necesita leer/escribir el libro de entregas.
grant select, insert, update, delete on public.report_deliveries to service_role;

-- =============================================================================
-- 2. asistente_datos_mensuales — bundle de datos del reporte, service-role only.
-- =============================================================================
create or replace function public.asistente_datos_mensuales(
  p_store_id uuid,
  p_from     date,
  p_to       date
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_owner       uuid;
  v_owner_email text;
  v_owner_name  text;
begin
  -- Dueño del negocio: su identidad para impersonar + su email como destinatario.
  select m.profile_id, pr.email, m.display_name
    into v_owner, v_owner_email, v_owner_name
    from public.members m
    join public.profiles pr on pr.id = m.profile_id
   where m.store_id = p_store_id and m.role = 'owner' and m.status = 'active'
   order by m.created_at
   limit 1;

  if v_owner is null then
    raise exception 'owner_not_found';
  end if;

  -- Impersonación LOCAL a la transacción: las RPCs de reportes gatean por
  -- auth.uid(); acá no hay usuario (service_role). Se setea el claim que
  -- auth.uid() lee. `true` = solo esta transacción; PostgREST corre la RPC en una.
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  return jsonb_build_object(
    'owner', jsonb_build_object('email', v_owner_email, 'name', v_owner_name),
    'resumen', public.reportes_summary(p_store_id, p_from, p_to),
    'medios',  public.reportes_medios(p_store_id, p_from, p_to),
    'gastos',  public.reportes_expenses(p_store_id, p_from, p_to)
  );
end;
$$;

revoke all on function public.asistente_datos_mensuales(uuid, date, date) from public, anon, authenticated;
grant execute on function public.asistente_datos_mensuales(uuid, date, date) to service_role;