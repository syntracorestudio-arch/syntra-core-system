-- =============================================================================
-- StudioFlow — 025_instructor_notes_issue_pay.sql  (Tanda 2 — vista instructor)
--   1) instructor_notes — nota PRIVADA del instructor por alumno (campo propio,
--      separada de members.notes que escribe el admin). Solo la ve/edita él.
--   2) instructor_class_roster v4 — suma member_id + la nota del instructor que
--      llama (para admin/recepción viene null: la nota es privada).
--   3) instructor_report_issue — el instructor avisa un imprevisto sobre SU clase
--      futura → notificación in-app al panel (admin/recepción).
--   4) studio_settings.show_instructor_pay (default OFF, decisión owner) +
--      instructor_month_pay — estimado del mes SOLO si el estudio lo habilita.
-- Aditiva y no destructiva.
-- =============================================================================

-- ---------- 1) instructor_notes ----------
create table if not exists public.instructor_notes (
  id                   uuid primary key default gen_random_uuid(),
  studio_id            uuid not null references public.studios(id) on delete cascade,
  instructor_member_id uuid not null references public.members(id) on delete cascade,
  member_id            uuid not null references public.members(id) on delete cascade,
  note                 text not null default '',
  updated_at           timestamptz not null default now(),
  unique (instructor_member_id, member_id)
);

alter table public.instructor_notes enable row level security;
alter table public.instructor_notes force row level security;

-- privada: solo el instructor dueño de la nota la LEE. La escritura va por RPC
-- SECURITY DEFINER (save_instructor_note): validar "el alumno es de mi estudio"
-- en una policy exigiría leer members ajenos, que la RLS del instructor no permite.
create policy instructor_notes_select_own on public.instructor_notes for select
  using (instructor_member_id in (select public.auth_my_member_ids()));

create or replace function public.save_instructor_note(
  p_member_id uuid,
  p_note      text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_studio uuid;
  v_me     uuid;
  v_note   text := left(coalesce(btrim(p_note), ''), 500);
begin
  select m.studio_id into v_studio from public.members m where m.id = p_member_id;
  if not found then raise exception 'member_not_found'; end if;

  select m.id into v_me from public.members m
   where m.profile_id = auth.uid() and m.studio_id = v_studio
     and m.role = 'instructor' and m.status = 'active'
   limit 1;
  if v_me is null then raise exception 'forbidden'; end if;

  if v_note = '' then
    delete from public.instructor_notes
     where instructor_member_id = v_me and member_id = p_member_id;
  else
    insert into public.instructor_notes (studio_id, instructor_member_id, member_id, note, updated_at)
    values (v_studio, v_me, p_member_id, v_note, now())
    on conflict (instructor_member_id, member_id)
      do update set note = excluded.note, updated_at = excluded.updated_at;
  end if;
end $$;

grant execute on function public.save_instructor_note(uuid, text) to authenticated;

-- ---------- 2) instructor_class_roster v4 (member_id + nota del instructor) ----------
drop function if exists public.instructor_class_roster(uuid);

create function public.instructor_class_roster(p_occurrence_id uuid)
returns table(
  reservation_id uuid,
  member_id uuid,
  member_name text,
  attendance_status text,
  member_note text,
  is_first_time boolean,
  instructor_note text
)
language plpgsql security definer set search_path = public as $$
declare
  v_studio     uuid;
  v_instructor uuid;
  v_me         uuid;  -- member id del instructor que llama (null si es admin/recepción)
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
             where n.member_id = r.member_id and n.instructor_member_id = v_me)
      from public.class_reservations r
      join public.members m on m.id = r.member_id
      left join public.profiles p on p.id = m.profile_id
      left join public.attendance a on a.reservation_id = r.id
     where r.occurrence_id = p_occurrence_id
       and r.status in ('booked','attended','no_show')
     order by coalesce(p.full_name, 'Alumno');
end $$;

grant execute on function public.instructor_class_roster(uuid) to authenticated;

-- ---------- 3) instructor_report_issue ----------
create or replace function public.instructor_report_issue(
  p_occurrence_id uuid,
  p_message       text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_occ    public.class_occurrences;
  v_me     uuid;
  v_name   text;
  v_cls    text;
  v_tz     text;
begin
  if coalesce(btrim(p_message), '') = '' then raise exception 'empty_message'; end if;

  select * into v_occ from public.class_occurrences where id = p_occurrence_id;
  if not found or v_occ.status <> 'scheduled' or v_occ.starts_at <= now() then
    raise exception 'not_reportable';
  end if;

  select m.id, coalesce(p.full_name, 'Instructor') into v_me, v_name
    from public.members m
    left join public.profiles p on p.id = m.profile_id
   where m.profile_id = auth.uid() and m.studio_id = v_occ.studio_id
     and m.role = 'instructor' and m.status = 'active'
   limit 1;

  if v_me is null or not exists (
    select 1 from public.classes c
    where c.id = v_occ.class_id and c.instructor_id = v_me
  ) then raise exception 'forbidden'; end if;

  select c.name into v_cls from public.classes c where c.id = v_occ.class_id;
  select s.timezone into v_tz from public.studios s where s.id = v_occ.studio_id;

  insert into public.notifications(studio_id, type, title, body, link)
  values (
    v_occ.studio_id,
    'system',
    format('Imprevisto de %s', v_name),
    format('%s avisó sobre %s del %s: %s',
           v_name,
           coalesce(v_cls, 'su clase'),
           to_char(v_occ.starts_at at time zone coalesce(v_tz, 'America/Argentina/Buenos_Aires'), 'DD/MM HH24:MI'),
           left(btrim(p_message), 300)),
    '/admin/clases'
  );
end $$;

grant execute on function public.instructor_report_issue(uuid, text) to authenticated;

-- ---------- 4) pago estimado opt-in ----------
alter table public.studio_settings
  add column if not exists show_instructor_pay boolean not null default false;

create or replace function public.instructor_month_pay()
returns table(mode text, amount numeric, classes_count integer, estimated numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_me     uuid;
  v_studio uuid;
  v_rate   public.staff_rates;
  v_count  integer;
begin
  select m.id, m.studio_id into v_me, v_studio
    from public.members m
   where m.profile_id = auth.uid() and m.role = 'instructor' and m.status = 'active'
   limit 1;
  if v_me is null then return; end if;

  -- decisión del owner: visible solo si el estudio lo habilita
  if not exists (select 1 from public.studio_settings s
                 where s.studio_id = v_studio and s.show_instructor_pay) then
    return;
  end if;

  select * into v_rate from public.staff_rates r
   where r.member_id = v_me and r.valid_to is null
   limit 1;
  if not found then return; end if;

  select count(*)::integer into v_count
    from public.class_occurrences o
    join public.classes c on c.id = o.class_id
   where c.instructor_id = v_me
     and o.status = 'scheduled'
     and o.starts_at < now()
     and o.starts_at >= date_trunc('month', now());

  return query select
    v_rate.mode,
    v_rate.amount,
    v_count,
    case when v_rate.mode = 'per_class' then v_rate.amount * v_count else v_rate.amount end;
end $$;

grant execute on function public.instructor_month_pay() to authenticated;

-- Fin 025_instructor_notes_issue_pay.sql
