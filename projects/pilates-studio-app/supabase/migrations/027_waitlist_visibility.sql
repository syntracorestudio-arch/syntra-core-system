-- =============================================================================
-- StudioFlow — 027_waitlist_visibility.sql  (lista de espera visible para todos)
--   1) promote_from_waitlist (manual, admin/recepción) alineada con la promoción
--      automática de 023: marca promoted=true (devolución hasta el inicio) y
--      NOTIFICA al alumno — antes el camino manual lo dejaba sin aviso.
--   2) waitlist_counts: cuántos esperan por ocurrencia, para alumnos del estudio
--      (solo números; el alumno decide mejor si le conviene anotarse).
--   3) instructor_waitlist: la cola EN ORDEN (posición + nombre) de una clase
--      PROPIA del instructor — ya ve los nombres del roster; sin datos financieros.
-- Aditiva y no destructiva.
-- =============================================================================

-- ---------- 1) promoción manual alineada (promoted + notificación) ----------
create or replace function public.promote_from_waitlist(p_waitlist_id uuid)
returns public.class_reservations
language plpgsql security definer set search_path = public as $$
declare
  v_wl        public.waitlist;
  v_occ       public.class_occurrences;
  v_settings  public.studio_settings;
  v_actor_id  uuid;
  v_has_mship boolean;
  v_pass      public.member_passes;
  v_ledger_id uuid;
  v_consumed  boolean := false;
  v_res       public.class_reservations;
  v_cls_name  text;
  v_tz        text;
begin
  select * into v_wl from public.waitlist where id = p_waitlist_id;
  if not found or v_wl.status <> 'waiting' then raise exception 'waitlist_entry_not_found'; end if;

  if not public.auth_has_role(v_wl.studio_id, array['admin','reception']) then
    raise exception 'forbidden';
  end if;
  select id into v_actor_id from public.members
   where profile_id = auth.uid() and studio_id = v_wl.studio_id limit 1;

  select * into v_occ from public.class_occurrences where id = v_wl.occurrence_id for update;
  if v_occ.status <> 'scheduled' or v_occ.starts_at <= now() then raise exception 'class_closed'; end if;

  -- ya reservado → marcar la cola como promovida y avisar
  if exists (select 1 from public.class_reservations
             where occurrence_id = v_occ.id and member_id = v_wl.member_id and status = 'booked') then
    update public.waitlist set status = 'promoted' where id = v_wl.id;
    raise exception 'already_booked';
  end if;

  -- cupo atómico (sin sobrecupo)
  update public.class_occurrences set booked_count = booked_count + 1
   where id = v_occ.id and booked_count < capacity;
  if not found then raise exception 'no_capacity'; end if;

  select * into v_settings from public.studio_settings where studio_id = v_occ.studio_id;

  v_has_mship := exists (
    select 1 from public.memberships
     where member_id = v_wl.member_id and status = 'active'
       and now()::date between valid_from and valid_to);

  if not v_has_mship then
    select mp.* into v_pass
      from public.member_passes mp
     where mp.member_id = v_wl.member_id and mp.expires_at > now()
       and (select coalesce(sum(cl.delta), 0) from public.credit_ledger cl
            where cl.member_pass_id = mp.id) > 0
     order by mp.expires_at asc
     for update of mp
     limit 1;

    if found then
      insert into public.credit_ledger(studio_id, member_id, member_pass_id, delta, reason, created_by)
      values (v_occ.studio_id, v_wl.member_id, v_pass.id, -1, 'booking', v_actor_id)
      returning id into v_ledger_id;
      v_consumed := true;
    else
      if v_settings.reservation_policy = 'require_credit_or_membership' then
        update public.class_occurrences set booked_count = booked_count - 1 where id = v_occ.id;
        raise exception 'no_credit';
      elsif v_settings.reservation_policy = 'block_if_debt' then
        update public.class_occurrences set booked_count = booked_count - 1 where id = v_occ.id;
        raise exception 'blocked_debt';
      -- allow_with_warning / allow_grace_n: continuar (queda deuda)
      end if;
    end if;
  end if;

  -- promoted=true → misma regla que la promoción automática: devolución hasta el inicio
  insert into public.class_reservations(
      studio_id, occurrence_id, member_id, status, consumed_credit, credit_ledger_id, promoted)
  values (v_occ.studio_id, v_occ.id, v_wl.member_id, 'booked', v_consumed, v_ledger_id, true)
  returning * into v_res;

  update public.waitlist set status = 'promoted' where id = v_wl.id;

  -- aviso in-app al alumno (idéntico contrato que la promoción automática de 023)
  select c.name into v_cls_name from public.classes c where c.id = v_occ.class_id;
  select s.timezone into v_tz from public.studios s where s.id = v_occ.studio_id;
  insert into public.notifications(studio_id, member_id, type, title, body, link)
  values (
    v_occ.studio_id,
    v_wl.member_id,
    'waitlist',
    'Te conseguimos lugar',
    format('Se liberó un lugar en %s del %s y tu reserva quedó confirmada. Si no podés ir, cancelala sin cargo hasta el inicio.',
           coalesce(v_cls_name, 'la clase'),
           to_char(v_occ.starts_at at time zone coalesce(v_tz, 'America/Argentina/Buenos_Aires'), 'DD/MM HH24:MI')),
    '/app?day=' || to_char(v_occ.starts_at at time zone coalesce(v_tz, 'America/Argentina/Buenos_Aires'), 'YYYY-MM-DD')
  );

  return v_res;
end $$;
grant execute on function public.promote_from_waitlist(uuid) to authenticated;

-- ---------- 2) conteo de espera para alumnos del estudio ----------
create or replace function public.waitlist_counts(p_occurrence_ids uuid[])
returns table(occurrence_id uuid, waiting_count integer)
language sql security definer set search_path = public as $$
  select w.occurrence_id, count(*)::int
    from public.waitlist w
    join public.class_occurrences o on o.id = w.occurrence_id
   where w.occurrence_id = any(p_occurrence_ids)
     and w.status = 'waiting'
     and o.studio_id in (select public.auth_member_studios())
   group by w.occurrence_id
$$;
grant execute on function public.waitlist_counts(uuid[]) to authenticated;

-- ---------- 3) cola en orden para el instructor de la clase ----------
create or replace function public.instructor_waitlist(p_occurrence_id uuid)
returns table(queue_position integer, member_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_studio uuid;
  v_instr  uuid;
  v_me     uuid;
begin
  select o.studio_id, c.instructor_id into v_studio, v_instr
    from public.class_occurrences o
    join public.classes c on c.id = o.class_id
   where o.id = p_occurrence_id;
  if v_studio is null then raise exception 'not_found'; end if;

  select m.id into v_me from public.members m
   where m.studio_id = v_studio and m.profile_id = auth.uid()
     and m.role = 'instructor' and m.status = 'active'
   limit 1;
  if v_me is null or v_instr is null or v_instr <> v_me then
    raise exception 'forbidden';
  end if;

  return query
    select row_number() over (order by w.position asc)::int,
           coalesce(p.full_name, 'Alumno')
      from public.waitlist w
      join public.members mm on mm.id = w.member_id
      left join public.profiles p on p.id = mm.profile_id
     where w.occurrence_id = p_occurrence_id and w.status = 'waiting'
     order by w.position asc;
end $$;
grant execute on function public.instructor_waitlist(uuid) to authenticated;

-- Fin 027_waitlist_visibility.sql
