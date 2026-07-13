-- =============================================================================
-- StudioFlow — 021_member_notes.sql  (notas del alumno + roster v3)
-- 1) members.notes: nota operativa del alumno ("hernia lumbar, no springs
--    fuertes", acuerdos, observaciones). La escribe admin/recepción (política
--    members_write_admin ya existente); la ve el staff. NO es historia clínica.
-- 2) instructor_class_roster v3: suma la nota y el flag "primera clase" (sin
--    reservas anteriores a esta ocurrencia) para que el instructor reciba
--    distinto a quien debuta. Cambio de retorno → DROP + CREATE.
-- Aditiva y no destructiva.
-- =============================================================================

alter table public.members
  add column if not exists notes text;

drop function if exists public.instructor_class_roster(uuid);

create function public.instructor_class_roster(p_occurrence_id uuid)
returns table(
  reservation_id uuid,
  member_name text,
  attendance_status text,
  member_note text,
  is_first_time boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_studio     uuid;
  v_instructor uuid;
  v_starts     timestamptz;
begin
  select o.studio_id, c.instructor_id, o.starts_at
    into v_studio, v_instructor, v_starts
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
           a.status,
           m.notes,
           not exists (
             select 1
             from public.class_reservations r2
             join public.class_occurrences o2 on o2.id = r2.occurrence_id
             where r2.member_id = r.member_id
               and r2.status in ('booked','attended','no_show')
               and o2.starts_at < v_starts
           ) as is_first_time
    from public.class_reservations r
    join public.members  m on m.id = r.member_id
    join public.profiles p on p.id = m.profile_id
    left join public.attendance a on a.reservation_id = r.id
    where r.occurrence_id = p_occurrence_id
      and r.status in ('booked','attended','no_show')
    order by p.full_name;
end $$;
grant execute on function public.instructor_class_roster(uuid) to authenticated;

-- Fin 021_member_notes.sql
