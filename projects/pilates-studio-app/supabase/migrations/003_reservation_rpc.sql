-- =============================================================================
-- StudioFlow — 003_reservation_rpc.sql  (Fase 1C-0)
-- RPC de reserva atómica, waitlist y cancelación. NO aplicar todavía.
-- Fuente: docs/technical/rpc-reservation-draft.md + business-rules.md
-- Decisión Fase 1C-0 (refund por pack vencido):
--   * Cancela dentro de ventana → refund SOLO si el pack original sigue VIGENTE.
--   * Si el pack venció → NO hay refund automático; queda como ajuste manual del admin.
-- Funciones SECURITY DEFINER (owner postgres → bypass RLS controlado), search_path fijo.
-- =============================================================================

-- =========================== reserve_class ===========================
create or replace function public.reserve_class(p_occurrence_id uuid)
returns public.class_reservations
language plpgsql security definer set search_path = public as $$
declare
  v_occ       public.class_occurrences;
  v_member    public.members;
  v_settings  public.studio_settings;
  v_has_mship boolean;
  v_pass      public.member_passes;
  v_ledger_id uuid;
  v_consumed  boolean := false;
  v_res       public.class_reservations;
begin
  -- 1. ocurrencia
  select * into v_occ from public.class_occurrences where id = p_occurrence_id;
  if not found then raise exception 'occurrence_not_found' using errcode = 'P0002'; end if;

  -- 2. member activo del MISMO estudio (anti cross-tenant)
  select * into v_member from public.members
   where profile_id = auth.uid() and studio_id = v_occ.studio_id and status = 'active';
  if not found then raise exception 'not_a_member'; end if;

  -- 3. ocurrencia abierta y futura
  if v_occ.status <> 'scheduled' or v_occ.starts_at <= now() then
    raise exception 'class_closed';
  end if;

  -- 4. no duplicado (reserva activa)
  if exists (select 1 from public.class_reservations
             where occurrence_id = v_occ.id and member_id = v_member.id and status = 'booked') then
    raise exception 'already_booked';
  end if;

  select * into v_settings from public.studio_settings where studio_id = v_occ.studio_id;

  -- 5. CUPO atómico: check + update en una sentencia. Sin sobrecupo.
  update public.class_occurrences
     set booked_count = booked_count + 1
   where id = v_occ.id and booked_count < capacity;
  if not found then
    raise exception 'no_capacity';   -- el front ofrece join_waitlist()
  end if;

  -- 6. ¿membresía vigente? (cubre sin consumir crédito)
  v_has_mship := exists (
    select 1 from public.memberships
     where member_id = v_member.id and status = 'active'
       and now()::date between valid_from and valid_to);

  if not v_has_mship then
    -- buscar pack con saldo, no vencido, y BLOQUEARLO (anti doble gasto)
    select mp.* into v_pass
      from public.member_passes mp
     where mp.member_id = v_member.id and mp.expires_at > now()
       and (select coalesce(sum(cl.delta),0) from public.credit_ledger cl
            where cl.member_pass_id = mp.id) > 0
     order by mp.expires_at asc
     for update of mp
     limit 1;

    if found then
      insert into public.credit_ledger(studio_id, member_id, member_pass_id, delta, reason, created_by)
      values (v_occ.studio_id, v_member.id, v_pass.id, -1, 'booking', v_member.id)
      returning id into v_ledger_id;
      v_consumed := true;
    else
      -- sin crédito ni membresía → aplicar política del estudio
      if v_settings.reservation_policy = 'require_credit_or_membership' then
        update public.class_occurrences set booked_count = booked_count - 1 where id = v_occ.id;
        raise exception 'no_credit';
      elsif v_settings.reservation_policy = 'block_if_debt' then
        update public.class_occurrences set booked_count = booked_count - 1 where id = v_occ.id;
        raise exception 'blocked_debt';
      -- allow_with_warning / allow_grace_n: continuar (queda deuda; el front avisa)
      end if;
    end if;
  end if;

  -- 7. crear reserva
  insert into public.class_reservations(
      studio_id, occurrence_id, member_id, status, consumed_credit, credit_ledger_id)
  values (v_occ.studio_id, v_occ.id, v_member.id, 'booked', v_consumed, v_ledger_id)
  returning * into v_res;

  return v_res;
end $$;

-- =========================== join_waitlist ===========================
create or replace function public.join_waitlist(p_occurrence_id uuid)
returns public.waitlist
language plpgsql security definer set search_path = public as $$
declare
  v_occ    public.class_occurrences;
  v_member public.members;
  v_pos    int;
  v_row    public.waitlist;
begin
  select * into v_occ from public.class_occurrences where id = p_occurrence_id for update;
  if not found then raise exception 'occurrence_not_found' using errcode = 'P0002'; end if;

  select * into v_member from public.members
   where profile_id = auth.uid() and studio_id = v_occ.studio_id and status = 'active';
  if not found then raise exception 'not_a_member'; end if;

  if v_occ.status <> 'scheduled' or v_occ.starts_at <= now() then
    raise exception 'class_closed';
  end if;

  -- no estar ya reservado ni en cola
  if exists (select 1 from public.class_reservations
             where occurrence_id = v_occ.id and member_id = v_member.id and status = 'booked') then
    raise exception 'already_booked';
  end if;
  if exists (select 1 from public.waitlist
             where occurrence_id = v_occ.id and member_id = v_member.id and status = 'waiting') then
    raise exception 'already_waiting';
  end if;

  -- posición = max+1 (la ocurrencia está bloqueada → sin choque)
  select coalesce(max(position), 0) + 1 into v_pos
    from public.waitlist where occurrence_id = v_occ.id and status = 'waiting';

  insert into public.waitlist(studio_id, occurrence_id, member_id, position, status)
  values (v_occ.studio_id, v_occ.id, v_member.id, v_pos, 'waiting')
  returning * into v_row;

  return v_row;  -- NO consume crédito (se gasta al promover, Fase 1.1)
end $$;

-- =========================== cancel_reservation ===========================
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

  -- autorización: dueño de la reserva o admin/reception del estudio
  if not (
       v_res.member_id in (select id from public.members where profile_id = auth.uid())
       or public.auth_has_role(v_res.studio_id, array['admin','reception'])
  ) then raise exception 'forbidden'; end if;

  select * into v_occ from public.class_occurrences where id = v_res.occurrence_id for update;
  select * into v_settings from public.studio_settings where studio_id = v_res.studio_id;

  v_within := now() <= v_occ.starts_at
              - make_interval(hours => v_settings.cancellation_window_hours);

  -- liberar cupo
  update public.class_occurrences
     set booked_count = greatest(booked_count - 1, 0)
   where id = v_occ.id;

  -- ¿el pack original sigue vigente? (decisión Fase 1C-0)
  if v_res.consumed_credit and v_res.credit_ledger_id is not null then
    select cl.member_pass_id into v_pass_id
      from public.credit_ledger cl where cl.id = v_res.credit_ledger_id;
    select (mp.expires_at > now()) into v_pack_valid
      from public.member_passes mp where mp.id = v_pass_id;
  end if;

  -- refund: dentro de ventana (o config) Y pack vigente. Pack vencido → sin refund auto.
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

  -- (Fase 1.1) si waitlist_enabled: promover al primero de la cola dentro de este lock.
  return v_res;
end $$;

-- ---------- grants (solo usuarios autenticados pueden invocar) ----------
grant execute on function public.reserve_class(uuid)       to authenticated;
grant execute on function public.join_waitlist(uuid)       to authenticated;
grant execute on function public.cancel_reservation(uuid)  to authenticated;

-- Fin 003_reservation_rpc.sql
