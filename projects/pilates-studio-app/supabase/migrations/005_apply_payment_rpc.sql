-- =============================================================================
-- StudioFlow — 005_apply_payment_rpc.sql  (Fase 1C-1)
-- RPC apply_payment: registra un pago confirmado y APLICA el beneficio en una
-- transacción (member_pass + asiento 'purchase' en credit_ledger, o membership).
-- Manual (MVP) y online (Fase 3) comparten esta lógica.
-- ESTADO: escrita, NO validada ejecutándose. SECURITY DEFINER (owner postgres).
-- Fuente: supabase/README.md (pendientes) + business-rules.md §12.
-- =============================================================================

create or replace function public.apply_payment(
  p_member_id        uuid,
  p_concept          text,                 -- 'drop_in' | 'pack' | 'membership' | 'abono'
  p_method           text,                 -- 'cash' | 'transfer' | 'card_manual' | 'mercadopago'
  p_amount           numeric,
  p_pass_id          uuid    default null, -- requerido si concept='pack'
  p_membership_type  text    default null, -- requerido si concept in ('membership','abono')
  p_membership_days  int     default null  -- requerido si concept in ('membership','abono')
)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  v_member      public.members;
  v_actor       public.members;
  v_pass        public.passes;
  v_payment     public.payments;
  v_member_pass public.member_passes;
  v_credits     int;
  v_expires     timestamptz;
begin
  -- 1. member objetivo + estudio
  select * into v_member from public.members where id = p_member_id;
  if not found then raise exception 'member_not_found'; end if;

  -- 2. autorización: el actor debe ser admin/reception del MISMO estudio
  select * into v_actor from public.members
   where profile_id = auth.uid() and studio_id = v_member.studio_id and status = 'active'
     and role in ('admin','reception');
  if not found then raise exception 'forbidden'; end if;

  if p_amount < 0 then raise exception 'invalid_amount'; end if;

  -- 3. registrar pago confirmado
  insert into public.payments(studio_id, member_id, amount, currency, concept, method, status, recorded_by)
  values (v_member.studio_id, v_member.id, p_amount, 'ARS', p_concept, p_method, 'confirmed', v_actor.id)
  returning * into v_payment;

  -- 4. aplicar beneficio según concepto
  if p_concept = 'pack' then
    if p_pass_id is null then raise exception 'pass_required'; end if;
    select * into v_pass from public.passes
      where id = p_pass_id and studio_id = v_member.studio_id and active;
    if not found then raise exception 'pass_not_found'; end if;

    insert into public.member_passes(studio_id, member_id, pass_id, credits_total, expires_at, source_payment_id, status)
    values (v_member.studio_id, v_member.id, v_pass.id, v_pass.credits,
            now() + make_interval(days => v_pass.validity_days), v_payment.id, 'active')
    returning * into v_member_pass;

    insert into public.credit_ledger(studio_id, member_id, member_pass_id, delta, reason, created_by)
    values (v_member.studio_id, v_member.id, v_member_pass.id, v_pass.credits, 'purchase', v_actor.id);

  elsif p_concept = 'drop_in' then
    -- clase suelta = pack de 1 crédito con vigencia corta (configurable; default 30 días)
    insert into public.member_passes(studio_id, member_id, pass_id, credits_total, expires_at, source_payment_id, status)
    values (v_member.studio_id, v_member.id, null, 1,
            now() + make_interval(days => 30), v_payment.id, 'active')
    returning * into v_member_pass;

    insert into public.credit_ledger(studio_id, member_id, member_pass_id, delta, reason, created_by)
    values (v_member.studio_id, v_member.id, v_member_pass.id, 1, 'purchase', v_actor.id);

  elsif p_concept in ('membership','abono') then
    if p_membership_days is null then raise exception 'membership_days_required'; end if;
    insert into public.memberships(studio_id, member_id, type, valid_from, valid_to, status, source_payment_id)
    values (v_member.studio_id, v_member.id, coalesce(p_membership_type, p_concept),
            now()::date, (now() + make_interval(days => p_membership_days))::date, 'active', v_payment.id);
  else
    raise exception 'invalid_concept';
  end if;

  return v_payment;
end $$;

grant execute on function public.apply_payment(uuid, text, text, numeric, uuid, text, int) to authenticated;

-- Fin 005_apply_payment_rpc.sql
