-- =============================================================================
-- StudioFlow — 031_birthdays.sql  (cumpleaños: dato + saludo automático + visibilidad)
--   1) profiles.birthday: la cargan TODOS los roles desde Mi cuenta (compañerismo).
--   2) notifications acepta type='birthday'.
--   3) instructor_class_roster v4: + is_birthday (el instructor ve el 🎂, no la fecha).
--   4) send_birthday_greetings(): saludo del día por estudio (tz propia), idempotente
--      → insert en notifications dispara la burbuja push por el webhook existente.
--   5) pg_cron: corre todos los días a las 11:00 UTC (08:00 AR).
-- Aditiva y no destructiva.
-- =============================================================================

-- ---------- 1) fecha de cumpleaños ----------
alter table public.profiles
  add column if not exists birthday date
  check (birthday is null or (birthday > '1920-01-01' and birthday < now()::date));

-- ---------- 2) tipo de notificación ----------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('payment','debt','expiry','system','waitlist','birthday'));

-- ---------- 3) roster del instructor con 🎂 ----------
drop function if exists public.instructor_class_roster(uuid);

create function public.instructor_class_roster(p_occurrence_id uuid)
returns table(
  reservation_id uuid,
  member_id uuid,
  member_name text,
  attendance_status text,
  member_note text,
  is_first_time boolean,
  instructor_note text,
  is_birthday boolean
)
language plpgsql security definer set search_path = public as $$
declare
  v_studio     uuid;
  v_instructor uuid;
  v_me         uuid;
  v_tz         text;
  v_today      date;
begin
  select o.studio_id, c.instructor_id
    into v_studio, v_instructor
  from public.class_occurrences o
  join public.classes c on c.id = o.class_id
  where o.id = p_occurrence_id;
  if not found then raise exception 'occurrence_not_found' using errcode = 'P0002'; end if;

  select m.id into v_me from public.members m
   where m.profile_id = auth.uid() and m.studio_id = v_studio
     and m.role = 'instructor' and m.status = 'active'
   limit 1;

  if not (
    public.auth_has_role(v_studio, array['admin','reception'])
    or (v_instructor is not null and v_instructor = v_me)
  ) then
    raise exception 'forbidden';
  end if;

  select s.timezone into v_tz from public.studios s where s.id = v_studio;
  v_today := (now() at time zone coalesce(v_tz, 'America/Argentina/Buenos_Aires'))::date;

  return query
    select r.id,
           r.member_id,
           coalesce(p.full_name, 'Alumno'),
           a.status,
           m.notes,
           not exists (
             select 1 from public.class_reservations r2
             join public.class_occurrences o2 on o2.id = r2.occurrence_id
             where r2.member_id = r.member_id
               and r2.status in ('booked','attended')
               and o2.starts_at < (select o3.starts_at from public.class_occurrences o3
                                   where o3.id = p_occurrence_id)
           ),
           (select n.note from public.instructor_notes n
             where n.member_id = r.member_id and n.instructor_member_id = v_me),
           (p.birthday is not null
             and extract(month from p.birthday) = extract(month from v_today)
             and extract(day   from p.birthday) = extract(day   from v_today))
      from public.class_reservations r
      join public.members m on m.id = r.member_id
      left join public.profiles p on p.id = m.profile_id
      left join public.attendance a on a.reservation_id = r.id
     where r.occurrence_id = p_occurrence_id
       and r.status in ('booked','attended','no_show')
     order by coalesce(p.full_name, 'Alumno');
end $$;

grant execute on function public.instructor_class_roster(uuid) to authenticated;

-- ---------- 4) saludo automático (idempotente, tz por estudio) ----------
create or replace function public.send_birthday_greetings()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_sent integer := 0;
  rec record;
begin
  for rec in
    select m.id as member_id, m.studio_id,
           split_part(trim(coalesce(p.full_name, '')), ' ', 1) as first_name,
           s.name as studio_name
      from public.members m
      join public.profiles p on p.id = m.profile_id
      join public.studios  s on s.id = m.studio_id
     where m.status = 'active'
       and s.status <> 'suspended'
       and p.birthday is not null
       -- cumple HOY en la zona horaria de SU estudio
       and extract(month from p.birthday) = extract(month from (now() at time zone coalesce(s.timezone, 'America/Argentina/Buenos_Aires'))::date)
       and extract(day   from p.birthday) = extract(day   from (now() at time zone coalesce(s.timezone, 'America/Argentina/Buenos_Aires'))::date)
       -- idempotencia: un saludo por persona por año (aunque el cron corra dos veces)
       and not exists (
         select 1 from public.notifications n
          where n.member_id = m.id and n.type = 'birthday'
            and n.created_at > now() - interval '300 days'
       )
  loop
    insert into public.notifications(studio_id, member_id, type, title, body, link)
    values (
      rec.studio_id,
      rec.member_id,
      'birthday',
      format('🎂 ¡Feliz cumpleaños%s!', case when rec.first_name <> '' then ', ' || rec.first_name else '' end),
      format('Todo el equipo de %s te desea un gran año 🎉 Que lo arranques con energía — te esperamos en tu próxima clase para celebrarlo entrenando 💪✨', rec.studio_name),
      '/app'
    );
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end $$;

-- ---------- 5) cron diario (11:00 UTC = 08:00 AR) ----------
create extension if not exists pg_cron;
select cron.schedule('birthday-greetings', '0 11 * * *', $$select public.send_birthday_greetings()$$);

-- Fin 031_birthdays.sql
