-- =============================================================================
-- StudioFlow — 014_instructor_link.sql  (Fase 1.1-E)
-- Vincula una clase a un instructor CON LOGIN (member con rol 'instructor').
-- `classes.instructor_id` existía como uuid suelto y nunca se poblaba (solo se
-- usaba `instructor_name` como texto informativo). Ahora es FK real a members:
--   · ON DELETE SET NULL → si se elimina el member instructor, la clase queda
--     sin instructor asignado (no rompe la clase).
--   · nullable → clases sin instructor asignado siguen siendo válidas.
-- Aislamiento por estudio: la asignación se hace server-side ofreciendo SOLO
-- members del propio estudio con rol 'instructor' (RLS impide cross-tenant).
-- Idempotente: no vuelve a crear la constraint/índice si ya existen.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'classes_instructor_fk'
  ) then
    alter table public.classes
      add constraint classes_instructor_fk
      foreign key (instructor_id) references public.members(id) on delete set null;
  end if;
end $$;

create index if not exists classes_instructor_idx
  on public.classes (studio_id, instructor_id);

-- ---------------- instructor_class_roster ----------------
-- El instructor puede LEER reservas y gestionar attendance (RLS 002), pero NO tiene
-- SELECT sobre members/profiles (eso es admin/reception). Para no exponer los datos de
-- todos los alumnos del estudio, este RPC SECURITY DEFINER devuelve SOLO nombre +
-- presencia de los anotados de UNA ocurrencia, autorizando al instructor asignado a esa
-- clase (o admin/reception del estudio). Fuente de nombres controlada y mínima.
create or replace function public.instructor_class_roster(p_occurrence_id uuid)
returns table(reservation_id uuid, member_name text, checked_in boolean)
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

  -- autorización: admin/reception del estudio, o el instructor asignado a la clase
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
           coalesce(a.status = 'checked_in', false)
    from public.class_reservations r
    join public.members  m on m.id = r.member_id
    join public.profiles p on p.id = m.profile_id
    left join public.attendance a on a.reservation_id = r.id
    where r.occurrence_id = p_occurrence_id and r.status = 'booked'
    order by p.full_name;
end $$;
grant execute on function public.instructor_class_roster(uuid) to authenticated;

-- Fin 014_instructor_link.sql
