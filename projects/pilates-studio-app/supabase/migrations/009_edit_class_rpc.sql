-- =============================================================================
-- StudioFlow — 009_edit_class_rpc.sql  (Fase 1F-1c)
-- RPC de admin para EDITAR una clase ya creada:
--   · update_class — edita metadatos (nombre/profe/cupo/duración) y la regla
--     (única: fecha/hora · recurrente: días/hora/vigencia).
-- Reglas del reference-lock crear-gestionar-clases.md:
--   · La edición afecta SOLO ocurrencias futuras SIN reservas; las que ya tienen
--     alumnos anotados NO se tocan (se conservan tal cual).
--   · NUNCA se baja el cupo de una ocurrencia por debajo de lo ya reservado.
--   · No se permite cambiar el TIPO (única ↔ recurrente) en edición.
-- SECURITY DEFINER, revalida auth_has_role(admin/reception).
-- =============================================================================

create or replace function public.update_class(
  p_class_id    uuid,
  p_name        text,
  p_instructor  text,
  p_capacity    int,
  p_duration    int,
  p_is_recurring boolean,
  p_weekdays    int[]  default null,    -- recurrente
  p_start_time  time   default null,    -- recurrente
  p_valid_from  date   default null,    -- recurrente
  p_valid_to    date   default null,    -- recurrente
  p_date        date   default null,    -- única
  p_time        time   default null,    -- única
  p_weeks       int    default 8
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_class     public.classes;
  v_tz        text;
  v_had_sched int;
  v_wd        int;
  v_sch_id    uuid;
  v_starts    timestamptz;
  v_regen     int := 0;
  v_kept      int := 0;
  v_moved     boolean := false;
  v_occ       public.class_occurrences;
begin
  select * into v_class from public.classes where id = p_class_id;
  if not found then raise exception 'class_not_found' using errcode = 'P0002'; end if;
  if v_class.status <> 'active' then raise exception 'class_not_active'; end if;
  if not public.auth_has_role(v_class.studio_id, array['admin','reception']) then
    raise exception 'forbidden';
  end if;
  if p_capacity is null or p_capacity <= 0 then raise exception 'bad_capacity'; end if;
  if p_duration is null or p_duration <= 0 then raise exception 'bad_duration'; end if;

  select timezone into v_tz from public.studios where id = v_class.studio_id;
  select count(*) into v_had_sched from public.class_schedules where class_id = p_class_id;

  -- No permitir cambio de tipo (única ↔ recurrente) en edición.
  if p_is_recurring and v_had_sched = 0 then raise exception 'kind_change_not_supported'; end if;
  if (not p_is_recurring) and v_had_sched > 0 then raise exception 'kind_change_not_supported'; end if;

  -- ---- 1) metadatos de la clase ----
  update public.classes
     set name             = p_name,
         instructor_name  = nullif(p_instructor, ''),
         default_capacity = p_capacity,
         duration_min     = p_duration
   where id = p_class_id;

  -- ---- 2) ocurrencias futuras: cupo (nunca < reservado) + duración ----
  update public.class_occurrences
     set capacity = greatest(p_capacity, booked_count),
         ends_at  = starts_at + make_interval(mins => p_duration)
   where class_id = p_class_id and status = 'scheduled' and starts_at > now();

  if p_is_recurring then
    -- ---- 3a) recurrente: regenerar la regla ----
    if p_weekdays is null or array_length(p_weekdays, 1) is null
       or p_start_time is null or p_valid_from is null then
      raise exception 'bad_recurrence';
    end if;

    -- conservar las ocurrencias futuras CON reservas (no se tocan)
    select count(*) into v_kept from public.class_occurrences
      where class_id = p_class_id and status = 'scheduled'
        and starts_at > now() and booked_count > 0;

    -- borrar las futuras SIN reservas (se regeneran desde la nueva regla)
    delete from public.class_occurrences
      where class_id = p_class_id and status = 'scheduled'
        and starts_at > now() and booked_count = 0;

    -- reemplazar reglas (FK occurrences.schedule_id ON DELETE SET NULL → las
    -- ocurrencias con reservas quedan, sin regla asociada)
    delete from public.class_schedules where class_id = p_class_id;

    foreach v_wd in array p_weekdays loop
      if v_wd between 0 and 6 then
        insert into public.class_schedules
          (studio_id, class_id, weekday, start_time, capacity, valid_from, valid_to)
        values (v_class.studio_id, p_class_id, v_wd, p_start_time, p_capacity, p_valid_from, p_valid_to)
        returning id into v_sch_id;
        v_regen := v_regen + public.materialize_schedule(v_sch_id, p_weeks);
      end if;
    end loop;
  else
    -- ---- 3b) única: mover fecha/hora si no tiene reservas ----
    if p_date is null or p_time is null then raise exception 'bad_datetime'; end if;
    v_starts := ((p_date::text || ' ' || p_time::text)::timestamp) at time zone v_tz;
    if v_starts <= now() then raise exception 'datetime_in_past'; end if;

    select * into v_occ from public.class_occurrences
      where class_id = p_class_id and status = 'scheduled'
      order by starts_at desc limit 1;

    if found then
      if v_occ.booked_count > 0 then
        v_kept := 1;            -- tiene reservas → no se mueve la fecha/hora
      else
        update public.class_occurrences
           set starts_at = v_starts,
               ends_at   = v_starts + make_interval(mins => p_duration),
               capacity  = p_capacity
         where id = v_occ.id;
        v_moved := true;
      end if;
    else
      -- no quedaba ocurrencia futura → crear una nueva en la fecha indicada
      insert into public.class_occurrences
        (studio_id, class_id, schedule_id, starts_at, ends_at, capacity, booked_count, status)
      values (v_class.studio_id, p_class_id, null, v_starts,
              v_starts + make_interval(mins => p_duration), p_capacity, 0, 'scheduled')
      on conflict (class_id, starts_at) do nothing;
      v_moved := true;
    end if;
  end if;

  return jsonb_build_object(
    'regenerated', v_regen,
    'kept_with_reservations', v_kept,
    'moved', v_moved
  );
end $$;
grant execute on function public.update_class(uuid, text, text, int, int, boolean, int[], time, date, date, date, time, int) to authenticated;

-- Fin 009_edit_class_rpc.sql
