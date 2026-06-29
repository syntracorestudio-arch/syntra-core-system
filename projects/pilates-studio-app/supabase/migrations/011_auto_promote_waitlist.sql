-- =============================================================================
-- StudioFlow — 011_auto_promote_waitlist.sql  (Fase 1.1-A)
-- Promoción AUTOMÁTICA de lista de espera: al liberarse un cupo (cancelación de
-- una reserva), se promueve al primer alumno ELEGIBLE de la cola.
--   · try_promote_next_waitlist(occ) — helper interno (SECURITY DEFINER): recorre
--     la cola por posición y promueve al primero que pueda reservar (membresía o
--     pack con saldo, o política que lo permita). Consume crédito como una reserva.
--   · cancel_reservation — se re-crea para invocar el helper tras liberar el cupo.
-- Respeta studio_settings.waitlist_enabled. Manual (promote_from_waitlist, 010) sigue.
-- =============================================================================

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
begin
  select * into v_occ from public.class_occurrences where id = p_occurrence_id for update;
  if not found or v_occ.status <> 'scheduled' or v_occ.starts_at <= now() then return null; end if;

  select * into v_settings from public.studio_settings where studio_id = v_occ.studio_id;
  if not coalesce(v_settings.waitlist_enabled, true) then return null; end if;
  if v_occ.booked_count >= v_occ.capacity then return null; end if;

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
        -- sin crédito: elegibilidad según política del estudio
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
        studio_id, occurrence_id, member_id, status, consumed_credit, credit_ledger_id)
    values (v_occ.studio_id, v_occ.id, v_wl.member_id, 'booked', v_consumed, v_ledger_id);

    update public.waitlist set status = 'promoted' where id = v_wl.id;
    return v_wl.member_id;  -- promovido
  end loop;

  return null;  -- nadie elegible
end $$;

-- ---------------- cancel_reservation (re-creada: + promoción automática) ----------------
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

  v_within := now() <= v_occ.starts_at - make_interval(hours => v_settings.cancellation_window_hours);

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

  -- (Fase 1.1) promoción automática: el cupo liberado pasa al primero elegible de la cola.
  perform public.try_promote_next_waitlist(v_occ.id);

  return v_res;
end $$;

-- Fin 011_auto_promote_waitlist.sql
