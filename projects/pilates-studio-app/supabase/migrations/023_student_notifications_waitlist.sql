-- =============================================================================
-- StudioFlow — 023_student_notifications_waitlist.sql  (Tanda 2 — experiencia alumno)
-- 1) notifications.member_id: avisos dirigidos a UN alumno (waitlist, etc.) con
--    RLS propia (el alumno ve/marca solo los suyos; los del panel siguen siendo
--    los de member_id null para admin/recepción).
-- 2) class_reservations.promoted: reservas creadas por promoción automática de
--    lista de espera → cancelables CON devolución hasta el inicio de la clase
--    (el alumno no eligió el momento de la promoción).
-- 3) try_promote_next_waitlist: corte de promoción = ventana de cancelación
--    (dentro de la ventana no se promueve solo; el admin puede hacerlo manual),
--    marca promoted=true y notifica al alumno promovido.
-- 4) cancel_reservation: refund de reservas promoted hasta el inicio.
-- 5) leave_waitlist: el alumno se baja de la cola (status='cancelled').
-- =============================================================================

-- ---------- 1) notifications dirigidas al alumno ----------
alter table public.notifications
  add column if not exists member_id uuid references public.members(id) on delete cascade;

create index if not exists notifications_member_idx
  on public.notifications (member_id, created_at desc)
  where member_id is not null;

-- tipo nuevo para avisos de lista de espera
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('payment','debt','expiry','system','waitlist'));

-- El panel (admin/recepción) solo ve los avisos del estudio SIN destinatario;
-- los dirigidos a un alumno son de ese alumno.
drop policy if exists notifications_select_admin on public.notifications;
create policy notifications_select_admin on public.notifications for select
  using (member_id is null and public.auth_has_role(studio_id, array['admin','reception']));
drop policy if exists notifications_update_admin on public.notifications;
create policy notifications_update_admin on public.notifications for update
  using      (member_id is null and public.auth_has_role(studio_id, array['admin','reception']))
  with check (member_id is null and public.auth_has_role(studio_id, array['admin','reception']));

create policy notifications_select_own on public.notifications for select
  using (member_id in (select public.auth_my_member_ids()));
create policy notifications_update_own on public.notifications for update
  using      (member_id in (select public.auth_my_member_ids()))
  with check (member_id in (select public.auth_my_member_ids()));

-- ---------- 2) flag de reserva promovida ----------
alter table public.class_reservations
  add column if not exists promoted boolean not null default false;

-- ---------- 3) try_promote_next_waitlist (corte + flag + notificación) ----------
create or replace function public.try_promote_next_waitlist(p_occurrence_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_occ       public.class_occurrences;
  v_settings  public.studio_settings;
  v_wl        public.waitlist;
  v_has_mship boolean;
  v_pass      public.member_passes;
  v_ledger_id uuid;
  v_consumed  boolean;
  v_cls_name  text;
  v_tz        text;
begin
  select * into v_occ from public.class_occurrences where id = p_occurrence_id for update;
  if not found or v_occ.status <> 'scheduled' or v_occ.starts_at <= now() then return null; end if;

  select * into v_settings from public.studio_settings where studio_id = v_occ.studio_id;
  if not coalesce(v_settings.waitlist_enabled, true) then return null; end if;
  if v_occ.booked_count >= v_occ.capacity then return null; end if;

  -- Corte de promoción: dentro de la ventana de cancelación no se promueve solo
  -- (consumiría el crédito de alguien que quizás ya no puede venir; queda manual).
  if now() > v_occ.starts_at - make_interval(hours => coalesce(v_settings.cancellation_window_hours, 24)) then
    return null;
  end if;

  for v_wl in
    select * from public.waitlist
     where occurrence_id = p_occurrence_id and status = 'waiting'
     order by position asc
  loop
    -- defensivo: si ya está reservado, marcar promovido y seguir
    if exists (select 1 from public.class_reservations
               where occurrence_id = v_occ.id and member_id = v_wl.member_id and status = 'booked') then
      update public.waitlist set status = 'promoted' where id = v_wl.id;
      continue;
    end if;

    v_has_mship := exists (
      select 1 from public.memberships
       where member_id = v_wl.member_id and status = 'active'
         and now()::date between valid_from and valid_to);
    v_consumed := false;
    v_ledger_id := null;
    v_pass := null;

    if not v_has_mship then
      select mp.* into v_pass
        from public.member_passes mp
       where mp.member_id = v_wl.member_id and mp.expires_at > now()
         and (select coalesce(sum(cl.delta), 0) from public.credit_ledger cl
              where cl.member_pass_id = mp.id) > 0
       order by mp.expires_at asc
       for update of mp
       limit 1;
      if not found then
        if v_settings.reservation_policy in ('require_credit_or_membership', 'block_if_debt') then
          continue;  -- no elegible → probar el siguiente de la cola
        end if;
        -- allow_with_warning / allow_grace_n: se promueve sin consumir (queda deuda)
      end if;
    end if;

    -- ocupar cupo atómico (sin sobrecupo)
    update public.class_occurrences set booked_count = booked_count + 1
     where id = v_occ.id and booked_count < capacity;
    if not found then return null; end if;  -- se llenó por carrera

    if v_pass.id is not null then
      insert into public.credit_ledger(studio_id, member_id, member_pass_id, delta, reason)
      values (v_occ.studio_id, v_wl.member_id, v_pass.id, -1, 'booking')
      returning id into v_ledger_id;
      v_consumed := true;
    end if;

    insert into public.class_reservations(
        studio_id, occurrence_id, member_id, status, consumed_credit, credit_ledger_id, promoted)
    values (v_occ.studio_id, v_occ.id, v_wl.member_id, 'booked', v_consumed, v_ledger_id, true);

    update public.waitlist set status = 'promoted' where id = v_wl.id;

    -- aviso in-app al alumno promovido
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

    return v_wl.member_id;  -- promovido
  end loop;

  return null;  -- nadie elegible
end $$;

-- ---------- 4) cancel_reservation (refund de promovidas hasta el inicio) ----------
create or replace function public.cancel_reservation(p_reservation_id uuid)
returns public.class_reservations
language plpgsql security definer set search_path = public as $$
declare
  v_res        public.class_reservations;
  v_occ        public.class_occurrences;
  v_settings   public.studio_settings;
  v_within     boolean;
  v_pass_id    uuid;
  v_pack_valid boolean := false;
begin
  select * into v_res from public.class_reservations where id = p_reservation_id;
  if not found or v_res.status <> 'booked' then raise exception 'not_cancellable'; end if;

  if not (
       v_res.member_id in (select id from public.members where profile_id = auth.uid())
       or public.auth_has_role(v_res.studio_id, array['admin','reception'])
  ) then raise exception 'forbidden'; end if;

  select * into v_occ from public.class_occurrences where id = v_res.occurrence_id for update;
  select * into v_settings from public.studio_settings where studio_id = v_res.studio_id;

  -- Reserva promovida desde la lista de espera: devolución hasta el inicio de la
  -- clase (el alumno no eligió cuándo lo promovieron). El resto, ventana normal.
  if v_res.promoted then
    v_within := now() < v_occ.starts_at;
  else
    v_within := now() <= v_occ.starts_at - make_interval(hours => v_settings.cancellation_window_hours);
  end if;

  update public.class_occurrences
     set booked_count = greatest(booked_count - 1, 0)
   where id = v_occ.id;

  if v_res.consumed_credit and v_res.credit_ledger_id is not null then
    select cl.member_pass_id into v_pass_id from public.credit_ledger cl where cl.id = v_res.credit_ledger_id;
    select (mp.expires_at > now()) into v_pack_valid from public.member_passes mp where mp.id = v_pass_id;
  end if;

  if v_res.consumed_credit
     and (v_within or v_settings.refund_on_late_cancel)
     and coalesce(v_pack_valid, false) then
    insert into public.credit_ledger(
        studio_id, member_id, member_pass_id, delta, reason, reservation_id)
    values (v_res.studio_id, v_res.member_id, v_pass_id, +1, 'refund', v_res.id);
  end if;

  update public.class_reservations
     set status = 'cancelled', cancelled_at = now()
   where id = v_res.id
  returning * into v_res;

  perform public.try_promote_next_waitlist(v_occ.id);

  return v_res;
end $$;

-- ---------- 5) leave_waitlist (el alumno se baja de la cola) ----------
create or replace function public.leave_waitlist(p_occurrence_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_wl public.waitlist;
begin
  select w.* into v_wl
    from public.waitlist w
   where w.occurrence_id = p_occurrence_id
     and w.status = 'waiting'
     and w.member_id in (select id from public.members where profile_id = auth.uid())
   order by w.created_at asc
   limit 1
   for update;
  if not found then raise exception 'not_waiting'; end if;

  update public.waitlist set status = 'cancelled' where id = v_wl.id;
end $$;

grant execute on function public.leave_waitlist(uuid) to authenticated;

-- Fin 023_student_notifications_waitlist.sql
