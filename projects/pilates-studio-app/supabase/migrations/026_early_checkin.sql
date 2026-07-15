-- =============================================================================
-- StudioFlow — 026_early_checkin.sql  (T4 recepción — check-in de llegada)
-- set_attendance: permite marcar PRESENTE desde 20 minutos antes del inicio
-- (la gente llega temprano al mostrador). "Faltó" sigue exigiendo clase empezada.
-- Solo cambia la validación temporal; autorización y efectos idénticos a 020.
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

  -- llegada anticipada: presente desde 20 min antes; faltó solo con clase empezada
  if p_status = 'checked_in' and v_starts > now() + interval '20 minutes' then
    raise exception 'class_not_started';
  end if;
  if p_status = 'no_show' and v_starts > now() then
    raise exception 'class_not_started';
  end if;

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

-- Fin 026_early_checkin.sql
