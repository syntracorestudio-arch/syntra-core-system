-- =============================================================================
-- StudioFlow — 032_perf_indexes.sql  (auditoría de escalabilidad 2026-07-17)
-- Índices faltantes detectados revisando TODAS las queries del código contra los
-- índices existentes (migraciones 001-031). Ordenados por impacto. Aditiva, sin
-- cambios de datos; `if not exists` la hace re-ejecutable.
-- =============================================================================

-- 1. /cuenta y ficha del alumno listan pagos propios: hoy seq scan (FK sin índice).
create index if not exists payments_member_paid_idx
  on public.payments (member_id, paid_at desc);

-- 2. "Mis colas" del alumno (/app y Mi actividad) + RLS waitlist_select_own.
create index if not exists waitlist_member_status_idx
  on public.waitlist (member_id, status);

-- 3. Badge de no-leídas del panel: COUNT en cada render del layout admin.
create index if not exists notifications_unread_panel_idx
  on public.notifications (studio_id)
  where read_at is null and member_id is null;

-- 4. edit_class / materialize borran-actualizan ocurrencias por schedule (FK sin índice).
create index if not exists class_occurrences_schedule_idx
  on public.class_occurrences (schedule_id);

-- 5. instructor_month_pay y roster filtran instructor_id sin studio_id:
--    el índice compuesto (studio_id, instructor_id) no aplica ahí.
create index if not exists classes_instructor_only_idx
  on public.classes (instructor_id) where instructor_id is not null;

-- 6. Saldo del alumno + reserve_class + promoción: member_id + expires_at.
create index if not exists member_passes_member_expiry_idx
  on public.member_passes (member_id, expires_at);

-- 7. FK credit_ledger.reservation_id (set null al cancelar/borrar reservas).
create index if not exists credit_ledger_reservation_idx
  on public.credit_ledger (reservation_id) where reservation_id is not null;

-- 8-13. Higiene de FKs restantes (cascadas / set-null; costo de mantenimiento ~nulo).
create index if not exists payments_recorded_by_idx
  on public.payments (recorded_by) where recorded_by is not null;
create index if not exists credit_ledger_created_by_idx
  on public.credit_ledger (created_by) where created_by is not null;
create index if not exists member_passes_pass_idx
  on public.member_passes (pass_id) where pass_id is not null;
create index if not exists member_passes_src_pay_idx
  on public.member_passes (source_payment_id) where source_payment_id is not null;
create index if not exists memberships_src_pay_idx
  on public.memberships (source_payment_id) where source_payment_id is not null;
create index if not exists staff_rates_member_idx
  on public.staff_rates (member_id);

-- Fin 032_perf_indexes.sql
