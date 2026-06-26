-- =============================================================================
-- StudioFlow — 010_promote_waitlist_rpc.sql  (Fase 1I)
-- RPC promote_from_waitlist: el admin/recepción promueve manualmente a un alumno
-- de la lista de espera a una reserva confirmada (MVP: promoción manual).
-- Replica la lógica de crédito/cupo de reserve_class, pero para un member arbitrario
-- y autorizada por rol admin/reception (no por auth.uid() = el alumno).
-- Consume crédito/membresía como una reserva normal; respeta cupo atómico y política.
-- SECURITY DEFINER.
-- =============================================================================

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

  insert into public.class_reservations(
      studio_id, occurrence_id, member_id, status, consumed_credit, credit_ledger_id)
  values (v_occ.studio_id, v_occ.id, v_wl.member_id, 'booked', v_consumed, v_ledger_id)
  returning * into v_res;

  update public.waitlist set status = 'promoted' where id = v_wl.id;
  return v_res;
end $$;
grant execute on function public.promote_from_waitlist(uuid) to authenticated;

-- Fin 010_promote_waitlist_rpc.sql
