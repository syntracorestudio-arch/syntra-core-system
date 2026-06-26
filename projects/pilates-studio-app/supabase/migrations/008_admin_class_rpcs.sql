-- =============================================================================
-- StudioFlow — 008_admin_class_rpcs.sql  (Fase 1F)
-- RPCs de admin para gestionar clases:
--   · materialize_schedule  — genera ocurrencias de una regla recurrente (TZ/DST-safe,
--     idempotente, ventana de N semanas). Decisión Fase 0B: 8 semanas (extensible a 12).
--   · cancel_class_occurrence — cancela una ocurrencia (soft-delete) + sus reservas +
--     refund (cancelación POR EL ESTUDIO → devuelve crédito si el pack sigue vigente).
--   · cancel_class — archiva la clase + cancela sus ocurrencias futuras.
-- Todas SECURITY DEFINER (owner postgres), revalidan auth_has_role(admin/reception).
-- Fuente: docs/reference-locks/crear-gestionar-clases.md + business-rules.md §3/§7/§11.
-- =============================================================================

-- ---------------- materialize_schedule ----------------
create or replace function public.materialize_schedule(p_schedule_id uuid, p_weeks int default 8)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_sch    public.class_schedules;
  v_tz     text;
  v_dur    int;
  v_today  date;
  v_start  date;
  v_end    date;
  v_d      date;
  v_starts timestamptz;
  v_count  int := 0;
begin
  select * into v_sch from public.class_schedules where id = p_schedule_id;
  if not found then raise exception 'schedule_not_found' using errcode = 'P0002'; end if;

  if not public.auth_has_role(v_sch.studio_id, array['admin','reception']) then
    raise exception 'forbidden';
  end if;

  select timezone into v_tz from public.studios where id = v_sch.studio_id;
  select duration_min into v_dur from public.classes where id = v_sch.class_id;

  v_today := (timezone(v_tz, now()))::date;
  v_start := greatest(v_sch.valid_from, v_today);
  v_end   := least(coalesce(v_sch.valid_to, v_today + (p_weeks * 7)), v_today + (p_weeks * 7));

  v_d := v_start;
  while v_d <= v_end loop
    if extract(dow from v_d)::int = v_sch.weekday then
      -- hora local del estudio → UTC (DST-safe: usa la TZ por fecha, no offset fijo)
      v_starts := ((v_d::text || ' ' || v_sch.start_time::text)::timestamp) at time zone v_tz;
      if v_starts > now() then
        insert into public.class_occurrences
          (studio_id, class_id, schedule_id, starts_at, ends_at, capacity, booked_count, status)
        values (v_sch.studio_id, v_sch.class_id, v_sch.id, v_starts,
                v_starts + make_interval(mins => v_dur), v_sch.capacity, 0, 'scheduled')
        on conflict (class_id, starts_at) do nothing;
        if found then v_count := v_count + 1; end if;  -- cuenta solo las realmente insertadas
      end if;
    end if;
    v_d := v_d + 1;
  end loop;

  return v_count;
end $$;
grant execute on function public.materialize_schedule(uuid, int) to authenticated;

-- ---------------- cancel_class_occurrence ----------------
create or replace function public.cancel_class_occurrence(p_occurrence_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_occ      public.class_occurrences;
  v_res      public.class_reservations;
  v_pass_id  uuid;
  v_valid    boolean;
  v_count    int := 0;
begin
  select * into v_occ from public.class_occurrences where id = p_occurrence_id for update;
  if not found then raise exception 'occurrence_not_found' using errcode = 'P0002'; end if;
  if not public.auth_has_role(v_occ.studio_id, array['admin','reception']) then
    raise exception 'forbidden';
  end if;

  -- cancelar cada reserva activa. Cancelación POR EL ESTUDIO: el alumno no debe perder el
  -- crédito por una decisión del estudio → refund si el pack original sigue vigente
  -- (pack vencido → sin refund automático; ajuste manual, igual que la decisión Fase 1C-0).
  for v_res in select * from public.class_reservations
               where occurrence_id = v_occ.id and status = 'booked'
  loop
    v_valid := false;
    if v_res.consumed_credit and v_res.credit_ledger_id is not null then
      select cl.member_pass_id into v_pass_id from public.credit_ledger cl where cl.id = v_res.credit_ledger_id;
      select (mp.expires_at > now()) into v_valid from public.member_passes mp where mp.id = v_pass_id;
    end if;

    if v_res.consumed_credit and coalesce(v_valid, false) then
      insert into public.credit_ledger(studio_id, member_id, member_pass_id, delta, reason, reservation_id)
      values (v_res.studio_id, v_res.member_id, v_pass_id, +1, 'refund', v_res.id);
    end if;

    update public.class_reservations set status = 'cancelled', cancelled_at = now() where id = v_res.id;
    v_count := v_count + 1;
  end loop;

  update public.class_occurrences set booked_count = 0, status = 'cancelled' where id = v_occ.id;
  return v_count;  -- reservas canceladas
end $$;
grant execute on function public.cancel_class_occurrence(uuid) to authenticated;

-- ---------------- cancel_class (archivar + cancelar futuras) ----------------
create or replace function public.cancel_class(p_class_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_studio uuid;
  v_occ_id uuid;
  v_count  int := 0;
begin
  select studio_id into v_studio from public.classes where id = p_class_id;
  if not found then raise exception 'class_not_found' using errcode = 'P0002'; end if;
  if not public.auth_has_role(v_studio, array['admin','reception']) then
    raise exception 'forbidden';
  end if;

  for v_occ_id in
    select id from public.class_occurrences
    where class_id = p_class_id and status = 'scheduled' and starts_at > now()
  loop
    perform public.cancel_class_occurrence(v_occ_id);
    v_count := v_count + 1;
  end loop;

  update public.classes set status = 'archived' where id = p_class_id;
  return v_count;  -- ocurrencias futuras canceladas
end $$;
grant execute on function public.cancel_class(uuid) to authenticated;

-- Fin 008_admin_class_rpcs.sql
