-- =============================================================================
-- StudioFlow — 020_set_attendance.sql  (cierre del circuito de asistencia)
-- RPC set_attendance: marca presente / ausente / limpia la marca de una reserva,
-- escribiendo ATÓMICAMENTE la tabla attendance (quién/cuándo) y el estado de la
-- reserva (attended / no_show / booked) — la fuente que consumen el historial del
-- alumno y la métrica de retención de Reportes.
--   · Autorización: admin/recepción del estudio, o el INSTRUCTOR de esa clase
--     (que por RLS no puede tocar class_reservations → por eso SECURITY DEFINER).
--   · Solo reservas 'booked'/'attended'/'no_show' (nunca canceladas) y solo si la
--     clase YA EMPEZÓ (no se marca asistencia a futuro).
--   · Sin efectos de crédito: el crédito se consumió al reservar; el no-show no
--     devuelve (business-rules §10 con refund_on_late_cancel=false default).
-- Aditiva y no destructiva.
-- =============================================================================

create or replace function public.set_attendance(
  p_reservation_id uuid,
  p_status         text  -- 'checked_in' | 'no_show' | 'clear'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_res    public.class_reservations;
  v_starts timestamptz;
  v_instr  uuid;
  v_me     uuid;
begin
  if p_status not in ('checked_in','no_show','clear') then
    raise exception 'invalid_status';
  end if;

  select r.* into v_res from public.class_reservations r
   where r.id = p_reservation_id for update;
  if not found then raise exception 'reservation_not_found'; end if;
  if v_res.status = 'cancelled' then raise exception 'reservation_cancelled'; end if;

  select o.starts_at, c.instructor_id into v_starts, v_instr
    from public.class_occurrences o
    join public.classes c on c.id = o.class_id
   where o.id = v_res.occurrence_id;

  -- autorización: staff del estudio o instructor de ESTA clase
  if not public.auth_has_role(v_res.studio_id, array['admin','reception']) then
    select m.id into v_me from public.members m
     where m.studio_id = v_res.studio_id and m.profile_id = auth.uid()
       and m.role = 'instructor' and m.status = 'active'
     limit 1;
    if v_me is null or v_instr is null or v_instr <> v_me then
      raise exception 'not_authorized';
    end if;
  end if;

  if v_starts > now() then raise exception 'class_not_started'; end if;

  if p_status = 'clear' then
    delete from public.attendance where reservation_id = v_res.id;
    update public.class_reservations set status = 'booked' where id = v_res.id;
  else
    insert into public.attendance (studio_id, reservation_id, status, checked_in_at)
    values (v_res.studio_id, v_res.id, p_status,
            case when p_status = 'checked_in' then now() else null end)
    on conflict (reservation_id) do update
      set status = excluded.status, checked_in_at = excluded.checked_in_at;
    update public.class_reservations
       set status = case when p_status = 'checked_in' then 'attended' else 'no_show' end
     where id = v_res.id;
  end if;
end $$;

grant execute on function public.set_attendance(uuid, text) to authenticated;

-- ---------------- instructor_class_roster v2 ----------------
-- Cambios: (1) devuelve el ESTADO de asistencia ('checked_in'|'no_show'|null) en vez
-- de un booleano; (2) incluye reservas ya marcadas (attended/no_show) — antes, al
-- marcar, el alumno desaparecía del roster (filtraba solo 'booked').
-- El cambio de tipo de retorno exige DROP + CREATE.
drop function if exists public.instructor_class_roster(uuid);

create function public.instructor_class_roster(p_occurrence_id uuid)
returns table(reservation_id uuid, member_name text, attendance_status text)
language plpgsql security definer set search_path = public as $$
declare
  v_studio     uuid;
  v_instructor uuid;
begin
  select o.studio_id, c.instructor_id
    into v_studio, v_instructor
  from public.class_occurrences o
  join public.classes c on c.id = o.class_id
  where o.id = p_occurrence_id;
  if not found then raise exception 'occurrence_not_found' using errcode = 'P0002'; end if;

  if not (
    public.auth_has_role(v_studio, array['admin','reception'])
    or (v_instructor is not null and v_instructor in (
          select id from public.members
          where profile_id = auth.uid() and studio_id = v_studio
            and role = 'instructor' and status = 'active'))
  ) then
    raise exception 'forbidden';
  end if;

  return query
    select r.id,
           coalesce(p.full_name, 'Alumno'),
           a.status
    from public.class_reservations r
    join public.members  m on m.id = r.member_id
    join public.profiles p on p.id = m.profile_id
    left join public.attendance a on a.reservation_id = r.id
    where r.occurrence_id = p_occurrence_id
      and r.status in ('booked','attended','no_show')
    order by p.full_name;
end $$;
grant execute on function public.instructor_class_roster(uuid) to authenticated;

-- Fin 020_set_attendance.sql
