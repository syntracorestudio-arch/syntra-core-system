-- =============================================================================
-- StudioFlow — 016_apply_online_payment.sql  (Fase 3, Slice C)
-- RPC apply_online_payment: aplica un pago ONLINE aprobado (MercadoPago) a partir de
-- un payment_attempt. A diferencia de apply_payment (manual, valida auth.uid del
-- admin), este NO valida sesión — lo invoca SOLO el webhook vía service-role. Es
-- idempotente: si el intento ya está 'approved', no vuelve a aplicar.
--   attempt(pending) --aprobado--> payments(confirmed, mercadopago) + beneficio
--   (member_pass + credit_ledger, o membership) + attempt(approved, payment_id).
-- La unicidad (provider, provider_payment_id) en payments corta duplicados extra.
-- =============================================================================

create or replace function public.apply_online_payment(
  p_attempt_id          uuid,
  p_provider_payment_id text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_att     public.payment_attempts;
  v_pass    public.passes;
  v_payment public.payments;
  v_mp      public.member_passes;
begin
  select * into v_att from public.payment_attempts where id = p_attempt_id for update;
  if not found then return false; end if;
  if v_att.status = 'approved' then return false; end if;  -- idempotente

  -- pago confirmado (method/provider = mercadopago; sin recorded_by → fue online)
  insert into public.payments(studio_id, member_id, amount, currency, concept, method, status, provider, provider_payment_id)
  values (v_att.studio_id, v_att.member_id, v_att.amount, v_att.currency, v_att.concept,
          'mercadopago', 'confirmed', 'mercadopago', p_provider_payment_id)
  returning * into v_payment;

  -- aplicar beneficio según concepto (misma lógica que apply_payment, sin actor)
  if v_att.concept = 'pack' then
    select * into v_pass from public.passes where id = v_att.pass_id and studio_id = v_att.studio_id;
    if not found then raise exception 'pass_not_found'; end if;
    insert into public.member_passes(studio_id, member_id, pass_id, credits_total, expires_at, source_payment_id, status)
    values (v_att.studio_id, v_att.member_id, v_pass.id, v_pass.credits,
            now() + make_interval(days => v_pass.validity_days), v_payment.id, 'active')
    returning * into v_mp;
    insert into public.credit_ledger(studio_id, member_id, member_pass_id, delta, reason)
    values (v_att.studio_id, v_att.member_id, v_mp.id, v_pass.credits, 'purchase');

  elsif v_att.concept = 'drop_in' then
    insert into public.member_passes(studio_id, member_id, pass_id, credits_total, expires_at, source_payment_id, status)
    values (v_att.studio_id, v_att.member_id, null, 1, now() + make_interval(days => 30), v_payment.id, 'active')
    returning * into v_mp;
    insert into public.credit_ledger(studio_id, member_id, member_pass_id, delta, reason)
    values (v_att.studio_id, v_att.member_id, v_mp.id, 1, 'purchase');

  elsif v_att.concept in ('membership', 'abono') then
    insert into public.memberships(studio_id, member_id, type, valid_from, valid_to, status, source_payment_id)
    values (v_att.studio_id, v_att.member_id, v_att.concept, now()::date,
            (now() + make_interval(days => coalesce(v_att.membership_days, 30)))::date, 'active', v_payment.id);
  end if;

  update public.payment_attempts
     set status = 'approved', provider_payment_id = p_provider_payment_id, payment_id = v_payment.id
   where id = v_att.id;
  return true;
end $$;

grant execute on function public.apply_online_payment(uuid, text) to service_role;

-- Fin 016_apply_online_payment.sql
