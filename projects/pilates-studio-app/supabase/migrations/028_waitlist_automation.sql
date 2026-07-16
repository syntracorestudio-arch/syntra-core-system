-- =============================================================================
-- StudioFlow — 028_waitlist_automation.sql  (lista de espera 100% automática)
--   1) studio_settings.waitlist_auto_promote: 'until_start' (default, sube solo
--      hasta el inicio — estudios sin recepción) | 'until_window' (lo de hoy) |
--      'manual' (nunca automático; queda el botón Subir).
--   2) waitlist.skip_notified: para avisar UNA sola vez al salteado por falta de
--      saldo (sin spam en cada cancelación).
--   3) try_promote_next_waitlist: respeta el modo + notifica al salteado con CTA
--      de compra ("se liberó un lugar pero no tenías saldo").
--   4) join_waitlist: si la política del estudio exige saldo/abono para reservar,
--      también lo exige para anotarse a la espera (cola honesta, sin falsa
--      esperanza). Sin picklist nuevo: se deriva de reservation_policy.
-- Aditiva y no destructiva.
-- =============================================================================

alter table public.studio_settings
  add column if not exists waitlist_auto_promote text not null default 'until_start'
  check (waitlist_auto_promote in ('until_start', 'until_window', 'manual'));

alter table public.waitlist
  add column if not exists skip_notified boolean not null default false;

-- ---------- try_promote_next_waitlist v3 (modo + aviso al salteado) ----------
create or replace function public.try_promote_next_waitlist(p_occurrence_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_occ       public.class_occurrences;
  v_settings  public.studio_settings;
  v_wl        public.waitlist;
  v_mode      text;
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

  -- Modo de promoción automática (028): manual → nunca; until_window → corte en la
  -- ventana de cancelación; until_start (default) → hasta el inicio de la clase.
  v_mode := coalesce(v_settings.waitlist_auto_promote, 'until_start');
  if v_mode = 'manual' then return null; end if;
  if v_mode = 'until_window'
     and now() > v_occ.starts_at - make_interval(hours => coalesce(v_settings.cancellation_window_hours, 24)) then
    return null;
  end if;

  select c.name into v_cls_name from public.classes c where c.id = v_occ.class_id;
  select s.timezone into v_tz from public.studios s where s.id = v_occ.studio_id;

  for v_wl in
    select * from public.waitlist
     where occurrence_id = p_occurrence_id and status = 'waiting'
     order by position asc
  loop
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
          -- salteado por falta de saldo → avisar UNA vez, con CTA de compra
          if not v_wl.skip_notified then
            insert into public.notifications(studio_id, member_id, type, title, body, link)
            values (
              v_occ.studio_id,
              v_wl.member_id,
              'waitlist',
              'Se liberó un lugar, pero no tenías saldo',
              format('Había un lugar libre en %s del %s y estabas primero, pero sin saldo no pudimos confirmarte. Cargá tu pack para no perder la próxima.',
                     coalesce(v_cls_name, 'la clase'),
                     to_char(v_occ.starts_at at time zone coalesce(v_tz, 'America/Argentina/Buenos_Aires'), 'DD/MM HH24:MI')),
              '/app/comprar');
            update public.waitlist set skip_notified = true where id = v_wl.id;
          end if;
          continue;
        end if;
      end if;
    end if;

    update public.class_occurrences set booked_count = booked_count + 1
     where id = v_occ.id and booked_count < capacity;
    if not found then return null; end if;

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

    return v_wl.member_id;
  end loop;

  return null;
end $$;

-- ---------- join_waitlist v2 (cola honesta: saldo si la política lo exige) ----------
create or replace function public.join_waitlist(p_occurrence_id uuid)
returns public.waitlist
language plpgsql security definer set search_path = public as $$
declare
  v_occ      public.class_occurrences;
  v_member   public.members;
  v_settings public.studio_settings;
  v_eligible boolean;
  v_pos      int;
  v_row      public.waitlist;
begin
  select * into v_occ from public.class_occurrences where id = p_occurrence_id for update;
  if not found then raise exception 'occurrence_not_found' using errcode = 'P0002'; end if;

  select * into v_member from public.members
   where profile_id = auth.uid() and studio_id = v_occ.studio_id and status = 'active';
  if not found then raise exception 'not_a_member'; end if;

  if v_occ.status <> 'scheduled' or v_occ.starts_at <= now() then
    raise exception 'class_closed';
  end if;

  if exists (select 1 from public.class_reservations
             where occurrence_id = v_occ.id and member_id = v_member.id and status = 'booked') then
    raise exception 'already_booked';
  end if;
  if exists (select 1 from public.waitlist
             where occurrence_id = v_occ.id and member_id = v_member.id and status = 'waiting') then
    raise exception 'already_waiting';
  end if;

  -- Cola honesta (028): con política estricta, anotarse exige saldo o abono vigente
  select * into v_settings from public.studio_settings where studio_id = v_occ.studio_id;
  if coalesce(v_settings.reservation_policy, 'require_credit_or_membership')
     in ('require_credit_or_membership', 'block_if_debt') then
    v_eligible := exists (
        select 1 from public.memberships
         where member_id = v_member.id and status = 'active'
           and now()::date between valid_from and valid_to)
      or exists (
        select 1 from public.member_passes mp
         where mp.member_id = v_member.id and mp.expires_at > now()
           and (select coalesce(sum(cl.delta), 0) from public.credit_ledger cl
                where cl.member_pass_id = mp.id) > 0);
    if not v_eligible then raise exception 'no_credit'; end if;
  end if;

  select coalesce(max(position), 0) + 1 into v_pos
    from public.waitlist where occurrence_id = v_occ.id and status = 'waiting';

  insert into public.waitlist(studio_id, occurrence_id, member_id, position, status)
  values (v_occ.studio_id, v_occ.id, v_member.id, v_pos, 'waiting')
  returning * into v_row;

  return v_row;
end $$;

-- Fin 028_waitlist_automation.sql
